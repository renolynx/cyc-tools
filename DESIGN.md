# Design

> ⚠️ **2026-05-02 v2 更新**：本文档 Aurora（深绿暗夜玻璃）和 Atlas（橙红渐变带）规范已**部分撤回**。
>
> **撤回原因**（commit `c8b8fcf`）：用户反馈"深绿 admin 非常丑、橙红渐变饱和度过高、字看不清"。原版触发 PRODUCT.md 三条红线 —— "讲究 > 花哨"、"有性格但不喊"、"反对被设计感"。
>
> **新策略（quiet 版）**：Aurora / Atlas / Daybook 三层都共享**沙底 + 三 blob** canvas，差异化通过：
> 1. 顶部 2px 装饰线（Aurora 用 `--cyc-green` 标识 admin 区）
> 2. 排版密度（admin 略加紧凑：gap 4 vs 6, padding 紧）
> 3. 个别按钮颜色（admin CTA 用 `--cyc-green` 实色 vs 公开页 `--cyc-orange`）
>
> **不靠**：换皮换色、ambient glow、深色 canvas、戏剧渐变。
>
> 下面 Aurora / Atlas section 的"深色玻璃"、"大理风景照 hero"等具体 token 描述**保留为长期 aspirational target**，但当前 styles.css 实现按 quiet 版执行。请以 styles.css 为实际权威。

## Visual Theme

**大理玻璃** —— iOS 体感的玻璃拟态，建立在大理配色（深绿 / 落日橙 / 沙）之上。氛围由三个 radial blob（橙、绿、tan）+ 24-40px backdrop-blur 共同构成，所有 surface 漂浮在沙色底之上，像高原的云层叠在阳光里。

**This is not** flat material design, not pure neutral, not dark mode by default. It's *day-warm*, *atmospheric*, *unmistakably cyc.center*.

cyc.center 同时使用 **daybreak-os 三层架构**（Atlas / Aurora / Daybook），但所有 token 在大理配色基础上重新映射 —— daybreak-os 提供 *how to think* 和 *patterns*，本文档提供 *the actual values*。

## Three-Layer Mapping

| daybreak-os 层 | 在 cyc.center 的形态 | 触发 |
|---|---|---|
| **Atlas**（编辑/对外） | 大理风景照背景 + 半透明深绿玻璃卡 + 橙色锚点 | `/`、`/events`、`/events/:id`、活动详情对外 |
| **Aurora**（工具/夜间） | 深绿主调暗夜 + 玻璃 + 橙色 ambient glow | `/admin`、`/team`、command palette、设置弹窗 |
| **Daybook**（陪伴/日常） | **沙底 + 白玻璃浮卡** + halo 阴影 + 单色橙作为 temporal accent | `/me`、`/community`、`/food`、`/me/journal`、`/me/timeline` |

**注意：** daybreak-os SKILL.md 里 Daybook 默认是"近白底"，但 cyc.center 用 **沙底 (`#f2ede6`)** —— 这是产品 DNA，不替换。Daybook 的 halo 阴影和 5 态笑脸保留，只是落在沙色上。

## Color System

### Brand palette (the unchangeable core)

```css
:root {
  --cyc-green:    #1c3d2e;   /* 深森林绿 — 主品牌色 */
  --cyc-green-2:  #2a5740;   /* 浅一点 — 渐变伴侣 */
  --cyc-orange:   #d9652a;   /* 大理落日橙 — temporal/active 唯一 accent */
  --cyc-sand:     #f2ede6;   /* 暖沙底 */
  --cyc-tan:      #c8a96e;   /* 黄昏 tan — 装饰 blob 第三色 */
}
```

不允许引入第二种主色。所有"暖色"必须从 orange / tan 衍生；所有"冷色"必须从 green 衍生。

### Neutral system (AAA-passing on sand)

