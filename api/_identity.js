/**
 * 身份验证流程的共享 helper（identity-check / identity-verify 共用）
 *
 *   - loadMemberOrError(rec_id)：fetchMember + hidden 检查 + 标准化错误返回
 *   - sanitizedMemberPayload(member)：返回前端能展示的精简公开字段（不含
 *     私密 _wechat / _phone）+ 自动附 avatar_url
 *
 * 把"两个 endpoint 都要做的事"放在这里集中维护。
 */

import { fetchMember } from './_member.js';
import { kvGet, isKvConfigured } from './_kv.js';

/**
 * 拉成员；若不存在 / hidden / fetch 失败，写好 res.status + body 并返回 null
 *   调用方拿到 null 就直接 return（已经响应过了）
 *
 * 用法：
 *   const member = await loadMemberOrError(member_rec_id, res);
 *   if (!member) return;
 */
export async function loadMemberOrError(member_rec_id, res) {
  if (!member_rec_id) {
    res.status(400).json({ error: '缺 member_rec_id' });
    return null;
  }
  try {
    const m = await fetchMember(member_rec_id);
    if (!m)         { res.status(404).json({ error: '成员不存在' }); return null; }
    if (m.hidden)   { res.status(404).json({ error: '该成员已隐藏' }); return null; }
    return m;
  } catch (err) {
    res.status(500).json({ error: '查询成员失败：' + err.message });
    return null;
  }
}

/**
 * 返回前端用的精简成员字段：
 *   { record_id, name, nickname, avatar_token, avatar_url }
 *   不含 _wechat / _phone（私密字段不出 server）
 */
export async function sanitizedMemberPayload(member) {
  let avatar_url = null;
  if (isKvConfigured()) {
    try { avatar_url = await kvGet('avatar_url:' + member.record_id); } catch {}
  }
  return {
    record_id:    member.record_id,
    name:         member.name || '',
    nickname:     member.nickname || '',
    avatar_token: member.avatar?.file_token || null,
    avatar_url,
  };
}
