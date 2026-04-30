/**
 * 活动报名端点
 *
 * POST /api/rsvp
 *   Body: { activity_rec_id, name, wechat, bio?, roles? }
 *   必填: activity_rec_id, name, wechat
 *   默认 roles = ['活动参与者']
 *
 *   行为：
 *   - 同活动同微信号已存在 → 返回 already_registered=true（不重复创建）
 *   - 否则插入新记录
 *
 * GET /api/rsvp?activity_id=X
 *   返回 { hosts: [], attendees: [], counts: {...} }
 *   公开数据，wechat 字段对外脱敏（只显示前后字符）
 */

import { applyCors } from './_feishu.js';
import { fetchRsvpsForActivity, findExistingRsvp, addRsvp, deleteRsvp, fetchRsvpByRecordId } from './_rsvp.js';
import { findMemberByName } from './_member.js';
import { verifyPassword } from './_password.js';

// ─────────── 工具函数 ───────────

function maskWechat(wx) {
  if (!wx || wx.length < 4) return '***';
  return wx.slice(0, 2) + '***' + wx.slice(-1);
}

function publicView(r) {
  return {
    record_id:    r.record_id,
    name:         r.name,
    bio:          r.bio,
    roles:        r.roles,
    member_rec_id: r.member_rec_id,
    wechat_mask:  maskWechat(r.wechat),  // 不返回原微信号
    registered_at: r.registered_at,
  };
}

function isHost(r)     { return r.roles.includes('活动发起者') || r.roles.includes('嘉宾'); }
function isAttendee(r) { return r.roles.includes('活动参与者'); }

// ─────────── GET：拉报名情况 ───────────

async function handleGet(req, res) {
  const id = req.query.activity_id;
  if (!id) return res.status(400).json({ error: '缺 activity_id' });

  try {
    const all = await fetchRsvpsForActivity(id);
    const hosts     = all.filter(isHost).map(publicView);
    const attendees = all.filter(isAttendee).map(publicView);
    return res.status(200).json({
      success: true,
      hosts, attendees,
      counts: { hosts: hosts.length, attendees: attendees.length },
    });
  } catch (err) {
    console.error('[rsvp GET]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────── POST：报名 ───────────

async function handlePost(req, res) {
  const { activity_rec_id, activity_title, name, wechat, bio, roles } = req.body || {};

  if (!activity_rec_id) return res.status(400).json({ error: '缺活动 ID' });
  if (!name || !name.trim())       return res.status(400).json({ error: '请填写姓名' });
  if (!wechat || !wechat.trim())   return res.status(400).json({ error: '请填写微信号（用于通知活动信息）' });

  // 长度限制（防垃圾）
  if (name.length > 20)   return res.status(400).json({ error: '姓名过长（最多 20 字）' });
  if (wechat.length > 30) return res.status(400).json({ error: '微信号过长' });
  if (bio && bio.length > 200) return res.status(400).json({ error: '个人简介最多 200 字' });

  try {
    // 同活动同微信号已存在 → 幂等返回
    const existing = await findExistingRsvp(activity_rec_id, wechat.trim());
    if (existing) {
      return res.status(200).json({
        success: true,
        already_registered: true,
        record_id: existing.record_id,
        message: '你已经报名过这个活动啦',
      });
    }

    // 尝试匹配成员表（按称呼/姓名）
    let member_rec_id;
    try {
      const m = await findMemberByName(name.trim());
      if (m) member_rec_id = m.record_id;
    } catch {}  // 匹配失败不阻塞报名

    const result = await addRsvp({
      name:            name.trim(),
      activity_rec_id,
      activity_title:  (activity_title || '').trim(),
      wechat:          wechat.trim(),
      bio:             (bio || '').trim(),
      roles:           Array.isArray(roles) && roles.length ? roles : ['活动参与者'],
      member_rec_id,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[rsvp POST]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────── DELETE: 删除某条 RSVP ───────────
//   POST /api/rsvp?action=delete
//   Body: { record_id, auth, activity_rec_id? }
//
//   auth 有两种身份：
//     1. 同步活动密码 → admin 删任意一条
//     2. 该记录原始的微信号 → 本人取消自己的报名
//   服务端两种都试，任一通过即可
//
//   activity_rec_id 用于清相关 KV mark（选填）

async function handleDelete(req, res) {
  const { record_id, auth, password, wechat, activity_rec_id } = req.body || {};
  if (!record_id) return res.status(400).json({ error: '缺 record_id' });

  // 兼容老调用：传单独的 password / wechat 也认；新调用统一传 auth
  const credential = (auth || password || wechat || '').trim();
  if (!credential) return res.status(400).json({ error: '请输入微信号或管理密码' });

  // 先按 admin 密码试
  let mode = null;
  if (await verifyPassword(credential)) {
    mode = 'admin';
  } else {
    // 不是密码 → 按微信号自助取消试
    try {
      const record = await fetchRsvpByRecordId(record_id);
      if (record) {
        const norm = s => (s || '').trim().toLowerCase();
        if (norm(credential) === norm(record.wechat) && norm(credential) !== '') {
          mode = 'self';
        }
      }
    } catch (err) {
      console.error('[rsvp delete] fetch verify failed:', err.message);
    }
  }

  if (!mode) {
    return res.status(401).json({ error: '验证失败：本人请输微信号，管理员请输同步密码' });
  }

  try {
    // 用记录里的真实 wechat 清 KV mark（如能拿到）
    let realWechat = wechat;
    if (mode === 'self') realWechat = credential;
    await deleteRsvp(record_id, activity_rec_id, realWechat);
    return res.status(200).json({ success: true, record_id, mode });
  } catch (err) {
    console.error('[rsvp delete]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────── Handler ───────────

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')     return handleGet(req, res);
  if (req.method === 'POST') {
    if (req.query.action === 'delete') return handleDelete(req, res);
    return handlePost(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
