---
name: dayrise-os
description: "Three-layer design system for cyc.center (community OS for 大理 in-place creators). Use when designing or building any cyc.center UI — editorial showcase (Atlas), admin chrome (Aurora), or intimate companion (Daybook). v4 dayrise philosophy: v3 quiet base + editorial signature — 三层共享沙底 + 三 blob + Source Serif 4 Light display (Atlas brand register hero only) + IBM Plex Mono stamp (meta/time/pill 跨层) + brand vs product register 视觉区分。Triggers on 'use dayrise-os', '/dayrise-os', 'cyc.center 风格', 'community OS 风格', or any UI request mentioning Atlas/Aurora/Daybook layers, brand register, or display serif hero. Successor to daybreak-os v3 (archived in daybreak-os-archived/)."
version: 4.0.0
user-invocable: true
argument-hint: "[atlas|aurora|daybook|auto] [page-name or route]"
license: MIT
allowed-tools: [Read, Write, Edit, Glob, Grep, WebFetch]
---

# Dayrise OS — Three-Layer Design System (v4)

cyc.center 专属设计系统。一个产品，三个房间，**共享同一个沙色底盘**，靠**排版密度 + 微差异化标识 + 按钮颜色 + register 字层级**区分用途。

> **v4 dayrise 哲学**（2026-05-07）：v3 daybreak quiet 是把"喊"压下去；v4 dayrise 是在低声里建立 type signature。non-breaking 升级 —— v3 全部规则保留，v4 在 v3 base 上 additive 新增 display serif / mono stamp / brand register flag。

> **历史**：v2 dramatic（Atlas 大理风景照 / Aurora 深绿暗夜玻璃 / Daybook 近白底）已于 2026-05-02 撤回（commit `c8b8fcf`），原因是触发 PRODUCT.md 三条红线。v3 quiet 已稳定。v4 dayrise 在 v3 基础上加 editorial signature。前身 daybreak-os v3 SKILL 在 `.claude/skills/daybreak-os-archived/` 仅作历史参考。

## Setup gate (non-optional)

Before generating ANY UI, declare:

```
LAYER: <atlas | aurora | daybook>
REGISTER: <brand | product>
REASON: <one line>
PATTERNS: <any of: artifact, activity-bar, scrubber, identity-card, mascot, view-mode, editorial-header, mono-stamp>
```

REGISTER 选择：
- `brand` = 对外宣发面（`/`、`/about`、`/events`、`/events/:id`、`/rooms`、`/community/memories`、活动详情对外）→ 允许 display serif + 大 spacing
- `product` = 工具/admin/personal（其余路由）→ 守 v3 quiet 规则，不上 display serif

If the request is ambiguous, ASK before designing. Wrong layer or wrong register = whole output is wrong.

## The Unified Base（v3 共享，v4 扩展）

所有三层都使用：

- **Canvas**：沙色 (`#f2ede6` / `--cyc-sand`)
- **Ambient blobs**：3 个 fixed radial blob（橙 + 绿 + tan），blur(90px)，opacity 0.18-0.22
- **Surface**：玻璃卡（`rgba(255,255,255,0.75)` + backdrop-blur(24px) + 内描边白亮 + 145° 浅渐变）
- **Body / Spacing / Radius**：完全共享（见 Shared bones 节）
- **🆕 v4：Mono stamp 字体**：跨层共享，meta info / 时间 stamp / 类型 pill 用

**不允许**：
- 深色 canvas（包括 dark mode override）
- 任何全屏渐变带（橙红 / 紫粉 / 蓝）
- 多个 ambient glow 叠加（"glow on glow on dark" 是 SaaS 视觉）
- 大面积纯白背景（沙色才是 cyc 的"白"）
- **🆕 v4**：display serif 下沉到 product register（仅 brand register 可用）
- **🆕 v4**：mono stamp 用作 body 字（仅 11-13px stamp / pill / inline meta / admin 数字）

## The three layers（v4 演化）

### Atlas — editorial showcase

**When**: landing pages, public event detail, marketing, story-driven surfaces, onboarding intro
**Mood**: editorial, breath, content-confident

**v3 differentiation（保留）**:
- Hero h1 略放大 + 英文 tagline 字号同主标，letter-spacing 放松
- 内容区段宽（max-width 较大，给文字更多呼吸）
- Photography（如果有）作为内联内容卡，**不**作为全屏背景
- 一个主 CTA 用 `--cyc-orange` pill（"对外行动"信号）

