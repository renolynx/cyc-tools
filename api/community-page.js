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

// ─────────── Admin SPA shell ───────────

function renderAdminApp() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0,maximum-scale=1.0">
<title>成员管理 · ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page cm-admin-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="/community" class="event-back">‹ 公开列表</a>
  <span class="event-site">成员管理</span>
</header>

<main class="cm-admin-main">
  <!-- 登录卡 -->
  <div class="cm-login" id="cmLoginCard">
    <div class="cm-login-icon">🔐</div>
    <h2>成员管理后台</h2>
    <p class="cm-login-sub">输入活动同步密码</p>
    <input type="text" id="cmPwd" class="rsvp-input pwd-mask" placeholder="•••••" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false">
    <p class="cm-login-err" id="cmLoginErr"></p>
    <button class="cm-login-btn" id="cmLoginBtn" onclick="cmLogin()">进入</button>
  </div>

  <!-- 主界面 -->
  <div class="cm-admin-app" id="cmAdminApp" style="display:none">
    <div class="cm-admin-bar">
      <input type="text" id="cmSearch" class="cm-admin-search" placeholder="搜索 姓名 / 微信号 / 公司 / 兴趣..." oninput="cmDebouncedSearch()">
      <button class="cm-admin-add" onclick="cmStartCreate()">＋ 新成员</button>
    </div>

    <div class="cm-admin-tabs" id="cmAdminTabs">
      <button class="cm-tab active" data-city="all" onclick="cmSetTab('all')">全部</button>
      <button class="cm-tab" data-city="大理" onclick="cmSetTab('大理')">大理</button>
      <button class="cm-tab" data-city="上海" onclick="cmSetTab('上海')">上海</button>
      <button class="cm-tab" data-city="hidden" onclick="cmSetTab('hidden')">已隐藏</button>
    </div>

    <p class="cm-admin-count" id="cmAdminCount">加载中...</p>
    <div class="cm-admin-list" id="cmAdminList"></div>
  </div>
</main>

<!-- 编辑/新建 modal -->
<div class="cm-edit-overlay" id="cmEditOverlay" onclick="if(event.target.id==='cmEditOverlay')cmCloseEdit()">
  <div class="cm-edit-modal">
    <div class="rsvp-modal-handle"></div>
    <div class="cm-edit-title" id="cmEditTitle">编辑成员</div>

    <div class="cm-edit-grid">
      <div class="cm-edit-field">
        <label>姓名 <span style="color:#c0392b">*</span></label>
        <input id="cmF_name" maxlength="40" type="text">
      </div>
      <div class="cm-edit-field">
        <label>称呼</label>
        <input id="cmF_nickname" maxlength="40" type="text">
      </div>
      <div class="cm-edit-field cm-edit-wide">
        <label>个人介绍</label>
        <textarea id="cmF_bio" maxlength="500" rows="3"></textarea>
      </div>
      <div class="cm-edit-field">
        <label>职业描述</label>
        <input id="cmF_job" maxlength="80" type="text">
      </div>
      <div class="cm-edit-field">
        <label>公司 / 工作机构</label>
        <input id="cmF_company" maxlength="80" type="text">
      </div>
      <div class="cm-edit-field cm-edit-wide">
        <label>愿意做的分享</label>
        <input id="cmF_willShare" maxlength="200" type="text">
      </div>
      <div class="cm-edit-field cm-edit-wide">
        <label>感兴趣的活动</label>
        <input id="cmF_interests" maxlength="200" type="text">
      </div>
      <div class="cm-edit-field">
        <label>关注的话题</label>
        <input id="cmF_topics" maxlength="200" type="text">
      </div>
      <div class="cm-edit-field">
        <label>MBTI</label>
        <input id="cmF_mbti" maxlength="8" type="text" placeholder="如 INFP">
      </div>
      <div class="cm-edit-field">
        <label>微信号</label>
        <input id="cmF_wechat" maxlength="40" type="text">
      </div>
      <div class="cm-edit-field">
        <label>据点入住状态</label>
        <input id="cmF_residentStatus" maxlength="20" type="text" placeholder="如：在住 / 已离开">
      </div>
      <div class="cm-edit-field cm-edit-wide cm-edit-checkbox">
        <label>
          <input id="cmF_hidden" type="checkbox">
          <span>在公开成员列表中隐藏 ta（默认不隐藏）</span>
        </label>
      </div>
    </div>

    <p class="cm-edit-tip">完整 41 字段（如电话/学校/性别等）请去飞书后台编辑。</p>
    <p class="cm-edit-err" id="cmEditErr"></p>

    <div class="cm-edit-actions">
      <button class="rsvp-cancel" onclick="cmCloseEdit()">取消</button>
      <button class="rsvp-confirm" id="cmEditSubmit" onclick="cmSubmitEdit()">保存</button>
    </div>
  </div>
