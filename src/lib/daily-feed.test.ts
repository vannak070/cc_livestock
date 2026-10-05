import { describe, it, expect } from 'vitest';
import {
  addDays, amountText, dailyFeedProblem, dailyFeedReport, farmRations, farmToday, feedDayStatus, kgPerUnit, parseFeedRef, recordedUnits
} from './daily-feed';
import type { BatchItem, FeedProductItem, FeedStockTransaction } from './types';
import type { StockItem } from './xlsx-parser';

const dsr = { id: 'PROD-F01', name: 'DSR-16 Cow Feed', unit: 'bag', weightPerUnit: 30, unitCost: 1000 } as FeedProductItem;
const grass = { id: 'PROD-G', name: 'Fresh Grass', unit: 'kg', weightPerUnit: 1, unitCost: 100 } as FeedProductItem;
const cow = (id: string, sex: string, status = 'Active') => ({ id, sex, status, location: 'SNR Farm' }) as unknown as StockItem;
const stock = [cow('B1', 'Male'), cow('B2', 'Male'), cow('C1', 'Female'), cow('C2', 'Female', 'Sold')];
const batch = (over: Partial<BatchItem> = {}) => ({
  id: 'BULLS', name: 'Bulls', status: 'Active', farmLocation: 'SNR Farm', cowIds: ['B1', 'B2'],
  feedingProgram: { status: 'Active', frequency: 'Once Daily', startDate: '2026-06-01', ingredients: [
    { name: 'ចំណីសំរេច (DSR-16)', productId: 'PROD-F01', portionPerHead: 6, unitCost: 1000 },
    { name: 'Fresh Grass', portionPerHead: 15, unitCost: 100 },
  ] },
  ...over,
}) as unknown as BatchItem;
const tx = (ref: string, over: Partial<FeedStockTransaction> = {}) => ({ id: ref, date: '2026-10-05T00:00:00.000Z', productId: 'PROD-F01', productName: 'DSR-16', type: 'STOCK_OUT', quantityBags: 1, quantityKg: 30, unitCost: 1000, totalCost: 30000, referenceNo: ref, ...over }) as FeedStockTransaction;

