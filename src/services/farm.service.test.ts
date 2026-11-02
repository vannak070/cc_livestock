import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsRepo = vi.hoisted(() => ({ getSettings: vi.fn(), patchBlob: vi.fn(), findUserById: vi.fn(), setUserRole: vi.fn() }));
const farmRepo = vi.hoisted(() => ({ countRegisteredCattle: vi.fn(), renameEverywhere: vi.fn(), countActiveCattle: vi.fn(), countActiveBatches: vi.fn(), countPeople: vi.fn() }));
const limits = vi.hoisted(() => ({ logDirectChange: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settingsRepo }));
vi.mock('../repositories/farm.repository', () => ({ farmRepository: farmRepo }));
vi.mock('./farm-limit.service', () => ({ farmLimitService: limits }));

import { FarmService } from './farm.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new FarmService();
const person = (id: string, role: string, farmLocation?: string, extra: object = {}) =>
  ({ id, name: `${role} ${id}`, email: `${id}@x.test`, role, status: 'Active', farmLocation, ...extra }) as UserRoleItem;
const superAdmin = person('SA', 'Super Admin');
const company = person('CO', 'Company');
const owner = person('OW', 'Farm Owner', 'SNR Farm');
const farms = [{ id: 'F1', name: 'SNR Farm', capacity: 100, address: '' }, { id: 'F2', name: 'CC_001', capacity: 50, address: '' }];
const form = (over: object = {}) => ({ name: 'SNR Farm', address: '', capacity: 100, notes: '', ...over });

beforeEach(() => {
  [settingsRepo, farmRepo, limits].forEach(m => Object.values(m).forEach(f => f.mockReset()));
  settingsRepo.getSettings.mockResolvedValue({ farms, users: [owner, person('ST', 'Farm Staff', 'SNR Farm'), person('VET', 'Veterinarian', 'SNR Farm'), person('X', 'Farm Staff', 'CC_001')] });
  farmRepo.countRegisteredCattle.mockResolvedValue(40);
  farmRepo.countActiveCattle.mockResolvedValue(0);
  farmRepo.countActiveBatches.mockResolvedValue(0);
  farmRepo.countPeople.mockResolvedValue(0);
});

describe('FarmService.saveFarm', () => {
  it('lets a farm account (no farms_manage or settings_manage) do nothing', async () => {
    await expect(service.saveFarm(owner, form({ name: 'X' }), null)).rejects.toBeInstanceOf(AuthzError);
  });

  it('adds a farm, with the limit an admin chose, and logs the limit', async () => {
    await service.saveFarm(superAdmin, form({ name: 'New Farm', capacity: 30 }), null);
    expect(settingsRepo.patchBlob).toHaveBeenCalledWith({ farms: expect.arrayContaining([expect.objectContaining({ name: 'New Farm', capacity: 30 })]) }, { tx: true });
    expect(limits.logDirectChange).toHaveBeenCalledWith(superAdmin, 'New Farm', 0, 30, { tx: true });
  });

  it('only a Super Admin or Admin sets a limit: an office account adding a farm gets no limit (0)', async () => {
    await service.saveFarm(company, form({ name: 'New Farm', capacity: 999 }), null);
    expect(settingsRepo.patchBlob).toHaveBeenCalledWith({ farms: expect.arrayContaining([expect.objectContaining({ name: 'New Farm', capacity: 0 })]) }, { tx: true });
  });

  it('an office account editing a farm keeps the limit it has', async () => {
    await service.saveFarm(company, form({ capacity: 5 }), 'F1');
    expect(settingsRepo.patchBlob).toHaveBeenCalledWith({ farms: expect.arrayContaining([expect.objectContaining({ id: 'F1', capacity: 100 })]) }, { tx: true });
  });

  it('refuses a limit below the cattle already registered on the farm', async () => {
    await expect(service.saveFarm(superAdmin, form({ capacity: 39 }), 'F1')).rejects.toThrow(/already has 40 cattle registered/);
    expect(settingsRepo.patchBlob).not.toHaveBeenCalled();
  });

  it('renames a farm everywhere in one transaction, with the new name saved after the cattle and people move', async () => {
    await service.saveFarm(superAdmin, form({ name: 'SNR Farm 2' }), 'F1');
    expect(farmRepo.renameEverywhere).toHaveBeenCalledWith('SNR Farm', 'SNR Farm 2', { tx: true });
    expect(farmRepo.renameEverywhere.mock.invocationCallOrder[0]).toBeLessThan(settingsRepo.patchBlob.mock.invocationCallOrder[0]);
  });

  it('refuses a name another farm has (any capitals), an empty name, and a farm that is gone', async () => {
    await expect(service.saveFarm(superAdmin, form({ name: 'cc_001' }), 'F1')).rejects.toThrow(/already a farm called/);
    await expect(service.saveFarm(superAdmin, form({ name: '  ' }), null)).rejects.toThrow(/name of the farm/);
    await expect(service.saveFarm(superAdmin, form(), 'GONE')).rejects.toThrow(/no longer exists/);
    expect(farmRepo.renameEverywhere).not.toHaveBeenCalled();
  });
});

