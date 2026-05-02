---
name: daybreak-os
description: "Three-layer design system for cyc.center (community OS for 大理 in-place creators). Use when the user wants to design, build, or iterate UI for cyc.center —— editorial showcase surfaces, admin chrome, or intimate companion screens. Triggers on 'use daybreak-os', '/daybreak-os', 'cyc.center 风格', 'community OS 风格', or any UI request mentioning Atlas/Aurora/Daybook layers. Also triggers when designing landing pages, settings panels, journals, mood/calendar views, member profiles, recording/listening states, photo timelines, onboarding flows. v3 quiet philosophy: 三层共享沙底 + 三 blob，差异化通过 typography density / 装饰线 / 按钮颜色，不靠换皮换色。"
version: 3.0.0
user-invocable: true
argument-hint: "[atlas|aurora|daybook|auto] [page-name or route]"
license: MIT
allowed-tools: [Read, Write, Edit, Glob, Grep, WebFetch]
---

# Daybreak OS — Three-Layer Design System (v3 quiet)

cyc.center 专属设计系统。一个产品，三个房间，**共享同一个沙色底盘**，靠**排版密度 + 微差异化标识 + 按钮颜色**区分用途。

> v3 哲学（2026-05-02）：v2 的 "Atlas 大理风景照 / Aurora 深绿暗夜玻璃 / Daybook 近白底"被撤回（commit `c8b8fcf`），原因是触发 PRODUCT.md 三条红线（讲究 > 花哨；有性格但不喊；反对被设计感）。v3 改为 **unified base + role-based differentiation**：三层视觉同源，靠克制的微差识别。

## Setup gate (non-optional)

Before generating ANY UI, declare:

```
LAYER: <atlas | aurora | daybook>
REASON: <one line explaining the layer choice>
PATTERNS: <any of: artifact, activity-bar, scrubber, identity-card, mascot, view-mode>
```

If the request is ambiguous, ASK before designing. Wrong layer = whole output is wrong.

## The Unified Base（v3 新增 —— 三层共享）

所有三层都使用：

- **Canvas**：沙色 (`#f2ede6` / `--cyc-sand`)
- **Ambient blobs**：3 个 fixed radial blob（橙 + 绿 + tan），blur(90px)，opacity 0.18-0.22
- **Surface**：玻璃卡（`rgba(255,255,255,0.75)` + backdrop-blur(24px) + 内描边白亮 + 145° 浅渐变）
- **Typography / Spacing / Radius**：完全共享（见 Shared bones 节）

**不允许**：
- 深色 canvas（包括 dark mode override）
- 任何全屏渐变带（橙红 / 紫粉 / 蓝）
- 多个 ambient glow 叠加（"glow on glow on dark" 是 SaaS 视觉）
- 大面积纯白背景（沙色才是 cyc 的"白"）

## The three layers（v3 简化）

### Atlas — editorial showcase

**When**: landing pages, public event detail, marketing, story-driven surfaces, onboarding intro
**Mood**: editorial, breath, content-confident
**Differentiation from base**:
- Hero h1 略放大（28→36px）+ 英文 tagline 字号同主标，letter-spacing 放松
- 内容区段宽（max-width 较大，给文字更多呼吸）
- Photography（如果有）作为内联内容卡，**不**作为全屏背景
- 一个主 CTA 用 `--cyc-orange` pill（"对外行动"信号）
**Anti-pattern**: 不用全屏摄影 hero override 沙底；不在 hero 区做戏剧渐变；不放 ambient glow 加重视觉

### Aurora — admin chrome

**When**: settings, admin dashboards, /community/admin, /admin, command palettes, dialogs, internal tools
**Mood**: quiet, dense, professional, "you're in admin"
**Differentiation from base**:
- **Top 2px decoration line**（fixed, full-width, `--cyc-green` 实色）—— 唯一明显"我在 admin 区"标志
- Density tighter：gap 4-6 (vs public 8-12)，padding 紧凑
- 主 CTA 用 `--cyc-green` 实色（vs 公开页 `--cyc-orange`）—— 颜色编码 admin vs public action
- Tabular numerals（`font-feature-settings: 'tnum'`）让数字对齐
**Anti-pattern**: 不用深色 canvas; 不用 ambient glow; 不用紫粉色装饰; 不在 chrome 区放 marketing 文案

### Daybook — intimate companion

