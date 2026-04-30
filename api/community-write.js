/**
 * 成员写操作端点（admin 用，密码保护）
 *
 * POST /api/community-write
 * Body: {
 *   action:    'search' | 'create' | 'update',
 *   password:  string,                    // 必填，与 SYNC_PASSWORD 比对
 *   record_id?: string,                    // update 必填
 *   data?:     { ... },                    // create / update 时的字段
 *   query?:    string,                     // search 用
 *   cityFilter?: 'all' | '大理' | '上海' | 'hidden',
 * }
 */

import { applyCors } from './_feishu.js';
import { verifyPassword } from './_password.js';
import {
  fetchAllMembers,
  fetchMember,
  searchMembers,
  writeMember,
  stripPrivate,
} from './_member.js';

// 把含 _wechat / _phone 的成员对象给 admin（有密码 → 可见私密）
function adminView(m) {
  return m;
}

async function handleSearch(req, res) {
  const q = (req.body.query || '').toString();
  const cityFilter = req.body.cityFilter || 'all';

  // 含 hidden 的全部
  let members;
  if (q) {
    members = await searchMembers(q, { includeHidden: true });
  } else {
    members = await fetchAllMembers();
  }

  // 城市筛选
  if (cityFilter === '大理' || cityFilter === '上海') {
    members = members.filter(m => m.cities.includes(cityFilter));
  } else if (cityFilter === 'hidden') {
    members = members.filter(m => m.hidden);
  }

  // 限制返回条数（避免 1MB JSON）
  const limited = members.slice(0, 100);

  return res.status(200).json({
    success: true,
    count: limited.length,
    total: members.length,
    members: limited.map(adminView),
  });
}

async function handleCreate(req, res) {
  const data = req.body.data || {};
  if (!data.name || !data.name.trim()) return res.status(400).json({ error: '请填写姓名' });

  try {
    const result = await writeMember(data);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[community-write create]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleUpdate(req, res) {
  const record_id = req.body.record_id;
  const data = req.body.data || {};
  if (!record_id) return res.status(400).json({ error: '缺 record_id' });

  try {
    const result = await writeMember(data, record_id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[community-write update]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(req, res) {
  // 取单条完整记录（含私密）给编辑表单 prefill 用
  const id = req.body.record_id;
  if (!id) return res.status(400).json({ error: '缺 record_id' });
  const m = await fetchMember(id);
  if (!m) return res.status(404).json({ error: '成员不存在' });
  return res.status(200).json({ success: true, member: m });
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action, password } = req.body || {};

  // 密码校验（用 SYNC_PASSWORD）
  if (!await verifyPassword(password)) {
    return res.status(401).json({ error: '密码错误' });
  }

  if (action === 'search') return handleSearch(req, res);
  if (action === 'get')    return handleGet(req, res);
  if (action === 'create') return handleCreate(req, res);
  if (action === 'update') return handleUpdate(req, res);

  return res.status(400).json({ error: `unknown action: ${action}` });
}
