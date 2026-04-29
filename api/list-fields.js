/**
 * GET /api/list-fields
 * 列出多维表格「活动日历」表的所有字段名和类型（一次性调试用）
 */

import { getAccessToken, checkFeishuEnv } from './_feishu.js';

export default async function handler(req, res) {
  const envErr = checkFeishuEnv();
  if (envErr) return res.status(500).json({ error: envErr });

  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;

  try {
    const token = await getAccessToken();

    const fieldsRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fieldsData = await fieldsRes.json();
    if (fieldsData.code !== 0) throw new Error(`获取字段失败: ${fieldsData.msg}`);

    // 字段类型说明：1=文本 2=数字 3=单选 4=多选 5=日期 7=复选框 11=人员 ...
    const TYPE = {1:'文本',2:'数字',3:'单选',4:'多选',5:'日期',7:'复选框',
                  11:'人员',13:'电话',15:'超链接',17:'附件',18:'关联',99001:'创建时间',99002:'修改时间'};
    const fields = fieldsData.data.items.map(f => ({
      name: f.field_name,
      type: TYPE[f.type] || `type_${f.type}`,
      field_id: f.field_id,
    }));

    res.status(200).json({ table: FEISHU_TABLE_ID, fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
