/**
 * POST /api/add-activity
 * 将活动信息写入飞书多维表格「📅活动日历」
 *
 * 字段映射（根据 /api/list-fields 返回结果配置）：
 *   标题                → activity.title
 *   意向/确认举办日期    → date（转毫秒时间戳）
 *   地点                → activity.loc
 *   发起者              → activity.spk（带领人/嘉宾）
 *   活动/项目描述        → 综合描述（时间段 + 费用 + 报名 + 简介 + 流程）
 *   SourceID            → "cyc-tools"（来源标记）
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { activity, date } = req.body || {};
  if (!activity || !date) {
    return res.status(400).json({ error: '缺少 activity 或 date 参数' });
  }

  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_APP_TOKEN || !FEISHU_TABLE_ID) {
    return res.status(500).json({ error: '服务端飞书环境变量未配置' });
  }

  try {
    // ── 1. 获取 tenant_access_token ──
    const authRes = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
      }
    );
    const authData = await authRes.json();
    if (authData.code !== 0) throw new Error(`飞书鉴权失败: ${authData.msg}`);
    const token = authData.tenant_access_token;

    // ── 2. 组装字段 ──
    const fields = {};

    // 标题
    if (activity.title) fields['标题'] = activity.title;

    // 意向/确认举办日期（飞书日期字段需要毫秒时间戳）
    fields['意向/确认举办日期'] = new Date(date + 'T00:00:00+08:00').getTime();

    // 地点
    if (activity.loc) fields['地点'] = activity.loc;

    // 发起者（带领人/嘉宾姓名）
    const sp = (activity.spk || []).filter(s => s.name || s.bio);
    if (sp.length) {
      fields['发起者'] = sp.map(s => s.name + (s.bio ? '，' + s.bio : '')).join('\n');
    }

    // 活动/项目描述（综合字段：汇总时间段、费用、报名、简介、流程）
    const descParts = [];
    if (activity.time)   descParts.push(`⏰ 时间：${activity.time}`);
    if (activity.fee)    descParts.push(`💰 费用：${activity.fee}`);
    if (activity.signup) descParts.push(`🙋 报名：${activity.signup}`);
    if (activity.desc)   descParts.push(`\n${activity.desc}`);
    const fl = (activity.flow || []).filter(Boolean);
    if (fl.length)       descParts.push(`\n🗓️ 流程：\n${fl.join('\n')}`);
    if (descParts.length) fields['活动/项目描述'] = descParts.join('\n');

    // 来源标记
    fields['SourceID'] = 'cyc-tools';

    // ── 3. 写入多维表格 ──
    const recordRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );
    const recordData = await recordRes.json();
    if (recordData.code !== 0) throw new Error(`写入失败 (${recordData.code}): ${recordData.msg}`);

    return res.status(200).json({
      success: true,
      record_id: recordData.data.record.record_id,
    });

  } catch (err) {
    console.error('[add-activity]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
