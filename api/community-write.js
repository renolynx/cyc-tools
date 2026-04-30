/**
 * 成员写操作端点（admin 用，密码保护）
 *
 * POST /api/community-write
 * Body: {
 *   action:    'search' | 'create' | 'update' | 'get' | 'backfill-speakers',
 *   password:  string,                    // 必填，与 SYNC_PASSWORD 比对
 *   record_id?: string,                    // update / get 必填
 *   data?:     { ... },                    // create / update 时的字段
 *   query?:    string,                     // search 用
 *   cityFilter?: 'all' | '大理' | '上海' | 'hidden',
 *   // backfill-speakers 用：
 *   days?:     number (default 180),       // 处理过去多少天的活动
 *   offset?:   number (default 0),         // 分页偏移
 *   limit?:    number (default 5, max 10), // 单次处理多少个活动
 * }
 */

import { applyCors } from './_feishu.js';
import { verifyPassword } from './_password.js';
import {
  fetchAllMembers,
  fetchMember,
  writeMember,
  inferMemberActivityCities,
  matchSpeaker,
  autoCreateMember,
} from './_member.js';
import { fetchAllActivities }   from './_activity.js';
import { replaceSpeakerRsvps }  from './_rsvp.js';

/**
 * 拉所有成员 + 给每条加 inferredCities 字段（活动反推）
 * 服务端不做 city/hidden 过滤，客户端拿全集自己筛 → tab 切换瞬时
 */
async function handleSearch(req, res) {
  const [members, inferredMap] = await Promise.all([
    fetchAllMembers(),
    inferMemberActivityCities(),
  ]);

  const enriched = members.map(m => ({
    ...m,
    inferredCities: [...(inferredMap.get(m.record_id) || [])],
  }));

  return res.status(200).json({
    success: true,
    count: enriched.length,
    members: enriched,
  });
}

async function handleCreate(req, res) {
  const data = req.body.data || {};
  if (!data.name || !data.name.trim()) return res.status(400).json({ error: '请填写姓名' });

  try {
    const result = await writeMember(data);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[community-write create]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleUpdate(req, res) {
  const record_id = req.body.record_id;
  const data = req.body.data || {};
  if (!record_id) return res.status(400).json({ error: '缺 record_id' });

  try {
    const result = await writeMember(data, record_id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[community-write update]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGet(req, res) {
  // 取单条完整记录（含私密）给编辑表单 prefill 用
  const id = req.body.record_id;
  if (!id) return res.status(400).json({ error: '缺 record_id' });
  const m = await fetchMember(id);
  if (!m) return res.status(404).json({ error: '成员不存在' });
  return res.status(200).json({ success: true, member: m });
}

/**
 * 批量回扫活动嘉宾 → 触发 RSVP 同步 + 自动建成员
 *
 * 分页防 60s timeout：每次处理 limit 个，前端循环到 next_offset == null
 *
 * 第一次调用（offset=0）会拉一遍全部活动 + 全部成员，按近 days 天 + 有 spk 过滤
 * 后续批次复用前端记忆的 offset；每批内自己再拉一次成员表（保证看到本轮新建的）
 */
async function handleBackfillSpeakers(req, res) {
  const days   = Math.max(1, Math.min(730, Number(req.body.days   || 180)));
  const offset = Math.max(0,                  Number(req.body.offset || 0));
  const limit  = Math.max(1, Math.min(10,    Number(req.body.limit  || 5)));

  // 1. 候选活动
  const past = new Date(Date.now() + 8*3600*1000 - days*86400*1000).toISOString().slice(0,10);
  let acts;
  try {
    acts = await fetchAllActivities();
  } catch (err) {
    return res.status(500).json({ error: '拉活动失败：' + err.message });
  }
  const targets = acts
    .filter(a => a.date && a.title && Array.isArray(a.spk) && a.spk.length)
    .filter(a => a.date >= past)
    .sort((a, b) => a.date < b.date ? 1 : -1);  // 最近的在前

  const total = targets.length;
  const slice = targets.slice(offset, offset + limit);
  const nextOffset = (offset + limit < total) ? (offset + limit) : null;

  // 2. 拉成员表（每批一次，看到上一批新建的）
  const allMembers = await fetchAllMembers();
  const details = [];
  let summaryMatched = 0, summaryCreated = 0, summaryFailed = 0;

  for (const a of slice) {
    const speakers = [];
    const namesMatched = [], namesCreated = [], namesFailed = [];
    for (const s of a.spk) {
      if (!s || !s.name) continue;
      let m = matchSpeaker(allMembers, s.name);
      if (m) {
        namesMatched.push(s.name);
      } else {
        try {
          const newId = await autoCreateMember({
            name: s.name, bio: s.bio || '', source: '嘉宾联动批量回扫',
          });
          m = { record_id: newId, name: s.name, nickname: s.name, bio: s.bio || '' };
          allMembers.push(m);
          namesCreated.push(s.name);
        } catch (err) {
          console.warn('[backfill] auto-create failed:', s.name, err.message);
          namesFailed.push(s.name);
          m = null;
        }
      }
      speakers.push({ name: s.name, bio: s.bio || '', member_rec_id: m?.record_id || '' });
    }

    let written = 0, removed = 0, syncErr = null;
    try {
      const r = await replaceSpeakerRsvps(a.record_id, a.title, speakers);
      written = r.written; removed = r.removed;
    } catch (err) {
      console.warn('[backfill] sync failed:', a.title, err.message);
      syncErr = err.message;
    }

    summaryMatched += namesMatched.length;
    summaryCreated += namesCreated.length;
    summaryFailed  += namesFailed.length;

    details.push({
      record_id:  a.record_id,
      title:      a.title,
      date:       a.date,
      written,
      removed,
      names_matched:       namesMatched,
      names_auto_created:  namesCreated,
      names_create_failed: namesFailed,
      ...(syncErr ? { error: syncErr } : {}),
    });
  }

  return res.status(200).json({
    success:     true,
    total,
    range:       [offset, offset + slice.length],
    next_offset: nextOffset,
    summary: {
      matched: summaryMatched,
      created: summaryCreated,
      failed:  summaryFailed,
    },
    details,
  });
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action, password } = req.body || {};

  // 密码校验（用 SYNC_PASSWORD）
  if (!await verifyPassword(password)) {
    return res.status(401).json({ error: '密码错误' });
  }

  if (action === 'search')             return handleSearch(req, res);
  if (action === 'get')                return handleGet(req, res);
  if (action === 'create')             return handleCreate(req, res);
  if (action === 'update')             return handleUpdate(req, res);
  if (action === 'backfill-speakers')  return handleBackfillSpeakers(req, res);

  return res.status(400).json({ error: `unknown action: ${action}` });
}
