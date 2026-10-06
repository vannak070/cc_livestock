import { beforeEach, describe, expect, it, vi } from 'vitest';

const stock = vi.hoisted(() => ({ create: vi.fn(), delete: vi.fn(), findById: vi.fn() }));
const weight = vi.hoisted(() => ({ create: vi.fn() }));
const registrations = vi.hoisted(() => ({ record: vi.fn(), markRemoved: vi.fn() }));
const limits = vi.hoisted(() => ({ assertRoom: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stock }));
vi.mock('../repositories/weight.repository', () => ({ weightRepository: weight }));
vi.mock('../repositories/registration.repository', () => ({ registrationRepository: registrations }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: { getActiveUserById: vi.fn() } }));
vi.mock('./farm-limit.service', () => ({ farmLimitService: limits }));

import { StockService } from './stock.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new StockService();
const actor = (role: string) => ({ id: 'u', name: `${role} Person`, email: 'p@x.test', role, status: 'Active' }) as UserRoleItem;
const cow = { id: 'CC-1', location: 'SNR Farm', breed: 'B', age: '1', weight: 250, healthStatus: 'Good', status: 'Active', purchaseDate: '2026-10-01' };

describe('StockService.createStock', () => {
  beforeEach(() => {
    Object.values(stock).forEach(f => f.mockReset());
    Object.values(weight).forEach(f => f.mockReset());
    Object.values(registrations).forEach(f => f.mockReset());
    limits.assertRoom.mockReset().mockResolvedValue(undefined);
    stock.create.mockResolvedValue(cow);
  });

  it('writes the permanent registration record in the same transaction, with who registered it', async () => {
    await service.createStock(cow as never, 'Staff Person');
    expect(registrations.record).toHaveBeenCalledWith('CC-1', 'SNR Farm', 'Staff Person', { tx: true });
  });

  it('records nothing when the farm has no room (the limit check throws first)', async () => {
    limits.assertRoom.mockRejectedValue(new Error('SNR Farm has used its cattle limit'));
    await expect(service.createStock(cow as never, 'Staff')).rejects.toThrow(/cattle limit/);
    expect(stock.create).not.toHaveBeenCalled();
    expect(registrations.record).not.toHaveBeenCalled();
  });
});

describe('StockService.deleteStock', () => {
  beforeEach(() => {
    stock.delete.mockReset().mockResolvedValue(true);
    registrations.markRemoved.mockReset().mockResolvedValue(true);
  });

  it.each(['Super Admin', 'Admin'])('lets a %s remove an animal and marks its registration removed (kept, not billed)', async role => {
    await expect(service.deleteStock('CC-1', actor(role))).resolves.toBe(true);
    expect(registrations.markRemoved).toHaveBeenCalledWith('CC-1', `${role} Person`, expect.stringMatching(/mistake/), { tx: true });
  });

  it.each(['Company', 'Management', 'Farm Owner', 'Farm Staff', 'Veterinarian'])('refuses a %s with a 403, so deleting can never free a billed place', async role => {
    await expect(service.deleteStock('CC-1', actor(role))).rejects.toBeInstanceOf(AuthzError);
    await expect(service.deleteStock('CC-1', actor(role))).rejects.toMatchObject({ statusCode: 403 });
    expect(stock.delete).not.toHaveBeenCalled();
    expect(registrations.markRemoved).not.toHaveBeenCalled();
  });

  it('does not touch the registration when the animal was not found', async () => {
    stock.delete.mockResolvedValue(false);
    await expect(service.deleteStock('NOPE', actor('Admin'))).resolves.toBe(false);
    expect(registrations.markRemoved).not.toHaveBeenCalled();
  });
});
