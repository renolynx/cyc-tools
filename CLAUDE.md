# cyc-tools — Claude session context

> 任何 Claude Code 会话进 cyc-tools 工作前**强制读这个**。每行都重要。

## 项目是什么

cyc.center 是大理"链岛青年社区"的轻量数字基础设施。
栈：纯 HTML/CSS/JS，零框架，零 build step，飞书 Bitable 后端，Vercel + Upstash KV + Vercel Blob。

## 该读哪些文档

按优先级：

1. **`PRODUCT.md`** —— 战略上下文（who/what/why、品牌人格、anti-references、5 条设计原则）
2. **`DESIGN.md`** —— 视觉规范（大理配色 token / AAA 修正 / 三层架构）
3. **`homepage-design.md`** —— ⭐ 首页设计依据（任何首页 / 活动卡片 / profile 设计冲突时以此为准）
4. **`PLAN-USING-SKILLS.md`** —— 4 阶段执行计划，当前进度
5. **`GOTCHAS.md`** —— 工程踩坑笔记（飞书 API 等）
6. **`RUNBOOK.md`** —— 紧急情况手册 / 关键文件 / env vars 清单
7. **`.claude/skills/daybreak-os/SKILL.md`** —— daybreak-os 设计系统 v3.0.0
8. **`docs/session-prompts/`** —— 启动新会话的 prompt 模板（Phase 任务级）

## 强制规则

### 1. 改 styles.css → 必看 DESIGN.md
两者必须同步。如果改了 token / 加了 layer / 调了配色，**同 commit 更新 DESIGN.md** 否则文档腐烂。
冲突时：`styles/*.css` 是真权威，DESIGN.md 是描述。

### 2. 加 endpoint → 看 _security.js
鉴权 3 套（admin / team / identity），不要发明第 4 套。
身份匹配看 _identity.js，不要绕过。

### 3. 加事件 → 同时改两处
- `api/_events.js` 的 `KNOWN_EVENTS` 加事件名
- 触发位置加 `data-track="..."` 或 `cycTrack('...')` 调用
- 跑 `npm test` 确认 tests/events-known.test.js 通过

### 4. 改 invalidate scope → 同时改测试
`api/_kv.js` 的 SCOPES map 改了，`tests/kv-invalidate.test.js` 也要改。
这是有意的"快照测试" —— 让重构时强制 reviewer 确认 scope 变化。

### 5. push 前
- `npm test` 通过
- 改了 styles.css → DESIGN.md 同步
- 改了 endpoint → 想想要不要加 GOTCHAS.md 条目

## 当前 tech debt 状态（2026-05-02）

- ✅ styles.css 已切 9 份（styles/01..09-*.css，主入口 @import）
- ✅ 数据备份 endpoint 上线（/api/admin/snapshot，admin home 有按钮）
- ✅ 3 个 critical-path 测试（security / events-known / kv-invalidate）
- ✅ RUNBOOK.md / GOTCHAS.md 入仓
- ⚠️ me/timeline/index.html 3292 行 —— 未拆，等加新功能再说
- ⚠️ api/_community-admin.js 710 行 —— 未拆，可读范围内
- ⚠️ 没引 zod / uuid / @upstash/redis —— 当前规模不需要

## 不要做

- 不要引入 build step（PostCSS / webpack / Vite）—— vibe coding 流程的灵魂
- 不要加 dark mode override —— 沙底是 cyc 的 brand
- 不要为了"看起来更专业"重构 —— 等真痛了再重构
- 不要在 Daybook 加第二种 accent 色 —— 唯一 temporal accent 是 cyc-orange
- 不要发明第 4 套鉴权 —— 扩 identity token claims
- 不要在 cron endpoint 写需要密码的逻辑 —— 用 CRON_SECRET header 或公开（看 health.js）
