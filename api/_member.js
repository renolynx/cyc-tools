/**
 * 成员数据层（飞书 base = FEISHU_MEMBER_APP_TOKEN）
 *
 * 缓存策略：
 *   member:{id}        30min   单条成员（小，安全 < 1MB）
 *   members:{city}     30min   某城市的过滤子集（最多 ~600KB）
 *   locations:all      24h     据点字典表（4 条，极少变）
 *
 *   不缓存 members:all（2000+ 条估计 ~1.2MB，超 KV 单值上限）
 */

import { getAccessToken } from './_feishu.js';
import { kvGet, kvSet, kvDel, isKvConfigured } from './_kv.js';

const APP_TOKEN = process.env.FEISHU_MEMBER_APP_TOKEN;
const TABLE_ID  = process.env.FEISHU_MEMBER_TABLE_ID;
const LOC_TABLE = process.env.FEISHU_LOCATIONS_TABLE_ID;

const KV_TTL_LOCS    = 86400;   // 24h
const KV_TTL_CITY    = 1800;    // 30min
const KV_TTL_MEMBER  = 1800;    // 30min

// ─────────── 飞书字段值解析（小工具）───────────

function getText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(s => typeof s === 'string' ? s : (s.text || '')).join('').trim();
  if (typeof v === 'object') return v.text || '';
  return String(v).trim();
}

function getSelect(v) {
  if (!v) return '';
  if (typeof v === 'object' && v.text) return v.text;
  return String(v);
}

function getMultiSelect(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(it => typeof it === 'string' ? it : (it.text || it.name || '')).filter(Boolean);
  if (typeof v === 'string') return [v];
  return [];
}

function getCheckbox(v) { return Boolean(v); }

function getAttachment(v) {
  if (!Array.isArray(v) || !v.length) return null;
  const f = v[0];
  return { file_token: f.file_token, name: f.name, url: f.url, type: f.type };
}

function getRelationIds(v) {
  if (!v || typeof v !== 'object') return [];
  return v.link_record_ids || v.linked_record_ids || [];
}

// ─────────── 据点字典表 ───────────

