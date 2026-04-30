/**
 * GET /api/member?id=recXXX
 * GET /api/member?id=rec1,rec2,rec3   (批量，最多 30 条)
 *
 * 给团队架构页的「关联成员后展开档案卡」用 — 返回单个/多个成员的完整档案
 *   - 单 ID  → { success, member }
 *   - 多 ID  → { success, members: [...] }
 *
 * 鉴权同 /api/members：Authorization: Bearer <TEAM_PASSWORD>
 *
 * 跟 /api/members 的区别：
 *   - /api/members: 列表、bio 截断 80 字、字段精简（picker 滚动用）
 *   - /api/member:  完整 bio + 职业 / 兴趣 / 想分享 / MBTI / 身份 / 城市
 *                   + activities（按时间倒序最多 20 条参与记录）
 */

import { applyCors } from './_feishu.js';
import { fetchMember, stripPrivate } from './_member.js';
import { fetchRsvpsByMember } from './_rsvp.js';
import { fetchAllActivities } from './_activity.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── 鉴权 ──
  const TEAM_PASSWORD = process.env.TEAM_PASSWORD;
  if (!TEAM_PASSWORD)
    return res.status(500).json({ error: '管理密码未配置（TEAM_PASSWORD）' });

  const auth = req.headers.authorization || '';
  const password = auth.replace(/^Bearer\s+/i, '').trim();
  if (password !== TEAM_PASSWORD)
    return res.status(401).json({ error: '密码错误' });

  // ── 参数：支持单 ID 或逗号分隔的批量 ──
  const idParam = (req.query.id || '').toString().trim();
  if (!idParam) return res.status(400).json({ error: '缺少 id 参数' });

  const ids = idParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  if (!ids.length) return res.status(400).json({ error: 'id 为空' });
  const isBatch = idParam.includes(',');

  // ── 环境变量检查 ──
  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'FEISHU_MEMBER_TABLE_ID'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length)
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });

  try {
    // 并发拉：所有成员 + 活动全表（用于 join）
    // 都有 KV 缓存（成员 30min、活动 5min），多次调本端点不会反复打飞书
    const [memberResults, acts] = await Promise.all([
      Promise.all(ids.map(id => fetchMember(id).catch(() => null))),
      fetchAllActivities().catch(() => []),
    ]);

    // 并发拉每个成员的 RSVP（5min 缓存）
    const rsvpsByMember = await Promise.all(
      ids.map(id => fetchRsvpsByMember(id).catch(() => []))
    );

    const actMap = new Map(acts.map(a => [a.record_id, a]));

    const result = memberResults.map((m, i) => {
      if (!m || m.hidden) return null;
      const safe = stripPrivate(m);

      // 关联活动（最近 20 条；activity.date 是 'YYYY-MM-DD' 字符串，字典序 = 时间序）
      const myRsvps = rsvpsByMember[i] || [];
      const activities = myRsvps
        .map(r => {
          const a = actMap.get(r.activity_rec_id);
          if (!a) return null;
          return {
            id:    a.record_id,
            title: a.title || '',
            date:  a.date  || '',
            loc:   a.loc   || '',
            types: a.types || [],
            roles: r.roles || [],
          };
        })
        .filter(Boolean)
        .sort((x, y) => (y.date || '').localeCompare(x.date || ''))
        .slice(0, 20);

      return {
        record_id:      safe.record_id,
        name:           safe.name || '',
        nickname:       safe.nickname || '',
        avatar_token:   safe.avatar?.file_token || null,
        bio:            safe.bio || '',
        job:            safe.job || '',
        company:        safe.company || '',
        topics:         safe.topics || '',
        willShare:      safe.willShare || '',
        interests:      safe.interests || '',
        mbti:           safe.mbti || '',
        identity:       safe.identity || [],
        contribution:   safe.contribution || [],
        residentStatus: safe.residentStatus || '',
        cities:         safe.cities || [],
        hubs:           safe.hubs || [],
        activities,
      };
    }).filter(Boolean);

    if (isBatch) {
      return res.status(200).json({ success: true, members: result });
    }
    return result.length
      ? res.status(200).json({ success: true, member: result[0] })
      : res.status(404).json({ error: '成员不存在或已隐藏' });

  } catch (err) {
    console.error('[member]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