**🆕 v4 differentiation（仅在 brand register 触发）**:
- **Hero h1 用 `--cyc-font-display`**（Source Serif 4 Light，weight 300）→ brand register only
- Hero h1 字号上调到 **48-56px**（v3 product register 仍 36px）
- Section gap 在 brand register 加大到 **80-96px**（v3 product register 仍 32-64px）
- 🆕 **Section eyebrow pattern**（小灰字 ALL CAPS 在 h1 上方，13-14px Inter，`--cyc-text-muted`）
- 🆕 **Mono stamp**（IBM Plex Mono）用于 hero meta（"COMMUNITY · 本周" / "PUBLIC EVENT" / 时间 stamp）

**Anti-pattern**:
- 不用全屏摄影 hero override 沙底
- 不在 hero 区做戏剧渐变
- 不放 ambient glow 加重视觉
- **🆕 v4**：display serif 不能下沉到 product register（settings、generator 等）
- **🆕 v4**：editorial-header pattern 不堆叠（一个 surface 一个）

### Aurora — admin chrome

**When**: settings, admin dashboards, /community/admin, /admin, command palettes, dialogs, internal tools
**Mood**: quiet, dense, professional, "you're in admin"

**v3 differentiation（保留）**:
- 顶部 2px 绿装饰线（`--cyc-green` 实色，full-width fixed）
- Density tighter（gap 4-6 vs public 8-12，padding 紧凑）
- 主 CTA 用 `--cyc-green` 实色（vs 公开页 `--cyc-orange`）
- Tabular numerals（`font-feature-settings: 'tnum'`）

**🆕 v4 differentiation（新增）**:
- 数字字段（KPI tile / 表格列）改用 `--cyc-font-mono`（IBM Plex Mono），强化"数据感"
- Mono stamp 用于状态 label（"LIVE" / "SYNC" / "ERROR"）
- 🆕 **不**上 display serif（这是 brand register 专属，admin 是 product register）

**Anti-pattern**:
- 不用深色 canvas
- 不用 ambient glow
- 不用紫粉色装饰
- 不在 chrome 区放 marketing 文案

### Daybook — intimate companion

**When**: 个人主页 `/me`, journal entry, mood calendar, daily check-in, photo timeline, recording sessions, member profiles, `/community/:id`
**Mood**: tender, breath, character-forward

**v3 differentiation（保留）**:
- Halo cards（白色 surface + `0 0 N px` 外晕阴影）
- 更多 whitespace（行高 1.6+，section 间 32-48px）
- 单一 temporal accent（`--cyc-orange`，仅用于 time/active/key-verb 三类语义）
- Self-Mood mascot 在亲密 surface 顶部