/** 拉据点表 4 条，KV 缓存 24h；返回 [{ record_id, name, city }] */
export async function fetchLocations() {
  const cacheKey = 'locations:all';
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${LOC_TABLE}/records/search?page_size=100`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`据点表读取失败 (${data.code}): ${data.msg}`);

  const items = data.data?.items || [];
  // 据点表的字段名我们没确认，宽松匹配几种可能：
  const locations = items.map(r => {
    const f = r.fields || {};
    return {
      record_id: r.record_id,
      name: getText(f['据点']) || getText(f['据点名']) || getText(f['名称']) || getText(f['Name']) || '',
      city: getSelect(f['城市']) || getSelect(f['City']) || '',
    };
  });

  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(locations), KV_TTL_LOCS); } catch {}
  }
  return locations;
}

/** record_id → city 映射 */
async function buildLocationMap() {
  const locs = await fetchLocations();
  return Object.fromEntries(locs.map(l => [l.record_id, l.city]));
}

/** record_id → 据点名 映射 */
async function buildLocationNameMap() {
  const locs = await fetchLocations();
  return Object.fromEntries(locs.map(l => [l.record_id, l.name]));
}

// ─────────── Member 解析 ───────────

/**
 * 解析飞书 record → Member 对象
 * 私密字段（微信/电话/邮箱/身份证/生日/年龄/推荐人/706 链接/粉丝量）
 * 不进 Member，避免泄露
 */
export function parseMember(record, locMap = {}, locNameMap = {}) {
  const f = record.fields || {};
  const hubIds = getRelationIds(f['现在所在据点']);
  const cities = [...new Set(hubIds.map(id => locMap[id]).filter(Boolean))];
  const hubs   = hubIds.map(id => ({ id, city: locMap[id] || '', name: locNameMap[id] || '' }));

  return {
    record_id:    record.record_id,
    name:         getText(f['姓名']),
    nickname:     getText(f['称呼']),
    avatar:       getAttachment(f['照片']),
    bio:          getText(f['个人介绍']),
    job:          getText(f['职业描述']),
    company:      getText(f['公司|工作机构']),
    topics:       getText(f['关注的话题']),
    willShare:    getText(f['愿意做的分享']),
    interests:    getText(f['感兴趣的活动']),
    mbti:         getText(f['MBTI']),
    identity:     getMultiSelect(f['社群身份']),
    contribution: getMultiSelect(f['愿意做出的贡献（选择)']),
    residentStatus: getSelect(f['据点入住状态']),
    hubIds, hubs, cities,
    hidden:       getCheckbox(f['在社群成员列表中隐藏']),
    // ⚠️ 私密：仅供服务端 RSVP 匹配 / admin 编辑使用
    //    任何对外 SSR / JSON API 必须 strip 这些字段
    _wechat:      getText(f['微信号']),
  };
}

/** 把私密字段从 Member 对象剥掉（对外渲染前必须调） */
export function stripPrivate(member) {
  if (!member) return member;
  const { _wechat, ...safe } = member;
  return safe;
}

// ─────────── 数据拉取 ───────────

/** 拉所有成员 — 不缓存（2000+ 超 KV 单值上限） */
export async function fetchAllMembers() {
  const token  = await getAccessToken();
  const locMap     = await buildLocationMap();
  const locNameMap = await buildLocationNameMap();

  let all = [];
  let pageToken = '';
  for (let i = 0; i < 30; i++) {  // safety: 30×500=15000，远超 2000
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/search?page_size=500${pageToken ? '&page_token=' + pageToken : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:   JSON.stringify({}),
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`成员表拉取失败 (${data.code}): ${data.msg}`);

    all = all.concat((data.data?.items || []).map(r => parseMember(r, locMap, locNameMap)));
    if (!data.data?.has_more) break;
    pageToken = data.data.page_token || '';
    if (!pageToken) break;
  }
  return all;
}

/** 拉单个成员（带缓存） */
export async function fetchMember(rec_id) {
  if (!rec_id) return null;
  const cacheKey = 'member:' + rec_id;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${rec_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.code !== 0) {
    if (data.code >= 1254000 && data.code < 1255000) return null;
    throw new Error(`成员读取失败 (${data.code}): ${data.msg}`);
  }

  const locMap     = await buildLocationMap();
  const locNameMap = await buildLocationNameMap();
  const member = parseMember(data.data.record, locMap, locNameMap);

  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(member), KV_TTL_MEMBER); } catch {}
  }
  return member;
}

/** 按城市拉公开成员（hidden=false + cities 含指定城市） */
export async function fetchMembersByCity(city) {
  if (!city) return [];
  const cacheKey = 'members:' + city;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const all = await fetchAllMembers();
  const filtered = all.filter(m => !m.hidden && m.cities.includes(city));

  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(filtered), KV_TTL_CITY); } catch (err) {
      console.warn(`[fetchMembersByCity] cache failed (size?):`, err.message);
    }
  }
  return filtered;
}

/** 全字段模糊搜索（admin 用，不缓存） */
export async function searchMembers(query, opts = {}) {
  const all = await fetchAllMembers();
  const q = String(query || '').toLowerCase().trim();
  const candidates = opts.includeHidden ? all : all.filter(m => !m.hidden);
  if (!q) return candidates.slice(0, 50);

  return candidates.filter(m =>
    [m.name, m.nickname, m.bio, m.job, m.company, m.topics, m.willShare, m.interests]
      .some(s => s && s.toLowerCase().includes(q))
  ).slice(0, 50);
}

/**
 * 微信号精确匹配（大小写不敏感、trim）
 * RSVP 报名时优先调这个 → 唯一性最高
 */
export async function findMemberByWechat(wechat) {
  if (!wechat) return null;
  const target = String(wechat).trim().toLowerCase();
  if (!target) return null;
  const all = await fetchAllMembers();
  return all.find(m => (m._wechat || '').trim().toLowerCase() === target) || null;
}

/**
 * 嘉宾匹配：先匹配称呼，回退姓名
 * 用于活动详情页"嘉宾"卡 → 链 profile
 */
export async function findMemberByName(name) {
  const all = await fetchAllMembers();
  const target = String(name || '').trim();
  if (!target) return null;

  // 1. 称呼精确等
  let hit = all.find(m => m.nickname && m.nickname.trim() === target);
  if (hit) return hit;
  // 2. 姓名精确等
  hit = all.find(m => m.name && m.name.trim() === target);
  if (hit) return hit;
  // 3. 称呼包含
  hit = all.find(m => m.nickname && m.nickname.includes(target));
  if (hit) return hit;
  return null;
}

// ─────────── 写入 ───────────

/**
 * 写入 / 更新成员（admin 用，调用方负责密码校验）
 * memberData 字段名用 Member 对象格式（name / nickname / bio / ...）
 * recordId 不传 = 新建；传 = 更新
 */
export async function writeMember(memberData, recordId) {
  const fields = {};
  if (memberData.name !== undefined)       fields['姓名'] = memberData.name;
  if (memberData.nickname !== undefined)   fields['称呼'] = memberData.nickname;
  if (memberData.bio !== undefined)        fields['个人介绍'] = memberData.bio;
  if (memberData.job !== undefined)        fields['职业描述'] = memberData.job;
  if (memberData.company !== undefined)    fields['公司|工作机构'] = memberData.company;
  if (memberData.wechat !== undefined)     fields['微信号'] = memberData.wechat;
  if (memberData.hidden !== undefined)     fields['在社群成员列表中隐藏'] = Boolean(memberData.hidden);
  if (memberData.hubIds !== undefined)     fields['现在所在据点'] = memberData.hubIds;
  if (memberData.residentStatus !== undefined) fields['据点入住状态'] = memberData.residentStatus;
  if (memberData.willShare !== undefined)  fields['愿意做的分享'] = memberData.willShare;
  if (memberData.interests !== undefined)  fields['感兴趣的活动'] = memberData.interests;
  if (memberData.topics !== undefined)     fields['关注的话题'] = memberData.topics;
  if (memberData.mbti !== undefined)       fields['MBTI'] = memberData.mbti;

  const token = await getAccessToken();
  const url = recordId
    ? `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${recordId}`
    : `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`;
  const res = await fetch(url, {
    method:  recordId ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`成员${recordId?'更新':'写入'}失败 (${data.code}): ${data.msg}`);

  // 失效相关缓存
  if (isKvConfigured()) {
    const newId = data.data.record.record_id;
    await Promise.all([
      kvDel('member:' + newId),
      kvDel('members:大理'),
      kvDel('members:上海'),
    ]).catch(() => {});
  }

  return {
    success:   true,
    record_id: data.data.record.record_id,
    is_update: Boolean(recordId),
  };
}