describe('days and units', () => {
  it('uses the Phnom Penh day', () => {
    expect(farmToday(new Date('2026-10-05T16:59:00Z'))).toBe('2026-10-05');
    expect(farmToday(new Date('2026-10-05T17:00:00Z'))).toBe('2026-10-06');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
  it('counts bags by their size and loose feed in kg', () => {
    expect(kgPerUnit(dsr)).toBe(30);
    expect(kgPerUnit(grass)).toBe(1);
    expect(amountText(dsr, 6)).toBe('6 bags');
    expect(amountText(dsr, 1)).toBe('1 bag');
    expect(amountText(grass, 450)).toBe('450 kg');
  });
  it('reads which batch and day a movement belongs to', () => {
    expect(parseFeedRef('DAILY-FAT-2026-961-2026-10-05-PROD-F01')).toEqual({ kind: 'recorded', batchId: 'FAT-2026-961', day: '2026-10-05' });
    expect(parseFeedRef('AUTO-RATION-FAT-2026-961-2026-10-05-0')).toEqual({ kind: 'estimated', batchId: 'FAT-2026-961', day: '2026-10-05' });
    expect(parseFeedRef('TX-123456')).toBeNull();
  });
});

describe('farmRations', () => {
  it('turns the plan into amounts for the whole batch, counting only cattle still on the farm', () => {
    const [r] = farmRations('SNR Farm', [batch()], stock, [dsr, grass]);
    expect(r.head).toBe(2);
    expect(r.bulls).toBe(2);
    expect(r.items.map(i => [i.product?.id, i.planUnits])).toEqual([['PROD-F01', 0.4], ['PROD-G', 30]]);
  });
  it('leaves out other farms, closed batches and paused feeding', () => {
    expect(farmRations('SNR Farm', [batch({ farmLocation: 'Other' }), batch({ status: 'Closed' }), batch({ feedingProgram: { ...batch().feedingProgram!, status: 'Paused' } })], stock, [dsr])).toEqual([]);
  });
  it('marks a plan feed that is not in the feed list', () => {
    const [r] = farmRations('SNR Farm', [batch()], stock, [grass]);
    expect(r.items[0].product).toBeUndefined();
  });
});

describe('recording a day', () => {
  it('knows what was recorded and whether a farm day is recorded, estimated or missing', () => {
    const txs = [tx('DAILY-BULLS-2026-10-05-PROD-F01', { quantityBags: 6 }), tx('AUTO-RATION-COWS-2026-10-04-PROD-F01')];
    expect(recordedUnits(txs, 'BULLS', '2026-10-05', 'PROD-F01')).toBe(6);
    expect(recordedUnits(txs, 'BULLS', '2026-10-04', 'PROD-F01')).toBeNull();
    expect(feedDayStatus(txs, ['BULLS'], '2026-10-05')).toBe('recorded');
    expect(feedDayStatus(txs, ['BULLS', 'COWS'], '2026-10-05')).toBe('partly');
    expect(feedDayStatus(txs, ['COWS'], '2026-10-04')).toBe('estimated');
    expect(feedDayStatus(txs, ['COWS'], '2026-10-03')).toBe('missing');
  });
  it('refuses future days, very old days, and negative amounts', () => {
    const ok = { farm: 'SNR Farm', day: '2026-10-05', batches: [{ batchId: 'BULLS', items: [{ productId: 'PROD-F01', units: 6 }] }] };
    expect(dailyFeedProblem(ok, '2026-10-05')).toBeNull();
    expect(dailyFeedProblem({ ...ok, day: '2026-10-06' }, '2026-10-05')).toMatch(/not happened/);
    expect(dailyFeedProblem({ ...ok, day: '2026-07-01' }, '2026-10-05')).toMatch(/60 days/);
    expect(dailyFeedProblem({ ...ok, batches: [{ batchId: 'BULLS', items: [{ productId: 'PROD-F01', units: -1 }] }] }, '2026-10-05')).toMatch(/0 or more/);
    expect(dailyFeedProblem({ ...ok, farm: ' ' }, '2026-10-05')).toMatch(/farm/);
  });
});

describe('dailyFeedReport', () => {
  it('gives one row per farm per day with what was fed, the cost and who recorded it', () => {
    const txs = [
      tx('DAILY-BULLS-2026-10-05-PROD-F01', { quantityBags: 6, quantityKg: 180, totalCost: 180000, recordedBy: 'Dara' }),
      tx('DAILY-BULLS-2026-10-05-PROD-G', { productId: 'PROD-G', quantityBags: 450, quantityKg: 450, totalCost: 45000, recordedBy: 'Dara' }),
      tx('AUTO-RATION-BULLS-2026-10-04-PROD-F01', { quantityBags: 0.4, quantityKg: 12, totalCost: 12000 }),
    ];
    const rows = dailyFeedReport({ batches: [batch()], stock, feedProducts: [dsr, grass], feedTransactions: txs, healthLogs: [{ cowId: 'B1', date: '2026-10-05' } as never] }, '2026-10-03', '2026-10-05');
    expect(rows.map(r => [r.day, r.status])).toEqual([['2026-10-05', 'recorded'], ['2026-10-04', 'estimated'], ['2026-10-03', 'missing']]);
    expect(rows[0]).toMatchObject({ farm: 'SNR Farm', recordedBy: 'Dara', head: 2, bulls: 2, kg: 630, cost: 225000, treatments: 1 });
    expect(rows[0].items.map(i => [i.productName, i.units, i.unit])).toEqual([['DSR-16 Cow Feed', 6, 'bag'], ['Fresh Grass', 450, 'kg']]);
  });
  it('counts a batch\'s record, not its estimate, when both exist for a day', () => {
    const txs = [tx('DAILY-BULLS-2026-10-05-PROD-F01', { quantityBags: 6, quantityKg: 180 }), tx('AUTO-RATION-BULLS-2026-10-05-PROD-F01', { quantityBags: 9, quantityKg: 270 })];
    const [row] = dailyFeedReport({ batches: [batch()], stock, feedProducts: [dsr, grass], feedTransactions: txs }, '2026-10-05', '2026-10-05');
    expect(row.kg).toBe(180);
  });
});
