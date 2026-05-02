/**
 * cyc-track.js — cyc.center 前端埋点 SDK
 *
 * 用法:
 *   <script src="/cyc-track.js" defer></script>
 *   然后 window.cycTrack('event_name', { meta: 'data' }) 即可。
 *
 * 自动行为:
 *   - 页面加载时自动发 page_view 事件
 *   - 给所有 [data-track="event_name"] 元素挂 click 事件自动发
 *   - 把 URL 里的 utm_source / utm_campaign 自动带上
 *
 * 设计:
 *   - 一个 session_id（localStorage，30 天过期）
 *   - sendBeacon 优先（fire-and-forget，页面跳走也能发出去）
 *   - 失败完全静默（埋点崩了不影响产品）
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/track';
  const SESSION_KEY = 'cyc_sid';
  const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;  // 30 天

  // ─────────── session_id ───────────
  function getSessionId() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.id && Date.now() - obj.t < SESSION_TTL) return obj.id;
      }
    } catch {}
    const id = 'sid_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id, t: Date.now() })); } catch {}
    return id;
  }

  // ─────────── UTM ───────────
  function getUtm() {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        utm_source: params.get('utm_source') || '',
        utm_campaign: params.get('utm_campaign') || '',
      };
    } catch { return { utm_source: '', utm_campaign: '' }; }
  }

  // ─────────── 发送 ───────────
  function send(payload) {
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }

  // ─────────── 主 API ───────────
  const session_id = getSessionId();
  const utm = getUtm();

  function track(event, metadata) {
    if (!event) return;
    send({
      event,
      page: window.location.pathname + window.location.search,
      session_id,
      metadata: metadata || null,
      referrer: document.referrer || '',
      utm_source: utm.utm_source,
      utm_campaign: utm.utm_campaign,
    });
  }

  window.cycTrack = track;

  // ─────────── 自动: page_view ───────────
  // DOMContentLoaded 后立即发，确保不丢
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => track('page_view'));
  } else {
    track('page_view');
  }

  // ─────────── 自动: [data-track] 元素 ───────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    const event = el.getAttribute('data-track');
    let meta = null;
    const metaAttr = el.getAttribute('data-track-meta');
    if (metaAttr) {
      try { meta = JSON.parse(metaAttr); } catch { meta = { raw: metaAttr }; }
    }
    track(event, meta);
  }, { capture: true });
})();
