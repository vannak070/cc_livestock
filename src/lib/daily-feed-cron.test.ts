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
const run = (batches: unknown[], transactions: unknown[] = [], products: unknown[] = [product]) =>
  processDailyFeedStockOuts({ batches, feedProducts: products, feedTransactions: transactions } as unknown as ERPLivestockData);

describe('processDailyFeedStockOuts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    vi.mocked(feedRepository.addTransactionIfNew).mockReset().mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it('records one STOCK_OUT per day from the batch start date through today', async () => {
    expect(await run([batch()])).toBe(3);
    const calls = vi.mocked(feedRepository.addTransactionIfNew).mock.calls.map(c => c[0]);
    expect(calls.map(t => t.referenceNo)).toEqual([
      'AUTO-RATION-B1-2026-10-03-0', 'AUTO-RATION-B1-2026-10-04-0', 'AUTO-RATION-B1-2026-10-05-0'
    ]);
    expect(calls[0]).toMatchObject({ type: 'STOCK_OUT', productId: 'FP-1', quantityKg: 6, quantityBags: 0.2, totalCost: 600 });
  });

  it('skips days that already have a deduction', async () => {
    const existing = [{ referenceNo: 'AUTO-RATION-B1-2026-10-03-0' }, { referenceNo: 'AUTO-RATION-B1-2026-10-04-0' }];
    expect(await run([batch()], existing)).toBe(1);
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

  it('caps the catch-up at about 60 days for old batches', async () => {
    await run([batch({ startDate: '2025-01-01' })]);
    const n = vi.mocked(feedRepository.addTransactionIfNew).mock.calls.length;
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(61);
  });
});
