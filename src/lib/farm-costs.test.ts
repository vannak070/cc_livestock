import { describe, expect, it } from 'vitest';
import { DEFAULT_COST_CATEGORIES, costCategoriesFrom, costCategoriesProblem, farmCostProblem, farmProfit, feedFarm, feedShares, sumMonths, type FarmCostInput } from './farm-costs';
import type { FeedStockTransaction } from './types';
import type { SalesRecord, StockItem } from './xlsx-parser';

const ok: FarmCostInput = { farmLocation: 'SNR Farm', category: 'Wages', amount: 500000, date: '2026-10-01' };

describe('farmCostProblem', () => {
  it('accepts a complete cost', () => {
    expect(farmCostProblem(ok, '2026-10-05')).toBeNull();
  });

  it('rejects missing or bad fields', () => {
    expect(farmCostProblem({ ...ok, farmLocation: ' ' }, '2026-10-05')).toMatch(/farm/);
    expect(farmCostProblem({ ...ok, category: 'Feed' }, '2026-10-05')).toMatch(/what the cost/);
    expect(farmCostProblem({ ...ok, amount: 0 }, '2026-10-05')).toMatch(/how much/);
    expect(farmCostProblem({ ...ok, amount: Number.NaN }, '2026-10-05')).toMatch(/how much/);
    expect(farmCostProblem({ ...ok, amount: 2e10 }, '2026-10-05')).toMatch(/too big/);
    expect(farmCostProblem({ ...ok, date: '2026-13-01' }, '2026-10-05')).toMatch(/date/);
    expect(farmCostProblem({ ...ok, note: 'x'.repeat(501) }, '2026-10-05')).toMatch(/note/);
  });

  it('checks the category against the list from Settings', () => {
    expect(farmCostProblem({ ...ok, category: 'Vet visit' }, '2026-10-05', ['Vet visit'])).toBeNull();
    expect(farmCostProblem(ok, '2026-10-05', ['Vet visit'])).toMatch(/what the cost/);
  });

  it('rejects a date after the farm today', () => {
    expect(farmCostProblem({ ...ok, date: '2026-10-06' }, '2026-10-05')).toMatch(/future/);
  });
});

describe('cost categories list', () => {
  it('falls back to the defaults when Settings has none', () => {
    expect(costCategoriesFrom(undefined)).toEqual([...DEFAULT_COST_CATEGORIES]);
    expect(costCategoriesFrom({ costCategories: [] })).toEqual([...DEFAULT_COST_CATEGORIES]);
    expect(costCategoriesFrom({ costCategories: ['Wages'] })).toEqual(['Wages']);
  });

  it('accepts a sensible list and refuses a broken one', () => {
    expect(costCategoriesProblem(['Wages', 'Vet visit'])).toBeNull();
    expect(costCategoriesProblem([])).toMatch(/at least one/);
    expect(costCategoriesProblem('Wages')).toMatch(/not valid/);
    expect(costCategoriesProblem(['Wages', 3])).toMatch(/not valid/);
    expect(costCategoriesProblem(['Wages', '  '])).toMatch(/empty/);
    expect(costCategoriesProblem(['x'.repeat(51)])).toMatch(/too long/);
    expect(costCategoriesProblem(['Wages', ' wages '])).toMatch(/once/);
  });
});

const cow = (id: string, location: string, totalPrice: number, purchaseDate = '2026-06-01') => ({ id, location, totalPrice, purchaseDate, status: 'Active' }) as StockItem;
const sale = (cowId: string, salesDate: string, totalPrice: number) => ({ cowId, salesDate, totalPrice }) as SalesRecord;
const out = (date: string, totalCost: number, extra: Partial<FeedStockTransaction> = {}) =>
  ({ id: date, date: `${date}T00:00:00.000Z`, productId: 'P', productName: 'P', type: 'STOCK_OUT', quantityBags: 1, quantityKg: 30, unitCost: 1, totalCost, ...extra }) as FeedStockTransaction;
const daily = (batchId: string, day: string, totalCost: number, sourceFarm = 'SNR Farm') =>
  out(day, totalCost, { sourceFarm, referenceNo: `DAILY-${batchId}-${day}-P` });

