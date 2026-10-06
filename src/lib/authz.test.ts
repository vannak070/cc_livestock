import { describe, expect, it, vi } from 'vitest';

// authz pulls in the settings repository (and with it the DB pool); the pure
// permission helpers under test never touch it.
vi.mock('../repositories/settings.repository', () => ({
  settingsRepository: { getActiveUserById: vi.fn() }
}));

import { AuthzError, assertPermission, can, canManageUsers, loadActor, redactSettingsFor } from './authz';
import { settingsRepository } from '../repositories/settings.repository';
import type { MasterSetup, UserRoleItem } from './types';

const actor = (over: Partial<UserRoleItem>): UserRoleItem => ({
  id: 'u1', name: 'U', email: 'u@x.test', role: 'Farm Staff', status: 'Active', permissions: [], ...over
});

describe('assertPermission', () => {
  it('passes when the actor holds any one of the permissions', () => {
    const a = actor({ permissions: ['stock_view', 'batch_view'] });
    expect(() => assertPermission(a, 'stock_delete', 'batch_view')).not.toThrow();
  });

  it('throws a 403 AuthzError when the actor holds none of them', () => {
    const a = actor({ permissions: ['stock_view'] });
    try {
      assertPermission(a, 'stock_delete');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthzError);
      expect((err as AuthzError).statusCode).toBe(403);
    }
  });

  it('passes when no permission is required', () => {
    expect(() => assertPermission(actor({}))).not.toThrow();
  });
});

describe('canManageUsers / redactSettingsFor', () => {
  const settings = { users: [{ id: 'u9', email: 'secret@x.test' }], breeds: ['B'] } as unknown as MasterSetup;

  it('allows settings_manage and farms_manage, nothing else', () => {
    expect(canManageUsers(actor({ permissions: ['settings_manage'] }))).toBe(true);
    expect(canManageUsers(actor({ permissions: ['farms_manage'] }))).toBe(true);
    expect(canManageUsers(actor({ permissions: ['stock_view'] }))).toBe(false);
  });

  it('hides the account roster from people who cannot manage accounts', () => {
    const out = redactSettingsFor(actor({ permissions: ['stock_view'] }), settings);
    expect(out.users).toEqual([]);
    expect(out.breeds).toEqual(['B']);
  });

  it('gives a farm owner only the staff and vets of their own farm', () => {
    const roster = {
      users: [
        { id: 'a', role: 'Farm Staff', farmLocation: 'North' },
        { id: 'b', role: 'Veterinarian', farmLocation: 'North' },
        { id: 'c', role: 'Farm Staff', farmLocation: 'South' },
        { id: 'd', role: 'Admin' },
        { id: 'e', role: 'Farm Owner', farmLocation: 'North' },
      ],
    } as unknown as MasterSetup;
    const owner = actor({ id: 'e', role: 'Farm Owner', farmLocation: 'North' });
    expect(redactSettingsFor(owner, roster).users.map(u => u.id)).toEqual(['a', 'b']);
    expect(redactSettingsFor(actor({ role: 'Farm Owner' }), roster).users).toEqual([]);
  });

  it('keeps the roster for account managers', () => {
    const out = redactSettingsFor(actor({ role: 'Admin' }), settings);
    expect(out.users).toHaveLength(1);
  });

  it('can() follows hasPermission', () => {
    expect(can(actor({ role: 'Admin' }), 'stock_delete')).toBe(true);
  });
});

describe('redactSettingsFor and the billing price', () => {
  const withBilling = { users: [], breeds: ['B'], billing: { prices: [{ from: '2026-10', price: 5000 }] } } as unknown as MasterSetup;

  it('sends the price only to Super Admin and Admin', () => {
    expect(redactSettingsFor(actor({ role: 'Super Admin' }), withBilling).billing).toBeDefined();
    expect(redactSettingsFor(actor({ role: 'Admin' }), withBilling).billing).toBeDefined();
    for (const role of ['Company', 'Management', 'Farm Owner', 'Farm Staff', 'Veterinarian']) {
      const out = redactSettingsFor(actor({ role, permissions: ['settings_manage', 'farms_manage'] }), withBilling);
      expect(out.billing).toBeUndefined();
      expect(out.breeds).toEqual(['B']);
    }
  });
});

describe('loadActor', () => {
  it('returns null without an id and does not hit the database', async () => {
    expect(await loadActor(undefined)).toBeNull();
    expect(settingsRepository.getActiveUserById).not.toHaveBeenCalled();
  });

  it('looks the user up by id otherwise', async () => {
    vi.mocked(settingsRepository.getActiveUserById).mockResolvedValueOnce(actor({ id: 'u2' }));
    expect((await loadActor('u2'))?.id).toBe('u2');
  });
});
