# CYC.center 成员系统 + RSVP — 实施计划

> 版本：2026-04-30 · 基于实际仓库状态 + 飞书 schema 实测  
> 前置：PLAN.md（公开活动页系统）已全部交付  
> 这个文件是后续执行时**唯一的依据**——任何步骤遇到分歧，以这里写的为准。

---

## 1. 目标

把 cyc.center 从「公开活动页」升级到「社区 OS」：
- 任何活动都能让访客 **RSVP 报名**
- 每个社区成员有自己的 **profile 页**
- 嘉宾名片自动关联成员 profile
- 新成员可以从网页加入数据库

最终愿景：访客打开 `/events/{id}` 看到"X 人已报名 + Y 位嘉宾的简介"，点嘉宾名跳到 ta 的 profile。

---

## 2. 现状盘点（基于 4/30 实测）

### 2.1 已建好可复用的基础设施

| 模块 | 路径 | 用途 |
|---|---|---|
| 飞书鉴权 + CORS | `api/_feishu.js` | `applyCors()` / `getAccessToken()` / `checkFeishuEnv()` |
| KV 客户端 | `api/_kv.js` | `kvGet/Set/Del`（含 TTL） |
| 密码 helper | `api/_password.js` | 共享活动密码 |
| 活动数据层 | `api/_activity.js` | `parseRecord()` / `fetchActivity()` / `fetchAllActivities()` |
| 飞书附件代理 | `api/poster.js` | `/api/poster?token=` 代理图片（成员照片可复用） |
| SSR 模板模式 | `api/event-page.js` | 单条详情服务端渲染 + KV 缓存 + OG meta |
| 列表页 SSR | `api/events-list.js` | 列表页服务端渲染 + JSON-LD ItemList |
| 默认 OG 图 | `api/og-default.js` | 渐变 SVG fallback |

### 2.2 飞书三张表（同一个 base）

App Token：`PBn3bPOCYa2dBNsRZnXcv2R6nLF`

| 表名 | table_id | 角色 | 行数 |
|---|---|---|---|
| 社群成员名单 | `tblrkweaGBQHmPVx` | **成员主表**，41 个字段 | 2000+ |
| 全球线下据点列表 | `tblUqHY0GjKMmPaI` | **据点字典表**，含「城市」字段（值：大理/上海） | 4 |
| 社群活动参与人员 | `tbl887iFA41eI0iS` | **RSVP 表**（用户已新建） | 0（待录入）|

### 2.3 已有 2 张外部表（活动相关，独立 base）

App Token：`XNAJbaU63aaDUAsTf5icoFU9nFd`（env: `FEISHU_APP_TOKEN`）

| 表名 | 用途 |
|---|---|
| 📅活动日历 (`tblGB9chI6M3DRvU`) | 活动数据，由 cyc.center 主页录入 |
| 二维码 / 数据表 | 暂时不动 |

### 2.4 Vercel Hobby 限制 ⚠️

**单项目 12 个 Serverless 函数上限**，已触顶：

```
add-activity, change-password, delete-activity, event-page,
events-list, get-activities, list-fields, list-tables,
og-default, poster, sitemap-xml, team-auth = 12 个
```

新增成员系统**绝对不能直接加 4 个新函数**（变 16 → 部署失败）。

---

## 3. 数据契约

### 3.1 成员对象（解析后的格式）

```typescript
{
  record_id:    string;     // 飞书 record_id
  name:         string;     // 姓名
  nickname:     string;     // 称呼
  avatar:       null | { file_token: string; url: string; type: string };  // 照片（附件）
  bio:          string;     // 个人介绍
  job:          string;     // 职业描述
  company:      string;     // 公司|工作机构
  topics:       string;     // 关注的话题
  willShare:    string;     // 愿意做的分享
  identity:     string[];   // 社群身份（多选）
  contribution: string[];   // 愿意做出的贡献（多选）
  hubs:         string[];   // 现在所在据点（关联，存据点表 record_id 数组）
  cities:       string[];   // 据点对应的城市（join 据点表 → 城市字段拿到）
  hidden:       boolean;    // 在社群成员列表中隐藏 ← 公开页的过滤位
}
```

