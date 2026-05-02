# Master Plan — How to Use Your Skills to Ship cyc.center

> Living document. Updated 2026-05-02. Tick boxes as you go.

## 现状盘点（你拥有的 toolkit）

- **85 个 skill**（设计 / PM / 法务 / 工程 / 内容）
- **3 个 MCP**（lark / vercel / hex-graph）
- **1 个 plugin**（pitch-deck，待装）
- **2 份战略文档**（PRODUCT.md / DESIGN.md）
- **1 套设计系统**（daybreak-os v2，三层架构）

工具已经超出 95% 独立产品人。**接下来是执行。**

---

## 战略定位 — 双轨漏斗 + 工具先行（v2 更新）

cyc.center 是**一个产品两条节奏**：

```
┌─ 公共面 (L4) ─ 转化漏斗 ─────────────────┐
│   Path A 初次认知 → "CYC 是什么？"        │
│   Path B 决策评估 → "我要不要去住？"      │  ← 拉新 / 转化
│   Path C 社交探索 → "有什么好玩的？"      │
└──────────────────────────────────────┘
        ↓ 转化进来后
┌─ 内部 (L3 / L2 / L1) ─ 社区 OS ──────────┐
│   工具间 (L2) — 已建：通告、约饭、团队   │  ← 留存 / 深化
│   客厅 (L3) — 待建：profile、RSVP        │
│   深度看见 (L1) — 待建：感谢、照片墙     │
└──────────────────────────────────────┘
```

**两个 narrative 并存，但 build sequence 不同：**

- **Build order**：从**痛点工具**开始（已有：通告/约饭/团队），逐步把工具背后的模式 OS 化成可推广产品
- **Story order**（对外，给投资人）：起手就讲 "可推广社区 OS"，工具是 traction 证据
- **Comparable**：不是 "Notion 类 SaaS"，是 **"[Selina × Notion]"** — 实体社区 + 数字 OS，可复用到其他空间

**当前不平衡（你自己研究发现的）：**

| 路径 | 现有支持 | 优先级 |
|---|---|---|
| Path C 社交探索 | ✅ 已强（活动、约饭、团队） | 维持 |
| Path A 初次认知 | ❌ 几乎为零（缺品牌叙事、空间相册） | **高** |
| Path B 决策评估 | ❌ 几乎为零（缺房型、价格、评价） | **中-高** |

→ Phase 3 的 L4 工作要按 Path A 优先、B 次之、C 优化的顺序补齐。

---

## 4 阶段执行计划（建议 4-6 周完成一轮）

每阶段都是 *目标 → 用什么 skill → 具体 prompt → 产出物*。

---

### Phase 1 — 现状审计（3-5 天）

**目标**：知道 cyc.center 真实是什么样、哪里有问题、哪里还没建。投资人/合作者问起来你能 1 分钟讲清。

#### 1.1 代码层面体检

- [ ] 跑 levnikolaevich 的 codebase-audit-suite

  **Prompt**:
  > 用 codebase-audit-suite 全面审计 cyc-tools 项目。重点：安全漏洞、死代码、复杂度热点、依赖问题、可观测性缺失。按严重度排序输出修复清单，每条带文件路径和修复建议。

- [ ] 让 hex-graph 索引你的 codebase

  **Prompt**:
  > 用 hex-graph-mcp 索引这个 codebase，构建符号图。然后告诉我：（1）所有 API 路由的入口；（2）哪些函数被引用最多；（3）哪些文件耦合度最高。

#### 1.2 流程可视化

- [ ] 用 walkthrough 出 3 张核心流程图

  **Prompt 1**（活动数据流）:
  > $walkthrough 活动从用户填写通告生成器 → 同步到飞书 Bitable → 显示在 /events 公开页面 的完整数据流

  **Prompt 2**（成员/RSVP 流）:
  > $walkthrough 一个成员从首次访问 cyc.center → 查看活动 → RSVP → 出席 → 留下足迹 的预期流程（包括尚未实现的部分）

  **Prompt 3**（KV 缓存 + Bitable 写入）:
  > $walkthrough api/_feishu.js + api/_kv.js 的协作流：哪些操作走缓存、哪些直接写 Bitable、缓存什么时候失效

#### 1.3 系统架构图（投资人版）

