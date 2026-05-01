/**
 * 照片数据层（飞书 cyc-photos 表 + Vercel Blob）
 *
 *   存储分工：
 *     - 图片本体 → Vercel Blob（公开 CDN URL）
 *     - 元数据   → 飞书 cyc-photos 表（成员 base 内）
 *
 *   缓存策略：
 *     photos:member:{rec_id}   5min   某成员的全部照片
 *     photos:public            5min   全员公开照片（公共回忆页用）
 *     photo_count:{rec_id}     5min   配额计数（写入/删除时清）
 *     photo_quota:{rec_id}     永久   admin 设的个性配额（覆盖默认 5）
 */

import { getAccessToken } from './_feishu.js';
import { kvGet, kvSet, kvDel, isKvConfigured } from './_kv.js';

const APP_TOKEN  = process.env.FEISHU_MEMBER_APP_TOKEN;
const TABLE_ID   = process.env.FEISHU_PHOTOS_TABLE_ID || 'tblsxsPPy9LMEbm8';
const MEMBER_TBL = process.env.FEISHU_MEMBER_TABLE_ID;

const KV_TTL_LIST  = 300;    // 5min
const KV_TTL_COUNT = 300;
const DEFAULT_PHOTO_QUOTA = 5;

// ─────────── 飞书字段值解析 ───────────

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
function getCheckbox(v) { return Boolean(v); }
function getRelationIds(v) {
  if (!v) return [];
  // 飞书 SingleLink 字段可能返回数组形式（每项含 record_ids），也可能是对象
  // （含 link_record_ids 数组）。兼容两种。
  if (Array.isArray(v)) {
    const out = [];
    for (const item of v) {
      if (typeof item === 'string') out.push(item);
      else if (item && typeof item === 'object') {
        if (Array.isArray(item.record_ids)) out.push(...item.record_ids);
        else if (item.id) out.push(item.id);
      }
    }
    return out;
  }
  if (typeof v === 'object') {
    return v.link_record_ids || v.linked_record_ids || v.record_ids || [];
  }
  return [];
}

/** 飞书 record → Photo 对象（公开输出格式） */
export function parsePhoto(record) {
  const f = record.fields || {};
  const uploaderIds = getRelationIds(f['上传者']);
  return {
    record_id:     record.record_id,
    title:         getText(f['标题']) || '未命名',
    blob_url:      getText(f['Blob URL']),
    blob_pathname: getText(f['Blob Pathname']),
    uploader_rec_id: uploaderIds[0] || '',
    activity_id:   getText(f['关联活动ID']) || '',
    activity_title:getText(f['关联活动名称']) || '',
    description:   getText(f['描述']),
    taken_at:      Number(f['拍摄日期']) || 0,        // 毫秒时间戳
    uploaded_at:   Number(f['上传时间']) || 0,
    privacy:       getSelect(f['隐私']) === '仅自己' ? 'self' : 'public',
    review_status: getSelect(f['审核状态']) || '通过',
    featured:      getCheckbox(f['精选']),
  };
}

// ─────────── 配额 ───────────

/** 读某成员的配额上限：KV 覆盖值优先，否则用代码默认 5 */
export async function getQuota(member_rec_id) {
  if (!member_rec_id) return DEFAULT_PHOTO_QUOTA;
  if (isKvConfigured()) {
    try {
      const v = await kvGet('photo_quota:' + member_rec_id);
      if (v != null && v !== '') return Number(v) || DEFAULT_PHOTO_QUOTA;
    } catch {}
  }
  return DEFAULT_PHOTO_QUOTA;
}

/** admin 设置某成员的配额（kvSet；0 = 禁止上传，999 = 实质无限） */
export async function setQuota(member_rec_id, quota) {
  if (!member_rec_id) throw new Error('缺 member_rec_id');
  if (!isKvConfigured()) throw new Error('KV 未配置');
  await kvSet('photo_quota:' + member_rec_id, String(Number(quota) || 0));
}

/** 数当前已上传数（含"仅自己"，和"已下线" 不算因为算下线的位置已释放） */
export async function countPhotos(member_rec_id) {
  if (!member_rec_id) return 0;
  const cacheKey = 'photo_count:' + member_rec_id;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached != null) return Number(cached);
    } catch {}
  }
  const photos = await fetchPhotosByMember(member_rec_id, { skipCache: true });
  // 计入：未下线的（review_status === '通过'）。"已下线"的位置释放。
  const count = photos.filter(p => p.review_status !== '已下线').length;
  if (isKvConfigured()) {
    try { await kvSet(cacheKey, String(count), KV_TTL_COUNT); } catch {}
  }
  return count;
}

// ─────────── 拉取 ───────────

