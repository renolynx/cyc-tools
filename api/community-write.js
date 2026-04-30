/**
 * 成员写操作端点（admin 用，密码保护）
 *
 * POST /api/community-write
 * Body: {
 *   action:    'search' | 'create' | 'update',
 *   password:  string,                    // 必填，与 SYNC_PASSWORD 比对
 *   record_id?: string,                    // update 必填
 *   data?:     { ... },                    // create / update 时的字段
 *   query?:    string,                     // search 用
 *   cityFilter?: 'all' | '大理' | '上海' | 'hidden',
 * }
 */

import { applyCors } from './_feishu.js';
import { verifyPassword } from './_password.js';
import {
  fetchAllMembers,
  fetchMember,
  writeMember,
  inferMemberActivityCities,
} from './_member.js';

/**
 * 拉所有成员 + 给每条加 inferredCities 字段（活动反推）
 * 服务端不做 city/hidden 过滤，客户端拿全集自己筛 → tab 切换瞬时
 */
async function handleSearch(req, res) {
  const [members, inferredMap] = await Promise.all([
    fetchAllMembers(),
    inferMemberActivityCities(),
  ]);

  const enriched = members.map(m => ({
    ...m,
    inferredCities: [...(inferredMap.get(m.record_id) || [])],
  }));

  return res.status(200).json({
    success: true,
    count: enriched.length,
    members: enriched,
  });
}

async function handleCreate(req, res) {
  const data = req.body.data || {};
  if (!data.name || !data.name.trim()) return res.status(400).json({ error: '请填写姓名' });

  try {
    const result = await writeMember(data);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[community-write create]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleUpdate(req, res) {
  const record_id = req.body.record_id;
  const data = req.body.data || {};
  if (!record_id) return res.status(400).json({ error: '缺 record_id' });

  try {
    const result = await writeMember(data, record_id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[community-write update]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(req, res) {
  // 取单条完整记录（含私密）给编辑表单 prefill 用
  const id = req.body.record_id;
  if (!id) return res.status(400).json({ error: '缺 record_id' });
  const m = await fetchMember(id);
  if (!m) return res.status(404).json({ error: '成员不存在' });
  return res.status(200).json({ success: true, member: m });
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action, password } = req.body || {};

  // 密码校验（用 SYNC_PASSWORD）
  if (!await verifyPassword(password)) {
    return res.status(401).json({ error: '密码错误' });
  }

  if (action === 'search') return handleSearch(req, res);
  if (action === 'get')    return handleGet(req, res);
  if (action === 'create') return handleCreate(req, res);
  if (action === 'update') return handleUpdate(req, res);

  return res.status(400).json({ error: `unknown action: ${action}` });
}
