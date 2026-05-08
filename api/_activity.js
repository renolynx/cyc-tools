/**
 * 活动数据层：解析 + 拉取
 * 给 get-activities / event-page / events-list / sitemap 共用
 */

import { getAccessToken } from './_feishu.js';

/**
 * dayrise v4.2 时段渐变占位（[[08 dayrise-os v4.2 时段渐变占位提案]]）
 * v4.2.5 调整（2026-05-09）：4 段 → 5 段 + 修 full-width colon bug
 *
 * 把活动开始时间映射到 5 段大理日色 utility class：
 *   < 11:30      morning   清晨（暖金日光 + 蓝灰天）
 *   11:30-15:00  noon      中午头（清亮金顶 + 浅天蓝）
 *   15:00-17:00  dusk      下午夕阳（暖金光 + 浅暖蓝灰）
 *   17:00-20:00  evening   夕阳到浅夜（强落日橙 → 深暮蓝紫）
 *   ≥ 20:00 / < 5:00  night 深夜（月光 → 深 erhai 水底）
 *
 * regex 同时认半角 `:` 和全角 `：` 冒号。
 * 跨夜活动按开始时间。无时间或解析失败 → noon (中性 fallback)。
 *
 * 用法：renderCard 时如海报缺失，给容器加 cycTimeClass(act.time) 类。
 */
export function cycTimeClass(timeStr) {
  // 兼容半角 / 全角冒号 + 可选 minute
  const m = String(timeStr || '').match(/^(\d{1,2})\s*[：:](\d{1,2})?/);
  if (!m) return 'cyc-time-noon';
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (isNaN(h)) return 'cyc-time-noon';
  const t = h + (isNaN(min) ? 0 : min) / 60;
  if (t < 5)    return 'cyc-time-night';
  if (t < 11.5) return 'cyc-time-morning';
  if (t < 15)   return 'cyc-time-noon';
  if (t < 17)   return 'cyc-time-dusk';
  if (t < 20)   return 'cyc-time-evening';
  return 'cyc-time-night';
}

// ─────────── 纯解析函数（无 I/O）───────────

