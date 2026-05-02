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
  // 活动卡片
  'event_card_click',
  'event_card_avatar_click',
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
 *  最多返回 1000 条（飞书单页上限是 500 + 翻页）
 */
export async function fetchRecentEvents({ days = 7, limit = 500 } = {}) {
  const appToken = process.env.FEISHU_APP_TOKEN;
  if (!appToken) throw new Error('FEISHU_APP_TOKEN 未配置');

  const token = await getAccessToken();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // 用 search 接口（支持 filter + sort）
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${EVENTS_TABLE_ID}/records/search?page_size=${Math.min(limit, 500)}`;
  const body = {
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: '时间戳', operator: 'isGreater', value: [String(since)] },
      ],
    },
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
  return data.data?.items || [];
}
