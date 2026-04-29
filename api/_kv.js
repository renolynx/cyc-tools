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
