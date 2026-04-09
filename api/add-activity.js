/**
 * POST /api/add-activity
 * 将活动信息写入飞书多维表格
 *
 * ── 字段映射：左边 = 你的飞书表格字段名，右边不要改 ──
 * 如果某个字段在你的表格里不存在，把左边改成 null 即可跳过
 */
const FIELD_MAP = {
  title:  '活动标题',
  date:   '日期',        // 飞书日期字段，会自动转时间戳
  time:   '时间段',
  loc:    '地点',
  fee:    '费用',
  signup: '报名方式',
  desc:   '活动简介',
  flow:   '活动流程',    // 多行文本，换行分隔
  spk:    '带领人',      // 多行文本，换行分隔
};

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { activity, date } = req.body || {};
  if (!activity || !date) {
    return res.status(400).json({ error: '缺少 activity 或 date 参数' });
  }

  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_APP_TOKEN || !FEISHU_TABLE_ID) {
    return res.status(500).json({ error: '服务端飞书环境变量未配置' });
  }

  try {
    // ── Step 1: 获取 tenant_access_token ──
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

    // ── Step 2: 组装字段 ──
    const fields = {};

    if (FIELD_MAP.title  && activity.title)  fields[FIELD_MAP.title]  = activity.title;
    if (FIELD_MAP.time   && activity.time)   fields[FIELD_MAP.time]   = activity.time;
    if (FIELD_MAP.loc    && activity.loc)    fields[FIELD_MAP.loc]    = activity.loc;
    if (FIELD_MAP.fee    && activity.fee)    fields[FIELD_MAP.fee]    = activity.fee;
    if (FIELD_MAP.signup && activity.signup) fields[FIELD_MAP.signup] = activity.signup;
    if (FIELD_MAP.desc   && activity.desc)   fields[FIELD_MAP.desc]   = activity.desc;

    // 日期字段：飞书需要毫秒时间戳
    if (FIELD_MAP.date && date) {
      fields[FIELD_MAP.date] = new Date(date + 'T00:00:00+08:00').getTime();
    }

    // 活动流程：数组 → 换行拼接
    const fl = (activity.flow || []).filter(Boolean);
    if (FIELD_MAP.flow && fl.length) fields[FIELD_MAP.flow] = fl.join('\n');

    // 带领人：数组 → 换行拼接
    const sp = (activity.spk || []).filter(s => s.name || s.bio);
    if (FIELD_MAP.spk && sp.length) {
      fields[FIELD_MAP.spk] = sp.map(s => s.name + (s.bio ? '，' + s.bio : '')).join('\n');
    }

    // ── Step 3: 写入多维表格 ──
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
