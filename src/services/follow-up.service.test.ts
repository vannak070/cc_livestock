import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ closeOpenFor: vi.fn(), create: vi.fn(), findById: vi.fn(), markDone: vi.fn() }));
const stock = vi.hoisted(() => ({ findById: vi.fn() }));
const guard = vi.hoisted(() => ({ cows: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({}), query: vi.fn() }));
vi.mock('../repositories/follow-up.repository', () => ({ followUpRepository: repo }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: { getActiveUserById: vi.fn() } }));
vi.mock('../lib/farm-guard', () => ({ farmGuard: guard }));

import { FollowUpService } from './follow-up.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new FollowUpService();
const manager = { id: 'u1', name: 'Manager', email: 'm@x.test', role: 'Management', status: 'Active' } as UserRoleItem;
const staff = { id: 'u2', name: 'Staff', email: 's@x.test', role: 'Farm Staff', status: 'Active', farmLocation: 'Farm A' } as UserRoleItem;
const input = { action: 'sell' as const, note: 'ready', dueDate: '' };

describe('FollowUpService.record', () => {
  beforeEach(() => {
    Object.values(repo).forEach(f => f.mockReset());
    stock.findById.mockReset().mockResolvedValue({ id: 'A1', status: 'Active' });
    guard.cows.mockReset().mockResolvedValue(undefined);
  });

  it('is for people who review (Management here), and records after closing the animal\'s earlier open action', async () => {
    const order: string[] = [];
    repo.closeOpenFor.mockImplementation(async () => { order.push('close'); });
    repo.create.mockImplementation(async () => { order.push('create'); });
    const f = await service.record(manager, 'A1', input);
    expect(order).toEqual(['close', 'create']);
    expect(f).toMatchObject({ cowId: 'A1', action: 'sell', note: 'ready', createdBy: 'Manager' });
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty('dueDate');
  });

  it('refuses Farm Staff (no batch_review) with a 403 before touching anything', async () => {
    await expect(service.record(staff, 'A1', input)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.record(staff, 'A1', input)).rejects.toBeInstanceOf(AuthzError);
    expect(repo.create).not.toHaveBeenCalled();
    expect(stock.findById).not.toHaveBeenCalled();
  });

  it('applies the farm guard (a farm user cannot record for another farm\'s animal)', async () => {
    guard.cows.mockRejectedValue(new AuthzError('You can only work with records from your own farm.', 403));
    const owner = { ...staff, role: 'Farm Owner', permissions: ['batch_review'] } as UserRoleItem;
    await expect(service.record(owner, 'B1', input)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('refuses unknown animals, animals no longer on the farm, and bad input', async () => {
    stock.findById.mockResolvedValueOnce(null);
    await expect(service.record(manager, 'NOPE', input)).rejects.toThrow(/not found/);
    stock.findById.mockResolvedValueOnce({ id: 'S1', status: 'Sold' });
    await expect(service.record(manager, 'S1', input)).rejects.toThrow(/no longer on the farm/);
    await expect(service.record(manager, 'A1', { action: 'other', note: '', dueDate: '' })).rejects.toThrow(/Write what/);
    await expect(service.record(manager, 'A1', { action: 'sell', note: '', dueDate: '2020-01-01' })).rejects.toThrow(/today or a later/);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('FollowUpService.finish', () => {
  beforeEach(() => { Object.values(repo).forEach(f => f.mockReset()); guard.cows.mockReset().mockResolvedValue(undefined); });

  it('marks it done, checks the farm of its animal, and reports an already-done one', async () => {
    repo.findById.mockResolvedValue({ id: 'F1', cowId: 'A1' });
    repo.markDone.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.finish(manager, 'F1')).resolves.toBeUndefined();
    expect(guard.cows).toHaveBeenCalledWith(manager, ['A1']);
    await expect(service.finish(manager, 'F1')).rejects.toThrow(/already marked done/);
  });

  it('refuses Farm Staff and unknown ids', async () => {
    await expect(service.finish(staff, 'F1')).rejects.toMatchObject({ statusCode: 403 });
    repo.findById.mockResolvedValue(null);
    await expect(service.finish(manager, 'NOPE')).rejects.toThrow(/no longer exists/);
  });
});
