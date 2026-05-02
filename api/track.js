/**
 * POST /api/track
 *
 * 公开埋点端点（不要密码）。前端 fire-and-forget：
 *   navigator.sendBeacon('/api/track', JSON.stringify({event, page, session_id, metadata}))
 *
 * 写到飞书 Bitable「事件流」表。
 *
 * 安全：
 *   - 限 POST
 *   - 事件名做白名单校验（防止脏数据）
 *   - rate limit 通过 KV：同 session_id 每分钟 60 条上限
 *   - 不返回敏感信息（成功 204 / 失败 4xx 5xx）
 */

import { applyCors } from './_feishu.js';
import { writeEvent, KNOWN_EVENTS } from './_events.js';
import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const RATE_LIMIT_PER_MIN = 60;

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'method' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const { event, page, session_id, metadata, referrer, utm_source, utm_campaign } = body;

  if (!event || typeof event !== 'string') {
    return res.status(400).json({ error: 'missing_event' });
  }
  if (!KNOWN_EVENTS.has(event)) {
    // 未知事件名 —— 防止脏数据，但不报错（让前端继续工作）
    return res.status(204).end();
  }

  // session-level rate limit（粗 sliding window）
  if (session_id && isKvConfigured()) {
    const now = Math.floor(Date.now() / 60000);            // 分钟桶
    const key = `track_rl:${session_id}:${now}`;
    try {
      const count = parseInt((await kvGet(key)) || '0', 10);
      if (count >= RATE_LIMIT_PER_MIN) {
        return res.status(429).json({ error: 'rate_limited' });
      }
      await kvSet(key, String(count + 1), 120);             // 2 分钟 TTL
    } catch {
      // KV 故障不阻塞埋点
    }
  }

  try {
    await writeEvent({
      event,
      page: page || req.headers.referer || '',
      session_id: session_id || '',
      metadata: metadata || null,
      referrer: referrer || req.headers.referer || '',
      utm_source: utm_source || '',
      utm_campaign: utm_campaign || '',
    });
    return res.status(204).end();
  } catch (err) {
    // 不让埋点失败影响前端体验。日志服务端，前端 silent。
    console.error('[track] write failed:', err.message);
    return res.status(204).end();
  }
}
