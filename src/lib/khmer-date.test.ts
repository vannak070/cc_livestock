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
