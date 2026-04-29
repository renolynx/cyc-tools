# CYC.center 公开活动页 — 实施计划

> 版本：2026-04-29 · 基于实际仓库状态盘点  
> 目标：把每一条飞书活动记录变成一个可被搜索引擎索引、可在微信生成卡片预览的公开 URL  
> 这个文件是后续执行时**唯一的依据**——任何步骤遇到分歧，以这里写的为准。

---

## 1. 背景与目标

### 为什么做这件事

`cyc.center` 现在是个工具站（活动通告生成器、团队架构、约饭工具），所有数据靠浏览器 JS 跑起来后调 API 拉。**爬虫和微信卡片预览读不到任何活动信息**。

我们要让以下场景成立：

1. 在微信群分享一条活动链接 `cyc.center/events/recXXX`，群里看到一张带海报、标题、时间地点的预览卡
2. 别人 Google "大理 摄影工作坊"，能搜到 CYC 办的相关活动
3. 一个活动有自己的固定 URL，可以收藏、可以转发、可以归档

### 解决方案概述

新增两个**服务端渲染（SSR）**的页面：
- `cyc.center/events`         — 即将到来的活动列表
- `cyc.center/events/{record_id}` — 单条活动详情

服务端用 Vercel Serverless 函数渲染完整 HTML，含 Open Graph meta 标签。爬虫和微信抓到的就是渲染好的 HTML。

---

## 2. 现状盘点（已实测，不是凭印象）

### 2.1 已有的 API 工具函数

| 文件 | 导出 | 备注 |
|---|---|---|
| `api/_feishu.js` | `applyCors(res)` / `getAccessToken()` / `checkFeishuEnv(required?)` | 飞书鉴权 + CORS 头 |
| `api/_kv.js` | `isKvConfigured()` / `kvGet(key)` / `kvSet(key, value)` | **当前 kvSet 不支持 TTL** ⚠️ |
| `api/_password.js` | `getCurrentPassword()` / `verifyPassword()` / `setPassword()` / `isKvConfigured` | 调用 `kvSet(key, value)` 两参数 |

### 2.2 已有的 API endpoints

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/get-activities` | POST | 取本周活动（按 weekStart/weekEnd 过滤） |
| `/api/add-activity` | POST | 新建/更新（带密码校验） |
| `/api/delete-activity` | POST | 删除 |
| `/api/poster` | GET | 飞书附件代理（`?token=file_token`） |
| `/api/change-password` | POST | 改活动密码 |
| `/api/team-auth` | POST | 团队页登录 |
| `/api/list-tables`, `/api/list-fields` | GET | 调试用 |

### 2.3 关键函数：`parseRecord` 当前位置

⚠️ **`parseRecord` 目前定义在 `api/get-activities.js` 内部，没有 export**，需要抽出来才能复用。

它依赖的辅助函数 `parseDesc / getText / getSelect / getPoster / tsToDate` 也都在同一文件内部。

### 2.4 已有页面

| 路径 | 文件 | 行数 | 用途 |
|---|---|---|---|
| `/` | `index.html` | 1080 | 活动通告生成器（主战场） |
| `/styles.css` | `styles.css` | 853 | 主页样式 |
| `/tools` | `tools/index.html` | 382 | 工具索引 |
| `/team` | `team/index.html` | 1393 | 团队架构（密码） |
| `/food` | `food/index.html` | 796 | 约饭工具 |
| `/youyang` | `youyang/index.html` | 631 | CV |
| `/event-card` | `event-card/index.html` | 36 | 占位 |

### 2.5 路由（`vercel.json` 当前内容）

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]},
    { "source": "/api/(.*)", "headers": [
      { "key": "Access-Control-Allow-Origin", "value": "*" },
      { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" },
      { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
    ]}
  ],
  "rewrites": [
    { "source": "/weekly-calendar", "destination": "/" },
    { "source": "/tools", "destination": "/tools/index.html" },
    { "source": "/event-card", "destination": "/event-card/index.html" },
    { "source": "/team", "destination": "/team/index.html" },
    { "source": "/food", "destination": "/food/index.html" },
    { "source": "/youyang", "destination": "/youyang/index.html" }
  ]
}
```

⚠️ **没有 `/events` 和 `/events/:id` 的 rewrite**——需要添加。  
⚠️ `/robots.txt` 实测 404，`/sitemap.xml` 实测 404。

### 2.6 数据契约：飞书活动记录的字段

实测 `/api/get-activities` 返回的活动对象结构（字段名是 `parseRecord` 已经规范化后的）：

```typescript
{
  record_id: string;     // 飞书 record_id，如 "recvhBMP6LZUwr"，作为 URL 路径
  title:     string;     // 活动标题
  date:      string;     // "YYYY-MM-DD"，北京时间
  loc:       string;     // 地点
  status:    string;     // "筹备酝酿中" | "确认举办" | "办完了！" | ""
  poster:    null | { file_token: string; name: string; url: string; type: string };
  time:      string;     // 如 "14:30-17:00" 或空
  fee:       string;
  signup:    string;
  desc:      string;     // 活动简介
  flow:      string[];   // 详情·流程（每行一条）
  spk:       { name: string; bio: string }[];  // 嘉宾
}
```

### 2.7 实测过的事实清单

- ✅ `https://cyc.center/` 返回 HTTP 200
- ✅ `POST https://cyc.center/api/get-activities` 返回 7 条真实活动数据
- ✅ `GET https://cyc.center/api/poster?token=DCkDblHHSotrOoxHwntc0KrenJe` 返回 240KB JPEG，`Cache-Control: public, max-age=86400, immutable`
- ✅ `https://cyc.center/robots.txt` → 404
- ✅ `https://cyc.center/sitemap.xml` → 404
- ✅ Vercel rewrite 支持 `:paramName` 动态段（已查证官方文档示例）
- ✅ Upstash REST 支持 `POST /set/{key}?EX={seconds}` 写带 TTL 的值
- ✅ 飞书单条记录 GET 端点存在：`GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}`，响应里 `data.record.fields` 与搜索响应里 `data.items[].fields` 同形

---

## 3. 设计决策（锁死，不再讨论）

### 3.1 URL 形态

- 列表：`/events`
- 详情：`/events/{record_id}` — 直接用飞书 record_id（已经是 URL 安全的字母数字）
- **不**做 slug（如 `/events/2026/04/photo-workshop`）——会需要额外的字段管理，且 record_id 在飞书永不变

