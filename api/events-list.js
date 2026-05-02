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
const EDGE_CACHE    = 'public, s-maxage=60, stale-while-revalidate=1800';

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
    ${a.types?.length ? `<div class="el-card-types">${a.types.slice(0,3).map(t => `<span class="cm-type-chip">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
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


  // ItemList JSON-LD（提升 Google 富搜索可见性）
  const itemListLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    'name':     `${SITE_NAME} · Upcoming Community Events in Dali`,
    'itemListElement': upcoming.slice(0, 20).map((a, i) => ({
      '@type':    'ListItem',
      'position': i + 1,
      'url':      `${SITE_URL}/events/${a.record_id}`,
      'name':     a.title,
    })),
  });

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>近期活动 · CYC Connected Youth Community Dali Events</title>
<meta name="description" content="CYC 链岛青年社区近期社群活动 · Connected Youth Community in Dali, China — coliving events, digital nomad gatherings, workshops & more.">
<meta name="keywords" content="CYC, 链岛青年社区, Connected Youth Community, Dali, 大理, 数字游民, digital nomad, coliving, community events, Yunnan">

<meta property="og:type" content="website">
<meta property="og:title" content="Events · CYC 链岛青年社区 · Dali">
<meta property="og:description" content="${SITE_NAME} weekly events calendar in Dali, China · 每周持续更新">
<meta property="og:url" content="${SITE_URL}/events">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:image" content="${OG_DEFAULT}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="zh_CN">
<meta property="og:locale:alternate" content="en_US">

<link rel="canonical" href="${SITE_URL}/events">
<link rel="stylesheet" href="/styles.css">

<script type="application/ld+json">
${itemListLd}
</script>
</head>
<body class="event-page el-page atlas-canvas">

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

  <section class="el-about" lang="en">
    <h2>About CYC</h2>
    <p>
      <strong>CYC (Connected Youth Community / 链岛青年社区)</strong> is a self-organized
      coliving and community space in Dali, Yunnan — open to digital nomads,
      travelers, creators and dreamers from around the world. We host weekly
      gatherings, workshops, and shared meals between Cangshan mountain and
      Erhai lake.
    </p>
    <p class="el-about-zh" lang="zh-CN">
      CYC 链岛青年社区，位于云南大理，是一个面向全球年轻旅行者 / 创作者 / 数字游民的
      自治共创共居社区。我们每周组织丰富的线下活动，链接每一座孤岛。
    </p>
    <p class="el-about-link"><a href="${SITE_URL}">cyc.center</a></p>
  </section>
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

<script src="/cyc-track.js" defer></script>
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

  // KV 缓存（?refresh=1 跳过：admin 改完想立刻看时用）
  const cacheKey = 'events:upcoming';
  const bypassCache = req.query.refresh === '1';
  let acts = null;
  if (!bypassCache && isKvConfigured()) {
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
