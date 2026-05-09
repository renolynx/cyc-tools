/**
 * GET / POST /api/me-rsvps
 * Body / query: { credential }
 *
 * 通过 wechat 或 email 匹配，返回该用户所有 RSVP（含活动 join 信息）
 *   { success, rsvps: [{
 *       record_id, name, role, registered_at,
 *       activity: { record_id, title, title_en, date, time, city, status, loc }
 *     }, ...]}
 *
 * credential 是 wechat / email / 邮箱 任一形式。服务端 case-insensitive 比对。
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchAllRsvps }              from './_rsvp.js';
import { fetchAllActivities }         from './_activity.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const credential = (req.method === 'POST' ? (req.body?.credential) : (req.query.credential)) || '';
  const c = String(credential).trim().toLowerCase();
  if (!c) return res.status(400).json({ error: '缺 credential（微信号或邮箱）' });

  const envErr = checkFeishuEnv();
  if (envErr) return res.status(500).json({ error: envErr });

  try {
    const [allRsvps, allActs] = await Promise.all([
      fetchAllRsvps(),
      fetchAllActivities(),
    ]);

    const norm = s => (s || '').trim().toLowerCase();
    const mine = allRsvps.filter(r =>
      (r.wechat && norm(r.wechat) === c) ||
      (r.email  && norm(r.email)  === c)
    );

    // 按活动 id 索引活动数据
    const actMap = {};
    for (const a of allActs) actMap[a.record_id] = a;

    const enriched = mine.map(r => {
      const a = actMap[r.activity_rec_id] || null;
      return {
        record_id:     r.record_id,
        name:          r.name,
        role:          r.roles?.[0] || '',
        registered_at: r.registered_at,
        wechat:        r.wechat,
        email:         r.email,
        attendance_mode: r.attendance_mode,
        ticket_holder:   r.ticket_holder,
        activity: a ? {
          record_id: a.record_id,
          title:     a.title,
          title_en:  a.title_en,
          date:      a.date,
          time:      a.time,
          city:      a.city,
          status:    a.status,
          loc:       a.loc,
          types:     a.types,
        } : { record_id: r.activity_rec_id, title: r.activity_title || '(unknown)' },
      };
    });

    // 未来的在前 + 按日期升序；过去的在后倒序
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const upcoming = enriched.filter(r => (r.activity?.date || '') >= today)
      .sort((a, b) => (a.activity?.date || '').localeCompare(b.activity?.date || ''));
    const past = enriched.filter(r => (r.activity?.date || '') <  today)
      .sort((a, b) => (b.activity?.date || '').localeCompare(a.activity?.date || ''));

    return res.status(200).json({
      success: true,
      count:    enriched.length,
      upcoming, past,
    });
  } catch (err) {
    console.error('[me-rsvps]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
