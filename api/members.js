/**
 * GET /api/members
 *
 * 公开成员目录（精简字段）— 给 picker 用：团队架构页 + me/timeline 身份关联。
 *
 * v2 改动：
 *   - 去掉 TEAM_PASSWORD 鉴权 — 返回字段已经是公开的（已过滤 hidden、剥
 *     _wechat/_phone），跟 /community 公开成员页对外暴露的信息等价。
 *     team 页旧的 Authorization header 也兼容（直接忽略）。
 *   - 加 KV 缓存（5min）— 避免高频调用打满飞书 quota。
 *
 * 返回：{ success, count, members: [{ record_id, name, nickname, avatar_token, bio, cities, identity }] }
 *   - avatar_token：file_token 字符串，前端拼 /api/poster?token= 加载
 *   - bio：截断到前 80 字
 */

import { applyCors } from './_feishu.js';
import { fetchAllMembers, stripPrivate } from './_member.js';
import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const KV_KEY = 'members:public_list';
const KV_TTL = 300;   // 5min

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── 环境变量 ──
  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'FEISHU_MEMBER_TABLE_ID'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length)
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });

  // ── KV cache ──
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(KV_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        return res.status(200).json({ success: true, count: list.length, members: list, cached: true });
      }
    } catch {}
  }

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

    if (isKvConfigured()) {
      try { await kvSet(KV_KEY, JSON.stringify(members), KV_TTL); } catch {}
    }

    return res.status(200).json({ success: true, count: members.length, members });

  } catch (err) {
    console.error('[members]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
