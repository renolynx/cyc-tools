/**
 * 活动通告密码读写（KV 优先，fallback 到环境变量）
 * KV 里以 'sync_password' key 存储
 */

import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const KV_KEY = 'sync_password';

/** 取当前生效密码：先 KV，没有则 env */
export async function getCurrentPassword() {
  if (isKvConfigured()) {
    const v = await kvGet(KV_KEY);
    if (v) return v;
  }
  return process.env.SYNC_PASSWORD || null;
}

/** 校验输入是否匹配当前密码 */
export async function verifyPassword(input) {
  if (!input) return false;
  const current = await getCurrentPassword();
  if (!current) return false;
  return input === current;
}

/** 修改密码（必须配置 KV） */
export async function setPassword(newPassword) {
  if (!isKvConfigured())
    throw new Error('密码动态修改功能需要先在 Vercel 配置 KV 存储');
  return kvSet(KV_KEY, newPassword);
}

export { isKvConfigured };
