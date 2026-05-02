/**
 * 社区成员目录 — 列表页 SSR
 * 由 community-page.js handler 在 mode != admin 且无 id 时调用
 */

import {
  SITE_URL, SITE_NAME, OG_DEFAULT, CITIES,
  escapeHtml, avatarUrl, displayName, displayHub, truncate,
  renderTypeChips, renderRoleChips,
} from './_community-shared.js';

export function renderList(city, members) {
  const safeCity = escapeHtml(city);
  const total = members.length;

  const tabs = CITIES.map(c => {
    const active = c === city ? ' active' : '';
    return `<a class="cm-tab${active}" href="/community?city=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`;
  }).join('');

  const cards = members.length
    ? members.map(m => {
        const ava = avatarUrl(m);
        const name = displayName(m);
        const hub  = displayHub(m);
        const bio  = truncate(m.bio, 50);
        const job  = truncate(m.job || m.company, 30);
        const identityTags = (m.identity || []).slice(0, 3);
        const roleChips = renderRoleChips(m.roleStats);
        const typeChips = renderTypeChips(m.topTypes);
        return `<a class="cm-card" href="/community/${escapeHtml(m.record_id)}">
  <div class="cm-card-ava">${ava ? `<img src="${ava}" alt="" loading="lazy">` : '<span>👤</span>'}</div>
  <div class="cm-card-name">${escapeHtml(name)}</div>
  ${identityTags.length ? `<div class="cm-card-tags">${identityTags.map(t => `<span class="cm-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  ${roleChips ? `<div class="cm-card-roles">${roleChips}</div>` : ''}
  ${typeChips ? `<div class="cm-card-types">${typeChips}</div>` : ''}
  ${job ? `<div class="cm-card-job">${escapeHtml(job)}</div>` : ''}
  ${hub ? `<div class="cm-card-meta">📍 ${escapeHtml(hub)}</div>` : ''}
  ${bio ? `<div class="cm-card-bio">${escapeHtml(bio)}</div>` : ''}
  ${m.willShare ? `<div class="cm-card-meta">🎤 ${escapeHtml(truncate(m.willShare, 40))}</div>` : ''}
  ${m.interests ? `<div class="cm-card-meta">✨ ${escapeHtml(truncate(m.interests, 40))}</div>` : ''}
</a>`;
      }).join('')
    : `<div class="cm-empty">
  <div class="cm-empty-icon">🌿</div>
  <p>${escapeHtml(city)} 暂无成员资料</p>
  <p class="cm-empty-sub">报名活动后会自动出现在这里</p>
</div>`;

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>社区成员 · ${escapeHtml(city)} · ${SITE_NAME}</title>
<meta name="description" content="${SITE_NAME} 社区成员名册 · ${escapeHtml(city)} · CYC Connected Youth Community members in Dali / Shanghai">
<meta name="keywords" content="CYC, 链岛青年社区, Connected Youth Community, 社区成员, community members, ${escapeHtml(city)}">
<meta property="og:type" content="website">
<meta property="og:title" content="社区成员 · ${escapeHtml(city)} · ${SITE_NAME}">
<meta property="og:description" content="CYC Community Members in ${escapeHtml(city)}">
<meta property="og:url" content="${SITE_URL}/community?city=${encodeURIComponent(city)}">
<meta property="og:image" content="${OG_DEFAULT}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="zh_CN">
<meta property="og:locale:alternate" content="en_US">
<link rel="canonical" href="${SITE_URL}/community${city !== '大理' ? '?city=' + encodeURIComponent(city) : ''}">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page cm-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="${SITE_URL}" class="event-back">‹ 主页</a>
  <a href="${SITE_URL}" class="event-site">CYC.center</a>
  <a href="/admin" class="event-admin-link" data-track="community_admin_click" data-track-meta='{"from":"community_list"}'>⚙️ admin</a>
</header>

<main class="cm-main">
  <div class="cm-hero">
    <h1>社区成员</h1>
    <p class="cm-hero-sub">${SITE_NAME} · Connected Youth Community</p>
  </div>

  <div class="cm-tabs">${tabs}</div>
  <div class="cm-count">${escapeHtml(city)} 公开成员 · ${total} 位</div>

  <div class="cm-grid">${cards}</div>
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

<script src="/cyc-track.js" defer></script>
</body>
</html>`;
}
