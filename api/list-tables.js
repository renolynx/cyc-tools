/**
 * GET /api/list-tables[?app_token=X]
 * 列出多维表格的所有数据表
 * 不传 app_token 用环境变量里的（活动表那个 base）；
 * 传了就用指定 base（例如成员表那个 base）。
 * 一次性调试用。
 */

import { getAccessToken, checkFeishuEnv } from './_feishu.js';

export default async function handler(req, res) {
  const envErr = checkFeishuEnv(['FEISHU_APP_ID','FEISHU_APP_SECRET']);
  if (envErr) return res.status(500).json({ error: envErr });

  const appToken = req.query.app_token || process.env.FEISHU_APP_TOKEN;
  if (!appToken) return res.status(400).json({ error: '缺 app_token（query 或 env 任选其一）' });

  try {
    const token = await getAccessToken();

    const tablesRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const tablesData = await tablesRes.json();
    if (tablesData.code !== 0)
      return res.status(500).json({ error: `获取表失败 (${tablesData.code}): ${tablesData.msg}`, raw: tablesData });

    const tables = tablesData.data.items.map(t => ({
      name:     t.name,
      table_id: t.table_id,
    }));

    res.status(200).json({ app_token: appToken, count: tables.length, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
