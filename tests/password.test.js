/**
 * 测 _password.js 的 verifyPassword（= verifyAdminPassword 别名）
 *
 * 防止：admin 鉴权（add-activity / community-write 等）失效或绕过。
 *
 * verifyPassword 行为：
 *   1. 输入空 → false
 *   2. 优先读 KV（key='sync_password'），KV 无值 fallback 到 process.env.SYNC_PASSWORD
 *   3. 都没有 → false（fail-safe，不接受任何输入）
 *   4. 严格 ===（大小写 + 空格 sensitive）
 *
 * 已知行为（documenting，非阻塞）：
 *   - KV 故障（kvGet reject）时 verifyPassword 会 reject 而不是 fallback
 *     建议：未来给 getCurrentPassword 加 try/catch fallback 到 env
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 必须在 import verifyPassword 之前 mock，让其内部的 kvGet 引用到 mock
vi.mock('../api/_kv.js', () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  isKvConfigured: vi.fn(),
}));

import { verifyPassword, getCurrentPassword } from '../api/_password.js';
import { kvGet, isKvConfigured } from '../api/_kv.js';

describe('verifyPassword (admin SYNC_PASSWORD)', () => {
  const ORIGINAL = process.env.SYNC_PASSWORD;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SYNC_PASSWORD;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SYNC_PASSWORD;
    else process.env.SYNC_PASSWORD = ORIGINAL;
  });

  // ── KV 路径（KV 有值时优先）──────────────────

  it('KV 配置 + KV 有值 + 输入正确 → true', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('kv-pwd');
    expect(await verifyPassword('kv-pwd')).toBe(true);
  });

  it('KV 配置 + KV 有值 + 输入错误 → false', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('kv-pwd');
    expect(await verifyPassword('wrong')).toBe(false);
  });

  it('KV 有值时即便 env 也设了，仍以 KV 为准', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('kv-pwd');
    process.env.SYNC_PASSWORD = 'env-pwd';
    expect(await verifyPassword('kv-pwd')).toBe(true);
    expect(await verifyPassword('env-pwd')).toBe(false);
  });

  // ── env fallback 路径（KV 无值时）────────────

  it('KV 配置但 KV 无值 + env 有 → 用 env', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue(null);
    process.env.SYNC_PASSWORD = 'env-pwd';
    expect(await verifyPassword('env-pwd')).toBe(true);
  });

  it('KV 未配置 + env 有 → 用 env', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(false);
    process.env.SYNC_PASSWORD = 'env-pwd';
    expect(await verifyPassword('env-pwd')).toBe(true);
  });

  // ── fail-safe：都没有 → false ────────────────

  it('KV 未配置 + env 无 → false', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(false);
    expect(await verifyPassword('whatever')).toBe(false);
  });

  it('KV 配置 + KV 无值 + env 无 → false', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue(null);
    expect(await verifyPassword('whatever')).toBe(false);
  });

  it('KV 配置 + KV 无值 + env 空字符串 → false', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue(null);
    process.env.SYNC_PASSWORD = '';
    expect(await verifyPassword('')).toBe(false);
    expect(await verifyPassword('anything')).toBe(false);
  });

  // ── 输入边界 ────────────────────────────────

  it('空字符串输入 → false（即便 KV 有值）', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('kv-pwd');
    expect(await verifyPassword('')).toBe(false);
  });

  it('null 输入 → false', async () => {
    expect(await verifyPassword(null)).toBe(false);
  });

  it('undefined 输入 → false', async () => {
    expect(await verifyPassword(undefined)).toBe(false);
  });

  // ── 严格匹配（大小写 / 空格 sensitive）──────

  it('密码大小写敏感', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('Pwd-ABC-123');
    expect(await verifyPassword('PWD-ABC-123')).toBe(false);
    expect(await verifyPassword('pwd-abc-123')).toBe(false);
    expect(await verifyPassword('Pwd-ABC-123')).toBe(true);
  });

  it('两侧空格不自动 trim（精确匹配）', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('pwd');
    expect(await verifyPassword(' pwd')).toBe(false);
    expect(await verifyPassword('pwd ')).toBe(false);
    expect(await verifyPassword(' pwd ')).toBe(false);
  });

  // ── KV 故障行为（documenting current behavior）─

  it('KV 故障（kvGet reject）→ verifyPassword reject（不 fallback 到 env）', async () => {
    // 当前实现：getCurrentPassword 没有 try/catch，KV 故障 → 异常传播
    // 这是已知行为。未来若改 fallback 到 env，本测试需要 update。
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockRejectedValue(new Error('KV connection lost'));
    process.env.SYNC_PASSWORD = 'env-pwd';
    await expect(verifyPassword('env-pwd')).rejects.toThrow('KV connection lost');
  });
});

describe('getCurrentPassword (内部 helper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SYNC_PASSWORD;
  });

  it('KV 优先：返回 KV 值', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue('kv-pwd');
    expect(await getCurrentPassword()).toBe('kv-pwd');
  });

  it('KV 无值 fallback 到 env', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(true);
    vi.mocked(kvGet).mockResolvedValue(null);
    process.env.SYNC_PASSWORD = 'env-pwd';
    expect(await getCurrentPassword()).toBe('env-pwd');
  });

  it('KV 未配置 + 无 env → null', async () => {
    vi.mocked(isKvConfigured).mockReturnValue(false);
    expect(await getCurrentPassword()).toBeNull();
  });
});
