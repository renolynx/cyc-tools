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
  deleteMember,
  inferMemberActivityCities,
  aggregateMemberRoles,
  aggregateMemberTopTypes,
  aggregateMemberLastRsvp,
  matchSpeaker,
  autoCreateMember,
  splitSpeakerNames,
} from './_member.js';
import { fetchAllActivities }                       from './_activity.js';
import { replaceSpeakerRsvps,
         fetchRsvpsByMember,
         updateRsvpMemberLink }                     from './_rsvp.js';
import { kvDel, isKvConfigured }                    from './_kv.js';

/**
 * 拉所有成员 + 给每条加 inferredCities 字段（活动反推）
 * 服务端不做 city/hidden 过滤，客户端拿全集自己筛 → tab 切换瞬时
 */
async function handleSearch(req, res) {
  const [members, inferredMap, roleMap, typeMap, lastRsvpMap] = await Promise.all([
    fetchAllMembers(),
    inferMemberActivityCities(),
    aggregateMemberRoles(),
    aggregateMemberTopTypes(),
    aggregateMemberLastRsvp(),
  ]);

  const enriched = members.map(m => {
    const lastRsvpAt = lastRsvpMap.get(m.record_id) || 0;
    const lastActiveAt = Math.max(m.lastModifiedAt || 0, lastRsvpAt);
    return {
      ...m,
      inferredCities: [...(inferredMap.get(m.record_id) || [])],
      roleStats:      roleMap.get(m.record_id) || {},
      topTypes:       typeMap.get(m.record_id) || [],
      lastActiveAt,
    };
  });

  // 同 fetchMembersByCity：参与度 desc → tie 时最近活跃 desc
  enriched.sort((a, b) => {
    const sa = Object.values(a.roleStats || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    const sb = Object.values(b.roleStats || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    if (sb - sa) return sb - sa;
    return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
  });

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
  // 同时返回 RSVP 记录（关联活动 ID/标题/日期），让 admin 看到 ta 发起 / 嘉宾 / 参与过哪些活动
  const id = req.body.record_id;
  if (!id) return res.status(400).json({ error: '缺 record_id' });
  const [m, rsvps, allActs] = await Promise.all([
    fetchMember(id),
    fetchRsvpsByMember(id),
    fetchAllActivities().catch(() => []),
  ]);
  if (!m) return res.status(404).json({ error: '成员不存在' });

  // 给每条 RSVP 拼上活动标题 / 日期（活动表是权威，RSVP 表里冗余字段不可信）
  const actMap = new Map(allActs.map(a => [a.record_id, a]));
  const rsvpsEnriched = rsvps.map(r => {
    const a = actMap.get(r.activity_rec_id);
    return {
      record_id:        r.record_id,
      activity_rec_id:  r.activity_rec_id,
      activity_title:   a?.title || r.activity_title || '(活动已删除)',
      activity_date:    a?.date  || '',
      roles:            r.roles || [],
      registered_at:    r.registered_at || 0,
    };
  });

  return res.status(200).json({ success: true, member: m, rsvps: rsvpsEnriched });
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
    // 拆分多人塞一行的情况（"a, b" / "a;b" / "a、b" / "a/b"）
    const expanded = [];
    for (const s of (a.spk || [])) {
      if (!s) continue;
      const parts = splitSpeakerNames(s.name);
      if (!parts.length) continue;
      expanded.push({ name: parts[0], bio: s.bio || '' });
      for (let i = 1; i < parts.length; i++) expanded.push({ name: parts[i], bio: '' });
    }
    for (const s of expanded) {
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

// ─────────── 清缓存 ───────────

/**
 * 强制清掉公开/admin 列表相关的 KV 缓存
 * 用于：schema 改动、合并/创建后想立刻看到效果（默认 30min TTL 太长）
 *
 * 不要太频繁调（飞书 API 速率限制）；正常合并/编辑端点已自动清相应 key
 */
async function handleClearCache(req, res) {
  if (!isKvConfigured()) return res.status(200).json({ success: true, kv: 'not configured' });
  const keys = [
    'members:大理',
    'members:上海',
    'rsvp:all',
    'member_activity_cities',
  ];
  await Promise.all(keys.map(k => kvDel(k))).catch(() => {});
  return res.status(200).json({ success: true, cleared: keys });
}

// ─────────── 活动类型分布排查（admin 用）───────────

/**
 * 列出当前活动表里每个「活动类型」标签覆盖的活动列表
 * 用于排查脏数据：「为啥这么多活动都被标了 X 标签？」
 *
 * Body: { action:'list-activity-types', password }
 * Response: {
 *   success, total_activities, untyped, types: [
 *     { type, count, sample: [{record_id, title, date, types}] }
 *   ]
 * }
 */
async function handleListActivityTypes(req, res) {
  let acts;
  try { acts = await fetchAllActivities(); }
  catch (err) { return res.status(500).json({ error: '拉活动失败：' + err.message }); }

  const buckets = new Map();   // type → [{record_id, title, date, types}]
  let untyped = 0;
  for (const a of acts) {
    if (!a.types || !a.types.length) { untyped++; continue; }
    for (const t of a.types) {
      if (!buckets.has(t)) buckets.set(t, []);
      buckets.get(t).push({
        record_id: a.record_id,
        title:     a.title || '',
        date:      a.date  || '',
        types:     a.types,
      });
    }
  }

  const types = [...buckets.entries()]
    .map(([type, items]) => ({
      type,
      count: items.length,
      sample: items.slice(0, 20),  // 每个标签最多回传 20 个示例避免太大
    }))
    .sort((a, b) => b.count - a.count);

  return res.status(200).json({
    success: true,
    total_activities: acts.length,
    untyped,
    types,
  });
}

/**
 * 从所有活动的「活动类型」字段里批量扒掉指定 tags
 * 用于清理脏数据（如飞书 schema 默认值导致的"玩点新东西+中医理疗"被自动填进新活动）
 *
 * Body: { action:'strip-activity-types', password, strip:['玩点新东西','中医理疗'], dryRun?:bool }
 *   strip: 要从所有活动 types 里去掉的标签数组
 *   dryRun: 只统计不写入；默认 false（直接执行）
 *
 * Response: {
 *   success, total_scanned, affected, dryRun,
 *   details: [{record_id, title, before, after}]
 * }
 *
 * 直接 PUT 飞书活动表：fields['活动类型'] = filtered_types
 * 失效相关 KV cache（events:upcoming / event:* / sitemap:acts）
 */
async function handleStripActivityTypes(req, res) {
  const { strip, dryRun } = req.body || {};
  const stripSet = new Set(Array.isArray(strip) ? strip.filter(Boolean) : []);
  if (!stripSet.size) return res.status(400).json({ error: 'strip 数组不能为空' });

  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  if (!FEISHU_APP_TOKEN || !FEISHU_TABLE_ID) return res.status(500).json({ error: '活动表 env 未配' });

  let acts;
  try { acts = await fetchAllActivities(); }
  catch (err) { return res.status(500).json({ error: '拉活动失败：' + err.message }); }

  // 找出 types 中含任一 strip tag 的活动
  const candidates = acts.filter(a => Array.isArray(a.types) && a.types.some(t => stripSet.has(t)));

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun: true,
      total_scanned: acts.length,
      affected: candidates.length,
      details: candidates.map(a => ({
        record_id: a.record_id,
        title:     a.title || '',
        before:    a.types,
        after:     a.types.filter(t => !stripSet.has(t)),
      })),
    });
  }

  // 实际写入：逐条 PUT
  const { getAccessToken } = await import('./_feishu.js');
  const token = await getAccessToken();
  const details = [];
  const affectedIds = [];
  for (const a of candidates) {
    const after = a.types.filter(t => !stripSet.has(t));
    try {
      const r = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${a.record_id}`,
        {
          method:  'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ fields: { '活动类型': after } }),
        }
      );
      const data = await r.json();
      if (data.code !== 0) throw new Error(`code ${data.code}: ${data.msg}`);
      details.push({ record_id: a.record_id, title: a.title || '', before: a.types, after });
      affectedIds.push(a.record_id);
    } catch (err) {
      details.push({ record_id: a.record_id, title: a.title || '', error: err.message });
    }
  }

  // 失效活动 KV cache
  if (isKvConfigured()) {
    const ops = [
      kvDel('events:upcoming'),
      kvDel('sitemap:acts'),
      kvDel('members:大理'),  // top types 也会变
      kvDel('members:上海'),
    ];
    for (const id of affectedIds) ops.push(kvDel('event:' + id));
    await Promise.all(ops).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    dryRun: false,
    total_scanned: acts.length,
    affected: affectedIds.length,
    details,
  });
}

/**
 * 给单个活动设置「活动类型」字段（密码保护，活动详情页编辑入口）
 *
 * Body: { action:'set-activity-types', password, record_id, types:[] }
 * Response: { success, record_id, types, all_known_types:[] }
 *   all_known_types：返回值里附带全站已用过的所有 types 的 union（前端
 *   用作候选 chip 列表，无需额外 fetch 一次活动列表）
 */
async function handleSetActivityTypes(req, res) {
  const { record_id, types } = req.body || {};
  if (!record_id) return res.status(400).json({ error: '缺 record_id' });
  if (!Array.isArray(types)) return res.status(400).json({ error: 'types 必须是数组（可空）' });

  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  if (!FEISHU_APP_TOKEN || !FEISHU_TABLE_ID) return res.status(500).json({ error: '活动表 env 未配' });

  const cleanTypes = types.filter(Boolean).map(s => String(s).trim()).filter(Boolean);

  const { getAccessToken } = await import('./_feishu.js');
  const token = await getAccessToken();
  const r = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${record_id}`,
    {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields: { '活动类型': cleanTypes } }),
    }
  );
  const data = await r.json();
  if (data.code !== 0) return res.status(500).json({ error: `飞书写入失败 (${data.code}): ${data.msg}` });

  // 失效相关 KV cache
  if (isKvConfigured()) {
    await Promise.all([
      kvDel('event:' + record_id),
      kvDel('events:upcoming'),
      kvDel('sitemap:acts'),
      kvDel('members:大理'),
      kvDel('members:上海'),
    ]).catch(() => {});
  }

  // 顺手返回全站 types union 给前端做候选 chip
  let allKnownTypes = [];
  try {
    const acts = await fetchAllActivities();
    const set = new Set();
    for (const a of acts) for (const t of (a.types || [])) if (t) set.add(t);
    for (const t of cleanTypes) set.add(t);
    allKnownTypes = [...set].sort();
  } catch {}

  return res.status(200).json({
    success: true,
    record_id,
    types: cleanTypes,
    all_known_types: allKnownTypes,
  });
}