⚠️ **不输出**到工具层的字段（隐私）：微信号、电话、邮箱、身份证号、生日、年龄、推荐人、706链接、粉丝量、MBTI

> MVP 不向前端暴露上面这些。即使 admin 后台也只在编辑场景用。

### 3.2 据点对象

```typescript
{ record_id: string; name: string; city: '大理' | '上海' }
```

只用作 join 用，本身不暴露页面。

### 3.3 RSVP 对象

```typescript
{
  record_id:        string;
  name:             string;     // 必填
  bio:              string;     // 个人简介（发起者/嘉宾时展示）
  activity_rec_id:  string;     // 关联活动 ID（活动表的 record_id）
  activity_title:   string;     // 关联活动名称（冗余字段，不可信，以活动表为准）
  roles:            string[];   // 角色多选：['活动发起者','嘉宾','活动参与者']
  wechat:           string;     // 微信号（选填）
  member_rec_id:    string;     // 关联成员 ID（如果在成员表里，存对方 record_id）
  hubs:             string[];   // 现在所在据点（用户在 RSVP 表也加了这字段）
  registered_at:    number;     // 注册时间（自动）
}
```

---

## 4. 设计决策（锁死，不再讨论）

### 4.1 城市筛选

**用「现在所在据点」的关联字段 + join 据点表的「城市」**。

页面上提供 `[大理] [上海]` 两个 tab。默认大理。

理由：据点表只有 4 条，cache 一次就够；筛选可靠（不是 substring match）。

### 4.2 公开 vs 隐藏

- **默认全部公开**（成员表已存在的 2000+ 不可能逐个 opt-in）
- 用 `在社群成员列表中隐藏` 复选框作为 **opt-out 开关**——勾上的不进公开页
- Admin 后台可见**全部**

### 4.3 RSVP 的"角色"模型

每条 RSVP 一行 = "某人在某活动中担任某角色"。

- 角色 = 多选：`活动发起者` / `嘉宾` / `活动参与者`
- 同一活动同一人可以多角色（如发起者也是参与者）
- 同一人在不同活动会有多条 RSVP 记录

**不修改活动表的「发起者」字段**——保留作 fallback。

### 4.4 渲染优先级

详情页"嘉宾"卡片：
1. 优先从 RSVP 表取 `角色 ∈ {活动发起者, 嘉宾}` 的记录
2. RSVP 表里没有 → 回退到活动表的「发起者」自由文本字段（老活动）

### 4.5 写入权限

- RSVP 报名：**公开**（无密码），跟评论性质一样
- 修改成员：**密码保护**，复用 SYNC_PASSWORD
- 删除 RSVP：暂不支持（管理员去飞书后台删）

### 4.6 缓存策略

| 数据 | 缓存 key | TTL | 失效时机 |
|---|---|---|---|
| 成员列表（按城市） | `members:dali` / `members:shanghai` | 30 min | community-write 后清 |
| 单个成员 | `member:{rec_id}` | 30 min | community-write 后清该成员 |
| RSVP 列表（按活动） | `rsvp:activity:{rec_id}` | 5 min | rsvp-add 后清该活动 |
| 据点表 | `locations:all` | 24 h | 极少变 |

### 4.7 函数路由策略

为挤进 12 函数上限，**多端点合并到一个文件用 query 区分**：

- `community-page.js` 同时承担 `/community`（列表）和 `/community/:id`（详情）和 `/community/admin`（admin 模式）
- `team-auth.js` 同时处理验证和改密码（用 `?action=verify|change-password`）
- 删 `list-tables.js` / `list-fields.js`（一次性调试已结束）

### 4.8 嘉宾联动

录入新活动时**自动写 RSVP 表**：
- 用户在主页录入活动 → "嘉宾"输入框里每个嘉宾名字 → 同步写一条 `角色=活动发起者` 的 RSVP 记录
- 自动尝试匹配成员表：如果姓名在成员表里有 → 填 `member_rec_id`，profile 链接自动生效
- 老活动不动；用户访问老活动详情时显示一个"补全嘉宾资料 →"按钮（带去 admin 编辑）

