# Session Prompts

> 每个 Phase 任务一份"开新会话怎么开场"的 prompt 模板。
> 让你随时开新窗口都不用重新解释项目。

## 怎么用

1. 找到你要做的任务（按 `PLAN-USING-SKILLS.md` 的 Phase 编号）
2. 打开对应文件 `<phase>-<short-name>.md`
3. **只复制"复制开始 ↓↓↓ 到 复制结束 ↑↑↑"之间的内容**
4. 粘进新的 Claude Code 会话

新会话会自动读项目根的 CLAUDE.md / PRODUCT.md / DESIGN.md / homepage-design.md / PLAN，然后按 prompt 干活。

## 写新 session prompt 的模板

每份 session prompt 应该包含：

1. **任务标题**（从 PLAN 复制）
2. **必读文档列表**（按优先级）
3. **任务范围**（人话说一句话）
4. **关键决策**（让新 Claude 先想，不要直接动手）
5. **验收标准**（checklist）
6. **完成后必做**（更新文档 / 跑测试 / commit 格式）
7. **红线**（不要做的事）

模板可以照抄 `3.1.2-activity-cards-avatars.md`。

## 已有 session prompts

- `3.1.2-activity-cards-avatars.md` — 活动卡片头像组 + 人物 modal

## 维护

- 任务完成后：把对应 prompt 文件**保留**（未来可能要再做类似的），加 `## ✅ 已完成 (commit xxx)` 头部备注
- PLAN 改了：相关 prompt 也要改（保持一致）
- 新增 Phase 任务：开新 prompt 文件，更新本 README

## 反模式

- ❌ 在 prompt 里复述 CLAUDE.md / PRODUCT.md 已有的内容（让新 Claude 读源文件，不要让它读复述）
- ❌ 在 prompt 里给具体代码（让 Claude 自己写）
- ❌ 一份 prompt 涵盖多个 Phase 任务（拆开，每个一份）
- ❌ 写 < 30 行（信息不够）或 > 200 行（违背 minimal 原则）
