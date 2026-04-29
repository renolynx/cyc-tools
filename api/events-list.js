/**
 * GET /api/events-list
 * 公开活动列表页（SSR）
 * 默认显示 date >= 今天 的活动，按日期升序，分组展示
 *
 * vercel.json rewrite: /events → /api/events-list
 */

import { applyCors, checkFeishuEnv }    from './_feishu.js';
import { fetchAllActivities, formatCnDate, todayBJ } from './_activity.js';
import { kvGet, kvSet, isKvConfigured }  from './_kv.js';

const CACHE_TTL_SEC = 300;
const EDGE_CACHE    = 'public, s-maxage=180, stale-while-revalidate=1800';

const SITE_URL  = 'https://cyc.center';
const SITE_NAME = 'CYC 链岛青年社区';
const OG_DEFAULT = SITE_URL + '/api/og-default';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function thumbUrl(act) {
  if (act.poster?.file_token)
    return '/api/poster?token=' + encodeURIComponent(act.poster.file_token);
  return null;
}

function renderCard(a, isPast) {
  const thumb = thumbUrl(a);
  let status = '';
  if (isPast) status = '<span class="el-card-status past">已结束</span>';
  else if (a.status === '确认举办') status = '<span class="el-card-status confirm">✓ 确认举办</span>';
  else if (a.status === '筹备酝酿中') status = '<span class="el-card-status plan">筹备中</span>';

  return `<a class="el-card${isPast ? ' is-past' : ''}" href="/events/${a.record_id}">
  ${thumb ? `<img class="el-card-thumb" src="${thumb}" alt="" loading="lazy">` : '<div class="el-card-thumb el-card-thumb-empty">📅</div>'}
  <div class="el-card-body">
    <div class="el-card-title">${escapeHtml(a.title)}</div>
    <div class="el-card-meta">
      ${a.time ? `<span>⏰ ${escapeHtml(a.time)}</span>` : ''}
      ${a.loc  ? `<span>📍 ${escapeHtml(a.loc)}</span>`  : ''}
    </div>
    ${status}
  </div>
  <span class="el-card-arrow">›</span>
</a>`;
}

function renderGroups(acts, isPast) {
  const groups = {};
  for (const a of acts) {
    if (!groups[a.date]) groups[a.date] = [];
    groups[a.date].push(a);
  }
  // 未来升序，过去降序（最新过去活动在前）
  const dates = Object.keys(groups).sort();
  if (isPast) dates.reverse();

  return dates.map(date => `<section class="el-day-group">
  <div class="el-day-head">${formatCnDate(date)}</div>
  ${groups[date].map(a => renderCard(a, isPast)).join('\n')}
</section>`).join('\n');
}

function renderEventsList(acts) {
  const today = todayBJ();
  const valid = acts.filter(a => a.date && a.title);
  const upcoming = valid.filter(a => a.date >= today)
                        .sort((a,b) => a.date.localeCompare(b.date));
  const past     = valid.filter(a => a.date <  today);

  const upcomingHtml = upcoming.length
    ? renderGroups(upcoming, false)
    : `<div class="el-empty">
  <div class="el-empty-icon">🌿</div>
  <p>近期暂无即将到来的活动</p>
  <p class="el-empty-sub">下一波活动正在筹备中，过两天再来看看</p>
</div>`;

  const pastHtml = past.length
    ? `<section class="el-past-section">
  <div class="el-past-divider"><span>已结束的活动</span></div>
  ${renderGroups(past, true)}
</section>`
    : '';


  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>近期活动 · ${SITE_NAME}</title>
<meta name="description" content="${SITE_NAME}近期社群活动 · 大理 · 链接每一座孤岛">

<meta property="og:type" content="website">
<meta property="og:title" content="近期活动 · ${SITE_NAME}">
<meta property="og:description" content="${SITE_NAME}的活动日历，每周持续更新">
<meta property="og:url" content="${SITE_URL}/events">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:image" content="${OG_DEFAULT}">

<link rel="canonical" href="${SITE_URL}/events">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page el-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="${SITE_URL}" class="event-back">‹ 主页</a>
  <a href="${SITE_URL}" class="event-site">CYC.center</a>
</header>

<main class="el-main">
  <div class="el-hero">
    <h1>近期活动</h1>
    <p class="el-hero-sub">${SITE_NAME} · 大理</p>
  </div>

  ${upcomingHtml}
  ${pastHtml}
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

</body>
</html>`;
}

export default async function handler(req, res) {
  applyCors(res);

  const envErr = checkFeishuEnv();
  if (envErr) {
    console.error('[events-list]', envErr);
    return res.status(500).send('Server config error');
  }

  // KV 缓存
  const cacheKey = 'events:upcoming';
  let acts = null;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) acts = JSON.parse(cached);
    } catch {}
  }

  if (!acts) {
    try {
      acts = await fetchAllActivities();
    } catch (err) {
      console.error('[events-list]', err.message);
      acts = [];  // 优雅降级：飞书挂了也渲染空列表
    }
    if (acts.length && isKvConfigured()) {
      try {
        await kvSet(cacheKey, JSON.stringify(acts), CACHE_TTL_SEC);
      } catch {}
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventsList(acts));
}
