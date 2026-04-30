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
import { fetchRsvpsForActivity, findExistingRsvp, addRsvp } from './_rsvp.js';
import { findMemberByName } from './_member.js';

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

// ─────────── Handler ───────────

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')     return handleGet(req, res);
  if (req.method === 'POST')    return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
