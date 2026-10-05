import { describe, expect, it } from 'vitest';
import { batchesNearSelling, cattleOnFeed, feedStockLevels, sickCattle, weighSchedules } from './attention';
import type { ERPLivestockData } from './types';

const NOW = new Date('2026-10-05T09:00:00');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const inDays = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);

const stock = [
  { id: 'A', status: 'Active', healthStatus: 'Good' },
  { id: 'B', status: 'Active', healthStatus: 'Sick' },
  { id: 'C', status: 'Active', healthStatus: 'Good' },
  { id: 'S', status: 'Sold', healthStatus: 'Sick' }
];
const data = (extra: Partial<Record<keyof ERPLivestockData, unknown>> = {}) =>
  ({ stock, weightTracking: [], healthLogs: [], batches: [], feedProducts: [], feedTransactions: [], ...extra }) as unknown as ERPLivestockData;

describe('sickCattle', () => {
  it('counts only active cattle with a sick-type status', () => {
    expect(sickCattle(data().stock).map(c => c.id)).toEqual(['B']);
  });
});

describe('weighSchedules', () => {
  const d = data({
    weightTracking: [
      { cowId: 'A', trackingDate: daysAgo(3) },
      { cowId: 'A', trackingDate: daysAgo(30) },
      { cowId: 'B', trackingDate: daysAgo(13) },
      { cowId: 'S', trackingDate: daysAgo(40) }
    ]
  });

  it('uses the latest weigh-in per animal and the 14-day rule', () => {
    const byId = Object.fromEntries(weighSchedules(d, 14, NOW).map(s => [s.cowId, s]));
    expect(byId.A.status).toBe('weighed');
    expect(byId.B.status).toBe('duesoon');
    expect(byId.C.status).toBe('overdue'); // never weighed
    expect(byId.C.daysElapsed).toBe(999);
  });

  it('ignores cattle that are no longer on the farm and sorts most overdue first', () => {
    const list = weighSchedules(d, 14, NOW);
    expect(list.map(s => s.cowId)).toEqual(['C', 'B', 'A']);
  });
});

describe('batchesNearSelling', () => {
  it('lists active batches due within the window, overdue ones first', () => {
    const d = data({
      batches: [
        { id: 'far', name: 'far', status: 'Active', sellingTargetDate: inDays(30), cowIds: [] },
        { id: 'soon', name: 'soon', status: 'Active', sellingTargetDate: inDays(5), cowIds: [] },
        { id: 'late', name: 'late', status: 'Active', sellingTargetDate: inDays(-2), cowIds: [] },
        { id: 'closed', name: 'closed', status: 'Closed', sellingTargetDate: inDays(1), cowIds: [] },
        { id: 'nodate', name: 'nodate', status: 'Active', cowIds: [] }
      ]
    });
    expect(batchesNearSelling(d, 10, NOW).map(b => [b.batchId, b.daysRemaining])).toEqual([['late', -2], ['soon', 5]]);
  });

  it('warns 15 days ahead by default and drops batches already decided to sell', () => {
    const d = data({
      batches: [
        { id: 'in15', name: 'in15', status: 'Active', sellingTargetDate: inDays(15), cowIds: [] },
        { id: 'in16', name: 'in16', status: 'Active', sellingTargetDate: inDays(16), cowIds: [] },
        { id: 'ready', name: 'ready', status: 'Active', sellingTargetDate: inDays(3), cowIds: [], saleReview: { decision: 'ready', by: 'M', at: '2026-01-01' } },
        { id: 'extended', name: 'extended', status: 'Active', sellingTargetDate: inDays(4), cowIds: [], saleReview: { decision: 'extend', by: 'M', at: '2026-01-01' } }
      ]
    });
    expect(batchesNearSelling(d, undefined, NOW).map(b => b.batchId)).toEqual(['extended', 'in15']);
  });
});

describe('feed', () => {
  const products = [{ id: 'P1', name: 'DSR-16 Cow Feed', weightPerUnit: 30, minThresholdBags: 50 }];
  const batches = [{
    id: 'BT', name: 'BT', status: 'Active', cowIds: ['A', 'B', 'S'],
    feedingProgram: { status: 'Active', ingredients: [{ name: 'DSR-16', portionPerHead: 5 }] }
  }];

  it('counts only active cattle on feed (sold cattle left on a batch do not count)', () => {
    expect(cattleOnFeed(data({ batches }))).toBe(2);
  });

  it('computes stock on hand, low-stock flag and days left at the ration rate', () => {
    const d = data({
      batches,
      feedProducts: products,
      feedTransactions: [
        { productId: 'P1', type: 'STOCK_IN', quantityBags: 10, quantityKg: 300 },
        { productId: 'P1', type: 'STOCK_OUT', quantityBags: 1, quantityKg: 30 }
      ]
    });
    const [level] = feedStockLevels(d);
    expect(level).toMatchObject({ bags: 9, kg: 270, isLow: true, dailyUseKg: 10, daysLeft: 27 });
  });

  it('never calls feed grown on the farm "running low", but still counts what is eaten', () => {
    const grown = products.map(p => ({ ...p, trackStock: false }));
    const [level] = feedStockLevels(data({ batches, feedProducts: grown }));
    expect(level).toMatchObject({ tracked: false, isLow: false, daysLeft: null, dailyUseKg: 10 });
  });

  it('reports no days-left estimate when nothing is being fed', () => {
    const [level] = feedStockLevels(data({ feedProducts: products }));
    expect(level.daysLeft).toBeNull();
  });
});