### 3.2 渲染方式

服务端模板字符串。**不**引入任何模板引擎或框架，保持零 npm 依赖路线一致。

```javascript
function renderEventDetailHtml(act) {
  return `<!DOCTYPE html>
<html lang="zh">
<head>...</head>
<body>...</body>
</html>`;
}
```

### 3.3 缓存策略

两层：

1. **KV 缓存（Upstash Redis）**：
   - 单活动：key `event:{record_id}`，TTL 600 秒（10 分钟）
   - 列表：key `events:upcoming`，TTL 300 秒（5 分钟）
2. **Vercel Edge 缓存**：响应头 `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`

KV 没配置时优雅降级——直接打飞书，靠 Edge 缓存兜底。

### 3.4 过期活动处理

- **详情页**：永远渲染（用作存档），加灰色"已结束"徽章
- **列表页**：默认只显示 `date >= 今天` 的活动；过期的进归档（暂不实现，Phase 4 再说）

### 3.5 OG 图片来源

`og:image` 指向 `https://cyc.center/api/poster?token={file_token}`。

理由：
- 已实测此端点返回 image/jpeg + 24h cache
- 微信抓图爬虫能拿到真实图片字节
- 没有海报时回退到一张默认图（需要准备 `/og-default.png`）

### 3.6 错误处理

- 飞书返回 record 不存在 → 渲染 404 页面（HTTP 404，不重定向）
- 飞书 API 失败 → 渲染 500 页面，日志写入 console
- 无标题（草稿）→ 当作 404 处理（避免索引到空白页）

---

## 4. 阶段拆分总览

```
Phase 0  基础重构（前置改造）
   │     · 抽 parseRecord 到 _activity.js
   │     · kvSet 加 TTL 参数
   │     · 不改对外行为
   ↓
Phase 1  活动详情页 /events/:id ★ 最大价值
   │     · 微信卡片预览即可生效
   ↓
   ├──→ Phase 2  活动列表页 /events
   │
   └──→ Phase 3  SEO 基础设施
              · robots.txt
              · sitemap.xml（动态生成）
              · 主页菜单加入口

Phase 4  抛光（可选）
         · 缓存失效（add/delete 后清 KV）
         · JSON-LD Event schema
         · 默认 OG 图片设计
```

每个阶段独立可部署、可回滚。Phase 1 单独上线就有商业价值。

---

## 5. Phase 0 — 基础重构

### 5.1 目标

让后续的 SSR 端点能复用解析逻辑，让 KV 能写带过期的缓存。**不改对外行为**。

### 5.2 任务清单

- [ ] 5.2.1 新建 `api/_activity.js`，把 `parseRecord` + 内部辅助函数搬过来并 export
- [ ] 5.2.2 新建 `fetchActivity(recordId)` 和 `fetchAllActivities()` 两个 I/O 函数
- [ ] 5.2.3 修改 `api/_kv.js`，给 `kvSet` 加可选第三个参数 `ttlSec`
- [ ] 5.2.4 重构 `api/get-activities.js`，让它从 `_activity.js` 导入 `fetchAllActivities` 和 `parseRecord`
- [ ] 5.2.5 验证 `api/_password.js` 不受影响（它调 `kvSet(key, value)` 两参数应该继续 work）

### 5.3 文件 1：`api/_activity.js`（新建）

```javascript
/**
 * 活动数据层：解析 + 拉取
 * 给 get-activities / event-page / events-list 共用
 */

import { getAccessToken } from './_feishu.js';

// ─────────── 纯解析函数（无 I/O）───────────

function tsToDate(ts) {
  if (!ts) return null;
  const d  = new Date(Number(ts));
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
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

function parseDesc(raw, activity) {
  if (!raw) return;
  const text = Array.isArray(raw) ? raw.map(s => s.text || '').join('') : String(raw);
  const lines = text.split('\n');
  const descLines = [];
  const flowLines = [];
  let inFlow = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('⏰ 时间：'))  { activity.time   = t.replace('⏰ 时间：', '');  continue; }
    if (t.startsWith('💰 费用：'))  { activity.fee    = t.replace('💰 费用：', '');  continue; }
    if (t.startsWith('🙋 报名：'))  { activity.signup = t.replace('🙋 报名：', '');  continue; }
    if (t.startsWith('🗓️ 流程：')) { inFlow = true; continue; }
    if (inFlow) { flowLines.push(t); continue; }
    descLines.push(t);
  }
  activity.desc = descLines.join('\n');
  activity.flow = flowLines;
}

/** 单条飞书 record → 工具用 activity 对象 */
export function parseRecord(record) {
  const f = record.fields || {};
  const act = {
    record_id: record.record_id,
    title:  getText(f['标题']) || '',
    date:   tsToDate(f['意向/确认举办日期']) || '',
    loc:    getText(f['地点']) || '',
    status: getSelect(f['目前状态']) || '',
    poster: getPoster(f['活动海报']),
    time: '', fee: '', signup: '', desc: '',
    flow: [], spk: [],
  };

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

// ─────────── 数据拉取（有 I/O）───────────

/** 拉单条活动；不存在返回 null；其他错误抛 Error */
export async function fetchActivity(recordId) {
  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${recordId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  // 1254040 / 1254044 是飞书的 "record not found" 错误码（防御式处理）
  if (data.code === 1254040 || data.code === 1254044 || res.status === 404) return null;
  if (data.code !== 0) throw new Error(`飞书读取失败 (${data.code}): ${data.msg}`);
  return parseRecord(data.data.record);
}

/** 拉最近 100 条活动（按日期倒序），全部 parsed */
export async function fetchAllActivities() {
  const { FEISHU_APP_TOKEN, FEISHU_TABLE_ID } = process.env;
  const token = await getAccessToken();
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/search?page_size=100`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sort: [{ field_name: '意向/确认举办日期', desc: true }] }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书搜索失败 (${data.code}): ${data.msg}`);
  return (data.data?.items || []).map(parseRecord);
}
```

### 5.4 文件 2：`api/_kv.js`（修改 `kvSet`）

把现有的 `kvSet`：

```javascript
// 改前
export async function kvSet(key, value) {
  if (!isKvConfigured()) throw new Error('KV 存储未配置');
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain; charset=utf-8' },
    body: value,
  });
  // ...
}
```

