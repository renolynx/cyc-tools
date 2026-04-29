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
