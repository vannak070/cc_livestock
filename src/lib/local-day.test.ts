import { describe, it, expect } from 'vitest';
import { localDay } from './local-day';

describe('localDay', () => {
  it('reads a Date at local midnight as that same calendar day, in any server time zone', () => {
    expect(localDay(new Date(2026, 9, 10))).toBe('2026-10-10');
    expect(localDay(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(localDay(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
  it('keeps the day of a date string', () => {
    expect(localDay('2026-10-10')).toBe('2026-10-10');
    expect(localDay('2026-10-10T00:00:00.000Z')).toBe('2026-10-10');
  });
  it('gives nothing for empty or invalid values', () => {
    expect(localDay(null)).toBeUndefined();
    expect(localDay(undefined)).toBeUndefined();
    expect(localDay('soon')).toBeUndefined();
    expect(localDay(new Date('nope'))).toBeUndefined();
  });
});
