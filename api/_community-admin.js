/**
 * 社区成员目录 — Admin SPA shell（密码登录后客户端搜索/编辑/合并/批量操作）
 *
 * 整页 SSR 出 HTML + 内联 CSS + 内联 JS，登录后所有交互都走 /api/community-write
 * 这部分长，自成一体（800+ 行），从 community-page.js 拆出来减小主文件压力
 */

import { SITE_NAME } from './_community-shared.js';

// ─────────── Admin SPA shell ───────────

export function renderAdminApp() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0,maximum-scale=1.0">
<title>成员管理 · ${SITE_NAME}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page cm-admin-page aurora-canvas">

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
      <div class="cm-edit-field cm-edit-wide">
        <label>社群身份 <span class="cm-edit-hint">点击切换；输入回车添加新值</span></label>
        <div class="cm-multi" id="cmF_identity_wrap">
          <div class="cm-multi-chips" id="cmF_identity_chips"></div>
          <input class="cm-multi-input" id="cmF_identity_input" type="text" maxlength="20" placeholder="加新身份…" onkeydown="cmIdentityKeydown(event)">
        </div>
      </div>
      <div class="cm-edit-field cm-edit-wide cm-edit-checkbox">
        <label>
          <input id="cmF_hidden" type="checkbox">
          <span>在公开成员列表中隐藏 ta（默认不隐藏）</span>
        </label>
      </div>
    </div>

    <p class="cm-edit-tip">完整 41 字段（如电话/学校/性别等）请去飞书后台编辑。</p>

    <!-- 活动记录（编辑模式才显示） -->
    <div class="cm-edit-rsvps" id="cmEditRsvps" style="display:none">
      <div class="cm-edit-rsvps-title">活动记录 <span id="cmEditRsvpsCount" class="cm-edit-rsvps-count"></span></div>
      <div class="cm-edit-rsvps-list" id="cmEditRsvpsList"></div>
    </div>

    <p class="cm-edit-err" id="cmEditErr"></p>

    <div class="cm-edit-actions">
      <button class="rsvp-cancel" onclick="cmCloseEdit()">取消</button>
      <button class="cm-merge-btn" id="cmMergeBtn" onclick="cmStartMerge()" style="display:none">→ 合并到另一个</button>
      <button class="rsvp-confirm" id="cmEditSubmit" onclick="cmSubmitEdit()">保存</button>
    </div>
  </div>
</div>

<!-- 合并 modal -->
<div class="cm-merge-overlay" id="cmMergeOverlay" onclick="if(event.target.id==='cmMergeOverlay')cmCloseMerge()">
  <div class="cm-merge-modal">
    <div class="rsvp-modal-handle"></div>
    <div class="cm-merge-title" id="cmMergeTitle">合并成员</div>

    <!-- Step 1: 选目标 -->
    <div class="cm-merge-step" id="cmMergeStep1">
      <p class="cm-merge-sub">把 <strong id="cmMergeSourceName"></strong> 合并到下面哪位？</p>
      <input type="text" class="cm-admin-search" id="cmMergeSearch" placeholder="搜索目标成员..." oninput="cmMergeSearchTick()">
      <div class="cm-merge-candidates" id="cmMergeCandidates"></div>
    </div>

    <!-- Step 2: 字段对比确认 -->
    <div class="cm-merge-step" id="cmMergeStep2" style="display:none">
      <p class="cm-merge-sub">
        要把 <strong id="cmMergeSourceName2"></strong> → <strong id="cmMergeTargetName2"></strong><br>
        <span class="cm-merge-rsvp-info" id="cmMergeRsvpInfo"></span>
      </p>
      <div class="cm-merge-fields" id="cmMergeFieldList"></div>
      <p class="cm-merge-warn" id="cmMergeConflicts"></p>
      <p class="cm-edit-err" id="cmMergeErr"></p>
    </div>

    <div class="cm-edit-actions">
      <button class="rsvp-cancel" onclick="cmCloseMerge()">取消</button>
      <button class="rsvp-cancel" id="cmMergeBack" onclick="cmMergeBack()" style="display:none">← 重选</button>
      <button class="cm-merge-confirm" id="cmMergeSubmit" onclick="cmDoMerge()" style="display:none">确认合并并删除原条目</button>
    </div>
  </div>
</div>

