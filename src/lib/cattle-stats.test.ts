import { describe, it, expect } from 'vitest';
import { weighPoints, growth, daysOnFarm, money } from './cattle-stats';
import type { WeightRecord } from './xlsx-parser';

const rec = (cowId: string, trackingDate: string | null, currentWeight: number, oldWeight = 0): WeightRecord =>
  ({ cowId, trackingDate, currentWeight, oldWeight, breed: '', age: '', gainLoss: 0, healthStatus: 'Good', status: 'Active' });

describe('weighPoints', () => {
  it('keeps one animal, oldest first, with the change since the last weigh-in', () => {
    const pts = weighPoints('A', [rec('A', '2026-09-20', 320), rec('B', '2026-09-01', 999), rec('A', '2026-09-06', 300), rec('A', '2026-10-04', 350.5)]);
    expect(pts.map(p => p.date)).toEqual(['2026-09-06', '2026-09-20', '2026-10-04']);
    expect(pts.map(p => p.change)).toEqual([null, 20, 30.5]);
  });
  it('keeps the last reading when weighed twice on one day, and skips empty ones', () => {
    const pts = weighPoints('A', [rec('A', '2026-09-06', 300), rec('A', '2026-09-06', 305), rec('A', null, 400), rec('A', '2026-09-07', 0)]);
    expect(pts).toHaveLength(1);
    expect(pts[0].weight).toBe(305);
  });
});

describe('arrival weight', () => {
  it('starts from the weight before the first weigh-in, on the arrival date', () => {
    const pts = weighPoints('A', [rec('A', '2026-09-01', 330, 300)], '2026-08-22');
    expect(pts.map(p => [p.date, p.weight, p.change])).toEqual([['2026-08-22', 300, null], ['2026-09-01', 330, 30]]);
  });
  it('adds nothing when the old weight is unknown or the arrival is not earlier', () => {
    expect(weighPoints('A', [rec('A', '2026-09-01', 330)], '2026-08-22')).toHaveLength(1);
    expect(weighPoints('A', [rec('A', '2026-09-01', 330, 300)], '2026-09-01')).toHaveLength(1);
  });
});

describe('growth', () => {
  it('works out gain and daily gain between the first and last point', () => {
    const pts = weighPoints('A', [rec('A', '2026-10-01', 360, 300)], '2026-08-22');
    expect(growth({ weight: 360 }, pts)).toMatchObject({ startWeight: 300, currentWeight: 360, gain: 60, days: 40, perDay: 1.5 });
  });
  it('has no daily gain with a single point', () => {
    expect(growth({ weight: 300 }, weighPoints('A', [rec('A', '2026-09-10', 300)])).perDay).toBeNull();
  });
  it('falls back to the registered weight when never weighed', () => {
    expect(growth({ weight: 250 }, [])).toMatchObject({ startWeight: 250, currentWeight: 250, gain: 0, perDay: null });
  });
});

describe('daysOnFarm', () => {
  it('counts to today while active and to the sale date once sold', () => {
    const now = new Date(2026, 9, 5);
    expect(daysOnFarm({ purchaseDate: '2026-09-25', status: 'Active' }, undefined, now)).toBe(10);
    expect(daysOnFarm({ purchaseDate: '2026-09-25', status: 'Sold' }, { salesDate: '2026-10-01' }, now)).toBe(6);
    expect(daysOnFarm({ purchaseDate: null, status: 'Active' }, undefined, now)).toBeNull();
  });
});

describe('money', () => {
  const logs = [{ cost: 12000 }, { cost: 8000 }];
  it('shows cost so far, no result, while the animal is on the farm', () => {
    expect(money({ totalPrice: 4_000_000, status: 'Active' }, undefined, logs)).toEqual({ cost: 4_000_000, medical: 20000, invested: 4_020_000, revenue: null, result: null });
  });
  it('gives profit or loss once sold', () => {
    expect(money({ totalPrice: 4_000_000, status: 'Sold' }, { totalPrice: 5_000_000 }, logs).result).toBe(980_000);
    expect(money({ totalPrice: 4_000_000, status: 'Sold' }, { totalPrice: 3_000_000 }, []).result).toBe(-1_000_000);
  });
  it('counts a dead animal as a loss of everything put in', () => {
    expect(money({ totalPrice: 4_000_000, status: 'Dead' }, undefined, logs).result).toBe(-4_020_000);
  });
});
