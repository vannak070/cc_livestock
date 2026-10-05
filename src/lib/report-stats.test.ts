import { describe, it, expect } from 'vitest';
import { monthlyMoney, composition, forecast } from './report-stats';
import type { SalesRecord, StockItem } from './xlsx-parser';

const cow = (id: string, totalPrice: number, purchaseDate: string | null): StockItem =>
  ({ id, no: id, weight: 300, status: 'Sold', purchaseDate, totalPrice, breed: '', sex: '', age: '', ownerName: '', location: '', phone: '', buyType: '', unitPrice: 0, healthStatus: 'Good', remark: '' });
const sale = (cowId: string, totalPrice: number, salesDate: string | null): SalesRecord =>
  ({ cowId, totalPrice, salesDate, breed: '', age: '', weight: 300, unitPrice: 0, status: 'Sold' });

describe('monthlyMoney', () => {
  const stock = [cow('A', 4_000_000, '2026-08-10'), cow('B', 3_000_000, '2026-08-20'), cow('C', 5_000_000, '2026-09-02')];
  const sales = [sale('A', 5_000_000, '2026-10-05'), sale('C', 4_500_000, '2026-10-20'), sale('Z', 1_000_000, '2026-11-01')];
  const logs = [{ cowId: 'A', cost: 20_000 }];
  const rows = monthlyMoney(stock, sales, logs);
  it('lists months oldest first with what was bought and sold', () => {
    expect(rows.map(r => [r.label, r.bought, r.sold, r.soldCount])).toEqual([['Aug 2026', 7_000_000, 0, 0], ['Sep 2026', 5_000_000, 0, 0], ['Oct 2026', 0, 9_500_000, 2], ['Nov 2026', 0, 1_000_000, 1]]);
  });
  it('counts profit only for animals that still have a record', () => {
    expect(rows[2].profit).toBe(5_000_000 - 4_000_000 - 20_000 + (4_500_000 - 5_000_000)); // A: +980k, C: -500k
    expect(rows[3].profit).toBe(0); // Z is unknown
  });
  it('ignores rows without a usable date', () => {
    expect(monthlyMoney([cow('A', 1, null)], [sale('A', 1, null)], [])).toEqual([]);
  });
});

describe('composition', () => {
  it('counts each kind, biggest first, with shares', () => {
    const r = composition([{ b: 'Local' }, { b: 'Brahman' }, { b: 'Local' }, { b: '' }], x => x.b);
    expect(r).toEqual([{ label: 'Local', count: 2, pct: 50 }, { label: 'Brahman', count: 1, pct: 25 }, { label: 'Not set', count: 1, pct: 25 }]);
  });
  it('is empty for no items', () => {
    expect(composition([], () => 'x')).toEqual([]);
  });
});

describe('forecast', () => {
  const base = { cattle: [{ weight: 300, totalPrice: 4_000_000 }, { weight: 340, totalPrice: 4_400_000 }], healthCost: 30_000, feedCostPerDay: 12_800, feedSoFar: 500_000, perDay: 1, daysToSell: 40, pricePerKg: 13_000 };
  it('works out weight, revenue, cost and profit at the sell date', () => {
    const f = forecast(base);
    expect(f.avgNow).toBe(320);
    expect(f.avgFinal).toBe(360);
    expect(f.totalKg).toBe(720);
    expect(f.revenue).toBe(9_360_000);
    expect(f.feedToGo).toBe(512_000);
    expect(f.totalCost).toBe(8_400_000 + 30_000 + 500_000 + 512_000);
    expect(f.profit).toBe(9_360_000 - 9_442_000);
    expect(f.returnPct).toBe(-0.9);
  });
  it('treats a past sell date as today and has no return with no cost', () => {
    const f = forecast({ ...base, cattle: [{ weight: 300, totalPrice: 0 }], healthCost: 0, feedSoFar: 0, feedCostPerDay: 0, daysToSell: -5 });
    expect(f.avgFinal).toBe(300);
    expect(f.returnPct).toBeNull();
  });
});
