/**
 * 身份令牌（/me/timeline 用）
 *
 *   流程：
 *     1. 用户选自己（成员 picker）+ 输微信号末 4 位
 *     2. /api/identity-verify 校验末 4 位 → 颁发 HMAC token（24h）
 *     3. 前端把 token 存 localStorage 一起带上传 / 编辑 / 删除请求
 *     4. 后端 verify token → 拿到 member_rec_id 直接操作
 *
 *   不用 JWT 库 — 用 Node 内置 crypto HMAC，足够轻量
 *   secret 复用 TEAM_PASSWORD（一个密钥两用，admin 改密码所有 token 自然失效）
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL = 24 * 60 * 60 * 1000;   // 24h

function getSecret() {
  const s = process.env.TEAM_PASSWORD;
  if (!s) throw new Error('TEAM_PASSWORD 未配置');
  return s;
}

/** 颁发 token: rec_id|expiresAt|sig */
export function signToken(member_rec_id, ttl = TOKEN_TTL) {
  const expiresAt = Date.now() + ttl;
  const payload = `${member_rec_id}|${expiresAt}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);
  return `${payload}|${sig}`;
}

/** 验证 token；通过返回 { member_rec_id, expiresAt }，否则 null */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('|');
  if (parts.length !== 3) return null;
  const [rec_id, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!rec_id || !expiresAt) return null;
  if (Date.now() > expiresAt) return null;

  const expectSig = createHmac('sha256', getSecret())
    .update(`${rec_id}|${expiresAt}`).digest('hex').slice(0, 32);

  // timing-safe 比较防侧信道（即使长度相等才能用 timingSafeEqual）
  if (sig.length !== expectSig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectSig))) return null;
  } catch { return null; }

  return { member_rec_id: rec_id, expiresAt };
}

/** 从 Authorization: Bearer <token> header 提取并验证；失败返回 null */
export function authFromRequest(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyToken(m[1].trim());
}

/** 微信号 placeholder 检查（同 _member.js 逻辑，避免循环 import 重写一份） */
const WECHAT_PLACEHOLDERS = ['同手机号', '同电话', '同上', '无', 'none', '-', '/', '．', '.'];
export function isPlaceholderWechat(wx) {
  if (!wx) return true;
  const s = String(wx).trim().toLowerCase();
  if (!s) return true;
  return WECHAT_PLACEHOLDERS.some(p => s === p.toLowerCase());
}

/** 取成员"末 4 位验证码"：微信号优先，placeholder 则用电话 */
export function getMemberLast4(member) {
  if (!member) return '';
  const wechat = (member._wechat || '').trim();
  if (wechat && !isPlaceholderWechat(wechat)) {
    return wechat.slice(-4);
  }
  const phone = (member._phone || '').trim();
  if (phone) return phone.slice(-4);
  return '';
}
