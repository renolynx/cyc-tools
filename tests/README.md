# tests/

> 防御型测试。覆盖率不是目标，**防止最痛 regression** 才是。

## 跑测试

第一次（装 vitest）：
```bash
npm install
```

每次跑：
```bash
npm test          # 一次性
npm run test:watch  # 改文件自动重跑
```

Vercel 部署不会自动跑测试 —— 这是有意的（小项目阶段不要让测试卡部署）。
push 前自己 `npm test` 一下就够。

## 覆盖什么

挑了 5 个"挂了影响最大、出 bug 最难调"的 helper 测：

| 测试文件 | 防什么 regression |
|---|---|
| `security.test.js` | TEAM_PASSWORD 鉴权逻辑 — 挂了团队架构页要么全暴露要么全锁死 |
| `events-known.test.js` | KNOWN_EVENTS 白名单 — 改名时不删旧名，否则历史数据查不到 |
| `kv-invalidate.test.js` | 缓存失效 scope 配置 — 写操作后该清的 key 没清 = 用户看到旧数据 = 信任崩 |

## 没覆盖什么（已知 gap）

- 飞书 API 调用：需要 mock `fetch`，工程量大于收益。生产用的是 health.js 监控（每小时 ping 一次）
- 整个 endpoint HTTP 行为：vitest 不带 server，要 mock req/res。考虑过 Supertest 但又一个 dep
- 前端 cyc-track.js：浏览器 API（sendBeacon, localStorage），需要 jsdom 环境。当前价值低
- _identity.js 的复杂匹配逻辑：值得测但当前迭代快，先稳定后补

## 加新测试的判断

写 / 不写 决策树：

1. 这是**外部 API 的反直觉 wrapper** 吗？→ 写 mock 测
2. 这是**纯函数 / 数据 transform** 吗？→ 写
3. 这是**身份/权限/缓存失效**的关键路径吗？→ 写
4. 上述都不是？→ 别写，省时间

## 维护规则

- 测试文件命名：`<被测模块>.test.js`，扁平放在 tests/ 下
- 不引入 mocking 库，用 vitest 自带 `vi.mock` / `vi.spyOn` / `vi.stubEnv`
- 一个 `describe()` 块对应被测模块；多个 `it()` 对应不同情景
- 中文 describe/it 描述 OK，跟项目语言一致
