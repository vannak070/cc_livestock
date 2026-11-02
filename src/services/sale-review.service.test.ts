import { beforeEach, describe, expect, it, vi } from 'vitest';

const batches = vi.hoisted(() => ({ findById: vi.fn(), update: vi.fn() }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: batches }));

import { SaleReviewService } from './sale-review.service';
import { farmToday, addDays } from '../lib/daily-feed';
import type { UserRoleItem } from '../lib/types';

const service = new SaleReviewService();
const manager = { id: 'MG', name: 'Mara', role: 'Management', status: 'Active' } as UserRoleItem;
const batch = (over: object = {}) => ({ id: 'B1', status: 'Active', sellingTargetDate: '2026-10-10T00:00:00.000Z', ...over });
const inDays = (n: number) => addDays(farmToday(), n);

beforeEach(() => {
  Object.values(batches).forEach(f => f.mockReset());
  batches.findById.mockResolvedValue(batch());
  batches.update.mockImplementation(async (_id: string, u: object) => ({ id: 'B1', ...u }));
});

describe('SaleReviewService.review', () => {
  it('"ready" records who decided and keeps the selling date', async () => {
    await service.review(manager, 'B1', { decision: 'ready', note: ' Buyer found ' });
    const update = batches.update.mock.calls[0][1];
    expect(update.saleReview).toMatchObject({ decision: 'ready', by: 'Mara', note: 'Buyer found' });
    expect(update).not.toHaveProperty('sellingTargetDate');
    expect(update.saleReview).not.toHaveProperty('previousTarget');
  });

  it('"extend" moves the selling date and remembers the one before', async () => {
    await service.review(manager, 'B1', { decision: 'extend', newTargetDate: inDays(30) });
    const update = batches.update.mock.calls[0][1];
    expect(update.sellingTargetDate).toBe(inDays(30));
    expect(update.saleReview).toMatchObject({ decision: 'extend', previousTarget: '2026-10-10' });
  });

  it.each([
    ['no new date', { decision: 'extend' as const }, /new selling date/],
    ['a date that is not after today', { decision: 'extend' as const, newTargetDate: farmToday() }, /after today/],
    ['a date more than a year away', { decision: 'extend' as const, newTargetDate: inDays(400) }, /more than a year/],
    ['a note that is too long', { decision: 'ready' as const, note: 'x'.repeat(501) }, /too long/],
  ])('refuses %s and changes nothing', async (_what, input, message) => {
    await expect(service.review(manager, 'B1', input)).rejects.toThrow(message);
    expect(batches.update).not.toHaveBeenCalled();
  });

  it('only a batch that is still active can be reviewed, and it must exist', async () => {
    batches.findById.mockResolvedValue(batch({ status: 'Closed' }));
    await expect(service.review(manager, 'B1', { decision: 'ready' })).rejects.toThrow(/still active/);
    batches.findById.mockResolvedValue(null);
    await expect(service.review(manager, 'B1', { decision: 'ready' })).rejects.toThrow(/no longer exists/);
  });

  it('says what to do when the database has not got the review column yet', async () => {
    batches.update.mockRejectedValue(new Error('column "sale_review" does not exist'));
    await expect(service.review(manager, 'B1', { decision: 'ready' })).rejects.toThrow(/safe-migrate/);
    batches.update.mockRejectedValue(new Error('something else'));
    await expect(service.review(manager, 'B1', { decision: 'ready' })).rejects.toThrow('something else');
  });
});