---

## 5. Vercel 函数预算（关键约束）

### 5.1 现状

12 个，已满。

### 5.2 删 + 合并 → 释放 4 个

| 操作 | 函数变化 | 累计释放 |
|---|---|---|
| 删 `list-tables.js` | -1 | 1 |
| 删 `list-fields.js` | -1 | 2 |
| 合 `change-password.js` 入 `team-auth.js`（用 `?action=` 区分） | -1 | 3 |

→ **8 个剩余**

### 5.3 加新函数

| 新增 | 用途 | 增加 |
|---|---|---|
| `community-page.js` | 列表 + 详情 + admin 视图（按 query 区分） | +1 |
| `community-write.js` | 添加/编辑成员（密码保护） | +1 |
| `rsvp.js` | 报名 + 列出（按 method 区分 GET/POST） | +1 |

→ **8 + 3 = 11 个，留 1 个余量** ✅

---

## 6. 阶段拆分

```
Phase A  函数瘦身（释放 12 函数预算）
   │     · 删 list-tables / list-fields
   │     · 合并 change-password 入 team-auth
   │     · 不破坏对外行为
   ↓
Phase B  数据层（成员 + RSVP）
   │     · _member.js / _rsvp.js
   │     · 添加 env vars
   │     · 不暴露端点，只为后续 Phase 用
   ↓
   ├──→ Phase C  RSVP（公开报名）
   │           · 详情页加报名按钮 + 报名列表
   │           · /api/rsvp
   │
   └──→ Phase D  公开成员目录 /community
             · 列表（按城市切换）
             · 详情页（profile）
             ↓
        Phase E  管理后台 /community/admin
                · 搜索 + 修改入住状态 + 添加新成员
                ↓
        Phase F  嘉宾联动（可选，锦上添花）
                · 录活动同步写 RSVP
                · 老活动「补全嘉宾」入口
```

每个 Phase 独立部署、独立可用、独立可回滚。

---

## 7. Phase A — 函数瘦身

### 7.1 目标

释放 4 个函数槽位，**不改变对外行为**。

### 7.2 任务

- [ ] 7.2.1 `git rm api/list-tables.js`
- [ ] 7.2.2 `git rm api/list-fields.js`
- [ ] 7.2.3 把 `change-password.js` 内容合到 `team-auth.js`（用 `?action=` 路由）
  - `?action=verify`（默认）→ 旧的 team-auth 行为
  - `?action=change-password` → 旧的 change-password 行为
- [ ] 7.2.4 修改 `team/index.html` 里的两处 fetch 调用：
  - `fetch('/api/team-auth', ...)` 不变
  - `fetch('/api/change-password', ...)` → `fetch('/api/team-auth?action=change-password', ...)`
- [ ] 7.2.5 部署 + 测试团队页登录 / 改密码功能完好

### 7.3 完成判定

- [ ] 函数总数从 12 → 9（部署成功）
- [ ] 团队页登录正常（用旧密码能进）
- [ ] 在悠洋详情卡里改密码功能正常
- [ ] 主页活动同步功能仍正常（用新密码）

### 7.4 风险 + 回滚

风险：合并 team-auth 时 break 团队页。回滚：`git revert` 单 commit。

---

## 8. Phase B — 数据层

### 8.1 目标

加两个共享模块（`_` 前缀，不算函数），让后续 Phase 直接复用。

### 8.2 添加 Vercel 环境变量

在 Vercel Dashboard → Settings → Environment Variables 加：

```
FEISHU_MEMBER_APP_TOKEN  = PBn3bPOCYa2dBNsRZnXcv2R6nLF
FEISHU_MEMBER_TABLE_ID   = tblrkweaGBQHmPVx
FEISHU_RSVP_TABLE_ID     = tbl887iFA41eI0iS
FEISHU_LOCATIONS_TABLE_ID = tblUqHY0GjKMmPaI
```

不用加 RSVP 和 Locations 的 app_token——它们跟 member 同一个 base。

### 8.3 文件 1：`api/_member.js`（新建）

