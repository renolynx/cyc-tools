/**
 * POST /api/admin/snapshot
 *
 * 灾难恢复 —— 把所有飞书 Bitable 表导出成 JSON 写到 KV。
 *
 * 请求 body:
 *   { password: string, action?: 'create' | 'list' | 'get' (默认 create) }
 *   - create: 现在拍一张快照写到 KV，返回元信息
 *   - list:   列最近 20 张快照（key + 时间 + 大小）
 *   - get:    body.snapshot_id 取出某张快照原文（JSON）
 *
 * KV key 命名：snapshot:YYYY-MM-DDTHH:mm:ssZ
 * TTL：90 天（KV 自动过期）
 *
 * 调用建议：每周一次 cron 自动跑（vercel.json crons），手动也行。
 *
 * 为啥不写到 Bitable / Blob：
 *   - Bitable 是被备份的对象，不能套娃
 *   - Blob 写大 JSON 不便宜
 *   - KV 90 天够回滚窗口，超了大概率项目已 pivot 或新备份
 */

import { applyCors } from './../_feishu.js';
import { verifyPassword } from './../_password.js';
import { getAccessToken } from './../_feishu.js';
import { kvGet, kvSet, isKvConfigured } from './../_kv.js';

const APP_TOKENS = [
  { name: '主 Bitable', token: process.env.FEISHU_APP_TOKEN },
  { name: '成员 Bitable', token: process.env.FEISHU_MEMBER_APP_TOKEN },
];

const SNAPSHOT_TTL = 90 * 24 * 60 * 60;     // 90 天
const SNAPSHOT_LIST_KEY = 'snapshot:list';  // 索引：最近 N 张快照的 key

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ ok: false, error: 'method' });

  if (!isKvConfigured()) {
    return res.status(500).json({ ok: false, error: 'kv_not_configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const { password, action = 'create' } = body;

  try {
    const ok = await verifyPassword(password);
    if (!ok) return res.status(401).json({ ok: false, error: 'unauthorized' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'auth_failed', msg: err.message });
  }

  if (action === 'create') return createSnapshot(res);
  if (action === 'list')   return listSnapshots(res);
  if (action === 'get')    return getSnapshot(res, body.snapshot_id);

  return res.status(400).json({ ok: false, error: 'unknown_action' });
}

// ─────────── create ───────────
async function createSnapshot(res) {
  const startedAt = Date.now();
  const isoStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const key = `snapshot:${isoStamp}`;

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'feishu_auth', msg: err.message });
  }

  const payload = {
    snapshot_id: key,
    created_at: new Date().toISOString(),
    bitables: [],
  };

  for (const { name, token: appToken } of APP_TOKENS) {
    if (!appToken) continue;

    const bitable = { name, app_token: appToken, tables: [] };

    try {
      // list tables
      const listRes = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables?page_size=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const listData = await listRes.json();
      if (listData.code !== 0) {
        bitable.error = `tables list failed (${listData.code}): ${listData.msg}`;
        payload.bitables.push(bitable);
        continue;
      }

      const tables = listData.data?.items || [];

      for (const t of tables) {
        const records = await fetchAllRecords(appToken, t.table_id, token);
        bitable.tables.push({
          table_id: t.table_id,
          name: t.name,
          revision: t.revision,
          record_count: records.length,
          records,
        });
      }
    } catch (err) {
      bitable.error = `unexpected: ${err.message}`;
    }

    payload.bitables.push(bitable);
  }

  const json = JSON.stringify(payload);
  const sizeKb = Math.round(json.length / 1024);

  try {
    await kvSet(key, json, SNAPSHOT_TTL);
    // 维护索引
    const indexRaw = (await kvGet(SNAPSHOT_LIST_KEY)) || '[]';
    const index = JSON.parse(indexRaw);
    index.unshift({ key, created_at: payload.created_at, size_kb: sizeKb });
    const trimmed = index.slice(0, 20);  // 索引保留最近 20 张
    await kvSet(SNAPSHOT_LIST_KEY, JSON.stringify(trimmed), SNAPSHOT_TTL);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'kv_write', msg: err.message });
  }

  return res.status(200).json({
    ok: true,
    snapshot_id: key,
    created_at: payload.created_at,
    size_kb: sizeKb,
    bitable_count: payload.bitables.length,
    table_count: payload.bitables.reduce((sum, b) => sum + (b.tables?.length || 0), 0),
    record_total: payload.bitables.reduce(
      (sum, b) => sum + (b.tables || []).reduce((s, t) => s + (t.record_count || 0), 0),
      0
    ),
    duration_ms: Date.now() - startedAt,
  });
}

// ─────────── list ───────────
async function listSnapshots(res) {
  try {
    const indexRaw = (await kvGet(SNAPSHOT_LIST_KEY)) || '[]';
    const index = JSON.parse(indexRaw);
    return res.status(200).json({ ok: true, snapshots: index });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'kv_read', msg: err.message });
  }
}

// ─────────── get ───────────
async function getSnapshot(res, snapshotId) {
  if (!snapshotId) return res.status(400).json({ ok: false, error: 'missing_snapshot_id' });
  try {
    const raw = await kvGet(snapshotId);
    if (!raw) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.status(200).json({ ok: true, snapshot: JSON.parse(raw) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'kv_read', msg: err.message });
  }
}

// ─────────── 辅助：分页拉所有 records ───────────
async function fetchAllRecords(appToken, tableId, token, max = 5000) {
  const items = [];
  let pageToken = '';
  let safety = 20;  // 最多 20 页 = 10000 条

  while (safety-- > 0) {
    const url = new URL(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) {
      console.error(`[snapshot] fetch records failed for ${tableId}: ${data.msg}`);
      break;
    }

    const batch = data.data?.items || [];
    items.push(...batch);
    if (items.length >= max) break;

    if (!data.data?.has_more) break;
    pageToken = data.data.page_token;
  }

  return items;
}
