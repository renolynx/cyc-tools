/**
 * 社区目录共享模块：常量 + SSR 渲染 helpers + 错误页
 *
 * 之前 community-page.js 1100+ 行单文件混杂列表 / 详情 / admin SSR + 共享
 * helpers，改一处常牵动其他位置回归。这次拆开：
 *   _community-shared.js  本文件 — 常量 + 通用 SSR helpers + 错误页
 *   _community-list.js    列表 SSR
 *   _community-detail.js  详情 SSR
 *   _community-admin.js   admin SPA shell（HTML + inline JS 字符串）
 *   community-page.js     精简到 handler + 路由
 */

export const SITE_URL   = 'https://cyc.center';
export const SITE_NAME  = 'CYC 链岛青年社区';
export const OG_DEFAULT = SITE_URL + '/api/og-default';
export const EDGE_CACHE = 'public, s-maxage=60, stale-while-revalidate=1800';
export const CITIES     = ['大理', '上海'];

// ─────────── 通用 SSR helpers ───────────

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function avatarUrl(member) {
  // 优先 KV blob URL（/me/timeline 上传走这条），fallback 飞书「照片」字段
  if (member?.avatar_url) return member.avatar_url;
  if (member?.avatar?.file_token)
    return SITE_URL + '/api/poster?token=' + encodeURIComponent(member.avatar.file_token);
  return null;
}

/** 拿成员的"显示名"：优先称呼 fallback 姓名 */
export function displayName(m) {
  return (m.nickname || m.name || '').trim() || '未署名';
}

/** 拿成员"位置"显示文案：第一个据点名 */
export function displayHub(m) {
  return (m.hubs && m.hubs[0] && m.hubs[0].name) || '';
}

/** 文本截断 + 省略号 */
export function truncate(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** topTypes [{type,count}] → chip 行 */
export function renderTypeChips(topTypes) {
  if (!Array.isArray(topTypes) || !topTypes.length) return '';
  return topTypes.map(t =>
    `<span class="cm-type-chip">${escapeHtml(t.type)}${t.count > 1 ? ` <em>×${t.count}</em>` : ''}</span>`
  ).join('');
}

/** 把 roleStats {'活动发起者':3, '嘉宾':1, '活动参与者':5} 渲染成 chip 行
 *  优先级：活动发起者 → 嘉宾 → 活动参与者 → 其他
 */
export function renderRoleChips(stats) {
  if (!stats || typeof stats !== 'object') return '';
  const order = [
    { role: '活动发起者', cls: 'host',    short: '发起' },
    { role: '嘉宾',       cls: 'speaker', short: '嘉宾' },
    { role: '活动参与者', cls: 'attend',  short: '参与' },
  ];
  const known = new Set(order.map(o => o.role));
  const chips = [];
  for (const o of order) {
    const n = stats[o.role];
    if (n) chips.push(`<span class="cm-role-chip role-${o.cls}">${o.short} ×${n}</span>`);
  }
  // 任何不在 known 里的角色（罕见，飞书表里手动加的怪角色）也显示
  for (const [role, n] of Object.entries(stats)) {
    if (!known.has(role) && n) {
      chips.push(`<span class="cm-role-chip role-other">${escapeHtml(role)} ×${n}</span>`);
    }
  }
  return chips.join('');
}

// ─────────── 错误页 ───────────

export function renderErrorPage({ icon, title, titleEn, msg, msgEn }) {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page">
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<main class="event-detail event-404">
  <div class="event-404-icon">${icon}</div>
  <h1>${title}</h1>
  <p class="event-404-en">${titleEn}</p>
  <p>${msg}</p>
  <p class="event-404-en-sub">${msgEn}</p>
  <a href="/community" class="event-404-link">查看全部成员 → All Members</a>
</main>
</body>
</html>`;
}