```javascript
import { getAccessToken } from './_feishu.js';

const APP_TOKEN  = process.env.FEISHU_MEMBER_APP_TOKEN;
const TABLE_ID   = process.env.FEISHU_MEMBER_TABLE_ID;
const LOC_TABLE  = process.env.FEISHU_LOCATIONS_TABLE_ID;

// ─────────── 解析 ───────────

export function parseMember(record, locations) {
  // record: 飞书 record
  // locations: { record_id → city } 据点 ID 映射，由 fetchLocations() 提供
  // 返回 3.1 节定义的 Member 对象
  // ...
}

// ─────────── I/O ───────────

export async function fetchLocations() {
  // 拉据点表全部 4 条
  // 返回 [{ record_id, name, city }] 和 { id_to_city: {...} }
}

export async function fetchAllMembers(opts = {}) {
  // 拉所有成员（飞书分页 100/页 → 跑 ~20 次）
  // opts.includeHidden=true 才包含勾选了"隐藏"的
  // 返回 Member[]
}

export async function fetchMember(rec_id) {
  // 拉单个成员
}

export async function fetchMembersByCity(city) {
  // 拉某城市的成员（基于 fetchAllMembers + filter）
  // city: '大理' | '上海'
}

export async function searchMembers(query) {
  // 全字段模糊搜索（name / nickname / bio / job / company / topics）
  // 返回 Member[]，最多 50 条
}

export async function writeMember(memberData, isUpdate) {
  // 写入或更新（用于 admin）
  // memberData: { name, nickname, ..., hidden }
  // isUpdate: 有 record_id 就 PUT 否则 POST
  // 返回 { record_id, success }
}
```

### 8.4 文件 2：`api/_rsvp.js`（新建）

```javascript
import { getAccessToken } from './_feishu.js';

const APP_TOKEN = process.env.FEISHU_MEMBER_APP_TOKEN;
const TABLE_ID  = process.env.FEISHU_RSVP_TABLE_ID;

export function parseRsvp(record) {
  // 返回 3.3 节定义的 Rsvp 对象
}

export async function fetchRsvpsForActivity(activity_rec_id) {
  // 用飞书 search API 加 filter 拉某活动的所有 RSVP
}

export async function addRsvp(data) {
  // POST 新建 RSVP 记录
  // data: { name, activity_rec_id, activity_title, roles, wechat, bio, member_rec_id }
  // 返回 { record_id, success }
}

export async function fetchAllRsvps() {
  // 用于管理（不上 MVP）
}
```

### 8.5 缓存

`_member` 和 `_rsvp` 自己不操心 KV——让调用方决定。

例外：`fetchLocations()` 内部用 KV 缓存 24h（极少变）。

### 8.6 测试

数据层不直接对外，只通过下面 Phase 的端点测试。

### 8.7 完成判定

- [ ] 4 个新 env var 已在 Vercel 配置
- [ ] `_member.js` 和 `_rsvp.js` 已 commit
- [ ] commit 但**不部署测试**（没有端点调用，等 Phase C 才有效果）

---

## 9. Phase C — RSVP（公开报名）

### 9.1 目标

`/events/{id}` 详情页底部显示嘉宾卡 + 报名者列表 + "我要参加"按钮。

### 9.2 任务

- [ ] 9.2.1 新建 `api/rsvp.js`
- [ ] 9.2.2 修改 `api/event-page.js`：
  - 详情渲染前从 RSVP 表取该活动的所有报名记录
  - 嘉宾卡数据源：RSVP 表里 `角色 ∈ {活动发起者, 嘉宾}`，回退到活动表 `发起者` 字段
  - 渲染"已报名 N 位"列表
  - 加 "我要参加" 按钮（HTML + JS）
- [ ] 9.2.3 在 `styles.css` 末尾追加 RSVP 相关样式
- [ ] 9.2.4 部署 + 测试

### 9.3 `api/rsvp.js` 端点设计

