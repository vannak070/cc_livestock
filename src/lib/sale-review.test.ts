import { describe, it, expect } from 'vitest';
import { addDaysToDay, saleReviewCounts, saleReviewProblem, saleReviewRows, saleTier } from './sale-review';
import type { BatchItem } from './types';
import type { StockItem, WeightRecord } from './xlsx-parser';

const NOW = new Date(2026, 9, 5, 12); // 5 Oct 2026, local noon
const day = (n: number) => addDaysToDay('2026-10-05', n);
const cow = (id: string, weight: number): StockItem =>
  ({ id, no: id, weight, status: 'Active', purchaseDate: '2026-08-01', breed: '', sex: '', age: '', ownerName: '', location: 'A', phone: '', buyType: '', unitPrice: 0, totalPrice: 0, healthStatus: 'Good', remark: '' });
const batch = (id: string, target: string | undefined, over: Partial<BatchItem> = {}): BatchItem =>
  ({ id, name: id, type: 'Fattening', startDate: '2026-07-01', status: 'Active', cowIds: ['A', 'B'], sellingTargetDate: target, ...over });
const stock = [cow('A', 300), cow('B', 340)];
const weights: WeightRecord[] = [];

describe('sale tiers', () => {
  it('splits overdue, this week and heads-up', () => {
    expect([saleTier(-1), saleTier(0), saleTier(7), saleTier(8), saleTier(15)]).toEqual(['overdue', 'week', 'week', 'soon', 'soon']);
  });
});

describe('saleReviewRows', () => {
  const list = [
    batch('far', day(40)),
    batch('in15', day(15)),
    batch('in3', day(3)),
    batch('late', day(-4)),
    batch('closed', day(2), { status: 'Closed' }),
    batch('nodate', undefined),
    batch('ready', day(2), { saleReview: { decision: 'ready', by: 'M', at: 'x' } }),
  ];

  it('keeps active batches within 15 days or late, undecided first then soonest', () => {
    expect(saleReviewRows(list, stock, weights, [], NOW).map(r => [r.batch.id, r.daysRemaining, r.tier, r.decided]))
      .toEqual([['late', -4, 'overdue', false], ['in3', 3, 'week', false], ['in15', 15, 'soon', false], ['ready', 2, 'week', true]]);
  });

  it('reports head, average weight and expected value when a price is set', () => {
    const r = saleReviewRows([batch('p', day(5), { expectedSellingPrice: 10000 })], stock, weights, [], NOW)[0];
    expect(r).toMatchObject({ head: 2, avgWeight: 320, expectedValue: 6400000 });
    expect(saleReviewRows([batch('np', day(5))], stock, weights, [], NOW)[0].expectedValue).toBeNull();
  });

  it('flags a date that is just the standard 90 days from the start', () => {
    const std = batch('std', addDaysToDay('2026-07-01', 90)); // 29 Sep: overdue, and the default
    const chosen = batch('chosen', day(5));
    const rows = saleReviewRows([std, chosen], stock, weights, [], NOW);
    expect(rows.find(r => r.batch.id === 'std')!.standardDate).toBe(true);
    expect(rows.find(r => r.batch.id === 'chosen')!.standardDate).toBe(false);
  });

  it('counts each stage, leaving decided batches out of the to-review total', () => {
    const rows = saleReviewRows(list, stock, weights, [], NOW);
    expect(saleReviewCounts(rows)).toEqual({ overdue: 1, week: 1, soon: 1, decided: 1, toReview: 3 });
  });
});

describe('saleReviewProblem', () => {
  const today = '2026-10-05';
  it('accepts selling now, and a future date when extending', () => {
    expect(saleReviewProblem({ decision: 'ready' }, today)).toBeNull();
    expect(saleReviewProblem({ decision: 'extend', newTargetDate: '2026-11-01', note: 'Needs 3 more weeks' }, today)).toBeNull();
  });
  it('rejects a missing, past or far-away new date, and a long note', () => {
    expect(saleReviewProblem({ decision: 'extend' }, today)).toMatch(/new selling date/i);
    expect(saleReviewProblem({ decision: 'extend', newTargetDate: '2026-10-05' }, today)).toMatch(/after today/);
    expect(saleReviewProblem({ decision: 'extend', newTargetDate: '2028-01-01' }, today)).toMatch(/year/);
    expect(saleReviewProblem({ decision: 'ready', note: 'x'.repeat(501) }, today)).toMatch(/too long/);
    expect(saleReviewProblem({ decision: 'nope' as never }, today)).toMatch(/Choose/);
  });
});