describe('FarmService.deleteFarm', () => {
  it.each([
    ['cattle', () => farmRepo.countActiveCattle.mockResolvedValue(3), /3 active animals/],
    ['an active batch', () => farmRepo.countActiveBatches.mockResolvedValue(1), /1 active batch/],
    ['a person', () => farmRepo.countPeople.mockResolvedValue(2), /2 people/],
  ])('will not delete a farm that still has %s', async (_what, setUp, message) => {
    setUp();
    await expect(service.deleteFarm(superAdmin, 'F1')).rejects.toThrow(message);
    expect(settingsRepo.patchBlob).not.toHaveBeenCalled();
  });

  it('deletes an empty farm and leaves the others', async () => {
    await service.deleteFarm(superAdmin, 'F1');
    expect(settingsRepo.patchBlob).toHaveBeenCalledWith({ farms: [farms[1]] });
  });

  it('a farm account cannot delete a farm', async () => {
    await expect(service.deleteFarm(owner, 'F1')).rejects.toBeInstanceOf(AuthzError);
  });
});

describe('FarmService.setOwner', () => {
  it('makes a staff member the owner and the old owner Farm Staff, together', async () => {
    settingsRepo.findUserById.mockResolvedValue(person('ST', 'Farm Staff', 'SNR Farm'));
    await service.setOwner(superAdmin, 'F1', 'ST');
    expect(settingsRepo.setUserRole).toHaveBeenCalledWith('OW', 'Farm Staff', expect.any(Array), { tx: true });
    expect(settingsRepo.setUserRole).toHaveBeenCalledWith('ST', 'Farm Owner', expect.any(Array), { tx: true });
  });

  it('refuses someone from another farm, and roles that cannot own a farm', async () => {
    settingsRepo.findUserById.mockResolvedValue(person('X', 'Farm Staff', 'CC_001'));
    await expect(service.setOwner(superAdmin, 'F1', 'X')).rejects.toThrow(/works on this farm/);
    settingsRepo.findUserById.mockResolvedValue(person('CO2', 'Company', 'SNR Farm'));
    await expect(service.setOwner(superAdmin, 'F1', 'CO2')).rejects.toThrow(/cannot be made the owner/);
    expect(settingsRepo.setUserRole).not.toHaveBeenCalled();
  });

  it('does not let someone give owner access they do not hold themselves', async () => {
    const limited = person('LM', 'Custom', undefined, { permissions: ['settings_manage', 'farms_manage'] });
    settingsRepo.findUserById.mockResolvedValue(person('ST', 'Farm Staff', 'SNR Farm'));
    await expect(service.setOwner(limited, 'F1', 'ST')).rejects.toThrow(/cannot give owner access/);
    expect(settingsRepo.setUserRole).not.toHaveBeenCalled();
  });
});