```
POST /api/rsvp
  Body: { activity_rec_id, name, wechat?, bio?, roles? }
  默认 roles = ['活动参与者']
  返回: { success, record_id }
  
  无密码（公开行为）
  限频：同一 IP 同一活动同一名字，5 分钟内只能提交一次（防垃圾）
  
GET /api/rsvp?activity_id=X
  返回该活动的报名汇总:
  {
    success: true,
    hosts: [...],     // 角色含 '活动发起者' 或 '嘉宾'
    attendees: [...], // 角色含 '活动参与者'
    counts: { hosts: N, attendees: M }
  }
```

### 9.4 详情页 UI 改造（event-page.js）

详情页结构变化（在原来的"嘉宾"section 之后加）：

```
[海报]
[标签 + 标题]
[基本信息 dl]
[活动简介]
[详情·流程]
─────────────────
[嘉宾]                    ← 改造：从 RSVP 表来
  - 张三（个人简介展开...）  ← 点击展开
  - 李四 → 链 /community/{id}（如有 member_rec_id）
─────────────────
[报名情况]                ← 新增
  ✓ 已 12 位伙伴报名
  [头像] 王五  [头像] 赵六  ...
  [我要参加 →]            ← 新增按钮
─────────────────
[footer]
```

报名按钮点击 → 弹 modal:
- 姓名（必填）
- 微信号（选填）
- 个人简介（选填，限 100 字）
- 提交 → 调 `/api/rsvp` POST

提交成功后页面无刷新更新报名列表（重新调 GET）。

### 9.5 测试步骤

```bash
# 1. RSVP 端点存在
curl -X POST https://cyc.center/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"activity_rec_id":"recvi4Sf3nS5Rz","name":"测试用户","wechat":"test"}'
# 期望: { success: true, record_id: "rec..." }

# 2. 拉报名列表
curl "https://cyc.center/api/rsvp?activity_id=recvi4Sf3nS5Rz"
# 期望: { hosts: [], attendees: [{ name: "测试用户", ... }], counts: {...} }

# 3. 详情页 HTML 包含报名按钮
curl https://cyc.center/events/recvi4Sf3nS5Rz | grep -c "我要参加"
# 期望: 1

# 4. 详情页显示报名数
curl https://cyc.center/events/recvi4Sf3nS5Rz | grep "已 [0-9]\+ 位伙伴报名"
```

手动：
- 浏览器打开活动详情页
- 点"我要参加"
- 填名字提交
- 列表立即更新
- 微信分享卡片预览仍正常（OG meta 没动）

### 9.6 完成判定

- [ ] curl 测试 1-4 全过
- [ ] 浏览器手动报名一次成功，飞书 RSVP 表里出现该记录
- [ ] 同一活动二次提交也能成功（不去重）
- [ ] 详情页 RSVP 数字 5 分钟内更新（KV TTL）

---

## 10. Phase D — 公开成员目录 `/community`

### 10.1 目标

`cyc.center/community` 列表页 + `cyc.center/community/{id}` 单成员页。

### 10.2 任务

- [ ] 10.2.1 新建 `api/community-page.js`（一个文件搞定 list + detail，按 query 区分）
- [ ] 10.2.2 改 `vercel.json` 加 rewrites
- [ ] 10.2.3 在 `styles.css` 追加 `.cm-*` 命名空间样式（community 列表 / 详情）
- [ ] 10.2.4 主页汉堡菜单加「社区成员」入口
- [ ] 10.2.5 部署 + 测试

### 10.3 `api/community-page.js` 路由

```
/community              → handler (mode = 'list', city = '大理')
/community?city=上海    → handler (mode = 'list', city = '上海')
/community/{rec_id}     → handler (mode = 'detail', id = rec_id)
/community/admin        → handler (mode = 'admin')   // Phase E 实现
```

vercel.json 改造：

```json
{ "source": "/community", "destination": "/api/community-page" },
{ "source": "/community/admin", "destination": "/api/community-page?mode=admin" },
{ "source": "/community/:id", "destination": "/api/community-page?id=:id" }
```

注意路由顺序：`/community/admin` 必须在 `/community/:id` 之前（admin 也是字符串，会 match 到 :id）。

### 10.4 列表页（mode=list）

UI 草图：

