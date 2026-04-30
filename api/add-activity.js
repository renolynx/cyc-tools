/**
 * POST /api/add-activity
 * 将活动信息写入飞书多维表格「📅活动日历」
 */

import { getCurrentPassword } from './_password.js';
import { applyCors, getAccessToken, checkFeishuEnv } from './_feishu.js';
import { kvDel, isKvConfigured } from './_kv.js';
import { replaceSpeakerRsvps }                                                  from './_rsvp.js';
import { fetchAllMembers, autoCreateMember, matchSpeaker, splitSpeakerNames }  from './_member.js';

/** 把 spk 数组里每个 entry 的 name 按标点拆开，膨胀成多个 entry
 *  bio 跟到第一个；其他人 bio 设空（共享 bio 没法判断归谁）
 */
function expandSpeakers(sp) {
  const out = [];
  for (const s of (sp || [])) {
    if (!s) continue;
    const names = splitSpeakerNames(s.name);
    if (!names.length) continue;
    out.push({ name: names[0], bio: s.bio || '' });
    for (let i = 1; i < names.length; i++) out.push({ name: names[i], bio: '' });
  }
  return out;
}

/** 上传海报到飞书云文档，返回 file_token */
async function uploadPoster(poster, token, appToken) {
  const buffer   = Buffer.from(poster.base64, 'base64');
  const formData = new FormData();
  formData.append('file_name',   poster.name || 'poster.jpg');
  formData.append('parent_type', 'bitable_file');
  formData.append('parent_node', appToken);
  formData.append('size',        buffer.length.toString());
  formData.append('file',
    new Blob([buffer], { type: poster.type || 'image/jpeg' }),
    poster.name || 'poster.jpg'
  );

  const res  = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    formData,
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`海报上传失败 (${data.code}): ${data.msg}`);
  return data.data.file_token;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { activity, date, password } = req.body || {};
  if (!activity || !date)
    return res.status(400).json({ error: '缺少 activity 或 date 参数' });

  // 密码校验（KV 优先，fallback 到 SYNC_PASSWORD env var）
  const currentPwd = await getCurrentPassword();
  if (currentPwd && password !== currentPwd)
    return res.status(401).json({ error: '密码错误' });

  const envErr = checkFeishuEnv();
  if (envErr) return res.status(500).json({ error: envErr });

  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;

  try {
    // ── 1. 获取 tenant_access_token ──
    const token = await getAccessToken();

    // ── 2. 组装字段 ──
    const fields = {};

    if (activity.title) fields['标题'] = activity.title;

    fields['意向/确认举办日期'] = new Date(date + 'T00:00:00+08:00').getTime();

    if (activity.loc) fields['地点'] = activity.loc;

    // 发起者（带领人/嘉宾）
    const sp = (activity.spk || []).filter(s => s.name || s.bio);
    if (sp.length)
      fields['发起者'] = sp.map(s => s.name + (s.bio ? '，' + s.bio : '')).join('\n');

    // 活动/项目描述（综合字段）
    const descParts = [];
    if (activity.time)   descParts.push(`⏰ 时间：${activity.time}`);
    if (activity.fee)    descParts.push(`💰 费用：${activity.fee}`);
    if (activity.signup) descParts.push(`🙋 报名：${activity.signup}`);
    if (activity.desc)   descParts.push(`\n${activity.desc}`);
    const fl = (activity.flow || []).filter(Boolean);
    if (fl.length)       descParts.push(`\n🗓️ 流程：\n${fl.join('\n')}`);
    if (descParts.length) fields['活动/项目描述'] = descParts.join('\n');

    // 目前状态（单选）
    if (activity.status) fields['目前状态'] = activity.status;

    // 活动海报（附件，需要先上传拿 file_token）
    if (activity.poster?.base64) {
      const fileToken = await uploadPoster(activity.poster, token, FEISHU_APP_TOKEN);
      fields['活动海报'] = [{ file_token: fileToken }];
    }

    // 活动类型（multi-select；飞书可能还没加这字段 → 写失败时去掉重试）
    // 总是显式写（含空数组），覆盖飞书表的"字段默认值"配置（否则 POST 新建时
    // 飞书会用 schema 默认值自动填，导致用户看到莫名其妙的标签）
    const hadUserTypes = Array.isArray(activity.types) && activity.types.length > 0;
    if (Array.isArray(activity.types)) {
      fields['活动类型'] = activity.types;
    }

    // 来源标记
    fields['SourceID'] = 'cyc-tools';

    // ── 3. 新建 or 更新 ──
    const hasRecord = Boolean(activity.record_id);
    const url = hasRecord
      ? `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${activity.record_id}`
      : `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`;

    let writeFn = async (fieldsToSend) => {
      const r = await fetch(url, {
        method:  hasRecord ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fields: fieldsToSend }),
      });
      return r.json();
    };

    let recordData = await writeFn(fields);
    let typesDropped = false;
    // 飞书字段不存在 / 类型不匹配 → 1254045 (字段不存在) / 1254050 (字段类型不匹配)
    // 兜底：当返回错误且 fields 含「活动类型」时，剔除该字段重试一次
    if (recordData.code !== 0 && fields['活动类型'] !== undefined) {
      console.warn(`[add-activity] 「活动类型」字段写入失败 (${recordData.code}): ${recordData.msg} — 重试不带 types`);
      const { ['活动类型']: _drop, ...fieldsNoTypes } = fields;
      recordData = await writeFn(fieldsNoTypes);
      // 仅在用户真的勾过 chip 的情况下提示用户（空数组场景的失败用户不关心）
      typesDropped = hadUserTypes;
    }
    if (recordData.code !== 0)
      throw new Error(`${hasRecord ? '更新' : '写入'}失败 (${recordData.code}): ${recordData.msg}`);

    const newRecordId = recordData.data.record.record_id;

    // 失效相关 KV 缓存（让 /events 立刻反映新数据）
    if (isKvConfigured()) {
      await Promise.all([
        kvDel('event:' + newRecordId),
        kvDel('events:upcoming'),
        kvDel('sitemap:acts'),
      ]).catch(e => console.error('[add-activity] cache invalidate failed:', e));
    }

    // 嘉宾联动：自动写「角色=活动发起者」的 RSVP 记录（失败不阻塞主流程）
    // 即使 sp 为空也调用，确保编辑活动后删掉嘉宾时旧 RSVP 也跟着清掉
    let speakerSync = null;
    try {
      const speakers      = [];
      const namesMatched  = [];
      const namesCreated  = [];
      const namesFailed   = [];
      // 拆分多人塞一行的情况（"a, b" / "a;b" / "a、b" / "a/b"）
      const expanded = expandSpeakers(sp);
      if (expanded.length) {
        const allMembers = await fetchAllMembers();
        for (const s of expanded) {
          if (!s.name) continue;
          let m = matchSpeaker(allMembers, s.name);
          if (m) {
            namesMatched.push(s.name);
          } else {
            // 没匹配上 → 自动建一条最小成员（仅 name + bio，无 wechat）
            try {
              const newId = await autoCreateMember({
                name:   s.name,
                bio:    s.bio || '',
                source: '嘉宾联动自动建',
              });
              m = { record_id: newId, name: s.name, nickname: s.name, bio: s.bio || '' };
              allMembers.push(m);  // 同名嘉宾不再重复触发建
              namesCreated.push(s.name);
            } catch (err) {
              console.warn('[add-activity] auto-create member failed:', s.name, err.message);
              namesFailed.push(s.name);
              m = null;
            }
          }
          speakers.push({ name: s.name, bio: s.bio || '', member_rec_id: m?.record_id || '' });
        }
      }
      const result = await replaceSpeakerRsvps(newRecordId, activity.title || '', speakers);
      speakerSync = {
        ...result,
        names_matched:      namesMatched,
        names_auto_created: namesCreated,
        names_create_failed: namesFailed,
      };
    } catch (err) {
      console.error('[add-activity] speaker sync failed:', err.message);
      speakerSync = { error: err.message };
    }

    return res.status(200).json({
      success:       true,
      is_update:     hasRecord,
      record_id:     newRecordId,
      speaker_sync:  speakerSync,
      types_dropped: typesDropped || undefined,  // 飞书没建「活动类型」字段时为 true
    });

  } catch (err) {
    console.error('[add-activity]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
