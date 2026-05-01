/**
 * POST /api/admin/rsvp-rebind
 *   Authorization: Bearer <TEAM_PASSWORD>
 *   body: { dryRun: boolean, autoCreate: boolean }
 *
 * 一次性 RSVP 数据修复工具：
 *   背景：RSVP 表"关联成员ID"字段大部分指向 recvi* 前缀的不存在 record，
 *        只有少数 recutsd* 前缀指向真正的总表成员。这是早期数据同步遗留。
 *   修法：按"姓名 + 微信号"软 join，把每条 RSVP 重新指向总表正确成员；
 *        总表里没有的真人就用 autoCreateMember 新建。
 *
 *   dryRun=true（默认）：只输出修复 plan，不写任何东西
 *   dryRun=false：执行修复
 *     - autoCreate=true（默认）：找不到的真人会自动建到总表
 *     - autoCreate=false：找不到的不建，留下孤儿（仅重绑能找到的）
 *
 *   返回：
 *     {
 *       total_rsvps,
 *       unique_persons,
 *       matched: [{ name, wechat, rsvp_count, rec_id, source: 'wechat'|'name' }],
 *       to_create: [{ name, wechat, rsvp_count }],   // 计划新建（autoCreate=false 时为 will_skip）
 *       ambiguous: [{ name, rsvp_count, reason }],   // 看起来不像真人，跳过
 *       already_correct: [{ name, rec_id, rsvp_count }],  // 关联本来就对，不动
 *       executed: { created: N, rebound_rsvps: M },  // 仅 dryRun=false 时
 *     }
 */

import { applyCors, getAccessToken } from '../_feishu.js';
import { fetchAllMembers, autoCreateMember } from '../_member.js';
import { fetchAllRsvps } from '../_rsvp.js';
import { invalidate } from '../_kv.js';

const APP_TOKEN = process.env.FEISHU_MEMBER_APP_TOKEN;
const RSVP_TABLE_ID = process.env.FEISHU_RSVP_TABLE_ID || 'tbl887iFA41eI0iS';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

/** 看起来像组织/合并字段而不是单一真人 — 跳过自动处理 */
function looksLikeOrgOrMerge(name) {
  if (!name) return true;
  const s = name.trim();
  if (s.length > 20) return true;          // 太长，多半是合并字段
  // 双空格（"  "）= 强烈的合并标记（如"杨圆圆  李带菓"）
  if (/[ 　]{2,}/.test(s)) return true;
  // 单个空格 + 长度较长（中英混排姓名一般 < 12，更长多半是组织或合并）
  if (/[ 　]/.test(s) && s.length > 10) return true;
  // 组织关键词 — 长度阈值放宽到 ≥5（"清华大学" 4 字 + 任意后缀就算）
  const orgKeywords = [
    '社区', '团队', '小组', '协会', '工作室', '工作坊', '中心',
    '召集人', '主理人', '支队', '俱乐部', '协作', '客厅',
    '机构', '公司', '大学', '学校', '集体', '联盟', '编辑部',
    'cyc活动体验', 'P社成员', '工作坊主理人',
  ];
  if (orgKeywords.some(k => s.includes(k)) && s.length >= 5) return true;
  // 多人分隔符
  if (/[&，、/]/.test(s)) return true;
  return false;
}

