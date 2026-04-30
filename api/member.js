/**
 * GET /api/member?id=recXXX
 * 给团队架构页的「关联成员后展开档案卡」用 — 返回单个成员的完整字段
 *
 * 鉴权同 /api/members：Authorization: Bearer <TEAM_PASSWORD>
 *
 * 跟 /api/members 的区别：
 *   - /api/members: 列表、bio 截断 80 字、字段精简（picker 滚动用）
 *   - /api/member:  单条、bio 完整、所有公开字段（详情卡用）
 *
 * 返回：{ success, member: { ...完整字段，不含 _wechat/_phone } }
 *      或 { error: '成员不存在' } / 404
 */

import { applyCors } from './_feishu.js';
import { fetchMember, stripPrivate } from './_member.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── 鉴权 ──
  const TEAM_PASSWORD = process.env.TEAM_PASSWORD;
  if (!TEAM_PASSWORD)
    return res.status(500).json({ error: '管理密码未配置（TEAM_PASSWORD）' });

  const auth = req.headers.authorization || '';
  const password = auth.replace(/^Bearer\s+/i, '').trim();
  if (password !== TEAM_PASSWORD)
    return res.status(401).json({ error: '密码错误' });

  // ── 参数校验 ──
  const id = (req.query.id || '').toString().trim();
  if (!id)
    return res.status(400).json({ error: '缺少 id 参数' });

  // ── 环境变量检查 ──
  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'FEISHU_MEMBER_TABLE_ID'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length)
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });

  try {
    const m = await fetchMember(id);
    if (!m) return res.status(404).json({ error: '成员不存在' });
    if (m.hidden) return res.status(404).json({ error: '该成员已隐藏' });

    // 剥私密字段（_wechat/_phone）；公开档案用
    const safe = stripPrivate(m);
    const member = {
      record_id:      safe.record_id,
      name:           safe.name || '',
      nickname:       safe.nickname || '',
      avatar_token:   safe.avatar?.file_token || null,
      bio:            safe.bio || '',           // 完整版（不截断）
      job:            safe.job || '',
      company:        safe.company || '',
      topics:         safe.topics || '',
      willShare:      safe.willShare || '',
      interests:      safe.interests || '',
      mbti:           safe.mbti || '',
      identity:       safe.identity || [],
      contribution:   safe.contribution || [],
      residentStatus: safe.residentStatus || '',
      cities:         safe.cities || [],
      hubs:           safe.hubs || [],
    };

    return res.status(200).json({ success: true, member });

  } catch (err) {
    console.error('[member]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
