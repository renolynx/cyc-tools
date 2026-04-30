/**
 * 社区成员目录 — 详情页 SSR
 * 由 community-page.js handler 在带 ?id={rec_id} 时调用
 */

import {
  SITE_URL, SITE_NAME, OG_DEFAULT,
  escapeHtml, avatarUrl, displayName, displayHub, truncate,
} from './_community-shared.js';

export function renderDetail(member, rsvps, fromActivityId, topTypes = []) {
  const name = displayName(member);
  const ava  = avatarUrl(member);
  const url  = `${SITE_URL}/community/${member.record_id}`;
  const ogImage = ava || OG_DEFAULT;
  const descShort = truncate(member.bio || member.job || `${name} · CYC 社区成员`, 100);
  const hubName = displayHub(member);

  // 智能返回：来自活动页就回活动；否则回 /community 列表
  const validFrom = fromActivityId && /^rec[a-zA-Z0-9]+$/.test(fromActivityId);
  const backHref  = validFrom ? `/events/${fromActivityId}` : '/community';
  const backLabel = validFrom ? '‹ 返回活动' : '‹ 全部成员';

  // RSVP 拆 hosts vs participated
  const founded = rsvps.filter(r => r.roles.includes('活动发起者') || r.roles.includes('嘉宾'));
  const joined  = rsvps.filter(r => r.roles.includes('活动参与者'));

  const rsvpRow = r => {
    const role = r.roles[0] || '参与者';
    // 优先用活动表的实际日期；活动已删除等情况回退到注册时间
    const date = r.activity_date
      || (r.registered_at ? new Date(r.registered_at).toISOString().slice(0,10) : '');
    const types = (r.activity_types || []).slice(0, 3);
    return `<a class="cm-rsvp-row" href="/events/${escapeHtml(r.activity_rec_id)}?from=${escapeHtml(member.record_id)}">
  <span class="cm-rsvp-title">${escapeHtml(r.activity_title || '未命名活动')}</span>
  ${types.length ? `<span class="cm-rsvp-types">${types.map(t => `<span class="cm-type-chip">${escapeHtml(t)}</span>`).join('')}</span>` : ''}
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
  <a href="${backHref}" class="event-back">${backLabel}</a>
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
    ${topTypes.length ? `<div class="cm-detail-types">${topTypes.map(t => `<span class="cm-type-chip">${escapeHtml(t.type)}${t.count > 1 ? ` <em>×${t.count}</em>` : ''}</span>`).join('')}</div>` : ''}
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
