import { beforeEach, describe, expect, it, vi } from 'vitest';

const stock = vi.hoisted(() => ({ create: vi.fn(), delete: vi.fn(), findById: vi.fn(), update: vi.fn() }));
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

describe('StockService.updateStock', () => {
  const original = { ...cow, weight: 250, healthStatus: 'Good', status: 'Active' };
  beforeEach(() => {
    stock.findById.mockReset().mockResolvedValue(original);
    stock.update.mockReset().mockImplementation(async (_id: string, u: object) => ({ ...original, ...u }));
    weight.create.mockReset();
    limits.assertRoom.mockReset().mockResolvedValue(undefined);
  });

  it("takes a place in the new farm's cattle limit when the animal moves farm", async () => {
    await service.updateStock('CC-1', { location: 'CC_001' });
    expect(limits.assertRoom).toHaveBeenCalledWith('CC_001', 1, { tx: true });
  });

  it('does not count the animal again for the same farm written differently', async () => {
    await service.updateStock('CC-1', { location: '  snr farm ' });
    expect(limits.assertRoom).not.toHaveBeenCalled();
  });

  it('keeps the animal where it is when the new farm has no room', async () => {
    limits.assertRoom.mockRejectedValue(new Error('CC_001 has used its cattle limit'));
    await expect(service.updateStock('CC-1', { location: 'CC_001' })).rejects.toThrow(/cattle limit/);
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('adds a weight history entry when the weight changes, with the gain against the old weight', async () => {
    await service.updateStock('CC-1', { weight: 275 });
    expect(weight.create).toHaveBeenCalledWith(expect.objectContaining({ oldWeight: 250, currentWeight: 275, gainLoss: 0.1 }), { tx: true });
  });

  it('adds no weight history entry for other edits', async () => {
    await service.updateStock('CC-1', { breed: 'Brahman' } as never);
    expect(weight.create).not.toHaveBeenCalled();
  });
});

describe('StockService.createMany', () => {
  const cows = ['CC-1', 'CC-2', 'CC-3'].map(id => ({ ...cow, id }));

  beforeEach(() => {
    Object.values(stock).forEach(f => f.mockReset());
    Object.values(weight).forEach(f => f.mockReset());
    Object.values(registrations).forEach(f => f.mockReset());
    limits.assertRoom.mockReset().mockResolvedValue(undefined);
    stock.findById.mockResolvedValue(null);
    stock.create.mockImplementation(async (item: { id: string }) => ({ ...cow, ...item }));
  });

  it('checks the farm limit once for the whole list, then registers and bills every animal', async () => {
    const out = await service.createMany(cows as never, 'Admin Person');
    expect(out.map(c => c.id)).toEqual(['CC-1', 'CC-2', 'CC-3']);
    expect(limits.assertRoom).toHaveBeenCalledTimes(1);
    expect(limits.assertRoom).toHaveBeenCalledWith('SNR Farm', 3, { tx: true });
    expect(registrations.record).toHaveBeenCalledTimes(3);
    expect(weight.create).toHaveBeenCalledTimes(3);
  });

  it('registers nothing when the farm has no room for the whole list', async () => {
    limits.assertRoom.mockRejectedValue(new Error('SNR Farm has room for 2 more'));
    await expect(service.createMany(cows as never, 'Admin')).rejects.toThrow(/room for 2/);
    expect(stock.create).not.toHaveBeenCalled();
    expect(registrations.record).not.toHaveBeenCalled();
  });

  it('stops on a tag that is already used', async () => {
    stock.findById.mockImplementation(async (id: string) => (id === 'CC-2' ? cow : null));
    await expect(service.createMany(cows as never, 'Admin')).rejects.toThrow(/CC-2 is already used/);
  });

  it('does nothing for an empty list', async () => {
    expect(await service.createMany([], 'Admin')).toEqual([]);
    expect(limits.assertRoom).not.toHaveBeenCalled();
  });
});

describe('cattle photos are checked on the server', () => {
  beforeEach(() => {
    Object.values(stock).forEach(f => f.mockReset());
    limits.assertRoom.mockReset().mockResolvedValue(undefined);
    stock.create.mockResolvedValue(cow);
    stock.findById.mockResolvedValue(cow);
    stock.update.mockResolvedValue(cow);
  });
  const ok = 'data:image/jpeg;base64,/9j/4AAQ';

  it('saves a small picture and refuses a wrong type or a huge one, before anything is written', async () => {
    await service.createStock({ ...cow, imageUrl: ok } as never, 'Staff');
    await expect(service.createStock({ ...cow, imageUrl: 'data:text/html;base64,PGgxPg==' } as never, 'Staff')).rejects.toThrow(/JPG, PNG or WebP/);
    await expect(service.createStock({ ...cow, imageUrl: `data:image/png;base64,${'A'.repeat(2_100_000)}` } as never, 'Staff')).rejects.toThrow(/too big/);
    await expect(service.createMany([{ ...cow, imageUrl: 'javascript:alert(1)' }] as never, 'Admin')).rejects.toThrow(/JPG, PNG or WebP/);
    await expect(service.updateStock('CC-1', { imageUrl: 'https://x.test/a.jpg' })).rejects.toThrow(/JPG, PNG or WebP/);
    expect(stock.create).toHaveBeenCalledTimes(1);
    expect(stock.update).not.toHaveBeenCalled();
  });

  it('removing a photo (empty value) is allowed', async () => {
    await service.updateStock('CC-1', { imageUrl: '' });
    expect(stock.update).toHaveBeenCalled();
  });
});