**When**: 个人主页 `/me`, journal entry, mood calendar, daily check-in, photo timeline, recording sessions, member profiles
**Mood**: tender, breath, character-forward
**Differentiation from base**:
- **Halo cards**：白色 surface 带 `0 0 N px` 外晕阴影（`box-shadow: 0 8px 24px -8px ..., 0 0 48px ...`），漂浮在沙底
- 更多 whitespace（行高 1.6+，section 间 32-48px）
- 单一 temporal accent（`--cyc-orange` 但只用于 time/active/key-verb 三类语义）
- Self-Mood mascot 出现在亲密 surface 顶部
**Anti-pattern**: 不在 Daybook 加多色装饰; 不破坏 halo 阴影哲学（不要换成 inset 边框）; 不超 1 种 accent

## Shared bones（三层都一样）

### Typography
- **Family Latin**: `Inter Variable` (system fallback `-apple-system, sans-serif`)
- **Family Han**: `PingFang SC` (Windows fallback `Microsoft YaHei`)
- **Scale**: 12 / 14 / 16 / 20 / 28 / 36 / 40 px
- **Weights**: 400 (regular) / 600 (semibold) / 700 (bold) —— **禁止 500**
- **Letter spacing**: `-0.01em` for headings 20px+, `0` for body, `+0.04em` for ALL CAPS labels
- **Line height**: 1.5 body, 1.2 display, 1.6 long-form (Daybook)
- **中文优化**：中文字号比英文 +1px，加粗优先 700

### Spacing scale
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` —— only these.

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
- **Library**: Lucide (line/outline) or system emoji where playful is needed
- **Stroke**: 1.75px
- **Sizes**: 16 / 20 / 24
- **Color**: matches text-secondary in current layer

## Layer-Specific Tokens（v3 重写）

### Atlas tokens (editorial)

```css
/* Atlas 不需要特殊 canvas —— 跟 base 一样 */
body.atlas-canvas {
  /* canvas 跟公开页一致：沙底 + 三 blob 保留 */
}

/* hero 区的差异化：字层级 + 留白 */
.atlas-hero h1 {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cyc-text-strong);
  line-height: 1.15;
  margin-bottom: 8px;
}
.atlas-hero .tagline-en {
  font-size: 14px;
  font-weight: 400;
  color: var(--cyc-text-muted);
  letter-spacing: 0;
  font-style: italic;
}

/* 主 CTA 用 cyc-orange pill */
.atlas-cta-primary {
  background: var(--cyc-orange);
  color: #fff;
  border-radius: var(--cyc-r-pill);
  padding: 12px 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* 内容卡 = 共享 glass surface，无特殊 override */
.atlas-card {
  background: var(--cyc-surface-glass);
  backdrop-filter: blur(24px) saturate(1.6);
  border: 1px solid var(--cyc-border-glass);
  border-radius: var(--cyc-r-card-lg);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06), 0 0 0 0.5px var(--cyc-inset-shine) inset;
}
```

**Atlas 规则**：
1. 字层级靠**字号差** + **留白**，不靠戏剧装饰
2. Photography 作为**内联内容**（小尺寸卡片或文章插图），不作为 hero 全屏背景
3. 一个主 CTA per surface，最多一个次要文字链
4. Tagline 永远在底部（"链接每一座孤岛" + 站名）
5. 不要全屏渐变 hero override

### Aurora tokens (admin chrome)

```css
body.aurora-canvas {
  /* canvas 跟公开页一致 */
}

/* 顶部 2px 绿装饰线 — 唯一明显"我在 admin 区" */
body.aurora-canvas::before {
  content: ''; position: fixed; top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--cyc-green);
  z-index: 40;
  pointer-events: none;
}

/* admin items density */
.aurora-list { gap: 4px; }
.aurora-item {
  padding: 10px 12px;
  letter-spacing: -0.005em;
}
.aurora-item:hover {
  background: rgba(255,255,255,0.95);
  box-shadow: 0 0 0 1px rgba(28,61,46,0.15) inset;
}

/* admin 主 CTA — cyc-green 实色（vs 公开页 cyc-orange） */
.aurora-cta-primary {
  background: var(--cyc-green);
  color: #fff;
  font-weight: 600;
  border-radius: var(--cyc-r-pill);
}
.aurora-cta-primary:hover {
  background: var(--cyc-green-2);
}

/* admin 次级按钮 — green 浅色玻璃 */
.aurora-cta-secondary {
  background: rgba(28,61,46,0.10);
  color: var(--cyc-green);
  border: none;
  border-radius: var(--cyc-r-inner);
}
.aurora-cta-secondary:hover { background: rgba(28,61,46,0.18); }

