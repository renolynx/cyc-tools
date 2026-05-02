# Phase 2.5 — 假设和实验

> ⚠️ **2026-05-02 v2 更新**：这份文档里的 **H-Canvas-2** 已经过时 —— 它原本描述"换首页 → 把工具搬走 → 担心玖玖型流失"的复杂方案。
> 之后 [[homepage-design]] 落地了**真实首页设计**（双海报 hero + 活动卡片流 + 显眼的"创建活动"CTA），玖玖工具入口**根本没搬家**，所谓"流失风险"被设计绕开了。
>
> 请把 H-Canvas-2 那一节当成"历史思考路径"看，本节末尾追加了 **H-Canvas-2 v2 简化版**。
>
> 把前面所有产出（personas / paths / competitive / opportunity tree / lean canvas）浮现的两个最大假设，写成可验证版本 + 设计验证方法。
>
> **重要约束**：cyc.center 当前流量小，不能跑标准 A/B test 等统计学显著性。所有实验设计都是 **土法子 + 定量 + 定性 + 体感** 混合。诚实承认这一点比假装严谨更有用。

---

## 前提：必须先做的 instrumentation（基线测量）

在动 Path A 首屏 / profile 系统之前 —— **本周内**给 cyc.center 上埋点，否则没基线无法判断改动效果。

### 必装

- [ ] **Vercel Web Analytics**（一行 import）—— 免费，开箱即用 path-level pageview / bounce / referrer
- [ ] **简单事件埋点** ——`/api/track`（已有 KV，写一个最简 endpoint 把 event 写进 KV / Bitable 一张表，每天聚合）
  - 关键事件：`visitor_strip_click` / `event_rsvp_click` / `profile_view`（待 profile 上线）/ `share_prompt_seen`
- [ ] **UTM 标记自己的小红书 / 公众号引流**（手动加 `?utm_source=xhs&utm_campaign=intro1`）

### 可选（但强烈建议）

- [ ] **Plausible / 自托管 PostHog**（如果你想要 funnel 分析比 Vercel Analytics 更深）
- [ ] **手动月度成员问卷**（5-8 个核心问题，Google form / 飞书问卷）—— 定性数据是小流量产品的救命稻草

**没装 instrumentation 就跑实验 = 拍脑袋。一定要装在前面。**

---

## H1 —— Profile 系统假设

### 完整陈述

> **如果**我们上线 profile 系统 v1（每个成员有 avatar + 名字 + 一句话简介 + 1-3 个 active project + 参加过的活动历史），
>
> **那么** 30 天内，会同时观察到：
>
> - **玖玖型受益**：现有成员的月度活跃度 / 月度 retention 提升 → 他们用 profile 找到协作 / 表达自己
> - **Alex 型受益**：评估期访客（首访后 1-30 天内的非成员）查看 profile → 帮助他们决策是否加入
> - **Mia 型受益**：活动详情页的"已报名头像"和"发起人 profile"链接被点击 → 提升 RSVP 转化和 activity 详情停留
>
> **因为** profile 系统是 3 个 persona 痛点的横切武器（personas + opportunity tree + lean canvas 三处独立验证）。

### 失败假设（要明确什么算"失败"，不是只有"成功"）

下列任一发生 = H1 弱化或失败：

- ❌ 30 天后 < 50% 活跃成员填了 profile（说明 onboarding / 激励错了）
- ❌ profile 平均完成度 < 60%（avatar/name/简介/project 4 项至少 3 项填了）
- ❌ 跨页点击率（profile → activity / activity → profile）< 5%
- ❌ 定性反馈："填了感觉没什么用"
- ❌ 玖玖型口头说："比起以前，没看到 profile 帮我多做成什么事"

### 成功标准（trinary：strong / weak / fail）

| | strong | weak | fail |
|---|---|---|---|
| profile 完成率（30 天后） | > 70% | 50-70% | < 50% |
| 月活跃成员中查看他人 profile / 周 | > 60% | 30-60% | < 30% |
| 跨页点击率（profile ↔ activity） | > 15% | 5-15% | < 5% |
| 定性："profile 帮我做成了 X" | 至少 5 个具体故事 | 1-2 个 | 0 个 |
| 评估期访客 → 申请加入转化 | 不指望第一版可测 | — | — |

**Decision tree：**

- **Strong** → 加投入做 profile v2（active project 卡片 / 找搭子标签 / 月度推送）
- **Weak** → 改善 onboarding，做 30 天迭代再评估一次
- **Fail** → 不要再加功能，回到 hypothesis 重新讨论"profile 是不是真的横切武器"

