# cyc.center 首页真实设计（玖玖说了算的版本）

> 这是首页的最终设计依据。之前 plan 里所有"把工具搬走、首页变 landing"的方案作废 —— 以本文档为准。
>
> 来源：玖玖（产品负责人）2026-05-02 的明确设计意图。

---

## 设计原则

**一屏同时服务三种人：**

- 第一次来的陌生人 → 顶部两张海报图，点开了解 / 订房
- 想找活动的人 → 中下部活动卡片流，可以浏览、报名
- 想发活动通告的玖玖型用户（产品骨干场景）→ 显眼的"创建活动"按钮，秒进工具

**没有人需要"搬家"或"找新入口"。**

---

## 首页结构图

```mermaid
flowchart TD
    Top[顶部 hero · 占屏幕 25-35%<br/>━━━━━━━<br/>左右两张海报图入口]:::top

    Top --> A[海报 1: 介绍社区<br/>━━━━━━━<br/>点击 → /about 或 /community-intro<br/>介绍页内含 照片墙 section<br/>照片墙可二级跳转 → /community/memories]:::pathA

    Top --> B[海报 2: 房屋模型<br/>━━━━━━━<br/>点击 → /rooms<br/>房型详情 / 价格 / 试住 / 联系]:::pathB

    A -."看完介绍可能想订房".-> B
    A -.->|"看完介绍可能想来玩"| Cards
    B -.->|"还在评估的人想先来玩玩"| Cards

    Mid[中下部 · 占屏幕 65-75%]:::mid
    Mid --> CTA[创建活动 button · 醒目位置<br/>━━━━━━━<br/>点击 → /generator 活动通告生成器<br/>玖玖型核心工具入口]:::cta

    Mid --> Cards[活动卡片流 · 动态渲染<br/>━━━━━━━<br/>每张卡片含: 标题/海报/时间/地点/类型<br/>+ 嘉宾头像组 + 报名头像组]:::cards

    Cards --> Avatar[点击任一头像<br/>━━━━━━━<br/>展开人物卡片<br/>= profile 子集]:::avatar
    Avatar -.->|"想看完整资料"| Profile[/community/:id<br/>完整 profile 页]:::profile

    Cards -.->|"点击卡片本身"| EventDetail[/events/:id<br/>活动详情页]:::detail

    classDef top fill:#1c3d2e,stroke:#1c3d2e,color:#fff
    classDef pathA fill:#fce8e6,stroke:#a93226,color:#1a1a1a
    classDef pathB fill:#e3f2e6,stroke:#1c3d2e,color:#1a1a1a
    classDef mid fill:#f2ede6,stroke:#6b6b6b,color:#1a1a1a
    classDef cta fill:#d9652a,stroke:#d9652a,color:#fff
    classDef cards fill:#f5e9d6,stroke:#c8a96e,color:#1a1a1a
    classDef avatar fill:#fff,stroke:#1c3d2e,color:#1a1a1a
    classDef profile fill:#1c3d2e,stroke:#1c3d2e,color:#fff
    classDef detail fill:#2a5740,stroke:#2a5740,color:#fff
```

---

## 顶部 hero 区（25-35%）—— 双海报入口

### 布局

桌面：左右并排，比例可以 50/50 或 60/40
移动：上下堆叠，每张占视口 ~25-30%

### 海报 1 — 介绍社区入口

| | |
|---|---|
| 视觉 | 大理实景照（比如老房子内庭、活动现场、苍山下的咖啡桌）+ 文字叠加 |
| 文字 | "在大理，有这样一群人在认真做事" 之类（待文案） |
| 链接 | `/about` 或 `/community-intro` |
| 跳转后体验 | 介绍页：品牌叙事 + 社区文化 + **嵌入照片墙 section** + "想长租？看房型" 跳到海报 2，"想来玩？看活动" 滑到首页活动流 |

照片墙 section 二级跳转：
- 介绍页的"照片墙"section 可以点击 → `/community/memories`（独立的社区回忆页）
- 这条路径让 Mia 拍照打卡、回看自己上过的活动

### 海报 2 — 房屋模型入口

| | |
|---|---|
| 视觉 | 房屋外观 / 内部 / 公区的精选大图，给"想象自己住进来"的感觉 |
| 文字 | "想试一个月吗" / "看看每一间房" 之类（待文案） |
| 链接 | `/rooms` |
| 跳转后体验 | 房型详情页：每间房一张卡片 + 价格 + 当前可入住时间 + 试住政策 + 联系方式 |

---

## 中下部 —— 活动通告板（65-75%）

### "创建活动" CTA

- 位置：紧接 hero 区下面，第一眼能看到
- 视觉：醒目按钮（橙色渐变 pill 或更大尺寸）
- 文字："✏️ 创建活动通告" 或 "+ 发一场活动"
- 链接：`/generator`（活动通告生成器，从首页搬过去后的新地址）
- 这是玖玖型核心工具入口 —— **必须显眼但不抢 hero 风头**

