/**
 * POST /api/delete-activity
 * 删除飞书多维表格中的指定活动记录
 * Body: { record_id: string, password: string }
 */

import { getCurrentPassword } from './_password.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { record_id, password } = req.body || {};
  if (!record_id)
    return res.status(400).json({ error: '缺少 record_id 参数' });

  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;

  // 密码校验（与 add-activity 共用，KV 优先 fallback 到 SYNC_PASSWORD env var）
  const currentPwd = await getCurrentPassword();
  if (currentPwd && password !== currentPwd)
    return res.status(401).json({ error: '密码错误' });

  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_APP_TOKEN || !FEISHU_TABLE_ID)
    return res.status(500).json({ error: '服务端飞书环境变量未配置' });

  try {
    // ── 1. 获取 tenant_access_token ──
    const authRes  = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
      }
    );
    const authData = await authRes.json();
    if (authData.code !== 0) throw new Error(`飞书鉴权失败: ${authData.msg}`);
    const token = authData.tenant_access_token;

    // ── 2. 调用飞书 DELETE 接口 ──
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${record_id}`;
    const delRes  = await fetch(url, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const delData = await delRes.json();

    // 找不到记录也当作成功（可能已被手动删除过）
    if (delData.code !== 0 && delData.code !== 1254043) {
      throw new Error(`删除失败 (${delData.code}): ${delData.msg}`);
    }

    return res.status(200).json({
      success:   true,
      record_id,
      deleted:   delData.data?.deleted ?? true,
    });

  } catch (err) {
    console.error('[delete-activity]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