```
┌────────────────────────────────────────┐
│  ‹ 主页              CYC.center        │
├────────────────────────────────────────┤
│  社区成员                              │
│  Connected Youth Community · 大理     │
│                                        │
│  [  大理 (XX 人)  ] [ 上海 (XX 人) ]   │  ← Tab 切换
├────────────────────────────────────────┤
│  ┌──┬──┬──┬──┐                       │
│  │👤│👤│👤│👤│ ← 头像格 (4 列 grid)  │
│  ├──┼──┼──┼──┤                       │
│  │👤│👤│👤│👤│                       │
│  └──┴──┴──┴──┘                       │
│  名字 / 称呼                            │
│  职业一行                               │
└────────────────────────────────────────┘
```

每张卡显示：照片（圆形 80×80）/ 称呼或姓名 / 职业描述 1 行。

点卡 → 跳 `/community/{rec_id}`。

OG meta 同 events-list（双语 description）。

### 10.5 详情页（mode=detail）

```
[大头像]
[姓名 / 称呼]
[职业描述]
─────────
[个人介绍]      ← bio
─────────
[关注的话题]    ← 标签
[愿意做的分享]
[感兴趣的活动]
─────────
[ta 发起或参与的活动]   ← 反向查 RSVP 表，列出关联活动
─────────
[footer]
```

OG meta 含成员名 + bio，方便分享时识别"这是某某"。

### 10.6 主页汉堡菜单加入口

`index.html` 菜单第 3 项加：

```html
<a class="menu-item" href="/community">
  <div class="menu-icon">👥</div>
  <div class="menu-info">
    <div class="menu-name">社区成员</div>
    <div class="menu-desc">2000+ CYC 伙伴 · 大理 / 上海</div>
  </div>
</a>
```

### 10.7 测试

```bash
# 1. 列表页 200
curl -o /dev/null -w "%{http_code}\n" https://cyc.center/community

# 2. 大理成员数 > 0
curl https://cyc.center/community | grep -c "cm-card"

# 3. 切上海
curl -o /dev/null -w "%{http_code}\n" "https://cyc.center/community?city=上海"

# 4. 详情页（拿一个真实成员 ID）
# 先随便取一个：
RID=$(curl -s https://cyc.center/community | grep -oE 'href="/community/rec[a-zA-Z0-9]+"' | head -1 | cut -d'"' -f2)
curl -o /dev/null -w "%{http_code}\n" "https://cyc.center$RID"

# 5. 隐藏成员不出现在列表
# 手动：在飞书勾一个成员的"在社群成员列表中隐藏" → 等 30 分钟（或清 KV）→ 重新打开 /community 应消失
```

### 10.8 完成判定

- [ ] curl 1-4 全过
- [ ] 大理列表显示合理人数（应该是 100+ 而不是 2000）
- [ ] 详情页显示头像（走 /api/poster 代理）
- [ ] OG 卡片预览（微信发链接）正常
- [ ] 隐藏的人不出现

---

## 11. Phase E — 管理后台 `/community/admin`

### 11.1 目标

密码保护的成员搜索 / 添加 / 修改入住状态界面。

### 11.2 任务

- [ ] 11.2.1 扩展 `api/community-page.js` 加 `mode=admin` 分支
- [ ] 11.2.2 新建 `api/community-write.js` 处理写操作
- [ ] 11.2.3 修改 `vercel.json`（已在 Phase D 加好 admin rewrite）
- [ ] 11.2.4 styles.css 追加 admin UI 样式
- [ ] 11.2.5 部署 + 测试

### 11.3 admin 页 UI

```
[密码登录卡 / 默认显示]
─────────
登录后:
┌────────────────────────────────────────┐
│  社区成员管理                          │
│  [搜索框: 姓名 / 微信号 / 公司]        │
│  [筛选: 全部 / 大理 / 上海 / 已隐藏]   │
│  [+ 添加新成员]                        │
├────────────────────────────────────────┤
│  ☐ 张三 · 大理CYC青年空间 · 在住      │  ← 可点击展开
│      职业: 设计师                       │
│      [编辑] [改入住] [隐藏/取消隐藏]   │
│  ☐ ...                                │
└────────────────────────────────────────┘
```

操作 button 调用 `/api/community-write`：