<script>
let _adminPwd = '';
let _editingId = null;
let _curTab = 'all';
let _searchTimer = null;
let _allMembers = [];   // 登录时一次拉全，含 hidden 含 inferredCities
let _identitySelected = [];   // 当前编辑的成员的「社群身份」选中状态（multi-select）

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
      body: JSON.stringify({ action: 'search', password: pwd }),
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
    _allMembers = data.members || [];
    cmRender();
  } catch (err) {
    $('cmLoginErr').textContent = '网络错误：' + err.message;
    $('cmLoginBtn').disabled = false; $('cmLoginBtn').textContent = '进入';
  }
}

$('cmPwd').addEventListener('keydown', e => { if (e.key === 'Enter') cmLogin(); });

// ─────────── 客户端搜索 + tab ───────────

function cmDebouncedSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(cmRender, 200);
}

function cmSetTab(city) {
  _curTab = city;
  document.querySelectorAll('#cmAdminTabs .cm-tab').forEach(b => b.classList.toggle('active', b.dataset.city === city));
  cmRender();
}

/** 同步刷新一次（保存成员后调） */
async function cmReload() {
  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', password: _adminPwd }),
    });
    const data = await res.json();
    if (res.ok) { _allMembers = data.members || []; cmRender(); }
  } catch {}
}