**🆕 v4 differentiation（新增）**:
- 长文场景（journal、long-form 描述）允许用 `--cyc-text-muted-warm` (#5c554c) 替代 `--cyc-text-muted` (#4d4d4d)（暖偏移更适合中文阅读）
- Mono stamp 用于时间 stamp（"刚刚" / "May 12 · 19:00" / "Live"）和活动类型 pill

**Anti-pattern**:
- 不在 Daybook 加多色装饰
- 不破坏 halo 阴影哲学（不要换成 inset 边框）
- 不超 1 种 accent

## Brand register vs product register（🆕 v4 引入）

> v4 最大的新概念。register 决定**字层级密度**和**节奏**，layer 决定**色 / 装饰 / pattern**。两者垂直，不互相覆盖。

| 维度 | brand register | product register |
|---|---|---|
| **触发路由** | `/`、`/about`、`/events`、`/events/:id`、`/rooms`、`/community/memories`、活动详情对外 | 其他全部（`/me`、`/community`、`/admin`、`/community/admin`、`/team`、`/food`、`/generator`、settings 等） |
| **body class** | `.cyc-brand` | （无） |
| **字体** | display serif 可用 hero h1/h2 | display serif **禁用**（仅 system Inter + PingFang） |
| **Section gap** | 80-96px | 32-64px |
| **Hero h1 字号** | 48-56px (display serif) | 36-40px (Inter Bold) |
| **Max-width** | 1120px | 默认 |
| **气质** | editorial / 有作者气质 / 给陌生人留印象 | 工具感 / 人来用东西 / 不抢戏 |
| **典型 layer** | Atlas（主），Daybook（`/community/memories`） | Aurora，Daybook，Atlas utility |

**举例**：
- `/events/:id`（公开活动详情）= Atlas + brand → display serif h1 + 大 gap + orange CTA + 玻璃卡
- `/community/admin`（admin）= Aurora + product → 2px 绿线 + 紧 density + green CTA + mono numerals
- `/me/journal`（私人 journal）= Daybook + product → halo + mascot + warm muted body
- `/community/memories`（公开照片墙）= Daybook + brand → halo + 大 gap（不上 display serif，主调温柔）
- `/generator`（活动通告生成器）= Atlas + product → 沙底 + 玻璃 + orange CTA（utility 不是 brand）

## Shared bones（v3 + v4 扩展）

### Typography

| Token | Family | 用途 | v 版本 |
|---|---|---|---|
| 默认 sans | Inter Variable + PingFang SC | body, UI labels, buttons, nav, h1-h3 (product register) | = v3 |
| `--cyc-font-display` | Source Serif 4 Light + Source Han Serif Light | display h1/h2 **仅 brand register Atlas** | 🆕 v4 |
| `--cyc-font-mono` | IBM Plex Mono | meta stamp, 时间 stamp, 类型 pill, admin 数字 | 🆕 v4 |

**Scale**:

| 用途 | px | letter-spacing | line-height |
|---|---|---|---|
| caption / mono stamp sm | 11 | +0.04em (mono) | 1.4 |
| mono stamp | 13 | +0.04em (mono) / 0 (time) | 1.4 |
| body | 14 | 0 | 1.5 |
| body-lg | 16 | 0 | 1.5 |
| body long-form (Daybook) | 16-18 | 0 | 1.6-1.7 |
| sub | 20 | -0.005em | 1.4 |
| h3 | 28 | -0.01em | 1.25 |
| h2 (product) | 36 | -0.01em | 1.2 |
| h1 (product) | 36-40 | -0.02em | 1.15 |
| **🆕 h1 (brand)** | **48-56** | **-0.02em** | **1.08-1.15** |
| **🆕 display (brand only)** | **56-64** | **-0.02em** | **1.05** |

**Weights**: 400 / 600 / 700（= v3）+ **🆕 300（仅 display serif）**

🆕 v4 hard rule：weight 300 **只能**用在 display serif 字。Inter 和 PingFang 仍是 400 / 600 / 700。

**中文优化**：中文字号比英文 +1px，加粗优先 700。

### Spacing scale

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`（v3，product register 用）
**🆕 `80 / 96`（v4，仅 brand register section gap）**

### Radius

| Token | Value | Use |
|---|---|---|
| `--cyc-r-pill` | `9999px` | buttons, status pills, tags |
| `--cyc-r-card` | `16px` | main panels |
| `--cyc-r-card-lg` | `24px` | hero cards, daybook surfaces |
| `--cyc-r-inner` | `10px` | inputs, sub-cards |
| `--cyc-r-tight` | `6px` | tag, chip, micro-button |
| `--cyc-r-dot` | `50%` | circular |

**No square corners anywhere.** 最小 6px。

### Grid base

8px。

### Icon system

- Lucide line/outline，stroke 1.75px，sizes 16/20/24
- 颜色匹配 text-secondary in current layer

## Layer-Specific Tokens（v4 完整）

### Atlas tokens

```css
/* Atlas product register hero（v3 保留，仍用于 utility 公开页） */
.atlas-hero h1 {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cyc-text-strong);
  line-height: 1.15;
}

/* 🆕 v4 brand register hero —— display serif */
body.cyc-brand .atlas-hero h1,
body.cyc-brand h1.cyc-display {
  font-family: var(--cyc-font-display);
  font-weight: 300;
  font-size: clamp(40px, 5vw, 56px);
  letter-spacing: -0.02em;
  line-height: 1.08;
}

/* CTA = v3 不变 */
.atlas-cta-primary {
  background: var(--cyc-orange);
  color: #fff;
  border-radius: var(--cyc-r-pill);
  padding: 12px 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
```

**Atlas 规则**：
1. 字层级靠**字号差** + **留白**（v4 brand register 用 display serif；product register 仍用 Inter）
2. Photography 作为内联内容卡，不作为 hero 全屏背景
3. 一个主 CTA per surface
4. Tagline 永远在底部
5. v3 hard rule 保留（不要全屏渐变 hero override）

### Aurora tokens

```css
/* v3 保留：2px 绿装饰线 */
body.aurora-canvas::before {
  content: ''; position: fixed; top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--cyc-green);
  z-index: 40;
  pointer-events: none;
}