```
POST /api/community-write
  Body: {
    action: 'create' | 'update' | 'set-resident-status' | 'set-hidden',
    password: '...',
    record_id?: string,  // update / set-* 用
    data?: { ... }
  }
```

### 11.4 添加新成员表单

只暴露**最小必要字段**（避免 41 个字段铺满屏）：

- 姓名（必填）
- 称呼
- 微信号
- 个人介绍
- 公司 / 职业描述
- 现在所在据点（下拉，从据点表来）
- 据点入住状态（单选）

其他 30+ 字段：admin 想编辑 → 跳到飞书后台编辑（提供"在飞书打开此成员 →"链接）。

> 完全在网页里复刻 41 字段的表单太花哨，不必要——重点字段够用，长尾走飞书。

### 11.5 测试

```bash
# 1. 未登录访问 admin → 显示登录卡
curl -o /dev/null -w "%{http_code}\n" https://cyc.center/community/admin

# 2. 写入端点必须有密码
curl -X POST https://cyc.center/api/community-write \
  -H "Content-Type: application/json" \
  -d '{"action":"create","data":{"name":"测试"}}'
# 期望: 401

# 3. 带密码创建一个测试成员
curl -X POST https://cyc.center/api/community-write \
  -H "Content-Type: application/json" \
  -d '{"action":"create","password":"...","data":{"name":"测试成员"}}'
# 期望: { success: true, record_id: "..." }

# 4. 飞书表里能看到这条新记录
```

### 11.6 完成判定

- [ ] admin 页登录流程正常（用活动同步密码）
- [ ] 搜索"悠洋"能找到你自己
- [ ] 改某成员入住状态，等 30 分钟后 /community 列表反映
- [ ] 添加测试成员后能在飞书里看到
- [ ] 无密码访问 community-write 返回 401

---

## 12. Phase F — 嘉宾联动（可选锦上添花）

### 12.1 目标

录活动时**自动写 RSVP 表**，让新活动一上线就有结构化嘉宾资料。

### 12.2 任务

- [ ] 12.2.1 修改 `api/add-activity.js`：
  - 写完活动后，对 `activity.spk` 数组里每个嘉宾自动调 `_rsvp.addRsvp()`
  - 角色 = ['活动发起者']
  - 自动尝试 `searchMembers(嘉宾名字)` 匹配 → 填 `member_rec_id`
- [ ] 12.2.2 修改主页 `index.html` 录入活动后的 UI 反馈：
  - 显示"已写入 N 条嘉宾 RSVP 记录"
  - 如果有未匹配上成员表的嘉宾，显示"未在成员表找到：XX, YY，是否[添加到成员表 →]"
- [ ] 12.2.3 老活动详情页底部：如果该活动 RSVP 表里没有任何 `角色=活动发起者` 的记录 → 显示"嘉宾资料尚未补全 [补全 →]"按钮，跳到 admin 编辑

### 12.3 完成判定

- [ ] 录入新活动后飞书 RSVP 表自动出现嘉宾记录
- [ ] 详情页嘉宾卡显示头像（如果匹配到成员）
- [ ] 点嘉宾名跳 `/community/{rec_id}`

---

## 13. 测试套件汇总

每个 Phase 部署后跑：

