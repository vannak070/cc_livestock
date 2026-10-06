import { describe, expect, it } from 'vitest';
import { khmerLongDate, khmerShortDay } from './khmer-date';

describe('khmer dates', () => {
  it('writes a day with Khmer weekday and month names', () => {
    expect(khmerShortDay('2026-10-02')).toBe('សុក្រ 2 តុលា');
    expect(khmerShortDay('2026-01-04')).toBe('អាទិត្យ 4 មករា');
  });
  it('leaves a value it cannot read as it is', () => {
    expect(khmerShortDay('not a day')).toBe('not a day');
  });
  it('writes a long date', () => {
    expect(khmerLongDate(new Date(2026, 9, 6))).toBe('ថ្ងៃអង្គារ 6 តុលា 2026');
  });
});

describe('month and day labels', () => {
  it('names months in either language', async () => {
    const { monthLabel, shownDay } = await import('./khmer-date');
    expect(monthLabel('2026-10')).toBe('Oct 2026');
    expect(monthLabel('2026-10', 'km')).toBe('តុលា 2026');
    expect(monthLabel('bad')).toBe('bad');
    expect(shownDay('2026-10-02T00:00:00Z', 'km')).toBe('2 តុលា 2026');
    expect(shownDay('2026-01-15T07:00:00Z')).toBe('2026-01-15');
    expect(shownDay(null)).toBe('—');
  });
});
