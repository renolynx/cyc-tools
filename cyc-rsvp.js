/* cyc-rsvp.js — global RSVP modal, hoist to home / events / shanghai
 * Usage:
 *   window.cycOpenRsvp({
 *     record_id: 'rec...',
 *     title:     '社区 OS 分享 #1',
 *     title_en:  'Community OS Talk #1',  // optional
 *     city:      '大理' | '上海',          // controls Shanghai-only fields
 *     onsite_fee: 30,                       // optional
 *   });
 *
 * Talks to existing POST /api/rsvp with payload:
 *   { activity_rec_id, activity_title, name, wechat?, email?,
 *     attendance_mode?, ticket_holder?, bio?, hubs? }
 *
 * Detects bilingual mode from body class:
 *   - body.cyc-lang-en          (home / events list)
 *   - body.sh-lang-en           (shanghai)
 */
(function () {
  if (window.cycOpenRsvp) return;  // 已加载，避免重复

  let _ctx     = null;     // { record_id, title, title_en, city, onsite_fee }
  let _mode    = 'wechat'; // 'wechat' | 'email'
  let _injected = false;

  function isEn() {
    return document.body.classList.contains('cyc-lang-en')
        || document.body.classList.contains('sh-lang-en');
  }

  function injectModal() {
    if (_injected) return;
    _injected = true;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<div class="cyc-rsvp-overlay" id="cycRsvpOverlay" onclick="if(event.target.id==='cycRsvpOverlay')cycCloseRsvp()">
  <div class="cyc-rsvp-modal" role="dialog" aria-labelledby="cycRsvpTitle">
    <button class="cyc-rsvp-close" type="button" onclick="cycCloseRsvp()" aria-label="Close">×</button>
    <h2 id="cycRsvpTitle">RSVP</h2>
    <p class="cyc-rsvp-subtitle" id="cycRsvpSubtitle"></p>

    <form id="cycRsvpForm" novalidate>
      <input type="hidden" name="activity_rec_id" id="cycRsvpActId">
      <input type="hidden" name="activity_title"  id="cycRsvpActTitle">

      <div class="cyc-rsvp-row">
        <label class="cyc-rsvp-label" data-zh="姓名 *" data-en="Name *"></label>
        <input class="cyc-rsvp-input" type="text" name="name" required maxlength="30"
               placeholder="Jane Doe" autocomplete="name">
      </div>

      <div class="cyc-rsvp-row" id="cycRsvpWechatRow">
        <label class="cyc-rsvp-label" data-zh="微信号 *" data-en="WeChat ID *"></label>
        <input class="cyc-rsvp-input" type="text" name="wechat" id="cycRsvpWechatInput" maxlength="30"
               placeholder="—" autocomplete="username">
        <button type="button" class="cyc-rsvp-toggle" id="cycRsvpToEmail"
                data-zh="没有微信号？用邮箱填写 →"
                data-en="Don't have WeChat? Use email instead →"></button>
      </div>

      <div class="cyc-rsvp-row" id="cycRsvpEmailRow" style="display:none;">
        <label class="cyc-rsvp-label" data-zh="邮箱 *" data-en="Email *"></label>
        <input class="cyc-rsvp-input" type="email" name="email" id="cycRsvpEmailInput" maxlength="100"
               placeholder="you@example.com" autocomplete="email">
        <button type="button" class="cyc-rsvp-toggle" id="cycRsvpToWechat"
                data-zh="← 我有微信号"
                data-en="← I have WeChat"></button>
      </div>

      <div class="cyc-rsvp-row" id="cycRsvpModeRow">
        <label class="cyc-rsvp-label" data-zh="怎么参加？" data-en="How will you join?"></label>
        <div class="cyc-rsvp-radio-row">
          <label data-mode-label>
            <input type="radio" name="attendance_mode" value="online" checked>
            <span data-zh="线上 · 腾讯会议" data-en="Online · Tencent Meeting"></span>
          </label>
          <label data-mode-label>
            <input type="radio" name="attendance_mode" value="offline">
            <span data-zh="现场" data-en="Offline · in person"></span>
          </label>
        </div>
      </div>

      <div class="cyc-rsvp-row" id="cycRsvpTicketRow">
        <label class="cyc-rsvp-checkbox" id="cycRsvpTicketLabel">
          <input type="checkbox" name="ticket_holder" id="cycRsvpTicketInput">
          <span data-zh="我有 muShanghai 月票 / day pass（现场免费）"
                data-en="I have a muShanghai monthly / day pass (on-site free)"></span>
        </label>
      </div>

      <div class="cyc-rsvp-row">
        <label class="cyc-rsvp-label" data-zh="个人简介（可选）" data-en="Bio (optional)"></label>
        <textarea class="cyc-rsvp-input" name="notes" maxlength="200" placeholder=""></textarea>
        <p class="cyc-rsvp-hint"
           data-zh="留下微信号会自动添加为社区成员，让其他人认识你（后续可编辑）"
           data-en="Leave a WeChat to be auto-added as a community member (editable later)"></p>
      </div>

      <div id="cycRsvpError" class="cyc-rsvp-error" style="display:none;"></div>
      <button type="submit" class="cyc-rsvp-submit" id="cycRsvpSubmit"
              data-zh="我要报名"
              data-en="RSVP · Save my spot"></button>
    </form>
  </div>
</div>

<div class="cyc-rsvp-overlay" id="cycRsvpConfirmOverlay" onclick="if(event.target.id==='cycRsvpConfirmOverlay')cycCloseConfirm()">
  <div class="cyc-rsvp-modal" role="dialog">
    <button class="cyc-rsvp-close" type="button" onclick="cycCloseConfirm()" aria-label="Close">×</button>
    <div class="cyc-rsvp-confirm-icon">✨</div>
    <h2 style="text-align:center;" data-zh="报名成功！" data-en="You're in!"></h2>
    <p class="cyc-rsvp-subtitle" style="text-align:center;" id="cycRsvpConfirmTitle"></p>
    <div id="cycRsvpFeeBox" class="cyc-rsvp-fee"></div>
    <p style="font-size:13px; line-height:1.6; color:#6a6c66;"
       data-zh="活动开始前，主理人会通过你留的邮箱或微信发送会议链接和最终细节。"
       data-en="The organizer will message you the meeting link and final details before the event."></p>
    <button type="button" class="cyc-rsvp-submit" onclick="cycCloseConfirm()"
            data-zh="好的" data-en="Got it"></button>
    <button type="button" class="cyc-rsvp-toggle" id="cycRsvpCancelBtn"
            style="margin-top:14px;display:block;text-align:center;width:100%;color:#888;"
            data-zh="↩ 取消刚刚的报名"
            data-en="↩ Cancel that RSVP"></button>
    <div id="cycRsvpCancelStatus" style="margin-top:8px;font-size:12px;text-align:center;color:#6a6c66;"></div>
    <a href="/me/rsvps" style="display:block;text-align:center;margin-top:6px;font-size:11.5px;color:#a8a8a8;text-decoration:none;"
       data-zh="→ 看我所有的报名"
       data-en="→ See all my RSVPs"></a>
  </div>
</div>`;
    document.body.appendChild(wrap);

    // bilingual labels
    function applyLang() {
      const en = isEn();
      wrap.querySelectorAll('[data-zh][data-en]').forEach(el => {
        el.textContent = en ? el.dataset.en : el.dataset.zh;
      });
    }
    applyLang();
    // re-apply on lang toggle (zh/en)
    new MutationObserver(applyLang).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // wire interactions
    document.getElementById('cycRsvpToEmail').addEventListener('click', () => setMode('email', true));
    document.getElementById('cycRsvpToWechat').addEventListener('click', () => setMode('wechat', true));
    document.getElementById('cycRsvpTicketInput').addEventListener('change', function () {
      document.getElementById('cycRsvpTicketLabel').classList.toggle('is-checked', this.checked);
    });
    document.querySelectorAll('[data-mode-label] input').forEach(input => {
      input.addEventListener('change', () => {
        document.querySelectorAll('[data-mode-label]').forEach(l => {
          l.classList.toggle('is-selected', l.querySelector('input').checked);
        });
      });
    });
    setTimeout(() => {
      document.querySelectorAll('[data-mode-label]').forEach(l => {
        l.classList.toggle('is-selected', l.querySelector('input').checked);
      });
    }, 0);

    document.getElementById('cycRsvpForm').addEventListener('submit', onSubmit);
    document.getElementById('cycRsvpCancelBtn').addEventListener('click', onCancel);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        cycCloseRsvp();
        cycCloseConfirm();
      }
    });
  }

  // v4.2.13 Task 4: 身份持久化 + 取消刚刚报名
  function saveIdentity(payload) {
    try {
      localStorage.setItem('cyc-me', JSON.stringify({
        name:   payload.name   || '',
        wechat: payload.wechat || '',
        email:  payload.email  || '',
        savedAt: Date.now(),
      }));
    } catch {}
  }
  function getIdentity() {
    try { return JSON.parse(localStorage.getItem('cyc-me') || 'null'); } catch { return null; }
  }
  async function onCancel() {
    const en = isEn();
    const me = getIdentity();
    const status = document.getElementById('cycRsvpCancelStatus');
    if (!me || (!me.wechat && !me.email)) {
      status.textContent = en ? 'No saved identity to cancel with.' : '没找到你的报名身份。';
      return;
    }
    if (!_ctx || !_ctx.record_id) return;
    const btn = document.getElementById('cycRsvpCancelBtn');
    btn.disabled = true;
    status.textContent = en ? 'Canceling…' : '取消中…';
    try {
      const res = await fetch('/api/rsvp?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_rec_id: _ctx.record_id,
          auth: me.wechat || me.email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `${res.status}`);
      status.textContent = en ? '✓ Canceled.' : '✓ 已取消。';
      btn.style.display = 'none';
      if (typeof cycTrack === 'function') cycTrack('rsvp_cancel_ok', { record_id: _ctx.record_id });
    } catch (err) {
      status.textContent = (en ? 'Cancel failed: ' : '取消失败：') + err.message;
      btn.disabled = false;
    }
  }

  let _userOverrideMode = false;
  function setMode(mode, fromUser) {
    if (fromUser) _userOverrideMode = true;
    _mode = mode;
    const isEmail = mode === 'email';
    document.getElementById('cycRsvpWechatRow').style.display = isEmail ? 'none' : '';
    document.getElementById('cycRsvpEmailRow').style.display  = isEmail ? '' : 'none';
    if (isEmail) document.getElementById('cycRsvpWechatInput').value = '';
    else         document.getElementById('cycRsvpEmailInput').value  = '';
  }

  window.cycOpenRsvp = function (activity) {
    injectModal();
    _ctx = activity || {};
    document.getElementById('cycRsvpActId').value    = _ctx.record_id || '';
    document.getElementById('cycRsvpActTitle').value = _ctx.title     || '';
    document.getElementById('cycRsvpTitle').textContent = _ctx.title || 'RSVP';
    const sub = document.getElementById('cycRsvpSubtitle');
    sub.textContent = (_ctx.title_en && _ctx.title_en !== _ctx.title) ? _ctx.title_en : '';

    // city-aware: ticket holder + online/offline radio only for 上海 events
    const isShanghai = _ctx.city === '上海';
    document.getElementById('cycRsvpTicketRow').style.display = isShanghai ? '' : 'none';
    document.getElementById('cycRsvpModeRow').style.display   = isShanghai ? '' : 'none';

    // reset form, default mode based on lang
    document.getElementById('cycRsvpError').style.display = 'none';
    document.getElementById('cycRsvpForm').reset();
    if (!_userOverrideMode) setMode(isEn() ? 'email' : 'wechat', false);

    document.getElementById('cycRsvpOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof cycTrack === 'function') cycTrack('rsvp_modal_open', { record_id: _ctx.record_id, city: _ctx.city || '' });
  };

  window.cycCloseRsvp = function () {
    const o = document.getElementById('cycRsvpOverlay');
    if (o) o.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.cycCloseConfirm = function () {
    const o = document.getElementById('cycRsvpConfirmOverlay');
    if (o) o.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function onSubmit(e) {
    e.preventDefault();
    const en = isEn();
    const errBox = document.getElementById('cycRsvpError');
    const btn    = document.getElementById('cycRsvpSubmit');

    const fd = new FormData(this);
    const isShanghai = _ctx && _ctx.city === '上海';
    const payload = {
      activity_rec_id: fd.get('activity_rec_id'),
      activity_title:  fd.get('activity_title'),
      name:            (fd.get('name')   || '').toString().trim(),
      email:           (fd.get('email')  || '').toString().trim(),
      wechat:          (fd.get('wechat') || '').toString().trim(),
      bio:             (fd.get('notes')  || '').toString().trim(),
      attendance_mode: isShanghai ? (fd.get('attendance_mode') || 'online') : undefined,
      ticket_holder:   isShanghai ? !!fd.get('ticket_holder') : undefined,
      hubs:            isShanghai ? ['上海'] : undefined,
    };

    if (!payload.name) {
      errBox.textContent = en ? 'Please enter your name.' : '请填写姓名。';
      errBox.style.display = ''; return;
    }
    if (_mode === 'email') {
      if (!payload.email) {
        errBox.textContent = en ? 'Please enter your email.' : '请填写邮箱。';
        errBox.style.display = ''; return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errBox.textContent = en ? 'Email format looks invalid.' : '邮箱格式不对。';
        errBox.style.display = ''; return;
      }
    } else {
      if (!payload.wechat) {
        errBox.textContent = en
          ? 'Please enter your WeChat ID — or click "Don\'t have WeChat?" to use email.'
          : '请填写微信号 —— 或点"没有微信号？"切换到邮箱。';
        errBox.style.display = ''; return;
      }
    }

    errBox.style.display = 'none';
    btn.disabled = true;
    const origLabel = btn.textContent;
    btn.textContent = en ? 'Saving…' : '提交中…';

    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `${res.status}`);

      // 保存身份用于后续取消（仅本浏览器；不发服务器额外字段）
      saveIdentity(payload);

      // success or already_registered → show confirm
      cycCloseRsvp();
      const confirmTitle = document.getElementById('cycRsvpConfirmTitle');
      confirmTitle.textContent = _ctx.title || '';
      const feeBox = document.getElementById('cycRsvpFeeBox');
      feeBox.className = 'cyc-rsvp-fee';
      feeBox.textContent = computeFeeMsg(payload, _ctx, en);
      if (payload.attendance_mode === 'offline' && !payload.ticket_holder && _ctx.onsite_fee > 0) {
        feeBox.classList.add('is-paid');
      }
      // 重置 cancel 按钮（如果上次已经被点过隐藏了）
      const cancelBtn = document.getElementById('cycRsvpCancelBtn');
      const cancelStatus = document.getElementById('cycRsvpCancelStatus');
      if (cancelBtn) { cancelBtn.style.display = ''; cancelBtn.disabled = false; }
      if (cancelStatus) cancelStatus.textContent = '';
      document.getElementById('cycRsvpConfirmOverlay').classList.add('open');
      document.body.style.overflow = 'hidden';
      if (typeof cycTrack === 'function') cycTrack('rsvp_submit_ok', { record_id: payload.activity_rec_id, already: !!data.already_registered });
    } catch (err) {
      errBox.textContent = (en ? 'Submit failed: ' : '提交失败：') + err.message;
      errBox.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  }

  function computeFeeMsg(p, ctx, en) {
    if (ctx.city !== '上海') {
      return en ? 'See you there.' : '到时见 ✨';
    }
    if (p.ticket_holder) return en ? 'Free for ticket holders. See you there.' : '持票人免费。到时见 ✨';
    if (p.attendance_mode === 'online') return en ? 'Free online. Tencent link will follow.' : '线上免费。会议链接稍后发到你的邮箱 / 微信。';
    const fee = ctx.onsite_fee || 0;
    if (fee > 0) return en ? `On-site fee ¥${fee}. Pay at venue.` : `现场缴费 ¥${fee}。`;
    return en ? 'Free entry. See you there.' : '免费入场。到时见 ✨';
  }
})();