### 实验设计

**类型**：Pre/Post quasi-experiment + 定性访谈 + 体感

**Phase 0：基线（launch 前 2 周）**
- 在 5-8 个活跃成员里做"现状访谈"：
  - "上一次你想找一个特定能力的人合作，你怎么找的？花了多久？"
  - "你想了解一个新加入的人，你现在怎么做？"
  - "你希望别人在 cyc 上看到你什么？"
- 记录当前活动 RSVP 转化基线、月度活跃成员数

**Phase 1：v1 launch + 30 天**
- profile 系统 v1 上线（最简：avatar 上传 + name + 1 句简介 + 1 个 link）
- 主动邀请 8-12 个核心成员先填（让 profile 不空）
- 公开通告："我们做了成员主页，欢迎填" + 在活动通告生成器里加引导
- 每周记录：
  - 新增 profile 数 + 完成度
  - profile 页 pageview（total + unique）
  - profile → activity 跳转 / activity → profile 跳转
  - **手动**记录：你听到任何关于 profile 的反馈（正/负）

**Phase 2：30 天复盘**
- 跟 Phase 0 同样 5-8 个人做"事后访谈"：
  - "这 30 天里，profile 帮你做成了什么具体的事？没做成什么？"
  - "你最常看谁的 profile？为什么？"
- 量化数据 + 定性故事 → 套上面的 trinary 评分 → 决策

**预算 / 时间**

| 阶段 | 时间 | 你的工作量 |
|---|---|---|
| 基线访谈 | 1 周 | 5-8 个 1 小时对话 |
| v1 开发 | 1-2 周 | 配合 Phase 3.4 |
| 数据收集 | 30 天 | 被动 + 每周 30 分钟检查 |
| 复盘访谈 | 1 周 | 5-8 个 30 分钟对话 |
| **总** | **~6-8 周** | **~15-20 小时主动工作** |

---

## H-Canvas-2 —— Path A 首屏假设

### 完整陈述

> **如果**我们上线 Path A 首屏 v1（一句话定位 + 大理实景照 hero + 3-6 个成员故事卡 + 加入入口三选一）替换当前直接显示活动通告生成器的 / 路径，
>
> **那么** 30 天内：
>
> - 首次访问 / 的访客 7 天内 RSVP 一场活动的转化率显著高于当前基线
> - 跳出率（< 5 秒离开）下降至少 30%
> - 通过 Path A → /events 的漏斗转化率成为可观测的指标
>
> **因为** 当前 / 直接呈现工具，对非成员（Alex/Mia）信号是"这不是给我看的，关掉"。Path A 的 identity-fit signal 应该让目标用户在 10 秒内识别。

### 复杂性：这个 hypothesis 有副作用

**关键风险**：当前 / 是活动通告生成器（玖玖型核心工具）。如果把它移到 /tools/announcement 而 / 变成 landing，**玖玖型会迷路**。

→ 必须设计成：**新 Path A 首屏作为可选层，玖玖一键穿透到工具**。
→ 或：保留首屏的简洁，工具 inline 显示在 below-the-fold 位置。
→ 或（最简单）：**新 / = landing**，工具变成 `/generator` 或 `/tools`，给玖玖一周通知期 + 顶部固定的"工具入口"。

**第三方案最干净**。但要先 A/B 验证不会让玖玖型流失。

### 失败假设

- ❌ 玖玖型反馈："找不到工具了，烦死了"
- ❌ 现有成员的活动通告生成器使用频率 30 天内下降 > 20%
- ❌ 首页 7 天内 RSVP 转化率 < 1%（说明 hero 没说服人）
- ❌ 首页平均停留时长 < 15 秒（说明 hero 还是没抓住）

### 成功标准

| | strong | weak | fail |
|---|---|---|---|
| 首页 7 天内 → RSVP 转化（首访者）| > 8% | 3-8% | < 3% |
| 首页跳出率 vs 老首页 | 下降 > 40% | 下降 10-40% | 持平或上升 |
| 首页平均停留时长 | > 60 秒 | 30-60 秒 | < 30 秒 |
| 玖玖型工具使用频率 | 持平或+ | -20% 以内 | -20% 以上 |
| 定性：访客留言 / 反馈"看到主页就懂了" | 至少 3 条 | 1-2 条 | 0 条 |

### 实验设计

**类型**：Time-based pre/post + UTM-tagged 引流验证 + 玖玖型 user safety net

**Phase 0：基线 + 通知（v1 launch 前 2 周）**

