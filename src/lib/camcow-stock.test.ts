import { describe, expect, it } from 'vitest';
import { HELD_ALERT_DAYS, heldLots, lostProblem, marginOf, saleProblem, soldLots, summarizeStock, waitingGroups, waitingToReceive, type Holding } from './camcow-stock';

const h = (over: Partial<Holding> & { cowId: string }): Holding => ({ sourceFarm: 'A', collectedOn: '2026-10-01', collectionWeight: 400, collectionTotal: 5_000_000, status: 'Held', note: '', ...over });
const today = '2026-10-15';

describe('waitingToReceive', () => {
  const stock = [{ id: '1', location: 'A' }, { id: '2', location: 'A' }, { id: '3', location: 'B' }, { id: '4', location: 'B' }];
  const sales = [
    { cowId: '1', buyer: 'CC Livestock', salesDate: '2026-10-05T05:00:00Z', weight: 410, totalPrice: 5_125_000 },
    { cowId: '2', buyer: 'Kampot traders', salesDate: '2026-10-05T05:00:00Z', weight: 400, totalPrice: 5_000_000 }, // a sale to someone else
    { cowId: '3', buyer: 'camcow', salesDate: '2026-10-06T05:00:00Z', weight: 420, totalPrice: 5_250_000 },
    { cowId: '4', buyer: 'CC Livestock', salesDate: '2026-10-06T05:00:00Z', weight: 400, totalPrice: 5_000_000 },
  ];
  it('lists collected cattle with no holding yet, and leaves out sales to other buyers and animals already in stock', () => {
    const w = waitingToReceive(stock, sales, [{ cowId: '4' }]);
    expect(w.map(x => x.cowId)).toEqual(['1', '3']);
    expect(w[0]).toMatchObject({ farm: 'A', collectedOn: '2026-10-05', weight: 410, total: 5_125_000 });
  });
  it('groups them by farm, batch and day', () => {
    const groups = waitingGroups(waitingToReceive(stock, sales, [], id => (id === '1' || id === '4' ? 'B1' : undefined)));
    expect(groups.map(g => [g.farm, g.batchId, g.head])).toEqual([['A', 'B1', 1], ['B', undefined, 1], ['B', 'B1', 1]]);
  });
});

describe('stock lots and summary', () => {
  const rows = [
    h({ cowId: '1', collectedOn: '2026-09-01', batchId: 'X' }), h({ cowId: '2', collectedOn: '2026-09-01', batchId: 'X' }),
    h({ cowId: '3', collectedOn: '2026-10-10', sourceFarm: 'B' }),
    h({ cowId: '4', status: 'Sold', soldOn: '2026-10-09', buyer: 'Meat Co', saleWeight: 410, salePricePerKg: 13_000, saleTotal: 5_330_000 }),
    h({ cowId: '5', status: 'Lost', lostOn: '2026-10-08' }),
  ];
  it('groups cattle in stock into lots, oldest first, with days held', () => {
    const lots = heldLots(rows, today);
    expect(lots.map(l => [l.farm, l.head, l.daysHeld])).toEqual([['A', 2, 44], ['B', 1, 5]]);
    expect(lots[0]).toMatchObject({ kg: 800, cost: 10_000_000, cowIds: ['1', '2'] });
  });
  it('sums what is held, what is too old, and what was sold and lost', () => {
    const s = summarizeStock(rows, today);
    expect(s).toMatchObject({ held: 3, heldCost: 15_000_000, oldestDaysHeld: 44, heldTooLong: 2, sold: 1, soldRevenue: 5_330_000, margin: 330_000, lost: 1, lostCost: 5_000_000 });
    expect(s.avgDaysHeld).toBe(31); // (44 + 44 + 5) / 3
    expect(HELD_ALERT_DAYS).toBe(30);
    expect(marginOf(rows[3])).toBe(330_000);
  });
  it('groups the cattle sold on by day, buyer and farm, with the margin of each group', () => {
    const sold = [
      h({ cowId: 'a', status: 'Sold', soldOn: '2026-10-09', buyer: 'Meat Co', saleWeight: 410, saleTotal: 5_330_000 }),
      h({ cowId: 'b', status: 'Sold', soldOn: '2026-10-09', buyer: 'Meat Co', saleWeight: 420, saleTotal: 5_460_000 }),
      h({ cowId: 'c', status: 'Sold', soldOn: '2026-10-12', buyer: 'Traders', saleWeight: 400, saleTotal: 5_200_000, sourceFarm: 'B' }),
    ];
    const lots = soldLots(sold);
    expect(lots.map(l => [l.soldOn, l.buyer, l.farm, l.head])).toEqual([['2026-10-12', 'Traders', 'B', 1], ['2026-10-09', 'Meat Co', 'A', 2]]);
    expect(lots[1]).toMatchObject({ kg: 830, total: 10_790_000, margin: 790_000 });
  });
  it('counts only the sales of the months asked for', () => {
    expect(summarizeStock(rows, today, '2026-11').sold).toBe(0);
    expect(summarizeStock(rows, today, '2026-10', '2026-10').sold).toBe(1);
    expect(summarizeStock(rows, today, '2026-09', '2026-09').sold).toBe(0);
  });
});

describe('sale and loss checks', () => {
  const held = new Set(['1', '2']);
  const ok = { cowIds: ['1', '2'], buyerId: 'BUY-1', date: '2026-10-14', pricePerKg: 13_000, weights: { '1': 410, '2': 395 } };
  it('accepts a good sale', () => expect(saleProblem(ok, held, today)).toBeNull());
  it('names what is wrong', () => {
    expect(saleProblem({ ...ok, cowIds: [] }, held, today)).toMatch(/Choose/);
    expect(saleProblem({ ...ok, cowIds: ['1', '9'] }, held, today)).toMatch(/not in stock/);
    expect(saleProblem({ ...ok, buyerId: ' ' }, held, today)).toMatch(/buyer/);
    expect(saleProblem({ ...ok, date: '2026-10-20' }, held, today)).toMatch(/future/);
    expect(saleProblem({ ...ok, pricePerKg: 0 }, held, today)).toMatch(/price/);
    expect(saleProblem({ ...ok, weights: { '1': 410 } }, held, today)).toMatch(/weight of 2/);
  });
  it('checks marking animals as lost', () => {
    expect(lostProblem(['1'], '2026-10-14', 'died', held, today)).toBeNull();
    expect(lostProblem(['9'], '2026-10-14', '', held, today)).toMatch(/not in stock/);
    expect(lostProblem(['1'], '2026-10-30', '', held, today)).toMatch(/future/);
  });
});

describe('margin after holding costs', () => {
  it('takes each sold animal\'s share of the costs off the margin', () => {
    const holdings = [
      { cowId: 'a', sourceFarm: 'A', collectedOn: '2026-10-01', collectionWeight: 400, collectionTotal: 5_000_000, status: 'Sold' as const, soldOn: '2026-10-09', saleWeight: 410, saleTotal: 5_330_000, note: '' },
      { cowId: 'b', sourceFarm: 'A', collectedOn: '2026-10-01', collectionWeight: 400, collectionTotal: 5_000_000, status: 'Held' as const, note: '' },
    ];
    const s = summarizeStock(holdings, '2026-10-14', '2026-10', '2026-10', new Map([['a', 80_000], ['b', 90_000]]));
    expect(s).toMatchObject({ margin: 330_000, soldCost: 80_000, marginAfterCosts: 250_000 });
    expect(summarizeStock(holdings, '2026-10-14', '2026-10', '2026-10')).toMatchObject({ soldCost: 0, marginAfterCosts: 330_000 });
  });
});
