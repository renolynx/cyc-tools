/**
 * RSVP 数据层（飞书表 = FEISHU_RSVP_TABLE_ID，跟成员表同 base）
 *
 * 缓存：
 *   rsvp:activity:{activity_rec_id}  5min   单活动的全部报名记录
 */

import { getAccessToken } from './_feishu.js';
import { kvGet, kvSet, kvDel, isKvConfigured, invalidate } from './_kv.js';

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

/** 拉全表所有 RSVP（用于聚合统计、按成员推断活动城市等） */
export async function fetchAllRsvps() {
  const cacheKey = 'rsvp:all';
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const token = await getAccessToken();
  let all = [];
  let pageToken = '';
  for (let i = 0; i < 30; i++) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/search?page_size=500${pageToken ? '&page_token=' + pageToken : ''}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`RSVP 全量拉取失败: ${data.msg}`);
    all = all.concat((data.data?.items || []).map(parseRsvp));
    if (!data.data?.has_more) break;
    pageToken = data.data.page_token || '';
    if (!pageToken) break;
  }

  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(all), 600); } catch {} // 10min
  }
  return all;
}

/** 拉某成员所有 RSVP 记录（成员主页用）：含已发起 / 嘉宾 / 参与
 *  缓存 10 min，按报名时间倒序；opts.bypassCache=true 强制重拉
 */
export async function fetchRsvpsByMember(member_rec_id, opts = {}) {
  if (!member_rec_id) return [];
  const cacheKey = 'rsvp:member:' + member_rec_id;
  if (!opts.bypassCache && isKvConfigured()) {
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
    console.error('[fetchRsvpsByMember]', data.msg);
    return [];
  }

  const all = (data.data?.items || []).map(parseRsvp);
  const filtered = all.filter(r => r.member_rec_id === member_rec_id);
  filtered.sort((a, b) => (b.registered_at || 0) - (a.registered_at || 0));

  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(filtered), 600); } catch {}
  }
  return filtered;
}

/** 同活动同微信号去重检查
 * 双层 + self-heal：
 *   1. KV mark（强一致，规避飞书 search 索引延迟）
 *   2. 命中 mark → 验证 mark 指向的 record 还存在（飞书可能已被删）
 *      不存在 → 清 stale mark + fall through 到 search
 *   3. 飞书 search（最终一致）
 */
export async function findExistingRsvp(activity_rec_id, wechat) {
  if (!activity_rec_id || !wechat) return null;

  // 1. KV mark
  if (isKvConfigured()) {
    try {
      const mark = await kvGet(seenKey(activity_rec_id, wechat));
      if (mark) {
        // 验证 mark 指向的 record 还在飞书表
        const record = await fetchRsvpByRecordId(mark);
        if (record) return record;
        // record 已被删 → 清 stale mark
        try { await kvDel(seenKey(activity_rec_id, wechat)); } catch {}
        // 不 return，fall through 到 search
      }
    } catch (err) {
      console.warn('[findExistingRsvp] KV mark 验证失败:', err.message);
    }
  }

  // 2. 飞书 search
  const list = await fetchRsvpsForActivity(activity_rec_id);
  const target = normalizeWechat(wechat);
  return list.find(r => normalizeWechat(r.wechat) === target) || null;
}

/** 按 record_id 拉单条 RSVP（用于自助取消验证身份）；找不到返回 null */
export async function fetchRsvpByRecordId(record_id) {
  if (!record_id) return null;
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${record_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.code !== 0) {
    if (data.code >= 1254000 && data.code < 1255000) return null;
    throw new Error(`RSVP 读取失败 (${data.code}): ${data.msg}`);
  }
  return parseRsvp(data.data.record);
}

/**
 * 删除某条 RSVP 记录
 * 调用方负责密码 / 自助身份校验。
 * 内部主动 fetch record 拿真实 wechat / activity_rec_id 用于清 KV mark
 *   → 即便 admin mode 不传 wechat，mark 也能被正确清掉
 */
export async function deleteRsvp(record_id) {
  if (!record_id) throw new Error('缺 record_id');

  // 先 fetch 拿真实 wechat 和 activity_rec_id
  let recordWechat = '';
  let recordActivityId = '';
  try {
    const r = await fetchRsvpByRecordId(record_id);
    if (r) {
      recordWechat = r.wechat || '';
      recordActivityId = r.activity_rec_id || '';
    }
  } catch (err) {
    console.warn('[deleteRsvp] fetch before delete failed:', err.message);
  }

  // 删飞书记录
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

  // 清缓存（通用 scope 一行解决；KV mark 是单独的防重逻辑，仍需手动清）
  await invalidate('rsvp', recordActivityId);
  if (isKvConfigured() && recordActivityId && recordWechat) {
    try { await kvDel(seenKey(recordActivityId, recordWechat)); } catch {}
  }
  return { success: true, cleared_wechat: !!recordWechat };
}

