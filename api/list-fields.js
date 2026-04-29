/**
 * GET /api/list-fields[?app_token=X&table_id=Y&samples=1&password=Z]
 * 字段 + 可选样本探查（调试用，一次性）
 *
 * 不传参 → 用环境变量里的活动表
 * 传参 → 用指定 base/table（探查成员表等）
 * samples=1 → 同时返回前 3 条样本（脱敏，仅字段类型/长度）
 *           → 加了样本就强制要 password（防滥用）
 */

import { getAccessToken, checkFeishuEnv } from './_feishu.js';
import { verifyPassword } from './_password.js';

const TYPE_MAP = {
  1: '文本', 2: '数字', 3: '单选', 4: '多选', 5: '日期',
  7: '复选框', 11: '人员', 13: '电话', 15: '超链接', 17: '附件',
  18: '关联', 19: '查找引用', 20: '公式', 21: '双向关联',
  22: '地理位置', 23: '群组', 1001: '创建时间', 1002: '修改时间',
  1003: '创建人', 1004: '修改人', 1005: '自动编号',
  99001: '创建时间', 99002: '修改时间',
};

export default async function handler(req, res) {
  const envErr = checkFeishuEnv(['FEISHU_APP_ID','FEISHU_APP_SECRET']);
  if (envErr) return res.status(500).json({ error: envErr });

  const appToken = req.query.app_token || process.env.FEISHU_APP_TOKEN;
  const tableId  = req.query.table_id  || process.env.FEISHU_TABLE_ID;
  const wantSamples = req.query.samples === '1' || req.query.samples === 'true';

  if (!appToken || !tableId)
    return res.status(400).json({ error: '需要 app_token 和 table_id（query 或 env）' });

  // 想看样本 → 必须密码
  if (wantSamples) {
    const ok = await verifyPassword(req.query.password);
    if (!ok) return res.status(401).json({ error: '看 samples 需要密码（用同步活动那个）' });
  }

  try {
    const token = await getAccessToken();

    // 1. 字段
    const fieldsRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fieldsData = await fieldsRes.json();
    if (fieldsData.code !== 0)
      return res.status(500).json({ error: `字段读取失败 (${fieldsData.code}): ${fieldsData.msg}` });

    const fields = (fieldsData.data?.items || []).map(f => ({
      name:      f.field_name,
      field_id:  f.field_id,
      type:      TYPE_MAP[f.type] || `type_${f.type}`,
      type_code: f.type,
    }));

    const result = { app_token: appToken, table_id: tableId, total_fields: fields.length, fields };

    // 2. 可选：前 3 条样本（脱敏）
    if (wantSamples) {
      const recordsRes = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?page_size=3`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({}),
        }
      );
      const recordsData = await recordsRes.json();
      result.samples = (recordsData.data?.items || []).map(r => {
        const summary = {};
        for (const [k, v] of Object.entries(r.fields || {})) {
          if (v == null) summary[k] = 'null';
          else if (Array.isArray(v)) summary[k] = `array(len=${v.length})`;
          else if (typeof v === 'object') summary[k] = `object(keys=${Object.keys(v).join(',')})`;
          else if (typeof v === 'string') summary[k] = `string(len=${v.length})`;
          else summary[k] = `${typeof v}: ${v}`;
        }
        return summary;
      });
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