/* 数字字段 tabular */
.aurora-num {
  letter-spacing: 0;
  font-feature-settings: 'tnum';
}
```

**Aurora 规则**：
1. **顶部 2px 绿装饰线非选** —— 这是 Aurora 的视觉签名
2. 主 CTA **必须**用 `--cyc-green` 实色（颜色编码 admin = 绿，public = 橙）
3. Density 略加紧（gap/padding 略小于公开页），让信息密度对位 admin 工作流
4. 不允许：深色 canvas、ambient glow、deep glass surface (inset)、紫粉装饰、marketing 文案
5. Tabular numerals 用于所有数据列

### Daybook tokens (intimate companion)

```css
body.daybook-canvas {
  /* canvas 跟公开页一致：沙底 + 三 blob */
}

/* halo card —— Daybook 的视觉签名 */
.daybook-surface {
  background: var(--cyc-surface-pure);   /* 纯白浮在沙底上 */
  border-radius: var(--cyc-r-card-lg);
  box-shadow:
    0 8px 24px -8px rgba(0, 0, 0, 0.08),
    0 0 48px rgba(0, 0, 0, 0.04);   /* halo */
  padding: 24px;
}

/* 文字色阶（AAA pass）*/
.daybook-text-primary   { color: var(--cyc-text-strong); }
.daybook-text-secondary { color: var(--cyc-text-muted); }
.daybook-text-tertiary  { color: var(--cyc-text-subtle); }  /* 仅 ≥14px bold */

/* dot grid（calendar / status pip）*/
.daybook-dot {
  width: 36px; height: 36px;
  border-radius: var(--cyc-r-dot);
  background: rgba(28, 61, 46, 0.06);
}
.daybook-dot--filled {
  background: var(--cyc-text-strong);
  color: var(--cyc-sand);
}

