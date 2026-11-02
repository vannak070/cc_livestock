import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ contracts: vi.fn(), saveContract: vi.fn() }));
const batches = vi.hoisted(() => ({ findById: vi.fn() }));
vi.mock('../repositories/action-plan.repository', () => ({ actionPlanRepository: repo }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: batches }));

import { ActionPlanService } from './action-plan.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new ActionPlanService();
const person = (role: string) => ({ id: role, name: `${role} Person`, email: 'p@x.test', role, status: 'Active' }) as UserRoleItem;
const admin = person('Admin');
const management = person('Management');

beforeEach(() => {
  [repo, batches].forEach(m => Object.values(m).forEach(f => f.mockReset()));
  repo.contracts.mockResolvedValue([]);
});

describe('who may do what', () => {
  it('lets Management read the contracts, for a month or a day (read as its month)', async () => {
    await expect(service.view(management, '2026-10')).resolves.toMatchObject({ month: '2026-10', contracts: [] });
    await expect(service.view(management, '2026-10-05')).resolves.toMatchObject({ month: '2026-10' });
  });

  it.each(['Company', 'Farm Owner', 'Farm Staff'])('a %s cannot even see contracts (prices are inside)', async role => {
    await expect(service.view(person(role))).rejects.toBeInstanceOf(AuthzError);
  });

  it('refuses a month that is not a month', async () => {
    await expect(service.view(management, 'October')).rejects.toThrow(/Choose a month/);
  });

  it('Management cannot write a contract', async () => {
    await expect(service.saveContract(management, 'B1', { contractNo: 'C-1', notes: '' })).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.saveContract).not.toHaveBeenCalled();
  });
});

describe('ActionPlanService.saveContract', () => {
  it('saves the contract for an existing batch', async () => {
    batches.findById.mockResolvedValue({ id: 'B1' });
    await service.saveContract(admin, 'B1', { contractNo: 'C-7', buybackPricePerKg: 12_000, notes: '' });
    expect(repo.saveContract).toHaveBeenCalledWith('B1', { contractNo: 'C-7', buybackPricePerKg: 12_000, notes: '' }, 'Admin Person');
  });

  it('refuses Management, a bad price, and a batch that is gone', async () => {
    await expect(service.saveContract(management, 'B1', { contractNo: '', notes: '' })).rejects.toBeInstanceOf(AuthzError);
    await expect(service.saveContract(admin, 'B1', { contractNo: '', buybackPricePerKg: -5, notes: '' })).rejects.toThrow(/more than 0/);
    batches.findById.mockResolvedValue(null);
    await expect(service.saveContract(admin, 'B1', { contractNo: '', notes: '' })).rejects.toThrow(/no longer exists/);
    expect(repo.saveContract).not.toHaveBeenCalled();
  });
});
