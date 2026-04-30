/**
 * 社区成员目录（公开页 + 详情页 + admin placeholder）
 *
 * vercel.json rewrites:
 *   /community              → /api/community-page
 *   /community/admin        → /api/community-page?mode=admin
 *   /community/{rec_id}     → /api/community-page?id={rec_id}
 *
 * Query:
 *   ?mode=admin    → Phase E 才实现，当前显示"建设中"
 *   ?id={rec_id}   → 单成员详情页
 *   ?city=大理|上海 → 列表页按城市切换（默认大理）
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchMember, fetchMembersByCity, stripPrivate } from './_member.js';
import { fetchRsvpsByMember }                            from './_rsvp.js';

const SITE_URL  = 'https://cyc.center';
const SITE_NAME = 'CYC 链岛青年社区';
const OG_DEFAULT = SITE_URL + '/api/og-default';
const EDGE_CACHE = 'public, s-maxage=180, stale-while-revalidate=1800';
const CITIES = ['大理', '上海'];

// ─────────── 工具 ───────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function avatarUrl(member) {
  if (member && member.avatar?.file_token)
    return SITE_URL + '/api/poster?token=' + encodeURIComponent(member.avatar.file_token);
  return null;
}

/** 拿成员的"显示名"：优先称呼 fallback 姓名 */
function displayName(m) {
  return (m.nickname || m.name || '').trim() || '未署名';
}

/** 拿成员"位置"显示文案：第一个据点名 */
function displayHub(m) {
  return (m.hubs && m.hubs[0] && m.hubs[0].name) || '';
}

/** 文本截断 + 省略号 */
function truncate(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─────────── 列表页 ───────────

function renderList(city, members) {
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
        return `<a class="cm-card" href="/community/${escapeHtml(m.record_id)}">
  <div class="cm-card-ava">${ava ? `<img src="${ava}" alt="" loading="lazy">` : '<span>👤</span>'}</div>
  <div class="cm-card-name">${escapeHtml(name)}</div>
  ${identityTags.length ? `<div class="cm-card-tags">${identityTags.map(t => `<span class="cm-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
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

</body>
</html>`;
}

// ─────────── 详情页 ───────────

function renderDetail(member, rsvps) {
  const name = displayName(member);
  const ava  = avatarUrl(member);
  const url  = `${SITE_URL}/community/${member.record_id}`;
  const ogImage = ava || OG_DEFAULT;
  const descShort = truncate(member.bio || member.job || `${name} · CYC 社区成员`, 100);
  const hubName = displayHub(member);

  // RSVP 拆 hosts vs participated
  const founded = rsvps.filter(r => r.roles.includes('活动发起者') || r.roles.includes('嘉宾'));
  const joined  = rsvps.filter(r => r.roles.includes('活动参与者'));

  const rsvpRow = r => {
    const role = r.roles[0] || '参与者';
    const date = r.registered_at ? new Date(r.registered_at).toISOString().slice(0,10) : '';
    return `<a class="cm-rsvp-row" href="/events/${escapeHtml(r.activity_rec_id)}">
  <span class="cm-rsvp-title">${escapeHtml(r.activity_title || '未命名活动')}</span>
  <span class="cm-rsvp-meta">
    <span class="cm-rsvp-role">${escapeHtml(role)}</span>
    ${date ? `<span class="cm-rsvp-date">${date}</span>` : ''}
  </span>
</a>`;
  };

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>${escapeHtml(name)} · ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(descShort)} · CYC Connected Youth Community member">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(name)} · ${SITE_NAME}">
<meta property="og:description" content="${escapeHtml(descShort)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:site_name" content="${SITE_NAME}">
<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page cm-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="/community" class="event-back">‹ 全部成员</a>
  <a href="${SITE_URL}" class="event-site">CYC.center</a>
</header>

<main class="cm-detail">
  <div class="cm-detail-head">
    <div class="cm-detail-ava">${ava ? `<img src="${ava}" alt="${escapeHtml(name)}">` : '<span>👤</span>'}</div>
    <h1 class="cm-detail-name">${escapeHtml(name)}</h1>
    ${member.job ? `<p class="cm-detail-job">${escapeHtml(member.job)}${member.company ? ` · ${escapeHtml(member.company)}` : ''}</p>` : ''}
    ${hubName ? `<p class="cm-detail-hub">📍 ${escapeHtml(hubName)}${member.residentStatus ? ` · ${escapeHtml(member.residentStatus)}` : ''}</p>` : ''}
    ${member.mbti ? `<span class="cm-detail-mbti">${escapeHtml(member.mbti)}</span>` : ''}
    ${(member.identity && member.identity.length) ? `<div class="cm-detail-tags">${member.identity.map(t => `<span class="cm-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  </div>

  ${member.bio ? `<section class="event-section">
    <h2>个人介绍</h2>
    <p class="event-desc">${escapeHtml(member.bio)}</p>
  </section>` : ''}

  ${member.willShare ? `<section class="event-section">
    <h2>愿意做的分享</h2>
    <p class="event-desc">${escapeHtml(member.willShare)}</p>
  </section>` : ''}

  ${member.interests ? `<section class="event-section">
    <h2>感兴趣的活动</h2>
    <p class="event-desc">${escapeHtml(member.interests)}</p>
  </section>` : ''}

  ${member.topics ? `<section class="event-section">
    <h2>关注的话题</h2>
    <p class="event-desc">${escapeHtml(member.topics)}</p>
  </section>` : ''}

  ${(founded.length || joined.length) ? `<section class="event-section">
    <h2>参加过的活动</h2>
    ${founded.length ? `<div class="cm-rsvp-group">
      <p class="cm-rsvp-group-label">发起 / 带领</p>
      <div class="cm-rsvp-list">${founded.map(rsvpRow).join('')}</div>
    </div>` : ''}
    ${joined.length ? `<div class="cm-rsvp-group">
      <p class="cm-rsvp-group-label">参与</p>
      <div class="cm-rsvp-list">${joined.map(rsvpRow).join('')}</div>
    </div>` : ''}
  </section>` : ''}
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

</body>
</html>`;
}

// ─────────── 错误页 ───────────

function renderErrorPage({ icon, title, titleEn, msg, msgEn }) {
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

// ─────────── Admin placeholder（Phase E 实现） ───────────

function renderAdminPlaceholder() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理后台（建设中） · ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page">
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<main class="event-detail event-404">
  <div class="event-404-icon">🛠️</div>
  <h1>成员管理后台</h1>
  <p class="event-404-en">Coming soon</p>
  <p>正在建设中，搜索 / 添加 / 编辑功能在 Phase E。</p>
  <a href="/community" class="event-404-link">查看全部成员 →</a>
</main>
</body>
</html>`;
}

// ─────────── Handler ───────────

export default async function handler(req, res) {
  applyCors(res);

  const envErr = checkFeishuEnv(['FEISHU_APP_ID','FEISHU_APP_SECRET']);
  if (envErr) return res.status(500).send('Server config error');

  const id   = req.query.id;
  const mode = req.query.mode;
  const city = (req.query.city || '大理').toString();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // 1. Admin（Phase E 才做）
  if (mode === 'admin') {
    return res.status(200).send(renderAdminPlaceholder());
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

    // 反向查 ta 参加过的活动
    let rsvps = [];
    try { rsvps = await fetchRsvpsByMember(id); }
    catch (err) { console.warn('[community-page] member rsvps fetch failed:', err.message); }

    res.setHeader('Cache-Control', EDGE_CACHE);
    return res.status(200).send(renderDetail(stripPrivate(member), rsvps));
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
