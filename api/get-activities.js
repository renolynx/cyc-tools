/**
 * POST /api/get-activities
 * 读取飞书指定周内的活动
 * Body: { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD', include_rsvps?: boolean }
 *
 * include_rsvps=true 时，每个活动附带：
 *   card_speakers       最多 5 条嘉宾头像数据
 *   card_attendees      最多 8 条报名头像数据
 *   card_attendee_total 报名总人数
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchAllActivities }        from './_activity.js';
import { fetchAllRsvps }             from './_rsvp.js';
import { kvGet, isKvConfigured }     from './_kv.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { weekStart, weekEnd, include_rsvps } = req.body || {};
  if (!weekStart || !weekEnd)
    return res.status(400).json({ error: '缺少 weekStart / weekEnd' });

  const envErr = checkFeishuEnv();
  if (envErr) return res.status(500).json({ error: envErr });

  try {
    const all = await fetchAllActivities();

    const startTs = new Date(weekStart + 'T00:00:00+08:00').getTime();
    const endTs   = new Date(weekEnd   + 'T23:59:59+08:00').getTime();
    const activities = all.filter(a => {
      if (!a.date) return false;
      const ts = new Date(a.date + 'T00:00:00+08:00').getTime();
      return ts >= startTs && ts <= endTs;
    });

    // 可选：附加 RSVP 头像数据（供首页卡片头像组用）
    if (include_rsvps && activities.length) {
      try {
        const [allRsvps, memberListRaw] = await Promise.all([
          fetchAllRsvps(),
          isKvConfigured()
            ? kvGet('members:public_list').catch(() => null)
            : Promise.resolve(null),
        ]);

        // 成员 record_id → { avatar_token, name, bio }
        const memberMap = {};
        if (memberListRaw) {
          try {
            const members = JSON.parse(memberListRaw);
            for (const m of members) {
              if (m.record_id) memberMap[m.record_id] = m;
            }
          } catch {}
        }

        // 按活动 ID 分组 RSVP
        const rsvpByActivity = {};
        for (const r of allRsvps) {
          if (!r.activity_rec_id) continue;
          if (!rsvpByActivity[r.activity_rec_id]) rsvpByActivity[r.activity_rec_id] = [];
          rsvpByActivity[r.activity_rec_id].push(r);
        }

        function enrich(r) {
          const member = r.member_rec_id ? memberMap[r.member_rec_id] : null;
          return {
            name:          r.name || '',
            bio:           r.bio  || '',
            member_rec_id: r.member_rec_id || '',
            avatar_url:    member?.avatar_url   || null,  // KV blob URL（优先）
            avatar_token:  member?.avatar_token || null,  // 飞书 file_token（fallback）
          };
        }

        for (const act of activities) {
          const actRsvps  = rsvpByActivity[act.record_id] || [];
          const speakers  = actRsvps.filter(r => r.roles?.includes('活动发起者'));
          const attendees = actRsvps.filter(r => !r.roles?.includes('活动发起者'));
          act.card_speakers       = speakers.slice(0, 5).map(enrich);
          act.card_attendees      = attendees.slice(0, 8).map(enrich);
          act.card_attendee_total = attendees.length;
        }
      } catch (rsvpErr) {
        // RSVP 数据失败不阻塞主请求：降级为无头像
        console.warn('[get-activities] RSVP join failed:', rsvpErr.message);
      }
    }

    return res.status(200).json({ success: true, count: activities.length, activities });
  } catch (err) {
    console.error('[get-activities]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
