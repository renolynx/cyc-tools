/**
 * GET /api/members
 * 给团队架构页的成员选择器用：返回去除私密字段的全员精简列表
 *
 * 鉴权：Authorization: Bearer <TEAM_PASSWORD>
 *   - 团队页登录时已经验证过 TEAM_PASSWORD，前端把它缓存在 sessionStorage，
 *     调用本 API 时通过 header 带上，服务端再次校验。
 *
 * 返回：{ success, count, members: [{ record_id, name, nickname, avatar_token, bio, cities, identity }] }
 *   - avatar_token：file_token 字符串，前端拼 /api/poster?token= 加载
 *   - bio：截断到前 80 字（picker 列表只需要扫一眼）
 */

import { applyCors } from './_feishu.js';
import { fetchAllMembers, stripPrivate } from './_member.js';

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

  // ── 环境变量检查（成员表用专属的 FEISHU_MEMBER_*）──
  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'FEISHU_MEMBER_TABLE_ID'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length)
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });

  try {
    const all = await fetchAllMembers();

    // 过滤 hidden + 剥 _wechat/_phone + 精简字段
    const members = all
      .filter(m => !m.hidden)
      .map(stripPrivate)
      .map(m => ({
        record_id:    m.record_id,
        name:         m.name || '',
        nickname:     m.nickname || '',
        avatar_token: m.avatar?.file_token || null,
        bio:          (m.bio || '').slice(0, 80),
        cities:       m.cities || [],
        identity:     m.identity || [],
      }))
      // 按姓名排序，稳定可读
      .sort((a, b) => (a.name || a.nickname || '').localeCompare(b.name || b.nickname || '', 'zh-Hans-CN'));

    return res.status(200).json({ success: true, count: members.length, members });

  } catch (err) {
    console.error('[members]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
