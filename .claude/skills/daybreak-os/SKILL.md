---
name: daybreak-os
description: "Three-layer design system for community / personal-OS products. Use when the user wants to design, build, or iterate UI for cyc.center or any product that needs to balance editorial showcase, premium tooling, and intimate companion surfaces. Triggers on 'use daybreak-os', '/daybreak-os', 'cyc.center 风格', 'community OS 风格', or any UI request mentioning Atlas/Aurora/Daybook layers. Also triggers when designing landing pages, settings panels, journals, mood/calendar views, member profiles, recording/listening states, photo timelines, or onboarding flows for community products."
version: 2.0.0
user-invocable: true
argument-hint: "[atlas|aurora|daybook|auto] [page-name or route]"
license: MIT
allowed-tools: [Read, Write, Edit, Glob, Grep, WebFetch]
---

# Daybreak OS — Three-Layer Design System

A single product with three rooms. Each room has one purpose, one mood, one set of tokens.

The job of this skill: when given a UI request, **first decide which layer**, then output code using only that layer's tokens. **Never mix layers in one component.** Skin transitions happen at route boundaries, not inside a card.

## Setup gate (non-optional)

Before generating ANY UI, declare:

```
LAYER: <atlas | aurora | daybook>
REASON: <one line explaining the layer choice>
PATTERNS: <any of: artifact, activity-bar, scrubber, identity-card, mascot, view-mode>
```

If the request is ambiguous, ASK before designing. Wrong layer = whole output is wrong.

## The three layers

### Atlas — editorial showcase
- **When**: landing pages, public event detail, marketing, story-driven surfaces, onboarding intro
- **Mood**: dramatic, branded, photographic
- **Spec**: full-bleed photography backdrop + dark semi-transparent cards floating on top + multi-card asymmetric grid + type hierarchy via weight + content-driven accent colors + tagline-as-design
- **Anti-pattern**: don't use Atlas for chrome (settings, menus, command palettes). It's for storytelling.

### Aurora — premium tooling
- **When**: settings, dropdowns, command palettes (⌘K), admin dashboards, dialogs, dark-mode chrome
- **Mood**: calm, premium, nocturnal, glassy
- **Spec**: deep-dark base + ambient radial glows (coral + cool-blue) at canvas margins + glass surfaces with `backdrop-filter: blur` + inset highlight border + outline icons + single accent color (coral)
- **Anti-pattern**: don't use Aurora for daily intimate moments. It feels distant for journaling.

### Daybook — intimate companion
- **When**: personal home `/me`, journal entry, mood calendar, daily check-in, photo timeline, recording sessions, member profiles, daily companion surfaces
- **Mood**: tender, quiet, near-monochrome, character-forward
- **Spec**: near-white background + pure-white surfaces with **radial halo shadow** + grayscale type with **single coral temporal accent** + dual mascot system (mood + identity) + sparse circle-grid information patterns + maximum whitespace
- **Anti-pattern**: don't add a second accent color, don't use color for decoration. Color must mean "now/active/temporal".

## Shared bones (all three layers)

Different skins on identical skeleton.

### Typography
- **Family Latin**: `Inter Variable` (or system fallback `-apple-system, sans-serif`)
- **Family Han**: `Source Han Sans VF` (or `PingFang SC, Microsoft YaHei`)
- **Scale**: 12 / 14 / 16 / 20 / 28 / 40 px (1.4× ratio)
- **Weights**: 400 (regular) / 600 (semibold) / 700 (bold)
- **Letter spacing**: `-0.01em` for headings 20px+, `0` for body, `+0.02em` for ALL CAPS labels
- **Line height**: 1.5 body, 1.2 display

### Spacing scale
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` — only these. No `10`, no `18`, no `36`.

### Radius
| Token | Value | Use |
|---|---|---|
| `--r-pill` | `9999px` | buttons, rings, tags |
| `--r-card` | `24px` | main containers |
| `--r-inner` | `16px` | nested elements (hover row, sub-card) |
| `--r-dot` | `50%` | calendar dots, status pips, avatars |

**No square corners anywhere.** Even `<input>` gets at least `--r-inner`.

### Grid base
8px. All layout snaps to multiples of 8.

### Icon system
- **Library**: Lucide (line/outline)
- **Stroke**: 1.75px
- **Sizes**: 16 / 20 / 24
- **Color**: matches text-secondary in current layer

## Atlas tokens (editorial)

```css
.atlas-canvas {
  background: url('<scene>.jpg') center/cover, oklch(0.18 0 0);
}

