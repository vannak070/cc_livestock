import { describe, expect, it } from 'vitest';
import { guardStale, snapshotAgeMinutes } from './stale';
import type { PublicSnapshot } from './types';

const snap = (builtAt: string): PublicSnapshot => ({
  version: 1, builtAt, summary: { memberFarms: '5+', provinces: 2, cattleRaised: '100+', feedRecordedTodayPct: null },
  farms: [{ slug: 'a', hasCattleAvailable: true } as never], cattle: [{ listingId: 'l-1', farmSlug: 'a' } as never], news: [],
});
const now = Date.parse('2026-10-26T12:00:00Z');

describe('stale snapshot guard', () => {
  it('keeps a fresh snapshot as it is', () => {
    const s = guardStale(snap('2026-10-26T11:00:00Z'), now, 48);
    expect(s.cattle).toHaveLength(1);
    expect(s.stale).toBeFalsy();
  });
  it('hides cattle availability once the snapshot is older than the limit', () => {
    const s = guardStale(snap('2026-10-19T10:00:00Z'), now, 48);
    expect(s.stale).toBe(true);
    expect(s.cattle).toEqual([]);
    expect(s.farms[0].hasCattleAvailable).toBe(false);
  });
  it('treats a snapshot with no date (an empty site) as not stale', () => {
    expect(guardStale(snap(''), now, 48).stale).toBeFalsy();
    expect(snapshotAgeMinutes({ builtAt: '' }, now)).toBeNull();
  });
  it('counts the age in minutes', () => {
    expect(snapshotAgeMinutes({ builtAt: '2026-10-26T11:30:00Z' }, now)).toBe(30);
  });
});
