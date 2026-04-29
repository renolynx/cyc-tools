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

/** 写 key，body 文本可包含中文等任意字符 */
export async function kvSet(key, value) {
  if (!isKvConfigured()) throw new Error('KV 存储未配置');
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
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
