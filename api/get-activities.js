/**
 * POST /api/get-activities
 * 读取飞书指定周内的活动
 * Body: { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD' }
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchAllActivities }        from './_activity.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { weekStart, weekEnd } = req.body || {};
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

    return res.status(200).json({ success: true, count: activities.length, activities });
  } catch (err) {
    console.error('[get-activities]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
