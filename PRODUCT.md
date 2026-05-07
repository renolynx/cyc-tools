# Product

## Register

product

> 默认 register 是 product（/me、/tools、/team、/admin、/api、/generator、/community、/community/:id、/community/admin 等占据主体）。
> Brand register 在以下路由 override：`/`、`/about`、`/events`、`/events/:id`、`/rooms`、`/community/memories`、所有用于对外宣发或单独成篇的活动详情页。
> 切换原则：用户在这里是来"用东西"还是"被打动"？前者 product，后者 brand。
>
> **brand register 的视觉表达**（dayrise-os v4，由设计层承接）：
> - hero h1 用 display serif（Source Serif 4 Light，48-56px）
> - section gap 加大到 80-96px
> - section eyebrow pattern（小灰字 ALL CAPS）
> - 一个橙色 pill CTA 作为唯一信号
>
> **product register 的视觉表达**（保持 v3 quiet 基调）：
> - system grotesque（Inter / PingFang）
> - section gap 32-64px
> - 紧凑 density
> - 按 layer 区分（Aurora 绿 CTA / Daybook 橙 temporal）
>
> 详见 [dayrise-os SKILL.md](.claude/skills/dayrise-os/SKILL.md) "brand register vs product register" 章节。

## Users

**主要用户**：大理本地的创意/独立从业者（手作人、设计师、咖啡店主、民宿主理人、独立项目创业者），以及短期或长期居住大理的数字游民/远程工作者。

**次要用户**：慕名而来的短期访客 —— 听说"链岛社区"探访、想参加活动、想认识在地人。

**用户与产品的关系**：
- **创意/独立从业者**：把 cyc.center 当成**社区基础设施**。来组织活动、约饭、找团队、看本周谁在做什么。每周打开 3-5 次。是 product 主体的服务对象。
- **数字游民**：把 cyc.center 当成**融入入口**。来看下周有什么活动可以蹭、谁能聊聊。每月打开几次。需要被欢迎，但不需要被推销。
- **短期访客**：把 cyc.center 当成**社区的脸**。来快速判断"链岛社区"是不是他要找的那种群落。可能只打开一次。第一印象决定他来不来。

三类人共享一种气质：**已经厌倦了被设计成用户的人**。他们对"用户体验"敏感，对"被运营"反感。设计要为他们的尊严服务。

## Product Purpose

cyc.center 是大理"链岛社区"的**轻量公共操作系统**。

具体做什么：
- **活动通告生成 / 活动详情页**：把发生在大理这片土地上的一场场聚会、工作坊、市集，变成可以分享、可以归档、可以被搜索引擎索引的公开 URL
- **社区工具集合**：约饭、团队架构、周历、个人主页 —— 一些社区高频的轻量工具
- **个人主页 / 成员档案**：让每个成员能 represent 自己

它**不是**：CRM、活动管理 SaaS、票务平台、Discord 替代品。它是社区已有日常的**数字化镜像**，不是想替代或重塑社群关系。

成功的样子：当社区里的人想发一条活动通告，第一反应是"用 cyc 生成一下"；外人在微信群看到 `cyc.center/events/xxx` 链接点进去，会想"有意思，下次想去"。

## Brand Personality

**3 词**：实验 · playful · 有点怪。

**翻译成调性**：
- 不是公司，更像一个独立 zine 编辑部
- 文案不"AI 化"也不"产品经理化"，写得像人讲话
- 偶尔出现让人会心一笑的细节（彩蛋、不正经命名、突如其来的诚恳）
- 但**克制** —— 怪是底色，不是高音。整体表面平静，性格藏在细节里
- 有作者气质 —— 看得出"这是某个具体的人做的"，不是匿名团队

**Reference 锚点**：
- **Are.na** —— internet-native 的克制、为认真创作的人服务、不商业化、靠内容沉淀气质
- **Linear** —— 工艺感、键盘流、速度即奢侈、暗色优雅但不冷
- **小宇宙** —— 中文语境下少有的人味、gentle UI、对创作者温柔
- **ElevenLabs** —— editorial restraint, type-as-signature, "whisper where competitors shout"（轻量衬线 + 蛋壳暖白底，以排版节制颠覆 SaaS bold grotesque 惯例）

四者交集 = **为创作型用户做的、有人味的、克制但有 type signature 的产品**。

**用户应该感觉到**："这个工具站好讲究、好实用、好优雅！" —— 三层堆叠：
1. **讲究** = 看得出每个细节被想过，不糊弄
2. **实用** = 真的解决问题，不只装样子
3. **优雅** = 不喧哗、不媚俗、克制中有美

## Anti-references

cyc.center 绝不能像：

- **极客 / 工程师审美**：黑底绿字、象牙塔字体、代码背景、过重的 monospace、IDE 配色挪用、"Hacker News 风"。这种审美对用户群是排他的，传达的是"这里只欢迎技术人"。
- 隐含一票否决：任何让大理本地咖啡店主、手作人觉得"这不是给我做的"的视觉语言
- 同时避免（虽未明确勾选）：政府机构网站的拘谨、小程序拼凑感的廉价、千篇一律 SaaS 的奥德状插画 + 紫色渐变 + 圆头无表情

