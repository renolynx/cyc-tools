/**
 * POST /api/add-activity
 * 将活动信息写入飞书多维表格「📅活动日历」
 */

import { getCurrentPassword } from './_password.js';
import { applyCors, getAccessToken, checkFeishuEnv } from './_feishu.js';

/** 上传海报到飞书云文档，返回 file_token */
async function uploadPoster(poster, token, appToken) {
  const buffer   = Buffer.from(poster.base64, 'base64');
  const formData = new FormData();
  formData.append('file_name',   poster.name || 'poster.jpg');
  formData.append('parent_type', 'bitable_file');
  formData.append('parent_node', appToken);
  formData.append('size',        buffer.length.toString());
  formData.append('file',
    new Blob([buffer], { type: poster.type || 'image/jpeg' }),
    poster.name || 'poster.jpg'
  );

  const res  = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    formData,
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`海报上传失败 (${data.code}): ${data.msg}`);
  return data.data.file_token;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { activity, date, password } = req.body || {};
  if (!activity || !date)
    return res.status(400).json({ error: '缺少 activity 或 date 参数' });

  // 密码校验（KV 优先，fallback 到 SYNC_PASSWORD env var）
  const currentPwd = await getCurrentPassword();
  if (currentPwd && password !== currentPwd)
    return res.status(401).json({ error: '密码错误' });

  const envErr = checkFeishuEnv();
  if (envErr) return res.status(500).json({ error: envErr });

  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;

  try {
    // ── 1. 获取 tenant_access_token ──
    const token = await getAccessToken();

    // ── 2. 组装字段 ──
    const fields = {};

    if (activity.title) fields['标题'] = activity.title;

    fields['意向/确认举办日期'] = new Date(date + 'T00:00:00+08:00').getTime();

    if (activity.loc) fields['地点'] = activity.loc;

    // 发起者（带领人/嘉宾）
    const sp = (activity.spk || []).filter(s => s.name || s.bio);
    if (sp.length)
      fields['发起者'] = sp.map(s => s.name + (s.bio ? '，' + s.bio : '')).join('\n');

    // 活动/项目描述（综合字段）
    const descParts = [];
    if (activity.time)   descParts.push(`⏰ 时间：${activity.time}`);
    if (activity.fee)    descParts.push(`💰 费用：${activity.fee}`);
    if (activity.signup) descParts.push(`🙋 报名：${activity.signup}`);
    if (activity.desc)   descParts.push(`\n${activity.desc}`);
    const fl = (activity.flow || []).filter(Boolean);
    if (fl.length)       descParts.push(`\n🗓️ 流程：\n${fl.join('\n')}`);
    if (descParts.length) fields['活动/项目描述'] = descParts.join('\n');

    // 目前状态（单选）
    if (activity.status) fields['目前状态'] = activity.status;

    // 活动海报（附件，需要先上传拿 file_token）
    if (activity.poster?.base64) {
      const fileToken = await uploadPoster(activity.poster, token, FEISHU_APP_TOKEN);
      fields['活动海报'] = [{ file_token: fileToken }];
    }

    // 来源标记
    fields['SourceID'] = 'cyc-tools';

    // ── 3. 新建 or 更新 ──
    const hasRecord = Boolean(activity.record_id);
    const url = hasRecord
      ? `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${activity.record_id}`
      : `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`;

    const recordRes  = await fetch(url, {
      method:  hasRecord ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields }),
    });
    const recordData = await recordRes.json();
    if (recordData.code !== 0)
      throw new Error(`${hasRecord ? '更新' : '写入'}失败 (${recordData.code}): ${recordData.msg}`);

    return res.status(200).json({
      success:   true,
      is_update: hasRecord,
      record_id: recordData.data.record.record_id,
    });

  } catch (err) {
    console.error('[add-activity]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