改成：

```javascript
// 改后：第三个参数可选，传了就加 TTL
export async function kvSet(key, value, ttlSec) {
  if (!isKvConfigured()) throw new Error('KV 存储未配置');
  const url = `${KV_URL}/set/${encodeURIComponent(key)}`
            + (ttlSec ? `?EX=${Math.floor(ttlSec)}` : '');
  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain; charset=utf-8' },
    body: value,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV SET 失败 ${res.status}: ${text}`);
  }
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(`KV SET 错误: ${data.error}`);
  return true;
}
```

**关键**：第三个参数没传时，行为和原来完全一致——这保证 `_password.js` 的两参数调用不会受影响。

### 5.5 文件 3：`api/get-activities.js`（重构）

把现在的"内部 parseRecord + 直接调飞书"换成"import 并使用 `fetchAllActivities`"：

```javascript
/**
 * POST /api/get-activities
 * 读取飞书指定周内的活动
 * Body: { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD' }
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchAllActivities }        from './_activity.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { weekStart, weekEnd } = req.body || {};
  if (!weekStart || !weekEnd)
    return res.status(400).json({ error: '缺少 weekStart / weekEnd' });

  const envErr = checkFeishuEnv();
  if (envErr) return res.status(500).json({ error: envErr });

  try {
    const all = await fetchAllActivities();

    const startTs = new Date(weekStart + 'T00:00:00+08:00').getTime();
    const endTs   = new Date(weekEnd   + 'T23:59:59+08:00').getTime();
    const activities = all.filter(a => {
      if (!a.date) return false;
      const ts = new Date(a.date + 'T00:00:00+08:00').getTime();
      return ts >= startTs && ts <= endTs;
    });

    return res.status(200).json({ success: true, count: activities.length, activities });
  } catch (err) {
    console.error('[get-activities]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

整个文件从 ~140 行降到 ~30 行，行为完全一致。

### 5.6 验证 `api/_password.js`

`_password.js` 第 31 行调用 `kvSet(KV_KEY, newPassword)` 两参数。我们 5.4 改的是**追加**第三参数（可选），所以这调用继续 work——TTL 不传 = 永久存储。

**不需要改动 `_password.js`。** 但部署后要测一遍改密码功能确认没退化（见 5.7）。

### 5.7 测试步骤

部署后跑：

```bash
# 1. 主页能拉到活动（行为不变）
curl -s -X POST https://cyc.center/api/get-activities \
  -H "Content-Type: application/json" \
  -d '{"weekStart":"2026-04-20","weekEnd":"2026-05-10"}' \
  | head -c 200

# 期望：JSON 包含 "success":true 和若干活动

# 2. 海报代理还能用
curl -s -I "https://cyc.center/api/poster?token=DCkDblHHSotrOoxHwntc0KrenJe" | head -5
# 期望：HTTP/2 200, Content-Type: image/jpeg

# 3. 改密码功能没坏（需要在团队页面手动测，因为有密码校验）
# - 进 cyc.center/team
# - 登录 → 点悠洋卡片 → 修改活动通告密码 → 应该能改成功
```

### 5.8 完成判定

- [x] `api/_activity.js` 存在且 export 了 `parseRecord` / `fetchActivity` / `fetchAllActivities`
- [x] `api/_kv.js` 里 `kvSet` 接受可选第三参数
- [x] `api/get-activities.js` 不再有自己的 `parseRecord` 函数
- [x] 部署后，5.7 的三个测试全部通过
- [x] 提交一次 commit，消息形如 `refactor: 抽取 _activity.js + kvSet 加 TTL`

---

## 6. Phase 1 — 活动详情页

### 6.1 目标

`https://cyc.center/events/{record_id}` 返回完整 HTML，含 OG meta，能在微信生成预览卡。

### 6.2 任务清单

- [ ] 6.2.1 新建 `api/event-page.js`
- [ ] 6.2.2 改 `vercel.json` 加 rewrite
- [ ] 6.2.3 在 `styles.css` 末尾追加详情页专用样式
- [ ] 6.2.4 准备默认 OG 图片 `/og-default.png`（你自己出图，1200×630px 推荐）
- [ ] 6.2.5 部署 + 测试 + 微信群预览测试

### 6.3 文件 1：`api/event-page.js`（新建）

完整骨架：

```javascript
/**
 * GET /api/event-page?id={record_id}
 * 服务端渲染单条活动详情页
 *
 * vercel.json rewrite: /events/:id → /api/event-page?id=:id
 */

import { applyCors, checkFeishuEnv } from './_feishu.js';
import { fetchActivity }              from './_activity.js';
import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const CACHE_TTL_SEC = 600;     // KV 10 分钟
const EDGE_CACHE    = 'public, s-maxage=300, stale-while-revalidate=3600';

const SITE_URL  = 'https://cyc.center';
const SITE_NAME = 'CYC 链岛青年社区';
const OG_DEFAULT = SITE_URL + '/og-default.png';

const CN_DAYS = ['周日','周一','周二','周三','周四','周五','周六'];

// ─────────── 纯渲染函数 ───────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayBJ() {
  const now = new Date();
  const bj  = new Date(now.getTime() + 8*3600*1000);
  return bj.toISOString().slice(0,10);
}

function posterUrl(act) {
  if (act.poster?.file_token)
    return SITE_URL + '/api/poster?token=' + encodeURIComponent(act.poster.file_token);
  return null;
}

