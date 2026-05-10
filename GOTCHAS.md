# cyc-tools 工程踩坑笔记

> 真实踩到过、修复成本高、容易再次中招的坑。每条都写：现象 / 错误码 / 原因 / 修法 / 备注。

---

## 飞书 Bitable

### Gotcha 1 — DateTime 字段的 search filter 反复无常

**现象**：用 `records/search` POST 接口给 type=5 (DateTime) 字段加 filter，怎么都过不了。

**错误**：
```
{"code":1254018,"msg":"InvalidFilter"}
```

**踩坑路径**：
试过这些都失败：
- `value: [String(msTimestamp)]` —— 13 位毫秒数字字符串
- `value: ['2026-05-02']` —— ISO 日期字符串
- `value: ['ExactDate', String(ms)]` —— 飞书旧版文档建议格式
- 各种 operator：`isGreater` / `is` / `isWithin`

**原因**：飞书 `records/search` 对 DateTime filter 的格式要求**多年来反复变化**且文档不一致。社区普遍反馈类似 1254018。具体哪个 combination 能过似乎跟 Bitable 实例 / API 版本都有关。

**修法**（commit `7d5d48f`）：撤掉服务端 filter，只保留 `sort: [{field_name: '时间戳', desc: true}]`，**500 条拉回来客户端 filter**。

```js
const body = {
  sort: [{ field_name: '时间戳', desc: true }],
  // 不写 filter
};
const items = data.data?.items || [];
return items.filter((it) => {
  const ts = it.fields?.['时间戳'];
  return ts && Number(ts) >= since;
});
```

**何时重新尝试**：
- 单表事件量 > 5000 条 / 天（500 上限会丢数据）
- 飞书官方明确文档新格式

**相关文件**：`api/_events.js` `fetchRecentEvents()`

---

### Gotcha 2 — 飞书数据里时间字段混入全角冒号 `：`，半角 regex 静默失配

**现象**：dayrise-os v4.2 时段渐变 fallback (`cycTimeClass(activity.time)`) 把开始时间映射到 5 段大理日色 utility class。本地 fixture 测试全过，部署到线上后**部分活动卡始终降级到 default `cyc-time-noon`**——视觉上"该是 evening 红橙的活动卡显示成中午黄"。

**错误**：无 throw、无 console error。函数 silent 走 fallback 分支，因为 regex 匹配失败被吞掉。

**踩坑路径**：
1. 一开始以为是 5 段渐变 stops 算错，调了 4 轮（v4.2.1 → v4.2.4）—— 全是颜色调整，问题没解决
2. 直到 console.log(time) 才发现：飞书 admin / generator 用户在中文输入法下输入时间，`：` 是**全角**冒号（U+FF1A），不是半角 `:` (U+003A)
3. `cycTimeClass` 内部 regex `^(\d{1,2}):` 严格只认半角 → 全角直接不匹配 → return default

**原因**：飞书 Bitable 文本字段不做 normalize；中文键盘默认全角；早期录入的活动一半全角一半半角；regex 默认 ASCII。

**修法**（commit `60fe3e8`，v4.2.5）：regex 同时认两种冒号：

```js
function cycTimeClass(time) {
  if (!time) return 'cyc-time-noon';
  const m = String(time).match(/^(\d{1,2})[:：]/);  // ← 同时认半角 : 和全角 ：
  if (!m) return 'cyc-time-noon';
  const hour = Number(m[1]);
  // ...
}
```

**何时重新尝试**：永远不要"只认半角"——所有用户输入字符串解析都应假设可能含全角。

**类似场景预警**：未来任何 regex 处理飞书来的中文用户输入字段（标题、地点、备注）都要考虑全角变体：`：` `；` `，` `（）` `——` `…` 等。

**相关文件**：`api/_activity.js` `cycTimeClass()`，间接影响 `.home-act-thumb-empty` / `.el-card-thumb-empty` 渲染。完整设计踩坑路径见 vault `cyc.center/03 设计/_archive/踩坑 2026-05 v4.2 时段渐变（4 段 linear → 5 段 radial）.md`。

---

## JavaScript / 前端