</div>

<script>
let _adminPwd = '';
let _editingId = null;
let _curTab = 'all';
let _searchTimer = null;

const $ = id => document.getElementById(id);
const escapeHtml = s => (s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));

// ─────────── 登录 ───────────

const SAVED_PWD_KEY = 'cyc_admin_pwd';

(function autoLogin() {
  try {
    const p = sessionStorage.getItem(SAVED_PWD_KEY);
    if (p) { _adminPwd = p; setTimeout(() => cmLogin(true), 50); }
  } catch {}
})();

async function cmLogin(silent) {
  const pwd = silent ? _adminPwd : $('cmPwd').value.trim();
  if (!pwd) { $('cmLoginErr').textContent = '请输入密码'; return; }
  if (!silent) { $('cmLoginBtn').disabled = true; $('cmLoginBtn').textContent = '验证中...'; }

  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', password: pwd, query: '', cityFilter: 'all' }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (silent) { try { sessionStorage.removeItem(SAVED_PWD_KEY); } catch {} ; return; }
      $('cmLoginErr').textContent = data.error || '密码错误';
      $('cmLoginBtn').disabled = false; $('cmLoginBtn').textContent = '进入';
      return;
    }
    _adminPwd = pwd;
    try { sessionStorage.setItem(SAVED_PWD_KEY, pwd); } catch {}
    $('cmLoginCard').style.display = 'none';
    $('cmAdminApp').style.display = 'block';
    cmRenderList(data);
  } catch (err) {
    $('cmLoginErr').textContent = '网络错误：' + err.message;
    $('cmLoginBtn').disabled = false; $('cmLoginBtn').textContent = '进入';
  }
}

$('cmPwd').addEventListener('keydown', e => { if (e.key === 'Enter') cmLogin(); });

// ─────────── 搜索 / 列表 ───────────

function cmDebouncedSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(cmDoSearch, 300);
}

async function cmDoSearch() {
  const q = $('cmSearch').value.trim();
  $('cmAdminCount').textContent = '加载中...';
  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', password: _adminPwd, query: q, cityFilter: _curTab }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    cmRenderList(data);
  } catch (err) {
    $('cmAdminCount').textContent = '加载失败：' + err.message;
  }
}

function cmSetTab(city) {
  _curTab = city;
  document.querySelectorAll('#cmAdminTabs .cm-tab').forEach(b => b.classList.toggle('active', b.dataset.city === city));
  cmDoSearch();
}