.aurora-list { gap: 4px; }
.aurora-item {
  padding: 10px 12px;
  letter-spacing: -0.005em;
}

.aurora-cta-primary {
  background: var(--cyc-green);
  color: #fff;
  font-weight: 600;
  border-radius: var(--cyc-r-pill);
}

/* 🆕 v4：admin 数字字段 mono */
body.aurora-canvas .aurora-num,
body.aurora-canvas .kpi-num,
body.aurora-canvas td.numeric {
  font-family: var(--cyc-font-mono);
  font-feature-settings: 'tnum';
  letter-spacing: 0;
}
```

**Aurora 规则**：
1. 顶部 2px 绿装饰线非选 —— Aurora 视觉签名
2. 主 CTA 必须用 `--cyc-green` 实色
3. Density 略加紧
4. 不允许：深色 canvas、ambient glow、deep glass surface (inset)、紫粉装饰、marketing 文案
5. 🆕 v4：数字字段用 mono + tabular numerals

### Daybook tokens

```css
/* v3 保留：halo card */
.daybook-surface {
  background: var(--cyc-surface-pure);
  border-radius: var(--cyc-r-card-lg);
  box-shadow:
    0 8px 24px -8px rgba(0, 0, 0, 0.08),
    0 0 48px rgba(0, 0, 0, 0.04);
  padding: 24px;
}

/* 文字色阶 */
.daybook-text-primary   { color: var(--cyc-text-strong); }
.daybook-text-secondary { color: var(--cyc-text-muted); }
.daybook-text-tertiary  { color: var(--cyc-text-subtle); }

/* 🆕 v4：long-form warm muted */
.daybook-long-form,
.daybook-journal-body,
.daybook-event-description {
  color: var(--cyc-text-muted-warm);  /* #5c554c */
  line-height: 1.7;
  font-size: 16px;
}