/* Temporal accent —— ONLY for time/active/key-verb */
.daybook-accent       { color: var(--cyc-warning); }    /* AAA orange #b04a18 */
.daybook-accent-large { color: var(--cyc-orange); }     /* AA OK at ≥18px */
```

**Daybook 规则**：
1. **Halo 阴影非选** —— 这是 Daybook 的视觉签名
2. **唯一允许的 accent 是 `--cyc-warning` / `--cyc-orange`**，且只能用于：
   - Temporal anchors: "Yesterday" / "Today" / "Now" / "Live"
   - Activity state: recording dot, listening pulse, "speaking", "thinking"
   - Key transport verbs: stop button 内的方块色
   - **Never** for: borders, backgrounds, brand color, decorative highlights, hover states
3. 沙底 (`--cyc-sand`) 不替换为白
4. 笑脸 mascot 5 态用单色（深绿或近黑）
5. 字号底线 16px，行高 ≥ 1.6（中老年用户友好）

## Daybook patterns（v2 → v3 不变）

### Pattern 1 — Artifact (content as physical object)

```css
.artifact-polaroid {
  background: #fefcfa;  /* warm off-white */
  padding: 8px 8px 32px;
  transform: rotate(var(--tilt, 0deg));
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 12px 24px -8px rgba(28, 61, 46, 0.15);
}
```

倾斜 ±8°，堆叠 ≤8 张。

### Pattern 2 — Persistent Activity Bar

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

底部锚定，不阻塞页面。用于 recording / AI thinking / uploading 等长时活动。

### Pattern 3 — Timeline Scrubber

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

### Pattern 4 — Identity Card

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

### Pattern 5 — View Mode Toggle (Stack ↔ Lineup)

| Mode | Metaphor | Use |
|---|---|---|
| **Stack** | 物件被随手堆在桌上 | 概览 / "上周发生了好多事" |
| **Lineup** | 时间轴上排开 | 详查 / 按日期浏览 |

只用于 artifact 排列，不用于其他内容。

## Mascot system

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
| Aurora | NO（基调是工作不是情绪）| YES — 但仅作为 ring（不展开 body） |
| Atlas | NO | YES — stack / 头像组 |

**关键规则**：never put a Self-Mood Mascot in a list of multiple users. The mood mascot is YOU.

## Layer selection logic

| If the page is... | Layer | Common patterns |
|---|---|---|
| Public-facing, marketing, story | **Atlas** | hero card, tagline-driven |
| `/admin/*`, settings, command palette, dropdown menu | **Aurora** | 2px green line, density |
| Personal home, journal, mood, calendar, profile, daily check-in | **Daybook** | halo card, mascot |
| Activity detail (public event with cover) | **Atlas** | content-driven warmth |
| Activity edit form (admin task) | **Aurora** | green CTA |
| Activity RSVP card (member's perspective) | **Daybook** | identity card, halo |
| Photo timeline / memory recap | **Daybook** | artifact + scrubber |
| Recording / listening / AI thinking | **Daybook** | activity bar |
| Member directory / community grid | **Daybook** | identity-card grid |

If still unclear, ask:
> "This page is about <X>. Atlas (showcase), Aurora (chrome), or Daybook (companion)?"

## Hard rules（v3 更新）

1. ❌ **不要引入第二种 accent color**（Atlas 用 cyc-orange，Aurora 用 cyc-green，Daybook 用 cyc-orange 仅限 temporal）
2. ❌ **不要用深色 canvas**（无 dark mode override；admin 也用沙底）
3. ❌ **不要把 Self-Mood Mascot 放进多人列表**或 Atlas
4. ❌ **不要用方角**（任何 radius < 6px 的容器）
5. ❌ **Daybook halo 不要换成 inset 边框**；Aurora 2px 绿线不要换成 ambient glow（layer 视觉签名不动）
6. ❌ **不要用纯白 `#fff` 大面积铺背景** —— 沙色才是 cyc 的"白"
7. ❌ **不要用 font-weight 500**。Only 400 / 600 / 700.
8. ❌ **不要用 `--cyc-orange` 作 borders/backgrounds/brand/decoration/hover states**。Only temporal/active/verb semantics.
9. ❌ **不要 tilt artifacts 超 ±8°**。Don't stack > 8.
10. ❌ **不要扩 Timeline Scrubber 宽过 40px**。
11. ❌ **不要把 Stack-Lineup toggle 用于非 artifact 内容**。
12. ❌ **不要叠加 ambient glow / 戏剧渐变带 / 全屏摄影 hero**（v3 撤回这些）

## Output format

When generating UI, structure response as:

```
LAYER: <choice>
REASON: <one line>
PATTERNS: <list any used: artifact, activity-bar, scrubber, identity-card, mascot, view-mode>

[component code in HTML + CSS, vanilla, no framework]

NOTES:
- <how this snaps to other Daybreak components>
- <what mascot state is appropriate, if Daybook>
- <what mode/state is the artifact view, if applicable>
```

## Project context — cyc.center

This skill **专属** for **cyc.center** ("链岛社区工具站"), a vanilla-HTML/CSS/JS community OS with Feishu Bitable backend. 跟着项目走，不为别的项目泛化。

| Route | Layer |
|---|---|
| `/`, `/about` | Atlas |
| `/events`, `/events/:id` (public view) | Atlas |
| `/me` | Daybook |
| `/me/journal` | Daybook |
| `/me/calendar` | Daybook |
| `/me/timeline` | Daybook |
| `/me/recording` | Daybook |
| `/community` (public list) | Daybook |
| `/community/:id` | Daybook |
| `/community/admin` | Aurora |
| `/admin`, `/admin/instrumentation` | Aurora |
| `/team`, `/food`, `/event-card` | Atlas (in spirit, public utility) |

任务时**强制读取顺序**：
1. PRODUCT.md（战略上下文）
2. DESIGN.md（视觉规范 + 当前 quiet 实现状态）
3. styles.css 头部 token 定义（`:root` 的 `--cyc-*` 是真权威）
4. 本 skill 文档（patterns + 层选）

冲突时：styles.css > DESIGN.md > 本 skill。

---

## Changelog

**v3.0.0** (2026-05-02) — **quiet philosophy 重写**
- 撤回 v2 的"三层 = 三种视觉语言"（Atlas dramatic photo / Aurora dark glass / Daybook white halo on near-white）
- 改为 unified base + role-based differentiation：三层共享沙底 + 三 blob，靠 typography density / 装饰线 / 按钮颜色区分
- Atlas 不再是全屏摄影 hero，改为字层级 + 留白
- Aurora 不再是深绿暗夜玻璃，改为顶部 2px 绿装饰线 + density + green-filled CTA
- Daybook halo 阴影规范保留，纯白卡浮在沙底（之前是浮在近白底）
- 触发原因：v2 在 cyc.center 落地时违反 PRODUCT.md "讲究 > 花哨" / "有性格但不喊" / "反对被设计感"，用户反馈"非常丑、字看不清"（commit `c8b8fcf`）
- Patterns（Artifact / Activity Bar / Scrubber / Identity Card / View Mode / Mascot）保持不变
- Hard rules 增加 v3 quiet 哲学约束（共 12 条）

**v2.0.0** — Added 5 Daybook patterns, split Mascot into Self-Mood + Identity Avatar, relaxed Daybook color rule to allow single temporal accent.

**v1.0.0** — Initial three-layer system (Atlas, Aurora, Daybook).
