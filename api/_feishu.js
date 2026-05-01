/**
 * 飞书 API 共用辅助
 * - getAccessToken(): 获取 tenant_access_token
 * - applyCors(res):   统一设置 CORS 响应头
 */

/** 设置 API 路由通用 CORS 头 */
export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** 拿 tenant_access_token，鉴权失败抛错 */
export async function getAccessToken() {
  const { FEISHU_APP_ID, FEISHU_APP_SECRET } = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET)
    throw new Error('飞书凭证未配置 (FEISHU_APP_ID / FEISHU_APP_SECRET)');

  const res = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error('飞书鉴权失败: ' + data.msg);
  return data.tenant_access_token;
}

/** 检查必需的环境变量是否齐全；缺失返回错误信息字符串，齐全返回 null */
export function checkFeishuEnv(required = ['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_APP_TOKEN','FEISHU_TABLE_ID']) {
  const missing = required.filter(k => !process.env[k]);
  return missing.length ? `服务端环境变量未配置: ${missing.join(', ')}` : null;
}

/**
 * 拉飞书某张表的所有字段元数据（带 KV 缓存 24h）
 *   返回 [{ field_id, field_name, type, ui_type, property?, is_primary? }]
 *
 * 用途：
 *   - admin 排查"为啥某字段读不到" → 看实际字段名是不是被改了
 *   - 未来重构成 field_id 寻址时这就是数据源
 *   - schema 自检 cron（验证关键字段还在）
 *
 * 飞书 API: GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/fields
 *   doc: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-field/list
 */
export async function fetchTableFields(appToken, tableId) {
  if (!appToken || !tableId) throw new Error('fetchTableFields 需要 appToken + tableId');

  // 缓存（命中率高，admin 多次查同一表时省 API）
  let kv;
  try { kv = await import('./_kv.js'); } catch {}
  const cacheKey = `feishu_fields:${appToken}:${tableId}`;
  if (kv?.isKvConfigured?.()) {
    try {
      const cached = await kv.kvGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书字段拉取失败 (${data.code}): ${data.msg}`);

  const fields = (data.data?.items || []).map(f => ({
    field_id:    f.field_id,
    field_name:  f.field_name,
    type:        f.type,           // 1=text, 4=multi-select, 11=person, 17=attachment, 18=link, 19=lookup
    ui_type:     f.ui_type,
    is_primary:  f.is_primary,
    description: f.description,
    property:    f.property,        // multi-select 的 options 等
  }));

  if (kv?.isKvConfigured?.()) {
    try { await kv.kvSet(cacheKey, JSON.stringify(fields), 86400); } catch {}
  }
  return fields;
}