```css
:root {
  --cyc-text:           #1a1a1a;   /* 主文字，11.8:1 on sand ✅ AAA */
  --cyc-text-strong:    #0d0d0d;   /* 标题/强调，14:1 ✅ AAA */
  --cyc-text-muted:     #4d4d4d;   /* 次要文字，7.4:1 ✅ AAA — 替代旧 #6b6b6b */
  --cyc-text-subtle:    #5c5c5c;   /* 辅助文字，5.9:1 — 仅用于 ≥14px 粗体或 ≥18px 常规 */
  --cyc-text-faint:     #757575;   /* 装饰文字，3.5:1 — 仅用于 placeholder、tag、非语义元素 */
}
```

⚠️ **从旧 `--muted: #6b6b6b` 迁移**：所有用于 body text 的 `var(--muted)` 应改为 `var(--cyc-text-muted)`。仅当文字尺寸 ≥18px 或权重 ≥600（bold）才允许保留 #6b6b6b 级亮度。

### Status colors

```css
:root {
  --cyc-success:        #157a59;   /* AAA-darkened from #1d9e75 */
  --cyc-success-light:  #1d9e75;   /* original — for ≥18px or fills */
  --cyc-danger:         #a93226;   /* AAA-darkened from #c0392b */
  --cyc-danger-light:   #c0392b;   /* original — for ≥18px or fills */
  --cyc-warning:        #b04a18;   /* AAA orange variant — for body text */
}
```

### Surfaces

```css
:root {
  --cyc-surface-glass:        rgba(255, 255, 255, 0.75);  /* main glass card */
  --cyc-surface-glass-strong: rgba(255, 255, 255, 0.88);  /* topbar, sticky */
  --cyc-surface-glass-light:  rgba(255, 255, 255, 0.60);  /* nested cards */
  --cyc-surface-pure:         #ffffff;                     /* polaroid, journal canvas */
  --cyc-surface-tinted:       rgba(28, 61, 46, 0.04);     /* hover, selected row */

  --cyc-border-glass: rgba(255, 255, 255, 0.6);
  --cyc-stroke:       rgba(0, 0, 0, 0.08);
  --cyc-stroke-soft:  rgba(0, 0, 0, 0.05);
  --cyc-inset-shine:  rgba(255, 255, 255, 0.7);  /* glass top-edge highlight */
}
```

### When to use orange (temporal accent — strict semantics)

借鉴 daybreak-os v2 规则：橙色**只**用于以下三类语义：

1. **Temporal anchors**: "Yesterday"、"今天"、"now"、"Live"、"刚刚"
2. **Active state indicators**: recording dot、listening pulse、selected day in week strip
3. **Key transport verbs**: stop button 内的方块色，play 三角色

**Never**: borders、backgrounds（除作为渐变末端）、装饰、品牌主色、hover 状态、links。

如果你想加一个橙色按钮 → 它需要触发上面三类语义之一。否则用绿色。

## Typography

```css
:root {
  --cyc-font-sans: -apple-system, BlinkMacSystemFont, 'PingFang SC',
                   'Inter Variable', 'Helvetica Neue', sans-serif;
  --cyc-font-mono: 'SF Mono', 'JetBrains Mono', 'PingFang SC', monospace;

  /* Scale — base 16px, ratio 1.4 */
  --cyc-text-xs:   12px;
  --cyc-text-sm:   14px;
  --cyc-text-base: 16px;
  --cyc-text-lg:   20px;
  --cyc-text-xl:   28px;
  --cyc-text-2xl:  40px;
  --cyc-text-3xl:  56px;  /* hero only */
}
```

**Weights**：400 (regular) / 600 (semibold) / 700 (bold)。**禁止 500** —— 现有 styles.css 里有几处 `font-weight:500`，迁移时改 600。

**Letter-spacing**：
- Headings ≥20px: `-0.01em` 至 `-0.02em`（tight）
- Body 14-16px: `0`
- ALL CAPS labels: `+0.04em`（tracked）
- 中文：letter-spacing 默认 0；中英混排时段落 `letter-spacing: 0.01em`

**Line-height**：display 1.2 / heading 1.3 / body 1.5-1.6 / dense list 1.4