### 活动卡片流

动态从飞书 Bitable 拉取，按时间倒序（即将的在前，已结束的折叠或翻页）。

**每张卡片包含**：
- 活动海报（如有，主视觉）
- 标题
- 日期 + 时间 + 地点（pill 形式）
- 状态 pill（确认举办 / 筹备中 / 对外开放 等，已加）
- **嘉宾头像组**（最多 3-5 个 avatar，圆形，size 28-32px）
- **报名头像组**（最多 6-8 个 avatar，size 24-28px，叠加显示像 stack）
- 类型 chip（聚餐 / 工作坊 / 等）

**交互**：
- 点击卡片本身 → `/events/:id`（活动详情页）
- 点击任一头像（嘉宾或报名）→ **展开人物卡片**（不离开当前页）
  - 人物卡片：avatar + 名字 + 一句话简介 + 1-2 个 active project + "查看完整 profile →"链接到 `/community/:id`

---

## 这个设计为什么聪明

### 1. 玖玖、Alex、Mia 三种人都能用同一个首页

- 玖玖：直接跳到 "创建活动" → 进工具
- Alex：看 hero 海报 → 介绍页 → 评估 → 订房页
- Mia：看 hero 海报 → 介绍页（或直接看活动卡片）→ RSVP

### 2. 没有任何用户需要"重新学路径"

老用户（玖玖）打开首页，工具 CTA 就在那。新用户看到 hero 立刻知道这是给谁的。

### 3. 人物 profile 不是独立 feature，是嵌入活动卡片的核心组件

每张活动卡片上的小头像 = profile 系统的 entry point。这意味着：
- profile 系统**不能 v1 上线后再慢慢推**——必须和活动卡片一起设计
- 但首版 profile 极简就够了：**头像 + 名字 + 1 句简介**就能让卡片上的小头像有内容
- 后续再迭代加 active project / 活动历史 / 标签

### 4. 一举把"profile 系统"和"Path A 入口"绑在一起

之前的 plan 把这两件事分开做。新设计要一起做才完整。这反而让 Phase 3 第一波工作更聚焦。

---

## 改动了之前的什么 plan？

### PLAN-USING-SKILLS.md Phase 3 第一波（重写）

旧：
1. profile 系统 v1（独立 feature）
2. Path A 首屏（替换工具）
3. 三件一行字改造（已做完 ✅）

新：
1. **首页大改造**：hero 双海报 + 活动卡片流（含头像组）+ "创建活动" CTA + 工具搬到 `/generator` 做 redirect
2. **简化版 profile**：头像 + 名字 + 一句话（让卡片头像有内容显示）—— 跟首页改造同时上
3. 介绍页 `/about`：基础版品牌叙事 + 嵌入照片墙 section（可后做）
4. 房型页 `/rooms`：简化版即可（可后做）
5. **三件一行字改造**：已做完 ✅

### opportunity-tree.md（轻调整）

profile 系统的紧迫性 **从"横切武器"升级为"和首页同时上线的依赖"**。不能拆开做。

### hypotheses-and-experiments.md H-Canvas-2（重写）

旧：测"换首页 → 玖玖会不会流失"
新：**玖玖不会流失**（工具 CTA 还在首屏显眼位置），测"hero 双海报点击率 + 活动卡片头像点击率"。

风险大幅降低 → 可以更激进地直接上线，不需要复杂 A/B。

---

## 视觉上的开放问题（需要确认）

- [ ] hero 区在桌面上左右并排还是上下堆叠？我倾向**左右**（更紧凑）
- [ ] 海报 1 文案：用我的"大理工具站，但其实在做别的事" 风格还是更直白的"了解我们"？
- [ ] 海报 2 是渲染图还是真实房间照片？
- [ ] 活动卡片流默认显示多少张？分页还是无限滚动？
- [ ] 头像 hover/点击展开的人物卡片以什么形式呈现？
  - 选项 A：原地展开（卡片变高）
  - 选项 B：右侧 sheet 滑入
  - 选项 C：modal popup
  - 我倾向 **C**（modal）—— 最简单、不破坏布局

---

## 下一步

Phase 3 第一波重写后，第一锹应该是：

1. **数据采集**先装好（之前叫 instrumentation —— 就是埋点检测用户怎么用）
2. **活动通告生成器**搬到 `/generator` 路径（带 redirect）
3. **首页 v1**：极简双海报 + 活动卡片流（头像可先用 placeholder 圆形）
4. **简化 profile**：让头像有内容
5. 一起上线，看一周数据 + 体感

时间预算 —— 全心做大概 2 周可上 v1。比之前估的 4 周快，因为你的设计更聪明（玖玖工具不搬家，省一堆 redirect / 通知 / 安全网工作）。
