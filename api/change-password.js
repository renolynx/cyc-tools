/**
 * POST /api/change-password
 * 修改活动通告密码（验证当前密码 → 写入 KV）
 * Body: { currentPassword, newPassword }
 */

import { getCurrentPassword, setPassword, verifyPassword, isKvConfigured } from './_password.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: '请填写当前密码和新密码' });

  if (newPassword.length < 2)
    return res.status(400).json({ error: '新密码至少 2 个字符' });

  if (newPassword === currentPassword)
    return res.status(400).json({ error: '新密码不能与当前密码相同' });

  if (!isKvConfigured())
    return res.status(503).json({
      error: '功能未启用：服务端尚未配置 KV 存储。请在 Vercel 控制台连接 Upstash Redis 后重试。',
    });

  // 校验当前密码
  const ok = await verifyPassword(currentPassword);
  if (!ok) return res.status(401).json({ error: '当前密码不正确' });

  // 写入新密码
  try {
    await setPassword(newPassword);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[change-password]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