**中文优化**：因 PingFang SC 视觉重量比 Inter 略轻，中文段落字号比英文 +1px（如英文 14px → 中文 15px）；中文加粗优先用 700（中文 600 在某些显示器上不够清晰）。

## Spacing & Geometry

```css
:root {
  /* Spacing scale — only these */
  --sp-1:  4px;
  --sp-2:  8px;
  --sp-3:  12px;
  --sp-4:  16px;
  --sp-6:  24px;
  --sp-8:  32px;
  --sp-12: 48px;
  --sp-16: 64px;

  /* Radius */
  --cyc-r-pill:  9999px;   /* buttons, status pills, tags */
  --cyc-r-card:  16px;     /* main panels (matches existing --r) */
  --cyc-r-card-lg: 24px;   /* hero cards, daybook surfaces */
  --cyc-r-inner: 10px;     /* inputs, sub-cards (matches existing --r-sm) */
  --cyc-r-tight:  6px;     /* tag, chip, micro-button */
  --cyc-r-dot:   50%;      /* circular */
}
```

**Grid base**: 8px。所有 layout snap to 多倍 8（4 也允许，仅作微调）。
**No square corners.** 最小 `--cyc-r-tight` (6px)。

## Effects (the "Dali atmosphere")

### Background blobs (page-level ambient)

每个 page 必须有 3 个 blob（橙 + 绿 + tan），fixed 定位在视口边缘。**这是 cyc.center 视觉签名，不可省略。**

```css
.blob { position: fixed; border-radius: 50%; filter: blur(90px);
        pointer-events: none; z-index: 0; }
.b1 { width:380px; height:380px; opacity:0.22;
      background: radial-gradient(circle, var(--cyc-orange), transparent 70%);
      top:-100px; right:-60px; }
.b2 { width:320px; height:320px; opacity:0.20;
      background: radial-gradient(circle, var(--cyc-green), transparent 70%);
      bottom:60px; left:-80px; }
.b3 { width:220px; height:220px; opacity:0.18;
      background: radial-gradient(circle, var(--cyc-tan), transparent 70%);
      top:50%; left:50%; }

@media (prefers-reduced-motion: reduce) {
  .blob { opacity: 0.10; filter: blur(60px); } /* 静态弱化版 */
}
```

### Glass surface (Daybook + Aurora 通用)

```css
.surface-glass {
  background: var(--cyc-surface-glass);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--cyc-border-glass);
  border-radius: var(--cyc-r-card);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.06),
    0 0 0 0.5px var(--cyc-inset-shine) inset;  /* 内描边亮 — glass DNA */
  position: relative;
  overflow: hidden;
}

/* The signature top-left sheen — 不可省略 */
.surface-glass::before {
  content: ''; position: absolute; inset: 0;
  border-radius: inherit;
  background: linear-gradient(145deg,
    rgba(255, 255, 255, 0.3) 0%,
    transparent 55%);
  pointer-events: none;
}
```

### Halo (Daybook intimate surfaces)

参考 daybreak-os V4 那张图（笑脸卡片）：

```css
.surface-halo {
  background: var(--cyc-surface-pure);
  border-radius: var(--cyc-r-card-lg);
  box-shadow:
    0 8px 24px -8px rgba(0, 0, 0, 0.08),
    0 0 48px rgba(0, 0, 0, 0.04);   /* halo */
  padding: var(--sp-6);
}
```

**Glass vs Halo** — 两套阴影哲学不能混：
- Glass 用 inset 内描边（"我是玻璃，有边缘"）
- Halo 用 0 0 N 外晕（"我是软纸，浮起来"）

Glass 用于工具、列表、控件。Halo 用于亲密的、内容承载的卡（journal、profile、artifact frame）。

## Layer-Specific Tokens

### Atlas tokens (brand surfaces — `/`、`/events`)