function cmRender() {
  const q = $('cmSearch').value.trim().toLowerCase();
  let pool = _allMembers;

  // 1. tab 过滤
  if (_curTab === 'hidden') {
    pool = pool.filter(m => m.hidden);
  } else {
    pool = pool.filter(m => !m.hidden);
    if (_curTab === '大理' || _curTab === '上海') {
      pool = pool.filter(m =>
        (m.cities && m.cities.includes(_curTab)) ||
        (m.inferredCities && m.inferredCities.includes(_curTab))
      );
    }
  }

  // 2. 客户端搜索
  if (q) {
    pool = pool.filter(m =>
      [m.name, m.nickname, m.bio, m.job, m.company, m.topics, m.willShare, m.interests, m._wechat]
        .some(s => s && String(s).toLowerCase().includes(q))
    );
  }

  $('cmAdminCount').textContent = q || _curTab !== 'all'
    ? \`显示 \${pool.length} / 共 \${_allMembers.length} 位\`
    : \`共 \${_allMembers.length} 位\`;

  if (!pool.length) {
    $('cmAdminList').innerHTML = '<div class="cm-admin-empty">没有匹配的成员</div>';
    return;
  }

  // 显示前 200 条防止 DOM 爆炸（再多请求精确搜索）
  const view = pool.slice(0, 200);
  $('cmAdminList').innerHTML = view.map(m => {
    const display = (m.nickname || m.name || '未署名').trim();
    const hub = (m.hubs && m.hubs[0] && m.hubs[0].name) || '';
    const inferred = (m.inferredCities || []).join(' / ');
    const meta = hub
      ? '📍 ' + escapeHtml(hub)
      : (inferred ? '🎯 ' + escapeHtml(inferred) + '（活动参与）' : '');
    const job = (m.job || m.company || '').slice(0, 40);
    const roleChips = renderRoleChipsClient(m.roleStats);
    const typeChips = (m.topTypes || []).map(t => '<span class="cm-type-chip">' + escapeHtml(t.type) + (t.count > 1 ? ' <em>×' + t.count + '</em>' : '') + '</span>').join('');
    return \`<div class="cm-admin-item" data-rid="\${escapeHtml(m.record_id)}">
      <div class="cm-admin-item-main">
        <div class="cm-admin-item-name">\${escapeHtml(display)}\${m.hidden ? ' <span class="cm-hidden-tag">已隐藏</span>' : ''}</div>
        <div class="cm-admin-item-meta">\${meta}\${meta && job ? ' · ' : ''}\${escapeHtml(job)}</div>
        \${roleChips ? '<div class="cm-admin-item-roles">' + roleChips + '</div>' : ''}
        \${typeChips ? '<div class="cm-admin-item-roles">' + typeChips + '</div>' : ''}
      </div>
      <button class="cm-admin-edit" onclick="cmStartEdit('\${escapeHtml(m.record_id)}')">编辑</button>
    </div>\`;
  }).join('') + (pool.length > 200 ? \`<div class="cm-admin-empty">还有 \${pool.length - 200} 位未显示，请继续搜索缩小范围</div>\` : '');
}

/** 客户端 role chip 渲染（admin 列表用）— 与服务端 renderRoleChips 同逻辑 */
function renderRoleChipsClient(stats) {
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
    if (n) chips.push('<span class="cm-role-chip role-' + o.cls + '">' + o.short + ' ×' + n + '</span>');
  }
  for (const [role, n] of Object.entries(stats)) {
    if (!known.has(role) && n) {
      chips.push('<span class="cm-role-chip role-other">' + escapeHtml(role) + ' ×' + n + '</span>');
    }
  }
  return chips.join('');
}

// ─────────── 创建 / 编辑 ───────────

function cmStartCreate() {
  _editingId = null;
  $('cmEditTitle').textContent = '＋ 新建成员';
  $('cmMergeBtn').style.display = 'none';   // 新建模式不显示「合并」
  $('cmEditRsvps').style.display = 'none';  // 新建无 RSVP 可看
  ['name','nickname','bio','job','company','willShare','interests','topics','mbti','wechat','residentStatus'].forEach(k => $('cmF_'+k).value = '');
  $('cmF_hidden').checked = false;
  _identitySelected = [];
  cmRenderIdentity();
  $('cmEditErr').textContent = '';
  $('cmEditOverlay').classList.add('open');
  setTimeout(() => $('cmF_name').focus(), 200);
}

// ─────────── 「社群身份」multi-select ───────────

/** 列出所有可选选项：当前选中 + 全集 union（其他成员用过的） — 排除「游客」 */
function cmIdentityKnownOptions() {
  const seen = new Set();
  for (const m of _allMembers) {
    for (const v of (m.identity || [])) {
      if (v && v !== '游客') seen.add(v);
    }
  }
  for (const v of _identitySelected) seen.add(v);   // 当前编辑也算
  return [...seen].sort();
}

function cmRenderIdentity() {
  const chips = $('cmF_identity_chips');
  const known = cmIdentityKnownOptions();
  const selectedSet = new Set(_identitySelected);
  chips.innerHTML = known.map(v => {
    const sel = selectedSet.has(v);
    return '<button type="button" class="cm-multi-chip' + (sel ? ' is-on' : '') + '" data-val="' + escapeHtml(v) + '" onclick="cmIdentityToggle(this.dataset.val)">' + escapeHtml(v) + '</button>';
  }).join('');
}

function cmIdentityToggle(v) {
  if (_identitySelected.includes(v)) {
    _identitySelected = _identitySelected.filter(x => x !== v);
  } else {
    _identitySelected = [..._identitySelected, v];
  }
  cmRenderIdentity();
}

function cmIdentityKeydown(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const v = e.target.value.trim();
  if (!v) return;
  if (v === '游客') { e.target.value = ''; return; }   // 不让加回「游客」
  if (!_identitySelected.includes(v)) _identitySelected.push(v);
  e.target.value = '';
  cmRenderIdentity();
}

async function cmStartEdit(rid) {
  $('cmEditErr').textContent = '加载中...';
  $('cmEditOverlay').classList.add('open');
  $('cmMergeBtn').style.display = '';   // 编辑模式才显示「合并」按钮
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
    _identitySelected = Array.isArray(m.identity) ? [...m.identity] : [];
    cmRenderIdentity();
    $('cmEditErr').textContent = '';
    cmRenderEditRsvps(data.rsvps || []);
    setTimeout(() => $('cmF_name').focus(), 50);
  } catch (err) {
    $('cmEditErr').textContent = '加载失败：' + err.message;
  }
}

/** 编辑模式下渲染该成员的活动记录 */
function cmRenderEditRsvps(rsvps) {
  const wrap = $('cmEditRsvps');
  if (!rsvps || !rsvps.length) {
    wrap.style.display = 'none';
    return;
  }
  // 按日期倒序（活动日期优先，否则注册时间）
  rsvps.sort((a, b) => {
    const da = a.activity_date || '0';
    const db = b.activity_date || '0';
    if (da !== db) return da < db ? 1 : -1;
    return (b.registered_at || 0) - (a.registered_at || 0);
  });

  // 角色优先级标签 & 配色
  const roleStyle = r => {
    if (r === '活动发起者') return 'host';
    if (r === '嘉宾')      return 'speaker';
    if (r === '活动参与者') return 'attend';
    return 'other';
  };

  $('cmEditRsvpsCount').textContent = '· 共 ' + rsvps.length + ' 条';
  $('cmEditRsvpsList').innerHTML = rsvps.map(r => {
    const date = r.activity_date || '';
    const link = r.activity_rec_id
      ? '/events/' + escapeHtml(r.activity_rec_id) + (_editingId ? '?from=' + escapeHtml(_editingId) : '')
      : '#';
    const roles = (r.roles || []).map(x => '<span class="cm-edit-rsvp-role role-' + roleStyle(x) + '">' + escapeHtml(x) + '</span>').join('');
    return '<a class="cm-edit-rsvp-row" href="' + link + '" target="_blank" rel="noopener">'
      + '<span class="cm-edit-rsvp-date">' + escapeHtml(date) + '</span>'
      + '<span class="cm-edit-rsvp-title">' + escapeHtml(r.activity_title) + '</span>'
      + '<span class="cm-edit-rsvp-roles">' + roles + '</span>'
    + '</a>';
  }).join('');
  wrap.style.display = '';
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
    identity: [..._identitySelected],
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
      cmReload();
      btn.disabled = false; btn.textContent = '保存';
    }, 800);
  } catch (err) {
    $('cmEditErr').textContent = '保存失败：' + err.message;
    btn.disabled = false; btn.textContent = '保存';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('cmMergeOverlay').classList.contains('open'))      cmCloseMerge();
    else if ($('cmEditOverlay').classList.contains('open'))  cmCloseEdit();
  }
});

// ─────────── 合并 ───────────
let _mergeSourceId = null, _mergeSourceMember = null, _mergeTargetMember = null, _mergeProposed = {}, _mergeSearchTimer = null;

const FIELD_LABELS = {
  name: '姓名', nickname: '称呼', bio: '个人介绍',
  job: '职业描述', company: '公司',
  willShare: '愿做的分享', interests: '感兴趣活动',
  topics: '关注话题', mbti: 'MBTI',
  wechat: '微信号', residentStatus: '据点入住状态',
};

function cmStartMerge() {
  if (!_editingId) return;
  _mergeSourceId = _editingId;
  _mergeSourceMember = _allMembers.find(m => m.record_id === _mergeSourceId);
  if (!_mergeSourceMember) { alert('找不到当前编辑的成员'); return; }

  $('cmMergeSourceName').textContent  = _mergeSourceMember.nickname || _mergeSourceMember.name || '(未署名)';
  $('cmMergeSourceName2').textContent = _mergeSourceMember.nickname || _mergeSourceMember.name || '(未署名)';
  $('cmMergeStep1').style.display = '';
  $('cmMergeStep2').style.display = 'none';
  $('cmMergeBack').style.display  = 'none';
  $('cmMergeSubmit').style.display = 'none';
  $('cmMergeSearch').value = '';
  $('cmMergeErr').textContent = '';
  $('cmMergeOverlay').classList.add('open');
  cmRenderMergeCandidates('');
  setTimeout(() => $('cmMergeSearch').focus(), 200);
}

function cmCloseMerge() {
  $('cmMergeOverlay').classList.remove('open');
  _mergeSourceId = _mergeSourceMember = _mergeTargetMember = null;
  _mergeProposed = {};
}

function cmMergeSearchTick() {
  clearTimeout(_mergeSearchTimer);
  _mergeSearchTimer = setTimeout(() => cmRenderMergeCandidates($('cmMergeSearch').value.trim().toLowerCase()), 150);
}

function cmRenderMergeCandidates(q) {
  let pool = _allMembers.filter(m => m.record_id !== _mergeSourceId);
  if (q) pool = pool.filter(m =>
    [m.name, m.nickname, m.bio, m.job, m.company, m._wechat]
      .some(s => s && String(s).toLowerCase().includes(q))
  );
  pool = pool.slice(0, 30);
  if (!pool.length) {
    $('cmMergeCandidates').innerHTML = '<div class="cm-admin-empty">' + (q ? '没有匹配' : '请输入关键词搜索') + '</div>';
    return;
  }
  $('cmMergeCandidates').innerHTML = pool.map(m => {
    const name = (m.nickname || m.name || '未署名').trim();
    const sub  = [m.name && m.nickname && m.name !== m.nickname ? m.name : '', m.job, m.company].filter(Boolean).join(' · ');
    return '<button class="cm-merge-candidate" onclick="cmPickMergeTarget(\\'' + escapeHtml(m.record_id) + '\\')">'
      + '<div class="cm-merge-candidate-name">' + escapeHtml(name) + (m.hidden ? ' <span class="cm-hidden-tag">已隐藏</span>' : '') + '</div>'
      + (sub ? '<div class="cm-merge-candidate-sub">' + escapeHtml(sub) + '</div>' : '')
    + '</button>';
  }).join('');
}

async function cmPickMergeTarget(targetId) {
  $('cmMergeErr').textContent = '加载预览中...';
  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge-preview', password: _adminPwd, source_id: _mergeSourceId, target_id: targetId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    _mergeTargetMember = data.target;
    _mergeProposed = { ...(data.proposed || {}) };

    $('cmMergeTargetName2').textContent = data.target.nickname || data.target.name || '(未署名)';
    $('cmMergeRsvpInfo').textContent = data.rsvp_count
      ? '将把 ' + data.rsvp_count + ' 条 RSVP 记录的关联从原条目转到目标条目。'
      : '原条目没有 RSVP 记录。';

    // 字段对比
    const lines = [];
    const allFields = Object.keys(FIELD_LABELS);
    for (const k of allFields) {
      const sv = (k === 'wechat' ? data.source._wechat : data.source[k]) || '';
      const tv = (k === 'wechat' ? data.target._wechat : data.target[k]) || '';
      if (!sv && !tv) continue;
      const inProposed = Object.prototype.hasOwnProperty.call(_mergeProposed, k);
      const conflict = sv && tv && sv !== tv;
      const checkable = inProposed || conflict;
      const checked = inProposed;
      lines.push(
        '<div class="cm-merge-field-row' + (conflict ? ' is-conflict' : '') + '">'
        + '<div class="cm-merge-field-label">' + FIELD_LABELS[k] + '</div>'
        + '<div class="cm-merge-field-vals">'
          + '<div class="cm-merge-field-side"><span class="cm-merge-side-tag">原</span> ' + (sv ? escapeHtml(String(sv)) : '<em>(空)</em>') + '</div>'
          + '<div class="cm-merge-field-side"><span class="cm-merge-side-tag tgt">目标</span> ' + (tv ? escapeHtml(String(tv)) : '<em>(空)</em>') + '</div>'
        + '</div>'
        + (checkable
            ? '<label class="cm-merge-field-take"><input type="checkbox" data-field="' + k + '"' + (checked ? ' checked' : '') + ' onchange="cmToggleMergeField(this)"> ' + (conflict ? '覆盖目标，用原值' : '把原值带到目标') + '</label>'
            : '')
        + '</div>'
      );
    }
    $('cmMergeFieldList').innerHTML = lines.join('') || '<p class="cm-merge-sub" style="color:var(--muted)">没有可补全的字段。</p>';

    // 冲突提示
    if (data.conflicts && data.conflicts.length) {
      $('cmMergeConflicts').textContent = '⚠️ 有 ' + data.conflicts.length + ' 个字段两边都有值且不同（已默认保留目标，可手动勾选改用原值）';
    } else {
      $('cmMergeConflicts').textContent = '';
    }

    $('cmMergeStep1').style.display = 'none';
    $('cmMergeStep2').style.display = '';
    $('cmMergeBack').style.display  = '';
    $('cmMergeSubmit').style.display = '';
    $('cmMergeErr').textContent = '';
  } catch (err) {
    $('cmMergeErr').textContent = '加载失败：' + err.message;
  }
}

function cmToggleMergeField(cb) {
  const k  = cb.dataset.field;
  const sv = (k === 'wechat' ? _mergeSourceMember._wechat : _mergeSourceMember[k]) || '';
  if (cb.checked) _mergeProposed[k] = sv;
  else delete _mergeProposed[k];
}

function cmMergeBack() {
  $('cmMergeStep1').style.display = '';
  $('cmMergeStep2').style.display = 'none';
  $('cmMergeBack').style.display  = 'none';
  $('cmMergeSubmit').style.display = 'none';
  _mergeTargetMember = null;
  _mergeProposed = {};
  $('cmMergeErr').textContent = '';
}

async function cmDoMerge() {
  if (!_mergeTargetMember) return;
  if (!confirm('确认合并？\\n原条目（' + (_mergeSourceMember.nickname || _mergeSourceMember.name) + '）将被删除，相关 RSVP 转移到目标。此操作不可撤销。')) return;

  const btn = $('cmMergeSubmit');
  btn.disabled = true; btn.textContent = '合并中...';

  try {
    const res = await fetch('/api/community-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'merge', password: _adminPwd,
        source_id: _mergeSourceId,
        target_id: _mergeTargetMember.record_id,
        field_overrides: _mergeProposed,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    $('cmMergeErr').textContent = '✓ 合并完成 · 重链 ' + (data.rsvp_updated || 0) + ' 条 RSVP · 补 ' + (data.fields_applied || []).length + ' 个字段';
    setTimeout(() => {
      cmCloseMerge();
      cmCloseEdit();
      cmReload();
      btn.disabled = false; btn.textContent = '确认合并并删除原条目';
    }, 1200);
  } catch (err) {
    $('cmMergeErr').textContent = '合并失败：' + err.message;
    btn.disabled = false; btn.textContent = '确认合并并删除原条目';
  }
}
</script>

</body>
</html>`;
}
