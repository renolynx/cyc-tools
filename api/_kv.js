/**
 * Upstash Redis 简易客户端（通过 REST API + fetch，无需 SDK 依赖）
 * 兼容 Vercel KV / Upstash Marketplace 两套环境变量命名
 */

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function isKvConfigured() {
  return Boolean(KV_URL && KV_TOKEN);
}

/** 读 key，未配置或不存在返回 null */
export async function kvGet(key) {
  if (!isKvConfigured()) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data.result;
  } catch (err) {
    console.error('[kv get]', err.message);
    return null;
  }
}

/** 删 key；KV 没配置 / 不存在都视为成功（幂等） */
export async function kvDel(key) {
  if (!isKvConfigured()) return false;
  try {
    const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 写 key
 * @param {string} key
 * @param {string} value 文本，可含中文
 * @param {number} [ttlSec] 可选过期秒数；不传则永久存储
 */
export async function kvSet(key, value, ttlSec) {
  if (!isKvConfigured()) throw new Error('KV 存储未配置');
  const url = `${KV_URL}/set/${encodeURIComponent(key)}`
            + (ttlSec ? `?EX=${Math.max(1, Math.floor(ttlSec))}` : '');
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: value,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV SET 失败 ${res.status}: ${text}`);
  }
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(`KV SET 错误: ${data.error}`);
  return true;
}

// ─────────── 缓存失效（集中管理）───────────
// 写操作不再各自维护要清的 key 列表，调 invalidate(scope, ...args) 即可
// 加新 cache key 时只需在这里登记一次，所有调用方自动跟上。
//
// 设计思路：写操作的影响面是"扇出"的——
//   - 改活动 → event 详情、活动列表、sitemap、成员列表（inferredCities/topTypes）
//   - 改成员 → member 详情、成员列表、活动反推城市表、ta 的 RSVP cache
//   - 改 RSVP → 活动 RSVP cache、全表 cache、城市反推、成员列表（角色聚合变）
// 都涉及 members:* 因为成员列表用的聚合（roleStats/topTypes/lastActiveAt）依赖
// 一切上游写操作。简化心智：写操作宁清多别漏清。

const SCOPES = {
  // 写一条活动后清（poster 也算 — 单独一个 file_token cache 不在这里）
  activity: (id) => [
    id ? 'event:' + id : null,
    'events:upcoming',
    'sitemap:acts',
    'members:大理',          // 活动 types/loc 变 → 成员列表聚合可能变
    'members:上海',
    'member_activity_cities',
  ],

  // 写一条成员后清
  member: (id) => [
    id ? 'member:' + id : null,
    id ? 'rsvp:member:' + id : null,
    'members:大理',
    'members:上海',
    'member_activity_cities',
  ],

  // 写一条 RSVP 后清；activityId / memberId 都可选但建议都传
  rsvp: (activityId, memberId) => [
    'rsvp:all',
    activityId ? 'rsvp:activity:' + activityId : null,
    memberId   ? 'rsvp:member:'   + memberId   : null,
    'member_activity_cities',
    'members:大理',
    'members:上海',
  ],

  // admin 兜底（schema 改动后强制刷新；clear-cache action 用）
  all: () => [
    'members:大理',
    'members:上海',
    'rsvp:all',
    'member_activity_cities',
  ],
};

/** 按 scope 清相关 KV cache key
 *  invalidate('activity', id) / invalidate('member', id) / invalidate('rsvp', aid, mid) / invalidate('all')
 *  所有失败 silent ignore（cache 失效是 best-effort，不应阻塞主流程）
 */
export async function invalidate(scope, ...args) {
  if (!isKvConfigured()) return;
  const fn = SCOPES[scope];
  if (!fn) {
    console.warn('[invalidate] unknown scope:', scope);
    return;
  }
  const keys = fn(...args).filter(Boolean);
  if (!keys.length) return;
  await Promise.all(keys.map(k => kvDel(k))).catch(() => {});
}

// ─────────── Admin 操作日志 ───────────
// 写操作（合并 / 批量打标 / strip / clear-cache 等）都 append 一条到这个
// 环形数组，保留最近 ADMIN_LOG_MAX 条。出问题时可以追溯什么时候、谁、
// 改了什么、结果成功还是失败。
//
// 存一个 KV key 装 JSON 数组（不用 LPUSH 因为 _kv.js 只用 GET/SET 不引入
// list 命令；admin 写操作并发量低，先写后读的 race 可接受）

const ADMIN_LOG_KEY = 'admin_log:current';
const ADMIN_LOG_MAX = 500;

/** entry: { action, success?, error?, summary?, params? } */
export async function appendAdminLog(entry) {
  if (!isKvConfigured()) return;
  try {
    const cur = await kvGet(ADMIN_LOG_KEY);
    const list = cur ? JSON.parse(cur) : [];
    list.unshift({ ts: Date.now(), ...entry });
    if (list.length > ADMIN_LOG_MAX) list.length = ADMIN_LOG_MAX;
    await kvSet(ADMIN_LOG_KEY, JSON.stringify(list));
  } catch (err) {
    // 日志写失败不应该影响主操作
    console.warn('[appendAdminLog] failed:', err.message);
  }
}

/** 取最近 N 条；最新在前 */
export async function readAdminLog(limit = 100) {
  if (!isKvConfigured()) return [];
  try {
    const cur = await kvGet(ADMIN_LOG_KEY);
    if (!cur) return [];
    const list = JSON.parse(cur);
    return list.slice(0, Math.max(1, Math.min(limit, ADMIN_LOG_MAX)));
  } catch {
    return [];
  }
}

/** 多个 record id 的活动一次性清（strip-types backfill 等批量场景，避免重复清通用 key） */
export async function invalidateActivities(ids) {
  if (!isKvConfigured() || !ids || !ids.length) return;
  const keys = [
    'events:upcoming',
    'sitemap:acts',
    'members:大理',
    'members:上海',
    'member_activity_cities',
    ...ids.map(id => 'event:' + id),
  ];
  await Promise.all(keys.map(k => kvDel(k))).catch(() => {});
}