- [ ] 用 architecture-diagram 出一张能放进 deck 的图

  **Prompt**:
  > 用 architecture-diagram 出一张 cyc.center 的系统架构图，dark theme，标准 SVG。包括：用户层（浏览器/微信）、Edge 层（Vercel Functions）、Service 层（飞书 API、Upstash KV）、Data 层（Bitable apps）。给非工程师看也能懂。

#### 1.4 UI/UX 现状审视

- [ ] 用 impeccable critique 给现有页面打分

  **Prompt**:
  > impeccable critique 这几个页面：(1) /  首页（活动通告生成器），(2) /events 即将上线的活动列表，(3) /community 成员目录。基于 PRODUCT.md 的"实验/playful/有点怪"调性 + DESIGN.md 的"大理玻璃"系统，找出违规和可改进点。

#### 1.5 问题陈述

- [ ] 把审计结果汇成一份 problem statement

  **Prompt**:
  > 用 define-problem-statement 把上面所有审计结果合并成一份"cyc.center 当前最该解决的 3 个问题"文档。每个问题要有：用户影响、商业上下文、成功标准。

**Phase 1 产出**：`audit-report.md` + 3 个 walkthrough HTML + 1 张架构图 SVG + 1 份 problem statement

---

### Phase 2 — 战略清晰（5-7 天）

**目标**：决定接下来 3-6 个月做什么，不做什么，为什么。

#### 2.0 转化路径分析（新增 — v2 关键步骤）

> 这一步**先做**，因为它会改变 persona / opportunity tree / lean canvas 的颗粒度。

- [ ] 把 A/B/C 三条路径画成 mermaid flowchart

  **Prompt**:
  > 用 utility-mermaid-diagrams 画三条用户路径：
  > - **Path A 初次认知**："CYC 是什么？" — 品牌理念首屏 → 空间照片 → 社区文化 → 价格预订
  > - **Path B 决策评估**："我要不要去住？" — 价格房型 → 设施 → 评价氛围 → 预订
  > - **Path C 社交探索**："有什么好玩的？" — 活动日历 → 成员故事 → 开放政策 → 到访
  >
  > 每条路径每个节点标注：(a) 用户此刻的问题，(b) cyc.center 应该展示什么信息，(c) 下一步动作的钩子，(d) 当前状态（已建/部分/缺失）。

- [ ] 用 ux-psychology 给每条路径配心理学武器

  **Prompt**:
  > 用 ux-psychology 为 A/B/C 各找 2-3 个最相关原则。我的 prior：
  > - Path A 用 curiosity gap + storytelling + identity-fit signal
  > - Path B 用 social proof + risk reversal + concrete specifics
  > - Path C 用 fresh action + low-stakes invitation + endowed progress
  >
  > 验证或反驳我的 prior，并给出每条路径的关键 UX 钩子和文案样例。

- [ ] 路径漏斗当前状态盘点

  **Prompt**:
  > 给我一份 A/B/C 三路径的"现状 vs 目标"差距表：每条路径每个阶段，cyc.center 当前的支持力度（0-5 分），目标力度，差距，最该补的 1-2 个 page/feature。

#### 2.1 用户深度理解

- [ ] 给 PRODUCT.md 里 3 类用户各扩展成完整 persona

  **Prompt**:
  > 用 foundation-persona 为以下 3 类用户分别创建 v2.5 persona：(1) 大理本地创意/独立从业者（核心），(2) 数字游民（融入入口），(3) 短期访客（社区脸面）。每个 persona 包括动机、痛点、典型一天、与 cyc.center 的接触场景。

- [ ] 画 JTBD 画布

  **Prompt**:
  > 用 define-jtbd-canvas 为核心用户（大理在地创意人）画 JTBD 画布。功能、情感、社交三个维度。明确他们雇 cyc.center 来完成什么 job，以及现在用什么替代品（微信群、Notion、口口相传）。

#### 2.2 竞品 / 定位

- [ ] 跑竞品分析

  **Prompt**:
  > 用 discover-competitive-analysis 跑两组竞品（cyc.center 是双轨产品，要分别对标）：
  >
  > **A. 实体 coliving / 社区空间** — 看他们怎么做转化漏斗（A/B/C 路径）
  > - 国内：706 青年空间、DNA 数字游民公社、安福路 OnTheRoad、阿那亚社区
  > - 海外：Outsite、Selina、Roam、Sun and Co.
  > - 维度：首屏叙事、房型展示、社区文化呈现、定价透明度、预订路径长度
  >
  > **B. 社区软件 / 工具站** — 看他们怎么做留存（L2-L3-L1）
  > - Read.cv、Substack、Discord、Notion Community、Slack 早期
  > - 维度：成员 profile 设计、活动机制、归属感设计、付费转化
  >
  > 最后输出 cyc.center 在 **[Selina × Notion]** 这个交叉 lane 的差异化机会 —— 这个组合就是你的市场定位。