### Gotcha 3 — Temporal Dead Zone 时间炸弹：const 在 IIFE 顶部调用之后声明

**现象**：`/shanghai` 整页空白，无活动卡。**前一天同代码同数据工作正常**。

**错误**：
```
ReferenceError: Cannot access 'WEEK_THEME_ZH' before initialization
    at renderHeroLive (shanghai:834)
    at applyLang (shanghai:761)
    at shanghai:763
```

**踩坑路径**：
1. 5/10 muShanghai 当天用户报"卡片读不出来"。前一天还好的
2. 直觉以为是部署 / 数据 / API 问题——查了 `/api/get-activities` 返回 11 条上海活动数据完整
3. 直到打开 Chrome console 才看到 `ReferenceError: Cannot access 'WEEK_THEME_ZH' before initialization`
4. `WEEK_THEME_ZH` 是 `const`，声明在 line 781。`applyLang(getLang())` 在 line 763 调用，applyLang 调 renderHeroLive，renderHeroLive 访问 `WEEK_THEME_ZH[week]`
5. `function muWeek` 是 hoisted（function declaration）；`const WEEK_THEME_ZH` 不 hoisted，处于 TDZ
6. **关键**：5/9 之前 `muWeek(now)` 返回 0（festival 还没开始），renderHeroLive 走 `else if (week === 0)` fallback 分支不读 WEEK_THEME_*；5/10 起 W=1 触发 `if (week >= 1 && week <= 4)` 分支才碰到 const → 抛错

**原因**：JavaScript const/let 在声明语句执行前处于 Temporal Dead Zone。如果 IIFE 顶层有"先调用一次的初始化代码"（如 `applyLang(getLang())`），它必须排在所有它依赖的 const 之后。但开发时如果调用路径"恰好不踩到"那些 const（因数据 / 时间 / 状态），bug 会被埋住直到某天突然爆。

**修法**（commit `92fdaf6`，v4.2.16）：把 `const WEEK_THEME_ZH/EN` 和 `function muWeek` 整块移到 `function applyLang` 定义**之前**：

```js
// 之前（埋雷）
function applyLang(lang) { ... renderHeroLive(...) ... }
applyLang(getLang());          // ← line 763 调用
function muWeek(ts) { ... }    // hoisted OK
const WEEK_THEME_ZH = { ... }; // ← line 781，TDZ 等到这里才解禁

// 之后（修好）
function muWeek(ts) { ... }
const WEEK_THEME_ZH = { ... };
const WEEK_THEME_EN = { ... };

function applyLang(lang) { ... renderHeroLive(...) ... }
applyLang(getLang());          // 现在所有依赖都已初始化
```

**何时重新尝试**：永远不要让"顶层立即执行的初始化代码"跨 const 声明边界。一旦写 `XXX(yyy)` 在脚本顶层，先扫一遍所有它的传递依赖，确保都在它之前。

**时间炸弹预警**：这种 bug 看代码静态扫不出来，单元测试也不一定覆盖（因为依赖运行时状态）。任何"日期分支 / 状态分支 / feature flag 分支"的代码改动，特别是引入 const 引用的，发完版要在分支会被触发的状态下手动验证一次。

**类似场景**：任何 `if (active_period === ...)` `if (user.has_subscription)` `if (week >= N)` 这种条件分支里的 const 引用都可能埋雷。

**相关文件**：`shanghai/index.html` 顶层 `<script>` 块。

---

### Gotcha 4 — Inline onclick 拼字符串 + HTML 撇号双重编码 = 静默 SyntaxError

**现象**：活动 RSVP 按钮点了无反应，但卡片正常显示。其他 record 的 RSVP 按钮工作正常，**只有刚加进来的某条挂掉**。

**错误**：浏览器 console 在按钮被点击时抛 `SyntaxError: Unexpected identifier 's'`，但 button 没有任何 visual feedback；用户以为按钮失效。

