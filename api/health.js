/**
 * GET /api/health
 *
 * 自动监控用：cron / Vercel scheduled function 每小时打一次，确认所有关键
 * 依赖（飞书 / KV / 主要数据流）都活着。失败就在 Vercel 日志里能看到，方便
 * 第一时间发现问题，不用等用户反馈。
 *
 * 检查项（每个独立计时 + 不互相阻塞）：
 *   1. KV：能 GET / SET / DEL
 *   2. 飞书活动表：fetchAllActivities 拿到 N 条
 *   3. 飞书成员表：fetchAllMembers 拿到 N 条
 *   4. 飞书 RSVP 表：fetchAllRsvps 拿到 N 条
 *
 * 返回 200 + JSON（即使有失败也返 200，让 cron 拿到结构化结果；只在网络/
 * 鉴权完全炸时返 500）。
 */

import { applyCors } from './_feishu.js';
import { kvGet, kvSet, kvDel, isKvConfigured } from './_kv.js';
import { fetchAllActivities } from './_activity.js';
import { fetchAllMembers } from './_member.js';
import { fetchAllRsvps } from './_rsvp.js';

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - t0, ...result };
  } catch (err) {
    return { label, ok: false, ms: Date.now() - t0, error: err.message };
  }
}

export default async function handler(req, res) {
  applyCors(res);

  const checks = await Promise.all([
    timed('kv', async () => {
      if (!isKvConfigured()) return { skipped: 'not configured' };
      const probeKey = 'health:probe';
      const probeVal = String(Date.now());
      await kvSet(probeKey, probeVal, 60);
      const got = await kvGet(probeKey);
      await kvDel(probeKey);
      if (got !== probeVal) throw new Error('KV roundtrip mismatch');
      return { ok: true };
    }),
    timed('feishu_activities', async () => {
      const acts = await fetchAllActivities();
      return { count: acts.length };
    }),
    timed('feishu_members', async () => {
      const ms = await fetchAllMembers();
      return { count: ms.length };
    }),
    timed('feishu_rsvps', async () => {
      const rs = await fetchAllRsvps();
      return { count: rs.length };
    }),
  ]);

  const allOk = checks.every(c => c.ok || c.skipped);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(allOk ? 200 : 503).json({
    success: allOk,
    ts: new Date().toISOString(),
    checks,
  });
}