#### 2.3 机会优先级

- [ ] 画 opportunity tree

  **Prompt**:
  > 用 define-opportunity-tree。Desired outcome: cyc.center 成为大理创意社群第一个想到的数字基础设施。基于 Phase 1 的现状 + PRODUCT.md 的 5 层架构（L0-L4），列出 opportunities → solutions，给出 ICE（impact/confidence/ease）排序。

#### 2.4 商业模式

- [ ] 写 lean canvas

  **Prompt**:
  > 用 foundation-lean-canvas 为 cyc.center 写一份精益画布。9 块都要：problem / customer / UVP / solution / channels / revenue / cost / metrics / unfair advantage。包括录像付费这类潜在 revenue stream。

#### 2.5 假设与实验

- [ ] 把最大的 2 个假设变成可测实验

  **Prompt**:
  > 基于 lean canvas 和 opportunity tree，找出 2 个最该验证的假设。用 define-hypothesis 写出来，再用 measure-experiment-design 设计验证方法。重点假设候选：(a) "成员 profile 页是不是激活社区参与的关键？" (b) "录像付费会不会破坏社区氛围？"

**Phase 2 产出**：3 份 persona + JTBD 画布 + 竞品分析 + opportunity tree + lean canvas + 2 个 hypothesis + experiment design

---

### Phase 3 — 真正建首页（v3 重写，玖玖说了算的版本）

**重要前置**：以 [homepage-design.md](homepage-design.md) 为最终设计依据。之前 plan 里所有"把工具搬走、首页变 landing"的方案作废。

**新方案核心**：首页一屏同时服务三种人 —— 没人需要搬家，没人需要找新入口。

> **首页结构**：
> - 顶部 25-35%：左右两张海报图（介绍社区入口 + 订房入口）
> - 中下部 65-75%：醒目的"创建活动"按钮 + 活动卡片流（每张含嘉宾+报名头像组）
> - 头像点击 → 展开人物卡片（profile 系统嵌入式）

**这意味着**：profile 系统、活动卡片改造、首页 hero 是**绑在一起的一锹**，不能拆。

---

#### 3.1 第一锹（同步上线，2 周）—— 首页 + profile + 活动卡片

##### 3.1.1 简化版 profile 系统

最小可用：让每个成员有 **头像 + 名字 + 一句话简介**。仅此三项，先够活动卡片头像有内容显示。

- [ ] 飞书 Bitable 加"成员"表（如果还没有），含字段：avatar / name / bio / record_id
- [ ] `/community/:id` 简化版页面：halo 卡片头像 + 名字 + 一句话 + "Ta 参加过" 活动列表

**Prompt**:
> 读 homepage-design.md 和 DESIGN.md。设计 /community/:id 简化版人物页：daybreak-os Daybook 风格 halo 卡片 + 头像 + 名字（28px Bold）+ 一句话简介（16px regular）+ 下方"Ta 参加过的活动"列表（拉 Bitable 成员关联活动）。给完整 vanilla HTML/CSS。

##### 3.1.2 活动卡片改造（首页用 + /events 列表也用）

每张卡片加嘉宾头像组 + 报名头像组。点击头像展开人物卡片（modal）。

- [ ] 卡片 HTML / CSS 改造（首页 + /events 共用）
- [ ] 人物卡片 modal：avatar / name / bio / "查看完整 profile →"链接

**Prompt**:
> 读 homepage-design.md。设计活动卡片新版：现有视觉 + 加嘉宾头像组（28-32px，最多 5 个）+ 报名头像组（24-28px，stack 叠加，最多 6-8 个）。点击任一头像不离开当前页，弹出 modal 显示人物卡片（avatar + name + bio + 查看完整 profile 链接到 /community/:id）。给完整改造 vanilla HTML/CSS + JS modal 行为。

##### 3.1.3 首页大改造

