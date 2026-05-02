/**
 * 测 _kv.js 的 invalidate 缓存失效逻辑。
 * 防止：写操作后该清的 key 没清 → 用户看到旧数据 → 信任崩。
 *
 * 测试策略：
 *   - mock fetch（KV 通过 REST API 通信，所有调用都是 fetch）
 *   - stubEnv 假装 KV 已配置
 *   - 调 invalidate，断言哪些 key 被请求过 DEL
 *
 * 如果 SCOPES 配置改了（加新 cache key、换 scope 行为），这里要更新。
 * 这是一种"快照测试" —— 故意精确，让重构时强制 reviewer 确认 scope 变化。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 让 _kv.js import 时认为 KV 已配置
vi.stubEnv('KV_REST_API_URL', 'https://fake-kv.upstash.io');
vi.stubEnv('KV_REST_API_TOKEN', 'fake-token');

// ⚠️ stubEnv 必须在 import 前；用 dynamic import 确保
const { invalidate } = await import('../api/_kv.js');

describe('invalidate', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({ result: 1 }),
    }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /** 提取所有 fetch 请求的 URL（解码后），便于断言哪些 key 被清 */
  function getDeletedKeys() {
    return fetchSpy.mock.calls
      .map((call) => {
        const url = call[0];
        const match = String(url).match(/\/del\/(.+)$/);
        return match ? decodeURIComponent(match[1]) : null;
      })
      .filter(Boolean);
  }

  it('未知 scope 应 warn 但不抛 + 不发请求', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await invalidate('does_not_exist');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('activity scope 应清 event:<id> + events:upcoming + sitemap + members 列表', async () => {
    await invalidate('activity', 'recXYZ123');
    const keys = getDeletedKeys();

    expect(keys).toContain('event:recXYZ123');
    expect(keys).toContain('events:upcoming');
    expect(keys).toContain('sitemap:acts');
    expect(keys).toContain('members:大理');
    expect(keys).toContain('members:上海');
  });

  it('member scope 应清 member:<id> + ta 的 RSVP cache + members 列表', async () => {
    await invalidate('member', 'recABC456');
    const keys = getDeletedKeys();

    expect(keys).toContain('member:recABC456');
    expect(keys).toContain('rsvp:member:recABC456');
    expect(keys).toContain('members:大理');
    expect(keys).toContain('members:上海');
    expect(keys).toContain('members:public_list');
  });

  it('rsvp scope 应清 rsvp:all + rsvp:activity:<aid> + rsvp:member:<mid>', async () => {
    await invalidate('rsvp', 'recAct1', 'recMem1');
    const keys = getDeletedKeys();

    expect(keys).toContain('rsvp:all');
    expect(keys).toContain('rsvp:activity:recAct1');
    expect(keys).toContain('rsvp:member:recMem1');
    expect(keys).toContain('member_activity_cities');
  });

  it('rsvp scope 缺 activityId / memberId 时不应在 keys 里出现 null/undefined', async () => {
    await invalidate('rsvp', null, 'recMem2');
    const keys = getDeletedKeys();

    expect(keys).not.toContain('rsvp:activity:null');
    expect(keys).not.toContain('rsvp:activity:undefined');
    expect(keys).toContain('rsvp:member:recMem2');
  });

  it('all scope（admin clear-cache 兜底）应清所有共享 cache', async () => {
    await invalidate('all');
    const keys = getDeletedKeys();

    expect(keys).toContain('members:大理');
    expect(keys).toContain('members:上海');
    expect(keys).toContain('members:public_list');
    expect(keys).toContain('rsvp:all');
    expect(keys).toContain('photos:public');
    expect(keys).toContain('member_activity_cities');
  });

  it('photo scope 应清照片相关，但 NOT photo_quota（admin 长期额度）', async () => {
    await invalidate('photo', 'recMem3');
    const keys = getDeletedKeys();

    expect(keys).toContain('photos:public');
    expect(keys).toContain('photos:member:recMem3');
    expect(keys).toContain('photo_count:recMem3');
    // 关键：quota 不应被清，否则管理员设的额度会丢
    expect(keys).not.toContain('photo_quota:recMem3');
  });

  it('fetch 失败应 silent ignore（缓存失效是 best-effort，不应阻塞主流程）', async () => {
    fetchSpy.mockRestore();
    fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    // 不应抛
    await expect(invalidate('all')).resolves.not.toThrow();
  });
});