/**
 * 把一条 RSVP 的「关联成员ID」改指向另一个成员（用于合并成员场景）
 * 可选同步覆盖姓名 / 个人简介字段（合并悠扬→悠洋后让 RSVP 显示新名字）
 *
 * 第二参数支持两种形式：
 *   updateRsvpMemberLink(rid, 'rec_xxx')                            旧签名
 *   updateRsvpMemberLink(rid, { member_rec_id, name?, bio? })       扩展签名
 */
export async function updateRsvpMemberLink(record_id, payloadOrId) {
  if (!record_id) throw new Error('缺 record_id');
  const fields = {};
  if (typeof payloadOrId === 'string' || payloadOrId == null) {
    fields['关联成员ID'] = payloadOrId || '';
  } else {
    if (payloadOrId.member_rec_id !== undefined) fields['关联成员ID'] = payloadOrId.member_rec_id || '';
    if (payloadOrId.name           !== undefined) fields['姓名']      = payloadOrId.name || '';
    if (payloadOrId.bio            !== undefined) fields['个人简介']  = payloadOrId.bio  || '';
  }
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${record_id}`,
    {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`RSVP 重链失败 (${data.code}): ${data.msg}`);
  return true;
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
 * data: { name, activity_rec_id, activity_title?, roles?, wechat?, bio?, member_rec_id? }
 *
 * wechat 可选：嘉宾联动写入时活动录入界面没有微信号字段；普通报名时由调用端保证非空
 * （/api/rsvp 端点自己校验）。wechat 为空时不写「微信号」字段，也不打去重 KV mark。
 */
export async function addRsvp(data) {
  if (!data || !data.name || !data.activity_rec_id) {
    throw new Error('缺必填字段（name / activity_rec_id）');
  }

  const fields = {};
  fields['姓名']         = data.name;
  fields['关联活动ID']    = data.activity_rec_id;
  if (data.activity_title) fields['关联活动名称'] = data.activity_title;
  fields['角色']         = data.roles && data.roles.length ? data.roles : ['活动参与者'];
  if (data.wechat)         fields['微信号']      = data.wechat;
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

  // 1. 失效相关缓存（含 members:* 因为推断的城市/角色可能变）
  await invalidate('rsvp', data.activity_rec_id, data.member_rec_id);
  // 2. 打 KV mark 防重（强一致，规避飞书 search 索引延迟）—— 仅当 wechat 非空时
  if (data.wechat && isKvConfigured()) {
    try { await kvSet(seenKey(data.activity_rec_id, data.wechat), newRecordId, 86400); } catch {}
  }

  return { success: true, record_id: newRecordId };
}

/**
 * 同步活动嘉宾 RSVP（新建 / 编辑活动后调用）
 *   1. 拉该活动现有所有 RSVP，删除「角色含 活动发起者」的旧条
 *   2. 按 speakers 数组写新条（wechat 不传，去重靠"活动+角色+姓名"语义）
 *
 * speakers: [{ name, bio, member_rec_id? }]
 *   member_rec_id 由调用端预先用 findMemberByName 解析；没匹配上就不传
 *
 * 返回 { written, removed, names_unmatched }
 *   失败抛错；调用端通常 catch 后不阻塞主流程
 */
export async function replaceSpeakerRsvps(activity_rec_id, activity_title, speakers) {
  if (!activity_rec_id) throw new Error('缺 activity_rec_id');
  const list = Array.isArray(speakers) ? speakers.filter(s => s && s.name) : [];

  // 1. 删旧的发起者
  const existing = await fetchRsvpsForActivity(activity_rec_id);
  const stale    = existing.filter(r => Array.isArray(r.roles) && r.roles.includes('活动发起者'));
  let removed    = 0;
  for (const r of stale) {
    try { await deleteRsvp(r.record_id); removed++; } catch (err) {
      console.warn('[replaceSpeakerRsvps] delete failed:', err.message);
    }
  }

  // 2. 写新的
  let written = 0;
  const names_unmatched = [];
  for (const s of list) {
    try {
      await addRsvp({
        name:           s.name,
        activity_rec_id,
        activity_title: activity_title || '',
        roles:          ['活动发起者'],
        bio:            s.bio || '',
        member_rec_id:  s.member_rec_id || '',
      });
      written++;
      if (!s.member_rec_id) names_unmatched.push(s.name);
    } catch (err) {
      console.warn('[replaceSpeakerRsvps] add failed:', err.message);
      names_unmatched.push(s.name);
    }
  }

  return { written, removed, names_unmatched };
}
