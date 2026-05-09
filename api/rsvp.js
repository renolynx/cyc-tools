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
import { ensureMemberByWechat } from './_member.js';
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
  const {
    activity_rec_id, activity_title, name, wechat, bio, roles,
    // 706 × muShanghai 扩展（上海活动 + 国际开发者用）
    email, attendance_mode, ticket_holder, hubs,
  } = req.body || {};

  if (!activity_rec_id) return res.status(400).json({ error: '缺活动 ID' });
  if (!name || !name.trim())       return res.status(400).json({ error: '请填写姓名 / Please fill in your name' });

  const wechatTrim = (wechat || '').trim();
  const emailTrim  = (email  || '').trim();

  // wechat 或 email 任一必填（大理用 wechat、上海国际开发者用 email）
  if (!wechatTrim && !emailTrim) {
    return res.status(400).json({
      error: '请填写微信号或邮箱 / Please provide a WeChat ID or email so we can reach you',
    });
  }

  // email 简单格式校验（防垃圾）
  if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return res.status(400).json({ error: '邮箱格式不对 / Invalid email format' });
  }

  // 长度限制（防垃圾）
  if (name.length > 30)   return res.status(400).json({ error: '姓名过长 / Name too long' });
  if (wechatTrim.length > 30) return res.status(400).json({ error: '微信号过长 / WeChat ID too long' });
  if (emailTrim.length > 100) return res.status(400).json({ error: '邮箱过长 / Email too long' });
  if (bio && bio.length > 200) return res.status(400).json({ error: '个人简介最多 200 字 / Bio too long (max 200)' });

  // attendance_mode 校验（仅上海活动会传，传了必须合法）
  if (attendance_mode && !['online', 'offline'].includes(attendance_mode)) {
    return res.status(400).json({ error: 'attendance_mode 必须是 online 或 offline' });
  }

  try {
    // 同活动同标识符已存在 → 幂等返回（dedup key = wechat 或 email，调用端是哪种就用哪种）
    const dedupId = wechatTrim || emailTrim;
    const existing = await findExistingRsvp(activity_rec_id, dedupId);
    if (existing) {
      return res.status(200).json({
        success: true,
        already_registered: true,
        record_id: existing.record_id,
        message: '你已经报名过这个活动啦 / You\'ve already RSVP\'d to this event',
      });
    }

    // 拿 / 建成员 record_id（仅 wechat 用户走，email-only 国际用户暂跳过成员表写入）
    //   找到 → 用现有；找不到 → 自动建一个隐藏成员
    //   用 KV mark 强一致防 race（连点报名不会建多个成员）
    let member_rec_id;
    if (wechatTrim) {
      try {
        member_rec_id = await ensureMemberByWechat(name.trim(), wechatTrim, (bio || '').trim());
      } catch (err) {
        console.warn('[rsvp] ensureMemberByWechat failed:', err.message);
        // 不阻塞 RSVP 写入；member_rec_id 留空
      }
    }

    const result = await addRsvp({
      name:            name.trim(),
      activity_rec_id,
      activity_title:  (activity_title || '').trim(),
      wechat:          wechatTrim,
      email:           emailTrim,
      bio:             (bio || '').trim(),
      roles:           Array.isArray(roles) && roles.length ? roles : ['活动参与者'],
      member_rec_id,
      attendance_mode: attendance_mode || '',
      ticket_holder:   !!ticket_holder,
      hubs:            Array.isArray(hubs) ? hubs : undefined,
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
  let { record_id, auth, password, wechat, email, activity_rec_id } = req.body || {};

  // v4.2.13 Task 4: 支持 by-activity 自助取消 —— 给定 activity_rec_id + credential，
  // 服务端找到本人 RSVP 自动取消（前端不用知道 record_id）
  // credential 可以是 wechat 或 email；先用全 RSVP 列表 lookup
  const credential = (auth || password || wechat || email || '').trim();
  if (!credential && !record_id) return res.status(400).json({ error: '缺 record_id 或凭证' });
  if (!credential) return res.status(400).json({ error: '请输入微信号 / 邮箱 / 管理密码' });

  let mode = null;

  // Path A: by record_id（旧 admin 流程兼容）
  if (record_id) {
    if (await verifyPassword(credential)) {
      mode = 'admin';
    } else {
      try {
        const record = await fetchRsvpByRecordId(record_id);
        if (record) {
          const norm = s => (s || '').trim().toLowerCase();
          if (norm(credential) === norm(record.wechat) && norm(record.wechat) !== '') mode = 'self';
          else if (norm(credential) === norm(record.email) && norm(record.email) !== '') mode = 'self';
        }
      } catch (err) {
        console.error('[rsvp delete] fetch verify failed:', err.message);
      }
    }
  } else if (activity_rec_id) {
    // Path B: by activity_rec_id —— 服务端 lookup 用户的 RSVP 记录
    try {
      const list = await (await import('./_rsvp.js')).fetchRsvpsForActivity(activity_rec_id);
      const norm = s => (s || '').trim().toLowerCase();
      const c = norm(credential);
      const hit = list.find(r => (r.wechat && norm(r.wechat) === c) || (r.email && norm(r.email) === c));
      if (hit) {
        record_id = hit.record_id;
        mode = 'self';
      }
    } catch (err) {
      console.error('[rsvp delete by activity] lookup failed:', err.message);
    }
  }

  if (!mode || !record_id) {
    return res.status(401).json({ error: '验证失败：找不到对应的报名记录' });
  }

  try {
    // deleteRsvp 内部会 fetch 拿真实 wechat / activity_id 自动清 KV mark
    const result = await deleteRsvp(record_id);
    return res.status(200).json({ success: true, record_id, mode, ...result });
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
