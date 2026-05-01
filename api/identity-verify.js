/**
 * POST /api/identity-verify
 *   body: { member_rec_id, code }     // code = 微信号末 4 位（或电话末 4 位）
 *   返回: { success, token, expires_at }   // token 24h 有效
 *
 *   失败：
 *     400 缺参数
 *     401 验证失败
 *     403 该成员未填微信号或电话
 *     404 成员不存在
 */

import { applyCors } from './_feishu.js';
import { fetchMember } from './_member.js';
import { signToken, getMemberLast4 } from './_auth.js';
import { kvGet, isKvConfigured } from './_kv.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const { member_rec_id, code } = req.body || {};
  if (!member_rec_id || !code) {
    return res.status(400).json({ error: '缺参数：member_rec_id 和 code 都必填' });
  }

  // 环境变量检查
  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'FEISHU_MEMBER_TABLE_ID', 'TEAM_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });
  }

  let member;
  try {
    member = await fetchMember(member_rec_id);
  } catch (err) {
    return res.status(500).json({ error: '查询成员失败：' + err.message });
  }
  if (!member) return res.status(404).json({ error: '成员不存在' });
  if (member.hidden) return res.status(404).json({ error: '该成员已隐藏' });

  const last4 = getMemberLast4(member);
  if (!last4) {
    return res.status(403).json({ error: '该成员未填微信号或电话，暂不能用此方式验证' });
  }

  const codeNorm = String(code).trim().toLowerCase();
  if (codeNorm !== last4.toLowerCase()) {
    return res.status(401).json({ error: '验证失败：末 4 位不匹配' });
  }

  const token = signToken(member_rec_id);
  // 解析 token 拿 expiresAt（避免重复算）
  const expires_at = Number(token.split('|')[1]);

  // 顺手拉一下用户上传过的云端头像（KV 永久映射），让前端再次登录时立刻有头像
  let avatar_url = null;
  if (isKvConfigured()) {
    try { avatar_url = await kvGet('avatar_url:' + member_rec_id); } catch {}
  }

  return res.status(200).json({
    success: true,
    token,
    expires_at,
    member: {
      record_id:    member.record_id,
      name:         member.name || '',
      nickname:     member.nickname || '',
      avatar_token: member.avatar?.file_token || null,   // 飞书"照片"附件 token（admin 维护的原始头像）
      avatar_url,                                          // 用户自己上传的云端头像（优先级更高）
    },
  });
}
