import { describe, expect, it } from 'vitest';
import { capacityLevels, capacityStep, nearLimit } from './capacity-alerts';

const cows = (farm: string, n: number) => Array.from({ length: n }, () => ({ location: farm }));

describe('capacityStep', () => {
  it('reports the highest of 80, 90 and 100 reached, exactly at the edge', () => {
    expect(capacityStep(79, 100)).toBe(0);
    expect(capacityStep(80, 100)).toBe(80);
    expect(capacityStep(89, 100)).toBe(80);
    expect(capacityStep(90, 100)).toBe(90);
    expect(capacityStep(99, 100)).toBe(90);
    expect(capacityStep(100, 100)).toBe(100);
    expect(capacityStep(120, 100)).toBe(100);
  });

  it('works for limits that are not 100 (no rounding surprises)', () => {
    expect(capacityStep(4, 5)).toBe(80);
    expect(capacityStep(7, 9)).toBe(0); // 77.8%
    expect(capacityStep(8, 9)).toBe(80); // 88.9%: past 80, short of 90
    expect(capacityStep(9, 10)).toBe(90);
  });

  it('is 0 for a farm with no limit', () => {
    expect(capacityStep(50, 0)).toBe(0);
  });
});

describe('capacityLevels / nearLimit', () => {
  const farms = [{ name: 'SNR Farm', capacity: 100 }, { name: 'Sokchea', capacity: 10 }, { name: 'New', capacity: 0 }, { name: 'Quiet', capacity: 500 }];
  const stock = [...cows('SNR Farm', 91), ...cows(' sokchea ', 8), ...cows('Quiet', 3)];

  it('counts every registered animal on each farm with a limit, ignoring farms without one', () => {
    const levels = capacityLevels(farms, stock);
    expect(levels.map(l => [l.farm, l.used, l.limit, l.left, l.step])).toEqual([
      ['SNR Farm', 91, 100, 9, 90], ['Sokchea', 8, 10, 2, 80], ['Quiet', 3, 500, 497, 0],
    ]);
  });

  it('lists the farms at 80% or more, fullest first', () => {
    expect(nearLimit(capacityLevels(farms, stock)).map(l => l.farm)).toEqual(['SNR Farm', 'Sokchea']);
  });
});