旧首页（活动通告生成器）搬到 `/generator`，老路径 30 天 redirect 到新首页。新首页结构按 homepage-design.md 实现。

- [ ] 旧 index.html 内容搬到 /generator
- [ ] vercel.json 加 redirect / 到 /generator 旧路径
- [ ] 新 index.html：双海报 hero + "创建活动" CTA + 活动卡片流

**Prompt**:
> 读 homepage-design.md。实现新首页：
> 1. 顶部 hero 25-35%：左右两张海报图（移动端上下堆叠），分别 link 到 /about 和 /rooms。先用 placeholder 占位图，文案可以是 "在大理，有这样一群人在认真做事" 和 "想试一个月吗"。
> 2. 紧接着 "创建活动" CTA 按钮（橙色 pill，醒目但不抢 hero）链到 /generator
> 3. 下方活动卡片流（动态从 /api/events-list 拉）—— 用 3.1.2 改造后的卡片组件
> 4. 全局保持 daybreak-os 大理玻璃风 + AAA 对比度。
> 把活动通告生成器（旧 index.html）搬到 /generator，加 vercel.json redirect。

##### 3.1.4 数据采集（前置必做）

不是黑话，就是埋点。让你能看到首页改完后用户怎么用。

- [ ] 加 Vercel Analytics（一行 import）—— 免费，page-level 数据立刻有
- [ ] 写一个最简 `/api/track` endpoint：接收 event 名 + 元数据，写到飞书 Bitable 一张"事件流"表
- [ ] 关键事件：
  - `hero_path_a_click`（点了介绍社区海报）
  - `hero_path_b_click`（点了订房海报）
  - `cta_create_event`（点了创建活动）
  - `event_card_click`
  - `event_card_avatar_click`
  - `profile_view`

##### 3.1.5 已经做完的（一小时改造 ✅）

- ✅ 活动详情页"对外开放"pill
- ✅ 活动详情页底部 #cyc 分享提示
- ✅ 旧首页访客引导条（这条上线后可以拆掉，因为新首页本身就是引导）

---

#### 3.2 第二锹（视第一锹效果决定，1-2 周）

##### 3.2.1 介绍页 /about（双海报海报 1 跳转目标）

- [ ] 品牌叙事 + 社区文化 + 嵌入照片墙 section
- [ ] 照片墙 section 可点击 → /community/memories（独立社区回忆页）

**Prompt**:
> 读 PRODUCT.md 和 homepage-design.md。设计 /about 介绍页：
> 1. 顶部品牌叙事 hero（大理实景照 + 一句话定位）
> 2. 中部"社区文化" section（3-6 个真实成员故事卡片，每张带 link 到 /community/:id）
> 3. 嵌入照片墙 section（gallery grid，参考 Mia 拍照传播路径）—— 整 section 可点击跳转到独立 /community/memories
> 4. 底部三选一 CTA：来活动 → /events / 想长租 → /rooms / 关注 → newsletter（可选）
> daybreak-os Atlas 层风格。

##### 3.2.2 房型页 /rooms（双海报海报 2 跳转目标）

- [ ] 房型卡片 grid + 价格 + 设施 + 试住政策 + 联系入口

**Prompt**:
> 读 PRODUCT.md（Path B 部分）和 homepage-design.md。设计 /rooms 房型页：
> 1. 房型卡片 grid（每间房一张：大照片 + 价格 + 容量 + 当前可入住日期）
> 2. 设施 / 一日生活时间线（可选，先简版）
> 3. 试住政策（如确定要做）+ 联系入口
> daybreak-os Atlas 层风格。

##### 3.2.3 活动结束页 / 回顾

- [ ] 活动结束后的 /events/:id 状态变化：照片墙 + 参与者头像 + 下次预告

**Prompt**:
> 设计活动结束后的 /events/:id 状态：peak-end rule —— 上半部分照片墙（grid）+ 中部参与者头像 grid（链到 profile）+ 底部"下次活动预告"卡片。daybreak-os Daybook 风格 halo 卡片。

---

#### 3.3 第三锹（视前两锹结果决定，2-3 周）

##### 3.3.1 深化 profile —— 加 onboarding + active project

第一锹的 profile 只有头像/名字/一句话。这一锹加：

