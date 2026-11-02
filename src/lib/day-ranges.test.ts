import { describe, expect, it } from 'vitest';
import { dayRangesLabel, groupConsecutiveDays } from './day-ranges';

describe('groupConsecutiveDays', () => {
  it('joins consecutive days, including across a month end', () => {
    expect(groupConsecutiveDays(['2026-10-30', '2026-10-31', '2026-11-01'])).toEqual([['2026-10-30', '2026-10-31', '2026-11-01']]);
  });
  it('splits at gaps and sorts, ignoring repeats', () => {
    expect(groupConsecutiveDays(['2026-10-12', '2026-10-07', '2026-10-08', '2026-10-08'])).toEqual([['2026-10-07', '2026-10-08'], ['2026-10-12']]);
  });
  it('handles an empty list', () => {
    expect(groupConsecutiveDays([])).toEqual([]);
  });
});

describe('dayRangesLabel', () => {
  const label = (d: string) => d.slice(5);
  it('writes a run as first – last and keeps lone days', () => {
    expect(dayRangesLabel(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-13'], label)).toBe('10-07 – 10-09, 10-13');
  });
  it('writes a single day as is', () => {
    expect(dayRangesLabel(['2026-10-07'], label)).toBe('10-07');
  });
});