function renderEventDetail(act) {
  const title    = escapeHtml(act.title || '未命名活动');
  const descRaw  = act.desc || '';
  const descShort = escapeHtml(descRaw.replace(/\n/g, ' ').slice(0, 100));
  const ogImage  = posterUrl(act) || OG_DEFAULT;
  const url      = `${SITE_URL}/events/${act.record_id}`;
  const isPast   = act.date && act.date < todayBJ();

  // 日期人类可读
  let dateStr = '';
  if (act.date) {
    const d = new Date(act.date + 'T00:00:00+08:00');
    dateStr = `${d.getMonth()+1} 月 ${d.getDate()} 日 · ${CN_DAYS[d.getDay()]}`;
  }

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="format-detection" content="telephone=no">
<title>${title} · ${SITE_NAME}</title>
<meta name="description" content="${descShort}">

<!-- Open Graph (微信 / Facebook) -->
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${descShort}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${SITE_NAME}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${descShort}">
<meta name="twitter:image" content="${ogImage}">

<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="/events" class="event-back">‹ 全部活动</a>
  <a href="${SITE_URL}" class="event-site">CYC.center</a>
</header>

<main class="event-detail">
  ${posterUrl(act) ? `<img class="event-poster" src="/api/poster?token=${encodeURIComponent(act.poster.file_token)}" alt="${title} 海报" loading="eager">` : ''}

  <div class="event-meta-row">
    ${dateStr ? `<span class="event-date-pill">${dateStr}</span>` : ''}
    ${act.time ? `<span class="event-time-pill">⏰ ${escapeHtml(act.time)}</span>` : ''}
    ${isPast ? '<span class="event-past-pill">已结束</span>' : ''}
    ${act.status === '确认举办' && !isPast ? '<span class="event-confirm-pill">✓ 确认举办</span>' : ''}
  </div>

  <h1 class="event-title">${title}</h1>

  <dl class="event-info">
    ${act.loc    ? `<div class="event-info-row"><dt>📍 地点</dt><dd>${escapeHtml(act.loc)}</dd></div>` : ''}
    ${act.fee    ? `<div class="event-info-row"><dt>💰 费用</dt><dd>${escapeHtml(act.fee)}</dd></div>` : ''}
    ${act.signup ? `<div class="event-info-row"><dt>🙋 报名</dt><dd>${escapeHtml(act.signup)}</dd></div>` : ''}
  </dl>

  ${act.desc ? `<section class="event-section">
    <h2>活动简介</h2>
    <p class="event-desc">${escapeHtml(act.desc)}</p>
  </section>` : ''}

  ${act.flow?.length ? `<section class="event-section">
    <h2>详情 · 流程</h2>
    <ul class="event-flow">${act.flow.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
  </section>` : ''}

  ${act.spk?.length ? `<section class="event-section">
    <h2>带领人 / 嘉宾</h2>
    <div class="event-spk">${act.spk.map(s => `<div class="event-spk-row"><strong>${escapeHtml(s.name)}</strong>${s.bio ? `<span class="event-spk-bio"> · ${escapeHtml(s.bio)}</span>` : ''}</div>`).join('')}</div>
  </section>` : ''}
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

</body>
</html>`;
}

function render404() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>活动不存在 · ${SITE_NAME}</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page">
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<main class="event-detail event-404">
  <div class="event-404-icon">🌿</div>
  <h1>活动不存在</h1>
  <p>这条活动可能已被删除，或者链接不对。</p>
  <a href="/events" class="event-404-link">查看全部活动 →</a>
</main>
</body>
</html>`;
}

// ─────────── Handler ───────────

export default async function handler(req, res) {
  applyCors(res);

  const id = req.query.id;
  if (!id || !/^rec[a-zA-Z0-9]+$/.test(id)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(render404());
  }

  const envErr = checkFeishuEnv();
  if (envErr) {
    console.error('[event-page]', envErr);
    return res.status(500).send('Server config error');
  }

  // 1. 尝试 KV 缓存
  const cacheKey = 'event:' + id;
  let act = null;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) act = JSON.parse(cached);
    } catch {}
  }

  // 2. 缓存 miss → 拉飞书
  if (!act) {
    try {
      act = await fetchActivity(id);
    } catch (err) {
      console.error('[event-page]', err.message);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(render404());
    }
    if (act && isKvConfigured()) {
      try {
        await kvSet(cacheKey, JSON.stringify(act), CACHE_TTL_SEC);
      } catch (e) {
        console.error('[event-page] kv write failed:', e.message);
      }
    }
  }

  // 3. 不存在 / 草稿 → 404
  if (!act || !act.title) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(render404());
  }

  // 4. 渲染
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventDetail(act));
}
```

### 6.4 文件 2：`vercel.json`（追加 rewrite）

把 `rewrites` 数组改成（注意顺序——`/events/:id` 必须在 `/events` 之前，否则前者匹配不到）：

```json
"rewrites": [
  { "source": "/weekly-calendar", "destination": "/" },
  { "source": "/tools",           "destination": "/tools/index.html" },
  { "source": "/event-card",      "destination": "/event-card/index.html" },
  { "source": "/team",            "destination": "/team/index.html" },
  { "source": "/food",            "destination": "/food/index.html" },
  { "source": "/youyang",         "destination": "/youyang/index.html" },
  { "source": "/events/:id",      "destination": "/api/event-page?id=:id" }
]
```

> ⚠️ Phase 2 会再加 `/events`（列表），先不加。

### 6.5 文件 3：`styles.css` 末尾追加

把以下样式追加到 `styles.css` **最末尾**（不要替换已有内容）：

```css

/* ═══════════════════════════════════════════════
 * 公开活动页（/events 和 /events/:id）
 * ═══════════════════════════════════════════════ */

body.event-page {
  background: var(--sand);
  color: var(--text);
}

.event-topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; height: 52px;
  background: rgba(242,237,230,0.82);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border-bottom: 0.5px solid rgba(0,0,0,0.08);
}
.event-back, .event-site {
  display: inline-flex; align-items: center;
  font-size: 14px; font-weight: 500; color: var(--green);
  text-decoration: none; padding: 6px 10px; border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
}
.event-back:active, .event-site:active { background: rgba(28,61,46,0.08); }
.event-site { font-weight: 700; letter-spacing: -0.01em; }

.event-detail {
  position: relative; z-index: 1;
  max-width: 720px; margin: 0 auto;
  padding: 24px 16px env(safe-area-inset-bottom);
}

.event-poster {
  width: 100%; max-height: 480px; object-fit: cover;
  border-radius: var(--r);
  margin-bottom: 18px;
  background: rgba(0,0,0,0.04);
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}

.event-meta-row {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 12px;
}
.event-date-pill, .event-time-pill, .event-past-pill, .event-confirm-pill {
  font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 100px;
  letter-spacing: -0.01em;
}
.event-date-pill { background: rgba(28,61,46,0.10); color: var(--green); }
.event-time-pill { background: rgba(255,255,255,0.7); color: var(--text); border: 1px solid var(--stroke); }
.event-past-pill { background: rgba(0,0,0,0.05); color: var(--muted); }
.event-confirm-pill { background: rgba(217,101,42,0.12); color: var(--orange); }