function tsToDate(ts) {
  if (!ts) return null;
  const d  = new Date(Number(ts));
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

const _CN_DAYS = ['周日','周一','周二','周三','周四','周五','周六'];

/**
 * YYYY-MM-DD → "M 月 D 日 · 周X"
 * 避开服务器时区（Vercel 默认 UTC），纯字符串解析。
 */
export function formatCnDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return '';
  // Date.UTC 是纯算术，getUTCDay 也不被本地时区影响
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m} 月 ${d} 日 · ${_CN_DAYS[dow]}`;
}

/** 北京时间今天的日期字符串 YYYY-MM-DD */
export function todayBJ() {
  const bj = new Date(Date.now() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

function getText(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map(s => s.text || '').join('');
  return String(v);
}

function getSelect(v) {
  if (!v) return '';
  if (typeof v === 'object' && v.text) return v.text;
  return String(v);
}

function getPoster(v) {
  if (!Array.isArray(v) || !v.length) return null;
  const f = v[0];
  return { file_token: f.file_token, name: f.name, url: f.url, type: f.type };
}

function getMultiSelect(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(it => typeof it === 'string' ? it : (it.text || it.name || '')).filter(Boolean);
  if (typeof v === 'string') return [v];
  return [];
}

// 飞书 Url 字段格式：{ link: 'https://...', text: '显示文本' }
function getUrl(v) {
  if (!v) return '';
  if (typeof v === 'object') return v.link || v.text || '';
  return String(v);
}

function parseDesc(raw, activity) {
  if (!raw) return;
  const text = Array.isArray(raw) ? raw.map(s => s.text || '').join('') : String(raw);
  const lines = text.split('\n');
  const descLines = [];
  const flowLines = [];
  let inFlow = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('⏰ 时间：'))  { activity.time   = t.replace('⏰ 时间：', '');  continue; }
    if (t.startsWith('💰 费用：'))  { activity.fee    = t.replace('💰 费用：', '');  continue; }
    if (t.startsWith('🙋 报名：'))  { activity.signup = t.replace('🙋 报名：', '');  continue; }
    if (t.startsWith('🗓️ 流程：')) { inFlow = true; continue; }
    if (inFlow) { flowLines.push(t); continue; }
    descLines.push(t);
  }
  activity.desc = descLines.join('\n');
  activity.flow = flowLines;
}

/** 单条飞书 record → 工具用 activity 对象 */
export function parseRecord(record) {
  const f = record.fields || {};
  // 「是否对外开放」单选字段；飞书表里没建该字段或值为空 → 默认对外开放（向后兼容）
  // 仅当字段存在且明确为「仅成员」时 is_public=false
  const openness = getSelect(f['是否对外开放']);
  const act = {
    record_id: record.record_id,
    title:  getText(f['标题']) || '',
    date:   tsToDate(f['意向/确认举办日期']) || '',
    loc:    getText(f['地点']) || '',
    status: getSelect(f['目前状态']) || '',
    is_public: openness !== '仅成员',
    poster: getPoster(f['活动海报']),
    types:  getMultiSelect(f['活动类型']),  // multi-select；飞书表里没建该字段时为空数组
    time: '', fee: '', signup: '', desc: '',
    flow: [], spk: [],
  };

  const spkRaw = getText(f['发起者']);
  if (spkRaw) {
    act.spk = spkRaw.split('\n')
      .map(line => {
        const idx  = line.indexOf('，');
        const name = idx >= 0 ? line.slice(0, idx).trim() : line.trim();
        const bio  = idx >= 0 ? line.slice(idx + 1).trim() : '';
        return { name, bio };
      })
      .filter(s => s.name);
  }

  // 706 × muShanghai 双城/双语扩展字段（大理活动这些字段为空，渲染端按 city 走条件分支）
  act.city                = getSelect(f['city']) || '';
  act.series              = getSelect(f['series']) || '';
  act.title_en            = getText(f['title_en']) || '';
  act.desc_en             = getText(f['desc_en']) || '';
  act.location_en         = getText(f['location_en']) || '';
  act.luma_url            = getUrl(f['luma_url']);
  act.tencent_meeting_url = getUrl(f['tencent_meeting_url']);
  act.onsite_fee          = Number(f['onsite_fee']) || 0;
  act.attendance_modes    = getMultiSelect(f['attendance_modes']);

  parseDesc(f['活动/项目描述'], act);
  return act;
}

// ─────────── 数据拉取（有 I/O）───────────

/** 拉单条活动；不存在返回 null；只在真正异常（鉴权/网络）时抛 Error */
export async function fetchActivity(recordId) {
  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  const token = await getAccessToken();  // 鉴权失败这里会抛
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${recordId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;

  let data;
  try { data = await res.json(); } catch { return null; }

  if (data.code === 0) return parseRecord(data.data.record);

  // 1254xxx 是 bitable 业务错误：record 不存在 / 无权限 / 字段错 等
  // 全部视为"找不到"返回 null，避免详情页报 500
  if (data.code >= 1254000 && data.code < 1255000) {
    console.warn(`[fetchActivity] record ${recordId} → ${data.code}: ${data.msg}`);
    return null;
  }
  // 其他错误（鉴权类 99991xxx 等）才真抛
  throw new Error(`飞书读取失败 (${data.code}): ${data.msg}`);
}

/** 拉最近 100 条活动（按日期倒序），全部 parsed */
export async function fetchAllActivities() {
  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/search?page_size=100`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sort: [{ field_name: '意向/确认举办日期', desc: true }] }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书搜索失败 (${data.code}): ${data.msg}`);
  return (data.data?.items || []).map(parseRecord);
}
