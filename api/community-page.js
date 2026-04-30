/**
 * 社区成员目录 — handler 路由
 *
 * vercel.json rewrites:
 *   /community              → /api/community-page
 *   /community/admin        → /api/community-page?mode=admin
 *   /community/{rec_id}     → /api/community-page?id={rec_id}
 *
 * Query:
 *   ?mode=admin    → admin SPA（密码登录后客户端 SPA 行为）
 *   ?id={rec_id}   → 单成员详情页
 *   ?city=大理|上海 → 列表页按城市切换（默认大理）
 *   ?from={rec_id}  → 详情页 back 链接智能回到原活动（rec_id 是活动 id）
 *   ?refresh=1     → 列表页 bypass KV 缓存（admin 改完想立刻看）
 *
 * 拆分（2026-04-30）：
 *   _community-shared.js   常量 + helpers + 错误页
 *   _community-list.js     SSR 列表
 *   _community-detail.js   SSR 详情
 *   _community-admin.js    admin SPA shell
 */

import { applyCors, checkFeishuEnv }                       from './_feishu.js';
import { fetchMember, fetchMembersByCity, stripPrivate }   from './_member.js';
import { fetchRsvpsByMember }                              from './_rsvp.js';
import { fetchAllActivities }                              from './_activity.js';
import { CITIES, EDGE_CACHE, renderErrorPage }             from './_community-shared.js';
import { renderList }                                      from './_community-list.js';
import { renderDetail }                                    from './_community-detail.js';
import { renderAdminApp }                                  from './_community-admin.js';

export default async function handler(req, res) {
  applyCors(res);

  const envErr = checkFeishuEnv(['FEISHU_APP_ID','FEISHU_APP_SECRET']);
  if (envErr) return res.status(500).send('Server config error');

  const id   = req.query.id;
  const mode = req.query.mode;
  const city = (req.query.city || '大理').toString();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // 1. Admin SPA
  if (mode === 'admin') {
    return res.status(200).send(renderAdminApp());
  }

  // 2. 详情页
  if (id) {
    if (!/^rec[a-zA-Z0-9]+$/.test(id)) {
      return res.status(400).send(renderErrorPage({
        icon: '🌿', title: '成员不存在', titleEn: 'Member not found',
        msg: '链接可能错了。', msgEn: 'The URL may be invalid.',
      }));
    }
    let member;
    try {
      member = await fetchMember(id);
    } catch (err) {
      console.error('[community-page detail]', err.message);
      return res.status(500).send(renderErrorPage({
        icon: '⚠️', title: '加载失败', titleEn: 'Failed to load',
        msg: '稍后再试。', msgEn: 'Please try again later.',
      }));
    }
    if (!member || member.hidden) {
      return res.status(404).send(renderErrorPage({
        icon: '🌿', title: '成员不存在或未公开', titleEn: 'Member not found or private',
        msg: '此成员可能已隐藏自己的资料。', msgEn: 'This member may have hidden their profile.',
      }));
    }

    // 反向查 ta 参加过的活动 + 拼上活动真实日期（注册时间通常是 backfill 当天，对用户没意义）
    let rsvps = [];
    try { rsvps = await fetchRsvpsByMember(id); }
    catch (err) { console.warn('[community-page] member rsvps fetch failed:', err.message); }

    let acts = [];
    try { acts = await fetchAllActivities(); }
    catch (err) { console.warn('[community-page] activities fetch failed:', err.message); }

    const actMap = new Map(acts.map(a => [a.record_id, a]));
    const rsvpsEnriched = rsvps.map(r => {
      const a = actMap.get(r.activity_rec_id);
      return {
        ...r,
        activity_title: a?.title || r.activity_title || '',
        activity_date:  a?.date  || '',
        activity_types: a?.types || [],
      };
    });

    // ta 的 top-3 活动类型（基于 RSVP × activity.types）
    const typeCounts = new Map();
    for (const r of rsvps) {
      const a = actMap.get(r.activity_rec_id);
      for (const t of (a?.types || [])) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
    const topTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));

    res.setHeader('Cache-Control', EDGE_CACHE);
    return res.status(200).send(renderDetail(stripPrivate(member), rsvpsEnriched, req.query.from, topTypes));
  }

  // 3. 列表页
  if (!CITIES.includes(city)) {
    return res.status(400).send(renderErrorPage({
      icon: '🌿', title: '不支持的城市', titleEn: 'Unsupported city',
      msg: `目前只支持: ${CITIES.join(' / ')}`, msgEn: `Currently supports: ${CITIES.join(' / ')}`,
    }));
  }

  const bypassCache = req.query.refresh === '1';

  let members = [];
  try {
    members = await fetchMembersByCity(city, { bypassCache });
  } catch (err) {
    console.error('[community-page list]', err.message);
    members = [];
  }

  // 私密字段剥掉再渲染
  const safeMembers = members.map(stripPrivate);

  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderList(city, safeMembers));
}