/**
 * 一次性扫所有 RSVP，把 name ≠ member_rec_id 指向成员 nickname/name 的修齐
 * 用于清理合并历史遗留的脏 name（合并悠扬→悠洋后 RSVP 仍叫"悠扬"）
 *
 * Body: { action:'resync-rsvp-names', password, dryRun? }
 * Response: { success, total_scanned, has_member, mismatched, fixed, details:[{rid, before, after}] }
 */
async function handleResyncRsvpNames(req, res) {
  const { dryRun } = req.body || {};
  const [rsvps, members] = await Promise.all([
    (await import('./_rsvp.js')).fetchAllRsvps(),
    fetchAllMembers(),
  ]);
  const memMap = new Map(members.map(m => [m.record_id, m]));

  const candidates = [];
  for (const r of rsvps) {
    if (!r.member_rec_id) continue;
    const m = memMap.get(r.member_rec_id);
    if (!m) continue;
    const target = (m.nickname || m.name || '').trim();
    if (!target) continue;
    const cur = (r.name || '').trim();
    if (cur === target) continue;
    candidates.push({ rid: r.record_id, before: cur, after: target, member_id: r.member_rec_id });
  }

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun: true,
      total_scanned: rsvps.length,
      has_member: rsvps.filter(r => r.member_rec_id).length,
      mismatched: candidates.length,
      details: candidates.slice(0, 100),
    });
  }

  const { updateRsvpMemberLink } = await import('./_rsvp.js');
  let fixed = 0;
  const failed = [];
  for (const c of candidates) {
    try {
      await updateRsvpMemberLink(c.rid, { member_rec_id: c.member_id, name: c.after });
      fixed++;
    } catch (err) {
      failed.push({ rid: c.rid, error: err.message });
    }
  }

  // 失效相关 cache
  if (isKvConfigured()) {
    const ops = [kvDel('rsvp:all')];
    for (const c of candidates) ops.push(kvDel('rsvp:member:' + c.member_id));
    // 不知具体活动 ID 全清 rsvp:activity:* 太重；让 5min TTL 自然过期
    await Promise.all(ops).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    dryRun: false,
    total_scanned: rsvps.length,
    mismatched: candidates.length,
    fixed,
    failed,
    details: candidates.slice(0, 100),
  });
}

