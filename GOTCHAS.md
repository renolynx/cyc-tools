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
