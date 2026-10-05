import { describe, it, expect } from 'vitest';
import { batchCattle, unassignedCattle, estimateFromSamples, matchFeedProduct, feedLines, batchSummary } from './batch-stats';
import type { BatchItem, FeedProductItem } from './types';
import type { StockItem, WeightRecord } from './xlsx-parser';

const cow = (id: string, weight: number, status = 'Active', purchaseDate: string | null = '2026-08-01'): StockItem =>
  ({ id, no: id, weight, status, purchaseDate, breed: '', sex: '', age: '', ownerName: '', location: 'A', phone: '', buyType: '', unitPrice: 0, totalPrice: 0, healthStatus: 'Good', remark: '' });
const rec = (cowId: string, trackingDate: string, currentWeight: number): WeightRecord =>
  ({ cowId, trackingDate, currentWeight, oldWeight: 0, breed: '', age: '', gainLoss: 0, healthStatus: 'Good', status: 'Active' });
const batch = (over: Partial<BatchItem> = {}): BatchItem => ({ id: 'B1', name: 'B', type: 'Fattening Program', startDate: '2026-08-01', status: 'Active', cowIds: ['A', 'B', 'S'], ...over });
const product = (id: string, name: string, unitCost: number): FeedProductItem =>
  ({ id, name, category: 'Concentrate', unit: 'bag', weightPerUnit: 30, unitCost, minThresholdBags: 50, minThresholdKg: 1500, status: 'Active' });

describe('batch membership', () => {
  const stock = [cow('A', 300), cow('B', 310), cow('S', 320, 'Sold'), cow('C', 330), cow('D', 340, 'Dead')];
  it('counts only the batch cattle still on the farm', () => {
    expect(batchCattle(batch(), stock).map(c => c.id)).toEqual(['A', 'B']);
  });
  it('offers active cattle that are in no active batch', () => {
    expect(unassignedCattle(stock, [batch()]).map(c => c.id)).toEqual(['C']);
    // a closed batch frees its cattle
    expect(unassignedCattle(stock, [batch({ status: 'Closed' })]).map(c => c.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('estimateFromSamples', () => {
  it('adds the samples\' average gain to every other animal', () => {
    const cattle = [cow('A', 300), cow('B', 310), cow('C', 320), cow('D', 330)];
    const { avgGain, records } = estimateFromSamples(cattle, [{ cowId: 'A', weight: 330 }, { cowId: 'B', weight: 330 }, { cowId: 'C', weight: 330 }]);
    expect(avgGain).toBe(20); // gains 30, 20, 10
    expect(records).toEqual([
      { cowId: 'A', currentWeight: 330 },
      { cowId: 'B', currentWeight: 330 },
      { cowId: 'C', currentWeight: 330 },
      { cowId: 'D', currentWeight: 350 },
    ]);
  });
  it('rounds to one decimal and survives no samples', () => {
    expect(estimateFromSamples([cow('A', 300)], []).records).toEqual([{ cowId: 'A', currentWeight: 300 }]);
    expect(estimateFromSamples([cow('A', 300), cow('B', 100)], [{ cowId: 'A', weight: 310.33 }]).records[1].currentWeight).toBe(110.3);
  });
});

describe('feed matching and cost', () => {
  const products = [product('p1', 'DSR-16 Concentrate', 2000), product('p2', 'Silage', 500)];
  it('matches by id or name either way round, with no fallback', () => {
    expect(matchFeedProduct('', products, 'p2')?.id).toBe('p2');
    expect(matchFeedProduct('dsr-16', products)?.id).toBe('p1');
    expect(matchFeedProduct('Fresh grass silage mix', products)?.id).toBe('p2');
    expect(matchFeedProduct('Mineral block', products)).toBeNull();
  });
  it('prices matched feed from the catalogue and flags the rest', () => {
    const lines = feedLines({ ingredients: [{ name: 'DSR-16', portionPerHead: 3, unitCost: 1 }, { name: 'Mineral block', portionPerHead: 0.1, unitCost: 4000 }], frequency: '', startDate: '', status: 'Active' }, products);
    expect(lines.map(l => [l.inCatalogue, l.costPerHead])).toEqual([[true, 6000], [false, 400]]);
  });
});

describe('batchSummary', () => {
  const stock = [cow('A', 300), cow('B', 340), cow('S', 999, 'Sold')];
  const weights = [rec('A', '2026-09-01', 300), rec('A', '2026-10-01', 330), rec('B', '2026-09-01', 340)];
  // B's only weigh-in has an earlier weight on record, so B counts too.
  const products = [product('p1', 'DSR-16', 2000)];
  const b = batch({ sellingTargetDate: '2026-10-20', feedingProgram: { ingredients: [{ name: 'DSR-16', portionPerHead: 3, unitCost: 2000 }], frequency: '', startDate: '', status: 'Active' } });
  const now = new Date(2026, 9, 5);
  it('summarises head, weight, gain, days and feed', () => {
    const s = batchSummary(b, stock, weights, products, now);
    expect(s.head).toBe(2);
    expect(s.avgWeight).toBe((330 + 340) / 2);
    expect(s.perDay).toBe(1); // A: 30 kg over 30 days; B has one weigh-in and no earlier weight, so does not count
    expect(s.daysIn).toBe(65);
    expect(s.daysToTarget).toBe(15);
    expect(s.feedKgPerDay).toBe(6);
    expect(s.feedCostPerDay).toBe(12000);
  });
  it('counts no feed cost when feeding is paused, and has nulls without dates', () => {
    const paused = batchSummary({ ...b, sellingTargetDate: undefined, startDate: '', feedingProgram: { ...b.feedingProgram!, status: 'Paused' } }, stock, weights, products, now);
    expect(paused.feedCostPerDay).toBe(0);
    expect(paused.daysToTarget).toBeNull();
    expect(paused.daysIn).toBeNull();
  });
});
