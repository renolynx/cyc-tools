/**
 * GET /api/event-page?id={record_id}
 * 服务端渲染单条活动详情页
 *
 * vercel.json rewrite: /events/:id → /api/event-page?id=:id
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchActivity, formatCnDate, todayBJ } from './_activity.js';
import { fetchRsvpsForActivity } from './_rsvp.js';
import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const CACHE_TTL_SEC = 600;     // KV 10 分钟
const EDGE_CACHE    = 'public, s-maxage=300, stale-while-revalidate=3600';

const SITE_URL  = 'https://cyc.center';
const SITE_NAME = 'CYC 链岛青年社区';
const OG_DEFAULT = SITE_URL + '/api/og-default';

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

function posterUrl(act) {
  if (act.poster?.file_token)
    return SITE_URL + '/api/poster?token=' + encodeURIComponent(act.poster.file_token);
  return null;
}

function buildJsonLd(act, ogImage, url, isPast) {
  // 把活动地点拆成结构化地址（飞书里 a.loc 是自由文本，只能粗略归到大理）
  const ld = {
    '@context':            'https://schema.org',
    '@type':               'Event',
    'name':                act.title,
    'startDate':           act.date,
    'eventStatus':         isPast ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
    'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
    'location': {
      '@type': 'Place',
      'name':  act.loc || 'CYC 链岛青年社区',
      'address': {
        '@type':           'PostalAddress',
        'addressLocality': 'Dali',
        'addressRegion':   'Yunnan',
        'addressCountry':  'CN',
      },
    },
    'image':       ogImage,
    'description': act.desc || act.title,
    'url':         url,
    'organizer': {
      '@type':         'Organization',
      'name':          'CYC 链岛青年社区',
      'alternateName': 'Connected Youth Community',
      'url':           SITE_URL,
    },
  };
  if (act.fee) {
    ld.offers = {
      '@type':         'Offer',
      'priceCurrency': 'CNY',
      'price':         /^[0-9]+$/.test(act.fee.trim()) ? act.fee.trim() : '0',
      'description':   act.fee,
      'url':           url,
    };
  }
  return JSON.stringify(ld);
}

function renderEventDetail(act, rsvps = []) {
  const title    = escapeHtml(act.title || '未命名活动');
  const descRaw  = act.desc || '';
  const descShort = escapeHtml(descRaw.replace(/\n/g, ' ').slice(0, 100));
  // 双语 description 给 Google：中文 主体 + 英文 context tail
  const descBilingual = descShort + ' · CYC Connected Youth Community event in Dali, Yunnan';
  const ogImage  = posterUrl(act) || OG_DEFAULT;
  const url      = `${SITE_URL}/events/${act.record_id}`;
  const isPast   = act.date && act.date < todayBJ();
  const dateStr = formatCnDate(act.date);
  const jsonLd   = buildJsonLd(act, ogImage, url, isPast);

  // RSVP 按归一化 wechat 去重（大小写不敏感、保留最新一条）；wechat 空的全保留
  const seenWx = new Set();
  const rsvpsDeduped = rsvps.filter(r => {
    const wx = (r.wechat || '').trim().toLowerCase();
    if (!wx) return true;
    if (seenWx.has(wx)) return false;
    seenWx.add(wx);
    return true;
  });
  // 拆 hosts / attendees
  const rsvpHosts     = rsvpsDeduped.filter(r => r.roles.includes('活动发起者') || r.roles.includes('嘉宾'));
  const rsvpAttendees = rsvpsDeduped.filter(r => r.roles.includes('活动参与者'));
  const rsvpTitleJson = JSON.stringify(act.title || '');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="format-detection" content="telephone=no">
<title>${title} · CYC 链岛青年社区 · Dali</title>
<meta name="description" content="${descBilingual}">
<meta name="keywords" content="CYC, 链岛青年社区, Connected Youth Community, Dali, 大理, digital nomad, coliving, 数字游民, ${escapeHtml(act.title || '')}">

<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${descShort}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="zh_CN">
<meta property="og:locale:alternate" content="en_US">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${descShort}">
<meta name="twitter:image" content="${ogImage}">

<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/styles.css">

<script type="application/ld+json">
${jsonLd}
</script>
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

  ${(rsvpHosts.length || act.spk?.length) ? `<section class="event-section">
    <h2>带领人 / 嘉宾</h2>
    <div class="event-spk">${
      rsvpHosts.length
        ? rsvpHosts.map(h => `<div class="event-spk-row" data-rid="${escapeHtml(h.record_id)}" data-name="${escapeHtml(h.name)}">
            <span class="event-spk-content">${
              h.member_rec_id
                ? `<a href="/community/${escapeHtml(h.member_rec_id)}" class="event-spk-link"><strong>${escapeHtml(h.name)}</strong></a>`
                : `<strong>${escapeHtml(h.name)}</strong>`
            }${h.bio ? `<span class="event-spk-bio"> · ${escapeHtml(h.bio)}</span>` : ''}</span>
            <button class="event-rsvp-del" onclick="askDelRsvp(this.parentElement.dataset.rid, this.parentElement.dataset.name)" aria-label="删除">×</button>
          </div>`).join('')
        : act.spk.map(s => `<div class="event-spk-row"><span class="event-spk-content"><strong>${escapeHtml(s.name)}</strong>${s.bio ? `<span class="event-spk-bio"> · ${escapeHtml(s.bio)}</span>` : ''}</span></div>`).join('')
    }</div>
  </section>` : ''}

  ${!isPast ? `<section class="event-section event-rsvp-section">
    <h2>报名情况</h2>
    ${rsvpAttendees.length ? `
      <p class="event-rsvp-count">已 <strong>${rsvpAttendees.length}</strong> 位伙伴报名</p>
      <div class="event-rsvp-list">
        ${rsvpAttendees.slice(0, 30).map(a => `<div class="event-rsvp-chip${a.bio ? ' has-bio' : ''}" data-rid="${escapeHtml(a.record_id)}" data-name="${escapeHtml(a.name)}" ${a.bio ? `onclick="if(event.target.tagName!=='BUTTON')this.classList.toggle('expanded')"` : ''}>
          <span class="event-rsvp-chip-name">${escapeHtml(a.name)}</span>
          <button class="event-rsvp-del" onclick="event.stopPropagation();askDelRsvp(this.parentElement.dataset.rid, this.parentElement.dataset.name)" aria-label="删除">×</button>
          ${a.bio ? `<div class="event-rsvp-chip-bio">${escapeHtml(a.bio)}</div>` : ''}
        </div>`).join('')}
        ${rsvpAttendees.length > 30 ? `<div class="event-rsvp-more">+${rsvpAttendees.length - 30}</div>` : ''}
      </div>
    ` : `<p class="event-rsvp-empty">还没有伙伴报名 · 你来当第一个 →</p>`}
    <button class="event-rsvp-btn" onclick="openRsvpModal()">📝 我要参加</button>
  </section>` : (rsvpAttendees.length ? `<section class="event-section">
    <h2>当时参加的伙伴</h2>
    <div class="event-rsvp-list">
      ${rsvpAttendees.map(a => `<div class="event-rsvp-chip is-past">${escapeHtml(a.name)}</div>`).join('')}
    </div>
  </section>` : '')}
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

<!-- 删除报名确认 modal（任何活动都需要：admin 可清脏数据） -->
<div class="rsvp-modal-overlay" id="rsvpDelModal" onclick="if(event.target.id==='rsvpDelModal')closeDelRsvpModal()">
  <div class="rsvp-modal" style="max-width:380px">
    <div class="rsvp-modal-handle"></div>
    <div class="rsvp-modal-title" style="color:#c0392b">⚠️ 确认删除报名</div>
    <p class="rsvp-modal-sub">将删除 <strong id="delRsvpTarget"></strong> 的报名记录。<br>此操作不可撤销，需输入管理密码。</p>

    <label class="rsvp-label">管理密码 <span class="rsvp-required">*</span></label>
    <input class="rsvp-input pwd-mask" id="delRsvpPwd" type="text" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false">

    <div class="rsvp-err" id="delRsvpErr"></div>

    <div class="rsvp-actions">
      <button type="button" class="rsvp-cancel" onclick="closeDelRsvpModal()">取消</button>
      <button type="button" class="rsvp-confirm" id="delRsvpSubmit" onclick="submitDelRsvp()" style="background:#c0392b;box-shadow:0 3px 10px rgba(192,57,43,0.30)">确认删除</button>
    </div>
  </div>
</div>

${!isPast ? `<!-- RSVP modal -->
<div class="rsvp-modal-overlay" id="rsvpModal" onclick="if(event.target.id==='rsvpModal')closeRsvpModal()">
  <div class="rsvp-modal">
    <div class="rsvp-modal-handle"></div>
    <div class="rsvp-modal-title">📝 报名活动</div>
    <p class="rsvp-modal-sub">${title}</p>
    <form onsubmit="event.preventDefault();submitRsvp()">
      <label class="rsvp-label">姓名 <span class="rsvp-required">*</span></label>
      <input class="rsvp-input" id="rsvpName" maxlength="20" autocomplete="name" required>

      <label class="rsvp-label">微信号 <span class="rsvp-required">*</span> <span class="rsvp-hint">用于活动通知，不会公开显示</span></label>
      <input class="rsvp-input" id="rsvpWechat" maxlength="30" autocomplete="off" required>

      <label class="rsvp-label">个人简介 <span class="rsvp-hint">选填，限 200 字</span></label>
      <textarea class="rsvp-input rsvp-textarea" id="rsvpBio" maxlength="200" rows="3"></textarea>

      <div class="rsvp-err" id="rsvpErr"></div>

      <div class="rsvp-actions">
        <button type="button" class="rsvp-cancel" onclick="closeRsvpModal()">取消</button>
        <button type="submit" class="rsvp-confirm" id="rsvpSubmit">确认报名</button>
      </div>
    </form>
  </div>
</div>

<script>
const ACT_REC_ID = ${JSON.stringify(act.record_id)};
const ACT_TITLE  = ${rsvpTitleJson};

function openRsvpModal()  { document.getElementById('rsvpModal').classList.add('open'); setTimeout(() => document.getElementById('rsvpName').focus(), 200); }
function closeRsvpModal() { document.getElementById('rsvpModal').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRsvpModal(); });

async function submitRsvp() {
  const name   = document.getElementById('rsvpName').value.trim();
  const wechat = document.getElementById('rsvpWechat').value.trim();
  const bio    = document.getElementById('rsvpBio').value.trim();
  const errEl  = document.getElementById('rsvpErr');
  const btn    = document.getElementById('rsvpSubmit');

  errEl.textContent = ''; errEl.classList.remove('ok');
  if (!name)   { errEl.textContent = '请填写姓名'; return; }
  if (!wechat) { errEl.textContent = '请填写微信号'; return; }

  // 客户端兜底去重（同浏览器同会话同活动同微信号）
  try {
    const seenKey = 'rsvp_done:' + ACT_REC_ID;
    const prev = sessionStorage.getItem(seenKey);
    if (prev === wechat) {
      errEl.classList.add('ok');
      errEl.textContent = '✓ 你刚才已经报过名了，不用重复';
      btn.disabled = true;
      btn.textContent = '已报名';
      setTimeout(closeRsvpModal, 1500);
      return;
    }
  } catch {}

  btn.disabled = true;
  btn.textContent = '提交中...';
  try {
    const res = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_rec_id: ACT_REC_ID, activity_title: ACT_TITLE, name, wechat, bio }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '报名失败');

    // 标记已报，下次同会话直接拦
    try { sessionStorage.setItem('rsvp_done:' + ACT_REC_ID, wechat); } catch {}

    errEl.classList.add('ok');
    errEl.textContent = data.already_registered ? '✓ 你已经报名过这个活动' : '✓ 报名成功！我们会通过微信联系你';
    btn.textContent = '已成功';
    setTimeout(() => {
      closeRsvpModal();
      // 加 query param 绕开 Vercel Edge cache（s-maxage=300）
      window.location.href = window.location.pathname + '?_=' + Date.now();
    }, 1500);
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = '确认报名';
  }
}
</script>` : ''}

<script>
// ─────────── 删除报名（admin 用，密码保护） ───────────
const _ACT_REC_ID = ${JSON.stringify(act.record_id)};
let _delRsvpId = null;

function askDelRsvp(record_id, name) {
  if (!record_id) return;
  _delRsvpId = record_id;
  document.getElementById('delRsvpTarget').textContent = name || '该报名';
  document.getElementById('delRsvpPwd').value = '';
  const errEl = document.getElementById('delRsvpErr');
  errEl.textContent = ''; errEl.classList.remove('ok');
  const btn = document.getElementById('delRsvpSubmit');
  btn.disabled = false; btn.textContent = '确认删除';
  document.getElementById('rsvpDelModal').classList.add('open');
  setTimeout(() => document.getElementById('delRsvpPwd').focus(), 200);
}

function closeDelRsvpModal() {
  document.getElementById('rsvpDelModal').classList.remove('open');
  _delRsvpId = null;
}

async function submitDelRsvp() {
  const pwd = document.getElementById('delRsvpPwd').value.trim();
  const errEl = document.getElementById('delRsvpErr');
  const btn = document.getElementById('delRsvpSubmit');
  errEl.textContent = ''; errEl.classList.remove('ok');
  if (!pwd) { errEl.textContent = '请输入管理密码'; return; }
  if (!_delRsvpId) { errEl.textContent = '记录 ID 丢失，请刷新重试'; return; }

  btn.disabled = true; btn.textContent = '删除中...';
  try {
    const res = await fetch('/api/rsvp?action=delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record_id: _delRsvpId,
        activity_rec_id: _ACT_REC_ID,
        password: pwd,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除失败');

    errEl.classList.add('ok');
    errEl.textContent = '✓ 已删除';
    btn.textContent = '已删除';
    setTimeout(() => {
      closeDelRsvpModal();
      window.location.href = window.location.pathname + '?_=' + Date.now();
    }, 1000);
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = '确认删除';
  }
}

// ESC 关闭删除 modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('rsvpDelModal').classList.contains('open')) {
    closeDelRsvpModal();
  }
});
</script>

</body>
</html>`;
}

function renderErrorPage(opts) {
  const { icon, title, titleEn, msg, msgEn } = opts;
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
  <a href="/events" class="event-404-link">查看全部活动 → All Events</a>
</main>
</body>
</html>`;
}

function render404() {
  return renderErrorPage({
    icon: '🌿',
    title: '活动不存在',
    titleEn: 'Event not found',
    msg: '这条活动可能已被删除，或者链接不对。',
    msgEn: 'This event may have been removed, or the link is broken.',
  });
}

function render500() {
  return renderErrorPage({
    icon: '⚠️',
    title: '服务暂时出了点问题',
    titleEn: 'Something went wrong',
    msg: '稍后再试，或返回看看其他活动。',
    msgEn: 'Please try again later, or browse other events.',
  });
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
      return res.status(500).send(render500());
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

  // 4. 拉 RSVP（失败不阻塞主渲染）
  let rsvps = [];
  try {
    rsvps = await fetchRsvpsForActivity(id);
  } catch (err) {
    console.error('[event-page] rsvp fetch failed:', err.message);
  }

  // 5. 渲染
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventDetail(act, rsvps));
}