- 上 instrumentation（必须）
- 跑 2 周老首页基线，记录：
  - 首页 7 天内 RSVP 转化率（基线，估计 < 1%，因为页面是工具）
  - 首页跳出率
  - 玖玖型工具使用频率
- 给现有成员**预先通知**："下周首页会变成介绍页，工具搬到 /generator，老链接保留 30 天 redirect"

**Phase 1：v1 launch + 30 天观察**

- 新 / 上线（hero 区 + 故事卡 + CTA 三选一）
- 旧首页内容搬到 /generator，做 redirect
- 顶部 nav 永远展示"创建活动 →"快捷入口（给玖玖）
- 配合**小红书 / 公众号一篇引流文**带 UTM `?utm_source=xhs&utm_campaign=path_a_v1`，**测引流来源访客**的转化（这是真正"陌生人"的体感）

**Phase 2：30 天复盘**

- 量化对比 Phase 0 数据
- 跟 5-8 个**新访客**问（如果能联系上）："首屏看到什么？想做什么？"
- 跟 5 个**玖玖型现有成员**问：："新首页让你麻烦了吗？工具入口够吗？"

**Decision tree**

- **Strong + 玖玖未流失** → Phase 3 推进 Path B（房型页）+ Path C 优化（活动结束页）
- **Weak + 玖玖未流失** → 改 hero 文案 + 故事卡，再测一次
- **首页弱 + 玖玖流失** → 立即回滚到老首页，重新设计成"双入口"（首屏一半 hero、一半工具）
- **Fail** → 重新审视 PRODUCT.md 战略选择题（也许 cyc 是更彻底的 tool 不是 community 着陆？）

**预算 / 时间**

| 阶段 | 时间 | 你的工作量 |
|---|---|---|
| 基线 + instrumentation | 2 周 | 装埋点 + 2 周被动 |
| Path A 首屏开发 | 1-2 周 | Phase 3.1 大块工作 |
| 数据收集 | 30 天 | 被动 + 引流 1 篇 |
| 复盘访谈 + 决策 | 1 周 | 10 个 20-30 分钟对话 |
| **总** | **~7-9 周** | **~25-35 小时** |

---

## ⭐ H-Canvas-2 v2 —— 简化版（2026-05-02 替换上面那一大段）

### 完整陈述（人话）

> **如果**我们按 [[homepage-design]] 实现新首页（顶部双海报 + 显眼"创建活动"CTA + 活动卡片流含头像组），
>
> **那么** 30 天内：
> - 双海报点击率（介绍社区海报 / 订房海报）有可观测的数据
> - 活动卡片头像点击率（跳到 profile）能验证 profile 是否被需要
> - 玖玖型用户（创建活动 CTA 点击率）**不应下降**
>
> **因为**新设计**根本没搬家** —— 玖玖工具入口还在首屏显眼位置，老用户不需要重新学。

### 不需要担心什么了

旧版本 H-Canvas-2 的核心担心是"换首页 → 玖玖流失"。homepage-design 的双轨设计已经绕开这个风险：

- ✅ 工具 CTA 在首屏中下部紧接 hero，老用户秒看到
- ✅ 卡片流就是首页内容，没有信息消失
- ✅ 不需要做"30 天 redirect 期"复杂安全网（虽然旧 / 路径 redirect 一下保险）

### 简单成功标准

| 指标 | strong | 可接受 | fail |
|---|---|---|---|
| 创建活动 CTA 点击率（玖玖型）| 持平或+ | -10% 以内 | -10% 以上 → 立即调整 CTA 位置 |
| 双海报至少一张点击率（首访者） | > 25% | 10-25% | < 10% → hero 视觉/文案问题 |
| 活动卡片头像点击率 | > 15% | 5-15% | < 5% → profile 不被需要？|
| 首页平均停留时长 | > 45 秒 | 20-45 秒 | < 20 秒 → 重新审视 |

### 实验设计（更简单）

**Phase 0**：装数据采集 + 跑 1 周老首页基线
**Phase 1**：上新首页（按 homepage-design） —— 直接发布，不需要 A/B（流量小+变化大，A/B 没意义）
**Phase 2**：30 天观察 + 体感监听（每周看一次数据）
**Phase 3**：跟 5 个老用户 + 5 个新访客做简短反馈对话

**总周期**：5-6 周（比旧版 7-9 周省一周，因为不需要复杂安全网）

---

## 两个 hypothesis 一起跑的依赖关系

