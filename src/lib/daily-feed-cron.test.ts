import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/feed.repository', () => ({
  feedRepository: { addTransactionIfNew: vi.fn(), getProducts: vi.fn(), getTransactions: vi.fn() }
}));
vi.mock('../services/batch.service', () => ({ batchService: { getAllBatches: vi.fn() } }));

import { processDailyFeedStockOuts } from './daily-feed-cron';
import { feedRepository } from '../repositories/feed.repository';
import type { ERPLivestockData } from './types';

const product = { id: 'FP-1', name: 'Concentrate Feed', weightPerUnit: 30, unitCost: 100 };
const batch = (over: Record<string, unknown> = {}) => ({
  id: 'B1', name: 'Batch One', status: 'Active', startDate: '2026-10-03', farmLocation: 'Farm A',
  cowIds: ['C1', 'C2'],
  feedingProgram: { status: 'Active', ingredients: [{ name: 'Concentrate', portionPerHead: 3 }] },
  ...over
});
const herd = [{ id: 'C1', status: 'Active' }, { id: 'C2', status: 'Active' }, { id: 'C3', status: 'Sold' }];
const run = (batches: unknown[], transactions: unknown[] = [], products: unknown[] = [product], stock: unknown[] = herd) =>
  processDailyFeedStockOuts({ stock, batches, feedProducts: products, feedTransactions: transactions } as unknown as ERPLivestockData);

describe('processDailyFeedStockOuts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    vi.mocked(feedRepository.addTransactionIfNew).mockReset().mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  const refs = () => vi.mocked(feedRepository.addTransactionIfNew).mock.calls.map(c => c[0].referenceNo);

  it('estimates only today for a batch with no records yet, never charging past days', async () => {
    expect(await run([batch({ startDate: '2026-09-01' })])).toBe(1);
    expect(refs()).toEqual(['AUTO-RATION-B1-2026-10-05-FP-1']);
    const tx = vi.mocked(feedRepository.addTransactionIfNew).mock.calls[0][0];
    expect(tx).toMatchObject({ type: 'STOCK_OUT', productId: 'FP-1', quantityKg: 6, quantityBags: 0.2, totalCost: 600, date: '2026-10-05' });
  });

  it('fills in the days since the batch\'s last record or estimate', async () => {
    const existing = [{ referenceNo: 'AUTO-RATION-B1-2026-10-02-0' }];
    expect(await run([batch({ startDate: '2026-09-01' })], existing)).toBe(3);
    expect(refs()).toEqual(['AUTO-RATION-B1-2026-10-03-FP-1', 'AUTO-RATION-B1-2026-10-04-FP-1', 'AUTO-RATION-B1-2026-10-05-FP-1']);
  });

  it('never estimates a day the farm recorded', async () => {
    const existing = [{ referenceNo: 'AUTO-RATION-B1-2026-10-03-FP-1' }, { referenceNo: 'DAILY-B1-2026-10-04-FP-1' }];
    expect(await run([batch()], existing)).toBe(1);
    expect(refs()).toEqual(['AUTO-RATION-B1-2026-10-05-FP-1']);
  });

  it('uses the farm\'s (Phnom Penh) day: 01:00 there is still the previous day in UTC', async () => {
    vi.setSystemTime(new Date('2026-10-05T18:30:00Z')); // 01:30 on 6 Oct in Phnom Penh
    await run([batch()]);
    expect(refs()).toEqual(['AUTO-RATION-B1-2026-10-06-FP-1']);
  });

  it('does not take stock from a guessed feed when the plan\'s feed is not in the list', async () => {
    const other = { id: 'FP-2', name: 'Rice bran', weightPerUnit: 50, unitCost: 10 };
    expect(await run([batch({ feedingProgram: { status: 'Active', ingredients: [{ name: 'ចំណីសំរេច', portionPerHead: 3 }] } })], [], [other])).toBe(0);
  });

  it('follows the feed a plan is linked to, even when the names differ', async () => {
    await run([batch({ feedingProgram: { status: 'Active', ingredients: [{ name: 'ចំណីសំរេច (DSR-16)', productId: 'FP-1', portionPerHead: 3 }] } })]);
    expect(refs()).toEqual(['AUTO-RATION-B1-2026-10-05-FP-1']);
  });

  it('feeds only cattle still on the farm, not sold ones still listed on the batch', async () => {
    expect(await run([batch({ cowIds: ['C1', 'C2', 'C3'] })])).toBe(1);
    const first = vi.mocked(feedRepository.addTransactionIfNew).mock.calls[0][0];
    expect(first.quantityKg).toBe(6); // 3 kg x 2 active head, not 3 head
  });

  it('records nothing for a batch whose cattle have all been sold', async () => {
    expect(await run([batch({ cowIds: ['C3'] })])).toBe(0);
  });

  it('does not count rows another process already wrote (insert reports no-op)', async () => {
    vi.mocked(feedRepository.addTransactionIfNew).mockResolvedValue(false);
    expect(await run([batch()])).toBe(0);
  });

  it('ignores closed batches, inactive programs and empty batches', async () => {
    const out = await run([
      batch({ status: 'Closed' }),
      batch({ id: 'B2', feedingProgram: { status: 'Paused', ingredients: [{ name: 'Concentrate', portionPerHead: 3 }] } }),
      batch({ id: 'B3', cowIds: [] })
    ]);
    expect(out).toBe(0);
    expect(feedRepository.addTransactionIfNew).not.toHaveBeenCalled();
  });

  it('does nothing without any feed products', async () => {
    expect(await run([batch()], [], [])).toBe(0);
  });

  it('caps the catch-up at about 60 days after a long gap', async () => {
    await run([batch({ startDate: '2025-01-01' })], [{ referenceNo: 'AUTO-RATION-B1-2025-02-01-0' }]);
    const n = vi.mocked(feedRepository.addTransactionIfNew).mock.calls.length;
    expect(n).toBe(61);
  });
});