/** 标准化微信号用于匹配（trim + lowercase + 去 placeholder） */
function normalizeWechat(w) {
  if (!w) return '';
  const s = String(w).trim().toLowerCase();
  if (!s) return '';
  if (['同手机号', '同电话', '同上', '无', 'none', '-', '/', '．', '.'].includes(s)) return '';
  return s;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  // 鉴权
  const TEAM_PASSWORD = process.env.TEAM_PASSWORD;
  if (!TEAM_PASSWORD) return res.status(500).json({ error: 'TEAM_PASSWORD 未配置' });
  const auth = req.headers.authorization || '';
  const password = auth.replace(/^Bearer\s+/i, '').trim();
  if (password !== TEAM_PASSWORD) return res.status(401).json({ error: '密码错误' });

  const body = req.body || {};
  const dryRun = body.dryRun !== false;        // 默认 dryRun=true，要显式传 false 才执行
  const autoCreate = body.autoCreate !== false; // 默认 autoCreate=true

  // manual_overrides: 让 admin 把 ambiguous 里的合并字段拆成多人
  //   [{ from: '野人&离奇', splits: ['野人', '离奇'] }, ...]
  //   - splits.length === 1: 把 from 重命名为 splits[0]，按真人处理
  //   - splits.length > 1: splits[0] 作 primary（绑该 RSVP），其余建档不绑 RSVP
  const manualOverrides = Array.isArray(body.manual_overrides) ? body.manual_overrides : [];
  const overrideMap = new Map();
  for (const o of manualOverrides) {
    if (o && typeof o.from === 'string' && Array.isArray(o.splits)) {
      const splits = o.splits.map(s => String(s).trim()).filter(Boolean);
      if (splits.length) overrideMap.set(o.from, splits);
    }
  }

  try {
    // ── 1. 拉数据 ──
    const [allMembers, allRsvps] = await Promise.all([
      fetchAllMembers(),
      fetchAllRsvps(),
    ]);

    // 总表 record_id set + 微信号/姓名 索引
    const memberById = new Map();
    const memberByWechat = new Map();
    const memberByName = new Map();
    for (const m of allMembers) {
      memberById.set(m.record_id, m);
      const w = normalizeWechat(m._wechat);
      if (w) memberByWechat.set(w, m);
      const n = (m.name || '').trim();
      if (n) {
        if (!memberByName.has(n)) memberByName.set(n, []);
        memberByName.get(n).push(m);
      }
      const nick = (m.nickname || '').trim();
      if (nick) {
        if (!memberByName.has(nick)) memberByName.set(nick, []);
        memberByName.get(nick).push(m);
      }
    }

    // ── 2. 按 (姓名, 微信号) 去重 RSVP ──
    //   - 处理 manual_overrides：把"野人&离奇"这种合并字段重映射到 splits[0]
    //     作 primary，其余 splits 加入 auxSplitNames（独立建档不绑 RSVP）
    //   - 然后两步走：Step A 按 wechat 分组，Step B 同名合并
    const personMap = new Map();   // canonical_key → { name, wechat, rsvp_records: [...] }
    const nameToKey = new Map();
    const auxSplitNames = new Set();   // 需要独立建档但不绑 RSVP 的人名

    function getOrCreateGroup(name, wechat) {
      const key = wechat ? ('w:' + wechat) : ('n:' + name);
      if (!personMap.has(key)) {
        personMap.set(key, { name, wechat, rsvp_records: [] });
        if (name && !nameToKey.has(name)) nameToKey.set(name, key);
      }
      return personMap.get(key);
    }

    // Step A: 按 wechat 分组（含 override 处理）
    for (const r of allRsvps) {
      const origName = (r.name || '').trim();
      if (!origName) continue;
      const wechat = normalizeWechat(r._wechat || r.wechat || '');

      // override：合并字段 → 拆出 primary 名字
      let useName = origName;
      if (overrideMap.has(origName)) {
        const splits = overrideMap.get(origName);
        useName = splits[0];
        for (let i = 1; i < splits.length; i++) auxSplitNames.add(splits[i]);
      }

      if (wechat) {
        const grp = getOrCreateGroup(useName, wechat);
        grp.rsvp_records.push({
          record_id: r.record_id,
          current_link_id: r.member_rec_id || '',
        });
      }
    }
    // Step B: 没 wechat 的 RSVP — 同名优先合并，否则建 'n:<name>' 组
    for (const r of allRsvps) {
      const origName = (r.name || '').trim();
      if (!origName) continue;
      const wechat = normalizeWechat(r._wechat || r.wechat || '');
      if (wechat) continue;

      let useName = origName;
      if (overrideMap.has(origName)) {
        const splits = overrideMap.get(origName);
        useName = splits[0];
        for (let i = 1; i < splits.length; i++) auxSplitNames.add(splits[i]);
      }

      let key = nameToKey.get(useName);
      if (!key) {
        key = 'n:' + useName;
        if (!personMap.has(key)) {
          personMap.set(key, { name: useName, wechat: '', rsvp_records: [] });
        }
        nameToKey.set(useName, key);
      }
      personMap.get(key).rsvp_records.push({
        record_id: r.record_id,
        current_link_id: r.member_rec_id || '',
      });
    }

    // ── 3. 对每个 unique 人决策 ──
    const matched = [];           // 已在总表，需要重绑（如果 current_link_id 不对）
    const toCreate = [];          // 需要新建到总表
    const ambiguous = [];         // 跳过
    const alreadyCorrect = [];    // 关联已对，不动

    for (const p of personMap.values()) {
      const { name, wechat, rsvp_records } = p;
      if (!name) continue;       // 没姓名的 RSVP 跳过

      // 已经全部正确关联（current_link_id 都在总表）
      const allCorrect = rsvp_records.every(r => r.current_link_id && memberById.has(r.current_link_id));
      if (allCorrect) {
        alreadyCorrect.push({
          name, wechat,
          rec_id: rsvp_records[0].current_link_id,
          rsvp_count: rsvp_records.length,
        });
        continue;
      }

      // 微信号优先匹配
      let target = null;
      let source = '';
      if (wechat && memberByWechat.has(wechat)) {
        target = memberByWechat.get(wechat);
        source = 'wechat';
      } else if (memberByName.has(name)) {
        const candidates = memberByName.get(name);
        if (candidates.length === 1) {
          target = candidates[0];
          source = 'name';
        } else {
          // 同名多人 — 不安全，跳过
          ambiguous.push({
            name, wechat,
            rsvp_count: rsvp_records.length,
            reason: `总表里有 ${candidates.length} 个同名 "${name}"，无法确定，跳过`,
          });
          continue;
        }
      }

      if (target) {
        matched.push({
          name, wechat,
          rsvp_count: rsvp_records.length,
          rec_id: target.record_id,
          source,
          will_rebind: rsvp_records.length,
        });
        // 暂存到 person 上方便后续执行
        p._target_rec_id = target.record_id;
        continue;
      }

      // 总表里没有 → 看是否可建
      if (looksLikeOrgOrMerge(name)) {
        ambiguous.push({
          name, wechat,
          rsvp_count: rsvp_records.length,
          reason: '看起来像组织/合并字段，跳过',
        });
        continue;
      }

      // 真人 + 总表没有 → 计划新建
      toCreate.push({ name, wechat, rsvp_count: rsvp_records.length });
      p._needs_create = true;
    }

    // 计算 aux_to_create：split 拆出的次要人，独立建档不绑 RSVP
    const auxToCreate = [];
    for (const auxName of auxSplitNames) {
      // 看是否已经被 to_create / matched 覆盖
      let alreadyHandled = false;
      for (const p of personMap.values()) {
        if (p.name === auxName && (p._target_rec_id || p._needs_create)) {
          alreadyHandled = true;
          break;
        }
      }
      if (alreadyHandled) {
        auxToCreate.push({ name: auxName, action: 'covered_by_primary' });
        continue;
      }
      // 总表已有
      if (memberByName.has(auxName) && memberByName.get(auxName).length === 1) {
        auxToCreate.push({ name: auxName, action: 'already_in_table', rec_id: memberByName.get(auxName)[0].record_id });
        continue;
      }
      auxToCreate.push({ name: auxName, action: 'will_create' });
    }

    // ── 4. dry run 模式 — 直接返回 plan ──
    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        total_rsvps: allRsvps.length,
        unique_persons: personMap.size,
        already_correct_count: alreadyCorrect.length,
        already_correct: alreadyCorrect.slice(0, 20),   // 多了截断展示
        matched_count: matched.length,
        matched,
        to_create_count: toCreate.length,
        to_create: toCreate,
        ambiguous_count: ambiguous.length,
        ambiguous,
        manual_overrides_applied: manualOverrides.length,
        aux_to_create_count: auxToCreate.length,
        aux_to_create: auxToCreate,
        next_step: autoCreate
          ? '若同意此 plan，调用同端点 body 加 { dryRun: false } 执行（autoCreate 默认 true，会新建找不到的真人）'
          : '若同意，body { dryRun: false, autoCreate: false } 执行（仅重绑能找到的，跳过新建）',
      });
    }

    // ── 5. 执行修复 ──
    const token = await getAccessToken();
    let createdCount = 0;
    let reboundCount = 0;
    const errors = [];

    // Step A: 创建找不到的真人
    if (autoCreate) {
      for (const p of personMap.values()) {
        if (!p._needs_create) continue;
        try {
          const newId = await autoCreateMember({
            name:   p.name,
            wechat: p.wechat || undefined,
            source: 'rsvp-rebind 自动迁移',
          });
          p._target_rec_id = newId;
          createdCount++;
        } catch (err) {
          errors.push({ stage: 'create', name: p.name, error: err.message });
        }
      }
    }

    // Step A.5: 处理 aux_splits — split 拆出的次要人独立建档（不绑 RSVP）
    const auxCreatedDetail = [];
    if (autoCreate) {
      for (const auxName of auxSplitNames) {
        // 已经被某个 person primary 处理过的，跳过
        let alreadyHandled = false;
        for (const p of personMap.values()) {
          if (p.name === auxName && p._target_rec_id) { alreadyHandled = true; break; }
        }
        if (alreadyHandled) continue;
        // 总表已有
        if (memberByName.has(auxName) && memberByName.get(auxName).length === 1) {
          auxCreatedDetail.push({ name: auxName, action: 'already_in_table', rec_id: memberByName.get(auxName)[0].record_id });
          continue;
        }
        try {
          const newId = await autoCreateMember({
            name:   auxName,
            source: 'rsvp-rebind 拆分合并字段',
          });
          auxCreatedDetail.push({ name: auxName, action: 'created', rec_id: newId });
          createdCount++;
        } catch (err) {
          errors.push({ stage: 'aux-create', name: auxName, error: err.message });
        }
      }
    }

    // Step B: 重绑 RSVP（PUT 单条更新关联成员ID 字段）
    for (const p of personMap.values()) {
      if (!p._target_rec_id) continue;
      for (const r of p.rsvp_records) {
        // current_link_id 已经是对的就跳过
        if (r.current_link_id === p._target_rec_id) continue;
        try {
          const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${RSVP_TABLE_ID}/records/${r.record_id}`;
          const fres = await fetch(url, {
            method:  'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ fields: { '关联成员ID': p._target_rec_id } }),
          });
          const fjson = await fres.json();
          if (fjson.code !== 0) throw new Error(`(${fjson.code}) ${fjson.msg}`);
          reboundCount++;
        } catch (err) {
          errors.push({ stage: 'rebind', rsvp_record: r.record_id, error: err.message });
        }
      }
    }

    // Step C: 失效相关 cache（'all' scope 已经包含 rsvp:all + members:public_list）
    try { await invalidate('all'); } catch {}

    return res.status(200).json({
      dryRun: false,
      total_rsvps: allRsvps.length,
      executed: {
        created: createdCount,
        rebound_rsvps: reboundCount,
        aux_created: auxCreatedDetail,
      },
      matched_count: matched.length,
      to_create_count: toCreate.length,
      ambiguous_count: ambiguous.length,
      ambiguous,
      errors,
    });

  } catch (err) {
    console.error('[rsvp-rebind]', err);
    return res.status(500).json({ error: err.message });
  }
}