.atlas-card {
  background: oklch(0.18 0.005 270 / 0.72);
  backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: var(--r-card);
  box-shadow: 0 24px 48px -16px oklch(0 0 0 / 0.5);
  padding: 24px;
}

.atlas-heading {
  font-size: 20px;
  font-weight: 600;
  color: oklch(0.96 0 0);
  letter-spacing: -0.01em;
}

.atlas-body {
  font-size: 14px;
  font-weight: 400;
  color: oklch(0.78 0 0);
  line-height: 1.6;
}

.atlas-cta-primary {
  background: oklch(0.98 0 0);
  color: oklch(0.18 0 0);
  border-radius: var(--r-pill);
  padding: 10px 20px;
  font-weight: 500;
}
```

**Atlas rules:**
1. Always one hero card + supporting cards in asymmetric grid (60/40 or 70/30)
2. Empty states use **filled icon containers** in content-derived warm colors (echo photo)
3. One primary CTA per surface, max one secondary text link
4. Tagline at bottom always present, 14px, 70% opacity
5. Wordmark/logo at top center
6. Photography must have visible depth, drama, real-world texture — no abstract gradients

## Aurora tokens (premium tooling)

```css
.aurora-canvas {
  background: oklch(0.18 0.005 270);
  position: relative;
}
.aurora-canvas::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(
    600px circle at 90% 90%,
    oklch(0.78 0.15 25 / 0.18),
    transparent 60%
  );
}
.aurora-canvas::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(
    500px circle at 95% 5%,
    oklch(0.85 0.08 240 / 0.15),
    transparent 60%
  );
}

.aurora-surface {
  background: oklch(0.22 0.01 270 / 0.6);
  backdrop-filter: blur(40px) saturate(1.4);
  border: 1px solid oklch(1 0 0 / 0.08);
  border-radius: var(--r-card);
  box-shadow:
    inset 0 0 0 0.5px oklch(1 0 0 / 0.04),
    0 24px 48px -12px oklch(0 0 0 / 0.6);
}

.aurora-text-primary { color: oklch(0.96 0.005 270); }
.aurora-text-secondary { color: oklch(0.7 0.01 270); }
.aurora-accent { color: oklch(0.78 0.15 25); }
.aurora-accent-ring {
  box-shadow:
    0 0 0 1.5px oklch(0.78 0.15 25),
    0 0 24px oklch(0.78 0.15 25 / 0.4);
}
```

**Aurora rules:**
1. Single accent color (coral). Never introduce a second accent.
2. The inset glass-edge highlight is non-negotiable — it's what makes glass look real
3. All buttons are pills (`--r-pill`)
4. Text never pure white (max `oklch(0.96)`)
5. Hover state = elevate to `oklch(0.28 0.01 270 / 0.5)`, no color change
6. Aurora glows belong at canvas margins, never centered

## Daybook tokens (intimate companion)

```css
:root {
  /* Daybook canvas + surface */
  --db-canvas:        oklch(0.985 0 0);   /* near-white, never pure */
  --db-surface:       oklch(1 0 0);       /* pure white for elevated */
  --db-text-primary:  oklch(0.15 0 0);    /* near-black */
  --db-text-secondary:oklch(0.55 0 0);
  --db-text-tertiary: oklch(0.75 0 0);
  --db-fill-empty:    oklch(0.94 0 0);    /* circle-grid empty state */

  /* The ONE allowed accent — temporal only */
  --db-accent:        oklch(0.62 0.22 30);    /* warm coral-orange */
  --db-accent-soft:   oklch(0.62 0.22 30 / 0.12);
}

.daybook-canvas { background: var(--db-canvas); }

.daybook-surface {
  background: var(--db-surface);
  border-radius: var(--r-card);
  box-shadow:
    0 8px 24px -8px oklch(0 0 0 / 0.08),
    0 0 48px oklch(0 0 0 / 0.04);  /* halo — the signature */
  padding: 24px;
}

.daybook-dot {
  width: 36px; height: 36px;
  border-radius: var(--r-dot);
  background: var(--db-fill-empty);
}
.daybook-dot--filled {
  background: var(--db-text-primary);
  color: var(--db-canvas);
}