.event-title {
  font-size: 28px; font-weight: 800;
  line-height: 1.25; letter-spacing: -0.02em;
  color: var(--green);
  margin-bottom: 18px;
}
@media (min-width: 680px) { .event-title { font-size: 34px; } }

.event-info {
  background: var(--card);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 14px 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.7) inset;
  margin-bottom: 22px;
}
.event-info-row { display: flex; gap: 10px; padding: 6px 0; align-items: baseline; }
.event-info-row + .event-info-row { border-top: 0.5px solid var(--stroke); }
.event-info-row dt {
  flex-shrink: 0; width: 64px;
  font-size: 12px; font-weight: 600; color: var(--muted);
}
.event-info-row dd {
  flex: 1; font-size: 14px; color: var(--text); word-break: break-word;
  white-space: pre-wrap;
}

.event-section { margin-bottom: 24px; }
.event-section h2 {
  font-size: 13px; font-weight: 700;
  color: var(--green); letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 10px; padding-bottom: 6px;
  border-bottom: 0.5px solid var(--stroke);
}
.event-desc {
  font-size: 15px; line-height: 1.75; color: var(--text);
  white-space: pre-wrap;
}
.event-flow {
  list-style: none; padding-left: 0;
  border-left: 2px solid rgba(28,61,46,0.15);
  margin-left: 4px; padding-left: 14px;
}
.event-flow li {
  font-size: 14px; line-height: 1.7; color: var(--text);
  padding: 3px 0;
}
.event-spk { display: flex; flex-direction: column; gap: 6px; }
.event-spk-row {
  background: rgba(255,255,255,0.5);
  border: 1px solid var(--stroke);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
}
.event-spk-row strong { color: var(--green); }
.event-spk-bio { color: var(--muted); font-size: 13px; }

.event-footer {
  text-align: center;
  padding: 32px 16px 40px;
  color: var(--muted);
  font-size: 13px;
}
.event-footer-tagline {
  font-size: 16px; font-weight: 700; color: var(--green);
  letter-spacing: 0.05em; margin-bottom: 8px;
}
.event-footer a { color: var(--green); text-decoration: none; }

/* 404 状态 */
.event-404 { text-align: center; padding-top: 80px; }
.event-404-icon { font-size: 72px; margin-bottom: 16px; opacity: 0.5; }
.event-404 h1 { color: var(--text); font-size: 22px; margin-bottom: 8px; }
.event-404 p { color: var(--muted); font-size: 14px; margin-bottom: 18px; }
.event-404-link {
  display: inline-block;
  padding: 10px 22px;
  background: var(--green);
  color: #fff; border-radius: 100px;
  text-decoration: none;
  font-size: 14px; font-weight: 600;
  box-shadow: 0 3px 12px rgba(28,61,46,0.22);
}
```

### 6.6 默认 OG 图片

需要一张 1200×630px 的 PNG 放在仓库根 `og-default.png`。设计：
- CYC 配色（绿/橙/沙）
- 中央写"CYC 链岛青年社区"和 slogan"链接每一座孤岛"
- 角落放 `cyc.center`

如果暂时没有，可以先随便放一张占位图——不影响功能。

### 6.7 测试步骤

部署后跑：

```bash
# 1. 拿一个真实的 record_id（先从 get-activities 拿）
RID=$(curl -s -X POST https://cyc.center/api/get-activities \
  -H "Content-Type: application/json" \
  -d '{"weekStart":"2026-04-01","weekEnd":"2026-05-30"}' \
  | grep -oE '"record_id":"[^"]+' | head -1 | cut -d'"' -f4)
echo "Testing with record_id: $RID"

# 2. 详情页能渲染（应该返回 200 和 HTML）
curl -s -o /dev/null -w "Status: %{http_code}\nContent-Type: %{content_type}\n" \
  "https://cyc.center/events/$RID"
# 期望：Status: 200, Content-Type: text/html; charset=utf-8

# 3. HTML 包含 OG meta（关键！这是微信卡片的来源）
curl -s "https://cyc.center/events/$RID" | grep -E 'og:title|og:image|og:description'
# 期望：3 行 og:* meta 都有

# 4. 不存在的 ID 返回 404
curl -s -o /dev/null -w "%{http_code}\n" "https://cyc.center/events/recDOESNOTEXIST"
# 期望：404

# 5. 非法 ID 格式返回 400
curl -s -o /dev/null -w "%{http_code}\n" "https://cyc.center/events/javascript:alert(1)"
# 期望：400（防御 XSS / 路径注入）
```

**手动测试**：
1. 浏览器打开 `https://cyc.center/events/{真实record_id}`，确认布局正常、海报加载、文字不溢出
2. **微信测试**（需要你帮我做）：
   - 把这个 URL 发到一个微信群或者发给自己
   - 等几秒，看微信生成的卡片预览：是否有标题、海报、描述
   - 如果卡片错或没出来，把链接发给我，我看看 HTML 里 og 标签是不是全的

### 6.8 完成判定

- [x] 6.7 的 5 个 curl 测试全部通过
- [x] 浏览器可视化检查：详情页布局对、海报显示、过去活动有"已结束"徽章
- [x] 微信群里粘贴链接，预览卡正常生成（图 + 标题 + 简介）
- [x] 提交 commit，消息形如 `feat: 活动详情页 SSR (/events/:id)`

---

## 7. Phase 2 — 活动列表页

### 7.1 目标

`https://cyc.center/events` 显示所有未来活动（按日期分组），每张卡片可点进详情。

### 7.2 任务清单

- [ ] 7.2.1 新建 `api/events-list.js`
- [ ] 7.2.2 改 `vercel.json` 加 `/events` rewrite
- [ ] 7.2.3 在 `styles.css` 末尾继续追加列表页样式
- [ ] 7.2.4 部署 + 测试

### 7.3 文件 1：`api/events-list.js`