```css
.atlas-canvas {
  /* 大理风景照全屏，绿色暗化叠加 */
  background:
    linear-gradient(rgba(28, 61, 46, 0.45), rgba(28, 61, 46, 0.55)),
    url('<dali-scene>.jpg') center/cover fixed;
}

.atlas-card {
  background: rgba(28, 61, 46, 0.72);  /* dark green glass */
  backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: var(--cyc-r-card-lg);
  box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.96);
  padding: var(--sp-6);
}

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
1. 必须用真实的大理照片作 hero（苍山、洱海、古城、咖啡店、活动现场都行）
2. Tagline 永远在底部，14px，70% opacity 白色
3. 一个主 CTA（橙色 pill），最多一个次要文字链
4. 多卡片用 60/40 或 70/30 非对称

### Aurora tokens (chrome — `/admin`、setting）

```css
.aurora-canvas {
  background: oklch(0.20 0.04 150);  /* deep forest dark */
  position: relative;
}
.aurora-canvas::before {
  /* 橙色 aurora glow 右下 */
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(600px circle at 90% 90%,
    oklch(0.65 0.18 35 / 0.18), transparent 60%);
}
.aurora-canvas::after {
  /* 浅绿 aurora glow 右上 */
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(500px circle at 95% 5%,
    oklch(0.55 0.10 150 / 0.15), transparent 60%);
}

.aurora-surface {
  background: oklch(0.25 0.03 150 / 0.6);  /* green-tinted glass */
  backdrop-filter: blur(40px) saturate(1.4);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: var(--cyc-r-card);
  box-shadow:
    inset 0 0 0 0.5px oklch(1 0 0 / 0.04),
    0 24px 48px -12px oklch(0 0 0 / 0.6);
}

.aurora-text-primary   { color: oklch(0.96 0.005 150); }
.aurora-text-secondary { color: oklch(0.7 0.02 150); }
.aurora-accent         { color: oklch(0.78 0.18 35); }  /* coral-orange */
```

**Aurora 规则**：与 daybreak-os SKILL.md 一致，唯一区别是底色 hue 从 `270`（紫蓝）改为 `150`（绿）。

### Daybook tokens (intimate — `/me`、`/community`、`/food`)

```css
.daybook-canvas { background: var(--cyc-sand); }

.daybook-surface {
  /* 沙底上的纯白 + halo */
  background: var(--cyc-surface-pure);
  border-radius: var(--cyc-r-card-lg);
  box-shadow:
    0 8px 24px -8px rgba(0, 0, 0, 0.08),
    0 0 48px rgba(0, 0, 0, 0.04);
  padding: var(--sp-6);
}

.daybook-text-primary   { color: var(--cyc-text-strong); }
.daybook-text-secondary { color: var(--cyc-text-muted); }
.daybook-text-tertiary  { color: var(--cyc-text-subtle); }  /* 仅 ≥14px bold 用 */

.daybook-dot {
  width: 36px; height: 36px;
  border-radius: var(--cyc-r-dot);
  background: rgba(28, 61, 46, 0.06);  /* 比 #f0f0f0 更暖 */
}
.daybook-dot--filled {
  background: var(--cyc-text-strong);
  color: var(--cyc-sand);  /* 文字反白用沙色，非纯白 */
}

/* Temporal accent — orange */
.daybook-accent { color: var(--cyc-warning); }  /* AAA orange */
.daybook-accent-large { color: var(--cyc-orange); font-size: 18px; }  /* AA 允许 */
```

**Daybook 规则**：
1. 唯一允许的 accent 是 orange，且只能用于 temporal/active/verb 三类语义
2. Halo 阴影是签名 —— 所有 elevated card 都要有
3. 沙底 (`--cyc-sand`) 不替换为白 —— 这是 cyc.center 的暖度
4. 笑脸 mascot 5 态用单色（深绿或近黑）on white

## Components

### Buttons

```css
/* Primary — green gradient pill (existing .sync-btn / .copy-btn pattern) */
.btn-primary {
  background: linear-gradient(135deg, var(--cyc-green), var(--cyc-green-2));
  color: #fff;
  border: none;
  border-radius: var(--cyc-r-pill);
  padding: 12px 24px;
  font-size: var(--cyc-text-sm);
  font-weight: 600;
  letter-spacing: -0.01em;
  box-shadow: 0 4px 16px rgba(28, 61, 46, 0.25);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
}
.btn-primary:active { transform: scale(0.98); box-shadow: 0 2px 8px rgba(28, 61, 46, 0.20); }