- [ ] 三种角色 onboarding 流（成员 / 嘉宾 / 管理团队）

  **Prompt**:
  > 用 app-onboarding-questionnaire 设计三套 onboarding 流：(1) 普通社区成员（基础信息），(2) 活动讲师（擅长领域、过往作品），(3) 管理团队（权限确认、值班意愿）。每套 5-8 屏，benefit-framed。

- [ ] profile 页 v2：加 active project 卡片（最多 3 条 + 链接）+ 活动历史时间线 + 月度活跃度

  **Prompt**:
  > 用 daybreak-os Daybook 层升级 /community/:id：在 v1 基础上加 active project 卡片（玖玖型用户用来展示自己在做什么）+ Ta 参加过的活动时间线 + 本月活跃度。用 lark MCP 实时拉数据。

- [ ] 用 ux-psychology 审 profile v2

  **Prompt**:
  > 用 ux-psychology 审 profile v2：endowed progress（让用户想继续完善）、IKEA effect（自己填的内容更珍惜）、curiosity gap（鼓励别人点开 profile）。

##### 3.3.2 感谢系统（你产品最不一样的部分）

- [ ] 机制设计

  **Prompt**:
  > 我要为 cyc.center 设计一个感谢系统（参考 Bonusly / Achievers 的 peer-to-peer kudos 模式但更轻、更社区化）。先用 ux-psychology 给出心理学依据：哪些原则保证它**不会变成 KPI 内卷**而是真正的人际温度（reciprocity, gift economy, public recognition vs private gratitude, intrinsic motivation 不被挤出）。然后用 develop-design-rationale 写一份这个系统的设计原理文档。

- [ ] 用 utility-pm-skill-builder 把"感谢系统设计"固化成你自己的 skill

  **Prompt**:
  > 用 utility-pm-skill-builder 把上面的设计原理变成一个名为 `community-recognition-design` 的 skill，未来任何 community 产品都能复用。

- [ ] 数据建模

  **Prompt**:
  > 设计感谢系统对应的飞书 Bitable schema：感谢记录表、感谢类型枚举、月度排行榜聚合视图。给我 lark MCP 可以直接执行的 schema 创建命令。

##### 3.3.3 独立社区照片墙页 /community/memories

介绍页里的照片墙 section 二级跳转到这个独立页面。

- [ ] 用 daybreak-os Artifact 模式 + Stack ↔ Lineup view-mode toggle

  **Prompt**:
  > 设计独立 /community/memories 社区照片墙：Stack 模式做月度概览（"上个月发生了好多事"），Lineup 模式按日期分组浏览。点开一张照片进入对应活动回顾页。完整 vanilla HTML/CSS。

#### 3.4 收工仪式（每个 feature 上线后做）

- [ ] 写 release notes

  **Prompt**:
  > 用 deliver-release-notes 为刚完成的 [feature] 写一份用户面向的 release note。中文，benefit-focused，不超过 150 字。

- [ ] iterate-retrospective 周回顾

  **Prompt**:
  > 用 iterate-retrospective 给我做这周 cyc.center 开发的回顾。What went well / What to improve / Action items.

**Phase 3 产出**：3-5 个新 feature 上线 + 多份 design rationale + 1 个自定义 skill + 周回顾文档

---

### Phase 4 — 投资人 / Demo 准备（5-7 天）

**目标**：把前三阶段的所有产出，编织成一份让投资人秒懂的 narrative。

#### 4.1 用 pitch-deck plugin 做 deck

- [ ] 触发 pitch-deck founder interview

  **Prompt**:
  > 启动 pitch-deck 的 founder interview。
  >
  > **核心叙事（v2 关键）**：cyc.center 不是工具站，是 **"[Selina × Notion]" 跨界产品** —— 把一个实体 coliving 社区数字化成可推广的社区 OS，工具是 traction 证据，OS 是 scale 路径。当前在大理 PMF 阶段，目标 [pre-seed / seed / 战略合作]。
  >
  > 请按 Shaan Puri 15-slide 框架开始问我，每次一题，挖深。重点 stress-test：
  > - **Why now / why us**：为什么 coliving 类产品需要 OS 层？为什么是我做？
  > - **可推广性**：这套从大理验证的模式，怎么复制到其他空间？
  > - **双轨收入**：to-C（成员订阅）+ to-B（OS 授权给其他空间运营者）的 unit economics
  >
  > 准备好后通过 4-critic-role（怀疑型 VC / 领域专家 / 故事讲述者 / 首次读者）压力测试。

