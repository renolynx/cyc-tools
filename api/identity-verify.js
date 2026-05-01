/**
 * POST /api/identity-verify
 *
 * 两种模式：
 *
 *   mode='verify'（默认）：成员已填微信号/电话，输末 4 位
 *     body: { member_rec_id, code }   // code = 末 4 位
 *
 *   mode='bootstrap'：成员未填微信号，第一次录入
 *     body: { member_rec_id, mode: 'bootstrap', wechat }
 *     - 写入飞书总表的"微信号"字段
 *     - 仅当成员目前确实没有有效凭证时允许
 *     - 操作 log 到 admin_log
 *     - 颁发 24h token
 *
 *   返回: { success, token, expires_at, member }
 *
 *   失败码：
 *     400 缺参数 / 微信号格式不合法
 *     401 验证失败（mode=verify 时末 4 位不对）
 *     403 mode=bootstrap 但该成员已填过微信号（防止恶意覆盖）
 *     404 成员不存在
 *     409 mode=bootstrap 但该微信号已被别的成员占用（重复绑定）
 */

import { applyCors, getAccessToken } from './_feishu.js';
import { fetchMember, findMemberByWechat } from './_member.js';
import { signToken, getMemberLast4, isPlaceholderWechat } from './_auth.js';
import { kvGet, isKvConfigured, invalidate } from './_kv.js';
import { appendAdminLog } from './_kv.js';

const APP_TOKEN  = process.env.FEISHU_MEMBER_APP_TOKEN;
const TABLE_ID   = process.env.FEISHU_MEMBER_TABLE_ID;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const body = req.body || {};
  const member_rec_id = (body.member_rec_id || '').toString().trim();
  const mode = (body.mode || 'verify').toString();

  if (!member_rec_id) {
    return res.status(400).json({ error: '缺参数：member_rec_id' });
  }

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

  // ────────────────────────────────────────
  //  Mode B · bootstrap · 第一次录入微信号
  // ────────────────────────────────────────
  if (mode === 'bootstrap') {
    const wechat = (body.wechat || '').toString().trim();
    if (!wechat) return res.status(400).json({ error: '请输入完整的微信号' });
    if (wechat.length < 4 || wechat.length > 40) {
      return res.status(400).json({ error: '微信号长度看起来不对（4-40 位）' });
    }

    // 已有凭证 → 拒绝（避免恶意覆盖）
    const existingWechat = (member._wechat || '').trim();
    const existingPhone  = (member._phone || '').trim();
    const hasExisting = (existingWechat && !isPlaceholderWechat(existingWechat)) || existingPhone;
    if (hasExisting) {
      return res.status(403).json({
        error: '该成员已有凭证，请用末 4 位验证；如需修改请联系管理员',
        code: 'ALREADY_BOUND',
      });
    }

    // 微信号唯一性 — 防止占用别人的微信号
    try {
      const dup = await findMemberByWechat(wechat);
      if (dup && dup.record_id !== member_rec_id) {
        return res.status(409).json({
          error: '这个微信号已经被另一位成员绑定。如果是误绑请联系管理员。',
          code: 'WECHAT_TAKEN',
        });
      }
    } catch (err) {
      // 唯一性检查失败不阻塞；继续写入但 log 一下
      console.warn('[identity-verify bootstrap] 唯一性检查失败：', err.message);
    }

    // 写飞书总表
    try {
      const token = await getAccessToken();
      const writeRes = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${member_rec_id}`,
        {
          method:  'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ fields: { '微信号': wechat } }),
        }
      );
      const writeJson = await writeRes.json();
      if (writeJson.code !== 0) {
        throw new Error(`(${writeJson.code}) ${writeJson.msg}`);
      }
    } catch (err) {
      return res.status(500).json({ error: '写入失败：' + err.message });
    }

    // 失效该成员相关 cache（picker / member 详情等都会重新拉）
    try { await invalidate('member', member_rec_id); } catch {}

    // log 操作（admin 可追溯，万一冒名顶替能查）
    try {
      await appendAdminLog({
        action:  'identity_bootstrap',
        success: true,
        summary: `成员 ${member.name || member.nickname || member_rec_id} 首次录入微信号`,
        params:  { member_rec_id, wechat_len: wechat.length },
      });
    } catch {}

    // 颁发 token
    const sigToken = signToken(member_rec_id);
    const expires_at = Number(sigToken.split('|')[1]);
    let avatar_url = null;
    if (isKvConfigured()) {
      try { avatar_url = await kvGet('avatar_url:' + member_rec_id); } catch {}
    }

    return res.status(200).json({
      success: true,
      token: sigToken,
      expires_at,
      bootstrapped: true,
      member: {
        record_id:    member.record_id,
        name:         member.name || '',
        nickname:     member.nickname || '',
        avatar_token: member.avatar?.file_token || null,
        avatar_url,
      },
    });
  }

  // ────────────────────────────────────────
  //  Mode A · verify · 末 4 位验证（默认）
  // ────────────────────────────────────────
  const code = (body.code || '').toString();
  if (!code) {
    return res.status(400).json({ error: '请输入末 4 位' });
  }

  const last4 = getMemberLast4(member);
  if (!last4) {
    return res.status(403).json({
      error: '该成员未填微信号或电话，请用第一次录入流程',
      code: 'NO_CREDENTIAL',
    });
  }

  const codeNorm = code.trim().toLowerCase();
  if (codeNorm !== last4.toLowerCase()) {
    return res.status(401).json({ error: '验证失败：末 4 位不匹配' });
  }

  const sigToken = signToken(member_rec_id);
  const expires_at = Number(sigToken.split('|')[1]);

  let avatar_url = null;
  if (isKvConfigured()) {
    try { avatar_url = await kvGet('avatar_url:' + member_rec_id); } catch {}
  }

  return res.status(200).json({
    success: true,
    token: sigToken,
    expires_at,
    member: {
      record_id:    member.record_id,
      name:         member.name || '',
      nickname:     member.nickname || '',
      avatar_token: member.avatar?.file_token || null,
      avatar_url,
    },
  });
}
