import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { MINUTE, overLimit } = await import('./rate-limit');

describe('per-address limit', () => {
  it('allows 60 reads a minute, then refuses until the minute has passed', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 60; i++) expect(overLimit('read:a', 60, t0 + i, MINUTE)).toBe(false);
    expect(overLimit('read:a', 60, t0 + 100, MINUTE)).toBe(true);
    expect(overLimit('read:b', 60, t0 + 100, MINUTE)).toBe(false);
    expect(overLimit('read:a', 60, t0 + MINUTE + 100, MINUTE)).toBe(false);
  });

  it('keeps the forms at 5 an hour by default', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) expect(overLimit('app:x', undefined, t0 + i)).toBe(false);
    expect(overLimit('app:x', undefined, t0 + MINUTE * 30)).toBe(true);
  });
});
