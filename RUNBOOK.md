# cyc-tools RUNBOOK

> 给未来合作者（或休假回来的自己）的"接手手册"。
>
> 目标：让任何一个**没参与开发**的工程师 / PM 在 30 分钟内能：
> - 理解项目架构和数据流向
> - 找到关键凭证 / 密码 / token 在哪
> - 在出事时不慌（部署炸 / 飞书挂 / 数据丢）

---

## 1. 项目是什么

**cyc.center** = 大理"链岛青年社区"的轻量数字基础设施。
- 公网域名：cyc.center（部分功能 cyc.homes，独立运营）
- 主仓库：[github.com/renolynx/cyc-tools](https://github.com/renolynx/cyc-tools)
- 部署：Vercel
- 数据：飞书 Bitable + Upstash Redis (KV) + Vercel Blob（图片）

**栈**：纯 HTML / CSS / JS，零框架，零 build step。

详细战略 / 设计 / 路线见仓库根 `PRODUCT.md` / `DESIGN.md`，PM 视角看 vault `cyc.center/00 INDEX`。

---

## 2. 关键文件 5 选

如果只能读 5 个文件了解整个项目：

1. **`vercel.json`** —— 路由 / API / cron / 安全头全在这。一切流量入口的总图
2. **`api/_feishu.js`** —— 飞书 API 鉴权 + 字段元数据。所有 Bitable 调用都过这
3. **`api/_kv.js`** —— Upstash 适配 + 缓存失效策略
4. **`api/_password.js`** + **`api/_security.js`** —— 写操作的密码门（`SYNC_PASSWORD` / `TEAM_PASSWORD`）
5. **`styles.css`**（已拆为 `styles/01..09-*.css`）—— 视觉系统的真权威，DESIGN.md 是描述，token 在这里

---

## 3. 环境变量（Vercel Project Settings → Environment Variables）

### 必需 / 不能挂

| 变量 | 用途 | 来源 |
|---|---|---|
| `FEISHU_APP_ID` | 飞书自建应用 App ID（`cli_a...`） | 飞书开放平台 → 我的应用 → CYC 助手 → 凭证 |
| `FEISHU_APP_SECRET` | 飞书 App Secret | 同上（每次 reveal 才能看，建议留个一次性副本） |
| `FEISHU_APP_TOKEN` | 主 Bitable app_token（活动 + 事件流 + 二维码） | `XNAJbaU63aaDUAsTf5icoFU9nFd` |
| `FEISHU_TABLE_ID` | 活动日历 table_id | `tblGB9chI6M3DRvU` |
| `FEISHU_MEMBER_APP_TOKEN` | 成员 Bitable app_token | `PBn3bPOCYa2dBNsRZnXcv2R6nLF` |
| `FEISHU_MEMBER_TABLE_ID` | 成员 table_id | `tblrkweaGBQHmPVx` |
| `FEISHU_RSVP_TABLE_ID` | 报名记录 table_id | 见 Vercel |
| `FEISHU_PHOTOS_TABLE_ID` | 照片归档 table_id | 见 Vercel |
| `FEISHU_LOCATIONS_TABLE_ID` | 据点 table_id | 见 Vercel |
| `SYNC_PASSWORD` | 活动同步 / admin 操作密码 | 自定义 |
| `TEAM_PASSWORD` | 团队架构页密码 | 自定义 |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis | Upstash dashboard |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 同上（兼容旧名） | Upstash dashboard |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob（图片）读写 | Vercel → Storage → Blob |

> 事件流表 (`tbl8SKvRXMMJmChI`) 不需要单独 env var，硬编码在 `api/_events.js`，复用 `FEISHU_APP_TOKEN`（同 Bitable）。

---

## 4. 怎么部署 / 看部署

### 正常部署
- Push 到 `main` → Vercel 自动部署 → 1-2 分钟
- 看部署状态：[vercel.com/renolynxs-projects/cyc-tools](https://vercel.com/renolynxs-projects/cyc-tools)

### 部署炸了
1. Vercel dashboard → Deployments → 点最新失败的那次
2. 看 Build Logs / Runtime Logs
3. 常见原因：
   - 引入新 dep 但忘了 `package.json` 加 → 加上 push
   - Function 超时（默认 10s，特定 endpoint 在 vercel.json 里设过 30/60s）
   - 飞书 API 限流（短时大量同步）

### 紧急回滚
Vercel dashboard → Deployments → 找上次成功的 → "Promote to production"
（保留新 deployment，只改 alias，不丢 commit）

---

## 5. admin 入口和密码

| URL | 鉴权 | 干啥 |
|---|---|---|
| `/admin` | 无（只是导航 tile） | admin 总入口 |
| `/admin/instrumentation` | `SYNC_PASSWORD` | 看埋点数据 |
| `/community/admin` | `SYNC_PASSWORD` | 成员名单管理 SPA |
| `/team` | `TEAM_PASSWORD` | 团队架构 |

**改密码**：Vercel → Settings → Environment Variables → 改 `SYNC_PASSWORD` 或 `TEAM_PASSWORD` → Redeploy。

---

## 6. 数据存哪 / 改哪 / 备份

### 飞书 Bitable（业务数据）
- 主 Bitable：`https://lqmkb0ekbll.feishu.cn/base/XNAJbaU63aaDUAsTf5icoFU9nFd`
  - 表：📅活动日历 / 二维码 / 事件流 / 数据表
- 成员 Bitable：`https://lqmkb0ekbll.feishu.cn/base/PBn3bPOCYa2dBNsRZnXcv2R6nLF`
  - 表：人员表（含报名 / 照片 / 据点子表）

**备份**：`/api/admin/snapshot`（POST，密码门）—— 把所有表导出成 JSON 写到 KV。建议每周 cron 跑一次。

### Upstash Redis (KV)
- Console：[console.upstash.com](https://console.upstash.com)
- 用途：API 响应缓存（飞书数据，TTL 5-10 分钟）+ session rate limit + snapshot 备份
- **缓存键命名**：见 `_kv.js` 头部注释
- **手动清缓存**：所有写操作 endpoint 都自动 invalidate，但兜底可以手动改 `?refresh=1` query

### Vercel Blob（图片）
- Console：Vercel project → Storage → Blob
- 用途：海报上传 / 照片归档
- **不会自动清理**，业务删除会留 orphan blob（暂时不管，规模小）

---

## 7. 常见 admin 任务速查

| 任务 | 怎么做 |
|---|---|
| 改 SYNC_PASSWORD | Vercel env vars 改 + Redeploy |
| 强制刷新某成员页缓存 | URL 加 `?refresh=1` |
| 看某活动的 RSVP 列表 | `/events/:record_id` 滚到底 |
| backfill 活动嘉宾到成员表 | `/community/admin` → 工具区 → backfill |
| 看本月埋点 | `/admin/instrumentation` → 30 天 |
| 创建新 Bitable 表 | 直接飞书界面建 + 把 table_id 加进 Vercel env vars + 改对应 helper |
| 一行修复 schema 漂移 | `api/diagnose.js` 接口（admin 排查字段名变动） |

---

## 8. 紧急情况手册

### 网站打不开（500）
1. 看 Vercel Runtime Logs 找 root cause
2. 8 成是飞书 API 挂了 / token 过期 → 飞书凭证页 reveal & verify
3. 2 成是 Upstash 挂了 → Upstash console 看 status
4. 都不是 → 回滚到上次成功 deploy

### 飞书 App Token 过期 / 应用被封
1. 飞书开放平台 → 应用 → Re-issue Secret
2. Vercel 改 `FEISHU_APP_SECRET` → Redeploy
3. 通常无停机

### 数据被误删（飞书表里某条记录）
1. 飞书表自己有"回收站"（左下角）—— 30 天内可恢复
2. 超过 30 天：用最近的 `/api/admin/snapshot` 备份恢复（手动）
3. 没备份：**数据真没了**。这就是为啥 snapshot 必须定期跑

### 大流量（被刷 / 被爬）
1. Vercel free tier 限制：100 GB/月、100h function 执行
2. 紧急对策：vercel.json 加 IP rate limit headers 或临时关停 cron
3. 长期：上 Vercel Pro / 加 Cloudflare

---

## 9. 联系人 / Owner

- **GitHub**：[@renolynx](https://github.com/renolynx)
- **飞书 organization**：链岛青年社区
- **Vercel team**：renolynxs-projects
- **域名**：cyc.center（DNS 托管位置 TODO 写下来）

---

## 10. 别动这些（除非你知道你在做什么）

- `api/_security.js` —— 密码哈希逻辑。改错了密码门全废
- `api/_identity.js` —— 身份匹配核心。改错了 RSVP 关联会乱
- `vercel.json` 的 `headers` 区段 —— security 头不要乱删
- `package.json` 的 `type: module` —— 改了所有 import 都炸
- 飞书表的"主键"字段名 —— 重命名整个 KV 缓存就废

---

## 11. 该读的下一份文档

- **战略** → `PRODUCT.md`
- **视觉** → `DESIGN.md` + `styles/01-tokens.css`
- **执行计划** → `PLAN-USING-SKILLS.md`
- **首页设计依据** → `homepage-design.md`
- **工程踩坑** → `GOTCHAS.md`
- **Vault 索引**（PM 视角整套）→ `2025 obsidian/2025 restart/cyc.center/00 INDEX.md`