**踩坑路径**：
1. v4.2.15 修复"RSVP 不弹"时改用 inline `onclick="event.stopPropagation();openRsvp('${esc(a.record_id)}','${titleAttr}','${titleEnAttr}',${fee},'${esc(pill.cls)}')"` 直接调用
2. `titleAttr = esc(a.title || '').replace(/'/g, '&#39;')` —— 把 `'` 编成 HTML entity
3. 几天后从 Luma 同步进飞书 Bitable 一条新活动 `title_en = "From WeChat Group to Non-Profit Association: 706 Berlin's Community OS"` ←有撇号
4. 渲染出来的 button 长这样（字符串字面表示）：
   ```html
   <button onclick="...openRsvp('rec123','...', 'Berlin&#39;s Community OS', 30, 't-talk')">
   ```
5. 浏览器解析 HTML 属性 → `&#39;` 自动 decode 成 `'`：
   ```
   ...openRsvp('rec123','...','Berlin's Community OS', 30, 't-talk')
   ```
6. **JS 字符串字面量被 `Berlin's` 的 `'` 截断** → SyntaxError。但只在点击时 eval 才报，render 时不报，console 不显眼

**原因**：HTML attribute encoding（`&#39;`）和 JS string literal encoding（`\'`）是**两层完全独立的解码**，浏览器先 HTML decode，再把字符串交给 JS 解析器。`&#39;` HTML 安全，但解码出来的 `'` 对 JS 字符串字面量是结束符。**两层不能用同一种 escape 来糊弄**。

**修法**（commit `92fdaf6`，v4.2.16）：彻底放弃 inline onclick 拼字符串。改用**事件代理 + dataset**——button 只挂 `class="js-rsvp-btn"` + `data-rec-id="..."` + `data-fee=...`，document 一个全局 click 监听器：

```js
// button 渲染（dumb，零 inline onclick）
`<button type="button" class="home-act-rsvp js-rsvp-btn" 
  data-rec-id="${esc(a.record_id)}" data-fee="${fee}" data-type="${esc(pill.cls)}">
  我要报名 →
</button>`

// document 监听（撇号在 dataset.recId 里只是字符串，不经过 JS literal parse，安全）
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.js-rsvp-btn');
  if (!btn) return;
  const a = window.__shActivities.find(x => x.record_id === btn.dataset.recId);
  if (a) openRsvp(btn.dataset.recId, a.title, a.title_en, +btn.dataset.fee, btn.dataset.type);
});
```

注意：父元素 `<article onclick="toggleShCardExpand">` 已在第一行 `if (e.target.closest('button, a, ...')) return` 跳过 button 目标，所以 button **不需要 stopPropagation**——加了反而会阻止 document delegation 这个 click handler 触发（v4.2.15 之前撞过这个）。

**何时重新尝试**：永远不要在 inline `onclick` / `onblur` / etc. 里拼用户提供的字符串作 JS literal。如果非要 inline，只能用 `JSON.stringify(value).slice(1,-1)` 给 JS literal 做 escape，再用 HTML attribute escape 包一层，但这样很容易出错。**事件代理 + dataset 永远是更稳的路径**。

**类似场景预警**：任何 `onclick="foo('${user_input}')"` 模式都是同款雷。包括但不限于：用户填的 title / name / bio 含 `'` `"` `\` `<` `>`；从外部数据源（Luma / Twitter / 飞书）抓回来的字符串；含 emoji + ZWJ 的内容。

**相关文件**：`shanghai/index.html` `renderShanghaiEvent()`，`/events` 列表页类似模式（已审过用 dataset OK）。

---

## 模板：写新 gotcha 时复制这块

### Gotcha N — [一句话现象]

**现象**：

**错误**：

**踩坑路径**：

**原因**：

**修法**（commit `xxx`）：

**何时重新尝试**：

**相关文件**：

---

## Meta：什么时候该新增一条 gotcha？

- 一个 bug 让你**思考 / 调试 > 30 分钟**
- 这个 bug 是**外部 API / 工具的反直觉行为**（不是你自己代码 bug）
- 未来很可能**在别处又遇到**（同一 API 的别的字段、同一概念的不同实现）
- **修法不显而易见**（如果 google 或 GPT 一秒解决就不用记）

通过这四条筛选下来才值得占一条。否则记录成本 > 收益。