## Design Principles

1. **讲究优先于花哨**
   每个 detail 都是被想过的，但不秀肌肉。"看不出花哨" > "明显花哨" > "明显朴素"。最高级的克制是看不出克制。

2. **有性格但不喊**
   playful、实验性、有点怪 —— 这是底色。不是用大字体、巨型 emoji、亮色 hero 喊出来的。性格藏在文案里、藏在 empty state 的句子里、藏在意料之外的小动效里。

3. **服务于人，不臣服于规则**
   WCAG AAA 是无障碍底线，但不是审美天花板。当 7:1 对比度跟"温柔感"打架时，找第三条路（更精确的色彩、更大的字号、更慢的动效），别用"合规"为审美短路开脱。

4. **大理是锚点，不是装饰**
   "在地感"不靠民俗符号、苍山洱海照片、彩纸窗花。靠 specificity —— 真的活动、真的人、真的本地名词、真的当下时令。"具体"比"在地"更重要。

5. **慢，但每一步都准**
   不需要让用户停留更久。让他每次来都觉得"找到了"。一秒钟解决，比五分钟逛舒服更高级。

6. **Type as character**（v4 dayrise-os 引入）
   字体本身是品牌的一部分，不是中性容器。在 brand register（`/`、`/events`、`/about` 等对外面），用一个轻量衬线（Source Serif 4 Light）做 hero h1，跟正文 Inter / PingFang 形成"严肃文献 + 现代日常"对话 —— 这是"独立 zine 编辑部"气质的视觉签名。

   在 product register（`/me`、`/admin`、工具），保持 system-grade 中性字体，让工具不抢戏。

   字体的"signature"和"克制"是同一件事的两面：在该 signature 的地方建立 signature，在不该的地方退回中性。

## Accessibility & Inclusion

**WCAG AAA 严要求**作为目标，但允许在两类场景下降到 AA 让步：
- 装饰性元素（背景 blob、装饰文字）允许 4.5:1
- 短暂的 ambient 元素（pulsing dot、subtle hover halo）允许 3:1

**强制底线**：
- 主体正文 7:1 对比度
- 所有交互目标 ≥ 44×44px
- 完整 `prefers-reduced-motion` 支持
- 键盘导航全覆盖
- 图片有替代文本，icon 有 `aria-label`

**重点用户群考虑**：
- 中老年创意从业者（大理本地有不少 50+ 的手作人/独立项目主理人）：字号底线 16px，行高 ≥ 1.6
- 视觉敏感用户：避免高频闪烁、自动播放视频、长时间动画循环
- 中英文混排：中文字号需比英文略大 2-4%（`PingFang SC` 视觉重量比 `Inter` 略轻）

## 与 dayrise-os 的关系（v4，2026-05-07）

cyc.center 使用 [dayrise-os](.claude/skills/dayrise-os/SKILL.md) 设计系统（前身 daybreak-os v3 quiet，2026-05-07 升级 v4 dayrise）。本文件提供**战略上下文**（who/what/why），dayrise-os 提供**视觉规范**（how it looks）。两者关系：

**Layer 维度**（色 / 装饰 / pattern）：
- dayrise-os 的 **Atlas 层** ↔ 编辑/对外 surface（hero、活动、宣发）
- dayrise-os 的 **Aurora 层** ↔ admin chrome（settings、`/admin`、command palette、dialogs）
- dayrise-os 的 **Daybook 层** ↔ 亲密 surface（`/me`、journal、profile、`/community`）

**Register 维度**（字层级密度 / 节奏）—— v4 引入：
- **brand register**（`/`、`/about`、`/events`、`/events/:id`、`/rooms`、`/community/memories`）→ display serif 可用 + 大 spacing
- **product register**（其余路由）→ system grotesque + 紧 density

**两个维度垂直，不互相覆盖**。例：
- `/events/:id` = Atlas + brand → display serif h1 + 大 gap + orange CTA + 玻璃卡
- `/community/admin` = Aurora + product → 2px 绿线 + 紧 density + green CTA + mono numerals
- `/me/journal` = Daybook + product → halo + mascot + warm muted body
- `/community/memories` = Daybook + brand → halo + 大 gap（不上 display serif，主调温柔）

**v4 历史档案**：
- 原 daybreak-os v2（黑白 + 珊瑚 accent）已于 2026-05-02 撤回（commit `c8b8fcf`）
- v3 quiet（沙底 + 三 blob unified base）保留为 v4 的 base
- v4 dayrise（2026-05-07）在 v3 上 additive 加 display serif / mono stamp / brand register flag
- 旧 daybreak-os v3 SKILL 在 `.claude/skills/daybreak-os-archived/` 仅作历史参考
