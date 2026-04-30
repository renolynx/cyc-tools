/**
 * RSVP 数据层（飞书表 = FEISHU_RSVP_TABLE_ID，跟成员表同 base）
 *
 * 缓存：
 *   rsvp:activity:{activity_rec_id}  5min   单活动的全部报名记录
 */

import { getAccessToken } from './_feishu.js';
import { kvGet, kvSet, kvDel, isKvConfigured } from './_kv.js';

const APP_TOKEN = process.env.FEISHU_MEMBER_APP_TOKEN;
const TABLE_ID  = process.env.FEISHU_RSVP_TABLE_ID;

const KV_TTL = 300;  // 5min

// ─────────── 字段值解析 ───────────

function getText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(s => typeof s === 'string' ? s : (s.text || '')).join('').trim();
  if (typeof v === 'object') return v.text || '';
  return String(v).trim();
}

function getMultiSelect(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(it => typeof it === 'string' ? it : (it.text || it.name || '')).filter(Boolean);
  if (typeof v === 'string') return [v];
  return [];
}

function getRelationIds(v) {
  if (!v || typeof v !== 'object') return [];
  return v.link_record_ids || v.linked_record_ids || [];
}

// ─────────── 解析 ───────────

export function parseRsvp(record) {
  const f = record.fields || {};
  return {
    record_id:        record.record_id,
    name:             getText(f['姓名']),
    bio:              getText(f['个人简介']),
    activity_rec_id:  getText(f['关联活动ID']) || getText(f['关联活动 ID']),
    activity_title:   getText(f['关联活动名称']),
    roles:            getMultiSelect(f['角色']),
    wechat:           getText(f['微信号']),
    member_rec_id:    getText(f['关联成员ID']) || getText(f['关联成员 ID']),
    hubs:             getRelationIds(f['现在所在据点']),
    registered_at:    Number(f['注册时间']) || 0,
  };
}

// ─────────── 拉取 ───────────

/** 拉指定活动的所有 RSVP 记录（带缓存） */
export async function fetchRsvpsForActivity(activity_rec_id) {
  if (!activity_rec_id) return [];

  const cacheKey = 'rsvp:activity:' + activity_rec_id;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/search?page_size=500`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    }
  );
  const data = await res.json();
  if (data.code !== 0) {
    console.error('[fetchRsvpsForActivity]', data.msg);
    return [];
  }

  const all = (data.data?.items || []).map(parseRsvp);
  const filtered = all.filter(r => r.activity_rec_id === activity_rec_id);

  // 按报名时间倒序
  filtered.sort((a, b) => (b.registered_at || 0) - (a.registered_at || 0));

  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(filtered), KV_TTL); } catch {}
  }
  return filtered;
}

/** 同活动同微信号去重检查
 * 双层：先查 KV mark（强一致，避开飞书 search 索引延迟）
 * 没命中再查飞书 search（最终一致）
 */
export async function findExistingRsvp(activity_rec_id, wechat) {
  if (!activity_rec_id || !wechat) return null;

  // KV mark 优先：写入时同步打了 mark，立即生效
  if (isKvConfigured()) {
    try {
      const mark = await kvGet(seenKey(activity_rec_id, wechat));
      if (mark) {
        // mark 存的是 record_id；找不到 record 但已知报过 → 仍返回标记对象
        return { record_id: mark, name: '', wechat, _from_mark: true };
      }
    } catch {}
  }

  // KV 没 mark → 飞书 search（可能延迟几秒看不到刚写的记录）
  const list = await fetchRsvpsForActivity(activity_rec_id);
  const target = normalizeWechat(wechat);
  return list.find(r => normalizeWechat(r.wechat) === target) || null;
}

/** 删除某条 RSVP 记录（admin 用，调用方负责密码校验） */
export async function deleteRsvp(record_id, activity_rec_id, wechat) {
  if (!record_id) throw new Error('缺 record_id');
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${record_id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  // 1254040/1254044 = record 不存在；当作幂等成功
  if (data.code !== 0 && data.code !== 1254040 && data.code !== 1254044) {
    throw new Error(`RSVP 删除失败 (${data.code}): ${data.msg}`);
  }

  // 清缓存 + 清 KV mark
  if (isKvConfigured()) {
    const ops = [];
    if (activity_rec_id) ops.push(kvDel('rsvp:activity:' + activity_rec_id));
    if (activity_rec_id && wechat) ops.push(kvDel(seenKey(activity_rec_id, wechat)));
    await Promise.all(ops).catch(() => {});
  }
  return { success: true };
}

/** wechat 归一化（大小写不敏感、去前后空格） */
function normalizeWechat(wx) {
  return (wx || '').trim().toLowerCase();
}

/** KV 防重 key（用归一化后的 wechat） */
function seenKey(activity_rec_id, wechat) {
  return `rsvp_seen:${activity_rec_id}:${normalizeWechat(wechat)}`;
}

// ─────────── 写入 ───────────

/**
 * 写入新 RSVP 记录
 * data: { name, activity_rec_id, activity_title?, roles?, wechat, bio?, member_rec_id? }
 */
export async function addRsvp(data) {
  if (!data || !data.name || !data.activity_rec_id || !data.wechat) {
    throw new Error('缺必填字段（name / activity_rec_id / wechat）');
  }

  const fields = {};
  fields['姓名']         = data.name;
  fields['关联活动ID']    = data.activity_rec_id;
  if (data.activity_title) fields['关联活动名称'] = data.activity_title;
  fields['角色']         = data.roles && data.roles.length ? data.roles : ['活动参与者'];
  fields['微信号']        = data.wechat;
  if (data.bio)            fields['个人简介']     = data.bio;
  if (data.member_rec_id)  fields['关联成员ID']  = data.member_rec_id;

  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields }),
    }
  );
  const result = await res.json();
  if (result.code !== 0) throw new Error(`RSVP 写入失败 (${result.code}): ${result.msg}`);

  const newRecordId = result.data.record.record_id;

  // 1. 失效该活动报名列表缓存
  // 2. 打 KV mark 防重（强一致，规避飞书 search 索引延迟）
  if (isKvConfigured()) {
    await Promise.all([
      kvDel('rsvp:activity:' + data.activity_rec_id),
      kvSet(seenKey(data.activity_rec_id, data.wechat), newRecordId, 86400),  // 1 天 TTL
    ]).catch(() => {});
  }

  return { success: true, record_id: newRecordId };
}
