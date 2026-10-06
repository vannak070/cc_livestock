import { describe, expect, it } from 'vitest';
import { buildLowFeedAlert, lowFeedNow, planLowFeedAlerts, type LowFeed, type LowFeedData } from './low-feed-alerts';

const product = { id: 'P1', name: 'DSR-16 Cow Feed', category: 'Concentrate', unit: 'bag', weightPerUnit: 30, unitCost: 1, minThresholdBags: 50, minThresholdKg: 1500, status: 'Active' };
const tx = (farm: string, bags: number, type: 'STOCK_IN' | 'STOCK_OUT' = 'STOCK_IN') => ({ id: `${farm}${bags}${type}`, date: '2026-10-01T00:00:00.000Z', productId: 'P1', productName: product.name, type, quantityBags: bags, quantityKg: bags * 30, unitCost: 1, totalCost: 1, ...(type === 'STOCK_IN' ? { sourceFarm: 'Supplier', targetFarm: farm } : { sourceFarm: farm }) });
const cow = (id: string, location: string) => ({ id, location, status: 'Active' });
const batch = (id: string, farm: string, cows: string[], perHead = 6) => ({ id, name: id, status: 'Active', farmLocation: farm, cowIds: cows, feedingProgram: { status: 'Active', ingredients: [{ name: product.name, productId: 'P1', portionPerHead: perHead }] } });

const data = (txs: unknown[], fed = true): LowFeedData => ({
  stock: [cow('A1', 'Farm A'), cow('B1', 'Farm B')] as never,
  batches: [batch('BA', 'Farm A', ['A1'], fed ? 6 : 0), batch('BB', 'Farm B', ['B1'])] as never,
  settings: { farms: [{ id: '1', name: 'Farm A' }, { id: '2', name: 'Farm B' }] } as never,
  feedProducts: [product] as never,
  feedTransactions: txs as never,
});

describe('lowFeedNow', () => {
  it('counts stock farm by farm, so one farm running low is not hidden by another\'s stock', () => {
    const low = lowFeedNow(data([tx('Farm A', 40), tx('Farm B', 500)]));
    expect(low.map(l => l.farm)).toEqual(['Farm A']);
    expect(low[0]).toMatchObject({ productId: 'P1', bags: 40, thresholdBags: 50 });
  });

  it('reports a feed at exactly its minimum', () => {
    expect(lowFeedNow(data([tx('Farm A', 50), tx('Farm B', 500)])).map(l => l.farm)).toEqual(['Farm A']);
  });

  it('ignores a farm whose feed is not in use (it is in the morning check-up instead)', () => {
    expect(lowFeedNow(data([tx('Farm A', 10), tx('Farm B', 500)], false))).toEqual([]);
  });
});

describe('planLowFeedAlerts', () => {
  const low: LowFeed[] = [{ farm: 'Farm A', productId: 'P1', productName: 'DSR-16', bags: 40, thresholdBags: 50, daysLeft: 5 }];

  it('announces a feed that is low and not announced yet', () => {
    expect(planLowFeedAlerts(low, [])).toEqual({ announce: low, rearm: [] });
  });

  it('announces it only once while it stays low', () => {
    expect(planLowFeedAlerts(low, [{ farm: 'farm a ', productId: 'P1' }])).toEqual({ announce: [], rearm: [] });
  });

  it('arms it again after the farm restocks, so the next drop sends a new alert', () => {
    expect(planLowFeedAlerts([], [{ farm: 'Farm A', productId: 'P1' }])).toEqual({ announce: [], rearm: [{ farm: 'Farm A', productId: 'P1' }] });
  });
});

describe('buildLowFeedAlert', () => {
  const base: LowFeed = { farm: 'SNR <Farm>', productId: 'P1', productName: 'DSR-16 & more', bags: 40, thresholdBags: 50, daysLeft: 5 };
  it('names the farm, the feed, the days left and the minimum, and escapes the names', () => {
    const m = buildLowFeedAlert(base, { appUrl: 'https://farm.example' });
    expect(m).toContain('⚠️ <b>Low feed · SNR &lt;Farm&gt;</b>');
    expect(m).toContain('DSR-16 &amp; more: 40 bags left (about 5 days).');
    expect(m).toContain('The minimum is 50 bags. Please order more.');
    expect(m).toContain('https://farm.example');
  });
  it('is red and says so plainly when it is nearly gone', () => {
    expect(buildLowFeedAlert({ ...base, daysLeft: 2 })).toContain('🔴');
    expect(buildLowFeedAlert({ ...base, daysLeft: 0 })).toContain('40 bags left.');
    expect(buildLowFeedAlert({ ...base, daysLeft: 1 })).toContain('(about 1 day)');
  });
});