/* Temporal accent —— ONLY for time/active/key-verb */
.daybook-accent       { color: var(--cyc-warning); }
.daybook-accent-large { color: var(--cyc-orange); }
```

**Daybook 规则**：
1. Halo 阴影非选 —— Daybook 视觉签名
2. 唯一允许的 accent 是 `--cyc-warning` / `--cyc-orange`，仅用于 temporal/active/verb
3. 沙底不替换为白
4. 笑脸 mascot 5 态用单色（深绿或近黑）
5. 字号底线 16px，行高 ≥ 1.6
6. 🆕 v4：长文段落可选 warm muted

## v4 patterns（v3 5 个 + 🆕 v4 3 个）

### Pattern 1 — Artifact (= v3，不变)

```css
.artifact-polaroid {
  background: #fefcfa;
  padding: 8px 8px 32px;
  transform: rotate(var(--tilt, 0deg));
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 12px 24px -8px rgba(28, 61, 46, 0.15);
}
```

倾斜 ±8°，堆叠 ≤8 张。

### Pattern 2 — Persistent Activity Bar (= v3，不变)

```css
.activity-bar {
  position: fixed; left: 16px; right: 16px; bottom: 16px;
  background: var(--cyc-surface-glass-strong);
  backdrop-filter: blur(40px) saturate(1.6);
  border-radius: var(--cyc-r-card);
  box-shadow:
    0 -4px 16px -4px rgba(0, 0, 0, 0.06),
    0 0 32px rgba(0, 0, 0, 0.04);
}
.activity-bar__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--cyc-orange);
  animation: cyc-pulse 1.6s ease-in-out infinite;
}
@keyframes cyc-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
@media (prefers-reduced-motion: reduce) {
  .activity-bar__dot { animation: none; }
}
```

### Pattern 3 — Timeline Scrubber (= v3，不变)

右侧竖向日期标尺，宽 32-40px。

```css
.scrubber__entry[data-active] {
  background: var(--cyc-orange);
  color: #fff;
  font-weight: 600;
}
.scrubber__month {
  font-size: 11px; font-weight: 700;
  color: var(--cyc-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

### Pattern 4 — Identity Card (= v3，不变)

```css
.identity-card__avatar-frame {
  background: var(--cyc-surface-pure);
  border-radius: var(--cyc-r-card);
  padding: 12px;
  box-shadow:
    0 8px 24px -8px rgba(0, 0, 0, 0.06),
    0 0 32px rgba(0, 0, 0, 0.04);
}
.identity-card__avatar {
  width: 72px; height: 72px;
  border-radius: var(--cyc-r-dot);
}
```

3D memoji-style 头像（彩色，identity 不限色）+ Bold name + 单行 metric。

### Pattern 5 — View Mode Toggle (= v3，不变)

| Mode | Metaphor | Use |
|---|---|---|
| **Stack** | 物件被随手堆在桌上 | 概览 / "上周发生了好多事" |
| **Lineup** | 时间轴上排开 | 详查 / 按日期浏览 |

只用于 artifact 排列，不用于其他内容。

### Pattern 6 — Editorial Header（🆕 v4，仅 Atlas brand register）

```html
<header class="cyc-editorial-header">
  <span class="cyc-eyebrow">COMMUNITY · 本周</span>
  <h1 class="cyc-display">在大理 · 有这样一群人在认真做事</h1>
  <p class="cyc-tagline">链接每一座孤岛 · cyc.center</p>
</header>
```

```css
body.cyc-brand .cyc-editorial-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-block: 64px 32px;
  max-width: var(--cyc-content-max-brand);
}

body.cyc-brand .cyc-editorial-header h1 {
  font-family: var(--cyc-font-display);
  font-weight: 300;
  font-size: clamp(40px, 5vw, 56px);
  letter-spacing: -0.02em;
  line-height: 1.08;
  color: var(--cyc-text-strong);
}

body.cyc-brand .cyc-editorial-header .cyc-tagline {
  font-size: 16px;
  font-weight: 400;
  color: var(--cyc-text-muted);
  font-style: italic;
}
```

**规则**：
- 仅 Atlas + brand register 用
- 一 surface 最多一个 editorial header
- 不堆叠、不嵌套
- 中文 hero h1 用 Source Han Serif Light（如已加载）或 system Songti fallback

### Pattern 7 — Mono Stamp（🆕 v4，跨层）

```html
<!-- 活动类型 pill -->
<span class="cyc-stamp cyc-pill">READING</span>

<!-- 时间 stamp -->
<span class="cyc-stamp cyc-stamp--time">May 12 · 19:00 — 21:30</span>

<!-- 状态 stamp -->
<span class="cyc-stamp cyc-stamp--live">LIVE</span>

<!-- meta label -->
<span class="cyc-stamp">PUBLIC EVENT · OPEN RSVP</span>
```

```css
.cyc-stamp {
  font-family: var(--cyc-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  line-height: 1.4;
  text-transform: uppercase;
  color: var(--cyc-text-muted);
}

.cyc-stamp--sm { font-size: 11px; }
.cyc-stamp--time {
  letter-spacing: 0;
  text-transform: none;
}
.cyc-stamp--live {
  color: var(--cyc-warning);
  letter-spacing: 0.08em;
}

.cyc-pill.cyc-stamp {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: var(--cyc-r-pill);
  background: rgba(28, 61, 46, 0.08);
}
```

**规则**：
- mono stamp 仅 11-13px，不做 body
- 跨 register / 跨 layer 都可用
- 不替代橙色 temporal accent（temporal 信号还是 orange，stamp 是中性 meta）
- 中文不用 mono stamp（mono 字体没有中文 glyph，渲染会 fallback 成系统 monospace 字，难看）—— 中文 stamp 仍用 PingFang 12-13px

### Pattern 8 — Brand Register Mode（🆕 v4，meta pattern）

```html
<!-- Atlas brand register（hero / 公开活动 / 介绍页）-->
<body class="atlas-canvas cyc-brand">
  ...
</body>

<!-- product register（其余）-->
<body class="aurora-canvas">  <!-- 或 daybook-canvas -->
  ...
</body>
```

加 `.cyc-brand` body class 自动开启：
- display serif 在 `.cyc-display` / `body.cyc-brand h1.cyc-display` 生效
- section gap 加大（用 `.cyc-section-gap` utility）
- max-width 加宽（用 `.cyc-content-max` utility）
- editorial-header pattern 内 h1 自动用 display serif

不加 `.cyc-brand` 的页面（admin、settings、journal、tools）保持 v3 quiet 节奏。

## Mascot system（= v3，不变）

### Self-Mood Mascot (monochrome, 5-state)

```
😄 DELIGHT  · 🙂 CONTENT (默认) · 😐 NEUTRAL · 🙁 DOWN · 😢 SAD
```

SVG，深绿或近黑 on 白圆，5 态切换。仅出现在 Daybook 亲密 surface 顶部 + mood calendar 单元格。

### Identity Avatar (memoji, full-color)

3D 卡通头像，每人不同。出现在 Daybook 列表、Aurora 头像 ring、Atlas 头像 stack。

### Per-layer behavior

| Layer | Self-Mood 出现? | Identity Avatar 出现? |
|---|---|---|
| Daybook | YES — 任何亲密 surface | YES — 列表 / 比较视图 |
| Aurora | NO（基调是工作不是情绪） | YES — 但仅作为 ring（不展开 body） |
| Atlas | NO | YES — stack / 头像组 |

**关键规则**：never put a Self-Mood Mascot in a list of multiple users. The mood mascot is YOU.

## Layer + Register selection logic（v4 完整表）

| 路由 | Layer | Register | display serif | 主 CTA 色 | 装饰签名 |
|---|---|---|---|---|---|
| `/` | Atlas | brand | ✅ hero h1 | orange | 沙底 + 三 blob |
| `/about` | Atlas | brand | ✅ hero h1 | orange | 沙底 |
| `/events` | Atlas | brand | ✅ section h1 | orange | 沙底 |
| `/events/:id` | Atlas | brand | ✅ event title | orange | 沙底 + 玻璃卡 |
| `/rooms` | Atlas | brand | ✅ hero h1 | orange | 沙底 |
| `/community/memories` | Daybook | brand | ❌（Daybook 不上 serif） | orange (temporal) | halo + photos |
| `/community` | Daybook | product | ❌ | orange (temporal) | halo + identity card |
| `/community/:id` | Daybook | product | ❌ | orange (temporal) | halo + identity card |
| `/me`, `/me/*` | Daybook | product | ❌ | orange (temporal) | halo + mascot |
| `/community/admin` | Aurora | product | ❌ | green | 2px 绿线 |
| `/admin`, `/admin/*` | Aurora | product | ❌ | green | 2px 绿线 + mono nums |
| `/team`, `/food`, `/event-card` | Atlas | product | ❌（utility 不 brand） | orange | 沙底 |
| `/generator` | Atlas | product | ❌（form-heavy 工具） | orange | 沙底 |

If still unclear, ask:
> "This page is at <X>. Atlas / Aurora / Daybook? Brand / product register?"

## Hard rules（v3 12 条 + 🆕 v4 8 条）

### v3 保留（1-12）

1. ❌ 不要引入第二种 accent color（Atlas 用 cyc-orange，Aurora 用 cyc-green，Daybook 用 cyc-orange 仅限 temporal）
2. ❌ 不要用深色 canvas（无 dark mode override；admin 也用沙底）
3. ❌ 不要把 Self-Mood Mascot 放进多人列表或 Atlas
4. ❌ 不要用方角（任何 radius < 6px 的容器）
5. ❌ Daybook halo 不要换成 inset 边框；Aurora 2px 绿线不要换成 ambient glow
6. ❌ 不要用纯白 `#fff` 大面积铺背景
7. ❌ 不要用 font-weight 500（Inter / PingFang only 400 / 600 / 700）
8. ❌ 不要用 `--cyc-orange` 作 borders/backgrounds/brand/decoration/hover states（Only temporal/active/verb semantics）
   - **例外（W3 决议 2026-05-08）**：active verb buttons（RSVP "我要参加" / play 三角 / stop 方块 等 transport-verb 类）允许 `linear-gradient(135deg, var(--cyc-orange) 0%, #c4561e 100%)`。理由：gradient 给 conversion path 视觉 gravity，是讲究而非花哨——服务于 conversion 而非装饰。**border-color / hover state / decoration 仍禁用**。
9. ❌ 不要 tilt artifacts 超 ±8°，don't stack > 8
10. ❌ 不要扩 Timeline Scrubber 宽过 40px
11. ❌ 不要把 Stack-Lineup toggle 用于非 artifact 内容
12. ❌ 不要叠加 ambient glow / 戏剧渐变带 / 全屏摄影 hero（v3 撤回这些）

### 🆕 v4 新增（13-20）

13. ❌ `--cyc-font-display` **仅在 brand register Atlas + h1/h2** 用，不下沉到 product register、不下沉到 body / button / pill。
14. ❌ **weight 300 仅给 display serif 用**。Inter 和 PingFang 仍是 400 / 600 / 700。
15. ❌ `--cyc-font-mono` **仅 11-13px，仅 stamp / 时间 / 类型 pill / admin 数字**。不做 body、不做 hero、不做 CTA。
16. ❌ **brand register section gap ≥ 80px，product register ≤ 64px**。两侧不互通。
17. ❌ `.cyc-brand` body class **不能加在 admin / settings / generator 路由**。即便它们也属于"对外可访问"，气质上是 product register。
18. ❌ **mono stamp 不能用中文字符**（mono 字体没有中文 glyph，渲染会 fallback 成系统 monospace 字）。中文 meta label 用 PingFang 12-13px。
19. ❌ 不要把 editorial-header pattern 用在非 hero 区。一 surface 一个，不堆叠。
20. ❌ 不要给 product register 页加大 spacing 模仿 brand。product register 的紧凑是有意为之（信息密度 = 工具感）。

## Output format

When generating UI, structure response as:

```
LAYER: <atlas | aurora | daybook>
REGISTER: <brand | product>
REASON: <one line>
PATTERNS: <list>

[component code in HTML + CSS, vanilla, no framework]

NOTES:
- <how this snaps to other dayrise components>
- <什么 mascot 状态适配（如果 Daybook）>
- <register-specific 注意事项（如 display serif 加载策略、mono fallback）>
```

## Project context — cyc.center

This skill 专属 for cyc.center ("链岛社区工具站"), a vanilla-HTML/CSS/JS community OS with Feishu Bitable backend. 跟着项目走，不为别的项目泛化。

任务时**强制读取顺序**：

1. `PRODUCT.md`（战略上下文 + register 切换原则）
2. `DESIGN.md`（视觉规范 + 当前 dayrise v4 实现状态）
3. `styles/01-tokens.css`（`:root` 的 `--cyc-*` 是真权威）
4. 本 skill 文档（patterns + 层选 + register 选）
5. **vault** `cyc.center/03 设计/03 homepage-design ⭐`（涉及首页时必读）
6. **vault** `cyc.center/03 设计/04 activity-card-system ⭐`（涉及活动卡片时必读）

冲突时：homepage-design / activity-card-system > styles.css > DESIGN.md > 本 skill。

---

## Changelog

**v4.0.0** (2026-05-07) — **dayrise rename + editorial signature additions**
- Renamed daybreak-os → dayrise-os（隐喻：天刚亮 → 日已升起）
- 新增 brand register vs product register 区分（精确执行 PRODUCT.md register override 原则）
- 新增 `--cyc-font-display` (Source Serif 4 Light) → Atlas brand register hero only
- 新增 `--cyc-font-mono` (IBM Plex Mono) → meta stamp / 时间 / 类型 pill / admin 数字（跨层）
- 新增 `--cyc-text-muted-warm #5c554c` → Daybook long-form 暖偏移
- 新增 3 个 patterns: Editorial Header (#6) / Mono Stamp (#7) / Brand Register Mode (#8)
- Section gap 在 brand register 加大到 80-96px（v3 是 32-64px）
- Hard rules 增 8 条（13-20）
- 触发原因：v3 quiet 是对的，但缺一秒辨认 type signature（对比 ElevenLabs / Hyer 暴露）
- 来源参考：ElevenLabs editorial restraint + Hyer Aviation spacing generosity
- v3 token 全部保留，新 token 是 additive，**non-breaking**
- 决策细节：vault `cyc.center/03 设计/05 dayrise-os 重构提案 (v3 → v4).md`

**v3.0.0** (2026-05-02) — quiet philosophy 重写（archived 在 .claude/skills/daybreak-os-archived/SKILL.md）
- 撤回 v2 dramatic 视觉
- 改为 unified base + role-based differentiation：三层共享沙底
- 触发原因：v2 在 cyc.center 落地时违反 PRODUCT.md "讲究 > 花哨"

**v2.0.0** — Added 5 Daybook patterns, split Mascot, relaxed Daybook color rule

**v1.0.0** — Initial three-layer system (Atlas, Aurora, Daybook)