// ─────────── 合并去重 ───────────

/** admin UI 编辑表单暴露的可合并字段（hidden 不参与；avatar/identity/contribution/hubs 暂不动） */
const MERGEABLE_FIELDS = [
  'name', 'nickname', 'bio', 'job', 'company',
  'willShare', 'interests', 'topics', 'mbti',
  'residentStatus',
];

/**
 * 字段合并方案：source 字段非空 + target 字段为空 → 建议带过去
 *   wechat 单独处理：写到 writeMember 时 key 是 'wechat'，但成员对象里是 '_wechat'
 *   返回 { proposed: { field: source_value }, conflicts: [{ field, source, target }] }
 */
function buildFieldProposal(source, target) {
  const proposed = {};
  const conflicts = [];

  for (const k of MERGEABLE_FIELDS) {
    const sv = (source[k] || '').toString().trim();
    const tv = (target[k] || '').toString().trim();
    if (!sv) continue;
    if (!tv) proposed[k] = sv;
    else if (sv !== tv) conflicts.push({ field: k, source: sv, target: tv });
  }

  // wechat：成员对象里在 _wechat
  const sw = (source._wechat || '').trim();
  const tw = (target._wechat || '').trim();
  if (sw) {
    if (!tw) proposed.wechat = sw;
    else if (sw.toLowerCase() !== tw.toLowerCase())
      conflicts.push({ field: 'wechat', source: sw, target: tw });
  }
  return { proposed, conflicts };
}