/* Temporal accent — ONLY use for time markers, active states, key verbs */
.daybook-accent { color: var(--db-accent); }
```

**Daybook rules (revised in v2):**
1. **One accent only — `--db-accent` (coral-orange) — and only for these semantics:**
   - Temporal anchors: "Yesterday", "Today", "Now", "Live"
   - Activity state: recording dot, listening pulse, "speaking", "thinking"
   - Key transport verbs: the icon inside Stop button, the dot inside ● indicator
   - **Never** for: borders, backgrounds, brand color, decorative highlights, hover states
2. Halo shadow on every elevated surface — this IS the layer's signature
3. Sparse > dense. Empty space carries meaning.
4. Title placeholders are 28-40px Bold; body is 16-20px Regular. No middle weights.
5. Use circles (`--r-dot`) liberally — for dates, mascots, status, member avatars
6. Mascot belongs at the top of intimate surfaces (journal, profile)
7. Pure white `#fff` and pure black `#000` forbidden — always at least 1.5% off

## Daybook patterns (v2 additions)

These are reusable component recipes for the Daybook layer.

### Pattern 1 — Artifact (content as physical object)

Make digital content feel like a physical thing the user can pick up. Used for photos, memories, captured moments.

```css
.artifact-polaroid {
  background: white;
  padding: 8px 8px 32px;        /* mimic real polaroid frame */
  transform: rotate(var(--tilt, 0deg));
  box-shadow:
    0 2px 4px oklch(0 0 0 / 0.08),
    0 12px 24px -8px oklch(0 0 0 / 0.12);
}
.artifact-polaroid img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

/* Stack mode: photos pile on top of each other */
.artifact-stack {
  position: relative;
  width: fit-content; margin: 0 auto;
}
.artifact-stack > .artifact-polaroid {
  position: absolute;
  /* tilt range: -8° to +8°, randomly distributed */
}

/* Lineup mode: horizontal row with slight overlap */
.artifact-lineup {
  display: flex;
  gap: -16px;        /* negative gap = overlap */
}
.artifact-lineup > .artifact-polaroid:nth-child(odd)  { --tilt: -3deg; }
.artifact-lineup > .artifact-polaroid:nth-child(even) { --tilt:  3deg; }
```

**Rules:**
- Tilt range: ±8° random per item
- Stack ≤ 8 items (more = looks chaotic, not casual)
- Polaroid frame is 8px sides + 32px bottom (NEVER equal padding — that breaks the metaphor)
- Always white frame, never tinted
- Drop shadow has TWO layers: tight contact shadow + ambient lift

### Pattern 2 — Persistent Activity Bar

A bottom-anchored running-state bar. Different from modals (non-blocking) and toasts (not transient). Use for: recording, AI thinking, uploading, any long-running activity the user shouldn't be locked out of.

```html
<div class="activity-bar">
  <div class="activity-bar__header">
    <span class="activity-bar__dot"></span>
    <span class="activity-bar__label">Listening</span>
  </div>
  <p class="activity-bar__sub">Speak freely, we'll make sense of it after.</p>
  <div class="activity-bar__row">
    <div class="activity-bar__meter">
      <svg><!-- waveform --></svg>
      <span class="activity-bar__time">1:32</span>
    </div>
    <div class="activity-bar__transport">
      <button class="db-pill">⏸</button>
      <button class="db-pill">⏹ Stop</button>
    </div>
  </div>
</div>

<style>
.activity-bar {
  position: fixed; left: 16px; right: 16px; bottom: 16px;
  background: oklch(0.97 0 0);
  border-radius: var(--r-card);
  padding: 16px 20px;
  box-shadow:
    0 -4px 16px -4px oklch(0 0 0 / 0.06),
    0 0 32px oklch(0 0 0 / 0.04);
}
.activity-bar__dot {
  width: 8px; height: 8px;
  border-radius: var(--r-dot);
  background: var(--db-accent);
  animation: db-pulse 1.6s ease-in-out infinite;
}
@keyframes db-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
.activity-bar__label { font-weight: 600; color: var(--db-text-primary); }
.activity-bar__sub   { color: var(--db-text-secondary); font-size: 14px; }
</style>
```

**Rules:**
- Always pulsing dot in `--db-accent` for active states
- Subtitle in plain language explaining what's happening (reduces user anxiety)
- Transport controls are pills, right-aligned
- Never blocks page interaction (no overlay, no backdrop)

### Pattern 3 — Timeline Scrubber

