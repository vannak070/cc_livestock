import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsRepo = vi.hoisted(() => ({ getSettings: vi.fn(), patchBlob: vi.fn() }));
const farmRepo = vi.hoisted(() => ({ countRegisteredCattle: vi.fn() }));
const limitRepo = vi.hoisted(() => ({ pendingFor: vi.fn(), createRequest: vi.fn(), findRequestById: vi.fn(), decide: vi.fn(), logChange: vi.fn() }));
const telegram = vi.hoisted(() => ({ isConfigured: vi.fn(), send: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settingsRepo }));
vi.mock('../repositories/farm.repository', () => ({ farmRepository: farmRepo }));
vi.mock('../repositories/farm-limit.repository', () => ({ farmLimitRepository: limitRepo }));
vi.mock('./telegram.service', () => ({ telegramService: telegram }));

import { FarmLimitService } from './farm-limit.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new FarmLimitService();
const person = (id: string, role: string, farmLocation?: string) => ({ id, name: `${role} ${id}`, email: `${id}@x.test`, role, status: 'Active', farmLocation }) as UserRoleItem;
const admin = person('AD', 'Admin');
const owner = person('OW', 'Farm Owner', 'SNR Farm');
const management = person('MG', 'Management');
const farms = [{ id: 'F1', name: 'SNR Farm', capacity: 100 }, { id: 'F2', name: 'CC_001', capacity: 0 }];

beforeEach(() => {
  [settingsRepo, farmRepo, limitRepo, telegram].forEach(m => Object.values(m).forEach(f => f.mockReset()));
  settingsRepo.getSettings.mockResolvedValue({ farms });
  farmRepo.countRegisteredCattle.mockResolvedValue(90);
  limitRepo.createRequest.mockImplementation(async (r: object) => ({ ...r, status: 'pending' }));
  telegram.isConfigured.mockReturnValue(false);
});

describe('FarmLimitService.assertRoom', () => {
  it('lets cattle in while they fit', async () => {
    await expect(service.assertRoom('SNR Farm', 10)).resolves.toBeUndefined();
  });

  it('refuses cattle that would go over the limit, saying how many fit', async () => {
    await expect(service.assertRoom('SNR Farm', 11)).rejects.toThrow(/room for 10 more of its 100 cattle, not 11/);
    await expect(service.assertRoom('SNR Farm', 1)).resolves.toBeUndefined();
  });

  it('refuses a farm with no limit set yet', async () => {
    await expect(service.assertRoom('CC_001', 1)).rejects.toThrow(/no cattle limit yet/);
  });

  it('finds the farm whatever the capitals and spaces, and leaves unknown farms to other checks', async () => {
    await expect(service.assertRoom('  snr farm ', 11)).rejects.toThrow(/room for 10/);
    await expect(service.assertRoom('Nowhere', 5)).resolves.toBeUndefined();
    await expect(service.assertRoom('', 5)).resolves.toBeUndefined();
    await expect(service.assertRoom(undefined, 5)).resolves.toBeUndefined();
  });

  it('adds nothing to check when no cattle are being added', async () => {
    await expect(service.assertRoom('SNR Farm', 0)).resolves.toBeUndefined();
    expect(farmRepo.countRegisteredCattle).not.toHaveBeenCalled();
  });
});

