/**
 * POST /api/get-activities
 * 读取飞书多维表格指定周内的活动记录
 * Body: { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD' }
 */

/** 时间戳 → 'YYYY-MM-DD' (北京时间) */
function tsToDate(ts) {
  if (!ts) return null;
  const d = new Date(Number(ts));
  // 转北京时间
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

/** 解析「活动/项目描述」综合字段 → 拆回各子字段 */
function parseDesc(raw, activity) {
  if (!raw) return;
  // 飞书文本字段可能是富文本数组或纯字符串
  const text = Array.isArray(raw)
    ? raw.map(seg => seg.text || '').join('')
    : String(raw);

  const lines = text.split('\n');
  const descLines = [];
  const flowLines = [];
  let inFlow = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('⏰ 时间：'))    { activity.time   = t.replace('⏰ 时间：', '');   continue; }
    if (t.startsWith('💰 费用：'))    { activity.fee    = t.replace('💰 费用：', '');   continue; }
    if (t.startsWith('🙋 报名：'))    { activity.signup = t.replace('🙋 报名：', '');   continue; }
    if (t.startsWith('🗓️ 流程：'))   { inFlow = true;                                  continue; }
    if (inFlow) { flowLines.push(t); continue; }
    descLines.push(t);
  }
  activity.desc = descLines.join('\n');
  activity.flow = flowLines;
}

/** 解析单条飞书 record → 工具 activity 格式 */
function parseRecord(record) {
  const f   = record.fields || {};
  const act = {
    record_id: record.record_id,
    title:  getText(f['标题'])  || '',
    date:   tsToDate(f['意向/确认举办日期']) || '',
    loc:    getText(f['地点'])  || '',
    status: getSelect(f['目前状态']) || '',
    poster: getPoster(f['活动海报']),
    time: '', fee: '', signup: '', desc: '',
    flow: [], spk: [],
  };

  // 发起者 → spk 数组
  const spkRaw = getText(f['发起者']);
  if (spkRaw) {
    act.spk = spkRaw.split('\n')
      .map(line => {
        const idx  = line.indexOf('，');
        const name = idx >= 0 ? line.slice(0, idx).trim() : line.trim();
        const bio  = idx >= 0 ? line.slice(idx + 1).trim() : '';
        return { name, bio };
      })
      .filter(s => s.name);
  }

  parseDesc(f['活动/项目描述'], act);
  return act;
}

function getText(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.map(s => s.text || '').join('');
  return String(v);
}
function getSelect(v) {
  if (!v) return '';
  if (typeof v === 'object' && v.text) return v.text;
  return String(v);
}
function getPoster(v) {
  if (!Array.isArray(v) || !v.length) return null;
  const f = v[0];
  return { file_token: f.file_token, name: f.name, url: f.url, type: f.type };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { weekStart, weekEnd } = req.body || {};
  if (!weekStart || !weekEnd)
    return res.status(400).json({ error: '缺少 weekStart / weekEnd' });

  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_APP_TOKEN || !FEISHU_TABLE_ID)
    return res.status(500).json({ error: '服务端环境变量未配置' });

  try {
    // 1. 鉴权
    const authRes  = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }) }
    );
    const { code: ac, msg: am, tenant_access_token: token } = await authRes.json();
    if (ac !== 0) throw new Error(`鉴权失败: ${am}`);

    // 2. 搜索当周记录（用日期范围过滤）
    const startTs = new Date(weekStart + 'T00:00:00+08:00').getTime();
    const endTs   = new Date(weekEnd   + 'T23:59:59+08:00').getTime();

    const searchRes  = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/search?page_size=50`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          filter: {
            conjunction: 'and',
            conditions: [
              { field_name: '意向/确认举办日期', operator: 'isGreaterEqual', value: ['ExactDate', startTs] },
              { field_name: '意向/确认举办日期', operator: 'isLessEqual',    value: ['ExactDate', endTs]   },
            ],
          },
          sort: [{ field_name: '意向/确认举办日期', desc: false }],
        }),
      }
    );
    const searchData = await searchRes.json();
    if (searchData.code !== 0) throw new Error(`搜索失败: ${searchData.msg}`);

    const activities = (searchData.data?.items || []).map(parseRecord);
    return res.status(200).json({ success: true, count: activities.length, activities });

  } catch (err) {
    console.error('[get-activities]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
