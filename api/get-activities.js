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
import { fetchMember }               from './_member.js';

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
        const allRsvps = await fetchAllRsvps();

        // 按活动 ID 分组 RSVP（只关心当前 weekStart-weekEnd 内的活动）
        const validIds = new Set(activities.map(a => a.record_id));
        const rsvpByActivity = {};
        for (const r of allRsvps) {
          if (!validIds.has(r.activity_rec_id)) continue;
          if (!rsvpByActivity[r.activity_rec_id]) rsvpByActivity[r.activity_rec_id] = [];
          rsvpByActivity[r.activity_rec_id].push(r);
        }

        // 仅给会进入 stack 的成员拉资料（每条 30min KV cache，比 public_list 更稳）
        const uniqueMemberIds = [...new Set(
          Object.values(rsvpByActivity).flat()
            .map(r => r.member_rec_id)
            .filter(Boolean)
        )];
        const memberMap = {};
        if (uniqueMemberIds.length) {
          const fetched = await Promise.all(
            uniqueMemberIds.map(id => fetchMember(id).catch(() => null))
          );
          for (const m of fetched) {
            if (m?.record_id) memberMap[m.record_id] = m;
          }
        }

        function enrich(r) {
          const m = r.member_rec_id ? memberMap[r.member_rec_id] : null;
          return {
            name:          r.name || '',
            // 成员资料 bio 兜底 rsvp bio（rsvp bio 注册时填的，可能为空）
            bio:           r.bio  || m?.bio || '',
            member_rec_id: r.member_rec_id || '',
            avatar_url:    m?.avatar_url        || null,  // KV blob URL（优先）
            avatar_token:  m?.avatar?.file_token || null, // 飞书 file_token（fallback）
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