/* Secondary — glass pill */
.btn-secondary {
  background: var(--cyc-surface-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--cyc-border-glass);
  border-radius: var(--cyc-r-pill);
  padding: 8px 16px;
  font-size: var(--cyc-text-xs);
  font-weight: 600;
  color: var(--cyc-green);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

/* Temporal — orange pill (use sparingly, only for "now"/active actions) */
.btn-temporal {
  background: var(--cyc-orange);
  color: #fff;
  border-radius: var(--cyc-r-pill);
  padding: 12px 24px;
  font-weight: 600;
}

/* Ghost — only border */
.btn-ghost {
  background: rgba(28, 61, 46, 0.04);
  border: 1.5px dashed rgba(28, 61, 46, 0.25);
  border-radius: var(--cyc-r-inner);
  color: var(--cyc-text-muted);
  padding: 10px 16px;
}
```

### Status pills (existing pattern, keep)

```css
.status-pill { /* 100px radius, glass bg, 12px text, border 0.5-1px */ }
.status-pill.is-active   { background: var(--cyc-green);  color: #fff; }
.status-pill.is-temporal { background: var(--cyc-orange); color: #fff; }
.status-pill.is-done     { background: var(--cyc-success); color: #fff; }
.status-pill.is-quiet    { /* default glass */ }
```

### Inputs

```css
input, textarea {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.10);
  border-radius: var(--cyc-r-inner);
  padding: 10px 12px;
  font-size: var(--cyc-text-sm);
  color: var(--cyc-text);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
input:focus, textarea:focus {
  border-color: var(--cyc-green);
  box-shadow: 0 0 0 3px rgba(28, 61, 46, 0.10);
}
```

最小尺寸 44×44px（包括 padding）满足 AAA touch target。

### Topbar (sticky iOS-style)

```css
.topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center;
  height: 52px; padding: 0 16px;
  background: var(--cyc-surface-glass-strong);
  backdrop-filter: blur(20px) saturate(1.6);
  border-bottom: 0.5px solid var(--cyc-stroke);
}
```

## Patterns (daybreak-os v2 适配 cyc.center)

### Artifact (polaroid in CYC palette)

```css
.artifact-polaroid {
  background: #fefcfa;  /* warm off-white, 不是纯白 */
  padding: 8px 8px 32px;
  transform: rotate(var(--tilt, 0deg));
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 12px 24px -8px rgba(28, 61, 46, 0.15);  /* 阴影微微带绿 */
}
```

倾斜 ±8°，堆叠 ≤8 张 — 同 daybreak-os SKILL.md。

### Activity Bar (CYC palette)

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

### Timeline Scrubber

```css
.scrubber__entry[data-active] {
  background: var(--cyc-orange);  /* 唯一允许的 orange filled bg */
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

### Identity Card

memoji-style 3D 头像保持彩色（identity 不限色）。容器 frame 用 `daybook-surface`（白 + halo）。

### Mascot system

- **Self-Mood**：5 态笑脸，单色绿 (`var(--cyc-green)`) on `var(--cyc-surface-pure)` 圆背景。位于 `/me`、journal、daily check-in
- **Identity Avatar**：3D 彩色 memoji，每人不同。位于 `/community`、消息、协作视图

## Iconography

- **库**：Lucide outline（line stroke 1.75px）
- **尺寸**：16 / 20 / 24 px
- **颜色**：默认 `var(--cyc-text-muted)`，active 用 `var(--cyc-green)`，"now"/temporal 用 `var(--cyc-orange)`
- **emoji**：现有 styles.css 大量用 emoji 作 icon（📋📅👥🍽️✨）—— **保留**，是 CYC playful DNA 的一部分。但只在 menu/list 等"指引性"场合，不在 chrome（按钮、状态）

## Motion

```css
:root {
  /* Easings */
  --ease-out-iox:  cubic-bezier(0.32, 0.72, 0, 1);  /* iOS 抽屉 */
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);    /* 标准过渡 */

  /* Durations */
  --dur-instant: 100ms;   /* 按下回弹 */
  --dur-fast:    150ms;   /* hover/focus */
  --dur-base:    240ms;   /* 卡片展开 */
  --dur-slow:    320ms;   /* 抽屉/页面切换 */
}

/* iOS-style tap feedback — 全 site 通用 */
.tappable:active { transform: scale(0.97); transition: transform var(--dur-instant); }
.tappable-soft:active { transform: scale(0.99); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Anti-patterns (cyc.center 红线)

1. ❌ **不用饱和蓝色** —— 一旦蓝色出现就破坏大理色系。链接用 green，提示用 orange。
2. ❌ **不用 monospace 作 chrome 字体** —— 仅在显示代码/ID 时用，不用作品牌字
3. ❌ **不用纯白 `#fff` 大面积铺背景** —— 沙色才是 CYC 的"白"
4. ❌ **不用纯黑 `#000` 文字** —— 用 `var(--cyc-text-strong)` (#0d0d0d)
5. ❌ **不引入第二种品牌色** —— Dali palette 就是这五个
6. ❌ **不用紫色/粉色装饰性渐变** —— 这是公诉性 SaaS 的标志
7. ❌ **不用奥德状插画** —— 见 PRODUCT.md anti-references
8. ❌ **不省略 background blobs** —— blob 是 cyc.center 大理感的载体
9. ❌ **不在 small body text (<18px) 使用 #d9652a** —— AA 都不达标，必须用 `--cyc-warning` (#b04a18)
10. ❌ **不用 font-weight: 500** —— 改 600

## Migration map (existing → new)

| 旧 token / class | 新 token / class | 备注 |
|---|---|---|
| `--green` | `var(--cyc-green)` | rename only |
| `--green2` | `var(--cyc-green-2)` | rename only |
| `--orange` | `var(--cyc-orange)` | rename only |
| `--sand` | `var(--cyc-sand)` | rename only |
| `--card` | `var(--cyc-surface-glass)` | rename |
| `--text` | `var(--cyc-text)` | rename |
| `--muted` | `var(--cyc-text-muted)` | **值变化**：#6b6b6b → #4d4d4d (AAA) |
| `--stroke` | `var(--cyc-stroke)` | rename |
| `--r` | `var(--cyc-r-card)` | rename |
| `--r-sm` | `var(--cyc-r-inner)` | rename |
| `font-weight: 500` | `font-weight: 600` | 替换全部 |
| `color: #6b6b6b` (body) | `color: var(--cyc-text-muted)` | for AAA |
| `.act-card`、`.panel` 等 | 保留，仅替换内部 token | 不重写组件 |

迁移建议：分阶段。第一阶段只在 `:root` 加新 token + 更新 `--muted`；第二阶段逐组件重命名；第三阶段处理 daybreak-os layer overrides（Atlas/Aurora 是新引入的 surface，不影响旧代码）。

## 与 daybreak-os SKILL.md 的关系

- daybreak-os SKILL.md → **应该怎么思考**（layer 选择、pattern 触发、anti-pattern）
- DESIGN.md（本文档）→ **真正用什么值**（具体 hex、spacing、组件）

任何 UI 输出必须**两份都查**：先用 SKILL.md 决定 layer 和 pattern，再用 DESIGN.md 取实际 token。冲突时 DESIGN.md 优先（因为它绑定真实代码）。

---

## Changelog

**v1.0** — 初始版本，融合 cyc.center 现有 styles.css token 系统 + daybreak-os v2 三层架构 + WCAG AAA 修正。