Right-edge vertical date ruler. Doubles as metadata + navigation.

```html
<div class="scrubber">
  <span class="scrubber__month">Jun</span>
  <a class="scrubber__entry" data-active>11 W</a>
  <a class="scrubber__entry">7 S</a>
  <a class="scrubber__entry">4 W</a>
  <span class="scrubber__month">May</span>
  <a class="scrubber__entry">29 T</a>
  <!-- ... -->
</div>

<style>
.scrubber {
  position: sticky; top: 0; right: 0;
  width: 36px;
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 4px;
  font-size: 12px;
}
.scrubber__month {
  font-size: 11px;
  font-weight: 700;
  color: var(--db-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 8px;
}
.scrubber__entry {
  color: var(--db-text-secondary);
  text-decoration: none;
  padding: 2px 4px;
  border-radius: var(--r-inner);
}
.scrubber__entry[data-active] {
  background: var(--db-accent);
  color: white;
  font-weight: 600;
}
</style>
```

**Rules:**
- Width 32-40px, never wider
- Month markers Bold + UPPERCASE + tracked
- Date entries in middle gray, active in coral pill
- Always sticky to viewport so visible during scroll
- Click jumps to that section; date format `<day> <weekday-letter>`

### Pattern 4 — Identity Card

Compact person summary. Avatar + name + activity metric.

```html
<article class="identity-card">
  <div class="identity-card__avatar-frame">
    <img class="identity-card__avatar" src="memoji.png">
  </div>
  <h3 class="identity-card__name">玖玖</h3>
  <p class="identity-card__metric">本周 3 场活动 · 累计 47 次出席</p>
</article>

<style>
.identity-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px;
}
.identity-card__avatar-frame {
  /* This frame uses the daybook-surface halo */
  background: var(--db-surface);
  border-radius: var(--r-card);
  padding: 12px;
  box-shadow:
    0 8px 24px -8px oklch(0 0 0 / 0.06),
    0 0 32px oklch(0 0 0 / 0.04);
}
.identity-card__avatar {
  width: 72px; height: 72px;
  border-radius: var(--r-dot);
}
.identity-card__name {
  font-size: 20px; font-weight: 700;
  color: var(--db-text-primary);
}
.identity-card__metric {
  font-size: 13px;
  color: var(--db-text-secondary);
}
</style>
```

**Rules:**
- Avatar is a 3D memoji-style image (color OK — see Mascot system below)
- Name is Bold/Semibold, 20px
- Metric is one line, dot-separator format: `<period> <count> · <total>`
- The metric language must be product-specific noun ("moments", "活动", "篇笔记")

### Pattern 5 — View Mode Toggle (Stack ↔ Lineup)

Same content, two physical metaphors. Toggle, don't navigate.

| Mode | Metaphor | Use |
|---|---|---|
| **Stack** | Photos casually piled on a table | Overview / summary / "lots happened" |
| **Lineup** | Photos arranged on a timeline | Detailed scan / chronological browsing |

The toggle is usually a 2-button pill segmented control at top-right of the surface. State persists in localStorage per page.

```html
<div class="view-toggle">
  <button data-mode="stack" data-active>Stack</button>
  <button data-mode="lineup">Lineup</button>
</div>
```

**Rules:**
- Switching mode animates: stack-to-lineup uses FLIP technique (each polaroid finds its new position)
- Active button uses `--db-accent-soft` background, accent text color
- Don't use this toggle for non-photographic content (it's specifically about artifact arrangement)

## Mascot system (split in v2)

Daybook has TWO mascot types serving different roles. Don't confuse them.

### Self-Mood Mascot (monochrome, 5-state)

Represents the USER's emotional state. Abstract, monochrome, character-as-feeling.

```
😄 DELIGHT     mouth: wide upward arc, eyes: tall ovals
🙂 CONTENT     mouth: gentle upward arc, eyes: dots         ← default
😐 NEUTRAL     mouth: horizontal line,   eyes: dots
🙁 DOWN        mouth: gentle downward,   eyes: dots
😢 SAD         mouth: small frown,       eyes: tall ovals
```

**Use:** journal hero, mood calendar fills, today check-in, profile self-view
**Format:** SVG, pure black on white circle, no color, no gradient
**Sizing:** 32-64px depending on context

### Identity Avatar (memoji, full-color)

Represents A SPECIFIC PERSON. Concrete, colorful, character-as-individual.

