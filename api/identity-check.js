/**
 * GET /api/identity-check?member_rec_id=...
 *
 * 给前端 picker 选完成员后用：判断该成员是否已填过微信号或电话。
 *   - has_credential: true  → 走"输入末 4 位"验证流程 (mode=verify)
 *   - has_credential: false → 走"第一次录入完整微信号"流程 (mode=bootstrap)
 *
 * 返回：
 *   { success: true, has_credential: boolean,
 *     member: { record_id, name, nickname, avatar_token, avatar_url } }
 *
 * 不需要 token — picker 阶段还没颁发 token。但仅返回精简公开字段（同
 * /api/members 范围）。
 */

import { applyCors } from './_feishu.js';
import { isPlaceholderWechat } from './_auth.js';
import { loadMemberOrError, sanitizedMemberPayload } from './_identity.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'GET only' });

  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'FEISHU_MEMBER_TABLE_ID'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });
  }

  const member_rec_id = (req.query.member_rec_id || '').toString().trim();
  const member = await loadMemberOrError(member_rec_id, res);
  if (!member) return;

  // 微信号有效（非 placeholder）→ 算"已有凭证"
  // 微信号是 placeholder（"同手机号" 等）→ 看电话；电话有 → 算已有
  const wechat = (member._wechat || '').trim();
  const phone  = (member._phone || '').trim();
  const has_credential = (wechat && !isPlaceholderWechat(wechat)) || !!phone;

  return res.status(200).json({
    success: true,
    has_credential,
    member: await sanitizedMemberPayload(member),
  });
}
