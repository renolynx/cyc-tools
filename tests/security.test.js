/**
 * 测 _security.js 的 verifyTeamPassword。
 * 防止：团队架构页鉴权挂掉（要么全暴露要么全锁死）。
 *
 * verifyAdminPassword (verifyPassword from _password.js) 不在这里测，
 * 因为它依赖 KV 异步读取 —— 测它需要 mock kvGet，单独写在 password.test.js（TODO）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyTeamPassword } from '../api/_security.js';

describe('verifyTeamPassword', () => {
  const ORIGINAL = process.env.TEAM_PASSWORD;

  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'test-team-pwd-123');
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TEAM_PASSWORD;
    else process.env.TEAM_PASSWORD = ORIGINAL;
    vi.unstubAllEnvs();
  });

  it('正确密码应返回 true', () => {
    expect(verifyTeamPassword('test-team-pwd-123')).toBe(true);
  });

  it('错误密码应返回 false', () => {
    expect(verifyTeamPassword('wrong')).toBe(false);
  });

  it('空字符串应返回 false', () => {
    expect(verifyTeamPassword('')).toBe(false);
  });

  it('null / undefined 应返回 false（不能爆 TypeError）', () => {
    expect(verifyTeamPassword(null)).toBe(false);
    expect(verifyTeamPassword(undefined)).toBe(false);
  });

  it('TEAM_PASSWORD 未配置时一律返回 false（不能 fallback 到接受任何输入）', () => {
    vi.stubEnv('TEAM_PASSWORD', '');
    expect(verifyTeamPassword('whatever')).toBe(false);
    expect(verifyTeamPassword('')).toBe(false);
  });

  it('密码大小写敏感', () => {
    expect(verifyTeamPassword('TEST-TEAM-PWD-123')).toBe(false);
    expect(verifyTeamPassword('Test-Team-Pwd-123')).toBe(false);
  });

  it('两侧空格不应自动 trim（精确匹配）', () => {
    expect(verifyTeamPassword(' test-team-pwd-123')).toBe(false);
    expect(verifyTeamPassword('test-team-pwd-123 ')).toBe(false);
  });
});
