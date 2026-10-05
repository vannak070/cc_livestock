import { describe, it, expect } from 'vitest';
import { deleteFarm, farmOwner, saveFarm, validateFarm, type FarmInput } from './farm-settings';
import type { MasterSetup, UserRoleItem } from './types';

const user = (id: string, role: string, farmLocation?: string, email = `${id}@x.com`): UserRoleItem =>
  ({ id, name: id, email, role, status: 'Active', farmLocation });
const base = (): MasterSetup => ({
  farms: [{ id: 'F1', name: 'Farm A', capacity: 100 }, { id: 'F2', name: 'Farm B', capacity: 50 }],
  locations: ['Farm A', 'Farm B'],
  users: [user('own-a', 'Farm Owner', 'Farm A', 'a@x.com'), user('staff-a', 'Farm Staff', 'Farm A'), user('own-b', 'Farm Owner', 'Farm B', 'b@x.com'), user('admin', 'Admin')],
} as unknown as MasterSetup);
const input = (over: Partial<FarmInput> = {}): FarmInput => ({ name: 'Farm C', address: '', capacity: 80, ownerName: 'Owner C', ownerEmail: 'C@X.com', ownerPassword: 'secret1', notes: '', ...over });
let n = 0;
const newId = () => `ID${++n}`;

describe('validateFarm', () => {
  it('accepts a complete new farm', () => {
    expect(validateFarm(base(), input(), null)).toEqual({});
  });
  it('rejects a repeated farm name, a repeated email and a missing password for a new owner', () => {
    const e = validateFarm(base(), input({ name: ' farm a ', ownerEmail: 'B@x.com', ownerPassword: '' }), null);
    expect(Object.keys(e).sort()).toEqual(['name', 'ownerEmail', 'ownerPassword']);
  });
  it('lets an existing owner keep their own email and password when editing', () => {
    const s = base();
    expect(validateFarm(s, input({ name: 'Farm A', ownerName: 'own-a', ownerEmail: 'a@x.com', ownerPassword: '' }), s.farms![0])).toEqual({});
  });
  it('checks capacity and email shape', () => {
    expect(validateFarm(base(), input({ capacity: 0, ownerEmail: 'nope' }), null)).toMatchObject({ capacity: expect.any(String), ownerEmail: expect.any(String) });
  });
});

describe('saveFarm', () => {
  it('adds a farm, its location and an owner login', () => {
    const { settings, renamedFrom } = saveFarm(base(), input(), null, newId);
    expect(renamedFrom).toBeNull();
    expect(settings.farms!.map(f => f.name)).toContain('Farm C');
    expect(settings.locations).toContain('Farm C');
    const owner = farmOwner(settings, 'Farm C')!;
    expect(owner).toMatchObject({ role: 'Farm Owner', email: 'c@x.com', password: 'secret1', status: 'Active' });
  });
  it('renames a farm everywhere and keeps the owner password when none is typed', () => {
    const s = base();
    s.users[0] = { ...s.users[0], password: 'old-hash' };
    const { settings, renamedFrom } = saveFarm(s, input({ name: 'Farm A2', ownerName: 'New Name', ownerEmail: 'a@x.com', ownerPassword: '' }), s.farms![0], newId);
    expect(renamedFrom).toBe('Farm A');
    expect(settings.locations).toEqual(['Farm A2', 'Farm B']);
    expect(settings.users.find(u => u.id === 'staff-a')!.farmLocation).toBe('Farm A2');
    const owner = farmOwner(settings, 'Farm A2')!;
    expect(owner).toMatchObject({ id: 'own-a', name: 'New Name', password: 'old-hash' });
  });
  it('replaces the password only when a new one is typed', () => {
    const s = base();
    const { settings } = saveFarm(s, input({ name: 'Farm A', ownerEmail: 'a@x.com', ownerPassword: 'fresh' }), s.farms![0], newId);
    expect(farmOwner(settings, 'Farm A')!.password).toBe('fresh');
  });
  it('creates an owner login when an existing farm has none', () => {
    const s = base();
    s.users = s.users.filter(u => u.id !== 'own-b');
    const { settings } = saveFarm(s, input({ name: 'Farm B', ownerEmail: 'b2@x.com' }), s.farms![1], newId);
    expect(farmOwner(settings, 'Farm B')).toMatchObject({ email: 'b2@x.com', password: 'secret1' });
  });
});

describe('deleteFarm', () => {
  it('removes the farm and its owner login and unassigns the other users', () => {
    const s = deleteFarm(base(), 'F1');
    expect(s.farms!.map(f => f.id)).toEqual(['F2']);
    expect(s.locations).toEqual(['Farm B']);
    expect(s.users.map(u => u.id)).toEqual(['staff-a', 'own-b', 'admin']);
    expect(s.users.find(u => u.id === 'staff-a')!.farmLocation).toBeUndefined();
  });
  it('does nothing for an unknown farm', () => {
    const s = base();
    expect(deleteFarm(s, 'nope')).toBe(s);
  });
});
