/**
 * 测 _auth.js 的 signToken / verifyToken / authFromRequest（HMAC identity token）
 *
 * 防止：identity token forge / expire bypass / Authorization header 解析错误。
 *   一旦 verifyToken 错放一个 forged token，攻击者就能伪装成任何成员
 *   改 profile / 上传冒名照片 / 删别人的 RSVP。
 *
 * Token 格式：`{member_rec_id}|{expiresAtMs}|{sigHex32}`
 *   sig = HMAC-SHA256(secret=TEAM_PASSWORD, payload="${rec_id}|${expiresAt}").slice(0, 32)
 *
 * Design intent（_auth.js 注释）：secret 复用 TEAM_PASSWORD →
 *   admin 改密码时所有已颁发 token 自然失效。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signToken, verifyToken, authFromRequest } from '../api/_auth.js';

describe('signToken / verifyToken round-trip', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'test-secret-key-for-hmac');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('正常 round-trip：signToken → verifyToken 返回原 member_rec_id', () => {
    const token = signToken('rec123abc');
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result.member_rec_id).toBe('rec123abc');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('expiresAt ~24h 后（默认 TTL）', () => {
    const before = Date.now();
    const token = signToken('rec123');
    const after = Date.now();
    const result = verifyToken(token);
    const expected24h = 24 * 60 * 60 * 1000;
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + expected24h);
    expect(result.expiresAt).toBeLessThanOrEqual(after + expected24h);
  });

  it('自定义 TTL', () => {
    const ttl = 60 * 1000;  // 1 分钟
    const before = Date.now();
    const token = signToken('rec123', ttl);
    const result = verifyToken(token);
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + ttl);
  });
});

describe('verifyToken 篡改检测', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'test-secret-key-for-hmac');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('篡改 sig（改任意字符）→ null', () => {
    const token = signToken('rec123abc');
    const parts = token.split('|');
    // 用 'a' 替换 sig 的中间一个字符
    const tamperedSig = parts[2].slice(0, 10) + 'a' + parts[2].slice(11);
    const tampered = `${parts[0]}|${parts[1]}|${tamperedSig}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('篡改 member_rec_id（用别的 ID）→ null（sig 不再匹配 payload）', () => {
    const token = signToken('rec123abc');
    const parts = token.split('|');
    const tampered = `recATTACKER|${parts[1]}|${parts[2]}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('篡改 expiresAt（延长寿命）→ null（sig 不匹配）', () => {
    const token = signToken('rec123abc');
    const parts = token.split('|');
    const futureExpire = String(Date.now() + 365 * 24 * 60 * 60 * 1000); // 一年后
    const tampered = `${parts[0]}|${futureExpire}|${parts[2]}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('两个不同成员的 token 不能互相替换 sig（防 sig 复用）', () => {
    const tokenA = signToken('recAAA');
    const tokenB = signToken('recBBB');
    const partsA = tokenA.split('|');
    const partsB = tokenB.split('|');
    // 用 tokenA 的 sig + tokenB 的 payload
    const swap = `${partsB[0]}|${partsB[1]}|${partsA[2]}`;
    expect(verifyToken(swap)).toBeNull();
  });
});

describe('verifyToken 过期检测', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'test-secret-key-for-hmac');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('已过期 token（负 TTL，过去时间）→ null', () => {
    const token = signToken('rec123abc', -1000);  // 1 秒前过期
    expect(verifyToken(token)).toBeNull();
  });

  it('短 TTL token，等过期后 → null', async () => {
    const token = signToken('rec123abc', 1);  // 1ms TTL
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(verifyToken(token)).toBeNull();
  });

  it('未过期 token → 返回 payload', () => {
    const token = signToken('rec123abc', 60000);  // 1 分钟 TTL
    const result = verifyToken(token);
    expect(result?.member_rec_id).toBe('rec123abc');
  });
});

describe('verifyToken 格式错误处理', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'test-secret-key-for-hmac');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('少于 3 段（少 |）→ null', () => {
    expect(verifyToken('only-one-part')).toBeNull();
    expect(verifyToken('two|parts')).toBeNull();
  });

  it('多于 3 段（多 |）→ null', () => {
    expect(verifyToken('rec123|99999|sig|extra')).toBeNull();
  });

  it('空字符串 → null', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('null / undefined → null', () => {
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });

  it('非 string token（数字 / 对象 / 数组）→ null', () => {
    expect(verifyToken(123)).toBeNull();
    expect(verifyToken({})).toBeNull();
    expect(verifyToken([])).toBeNull();
  });

  it('rec_id 段为空 → null', () => {
    expect(verifyToken('|99999999999|deadbeefdeadbeefdeadbeefdeadbeef')).toBeNull();
  });

  it('expiresAt 段非数字 → null', () => {
    expect(verifyToken('rec123|notanumber|deadbeefdeadbeefdeadbeefdeadbeef')).toBeNull();
  });

  it('sig 长度不对（短）→ null（防 timingSafeEqual length error）', () => {
    // 用真未来时间戳（Date.now() + 1000秒），避免 expiry check 提前 return null
    const futureExp = Date.now() + 1000_000;
    expect(verifyToken(`rec123|${futureExp}|short`)).toBeNull();
  });
});

describe('signToken / verifyToken secret 切换', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'old-secret');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('改 TEAM_PASSWORD 后，老 token 失效（design intent: admin 改密码 invalidate all）', () => {
    const token = signToken('rec123');
    expect(verifyToken(token)).not.toBeNull();

    // admin 改密码
    vi.stubEnv('TEAM_PASSWORD', 'new-secret');
    expect(verifyToken(token)).toBeNull();
  });
});

describe('signToken / verifyToken TEAM_PASSWORD 未配置', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signToken 抛错 "TEAM_PASSWORD 未配置"', () => {
    expect(() => signToken('rec123')).toThrow('TEAM_PASSWORD 未配置');
  });

  it('verifyToken 抛错（当前实现：getSecret throw 不被 catch）', () => {
    // 这是 documenting current behavior：未配置时 verifyToken 在
    // calculate expectSig 时 throw，没被 outer try/catch 接住。
    // 未来若改成 return null 更稳妥，本测试需要 update。
    //
    // 必须用真未来时间戳（避免 expiry check 提前 return null）
    const futureExp = Date.now() + 1000_000;
    const validFormat = `rec123|${futureExp}|deadbeefdeadbeefdeadbeefdeadbeef`;
    expect(() => verifyToken(validFormat)).toThrow('TEAM_PASSWORD 未配置');
  });
});

describe('authFromRequest', () => {
  beforeEach(() => {
    vi.stubEnv('TEAM_PASSWORD', 'test-secret-key-for-hmac');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('正确的 Authorization: Bearer <token> → 返回 payload', () => {
    const token = signToken('rec123abc');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const result = authFromRequest(req);
    expect(result?.member_rec_id).toBe('rec123abc');
  });

  it('Authorization 大写 A 的 header（Node spec 不区分大小写，但具体 framework 可能传不同 key）→ 也能识别', () => {
    const token = signToken('rec123');
    const req = { headers: { Authorization: `Bearer ${token}` } };
    const result = authFromRequest(req);
    expect(result?.member_rec_id).toBe('rec123');
  });

  it('小写 bearer 也能识别（regex /i flag）', () => {
    const token = signToken('rec123');
    const req = { headers: { authorization: `bearer ${token}` } };
    const result = authFromRequest(req);
    expect(result?.member_rec_id).toBe('rec123');
  });

  it('无 Authorization header → null', () => {
    const req = { headers: {} };
    expect(authFromRequest(req)).toBeNull();
  });

  it('Authorization 无 Bearer prefix → null', () => {
    const req = { headers: { authorization: 'just-a-raw-token' } };
    expect(authFromRequest(req)).toBeNull();
  });

  it('Bearer + 后面无 token → null', () => {
    const req = { headers: { authorization: 'Bearer' } };
    expect(authFromRequest(req)).toBeNull();
  });

  it('Bearer + 无效 token data → null', () => {
    const req = { headers: { authorization: 'Bearer not-a-valid-token' } };
    expect(authFromRequest(req)).toBeNull();
  });

  it('Bearer + 过期 token → null', () => {
    const expiredToken = signToken('rec123', -1000);
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    expect(authFromRequest(req)).toBeNull();
  });

  it('Bearer 后两侧空格被 trim', () => {
    const token = signToken('rec123');
    const req = { headers: { authorization: `Bearer    ${token}    ` } };
    const result = authFromRequest(req);
    // _auth.js 用了 .trim() — 空格 token 应该 work
    expect(result?.member_rec_id).toBe('rec123');
  });
});
