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
import { fetchAllRsvps }                 from './_rsvp.js';

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

// ── 头像组 HTML（嘉宾 + 报名 stack）──
function renderAvatarGroups(speakers, attendees, total) {
  if (!speakers.length && !attendees.length) return '';

  function avatarBtn(p) {
    const initials = escapeHtml((p.name || '?')[0]);
    // 优先 KV blob URL；其次 飞书 file_token；都没有 → 首字母圆
    const imgSrc = p.avatar_url
      ? p.avatar_url
      : (p.avatar_token ? '/api/poster?token=' + encodeURIComponent(p.avatar_token) : '');
    const content = imgSrc
      ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy">`
      : `<span class="card-avatar-initials">${initials}</span>`;
    return `<button class="card-avatar" type="button"` +
      ` data-name="${escapeHtml(p.name)}"` +
      ` data-bio="${escapeHtml(p.bio || '')}"` +
      ` data-url="${escapeHtml(p.avatar_url || '')}"` +
      ` data-token="${escapeHtml(p.avatar_token || '')}"` +
      ` data-mid="${escapeHtml(p.member_rec_id || '')}"` +
      ` onclick="event.stopPropagation();openPersonModal(this)"` +
      ` aria-label="${escapeHtml(p.name)}">${content}</button>`;
  }

  let html = '<div class="card-avatar-groups">';

  if (speakers.length) {
    html += '<div class="card-avatar-group card-avatar-group--speaker">';
    html += '<span class="card-avatar-group-label">嘉宾</span>';
    html += '<div class="card-avatar-stack">';
    html += speakers.map(p => avatarBtn(p)).join('');
    html += '</div></div>';
  }

  if (attendees.length) {
    const more = (total || attendees.length) - attendees.length;
    html += '<div class="card-avatar-group card-avatar-group--attendee">';
    html += '<span class="card-avatar-group-label">报名</span>';
    html += '<div class="card-avatar-stack">';
    html += attendees.map(p => avatarBtn(p)).join('');
    if (more > 0) html += `<span class="card-avatar-more">+${more}</span>`;
    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

// ── 从 allRsvps + memberMap 构建 activity_id → 头像数据映射 ──
function buildAvatarsByActivity(allRsvps, memberMap) {
  const byActivity = {};
  for (const r of allRsvps) {
    if (!r.activity_rec_id) continue;
    if (!byActivity[r.activity_rec_id]) byActivity[r.activity_rec_id] = [];
    byActivity[r.activity_rec_id].push(r);
  }

  const result = {};
  for (const [actId, rsvps] of Object.entries(byActivity)) {
    const speakers  = rsvps.filter(r => r.roles?.includes('活动发起者'));
    const attendees = rsvps.filter(r => !r.roles?.includes('活动发起者'));
    function enrich(r) {
      const m = r.member_rec_id ? memberMap[r.member_rec_id] : null;
      return {
        name:          r.name || '',
        bio:           r.bio  || '',
        member_rec_id: r.member_rec_id || '',
        avatar_url:    m?.avatar_url   || null,  // KV blob URL（优先）
        avatar_token:  m?.avatar_token || null,  // 飞书 file_token（fallback）
      };
    }
    result[actId] = {
      speakers:  speakers.slice(0, 5).map(enrich),
      attendees: attendees.slice(0, 8).map(enrich),
      total:     attendees.length,
    };
  }
  return result;
}

function renderCard(a, isPast, avatarData) {
  const thumb = thumbUrl(a);
  let status = '';
  if (isPast) status = '<span class="el-card-status past">已结束</span>';
  else if (a.status === '确认举办') status = '<span class="el-card-status confirm">✓ 确认举办</span>';
  else if (a.status === '筹备酝酿中') status = '<span class="el-card-status plan">筹备中</span>';

  const av = avatarData || { speakers: [], attendees: [], total: 0 };
  const avatarHtml = renderAvatarGroups(av.speakers, av.attendees, av.total);

  // 开放性 pill：未结束才显示；is_public=false → 仅成员，默认对外开放
  let openness = '';
  if (!isPast) {
    openness = (a.is_public === false)
      ? '<span class="el-card-status closed">🔒 仅成员</span>'
      : '<span class="el-card-status open">🌿 对外开放</span>';
  }

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
    ${openness}
    ${avatarHtml}
  </div>
  <span class="el-card-arrow">›</span>
</a>`;
}

function renderGroups(acts, isPast, avatarsByActivity) {
  const groups = {};
  for (const a of acts) {
    if (!groups[a.date]) groups[a.date] = [];
    groups[a.date].push(a);
  }
  const dates = Object.keys(groups).sort();
  if (isPast) dates.reverse();

  return dates.map(date => `<section class="el-day-group">
  <div class="el-day-head">${formatCnDate(date)}</div>
  ${groups[date].map(a => renderCard(a, isPast, avatarsByActivity[a.record_id])).join('\n')}
</section>`).join('\n');
}

function renderEventsList(acts, avatarsByActivity) {
  const today = todayBJ();
  const valid = acts.filter(a => a.date && a.title);
  const upcoming = valid.filter(a => a.date >= today)
                        .sort((a,b) => a.date.localeCompare(b.date));
  const past     = valid.filter(a => a.date <  today);

  const upcomingHtml = upcoming.length
    ? renderGroups(upcoming, false, avatarsByActivity)
    : `<div class="el-empty">
  <div class="el-empty-icon">🌿</div>
  <p>近期暂无即将到来的活动</p>
  <p class="el-empty-sub">下一波活动正在筹备中，过两天再来看看</p>
</div>`;

  const pastHtml = past.length
    ? `<section class="el-past-section">
  <div class="el-past-divider"><span>已结束的活动</span></div>
  ${renderGroups(past, true, avatarsByActivity)}
</section>`
    : '';

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

<!-- 人物 modal（点击活动卡片头像触发）-->
<div class="person-modal-overlay" id="personModal" onclick="if(event.target.id==='personModal')closePersonModal()">
  <div class="person-modal">
    <div class="person-modal-handle"></div>
    <button class="person-modal-close" type="button" onclick="closePersonModal()" aria-label="关闭">×</button>
    <div class="person-modal-body">
      <div class="person-modal-avatar-wrap" id="pmAvatar">
        <div class="person-modal-avatar-initials">?</div>
      </div>
      <div class="person-modal-info">
        <div class="person-modal-name" id="pmName"></div>
        <div class="person-modal-bio" id="pmBio"></div>
      </div>
    </div>
    <a class="person-modal-link" id="pmLink" href="#">查看完整 profile →</a>
  </div>
</div>

<script>
(function () {
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.openPersonModal = function (btn) {
    var name  = btn.dataset.name  || '';
    var bio   = btn.dataset.bio   || '';
    var url   = btn.dataset.url   || '';   // KV blob URL（优先）
    var token = btn.dataset.token || '';   // 飞书 file_token（fallback）
    var mid   = btn.dataset.mid   || '';

    var overlay   = document.getElementById('personModal');
    var avatarWrap = document.getElementById('pmAvatar');
    var nameEl    = document.getElementById('pmName');
    var bioEl     = document.getElementById('pmBio');
    var linkEl    = document.getElementById('pmLink');

    var imgSrc = url || (token ? '/api/poster?token=' + encodeURIComponent(token) : '');
    if (imgSrc) {
      var img = new Image();
      img.alt = name;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      img.onerror = function () {
        avatarWrap.innerHTML = '<div class="person-modal-avatar-initials">' + esc(name[0] || '?') + '</div>';
      };
      avatarWrap.innerHTML = '';
      avatarWrap.appendChild(img);
      img.src = imgSrc;
    } else {
      avatarWrap.innerHTML = '<div class="person-modal-avatar-initials">' + esc(name[0] || '?') + '</div>';
    }

    nameEl.textContent = name;
    bioEl.textContent  = bio || '';
    if (!bio) { bioEl.className = 'person-modal-no-bio'; bioEl.textContent = '暂无简介'; }
    else       { bioEl.className = 'person-modal-bio'; }

    if (mid) {
      linkEl.href = '/community/' + mid;
      linkEl.style.display = '';
    } else {
      linkEl.style.display = 'none';
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (typeof cycTrack === 'function') {
      cycTrack('event_card_avatar_click', { name: name, member_rec_id: mid });
    }
  };

  window.closePersonModal = function () {
    var overlay = document.getElementById('personModal');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closePersonModal();
  });
})();
</script>

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

  // KV 缓存（?refresh=1 跳过）
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
      acts = [];
    }
    if (acts.length && isKvConfigured()) {
      try {
        await kvSet(cacheKey, JSON.stringify(acts), CACHE_TTL_SEC);
      } catch {}
    }
  }

  // RSVP + 成员头像数据（各有自己的 KV 缓存，失败降级为空）
  let avatarsByActivity = {};
  try {
    const [allRsvps, memberListRaw] = await Promise.all([
      fetchAllRsvps(),
      isKvConfigured()
        ? kvGet('members:public_list').catch(() => null)
        : Promise.resolve(null),
    ]);

    const memberMap = {};
    if (memberListRaw) {
      try {
        const members = JSON.parse(memberListRaw);
        for (const m of members) {
          if (m.record_id) memberMap[m.record_id] = m;
        }
      } catch {}
    }

    avatarsByActivity = buildAvatarsByActivity(allRsvps, memberMap);
  } catch (err) {
    console.warn('[events-list] RSVP join failed:', err.message);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventsList(acts, avatarsByActivity));
}