- [ ] 把已有产出喂给它

  在 founder interview 过程中主动塞给它：
  - PRODUCT.md（战略上下文）
  - foundation-lean-canvas 输出
  - discover-competitive-analysis 输出
  - define-opportunity-tree 输出
  - architecture-diagram SVG
  - 3 张 walkthrough HTML

#### 4.2 视觉资产

- [ ] 用 anthropic-skills:pptx 把 pitch-deck 输出转成 .pptx

  **Prompt**:
  > 用 anthropic-skills:pptx 把 pitch-deck 输出的 15 张 slide 编排成一份 .pptx。视觉风格遵守 DESIGN.md（大理玻璃，绿/橙/沙），16:9，AAA 对比度。

- [ ] 做一个产品 logo（如果还没有）

  **Prompt**:
  > 用 logo-designer 为 cyc.center 设计 logo。要求：体现"链岛"（islands connected）+ "工具站"（utility）+ playful。3-5 个 SVG 方案并排。

#### 4.3 法务备战

- [ ] term sheet 准备

  **Prompt**:
  > 假设投资人给我一份 SAFE，我作为 founder 需要重点关注哪些条款？用 safe-review skill 给我一份 founder-side checklist。

- [ ] 辖区咨询

  **Prompt**:
  > 用 jurisdiction-advisor。我在中美之间，cyc.center 用户主要在大理（中国），未来可能拓展东南亚。建议注册哪里？BVI / 新加坡 / 开曼 / 国内 / Delaware 各自利弊。

- [ ] 尽调准备

  **Prompt**:
  > 用 startup-due-diligence 给我一份 founder-side 尽调准备 checklist：投资人会要哪些文档？我现在哪些已有、哪些缺、缺的怎么补？

#### 4.4 Demo 排练

- [ ] 用 foundation-meeting-brief 准备私人战略 brief

  **Prompt**:
  > 用 foundation-meeting-brief 帮我准备 [投资人姓名] 这次会议的私人战略 brief：他可能问什么、我想达成什么、关键讯息怎么排序、风险怎么应对。

**Phase 4 产出**：完整 pitch deck（15 张）+ logo + 法务 checklist + 会议私人 brief

---

## 横切：日常仪式

每天 / 每周固定做的事：

- **工作中突然想到的洞察** → 立即说 `save this` → 自动归档到 Obsidian wiki
- **遇到生疏术语 / 需要查的东西** → `wiki-query [topic]` → 调出之前的笔记
- **遗忘某个流程** → 跑对应的 walkthrough HTML
- **每周日晚** → `用 iterate-retrospective 做本周回顾`
- **每月底** → `用 wiki-fold 把本月日志卷成一篇月度总结`

---

## 不要做的事（节省时间）

- ❌ 不要装新 skill（85 个够了，再装是工具收藏症）
- ❌ 不要让 Claude "全自动跑完整个 chain" —— 每一步要看输出再决定下一步，不然产生大量垃圾
- ❌ 不要在每个对话开头都从零解释 cyc.center —— PRODUCT.md / DESIGN.md / CLAUDE.md 已经做了这件事
- ❌ 不要跨 layer 用 skill —— 比如别让 daybreak-os 在 /admin 用 Daybook，那应该用 Aurora

---

## 时间预算建议

| 阶段 | 投入 | 一定要做的最少 3 件事 |
|---|---|---|
| Phase 1 | 3-5 天 | codebase-audit + 1 个 walkthrough + problem statement |
| Phase 2 | 5-7 天 | persona + JTBD + lean canvas |
| Phase 3 | 10-14 天 | 1 个完整 feature（建议 /events SSR）+ 1 个 onboarding 流 + 感谢系统机制设计 |
| Phase 4 | 5-7 天 | pitch deck + logo + 1 份法务 checklist |
| **总** | **23-33 天** | |

如果你只有 2 周：跳过 Phase 3 的细节（先出 1 个 MVP 而不是 3 个），把节省的时间放到 Phase 4。

---

## 现在就开始

最容易的第一步：**完全重启 Obsidian + cyc-tools 那个 dev Claude 会话**，确保所有新 skill / MCP / plugin 都加载了。然后直接说：

> 启动 Phase 1。先用 codebase-audit-suite 全面审计 cyc-tools，按严重度排序输出修复清单。

走起。
