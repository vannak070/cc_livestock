import { describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/settings.repository', () => ({
  settingsRepository: { getActiveUserById: vi.fn() }
}));

import { scopeDataForActor } from './data-scope';
import type { ERPLivestockData, UserRoleItem } from './types';

const data = {
  stock: [
    { id: 'A1', location: 'Farm A' },
    { id: 'B1', location: 'Farm B' },
    { id: 'S1', location: 'រទាំង' },
    { id: 'S2', location: 'SNR Farm' },
    { id: 'N1' }
  ],
  batches: [
    { id: 'BT-A', name: 'a', farmLocation: 'Farm A', cowIds: ['A1', 'B1'] },
    { id: 'BT-B', name: 'b', farmLocation: 'Farm B', cowIds: ['B1'] },
    { id: 'BT-X', name: 'x', farmLocation: undefined, cowIds: [] }
  ],
  weightTracking: [{ cowId: 'A1' }, { cowId: 'B1' }],
  healthLogs: [{ cowId: 'A1' }, { cowId: 'B1' }],
  salesTracking: [{ cowId: 'A1' }, { cowId: 'B1' }],
  farmCosts: [{ id: 'C-A', farmLocation: 'Farm A' }, { id: 'C-B', farmLocation: 'Farm B' }],
  proposalPlans: [{ slot: 1, name: 'Plan' }],
  farmLoans: [{ farmLocation: 'Farm A' }],
  common: { locations: ['Farm A', 'Farm B'] },
  settings: { users: [{ id: 'u', email: 'e@x.test' }], breeds: [] }
} as unknown as ERPLivestockData;

const user = (over: Partial<UserRoleItem>): UserRoleItem =>
  ({ id: 'u1', name: 'U', email: 'u@x.test', role: 'Farm Owner', status: 'Active', permissions: [], ...over });

describe('scopeDataForActor', () => {
  it('gives a user with no farm every farm', () => {
    const out = scopeDataForActor(data, user({ role: 'Admin' }));
    expect(out.stock).toHaveLength(5);
    expect(out.batches).toHaveLength(3);
  });

  it('trims every collection to the farm of a farm-bound user', () => {
    const out = scopeDataForActor(data, user({ farmLocation: 'Farm A' }));
    expect(out.stock.map(c => c.id)).toEqual(['A1']);
    expect(out.weightTracking).toEqual([{ cowId: 'A1' }]);
    expect(out.healthLogs).toEqual([{ cowId: 'A1' }]);
    expect(out.salesTracking).toEqual([{ cowId: 'A1' }]);
    expect(out.common.locations).toEqual(['Farm A']);
  });

  it("strips other farms' cows out of a shared batch and drops batches with nothing left", () => {
    const out = scopeDataForActor(data, user({ farmLocation: 'Farm A' }));
    const ids = out.batches.map(b => b.id);
    expect(ids).toContain('BT-A');
    expect(out.batches.find(b => b.id === 'BT-A')!.cowIds).toEqual(['A1']);
    expect(ids).not.toContain('BT-B');
  });

  it("gives running costs only to people allowed to see them, and only their farm's", () => {
    expect(scopeDataForActor(data, user({ role: 'Admin' })).farmCosts?.map(c => c.id)).toEqual(['C-A', 'C-B']);
    expect(scopeDataForActor(data, user({ farmLocation: 'Farm A', permissions: ['costs_view'] })).farmCosts?.map(c => c.id)).toEqual(['C-A']);
    expect(scopeDataForActor(data, user({ farmLocation: 'Farm A', role: 'Veterinarian', permissions: ['health_view'] })).farmCosts).toEqual([]);
    expect(scopeDataForActor(data, user({ role: 'Company', permissions: ['sales_view'] })).farmCosts).toEqual([]);
  });

  it('sends plans only to Super Admin, Admin and Management', () => {
    for (const role of ['Super Admin', 'Admin', 'Management']) {
      expect(scopeDataForActor(data, user({ role, permissions: [] })).proposalPlans).toHaveLength(1);
    }
    for (const role of ['Company', 'Farm Owner', 'Farm Staff', 'Veterinarian', 'Company Admin']) {
      expect(scopeDataForActor(data, user({ role, permissions: ['analytics_view'] })).proposalPlans).toEqual([]);
    }
    expect(scopeDataForActor(data, user({ role: 'Farm Owner', farmLocation: 'Farm A', permissions: ['analytics_view'] })).proposalPlans).toEqual([]);
    expect(scopeDataForActor(data, user({ role: 'Management', permissions: [] })).farmLoans).toHaveLength(1);
    expect(scopeDataForActor(data, user({ role: 'Company', permissions: ['analytics_view'] })).farmLoans).toEqual([]);
    expect(scopeDataForActor(data, user({ role: 'Farm Owner', farmLocation: 'Farm A', permissions: ['analytics_view'] })).farmLoans).toEqual([]);
  });

  it('matches farm names case- and whitespace-insensitively', () => {
    const out = scopeDataForActor(data, user({ farmLocation: '  farm a ' }));
    expect(out.stock.map(c => c.id)).toEqual(['A1']);
  });

  it('treats the Khmer Rotang name and SNR names as the same farm', () => {
    const out = scopeDataForActor(data, user({ farmLocation: 'រទាំង' }));
    expect(out.stock.map(c => c.id).sort()).toEqual(['S1', 'S2']);
  });

  it('never leaks the account roster to someone who cannot manage accounts', () => {
    const scoped = scopeDataForActor(data, user({ farmLocation: 'Farm A' }));
    expect(scoped.settings.users).toEqual([]);
    const admin = scopeDataForActor(data, user({ role: 'Admin' }));
    expect(admin.settings.users).toHaveLength(1);
  });
});