```javascript
/**
 * GET /api/events-list
 * 公开活动列表页（SSR）
 * 默认显示 date >= 今天 的活动，按日期升序，分组展示
 */

import { applyCors, checkFeishuEnv }    from './_feishu.js';
import { fetchAllActivities }            from './_activity.js';
import { kvGet, kvSet, isKvConfigured }  from './_kv.js';

const CACHE_TTL_SEC = 300;
const EDGE_CACHE    = 'public, s-maxage=180, stale-while-revalidate=1800';

const SITE_URL  = 'https://cyc.center';
const SITE_NAME = 'CYC 链岛青年社区';
const CN_DAYS = ['周日','周一','周二','周三','周四','周五','周六'];

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function todayBJ() {
  const bj = new Date(Date.now() + 8*3600*1000);
  return bj.toISOString().slice(0,10);
}

function thumbUrl(act) {
  if (act.poster?.file_token)
    return '/api/poster?token=' + encodeURIComponent(act.poster.file_token);
  return null;
}

function renderEventsList(acts) {
  const today = todayBJ();
  const upcoming = acts.filter(a => a.date && a.date >= today && a.title);

  // 按日期升序分组
  upcoming.sort((a,b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));
  const groups = {};
  for (const a of upcoming) {
    if (!groups[a.date]) groups[a.date] = [];
    groups[a.date].push(a);
  }
  const dates = Object.keys(groups).sort();

  const groupsHtml = dates.map(date => {
    const d = new Date(date + 'T00:00:00+08:00');
    const dateLabel = `${d.getMonth()+1} 月 ${d.getDate()} 日 · ${CN_DAYS[d.getDay()]}`;

    const cards = groups[date].map(a => {
      const thumb = thumbUrl(a);
      const status = a.status === '确认举办'
        ? '<span class="el-card-status confirm">✓ 确认举办</span>'
        : (a.status === '筹备酝酿中' ? '<span class="el-card-status plan">筹备中</span>' : '');
      return `<a class="el-card" href="/events/${a.record_id}">
        ${thumb ? `<img class="el-card-thumb" src="${thumb}" alt="" loading="lazy">` : '<div class="el-card-thumb el-card-thumb-empty">📅</div>'}
        <div class="el-card-body">
          <div class="el-card-title">${escapeHtml(a.title)}</div>
          <div class="el-card-meta">
            ${a.time ? `<span>⏰ ${escapeHtml(a.time)}</span>` : ''}
            ${a.loc  ? `<span>📍 ${escapeHtml(a.loc)}</span>`  : ''}
          </div>
          ${status}
        </div>
        <span class="el-card-arrow">›</span>
      </a>`;
    }).join('');

    return `<section class="el-day-group">
      <div class="el-day-head">${dateLabel}</div>
      ${cards}
    </section>`;
  }).join('');

  const empty = upcoming.length === 0
    ? `<div class="el-empty">
         <div class="el-empty-icon">🌿</div>
         <p>近期暂无即将到来的活动</p>
         <p class="el-empty-sub">下一波活动正在筹备中，过两天再来看看</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>近期活动 · ${SITE_NAME}</title>
<meta name="description" content="${SITE_NAME}近期社群活动 · 大理 · 链接每一座孤岛">
<meta property="og:type" content="website">
<meta property="og:title" content="近期活动 · ${SITE_NAME}">
<meta property="og:description" content="${SITE_NAME}的活动日历，每周持续更新">
<meta property="og:url" content="${SITE_URL}/events">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:image" content="${SITE_URL}/og-default.png">
<link rel="canonical" href="${SITE_URL}/events">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="event-page el-page">

<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<header class="event-topbar">
  <a href="${SITE_URL}" class="event-back">‹ 主页</a>
  <a href="${SITE_URL}" class="event-site">CYC.center</a>
</header>

<main class="el-main">
  <div class="el-hero">
    <h1>近期活动</h1>
    <p class="el-hero-sub">${SITE_NAME} · 大理</p>
  </div>

  ${empty || groupsHtml}
</main>

<footer class="event-footer">
  <p class="event-footer-tagline">链接每一座孤岛</p>
  <p><a href="${SITE_URL}">${SITE_NAME} · cyc.center</a></p>
</footer>

</body>
</html>`;
}

export default async function handler(req, res) {
  applyCors(res);

  const envErr = checkFeishuEnv();
  if (envErr) {
    console.error('[events-list]', envErr);
    return res.status(500).send('Server config error');
  }

  // KV 缓存
  const cacheKey = 'events:upcoming';
  let acts = null;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) acts = JSON.parse(cached);
    } catch {}
  }

  if (!acts) {
    try {
      acts = await fetchAllActivities();
    } catch (err) {
      console.error('[events-list]', err.message);
      acts = [];  // 优雅降级：飞书挂了也渲染空列表
    }
    if (acts.length && isKvConfigured()) {
      try {
        await kvSet(cacheKey, JSON.stringify(acts), CACHE_TTL_SEC);
      } catch {}
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(renderEventsList(acts));
}
```

### 7.4 文件 2：`vercel.json` 加 `/events`

```json
"rewrites": [
  // ... 原有的 ...
  { "source": "/events/:id", "destination": "/api/event-page?id=:id" },
  { "source": "/events",     "destination": "/api/events-list" }
]
```

⚠️ `/events/:id` 要写在 `/events` 前面（Vercel 按顺序匹配）。

### 7.5 文件 3：`styles.css` 列表页样式

继续追加：

