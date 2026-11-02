import { beforeEach, describe, expect, it, vi } from 'vitest';

const costs = vi.hoisted(() => ({ create: vi.fn(), findById: vi.fn(), delete: vi.fn() }));
const settingsRepo = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock('../config/database', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../repositories/farm-cost.repository', () => ({ farmCostRepository: costs }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settingsRepo }));

import { FarmCostService } from './farm-cost.service';
import type { UserRoleItem } from '../lib/types';

const service = new FarmCostService();
const person = (id: string, role: string, farmLocation?: string) => ({ id, name: `${role} ${id}`, email: `${id}@x.test`, role, status: 'Active', farmLocation }) as UserRoleItem;
const office = person('CO', 'Company');
const staff = person('ST', 'Farm Staff', 'SNR Farm');
const cost = (over: object = {}) => ({ farmLocation: 'SNR Farm', category: 'Wages', amount: 250_000, date: '2026-10-01', note: ' Monthly ', ...over });

beforeEach(() => {
  Object.values(costs).forEach(f => f.mockReset());
  settingsRepo.getSettings.mockResolvedValue({});
  costs.create.mockImplementation(async (c: object) => c);
});

describe('FarmCostService.add', () => {
  it('saves a cost with a made-up id, the amount rounded, the note trimmed and who recorded it', async () => {
    const saved = await service.add(office, cost({ amount: 250_000.6 }));
    expect(saved).toMatchObject({ id: expect.stringMatching(/^COST-[0-9A-F]{8}$/), amount: 250_001, note: 'Monthly', recordedBy: 'Company CO', farmLocation: 'SNR Farm' });
  });

  it('lets farm staff record only their own farm', async () => {
    await expect(service.add(staff, cost())).resolves.toBeDefined();
    await expect(service.add(staff, cost({ farmLocation: 'CC_001' }))).rejects.toMatchObject({ statusCode: 403 });
    expect(costs.create).toHaveBeenCalledTimes(1);
  });

  it('uses the cost kinds from Settings when there are some', async () => {
    settingsRepo.getSettings.mockResolvedValue({ costCategories: ['Guards'] });
    await expect(service.add(office, cost({ category: 'Wages' }))).rejects.toThrow(/what the cost was for/);
    await expect(service.add(office, cost({ category: 'Guards' }))).resolves.toBeDefined();
  });

  it.each([
    ['no farm', { farmLocation: ' ' }, /which farm/],
    ['an amount of 0', { amount: 0 }, /how much was paid/],
    ['a negative amount', { amount: -5 }, /how much was paid/],
    ['an absurd amount', { amount: 20_000_000_000 }, /too big/],
    ['a bad date', { date: '1 Oct' }, /date it was paid/],
    ['a date in the future', { date: '2999-01-01' }, /cannot be in the future/],
  ])('refuses %s and saves nothing', async (_what, over, message) => {
    await expect(service.add(office, cost(over))).rejects.toThrow(message);
    expect(costs.create).not.toHaveBeenCalled();
  });
});

describe('FarmCostService.remove', () => {
  it('removes a cost of the person\'s own farm', async () => {
    costs.findById.mockResolvedValue({ id: 'C1', farmLocation: 'SNR Farm' });
    costs.delete.mockResolvedValue(true);
    await expect(service.remove(staff, 'C1')).resolves.toBe(true);
  });

  it("refuses removing another farm's cost, and tells you when it is already gone", async () => {
    costs.findById.mockResolvedValue({ id: 'C2', farmLocation: 'CC_001' });
    await expect(service.remove(staff, 'C2')).rejects.toMatchObject({ statusCode: 403 });
    expect(costs.delete).not.toHaveBeenCalled();
    costs.findById.mockResolvedValue(null);
    await expect(service.remove(staff, 'C3')).rejects.toThrow(/already removed/);
  });

  it('lets the office remove any farm\'s cost', async () => {
    costs.findById.mockResolvedValue({ id: 'C2', farmLocation: 'CC_001' });
    costs.delete.mockResolvedValue(true);
    await expect(service.remove(office, 'C2')).resolves.toBe(true);
  });
});