/** 拉某成员的全部照片 */
export async function fetchPhotosByMember(member_rec_id, options = {}) {
  if (!member_rec_id) return [];
  const cacheKey = 'photos:member:' + member_rec_id;
  if (!options.skipCache && isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/search?page_size=200`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        filter: {
          conjunction: 'and',
          conditions: [
            { field_name: '上传者', operator: 'contains', value: [member_rec_id] },
          ],
        },
        sort: [{ field_name: '拍摄日期', desc: true }],
      }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`照片拉取失败 (${data.code}): ${data.msg}`);

  const items = (data.data?.items || []).map(parsePhoto);
  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(items), KV_TTL_LIST); } catch {}
  }
  return items;
}

/** 拉所有公开照片（公共回忆聚合页用） */
export async function fetchPublicPhotos() {
  const cacheKey = 'photos:public';
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
      body:    JSON.stringify({
        filter: {
          conjunction: 'and',
          conditions: [
            { field_name: '隐私', operator: 'is', value: ['公开'] },
            { field_name: '审核状态', operator: 'is', value: ['通过'] },
          ],
        },
        sort: [{ field_name: '拍摄日期', desc: true }],
      }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`公开照片拉取失败 (${data.code}): ${data.msg}`);

  const items = (data.data?.items || []).map(parsePhoto);
  if (isKvConfigured()) {
    try { await kvSet(cacheKey, JSON.stringify(items), KV_TTL_LIST); } catch {}
  }
  return items;
}

/** 单个照片（用于编辑 / 删除前确认权限） */
export async function fetchPhoto(record_id) {
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
    throw new Error(`照片读取失败 (${data.code}): ${data.msg}`);
  }
  return parsePhoto(data.data.record);
}

// ─────────── 写入 ───────────

/**
 * 创建照片记录
 *   data: { title, blob_url, blob_pathname, uploader_rec_id, activity_id?,
 *           activity_title?, description?, taken_at (ms), privacy ('public'|'self') }
 */
export async function createPhoto(data) {
  if (!data || !data.uploader_rec_id) throw new Error('缺 uploader_rec_id');
  if (!data.blob_url || !data.blob_pathname) throw new Error('缺 blob 信息');

  const fields = {
    '标题':         data.title || '未命名',
    'Blob URL':     data.blob_url,
    'Blob Pathname':data.blob_pathname,
    '上传者':       [data.uploader_rec_id],     // SingleLink 数组形式
    '关联活动ID':   data.activity_id || '',
    '关联活动名称': data.activity_title || '',
    '描述':         data.description || '',
    '拍摄日期':     Number(data.taken_at) || Date.now(),
    '隐私':         data.privacy === 'self' ? '仅自己' : '公开',
    '审核状态':     '通过',          // B1：默认通过，admin 可手动改"已下线"
  };

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
  if (result.code !== 0) throw new Error(`照片写入失败 (${result.code}): ${result.msg}`);

  // 清相关 cache
  await invalidatePhotoCache(data.uploader_rec_id);

  return parsePhoto(result.data.record);
}

/** 更新照片（仅本人可改 — 调用方 enforce 鉴权） */
export async function updatePhoto(record_id, member_rec_id, patch) {
  if (!record_id) throw new Error('缺 record_id');

  const fields = {};
  if (patch.title !== undefined)        fields['标题'] = patch.title || '未命名';
  if (patch.description !== undefined)  fields['描述'] = patch.description || '';
  if (patch.taken_at !== undefined)     fields['拍摄日期'] = Number(patch.taken_at) || Date.now();
  if (patch.activity_id !== undefined)  fields['关联活动ID'] = patch.activity_id || '';
  if (patch.activity_title !== undefined) fields['关联活动名称'] = patch.activity_title || '';
  if (patch.privacy !== undefined)      fields['隐私'] = patch.privacy === 'self' ? '仅自己' : '公开';

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
  if (data.code !== 0) throw new Error(`照片更新失败 (${data.code}): ${data.msg}`);

  await invalidatePhotoCache(member_rec_id);
  return parsePhoto(data.data.record);
}

/** 删除照片记录（不删 Blob — Blob 由调用方决定是否删，因为删 blob 可能失败但 record 已没） */
export async function deletePhotoRecord(record_id, member_rec_id) {
  if (!record_id) throw new Error('缺 record_id');
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${record_id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.code !== 0 && data.code !== 1254040 && data.code !== 1254044) {
    throw new Error(`照片删除失败 (${data.code}): ${data.msg}`);
  }
  await invalidatePhotoCache(member_rec_id);
  return { success: true };
}

/** 失效该成员相关的所有 cache */
async function invalidatePhotoCache(member_rec_id) {
  if (!isKvConfigured() || !member_rec_id) return;
  await Promise.all([
    kvDel('photos:member:' + member_rec_id),
    kvDel('photos:public'),
    kvDel('photo_count:' + member_rec_id),
  ]).catch(() => {});
}

export { DEFAULT_PHOTO_QUOTA };