/**
 * Merge preview：拉 source / target，组装字段对比 + RSVP 数
 * 不做任何写入。让前端展示后让用户确认。
 *
 * Body: { action:'merge-preview', password, source_id, target_id }
 * Response: { success, source, target, proposed, conflicts, rsvp_count }
 */
async function handleMergePreview(req, res) {
  const { source_id, target_id } = req.body || {};
  if (!source_id || !target_id) return res.status(400).json({ error: '缺 source_id / target_id' });
  if (source_id === target_id)   return res.status(400).json({ error: 'source 和 target 是同一人' });

  const [source, target, rsvps] = await Promise.all([
    fetchMember(source_id),
    fetchMember(target_id),
    fetchRsvpsByMember(source_id),
  ]);
  if (!source) return res.status(404).json({ error: 'source 成员不存在' });
  if (!target) return res.status(404).json({ error: 'target 成员不存在' });

  const { proposed, conflicts } = buildFieldProposal(source, target);

  return res.status(200).json({
    success: true,
    source: { ...source, _phone: undefined },   // 减少回传
    target: { ...target, _phone: undefined },
    proposed,
    conflicts,
    rsvp_count: rsvps.length,
    rsvp_activity_ids: [...new Set(rsvps.map(r => r.activity_rec_id).filter(Boolean))],
  });
}

/**
 * Merge 实际执行：
 *   1. 字段补全：把 field_overrides（前端确认后的字段 map）写到 target
 *   2. RSVP 重链：source 的所有 RSVP 关联成员ID → target_id
 *   3. 删 source 成员
 *   4. 清缓存（写操作 helper 各自清，最后再补一次活动级 rsvp:activity:* 缓存）
 *
 * Body: { action:'merge', password, source_id, target_id, field_overrides? }
 *   field_overrides: { fieldName: value, ... } — 来自 preview 的 proposed，admin 可改
 * Response: { success, target_id, rsvp_updated, source_deleted, fields_applied }
 */
