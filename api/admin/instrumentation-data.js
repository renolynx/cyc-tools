/**
 * POST /api/admin/instrumentation-data
 *
 * 给 /admin/instrumentation 页面用的数据接口（密码保护）。
 *
 * 请求 body:
 *   { password: string, days?: number (默认 7) }
 *
 * 返回：
 *   {
 *     ok: true,
 *     window: { days, since, until },
 *     summary: { total, unique_sessions, unique_pages },
 *     by_event:    [{ event, count, last_at }, ...] (按 count 倒序)
 *     by_page:     [{ page,  count, unique_sessions }, ...]
 *     by_day:      [{ date: 'YYYY-MM-DD', count }, ...] (按日期升序)
 *     recent:      [{ ts, event, page, session, metadata }, ...] (最多 50 条)
 *   }
 */

import { applyCors } from './../_feishu.js';
import { verifyPassword } from './../_password.js';
import { fetchRecentEvents } from './../_events.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ ok: false, error: 'method' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const { password, days } = body;

  // 密码门槛
  try {
    const ok = await verifyPassword(password);
    if (!ok) return res.status(401).json({ ok: false, error: 'unauthorized' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'auth_failed', msg: err.message });
  }

  const dayCount = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);
  const sinceMs = Date.now() - dayCount * 24 * 60 * 60 * 1000;

  let items;
  try {
    items = await fetchRecentEvents({ days: dayCount, limit: 500 });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'fetch_failed', msg: err.message });
  }

  // 聚合
  const byEvent = new Map();   // event -> {count, last_at}
  const byPage = new Map();    // page  -> {count, sessions:Set}
  const byDay = new Map();     // YYYY-MM-DD -> count
  const sessions = new Set();
  const pages = new Set();

  for (const it of items) {
    const f = it.fields || {};
    const ts = numFromCellValue(f['时间戳']);
    const ev = strFromCellValue(f['事件']);
    const pg = strFromCellValue(f['页面']);
    const sid = strFromCellValue(f['session_id']);

    if (!ev || !ts || ts < sinceMs) continue;

    // by event
    const e = byEvent.get(ev) || { count: 0, last_at: 0 };
    e.count++;
    if (ts > e.last_at) e.last_at = ts;
    byEvent.set(ev, e);

    // by page
    if (pg) {
      const p = byPage.get(pg) || { count: 0, sessions: new Set() };
      p.count++;
      if (sid) p.sessions.add(sid);
      byPage.set(pg, p);
      pages.add(pg);
    }

    // by day（北京时区）
    const d = new Date(ts + 8 * 3600 * 1000).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + 1);

    if (sid) sessions.add(sid);
  }

  // 最近事件（前 50 条，时间倒序）
  const recent = items
    .map((it) => {
      const f = it.fields || {};
      return {
        ts: numFromCellValue(f['时间戳']),
        event: strFromCellValue(f['事件']),
        page: strFromCellValue(f['页面']),
        session: strFromCellValue(f['session_id']),
        metadata: strFromCellValue(f['元数据']),
      };
    })
    .filter((x) => x.ts && x.event)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 50);

  // 转出
  const byEventList = Array.from(byEvent, ([event, v]) => ({
    event,
    count: v.count,
    last_at: v.last_at,
  })).sort((a, b) => b.count - a.count);

  const byPageList = Array.from(byPage, ([page, v]) => ({
    page,
    count: v.count,
    unique_sessions: v.sessions.size,
  })).sort((a, b) => b.count - a.count).slice(0, 30);

  // 补齐缺失的天（让图连续）
  const byDayList = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(Date.now() - (dayCount - 1 - i) * 86400000 + 8 * 3600 * 1000)
      .toISOString().slice(0, 10);
    byDayList.push({ date: d, count: byDay.get(d) || 0 });
  }

  return res.status(200).json({
    ok: true,
    window: {
      days: dayCount,
      since: new Date(sinceMs).toISOString(),
      until: new Date().toISOString(),
    },
    summary: {
      total: items.length,
      unique_sessions: sessions.size,
      unique_pages: pages.size,
    },
    by_event: byEventList,
    by_page: byPageList,
    by_day: byDayList,
    recent,
  });
}

// ─────────── 辅助 ───────────
function strFromCellValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(strFromCellValue).filter(Boolean).join('');
  if (typeof v === 'object' && 'text' in v) return v.text || '';
  return String(v);
}
function numFromCellValue(v) {
  if (typeof v === 'number') return v;
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}
