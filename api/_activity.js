/**
 * 活动数据层：解析 + 拉取
 * 给 get-activities / event-page / events-list / sitemap 共用
 */

import { getAccessToken } from './_feishu.js';

// ─────────── 纯解析函数（无 I/O）───────────

function tsToDate(ts) {
  if (!ts) return null;
  const d  = new Date(Number(ts));
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
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
  const act = {
    record_id: record.record_id,
    title:  getText(f['标题']) || '',
    date:   tsToDate(f['意向/确认举办日期']) || '',
    loc:    getText(f['地点']) || '',
    status: getSelect(f['目前状态']) || '',
    poster: getPoster(f['活动海报']),
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

  parseDesc(f['活动/项目描述'], act);
  return act;
}

// ─────────── 数据拉取（有 I/O）───────────

/** 拉单条活动；不存在返回 null；其他错误抛 Error */
export async function fetchActivity(recordId) {
  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${recordId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  // 飞书 record 不存在的常见错误码（防御式处理）
  if (data.code === 1254040 || data.code === 1254044 || res.status === 404) return null;
  if (data.code !== 0) throw new Error(`飞书读取失败 (${data.code}): ${data.msg}`);
  return parseRecord(data.data.record);
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