async function handleMerge(req, res) {
  const { source_id, target_id, field_overrides } = req.body || {};
  if (!source_id || !target_id) return res.status(400).json({ error: '缺 source_id / target_id' });
  if (source_id === target_id)   return res.status(400).json({ error: 'source 和 target 是同一人' });

  // 拉数据 + 字段补全（如果提供了）
  const fieldsApplied = {};
  if (field_overrides && typeof field_overrides === 'object') {
    for (const [k, v] of Object.entries(field_overrides)) {
      if (v == null || v === '') continue;
      fieldsApplied[k] = v;
    }
    if (Object.keys(fieldsApplied).length) {
      try {
        await writeMember(fieldsApplied, target_id);
      } catch (err) {
        return res.status(500).json({ error: '字段补全失败：' + err.message });
      }
    }
  }

  // RSVP 重链
  let rsvps;
  try { rsvps = await fetchRsvpsByMember(source_id); }
  catch (err) { return res.status(500).json({ error: '拉 source RSVP 失败：' + err.message }); }

  // 拉 target 的最新数据（field_overrides 可能刚刚改了 name/bio）
  let targetForRsvp;
  try { targetForRsvp = await fetchMember(target_id); }
  catch { targetForRsvp = null; }
  // RSVP 显示用 称呼 优先，再退到 姓名；bio 用 target 的 bio
  const rsvpName = targetForRsvp ? (targetForRsvp.nickname || targetForRsvp.name || '') : '';
  const rsvpBio  = targetForRsvp ? (targetForRsvp.bio || '') : '';

  let rsvpUpdated = 0;
  const rsvpFailed = [];
  const affectedActivityIds = new Set();
  for (const r of rsvps) {
    try {
      // 同步 name + bio：合并后那条 RSVP 显示的应该是 target（合并保留方）
      // bio 仅在原本为空 / 是 source 旧值时覆盖；如果原 RSVP bio 是嘉宾输入的"背景简介"
      // 强行覆盖会丢失 — 折中：仅 name 总是覆盖，bio 只在原为空时填
      const payload = { member_rec_id: target_id };
      if (rsvpName) payload.name = rsvpName;
      if (!r.bio && rsvpBio) payload.bio = rsvpBio;
      await updateRsvpMemberLink(r.record_id, payload);
      rsvpUpdated++;
      if (r.activity_rec_id) affectedActivityIds.add(r.activity_rec_id);
    } catch (err) {
      console.warn('[merge] rsvp relink failed:', r.record_id, err.message);
      rsvpFailed.push({ record_id: r.record_id, error: err.message });
    }
  }

  // 删 source（即使有 RSVP relink 失败也删；那些孤立 RSVP 在飞书后台手动改）
  let sourceDeleted = false;
  try {
    await deleteMember(source_id);
    sourceDeleted = true;
  } catch (err) {
    console.warn('[merge] delete source failed:', err.message);
  }

  // 清缓存：rsvp:* 涉及的，rsvp:member:source/target，rsvp:all
  if (isKvConfigured()) {
    const ops = [
      kvDel('rsvp:all'),
      kvDel('rsvp:member:' + source_id),
      kvDel('rsvp:member:' + target_id),
      kvDel('member:' + source_id),
      kvDel('member:' + target_id),
      kvDel('members:大理'),
      kvDel('members:上海'),
      kvDel('member_activity_cities'),
    ];
    for (const aid of affectedActivityIds) ops.push(kvDel('rsvp:activity:' + aid));
    await Promise.all(ops).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    target_id,
    source_deleted: sourceDeleted,
    rsvp_updated: rsvpUpdated,
    rsvp_failed: rsvpFailed,
    fields_applied: Object.keys(fieldsApplied),
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
  if (action === 'merge-preview')      return handleMergePreview(req, res);
  if (action === 'merge')              return handleMerge(req, res);
  if (action === 'clear-cache')        return handleClearCache(req, res);
  if (action === 'list-activity-types')   return handleListActivityTypes(req, res);
  if (action === 'strip-activity-types')  return handleStripActivityTypes(req, res);
  if (action === 'set-activity-types')    return handleSetActivityTypes(req, res);
  if (action === 'resync-rsvp-names')     return handleResyncRsvpNames(req, res);

  return res.status(400).json({ error: `unknown action: ${action}` });
}
