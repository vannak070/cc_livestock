import { describe, expect, it } from 'vitest';
import { camcowSheets } from './camcow-export';
import type { Holding } from './camcow-stock';

const base = { sourceFarm: 'A', batchId: 'B-1', collectedOn: '2026-10-01', collectionWeight: 400, collectionTotal: 5_000_000, note: '' };
const holdings: Holding[] = [
  { ...base, cowId: 'H1', status: 'Held' },
  { ...base, cowId: 'S1', status: 'Sold', soldOn: '2026-10-05', buyer: 'Meat Co', buyerId: 'B1', saleWeight: 410, salePricePerKg: 13_000, saleTotal: 5_330_000 },
  { ...base, cowId: 'L1', status: 'Lost', lostOn: '2026-10-03', note: 'Died' },
];
const buyers = [{ id: 'B1', name: 'Meat Co', kind: 'trader' as const, phone: '012', location: 'PP', note: '', active: true }];

describe('CamCow stock workbook', () => {
  const sheets = camcowSheets(holdings, buyers, [{ id: 'c', date: '2026-10-02', kind: 'feed', amount: 90_000, note: 'hay' }], '2026-10-10', id => `Batch ${id}`);
  it('has a sheet each for cattle in stock, sold, lost, buyers and costs', () => {
    expect(sheets.map(s => s.name)).toEqual(['In stock', 'Sold', 'Lost', 'Buyers', 'Costs']);
  });
  it('lists each animal once, with its costs and margin after costs', () => {
    const [stock, sold, lost, buy, cost] = sheets;
    expect(stock.rows[1]).toEqual(['H1', 'A', 'Batch B-1', '2026-10-01', 400, 5_000_000, 9, 30_000]);
    // 10-02: H1, S1 and L1 are in stock (3 each, 30,000).
    expect(sold.rows[1].slice(0, 5)).toEqual(['S1', 'A', '2026-10-01', '2026-10-05', 'Meat Co']);
    expect(sold.rows[1][11]).toBe(30_000);
    expect(sold.rows[1][12]).toBe(300_000);
    expect(lost.rows[1]).toEqual(['L1', 'A', '2026-10-01', '2026-10-03', 5_000_000, 30_000, 'Died']);
    expect(buy.rows[1]).toEqual(['Meat Co', 'trader', '012', 'PP', 'Yes', 1, 5_330_000, 330_000, '2026-10-05']);
    expect(cost.rows[1]).toEqual(['2026-10-02', 'feed', 90_000, 'hay']);
  });
});
