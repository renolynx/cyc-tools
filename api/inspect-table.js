/**
 * GET /api/inspect-table?app_token={X}&table_id={Y}&password={Z}
 * 一次性表结构探查工具：
 *   - 列出指定多维表格的全部字段（含字段名、类型、ID）
 *   - 列出前 3 条样本数据（脱敏：仅展示字段名+值类型）
 * 用于设计阶段快速摸清外部表的 schema。
 */

import { applyCors, getAccessToken } from './_feishu.js';
import { verifyPassword } from './_password.js';

const TYPE_MAP = {
  1: '文本', 2: '数字', 3: '单选', 4: '多选', 5: '日期',
  7: '复选框', 11: '人员', 13: '电话', 15: '超链接', 17: '附件',
  18: '关联', 19: '查找引用', 20: '公式', 21: '双向关联',
  22: '地理位置', 23: '群组', 1001: '创建时间', 1002: '修改时间',
  1003: '创建人', 1004: '修改人', 1005: '自动编号',
};

export default async function handler(req, res) {
  applyCors(res);

  const { app_token, table_id, password } = req.query;
  if (!app_token || !table_id)
    return res.status(400).json({ error: '需要 app_token 和 table_id 参数' });

  // 必须密码校验（避免被滥用扫表）
  const ok = await verifyPassword(password);
  if (!ok) return res.status(401).json({ error: '密码错误（用同步活动那个密码）' });

  try {
    const token = await getAccessToken();

    // 1. 拉字段
    const fieldsRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fieldsData = await fieldsRes.json();
    if (fieldsData.code !== 0)
      return res.status(500).json({ error: '字段读取失败: ' + fieldsData.msg, raw: fieldsData });

    const fields = (fieldsData.data?.items || []).map(f => ({
      field_name: f.field_name,
      field_id:   f.field_id,
      type:       TYPE_MAP[f.type] || `type_${f.type}`,
      type_code:  f.type,
    }));

    // 2. 拉前 3 条样本（用 search 而不是 list 才能保持顺序）
    const recordsRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records/search?page_size=3`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      }
    );
    const recordsData = await recordsRes.json();

    // 脱敏：只看字段类型和"是否非空"，不暴露真实内容
    const samples = (recordsData.data?.items || []).map(r => {
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

    return res.status(200).json({
      app_token,
      table_id,
      total_fields: fields.length,
      fields,
      sample_count: samples.length,
      samples,
    });

  } catch (err) {
    console.error('[inspect-table]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