```
Week 0  装 instrumentation（前置必做）
        │
        ├─ Week 1-2  基线收集 +
        │           Phase 0 访谈（H1 + H-Canvas-2 一起做）
        │
Week 3  ├─ profile v1 开发（H1 启动）
        │  + Path A 首屏开发并行（H-Canvas-2 启动）
        │
Week 4-5 ├─ 两个 v1 同时 launch（推荐 H1 早 1 周，因为它影响 Path A 的 social proof）
        │
Week 5-9 ├─ 30 天数据收集 + 体感监听
        │
Week 10  └─ 双 hypothesis 复盘 + 决策 → 影响 Phase 3 Week 3 计划
```

**为什么并行而不串行**：

- profile v1 是 Path A 故事卡的依赖（成员故事卡需要每张卡 link 到 profile）
- 如果串行（先 H1 → 再 H-Canvas-2），整个 Phase 3 拉到 4 个月
- 并行虽然 instrumentation 复杂一点，但**总周期 6-8 周可控**
- 注意：测两个变量同时改时，归因会模糊。但小流量产品下，**精确归因不如方向感**

---

## 给 Phase 3 的最终配方

基于这两个 hypothesis 的实验设计，Phase 3 周计划再修订一次：

### 调整：Phase 3 第 0 周（先做 instrumentation）

```
Week 0
├─ 装 Vercel Analytics + 简单事件埋点 endpoint
├─ 准备 5-8 个核心成员 Phase 0 访谈
├─ 跟玖玖型成员预通知"首页要变"
└─ 装好 → 才能跑 Week 1
```

### Week 1-2（基线 + 设计准备）

```
├─ 基线访谈（H1 + H-Canvas-2 共用）
├─ 老首页基线数据收集（2 周）
├─ profile v1 与 Path A 首屏的 design 同步推进（用 daybreak-os）
└─ 同时跑那"一小时 76 分"改造（已经做完了 ✅）
```

### Week 3-4（双 v1 开发）

```
├─ profile v1 开发 + 飞书 Bitable schema
├─ Path A 首屏开发 + redirect 老首页到 /generator
└─ Phase 3 第 1 周（PLAN-USING-SKILLS.md 已写）
```

### Week 5-8（30 天观察 + 引流 + 体感监听）

```
├─ profile v1 + Path A 同时 launch（推荐 profile 早 1 周）
├─ 小红书 / 公众号 1 篇引流文（带 UTM）
├─ 每周 30 分钟看数据
└─ 持续记录定性反馈（任何成员说的话都记下来）
```

### Week 9-10（复盘 + 决策）

```
├─ 两个 hypothesis 复盘访谈
├─ 写 measure-experiment-results 文档
├─ 决策：Phase 3 后续做什么 / 不做什么
└─ 输出：experiment-results-h1.md + experiment-results-hcanvas2.md
```

---

## 一个 sanity check

写完这两个 hypothesis 后我自己问自己：

**Q：这两个 hypothesis 真的是最该测的吗？或者我们还在跑 PLAN 而不是怀疑 PLAN？**

诚实回答：
- ✅ profile v1 (H1) 在 personas / opportunity tree / lean canvas 三处独立浮现 = **极高 confidence 的高 ROI**，应测
- ⚠️ Path A 首屏 (H-Canvas-2) 是 Path A/B/C 漏斗的**入口**，但**也可能 Path A 0-1 不需要 v1 那么完整**，更小的 MVP（先做 hero 区 + 一句话 tagline 试 1 周）就能验证 hero 直接性是否有效。

**修订**：
- H1 按上面跑（profile v1 全套）
- H-Canvas-2 **拆成 H-Canvas-2a 和 -2b**：
  - **H-Canvas-2a（先跑）**：只换 hero 区一句话 + 实景照（1 天能做完）—— 1 周后看跳出率有无下降
  - **H-Canvas-2b（视 -2a 结果再跑）**：完整 Path A 首屏 v1（如果 -2a strong → 投资做完整版）

→ 这样**总投入风险更低，决策点更密集**。

---

## 接下来

完成 Phase 2.5 = Phase 2 全部跑完。下一步：

**M-1**：实施 Week 0 的 instrumentation（先装埋点）—— 这是任何 hypothesis 验证的前提
**M-2**：进 Phase 3（按修订后的周计划）
**M-3**：进 Phase 4 准备（如果你 4 月有投资人会议，先做 deck，hypothesis 边跑边卷数据）

或者如果你这一两周想缓一缓，**N-1**：把所有 Phase 2 文档（5 份）打印出来或导成 PDF 自己读一遍 —— 高密度信息进入大脑需要时间。
