/**
 * 事件采集（埋点）helper
 *
 * 飞书 Bitable 表：「事件流」
 *   app_token: process.env.FEISHU_APP_TOKEN（与活动表同 app）
 *   table_id:  tbl8SKvRXMMJmChI（建于 2026-05-02）
 *
 * 字段：
 *   时间戳 (DateTime, primary) · 事件 (Text) · 页面 (Text)
 *   session_id (Text) · 元数据 (Text · JSON) · referrer (Text)
 *   utm_source (Text) · utm_campaign (Text)
 */

import { getAccessToken } from './_feishu.js';

export const EVENTS_TABLE_ID = 'tbl8SKvRXMMJmChI';

/** 允许的事件名（防止 schema 漂移；新事件要加到这里）*/
export const KNOWN_EVENTS = new Set([
  // 首页 / 着陆
  'page_view',
  'visitor_strip_click',
  'cta_create_event',
  'hero_path_a_click',          // 首页双海报 A（介绍 → /about）
  'hero_path_b_click',          // 首页双海报 B（订房 → /rooms）
  // 活动卡片
  'event_card_click',
  'event_card_avatar_click',
  'event_card_poster_click',     // 点海报 → lightbox
  // 活动详情页
  'event_detail_view',
  'rsvp_click',
  'open_pill_seen',          // "对外开放"标签曝光
  'share_prompt_seen',        // #cyc 分享提示曝光
  // 社区
  'community_view',
  'community_admin_click',
  'profile_view',
  // admin
  'admin_dashboard_view',
  'instrumentation_view',
]);

/** 写一条事件到飞书 Bitable */
export async function writeEvent({
  event,
  page = '',
  session_id = '',
  metadata = null,
  referrer = '',
  utm_source = '',
  utm_campaign = '',
}) {
  if (!event) throw new Error('event 必填');

  const appToken = process.env.FEISHU_APP_TOKEN;
  if (!appToken) throw new Error('FEISHU_APP_TOKEN 未配置');

  const token = await getAccessToken();

  const fields = {
    '时间戳':       Date.now(),                          // 飞书 DateTime 接受毫秒时间戳
    '事件':         String(event).slice(0, 64),
    '页面':         String(page).slice(0, 256),
    'session_id':   String(session_id).slice(0, 64),
    '元数据':       metadata ? JSON.stringify(metadata).slice(0, 2000) : '',
    'referrer':     String(referrer).slice(0, 256),
    'utm_source':   String(utm_source).slice(0, 64),
    'utm_campaign': String(utm_campaign).slice(0, 64),
  };

  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${EVENTS_TABLE_ID}/records`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const data = await res.json();
  if (data.code !== 0) throw new Error(`埋点写入失败 (${data.code}): ${data.msg}`);
  return data.data?.record;
}

/** 拉最近 N 天事件用于 dashboard
 *  返回 [{record_id, fields:{...}}, ...] 按时间倒序
 *
 *  实现说明：飞书 search API 的 DateTime filter 在 type=5 字段上格式很挑剔
 *  （1254018 InvalidFilter）。索性服务端只 sort 不 filter，500 条拉回来
 *  客户端按 since 过滤。当前规模够用（每天事件量级 < 几百条）。
 */
export async function fetchRecentEvents({ days = 7, limit = 500 } = {}) {
  const appToken = process.env.FEISHU_APP_TOKEN;
  if (!appToken) throw new Error('FEISHU_APP_TOKEN 未配置');

  const token = await getAccessToken();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${EVENTS_TABLE_ID}/records/search?page_size=${Math.min(limit, 500)}`;
  const body = {
    sort: [{ field_name: '时间戳', desc: true }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.code !== 0) throw new Error(`事件拉取失败 (${data.code}): ${data.msg}`);

  const items = data.data?.items || [];

  // 客户端过滤 since 时间（避免飞书 DateTime filter 1254018）
  return items.filter((it) => {
    const ts = it.fields?.['时间戳'];
    if (!ts) return false;
    return Number(ts) >= since;
  });
}
