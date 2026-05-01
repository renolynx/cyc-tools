/**
 * 鉴权统一入口 — 把项目里三套验证方式聚到一处，方便看"谁能做什么"
 *
 * 三套并存（设计如此，不要合）：
 *
 *   ┌───────────────────────────┬───────────────────┬─────────────────────────────┐
 *   │ 凭据                       │ 用在哪              │ 角色含义                      │
 *   ├───────────────────────────┼───────────────────┼─────────────────────────────┤
 *   │ SYNC_PASSWORD             │ /api/add-activity   │ "活动同步密码"                 │
 *   │  (verifyAdminPassword)    │ /api/community-write│  社区运营 admin（可以改成员/活动/RSVP）│
 *   │                           │ change-password     │                              │
 *   ├───────────────────────────┼───────────────────┼─────────────────────────────┤
 *   │ TEAM_PASSWORD             │ /api/team-auth      │ "团队架构密码"                 │
 *   │  (verifyTeamPassword)     │ /api/admin/rsvp-rebind│ 一次性数据修复 / 团队架构编辑     │
 *   ├───────────────────────────┼───────────────────┼─────────────────────────────┤
 *   │ HMAC identity token (24h) │ /api/photo-upload   │ "成员本人"                    │
 *   │  (verifyIdentityToken)    │ /api/avatar-upload  │  /me/timeline 个人资料/照片操作 │
 *   │                           │ /api/photos (写)    │  写入限于 token 持有者本人      │
 *   └───────────────────────────┴───────────────────┴─────────────────────────────┘
 *
 * Token 颁发流程见 _auth.js（identity-verify 末 4 位 → signIdentityToken → 客户端存）
 *
 * 加新 endpoint 时：先想"该 endpoint 是谁的活儿"
 *   - admin 写社群成员 / 活动 → verifyAdminPassword
 *   - 一次性数据修复 / 改架构 → verifyTeamPassword
 *   - 用户改自己的资料/照片  → verifyIdentityToken（前端带 Bearer token）
 *
 * 不要新增第 4 套。如果业务真需要更细粒度，扩 identity token 的 claims（加 role）
 * 而不是发明新密码。
 */

import { verifyPassword as _verifyAdminPassword } from './_password.js';
import { authFromRequest as _authFromRequest, verifyToken, signToken } from './_auth.js';

/** Admin (SYNC_PASSWORD) — 用于 add-activity / community-write 等 admin 写操作 */
export const verifyAdminPassword = _verifyAdminPassword;

/** Team (TEAM_PASSWORD) — 用于 team-auth / admin/rsvp-rebind 等架构 / 一次性修复 */
export function verifyTeamPassword(input) {
  if (!input) return false;
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) return false;
  return input === expected;
}

/** 从 Bearer header 验 identity token；通过返回 { member_rec_id, expiresAt } */
export const verifyIdentityToken = _authFromRequest;

/** 同 _auth.signToken；只在 identity-verify 颁发 token 时用 */
export const signIdentityToken = signToken;

/** 直接验明文 token（罕见场景，比如 cron 或测试），通常不需要 */
export { verifyToken as verifyIdentityTokenRaw };
