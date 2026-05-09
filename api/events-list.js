/**
 * GET /api/events-list
 * 公开活动列表页（SSR）
 * 默认显示 date >= 今天 的活动，按日期升序，分组展示
 *
 * vercel.json rewrite: /events → /api/events-list
 */

import { applyCors, checkFeishuEnv }    from './_feishu.js';
import { fetchAllActivities, formatCnDate, todayBJ, cycTimeClass } from './_activity.js';
import { kvGet, kvSet, isKvConfigured }  from './_kv.js';
import { fetchAllRsvps }                 from './_rsvp.js';
import { fetchMember }                   from './_member.js';

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

function thumbHtml(act) {
  const url = thumbUrl(act);
  if (!url) return `<div class="home-act-thumb home-act-thumb-empty ${cycTimeClass(act.time)}" aria-hidden="true"></div>`;
  const tok = act.poster.file_token;
  const title = escapeHtml(act.title || '');
  return `<img class="home-act-thumb" data-zoomable src="${url}" alt="${title}" loading="lazy" onclick="openPosterLightbox(event, '${escapeHtml(tok)}', '${title}')">`;
}

// 北京时间 YYYY-MM-DD → "周X"
// v4.2.14: 双语数据映射
const EN_DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const TYPE_EN = {
  '社区OS分享会': 'Community OS Talk', 'Demo Day': 'Demo Day',
  'Understanding China': 'Understanding China',
  '分享会': 'Talk', '工作坊': 'Workshop', '客厅对话': 'Living Room',
  '聚餐': 'Dinner', '户外': 'Outdoor', '读书分享会': 'Book Club',
  '麻圆微沙龙': 'Mini Salon', '失眠夜谈': 'Late Night Talk',
  '篝火读诗会': 'Bonfire Poetry', '黑暗听歌会': 'Listening Session',
  '无目的城市漫游': 'City Wander', '职业分享会': 'Career Talk',
  '社区串门': 'Community Visit', '死亡咖啡馆': 'Death Café',
  '社会青年聚': 'Youth Gathering', '玩点新东西': 'Try Something New',
  '篝火夜聊': 'Bonfire Night', '运动': 'Sports', '舞蹈': 'Dance',
  '故事会': 'Storytelling', '心里疗愈': 'Healing', '中医理疗': 'TCM',
  '绘画': 'Painting', '聊天解惑': 'Chat', '商业规划': 'Biz Planning',
  '心理游戏': 'Psych Games', '疗愈': 'Healing', '桌游': 'Board Games',
  '放映会': 'Screening', '故事分享': 'Story Share', '志愿服务': 'Volunteer',
  '攀岩': 'Climbing', '赚钱科普会': 'Money 101', '公益活动': 'Public Good',
  '社区共建会议': 'Community Build', '交换日': 'Swap Day',
  'AI': 'AI', '创业': 'Startup', '艺术': 'Art', '跳舞': 'Dance',
  '仪式': 'Ritual', '节日': 'Festival', '音乐': 'Music', '体能': 'Fitness',
  '咖酒': 'Coffee & Wine', '市集': 'Market', '戏剧': 'Theater',
  '开发': 'Dev', '哲学': 'Philosophy', '对谈': 'Dialogue', '对话': 'Talk',
  '旅行': 'Travel', '社区': 'Community', '社区共建': 'Community Build',
  '身体': 'Body', '自然': 'Nature', '创作': 'Creative',
};
const CITY_EN = { '大理': 'Dali', '上海': 'Shanghai', '北京': 'Beijing', '柏林': 'Berlin', '巴黎': 'Paris', '远程': 'Remote' };
function typeEn(zh) { return TYPE_EN[zh] || zh; }
function cityEn(zh) { return CITY_EN[zh] || zh; }
function enDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return EN_DOW[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
}

function cnDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dow = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return ['周日','周一','周二','周三','周四','周五','周六'][dow];
}
// muShanghai 周次（W1=5/10–5/16, ..., W4=5/31–6/6）
function muWeekIndex(dateStr) {
  if (!dateStr) return 0;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const ts = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const w1 = Date.UTC(2026, 4, 10);
  const days = Math.floor((ts - w1) / 86400000);
  if (days < 0) return 0;
  if (days < 7) return 1; if (days < 14) return 2; if (days < 21) return 3; if (days < 28) return 4;
  return 0;
}
function shortDate(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${parseInt(m[2])}/${parseInt(m[3])}` : dateStr;
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
      ` onclick="event.preventDefault();event.stopPropagation();openPersonModal(this)"` +
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
        // 成员资料 bio 兜底 rsvp bio（rsvp bio 注册时填的，可能为空）
        bio:           r.bio  || m?.bio || '',
        member_rec_id: r.member_rec_id || '',
        avatar_url:    m?.avatar_url        || null,  // KV blob URL（优先）
        avatar_token:  m?.avatar?.file_token || null, // 飞书 file_token（fallback）
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

// v4.2.10 Phase B: 复用首页 home-act-card —— SSR 版本镜像 index.html 的 renderCard
// （CSS 已在 /styles.css 全局加载；JS toggleCardExpand / openPersonModal 仍走页面底部 inline）
function renderCard(a, isPast, avatarData) {
  const isPlanning = a.status === '筹备酝酿中';
  const dateStr = shortDate(a.date);
  const dowStr  = a.date ? cnDayOfWeek(a.date) : '';
  const dowEn   = a.date ? enDayOfWeek(a.date) : '';
  const thumb   = thumbHtml(a);

  // v4.2.14: 双语 datestack
  const dateLineHtml = (dateStr || dowStr)
    ? `<div class="home-act-dateline">${dateStr}${dateStr && dowStr ? ' · ' : ''}<span class="lang-zh-only">${dowStr}</span><span class="lang-en-only">${dowEn}</span></div>`
    : '';
  const timeLineHtml = a.time ? `<div class="home-act-timeline">${escapeHtml(a.time)}</div>` : '';
  const wkn = a.city === '上海' && a.date ? muWeekIndex(a.date) : 0;
  const cityZh = a.city || '';
  const cityEnVal = cityEn(cityZh);
  const locLineHtml = wkn
    ? `<div class="home-act-locline"><span class="home-act-locline-week">W${wkn}</span>${cityZh ? ' · ' : ''}<span class="lang-zh-only">${escapeHtml(cityZh)}</span><span class="lang-en-only">${escapeHtml(cityEnVal)}</span></div>`
    : (cityZh
        ? `<div class="home-act-locline"><span class="lang-zh-only">${escapeHtml(cityZh)}</span><span class="lang-en-only">${escapeHtml(cityEnVal)}</span></div>`
        : (isPast ? '<div class="home-act-locline"><span class="lang-zh-only">已结束</span><span class="lang-en-only">Past</span></div>' : ''));

  // 类型 pill 双语
  const primaryType = (a.types || []).filter(Boolean)[0] || '';
  const typepillHtml = isPlanning
    ? `<div class="home-act-pill-row">
        <span class="home-act-typepill is-planning"><span class="lang-zh-only">筹备中</span><span class="lang-en-only">Planning</span></span>
        <span class="home-act-planning-hint">
          <span class="lang-zh-only">时间槽已占位，活动详情仍在编辑确认中。</span>
          <span class="lang-en-only">Slot reserved — details still being confirmed.</span>
        </span>
       </div>`
    : (primaryType ? `<span class="home-act-typepill"><span class="lang-zh-only">${escapeHtml(primaryType)}</span><span class="lang-en-only">${escapeHtml(typeEn(primaryType))}</span></span>` : '');

  // 嘉宾 meta（筹备中不显示嘉宾占位）—— 双语 spans
  const av = avatarData || { speakers: [], attendees: [], total: 0 };
  const speakers  = av.speakers  || [];
  const attendees = av.attendees || [];
  const attendeesTotal = av.total || 0;
  const metaItems = [];
  if (!isPlanning && speakers.length) {
    metaItems.push(`<span class="home-act-meta-item"><span class="lang-zh-only">嘉宾</span><span class="lang-en-only">Speakers</span> ${escapeHtml(speakers.map(s => s.name).join(' · '))}</span>`);
  }
  const metaLineHtml = metaItems.length
    ? `<div class="home-act-meta-line">${metaItems.join('')}</div>`
    : '';

  // 标题块：双语 — zh 模式标题=zh，en 模式标题=title_en（fallback zh）
  const titleZh = a.title || '未命名活动';
  const titleEnVal = a.title_en || a.title || 'Untitled';
  const hasBoth = a.title_en && a.title_en !== a.title;
  const titleBlockHtml = isPlanning
    ? `<h4 class="home-act-title is-planning-strike"><span class="lang-zh-only">${escapeHtml(titleZh)}</span><span class="lang-en-only">${escapeHtml(titleEnVal)}</span></h4>
       ${hasBoth ? `<div class="home-act-title-en is-planning-strike"><span class="lang-zh-only">${escapeHtml(a.title_en)}</span><span class="lang-en-only">${escapeHtml(a.title)}</span></div>` : ''}`
    : `<h4 class="home-act-title"><span class="lang-zh-only">${escapeHtml(titleZh)}</span><span class="lang-en-only">${escapeHtml(titleEnVal)}</span></h4>
       ${hasBoth ? `<div class="home-act-title-en"><span class="lang-zh-only">${escapeHtml(a.title_en)}</span><span class="lang-en-only">${escapeHtml(a.title)}</span></div>` : ''}
       ${metaLineHtml}`;

  // CTA 行 —— 双语
  const attendeeCountHtml = (!isPlanning && attendeesTotal)
    ? `<span class="home-act-cta-attendees"><span class="lang-zh-only">${attendeesTotal} 已报名</span><span class="lang-en-only">${attendeesTotal} ${attendeesTotal === 1 ? 'RSVP' : 'RSVPs'}</span></span>`
    : '';
  const rsvpHref = `/events/${a.record_id}`;
  const editHref = `/generator?edit=${a.record_id}`;
  // v4.2.13 Task 2: "我要报名" → 弹全局 RSVP modal（不跳详情页）
  const rsvpDataAttrs = `data-rec-id="${escapeHtml(a.record_id)}" data-title="${escapeHtml(a.title || '')}" data-title-en="${escapeHtml(a.title_en || '')}" data-city="${escapeHtml(a.city || '大理')}" data-fee="${Number(a.onsite_fee) || 0}"`;
  const ctaButtonHtml = isPlanning
    ? `<a href="${editHref}" class="home-act-rsvp is-edit" onclick="event.stopPropagation()"><span class="lang-zh-only">编辑 →</span><span class="lang-en-only">Edit →</span></a>`
    : (isPast
        ? '<span class="home-act-rsvp is-past"><span class="lang-zh-only">已结束</span><span class="lang-en-only">Past</span></span>'
        : `<button type="button" class="home-act-rsvp js-cyc-rsvp" ${rsvpDataAttrs} onclick="event.stopPropagation();cycOpenRsvpFromBtn(this)"><span class="lang-zh-only">我要报名 →</span><span class="lang-en-only">RSVP →</span></button>`);
  const ctaHtml = `<div class="home-act-cta-row">${ctaButtonHtml}${attendeeCountHtml}</div>`;

  // 展开区
  const expandHtml = renderExpand(a, isPast, attendees, attendeesTotal);

  const cityClass = a.city === '上海' ? 'is-city-shanghai' : 'is-city-dali';
  return `<article class="home-act-card ${cityClass}${isPast ? ' is-past' : ''}${isPlanning ? ' is-planning' : ''}" data-href="${rsvpHref}" data-city="${escapeHtml(a.city || '大理')}" onclick="toggleCardExpand(event, this)">
    <div class="home-act-header">
      <div class="home-act-datestack">
        ${dateLineHtml}
        ${timeLineHtml}
        ${locLineHtml}
      </div>
      ${thumb}
    </div>
    ${typepillHtml}
    ${titleBlockHtml}
    ${ctaHtml}
    ${expandHtml}
  </article>`;
}

// 展开区 SSR：完整地址 / 是否对外 / 描述 / 流程 / 已报名头像 / 详情链接
function renderExpand(a, isPast, attendees, attendeesTotal) {
  const lines = [];
  if (a.loc) lines.push(`<div class="home-act-expand-line"><strong>📍 地点</strong> ${escapeHtml(a.loc)}${a.location_en ? ' · <em>' + escapeHtml(a.location_en) + '</em>' : ''}</div>`);
  const accessLabel = a.is_public === false ? '🔒 仅成员' : '🌿 对外开放';
  lines.push(`<div class="home-act-expand-line"><strong>访问</strong> ${accessLabel}</div>`);
  if (a.fee)    lines.push(`<div class="home-act-expand-line"><strong>💰 费用</strong> ${escapeHtml(a.fee)}</div>`);
  if (a.signup) lines.push(`<div class="home-act-expand-line"><strong>🙋 报名</strong> ${escapeHtml(a.signup)}</div>`);
  if (a.onsite_fee && a.onsite_fee > 0) lines.push(`<div class="home-act-expand-line"><strong>💰 现场</strong> ¥${a.onsite_fee} · 持票人/线上免费</div>`);
  if (a.tencent_meeting_url) lines.push(`<div class="home-act-expand-line"><strong>🎥 腾讯会议</strong> <a href="${escapeHtml(a.tencent_meeting_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escapeHtml(a.tencent_meeting_url)}</a></div>`);
  const metaHtml = lines.length ? `<div class="home-act-expand-meta">${lines.join('')}</div>` : '';
  const descHtml = a.desc ? `<p class="home-act-expand-desc">${escapeHtml(a.desc)}</p>` : '';
  const flowHtml = (a.flow && a.flow.length) ? `<div class="home-act-expand-flow"><div class="home-act-expand-h">🗓️ 流程</div><ul>${a.flow.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul></div>` : '';

  // 已报名头像组（仅 attendees；嘉宾名字已在卡头 meta 里）
  const attendees_safe = Array.isArray(attendees) ? attendees : [];
  let attendeesHtml = '';
  if (attendees_safe.length) {
    const stack = attendees_safe.map(p => {
      const initials = escapeHtml((p.name || '?')[0]);
      const imgSrc = p.avatar_url ? p.avatar_url : (p.avatar_token ? '/api/poster?token=' + encodeURIComponent(p.avatar_token) : '');
      const content = imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<span class="card-avatar-initials">${initials}</span>`;
      return `<button class="card-avatar" type="button" data-name="${escapeHtml(p.name)}" data-bio="${escapeHtml(p.bio || '')}" data-url="${escapeHtml(p.avatar_url || '')}" data-token="${escapeHtml(p.avatar_token || '')}" data-mid="${escapeHtml(p.member_rec_id || '')}" onclick="event.preventDefault();event.stopPropagation();openPersonModal(this)" aria-label="${escapeHtml(p.name)}">${content}</button>`;
    }).join('');
    const more = attendeesTotal - attendees_safe.length;
    const moreHtml = more > 0 ? `<span class="card-avatar-more">+${more}</span>` : '';
    attendeesHtml = `<div class="home-act-expand-attendees"><div class="home-act-expand-h">已报名 (${attendeesTotal})</div><div class="card-avatar-stack">${stack}${moreHtml}</div></div>`;
  }

  const detailHtml = `<a class="home-act-expand-detail" href="/events/${a.record_id}" onclick="event.stopPropagation()">📝 查看完整页 →</a>`;
  return `<div class="home-act-expand"><div class="home-act-expand-inner">${metaHtml}${descHtml}${flowHtml}${attendeesHtml}${detailHtml}</div></div>`;
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
<body class="event-page el-page atlas-canvas cyc-brand">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="${SITE_URL}" class="event-back">‹ <span class="lang-zh-only">主页</span><span class="lang-en-only">Home</span></a>
  <button type="button" class="home-topbar-lang" id="evLangToggle" aria-label="切换语言 / Toggle language">
    <span class="lang-zh-only">中 · EN</span>
    <span class="lang-en-only">EN · 中</span>
  </button>
</header>

<main class="el-main">
  <div class="el-hero">
    <span class="cyc-eyebrow cyc-eyebrow--sm" style="display:block;margin-bottom:8px" id="evHeroEyebrow">
      <span class="lang-zh-only">EVENTS · 大理</span>
      <span class="lang-en-only">EVENTS · DALI</span>
    </span>
    <h1 class="cyc-display">
      <span class="lang-zh-only">近期活动</span>
      <span class="lang-en-only">Upcoming Events</span>
    </h1>
    <p class="el-hero-sub" id="evHeroSub">${SITE_NAME} · <span class="lang-zh-only">大理</span><span class="lang-en-only">Dali</span></p>
  </div>

  <div class="home-zone-tabs el-zone-tabs" role="tablist" aria-label="城市切换 / Toggle city">
    <button class="home-zone-tab is-active" type="button" role="tab" data-zone="大理">
      <span class="lang-zh-only">大理</span>
      <span class="lang-en-only">Dali</span>
    </button>
    <button class="home-zone-tab" type="button" role="tab" data-zone="上海">
      <span class="lang-zh-only">上海</span>
      <span class="lang-en-only">Shanghai · 706 × muShanghai</span>
    </button>
  </div>

  <div id="evContent">
    ${upcomingHtml}
    ${pastHtml}
  </div>
  <div id="evEmpty" class="el-empty" style="display:none">
    <div class="el-empty-icon">🌿</div>
    <p><span class="lang-zh-only">这个城市还没有活动</span><span class="lang-en-only">No events in this city yet</span></p>
  </div>

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

<!-- 海报 lightbox（点击卡片海报触发）-->
<div class="poster-lightbox-overlay" id="posterLightbox" onclick="if(event.target.id==='posterLightbox')closePosterLightbox()">
  <button class="poster-lightbox-close" type="button" onclick="closePosterLightbox()" aria-label="关闭">×</button>
  <img class="poster-lightbox-img" id="plImg" src="" alt="">
  <div class="poster-lightbox-caption" id="plCaption"></div>
</div>

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

  // 卡片整体 click → toggle 展开（按钮/内嵌 link/修饰键不触发）
  window.toggleCardExpand = function (e, card) {
    if (e.target.closest('button, a')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      const href = card.dataset.href;
      if (href) window.open(href, '_blank');
      return;
    }
    card.classList.toggle('is-expanded');
  };
  // 中键单独处理（mousedown，因为 click 不一定带 button=1）
  document.addEventListener('mousedown', function (e) {
    if (e.button !== 1) return;
    const card = e.target.closest('.el-card');
    if (!card || e.target.closest('button, a')) return;
    e.preventDefault();
    const href = card.dataset.href;
    if (href) window.open(href, '_blank');
  });

  // 海报 lightbox
  window.openPosterLightbox = function (e, token, title) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (!token) return;
    document.getElementById('plImg').src = '/api/poster?token=' + encodeURIComponent(token);
    document.getElementById('plImg').alt = title || '';
    document.getElementById('plCaption').textContent = title || '';
    document.getElementById('posterLightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof cycTrack === 'function') cycTrack('event_card_poster_click', { token: token });
  };
  window.closePosterLightbox = function () {
    var overlay = document.getElementById('posterLightbox');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closePosterLightbox();
  });

  // ── Phase B: 大理/上海 zone 过滤 + zh/en 语言切换 ──
  const ZONE_KEY = 'cyc-events-zone';
  const LANG_KEY = 'cyc-events-lang';

  function applyZone(zone) {
    document.body.classList.toggle('zone-shanghai', zone === '上海');
    document.body.classList.toggle('zone-dali', zone !== '上海');
    try { localStorage.setItem(ZONE_KEY, zone); } catch {}
    document.querySelectorAll('.el-zone-tabs .home-zone-tab').forEach(b => {
      b.classList.toggle('is-active', b.dataset.zone === zone);
    });
    // 更新 hero eyebrow + sub
    const eb = document.getElementById('evHeroEyebrow');
    const sub = document.getElementById('evHeroSub');
    if (eb) {
      eb.querySelector('.lang-zh-only').textContent = zone === '上海' ? 'EVENTS · 上海 · 706 × muShanghai' : 'EVENTS · 大理';
      eb.querySelector('.lang-en-only').textContent = zone === '上海' ? 'EVENTS · SHANGHAI · 706 × muShanghai' : 'EVENTS · DALI';
    }
    if (sub) {
      sub.querySelector('.lang-zh-only').textContent = zone;
      sub.querySelector('.lang-en-only').textContent = zone === '上海' ? 'Shanghai' : 'Dali';
    }
    // 检查空状态
    const emptyEl = document.getElementById('evEmpty');
    const cards = document.querySelectorAll('.home-act-card[data-city="' + zone + '"]');
    if (emptyEl) emptyEl.style.display = cards.length === 0 ? '' : 'none';
  }
  function getZone() {
    try { const z = localStorage.getItem(ZONE_KEY); if (z === '大理' || z === '上海') return z; } catch {}
    return '大理';
  }
  function applyLang(lang) {
    document.body.classList.toggle('cyc-lang-en', lang === 'en');
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
  }
  function getLang() {
    try {
      const u = new URLSearchParams(location.search).get('lang');
      if (u === 'en' || u === 'zh') return u;
      const s = localStorage.getItem(LANG_KEY);
      if (s === 'en' || s === 'zh') return s;
    } catch {}
    if (navigator.language && navigator.language.toLowerCase().startsWith('en')) return 'en';
    return 'zh';
  }
  applyLang(getLang());
  applyZone(getZone());
  document.querySelectorAll('.el-zone-tabs .home-zone-tab').forEach(b => {
    b.addEventListener('click', () => applyZone(b.dataset.zone));
  });
  const langBtn = document.getElementById('evLangToggle');
  if (langBtn) langBtn.addEventListener('click', () => {
    applyLang(document.body.classList.contains('cyc-lang-en') ? 'zh' : 'en');
  });
})();
</script>

<script src="/cyc-track.js" defer></script>
<script src="/cyc-rsvp.js" defer></script>
<script>
window.cycOpenRsvpFromBtn = function (btn) {
  if (typeof window.cycOpenRsvp !== 'function') return;
  window.cycOpenRsvp({
    record_id:  btn.dataset.recId,
    title:      btn.dataset.title,
    title_en:   btn.dataset.titleEn,
    city:       btn.dataset.city,
    onsite_fee: Number(btn.dataset.fee) || 0,
  });
};
</script>
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

  // RSVP + 成员资料（per-member fetch，30min KV cache 比 public_list 更稳；
  // 失败降级为空 → 卡片不显示头像 stack 但页面正常渲染）
  let avatarsByActivity = {};
  try {
    const allRsvps = await fetchAllRsvps();

    // 只 enrich 当前在显示范围内的活动涉及的成员（避免拉全表）
    const validIds = new Set(acts.map(a => a.record_id));
    const uniqueMemberIds = [...new Set(
      allRsvps
        .filter(r => validIds.has(r.activity_rec_id) && r.member_rec_id)
        .map(r => r.member_rec_id)
    )];

    const memberMap = {};
    if (uniqueMemberIds.length) {
      const fetched = await Promise.all(
        uniqueMemberIds.map(id => fetchMember(id).catch(() => null))
      );
      for (const m of fetched) {
        if (m?.record_id) memberMap[m.record_id] = m;
      }
    }

    avatarsByActivity = buildAvatarsByActivity(allRsvps, memberMap);
  } catch (err) {
    console.warn('[events-list] RSVP join failed:', err.message);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventsList(acts, avatarsByActivity));
}
