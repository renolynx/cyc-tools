/**
 * GET /api/list-tables
 * 列出多维表格里所有的数据表，用来查 table_id
 * 配置好环境变量后访问这个地址即可
 */
export default async function handler(req, res) {
  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN } = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_APP_TOKEN) {
    return res.status(500).json({ error: '环境变量未配置' });
  }

  try {
    // 获取 token
    const authRes = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
      }
    );
    const { code, msg, tenant_access_token } = await authRes.json();
    if (code !== 0) throw new Error(`鉴权失败: ${msg}`);

    // 列出所有表
    const tablesRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables`,
      { headers: { Authorization: `Bearer ${tenant_access_token}` } }
    );
    const tablesData = await tablesRes.json();
    if (tablesData.code !== 0) throw new Error(`获取表失败: ${tablesData.msg}`);

    const tables = tablesData.data.items.map(t => ({
      name: t.name,
      table_id: t.table_id,
    }));

    res.status(200).json({ app_token: FEISHU_APP_TOKEN, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