describe('FarmLimitService.request', () => {
  const ask = { farm: 'SNR Farm', extra: 20, reason: ' New batch coming ' };

  it('lets a farm owner ask for their own farm, and keeps who asked', async () => {
    await service.request(owner, ask);
    expect(limitRepo.createRequest).toHaveBeenCalledWith(expect.objectContaining({ farmLocation: 'SNR Farm', extra: 20, reason: 'New batch coming', requestedBy: 'Farm Owner OW' }));
  });

  it("refuses a farm account asking for another farm, and anyone without the right to ask", async () => {
    await expect(service.request(owner, { ...ask, farm: 'CC_001' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.request(management, ask)).rejects.toBeInstanceOf(AuthzError);
  });

  it('allows one waiting request per farm', async () => {
    limitRepo.pendingFor.mockResolvedValue({ extra: 5 });
    await expect(service.request(owner, ask)).rejects.toThrow(/already has a request waiting \(for 5 more\)/);
    expect(limitRepo.createRequest).not.toHaveBeenCalled();
  });

  it.each([[0], [1.5], [-3]])('refuses asking for %s more', async extra => {
    await expect(service.request(owner, { ...ask, extra })).rejects.toThrow(/whole number/);
  });

  it('never loses the request when the Telegram message fails', async () => {
    telegram.isConfigured.mockReturnValue(true);
    settingsRepo.getSettings.mockResolvedValue({ farms, alerts: { telegramEnabled: true, chatId: '1' } });
    telegram.send.mockRejectedValue(new Error('Telegram is down'));
    await expect(service.request(owner, ask)).resolves.toMatchObject({ status: 'pending' });
  });
});

describe('FarmLimitService.decide', () => {
  beforeEach(() => limitRepo.findRequestById.mockResolvedValue({ id: 'R1', farmLocation: 'SNR Farm', status: 'pending', reason: 'More' }));

  it('only a Super Admin or Admin answers a request', async () => {
    await expect(service.decide(owner, 'R1', true, 120, '')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.decide(management, 'R1', false, 0, '')).rejects.toMatchObject({ statusCode: 403 });
    expect(limitRepo.decide).not.toHaveBeenCalled();
  });

  it('approving sets the new limit on the farm, and logs it with the request', async () => {
    limitRepo.decide.mockResolvedValue(true);
    await service.decide(admin, 'R1', true, 120, ' OK ');
    expect(limitRepo.decide).toHaveBeenCalledWith('R1', { status: 'approved', decidedBy: 'Admin AD', note: 'OK', newLimit: 120 }, { tx: true });
    expect(settingsRepo.patchBlob).toHaveBeenCalledWith({ farms: [{ id: 'F1', name: 'SNR Farm', capacity: 120 }, farms[1]] }, { tx: true });
    expect(limitRepo.logChange).toHaveBeenCalledWith(expect.objectContaining({ farmLocation: 'SNR Farm', oldLimit: 100, newLimit: 120, requestId: 'R1' }), { tx: true });
  });

  it('refuses a new limit below the cattle already registered', async () => {
    await expect(service.decide(admin, 'R1', true, 89, '')).rejects.toThrow(/cannot be lower/);
    expect(settingsRepo.patchBlob).not.toHaveBeenCalled();
  });

  it('declining changes no limit', async () => {
    limitRepo.decide.mockResolvedValue(true);
    await service.decide(admin, 'R1', false, 0, 'Not now');
    expect(limitRepo.decide).toHaveBeenCalledWith('R1', { status: 'declined', decidedBy: 'Admin AD', note: 'Not now' });
    expect(settingsRepo.patchBlob).not.toHaveBeenCalled();
  });

  it('two admins answering the same request: the second is told it was already answered, and the limit changes once', async () => {
    limitRepo.decide.mockResolvedValue(false); // the first admin got there first
    await expect(service.decide(admin, 'R1', true, 120, '')).rejects.toThrow(/already answered/);
    expect(settingsRepo.patchBlob).not.toHaveBeenCalled();
    expect(limitRepo.logChange).not.toHaveBeenCalled();
  });

  it('refuses a request that is gone or already answered', async () => {
    limitRepo.findRequestById.mockResolvedValue(null);
    await expect(service.decide(admin, 'R1', true, 120, '')).rejects.toThrow(/no longer exists/);
    limitRepo.findRequestById.mockResolvedValue({ id: 'R1', farmLocation: 'SNR Farm', status: 'approved' });
    await expect(service.decide(admin, 'R1', true, 120, '')).rejects.toThrow(/already answered/);
  });
});

describe('FarmLimitService.logDirectChange', () => {
  it('records a changed limit and ignores an unchanged one', async () => {
    await service.logDirectChange(admin, 'SNR Farm', 100, 100);
    expect(limitRepo.logChange).not.toHaveBeenCalled();
    await service.logDirectChange(admin, 'SNR Farm', 100, 150);
    expect(limitRepo.logChange).toHaveBeenCalledWith(expect.objectContaining({ oldLimit: 100, newLimit: 150, changedBy: 'Admin AD' }), undefined);
  });
});