```css

/* ═══════════════════════════════════════════════
 * 列表页（/events）
 * ═══════════════════════════════════════════════ */

.el-main {
  position: relative; z-index: 1;
  max-width: 720px; margin: 0 auto;
  padding: 28px 16px env(safe-area-inset-bottom);
}

.el-hero { margin-bottom: 24px; }
.el-hero h1 {
  font-size: 32px; font-weight: 800;
  letter-spacing: -0.02em; color: var(--green);
  margin-bottom: 4px;
}
@media (min-width: 680px) { .el-hero h1 { font-size: 38px; } }
.el-hero-sub {
  font-size: 14px; color: var(--muted);
  letter-spacing: 0.02em;
}

.el-day-group { margin-bottom: 28px; }
.el-day-head {
  font-size: 12px; font-weight: 700;
  color: var(--green); letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
}
.el-day-head::after {
  content: ''; flex: 1; height: 0.5px;
  background: rgba(28,61,46,0.15);
}

.el-card {
  display: flex; align-items: center; gap: 14px;
  padding: 12px;
  background: var(--card);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid var(--border);
  border-radius: var(--r);
  text-decoration: none; color: inherit;
  -webkit-tap-highlight-color: transparent;
  margin-bottom: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.el-card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.el-card:hover {
  border-color: rgba(28,61,46,0.25);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}

.el-card-thumb {
  width: 72px; height: 72px; flex-shrink: 0;
  border-radius: 10px; object-fit: cover;
  border: 1px solid var(--stroke);
  background: rgba(0,0,0,0.04);
}
.el-card-thumb-empty {
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: var(--muted); opacity: 0.5;
}

.el-card-body { flex: 1; min-width: 0; }
.el-card-title {
  font-size: 15px; font-weight: 700;
  color: var(--text); letter-spacing: -0.01em;
  margin-bottom: 4px; line-height: 1.35;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.el-card-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 12px; color: var(--muted);
  margin-bottom: 4px;
}
.el-card-status {
  display: inline-block;
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 100px;
  margin-top: 2px;
}
.el-card-status.confirm { background: rgba(217,101,42,0.12); color: var(--orange); }
.el-card-status.plan    { background: rgba(28,61,46,0.10);  color: var(--green); }

.el-card-arrow {
  flex-shrink: 0; color: #ccc; font-size: 18px;
}

.el-empty {
  text-align: center; padding: 60px 16px;
  color: var(--muted);
}
.el-empty-icon { font-size: 56px; margin-bottom: 12px; opacity: 0.5; }
.el-empty p { font-size: 16px; margin-bottom: 4px; color: var(--text); }
.el-empty-sub { font-size: 13px; color: var(--muted); }
```

### 7.6 测试步骤

```bash
# 1. 列表页能访问
curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/events
# 期望：200

# 2. 包含未来活动
curl -s https://cyc.center/events | grep -c "el-card"
# 期望：>= 1 （除非真没未来活动）

# 3. 包含 OG meta
curl -s https://cyc.center/events | grep "og:title"
# 期望：找到 og:title

# 4. 列表页里的链接能 click 进详情页
curl -s https://cyc.center/events | grep -oE 'href="/events/rec[a-zA-Z0-9]+"' | head -3
# 期望：3 个有效链接
```

**手动测试**：浏览器打开 `https://cyc.center/events`，活动按日期排序、卡片可点击。

### 7.7 完成判定

- [x] 7.6 的 4 个 curl 测试通过
- [x] 浏览器视觉检查通过
- [x] commit 消息形如 `feat: 活动列表页 (/events)`

---

## 8. Phase 3 — SEO 基础设施

### 8.1 任务

- [ ] 8.1.1 新建 `robots.txt`
- [ ] 8.1.2 新建 `api/sitemap.xml.js`（动态生成）
- [ ] 8.1.3 改 `vercel.json` 加 `/sitemap.xml` rewrite
- [ ] 8.1.4 改 `index.html` 汉堡菜单加"近期活动"入口

### 8.2 `robots.txt`（仓库根目录新建）

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /team/

Sitemap: https://cyc.center/sitemap.xml
```

### 8.3 `api/sitemap.xml.js`

```javascript
/**
 * GET /api/sitemap.xml
 * 动态生成 sitemap，包含全部公开页面 + 所有活动详情页
 */

import { fetchAllActivities } from './_activity.js';
import { kvGet, kvSet, isKvConfigured } from './_kv.js';

const SITE_URL = 'https://cyc.center';
const CACHE_TTL_SEC = 600;

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

export default async function handler(req, res) {
  let acts = null;
  const cacheKey = 'sitemap:acts';

  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) acts = JSON.parse(cached);
    } catch {}
  }

  if (!acts) {
    try {
      acts = await fetchAllActivities();
    } catch {
      acts = [];
    }
    if (acts.length && isKvConfigured()) {
      try { await kvSet(cacheKey, JSON.stringify(acts), CACHE_TTL_SEC); } catch {}
    }
  }

  // 静态页 + 每条活动
  const staticUrls = [
    { loc: SITE_URL + '/',       changefreq: 'weekly',  priority: 1.0 },
    { loc: SITE_URL + '/events', changefreq: 'daily',   priority: 0.9 },
    { loc: SITE_URL + '/tools',  changefreq: 'monthly', priority: 0.5 },
  ];

  const eventUrls = acts
    .filter(a => a.record_id && a.title)
    .map(a => ({
      loc: `${SITE_URL}/events/${a.record_id}`,
      lastmod: a.date || '',
      changefreq: 'monthly',
      priority: 0.7,
    }));

  const all = [...staticUrls, ...eventUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(xml);
}
```

### 8.4 `vercel.json` 再加一条

```json
{ "source": "/sitemap.xml", "destination": "/api/sitemap.xml" }
```

注意：因为函数文件名是 `sitemap.xml.js`（含点），Vercel 会路由为 `/api/sitemap.xml`。也可以重命名为 `sitemap-xml.js` 然后 destination 改成 `/api/sitemap-xml`。两种都行。

### 8.5 主页菜单加入口

打开 `index.html`，找到现有汉堡菜单（约第 30-55 行附近的 `<nav class="menu-list">`），在"今天吃什么"和"活动信息提取"之间插入：

```html
<a class="menu-item" href="/events">
  <div class="menu-icon">📅</div>
  <div class="menu-info">
    <div class="menu-name">近期活动</div>
    <div class="menu-desc">公开活动日历 · 可分享</div>
  </div>
</a>
```

### 8.6 测试步骤

```bash
# robots.txt 在
curl https://cyc.center/robots.txt
# 期望：列出 Sitemap 链接

# sitemap 能生成
curl -s https://cyc.center/sitemap.xml | head -20
# 期望：XML 格式，包含 /events/recXXX 条目