describe('feedFarm', () => {
  const batchFarm = new Map([['B1', 'SNR Farm']]);
  it('uses the farm the feed left', () => {
    expect(feedFarm({ sourceFarm: 'Pursat', referenceNo: 'DAILY-B1-2026-10-01-P' }, batchFarm)).toBe('Pursat');
  });
  it('falls back to the batch farm for old automatic rows without a farm', () => {
    expect(feedFarm({ sourceFarm: '', referenceNo: 'AUTO-RATION-B1-2026-06-11-0' }, batchFarm)).toBe('SNR Farm');
    expect(feedFarm({ sourceFarm: undefined, referenceNo: 'TX-1' }, batchFarm)).toBeUndefined();
  });
});

describe('feedShares', () => {
  const stock = [cow('C1', 'SNR Farm', 0), cow('C2', 'SNR Farm', 0), cow('C3', 'SNR Farm', 0, '2026-09-05')];
  const batches = [{ id: 'B1', farmLocation: 'SNR Farm', cowIds: ['C1', 'C2', 'C3'] }];
  const sales = [sale('C1', '2026-09-03', 1)];

  it('splits a day evenly over the animals in the batch that day', () => {
    const { byCow } = feedShares([
      daily('B1', '2026-09-01', 200), // C1, C2 (C3 not bought yet)
      daily('B1', '2026-09-03', 100), // C2 only: C1 sold that day, C3 not bought yet
      { ...daily('B1', '2026-09-06', 300), referenceNo: 'AUTO-RATION-B1-2026-09-06-0', sourceFarm: '' }, // C2, C3
    ], batches, stock, sales);
    expect(byCow.get('C1')).toBe(100);
    expect(byCow.get('C2')).toBe(100 + 100 + 150);
    expect(byCow.get('C3')).toBe(150);
  });

  it('keeps feed that no animal ate apart, with its farm and day', () => {
    const { byCow, unassigned } = feedShares([
      out('2026-09-02', 50, { sourceFarm: 'SNR Farm', referenceNo: 'TX-1' }), // taken out by hand
      daily('B9', '2026-09-02', 70), // batch no longer exists
      { ...out('2026-09-02', 999), type: 'STOCK_IN' as const },
    ], batches, stock, sales);
    expect(byCow.size).toBe(0);
    expect(unassigned).toEqual([{ farm: 'SNR Farm', day: '2026-09-02', cost: 50 }, { farm: 'SNR Farm', day: '2026-09-02', cost: 70 }]);
  });
});

describe('farmProfit', () => {
  const input = {
    stock: [cow('C1', 'SNR Farm', 3_000_000), cow('C2', 'SNR Farm', 2_000_000), cow('P1', 'Pursat', 1_000_000)],
    sales: [sale('C1', '2026-09-08', 4_000_000), sale('P1', '2026-09-20', 1_500_000)],
    healthLogs: [{ cowId: 'C1', cost: 50_000, date: '2026-08-15T03:00:00.000Z' }],
    feedTransactions: [
      daily('B1', '2026-08-10', 200_000), // C1 + C2: 100k each
      daily('B1', '2026-09-10', 300_000), // C2 only (C1 sold 8 Sep)
      daily('BP', '2026-08-10', 80_000, 'Pursat'), // P1
      out('2026-10-01', 9_000, { sourceFarm: 'SNR Farm', referenceNo: 'TX-SPOILED' }),
    ],
    batches: [{ id: 'B1', farmLocation: 'SNR Farm', cowIds: ['C1', 'C2'] }, { id: 'BP', farmLocation: 'Pursat', cowIds: ['P1'] }],
    costs: [{ farmLocation: 'SNR Farm', amount: 400_000, date: '2026-09-01' }],
  };

  it('counts feed in the month the animal that ate it is sold', () => {
    const { months, feedInHerd } = farmProfit(input);
    expect(months.map(m => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(months[0]).toMatchObject({ label: 'Aug 2026', feed: 0, medicine: 50_000, profit: -50_000 });
    expect(months[1]).toMatchObject({ sales: 5_500_000, soldCount: 2, cattleCost: 4_000_000, feed: 180_000, other: 400_000, profit: 920_000 });
    expect(months[2]).toMatchObject({ feed: 9_000, profit: -9_000 });
    expect(feedInHerd).toBe(400_000); // C2, still on the farm
  });

  it('keeps to one farm', () => {
    const { months, feedInHerd } = farmProfit({ ...input, farm: 'Pursat' });
    expect(sumMonths(months)).toMatchObject({ sales: 1_500_000, cattleCost: 1_000_000, feed: 80_000, medicine: 0, other: 0, profit: 420_000 });
    expect(feedInHerd).toBe(0);
  });
});
