import { beforeEach, describe, expect, it, vi } from 'vitest';

const regs = vi.hoisted(() => ({ between: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn(), patchBlob: vi.fn(), getActiveUserById: vi.fn() }));
vi.mock('../repositories/registration.repository', () => ({ registrationRepository: regs }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));

import { BillingService } from './billing.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new BillingService();
const actor = (role: string) => ({ id: 'u', name: 'P', email: 'p@x.test', role, status: 'Active' }) as UserRoleItem;

describe('BillingService', () => {
  beforeEach(() => {
    regs.between.mockReset().mockResolvedValue([]);
    settings.getSettings.mockReset().mockResolvedValue({ billing: { prices: [{ from: '2026-10', price: 5000 }] } });
    settings.patchBlob.mockReset().mockResolvedValue(undefined);
  });

  it.each(['Company', 'Management', 'Farm Owner', 'Farm Staff', 'Veterinarian'])('keeps the bill and the price away from a %s', async role => {
    await expect(service.view(actor(role))).rejects.toBeInstanceOf(AuthzError);
    await expect(service.savePrices(actor(role), { prices: [{ from: '2026-10', price: 1 }] })).rejects.toMatchObject({ statusCode: 403 });
    expect(regs.between).not.toHaveBeenCalled();
    expect(settings.patchBlob).not.toHaveBeenCalled();
  });

  it('builds a statement for the chosen month from the registration records', async () => {
    regs.between.mockResolvedValue([
      { cowId: 'A', farm: 'SNR Farm', month: '2026-10', registeredAt: '2026-10-05T03:00:00Z', registeredBy: 'M' },
      { cowId: 'B', farm: 'SNR Farm', month: '2026-10', registeredAt: '2026-10-06T03:00:00Z', registeredBy: 'M' },
    ]);
    const view = await service.view(actor('Admin'), '2026-10');
    expect(view.statement).toMatchObject({ month: '2026-10', price: 5000, cattle: 2, amount: 10000 });
    expect(view.recent).toHaveLength(12);
    expect(regs.between.mock.calls[0][0] <= '2026-10').toBe(true);
  });

  it('rejects a month that is not YYYY-MM', async () => {
    await expect(service.view(actor('Admin'), '2026-13')).rejects.toThrow(/Choose a month/);
    await expect(service.view(actor('Admin'), 'October')).rejects.toThrow(/Choose a month/);
  });

  it('saves a valid price list sorted and trimmed, and refuses a bad one', async () => {
    const saved = await service.savePrices(actor('Super Admin'), { prices: [{ from: '2027-01', price: 6000 }, { from: '2026-10', price: 5000 }, { from: '2026-10', price: 5000 }].slice(0, 2) });
    expect(saved.prices.map(p => p.from)).toEqual(['2026-10', '2027-01']);
    expect(settings.patchBlob).toHaveBeenCalledWith({ billing: saved });
    await expect(service.savePrices(actor('Admin'), { prices: [] })).rejects.toThrow(/Add a price/);
    await expect(service.savePrices(actor('Admin'), { prices: [{ from: '2026-10', price: -5 }] })).rejects.toThrow(/whole number/);
  });
});