```bash
#!/bin/bash
# 跨 Phase 冒烟测试

echo "=== Phase A 函数瘦身 ==="
echo -n "主页: "; curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/
echo -n "团队登录: "; curl -s -X POST https://cyc.center/api/team-auth \
  -H "Content-Type: application/json" -d '{"password":"wrong"}' \
  | grep -q '密码错误' && echo OK || echo FAIL
echo -n "活动同步密码改: "; curl -s -X POST "https://cyc.center/api/team-auth?action=change-password" \
  -H "Content-Type: application/json" -d '{}' \
  | grep -q '请填写' && echo OK || echo FAIL

echo "=== Phase C RSVP ==="
RID=$(curl -s https://cyc.center/api/get-activities -X POST \
  -H "Content-Type: application/json" -d '{"weekStart":"2026-04-01","weekEnd":"2026-05-30"}' \
  | grep -oE '"record_id":"[^"]+' | head -1 | cut -d'"' -f4)
echo -n "详情页含报名按钮: "; curl -s "https://cyc.center/events/$RID" | grep -q "我要参加" && echo OK || echo FAIL
echo -n "RSVP GET: "; curl -s "https://cyc.center/api/rsvp?activity_id=$RID" | grep -q '"success"' && echo OK || echo FAIL

echo "=== Phase D Community ==="
echo -n "列表页大理: "; curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/community
echo -n "列表页上海: "; curl -s -o /dev/null -w "%{http_code}\n" "https://cyc.center/community?city=上海"

echo "=== Phase E Admin ==="
echo -n "Admin 入口: "; curl -s -o /dev/null -w "%{http_code}\n" https://cyc.center/community/admin
echo -n "写入端点鉴权: "; curl -s -X POST https://cyc.center/api/community-write \
  -H "Content-Type: application/json" -d '{"action":"create"}' \
  | grep -q '401\|密码' && echo OK || echo FAIL
```

---

## 14. 时间预估

按"专注、不分心"的节奏：

| Phase | 内容 | 预估 |
|---|---|---|
| Phase A | 删 / 合并 / 测试 | 30 min |
| Phase B | 数据层（_member + _rsvp） | 1.5 h |
| Phase C | RSVP 端点 + 详情页改造 + UI | 2 h |
| Phase D | community 列表 + 详情 + CSS + 主页菜单 | 2.5 h |
| Phase E | admin 后台 + community-write | 2 h |
| Phase F | 嘉宾联动（可选） | 1 h |
| **合计** | | **~9.5 h**（不含 F 8.5h） |

外加你需要做的：
- Phase B 配 4 个 Vercel env vars（5 min）
- 每个 Phase 部署后浏览器手动验一次（2-5 min/Phase）

---

## 15. 附录

### 15.1 文件变更速览

| 文件 | Phase | 操作 |
|---|---|---|
| `api/list-tables.js` | A | 删 |
| `api/list-fields.js` | A | 删 |
| `api/change-password.js` | A | 删（合到 team-auth） |
| `api/team-auth.js` | A | 改（加 ?action= 路由） |
| `team/index.html` | A | 改（fetch 路径调整） |
| `api/_member.js` | B | 新建 |
| `api/_rsvp.js` | B | 新建 |
| `api/rsvp.js` | C | 新建 |
| `api/event-page.js` | C | 改（加 RSVP 渲染 + 按钮） |
| `styles.css` | C, D, E | 追加（不替换） |
| `api/community-page.js` | D, E | 新建 + 后扩展 |
| `vercel.json` | D | 改（加 /community* rewrites） |
| `index.html` | D | 改（菜单加项） |
| `api/community-write.js` | E | 新建 |
| `api/add-activity.js` | F | 改（自动写 RSVP） |

### 15.2 函数最终预算

```
Phase A 后:  9
+ Phase B:   9 (data layer 不算)
+ Phase C:   10 (rsvp.js)
+ Phase D:   11 (community-page.js)
+ Phase E:   12 (community-write.js)
余量:        0 ⚠️
```

**未来若需第 13 个函数 → 必须升 Vercel Pro 或继续合并。**

### 15.3 环境变量速查

| Var | Phase | 值 |
|---|---|---|
| `FEISHU_MEMBER_APP_TOKEN` | B | `PBn3bPOCYa2dBNsRZnXcv2R6nLF` |
| `FEISHU_MEMBER_TABLE_ID` | B | `tblrkweaGBQHmPVx` |
| `FEISHU_RSVP_TABLE_ID` | B | `tbl887iFA41eI0iS` |
| `FEISHU_LOCATIONS_TABLE_ID` | B | `tblUqHY0GjKMmPaI` |

其余沿用现有：FEISHU_APP_ID / SECRET / APP_TOKEN / TABLE_ID / SYNC_PASSWORD / TEAM_PASSWORD / KV_*

---

**这个文件就是后续执行的唯一依据。**  
任何 Phase 实施时遇到分歧、忘了为什么这么设计、想改方案——回来读对应章节。改方案要在这里同步更新。