function cmRenderList(data) {
  const members = data.members || [];
  $('cmAdminCount').textContent = data.total > data.count
    ? \`显示 \${data.count} / 共 \${data.total} 位\`
    : \`共 \${data.count} 位\`;

  if (!members.length) {
    $('cmAdminList').innerHTML = '<div class="cm-admin-empty">没有匹配的成员</div>';
    return;
  }

  $('cmAdminList').innerHTML = members.map(m => {
    const display = (m.nickname || m.name || '未署名').trim();
    const hub = (m.hubs && m.hubs[0] && m.hubs[0].name) || '';
    const job = (m.job || m.company || '').slice(0, 40);
    return \`<div class="cm-admin-item" data-rid="\${escapeHtml(m.record_id)}">
      <div class="cm-admin-item-main">
        <div class="cm-admin-item-name">\${escapeHtml(display)}\${m.hidden ? ' <span class="cm-hidden-tag">已隐藏</span>' : ''}</div>
        <div class="cm-admin-item-meta">\${hub ? '📍 ' + escapeHtml(hub) : ''}\${hub && job ? ' · ' : ''}\${escapeHtml(job)}</div>
      </div>
      <button class="cm-admin-edit" onclick="cmStartEdit('\${escapeHtml(m.record_id)}')">编辑</button>
    </div>\`;
  }).join('');
}

// ─────────── 创建 / 编辑 ───────────

function cmStartCreate() {
  _editingId = null;
  $('cmEditTitle').textContent = '＋ 新建成员';
  ['name','nickname','bio','job','company','willShare','interests','topics','mbti','wechat','residentStatus'].forEach(k => $('cmF_'+k).value = '');
  $('cmF_hidden').checked = false;
  $('cmEditErr').textContent = '';
  $('cmEditOverlay').classList.add('open');
  setTimeout(() => $('cmF_name').focus(), 200);
}

async function cmStartEdit(rid) {
  $('cmEditErr').textContent = '加载中...';
  $('cmEditOverlay').classList.add('open');
  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', password: _adminPwd, record_id: rid }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const m = data.member;
    _editingId = rid;
    $('cmEditTitle').textContent = '编辑：' + (m.nickname || m.name || '');
    $('cmF_name').value = m.name || '';
    $('cmF_nickname').value = m.nickname || '';
    $('cmF_bio').value = m.bio || '';
    $('cmF_job').value = m.job || '';
    $('cmF_company').value = m.company || '';
    $('cmF_willShare').value = m.willShare || '';
    $('cmF_interests').value = m.interests || '';
    $('cmF_topics').value = m.topics || '';
    $('cmF_mbti').value = m.mbti || '';
    $('cmF_wechat').value = m._wechat || '';
    $('cmF_residentStatus').value = m.residentStatus || '';
    $('cmF_hidden').checked = !!m.hidden;
    $('cmEditErr').textContent = '';
    setTimeout(() => $('cmF_name').focus(), 50);
  } catch (err) {
    $('cmEditErr').textContent = '加载失败：' + err.message;
  }
}

function cmCloseEdit() {
  $('cmEditOverlay').classList.remove('open');
  _editingId = null;
}

async function cmSubmitEdit() {
  const data = {
    name: $('cmF_name').value.trim(),
    nickname: $('cmF_nickname').value.trim(),
    bio: $('cmF_bio').value.trim(),
    job: $('cmF_job').value.trim(),
    company: $('cmF_company').value.trim(),
    willShare: $('cmF_willShare').value.trim(),
    interests: $('cmF_interests').value.trim(),
    topics: $('cmF_topics').value.trim(),
    mbti: $('cmF_mbti').value.trim(),
    wechat: $('cmF_wechat').value.trim(),
    residentStatus: $('cmF_residentStatus').value.trim(),
    hidden: $('cmF_hidden').checked,
  };
  if (!data.name) { $('cmEditErr').textContent = '请填写姓名'; return; }

  const btn = $('cmEditSubmit');
  btn.disabled = true; btn.textContent = '保存中...';

  const action = _editingId ? 'update' : 'create';
  const body = { action, password: _adminPwd, data };
  if (_editingId) body.record_id = _editingId;

  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error);
    $('cmEditErr').textContent = '✓ 已保存';
    setTimeout(() => {
      cmCloseEdit();
      cmDoSearch();
      btn.disabled = false; btn.textContent = '保存';
    }, 800);
  } catch (err) {
    $('cmEditErr').textContent = '保存失败：' + err.message;
    btn.disabled = false; btn.textContent = '保存';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('cmEditOverlay').classList.contains('open')) cmCloseEdit();
});
</script>

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
