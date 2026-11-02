import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn(), renameRole: vi.fn(), applyRoleAccess: vi.fn(), countUsersWithRole: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: repo }));

import { SettingsService } from './settings.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';

const service = new SettingsService();
const person = (id: string, role: string, permissions?: string[]) => ({ id, name: `${role} ${id}`, email: `${id}@x.test`, role, status: 'Active', permissions }) as UserRoleItem;
const superAdmin = person('SA', 'Super Admin');
const staff = person('ST', 'Farm Staff');
const feedManager = person('FM', 'Custom', ['feed_manage']);
const system = { id: 'ROLE-01', name: 'Super Admin', description: '', permissions: ['stock_view'], isSystem: true };
const custom = { id: 'ROLE-90', name: 'Cashier', description: '', permissions: ['stock_view'], isSystem: false };
const current = () => ({
  roles: [system, custom], feedTypes: ['Grass'], costCategories: ['Wages', 'Other'], saleReviewDays: 15, longStayMonths: 6,
  users: [], farms: [], alerts: { telegramEnabled: false },
});

beforeEach(() => {
  Object.values(repo).forEach(f => f.mockReset());
  repo.getSettings.mockResolvedValue(current());
  repo.countUsersWithRole.mockResolvedValue(0);
});

describe('SettingsService.updateSettings: which parts a save may change', () => {
  it('ignores people, farms, the old location list, billing and status: they have their own operations', async () => {
    await service.updateSettings({ users: [], farms: [{ id: 'F', name: 'Ghost' }], locations: ['Ghost'], billing: { prices: [] }, websiteStatus: {} } as never, superAdmin);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  it('needs no permission for sections that did not change (a screen may send the whole document back)', async () => {
    await service.updateSettings(current() as never, staff);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  it('changing a list needs settings_manage', async () => {
    await expect(service.updateSettings({ saleReviewDays: 20 }, staff)).rejects.toBeInstanceOf(AuthzError);
    await expect(service.updateSettings({ saleReviewDays: 20 }, feedManager)).rejects.toMatchObject({ statusCode: 403 });
    await service.updateSettings({ saleReviewDays: 20 }, superAdmin);
    expect(repo.updateSettings).toHaveBeenCalledWith({ saleReviewDays: 20 }, { tx: true });
  });

  it('the feed list can also be changed by someone who manages feed', async () => {
    await service.updateSettings({ feedTypes: ['Grass', 'Hay'] }, feedManager);
    expect(repo.updateSettings).toHaveBeenCalledWith({ feedTypes: ['Grass', 'Hay'] }, { tx: true });
    await expect(service.updateSettings({ feedTypes: ['X'], saleReviewDays: 20 }, feedManager)).rejects.toBeInstanceOf(AuthzError);
  });

  it('checks a changed section and writes nothing when one part is refused', async () => {
    await expect(service.updateSettings({ feedTypes: ['X'], saleReviewDays: 5000 }, superAdmin)).rejects.toThrow(/whole number of days/);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });
});

describe('SettingsService.updateSettings: the checked values', () => {
  it('trims the cost kinds and refuses an empty or repeated list', async () => {
    await service.updateSettings({ costCategories: [' Wages ', 'Rent'] }, superAdmin);
    expect(repo.updateSettings).toHaveBeenCalledWith({ costCategories: ['Wages', 'Rent'] }, { tx: true });
    await expect(service.updateSettings({ costCategories: [] }, superAdmin)).rejects.toThrow();
  });

  it.each([[0], [1.5], [999]])('refuses %s months for a long stay', async months => {
    await expect(service.updateSettings({ longStayMonths: months }, superAdmin)).rejects.toThrow(/whole number of months/);
  });

  it('refuses turning Telegram alerts on without a group, and a bad hour', async () => {
    await expect(service.updateSettings({ alerts: { telegramEnabled: true, chatId: '' } as never }, superAdmin)).rejects.toThrow(/Telegram group/);
    await expect(service.updateSettings({ alerts: { telegramEnabled: false, sendHour: 25 } as never }, superAdmin)).rejects.toThrow(/0 to 23/);
  });
});

describe('SettingsService.updateSettings: roles', () => {
  const withRoles = (roles: object[]) => ({ roles } as never);

  it('the built-in roles cannot be deleted or renamed', async () => {
    await expect(service.updateSettings(withRoles([custom]), superAdmin)).rejects.toThrow(/built-in roles cannot be deleted/);
    await expect(service.updateSettings(withRoles([{ ...system, name: 'Boss' }, custom]), superAdmin)).rejects.toThrow(/keeps its name/);
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  it('a role people still hold cannot be removed', async () => {
    repo.countUsersWithRole.mockResolvedValue(2);
    await expect(service.updateSettings(withRoles([system]), superAdmin)).rejects.toThrow(/2 people have the Cashier role/);
    repo.countUsersWithRole.mockResolvedValue(1);
    await expect(service.updateSettings(withRoles([system]), superAdmin)).rejects.toThrow(/1 person has the Cashier role/);
  });

  it('refuses two roles with the same name, whatever the capitals', async () => {
    await expect(service.updateSettings(withRoles([system, custom, { ...custom, id: 'ROLE-91', name: ' cashier ' }]), superAdmin)).rejects.toThrow(/already a role called/);
  });

  it('renaming a role moves its people to the new name, and a changed access reaches the people who follow it, after the rename', async () => {
    await service.updateSettings(withRoles([system, { ...custom, name: 'Counter', permissions: ['stock_view', 'sales_view'] }]), superAdmin);
    expect(repo.renameRole).toHaveBeenCalledWith('Cashier', 'Counter', { tx: true });
    expect(repo.applyRoleAccess).toHaveBeenCalledWith('Counter', ['stock_view'], ['stock_view', 'sales_view'], { tx: true });
    expect(repo.renameRole.mock.invocationCallOrder[0]).toBeLessThan(repo.applyRoleAccess.mock.invocationCallOrder[0]);
  });

  it('nobody gives a role access they do not hold themselves', async () => {
    const limited = person('LM', 'Custom', ['settings_manage', 'stock_view']);
    await expect(service.updateSettings(withRoles([system, { ...custom, permissions: ['stock_view', 'billing_view' as never, 'sales_delete'] }]), limited)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.updateSettings).not.toHaveBeenCalled();
  });

  it('a role keeps the access it already had even if the person saving does not hold it', async () => {
    const limited = person('LM', 'Custom', ['settings_manage']);
    repo.getSettings.mockResolvedValue({ ...current(), roles: [system, { ...custom, permissions: ['sales_delete'] }] });
    await expect(service.updateSettings(withRoles([system, { ...custom, permissions: ['sales_delete'], description: 'new words' }]), limited)).resolves.toBeDefined();
  });
});

describe('SettingsService.getSettingsFor', () => {
  it('hides people and the billing price from someone who cannot manage them', async () => {
    repo.getSettings.mockResolvedValue({ ...current(), users: [person('X', 'Admin')], billing: { prices: [{ from: '2026-01', price: 5000 }] } });
    const seen = await service.getSettingsFor(staff);
    expect(seen.users).toEqual([]);
    expect(seen).not.toHaveProperty('billing');
  });
});
