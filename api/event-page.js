/**
 * GET /api/event-page?id={record_id}
 * 服务端渲染单条活动详情页
 *
 * vercel.json rewrite: /events/:id → /api/event-page?id=:id
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchActivity }              from './_activity.js';
import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const CACHE_TTL_SEC = 600;     // KV 10 分钟
const EDGE_CACHE    = 'public, s-maxage=300, stale-while-revalidate=3600';

const SITE_URL  = 'https://cyc.center';
const SITE_NAME = 'CYC 链岛青年社区';
const OG_DEFAULT = SITE_URL + '/og-default.png';

const CN_DAYS = ['周日','周一','周二','周三','周四','周五','周六'];

// ─────────── 纯渲染函数 ───────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayBJ() {
  const bj = new Date(Date.now() + 8*3600*1000);
  return bj.toISOString().slice(0,10);
}

function posterUrl(act) {
  if (act.poster?.file_token)
    return SITE_URL + '/api/poster?token=' + encodeURIComponent(act.poster.file_token);
  return null;
}

function renderEventDetail(act) {
  const title    = escapeHtml(act.title || '未命名活动');
  const descRaw  = act.desc || '';
  const descShort = escapeHtml(descRaw.replace(/\n/g, ' ').slice(0, 100));
  const ogImage  = posterUrl(act) || OG_DEFAULT;
  const url      = `${SITE_URL}/events/${act.record_id}`;
  const isPast   = act.date && act.date < todayBJ();

  let dateStr = '';
  if (act.date) {
    const d = new Date(act.date + 'T00:00:00+08:00');
    dateStr = `${d.getMonth()+1} 月 ${d.getDate()} 日 · ${CN_DAYS[d.getDay()]}`;
  }

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="format-detection" content="telephone=no">
<title>${title} · ${SITE_NAME}</title>
<meta name="description" content="${descShort}">

<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${descShort}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${SITE_NAME}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${descShort}">
<meta name="twitter:image" content="${ogImage}">

<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="/events" class="event-back">‹ 全部活动</a>
  <a href="${SITE_URL}" class="event-site">CYC.center</a>
</header>

<main class="event-detail">
  ${posterUrl(act) ? `<img class="event-poster" src="/api/poster?token=${encodeURIComponent(act.poster.file_token)}" alt="${title} 海报" loading="eager">` : ''}

  <div class="event-meta-row">
    ${dateStr ? `<span class="event-date-pill">${dateStr}</span>` : ''}
    ${act.time ? `<span class="event-time-pill">⏰ ${escapeHtml(act.time)}</span>` : ''}
    ${isPast ? '<span class="event-past-pill">已结束</span>' : ''}
    ${act.status === '确认举办' && !isPast ? '<span class="event-confirm-pill">✓ 确认举办</span>' : ''}
  </div>

  <h1 class="event-title">${title}</h1>

  <dl class="event-info">
    ${act.loc    ? `<div class="event-info-row"><dt>📍 地点</dt><dd>${escapeHtml(act.loc)}</dd></div>` : ''}
    ${act.fee    ? `<div class="event-info-row"><dt>💰 费用</dt><dd>${escapeHtml(act.fee)}</dd></div>` : ''}
    ${act.signup ? `<div class="event-info-row"><dt>🙋 报名</dt><dd>${escapeHtml(act.signup)}</dd></div>` : ''}
  </dl>

  ${act.desc ? `<section class="event-section">
    <h2>活动简介</h2>
    <p class="event-desc">${escapeHtml(act.desc)}</p>
  </section>` : ''}

  ${act.flow?.length ? `<section class="event-section">
    <h2>详情 · 流程</h2>
    <ul class="event-flow">${act.flow.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
  </section>` : ''}

  ${act.spk?.length ? `<section class="event-section">
    <h2>带领人 / 嘉宾</h2>
    <div class="event-spk">${act.spk.map(s => `<div class="event-spk-row"><strong>${escapeHtml(s.name)}</strong>${s.bio ? `<span class="event-spk-bio"> · ${escapeHtml(s.bio)}</span>` : ''}</div>`).join('')}</div>
  </section>` : ''}
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

</body>
</html>`;
}

function render404() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>活动不存在 · ${SITE_NAME}</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page">
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<main class="event-detail event-404">
  <div class="event-404-icon">🌿</div>
  <h1>活动不存在</h1>
  <p>这条活动可能已被删除，或者链接不对。</p>
  <a href="/events" class="event-404-link">查看全部活动 →</a>
</main>
</body>
</html>`;
}

// ─────────── Handler ───────────

export default async function handler(req, res) {
  applyCors(res);

  const id = req.query.id;
  if (!id || !/^rec[a-zA-Z0-9]+$/.test(id)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(render404());
  }

  const envErr = checkFeishuEnv();
  if (envErr) {
    console.error('[event-page]', envErr);
    return res.status(500).send('Server config error');
  }

  // 1. 尝试 KV 缓存
  const cacheKey = 'event:' + id;
  let act = null;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) act = JSON.parse(cached);
    } catch {}
  }

  // 2. 缓存 miss → 拉飞书
  if (!act) {
    try {
      act = await fetchActivity(id);
    } catch (err) {
      console.error('[event-page]', err.message);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(render404());
    }
    if (act && isKvConfigured()) {
      try {
        await kvSet(cacheKey, JSON.stringify(act), CACHE_TTL_SEC);
      } catch (e) {
        console.error('[event-page] kv write failed:', e.message);
      }
    }
  }

  // 3. 不存在 / 草稿 → 404
  if (!act || !act.title) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(render404());
  }

  // 4. 渲染
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventDetail(act));
}