**Use:** community member lists, message threads, identity cards, comparing-people views
**Format:** PNG/SVG asset, memoji-style 3D, includes skin/hair/clothing color
**Sizing:** 48-96px in cards; 24-32px inline (in lists/messages)
**Generation:** users can pick from a curated set or upload one. Should be on transparent or warm-soft background.

### Per-layer behavior

| Layer | Self-Mood appears? | Identity Avatar appears? |
|---|---|---|
| Daybook | YES — anywhere intimate | YES — in member views, comparison |
| Aurora | NO (would feel cold-warm clash) | YES — but only as ring (no body shown) |
| Atlas | NO | YES — stacked thumbs in hero, never solo |

**Critical rule:** never put a Self-Mood Mascot in a list of multiple users. The mood mascot is YOU. Other people get Identity Avatars.

## Layer selection logic

When the user says "build me a [page]" without specifying layer, decide by route/intent:

| If the page is... | Layer | Common patterns |
|---|---|---|
| Public-facing, marketing, story | **Atlas** | hero card, multi-card grid |
| Settings, admin, command palette, dropdown menu | **Aurora** | glass surface, accent ring |
| Personal home, journal, mood, calendar, profile, daily check-in | **Daybook** | mascot, halo, dot grid |
| Activity detail (public event with cover) | **Atlas** | photographic hero |
| Activity edit form (admin task) | **Aurora** | glass form |
| Activity RSVP card (member's perspective) | **Daybook** | identity card, halo |
| Photo timeline / memory recap | **Daybook** | artifact + scrubber |
| Recording / listening / AI thinking | **Daybook** | activity bar |
| Member directory / community grid | **Daybook** | identity-card grid |
| Onboarding screen | **Atlas** for hero, **Daybook** for forms | — |

If still unclear, ask:
> "This page is about <X>. Atlas (showcase), Aurora (tooling), or Daybook (companion)?"

## Hard rules (DON'T)

1. ❌ Don't introduce a second accent color in any layer (Aurora coral, Daybook coral, Atlas content-derived only)
2. ❌ Don't use Atlas card on a Daybook page (cards have different shadow philosophies)
3. ❌ Don't put the Self-Mood Mascot in Atlas, or in any list of multiple users
4. ❌ Don't use square corners (any radius < 12px) for any container
5. ❌ Don't mix `inset` glass highlight (Aurora) with `0 0 N` halo (Daybook) — they're philosophically opposite
6. ❌ Don't use pure white `#fff` or pure black `#000` — always at least 1.5% off
7. ❌ Don't use middle font weights (500). Only 400 / 600 / 700.
8. ❌ Don't use `--db-accent` for borders, backgrounds, brand, decoration, or hover states. Only temporal/active/verb semantics.
9. ❌ Don't tilt artifacts more than ±8°. Don't stack more than 8.
10. ❌ Don't widen Timeline Scrubber beyond 40px.
11. ❌ Don't use the Stack-Lineup toggle for non-artifact content.

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

This skill was authored for **cyc.center** ("链岛社区工具站"), a vanilla-HTML/CSS/JS community OS with Feishu Bitable backend. Default route map:

| Route | Layer | Likely patterns |
|---|---|---|
| `/`, `/about` | Atlas | hero card, multi-card grid |
| `/events`, `/events/:id` (public view) | Atlas | photographic hero |
| `/me` | Daybook | mascot, mood calendar |
| `/me/journal` | Daybook | mascot + activity-bar (when recording) |
| `/me/calendar` | Daybook | dot grid + scrubber |
| `/me/timeline` | Daybook | artifact + scrubber + view-mode toggle |
| `/me/recording` | Daybook | activity-bar (full-page) |
| `/members` | Daybook | identity-card grid |
| `/members/:id` | Daybook | identity-card + activity feed |
| `/me/settings`, `/admin/*` | Aurora | glass surface, accent ring |

When in doubt for a cyc.center route, check the table above. For new products using daybreak-os, derive equivalents from the layer purpose definitions.

---

## Changelog

**v2.0.0** — Added 5 Daybook patterns (Artifact, Activity Bar, Scrubber, Identity Card, View Mode), split Mascot into Self-Mood + Identity Avatar, relaxed Daybook color rule to allow single temporal accent (coral) under strict semantic rules.

**v1.0.0** — Initial three-layer system (Atlas, Aurora, Daybook).
