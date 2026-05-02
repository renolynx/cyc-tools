/**
 * 测 _events.js 的 KNOWN_EVENTS 白名单。
 * 防止：未来重命名事件时漏清旧名，导致历史数据查不到 + 新数据被错误归类。
 *
 * 任何对 KNOWN_EVENTS 的修改都应让这里某个测试要么过、要么改。
 * 改 → 提醒 reviewer "这是有意的事件重命名，记得 backfill 历史数据"。
 */

import { describe, it, expect } from 'vitest';
import { KNOWN_EVENTS } from '../api/_events.js';

describe('KNOWN_EVENTS', () => {
  it('应是 Set 或类似容器（有 .has 方法）', () => {
    expect(typeof KNOWN_EVENTS.has).toBe('function');
  });

  it('包含核心 page-level 事件', () => {
    expect(KNOWN_EVENTS.has('page_view')).toBe(true);
    expect(KNOWN_EVENTS.has('event_detail_view')).toBe(true);
    expect(KNOWN_EVENTS.has('community_view')).toBe(true);
  });

  it('包含访客引导事件（visitor strip / hero / CTA）', () => {
    expect(KNOWN_EVENTS.has('visitor_strip_click')).toBe(true);
    expect(KNOWN_EVENTS.has('cta_create_event')).toBe(true);
    expect(KNOWN_EVENTS.has('hero_path_a_click')).toBe(true);
    expect(KNOWN_EVENTS.has('hero_path_b_click')).toBe(true);
  });

  it('包含活动卡 / 活动详情交互事件', () => {
    expect(KNOWN_EVENTS.has('event_card_click')).toBe(true);
    expect(KNOWN_EVENTS.has('event_card_avatar_click')).toBe(true);
    expect(KNOWN_EVENTS.has('rsvp_click')).toBe(true);
    expect(KNOWN_EVENTS.has('open_pill_seen')).toBe(true);
    expect(KNOWN_EVENTS.has('share_prompt_seen')).toBe(true);
  });

  it('包含 admin 自跟踪事件', () => {
    expect(KNOWN_EVENTS.has('admin_dashboard_view')).toBe(true);
    expect(KNOWN_EVENTS.has('instrumentation_view')).toBe(true);
  });

  it('包含 community 相关事件', () => {
    expect(KNOWN_EVENTS.has('community_admin_click')).toBe(true);
    expect(KNOWN_EVENTS.has('profile_view')).toBe(true);
  });

  it('未注册事件名应被拒绝（防脏数据）', () => {
    expect(KNOWN_EVENTS.has('random_event_name')).toBe(false);
    expect(KNOWN_EVENTS.has('')).toBe(false);
    expect(KNOWN_EVENTS.has('Page_View')).toBe(false);  // 大小写敏感
    expect(KNOWN_EVENTS.has('page-view')).toBe(false);  // 命名风格 snake_case
  });

  it('数量在合理范围（防止意外大批量增删）', () => {
    // 当前应该 ~16 个。如果突然变成 5 或 50，几乎肯定是 bug。
    expect(KNOWN_EVENTS.size).toBeGreaterThan(10);
    expect(KNOWN_EVENTS.size).toBeLessThan(40);
  });
});