# 用 Google 的 rich result test 工具
# 浏览器打开：https://search.google.com/test/rich-results
# 输入：https://cyc.center/events/{某真实record_id}
# 期望：能解析出页面，OG 图正常
```

### 8.7 完成判定

- [x] 8.6 的测试通过
- [x] commit 消息形如 `feat: 加 robots/sitemap + 主页活动入口`

---

## 9. Phase 4 — 抛光（可选，不阻塞上线）

### 9.1 缓存失效

`add-activity.js` 和 `delete-activity.js` 成功之后，删除对应的 KV cache：

```javascript
// 在 add-activity.js 成功返回前加：
import { kvSet, isKvConfigured } from './_kv.js';
// ...
if (isKvConfigured() && recordData.data?.record?.record_id) {
  // 写空字符串 + TTL=1 等价于删除
  try { await kvSet('event:' + recordData.data.record.record_id, '', 1); } catch {}
  try { await kvSet('events:upcoming', '', 1); } catch {}
}
```

或者更彻底：给 `_kv.js` 加 `kvDel(key)` helper。

### 9.2 JSON-LD Event Schema

在 `event-page.js` 的 `renderEventDetail` 里 `</head>` 前加：

```javascript
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Event",
  "name": act.title,
  "startDate": act.date,
  "location": {
    "@type": "Place",
    "name": act.loc || "CYC 链岛青年社区",
    "address": "云南大理"
  },
  "image": ogImage,
  "description": act.desc,
  "organizer": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL },
  "eventStatus": isPast ? "EventCompleted" : "EventScheduled"
})}
</script>
```

让 Google 能识别活动卡片做富搜索。

### 9.3 默认 OG 图片

如果暂时没出图，可以先用一张 CYC 现成的空间照片。重要的是要 1200×630 比例。

---

## 10. 测试套件汇总

部署后跑这一套快速冒烟测试：

```bash
#!/bin/bash
echo "=== Phase 0 回归 ==="
echo -n "主页 200: "; curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/
echo -n "API 工作: "; curl -s -X POST https://cyc.center/api/get-activities \
  -H "Content-Type: application/json" -d '{"weekStart":"2026-04-01","weekEnd":"2026-05-30"}' \
  | grep -q '"success":true' && echo OK || echo FAIL

echo "=== Phase 1 验收 ==="
RID=$(curl -s -X POST https://cyc.center/api/get-activities \
  -H "Content-Type: application/json" \
  -d '{"weekStart":"2026-04-01","weekEnd":"2026-05-30"}' \
  | grep -oE '"record_id":"[^"]+' | head -1 | cut -d'"' -f4)
echo "测试 record: $RID"
echo -n "详情页 200: "; curl -s -o /dev/null -w "%{http_code}\n" "https://cyc.center/events/$RID"
echo -n "OG meta 全: "; curl -s "https://cyc.center/events/$RID" \
  | grep -E 'og:title|og:image|og:description' | wc -l
echo -n "404 不存在: "; curl -s -o /dev/null -w "%{http_code}\n" "https://cyc.center/events/recDOESNOTEXIST"

echo "=== Phase 2 验收 ==="
echo -n "列表页 200: "; curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/events
echo -n "卡片数量: "; curl -s https://cyc.center/events | grep -c "el-card"

echo "=== Phase 3 验收 ==="
echo -n "robots: ";   curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/robots.txt
echo -n "sitemap: ";  curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/sitemap.xml
```

---

## 11. 回滚预案

### 如果 Phase 0 出问题（破坏了主页）
- `git revert <commit>`
- push → Vercel 自动回滚
- 这一步动了核心 API，要特别小心

### 如果 Phase 1 出问题（活动详情页 500）
- `/events/:id` 是新路径，挂了不影响其他页面
- 直接 `git revert` 单 commit 即可
- 主页和现有功能不受影响

### 如果 Phase 2 出问题
- 同 Phase 1，路径独立

### 如果 Phase 3 出问题
- robots.txt / sitemap 是静态附加，挂了不影响功能（爬虫继续按默认行为）

### Vercel 上的紧急回滚
- Dashboard → Deployments → 上一个稳定版本 → 三点菜单 → "Promote to Production"

---

## 12. 附录：文件速查表

### 完成全部 4 个 Phase 后会动的文件

| 文件 | Phase | 操作 |
|---|---|---|
| `api/_activity.js` | 0 | 新建 |
| `api/_kv.js` | 0 | 修改（kvSet 加 TTL） |
| `api/get-activities.js` | 0 | 重构（使用 _activity） |
| `api/event-page.js` | 1 | 新建 |
| `api/events-list.js` | 2 | 新建 |
| `api/sitemap.xml.js` | 3 | 新建 |
| `api/add-activity.js` | 4（可选） | 修改（缓存失效） |
| `api/delete-activity.js` | 4（可选） | 修改（缓存失效） |
| `vercel.json` | 1, 2, 3 | 修改（追加 rewrites） |
| `styles.css` | 1, 2 | 追加（不替换） |
| `index.html` | 3 | 修改（汉堡菜单加项） |
| `robots.txt` | 3 | 新建 |
| `og-default.png` | 1（建议） | 新建 |
| `PLAN.md` | — | 本文件，归档 |

### 环境变量依赖

无新增。沿用现有：
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_APP_TOKEN` / `FEISHU_TABLE_ID`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`（可选；没有也能跑，靠 Edge cache 兜底）
- `SYNC_PASSWORD` / `TEAM_PASSWORD`（不影响公开页）

### 现有调用链不变

| 调用方 | 调用 | 状态 |
|---|---|---|
| `index.html` JS | `POST /api/get-activities` | 行为不变 ✅ |
| `index.html` JS | `POST /api/add-activity` | 行为不变 ✅ |
| `index.html` JS | `POST /api/delete-activity` | 行为不变 ✅ |
| `index.html` JS | `GET  /api/poster?token=` | 行为不变 ✅ |
| `team/index.html` | `POST /api/team-auth` | 行为不变 ✅ |
| `team/index.html` | `POST /api/change-password` | 行为不变 ✅ |

---

## 时间预估

按"专注、不分心"的节奏：

| Phase | 工作内容 | 预估 |
|---|---|---|
| Phase 0 | 重构 + 测试 | 30 min |
| Phase 1 | 详情页 SSR + CSS + 测试 | 2.5 h |
| Phase 2 | 列表页 SSR + CSS + 测试 | 1 h |
| Phase 3 | robots/sitemap/菜单 | 30 min |
| Phase 4 | 缓存失效 + JSON-LD | 30 min |
| **合计** | | **~5 h** |

外加你需要做的事：
- 出一张 1200×630 的 OG 默认图（10 min）
- 微信群里测一下 Phase 1 的卡片预览（5 min）
- Vercel 控制台确认每次部署 Ready（每 phase 部署一次）

---

**这个文件就是后续执行的唯一依据。**  
任何步骤遇到分歧、忘了为什么这么设计、想改方案——回来读对应的章节。改了方案要在这里也同步更新。
