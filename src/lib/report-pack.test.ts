import { describe, expect, it } from 'vitest';
import { inPeriod } from './report-pack';

describe('inPeriod', () => {
  const p = { from: '2026-03', to: '2026-05' };
  it('includes the first and last month', () => {
    expect(inPeriod('2026-03-01', p)).toBe(true);
    expect(inPeriod('2026-05-31', p)).toBe(true);
  });
  it('leaves out other months and empty dates', () => {
    expect(inPeriod('2026-02-28', p)).toBe(false);
    expect(inPeriod('2026-06-01', p)).toBe(false);
    expect(inPeriod(undefined, p)).toBe(false);
  });
});
