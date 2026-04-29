/**
 * GET /api/list-tables
 * 列出多维表格里所有的数据表，用来查 table_id
 * 配置好环境变量后访问这个地址即可（一次性调试用）
 */

import { getAccessToken, checkFeishuEnv } from './_feishu.js';

export default async function handler(req, res) {
  const envErr = checkFeishuEnv(['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_APP_TOKEN']);
  if (envErr) return res.status(500).json({ error: envErr });

  const { FEISHU_APP_TOKEN } = process.env;

  try {
    const token = await getAccessToken();

    const tablesRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const tablesData = await tablesRes.json();
    if (tablesData.code !== 0) throw new Error(`获取表失败: ${tablesData.msg}`);

    const tables = tablesData.data.items.map(t => ({
      name:     t.name,
      table_id: t.table_id,
    }));

    res.status(200).json({ app_token: FEISHU_APP_TOKEN, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
