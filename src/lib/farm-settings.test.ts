import { describe, it, expect } from 'vitest';
import { deleteFarm, farmOwner, farmOwners, farmPeople, saveFarm, validateFarm, type FarmInput } from './farm-settings';
import type { MasterSetup, UserRoleItem } from './types';

const user = (id: string, role: string, farmLocation?: string, name = id): UserRoleItem => ({ id, name, email: `${id}@x.com`, role, status: 'Active', farmLocation });
const base = (): MasterSetup => ({
  farms: [{ id: 'F1', name: 'Farm A', capacity: 100, ownerName: 'Old copy', ownerEmail: 'old@x.com' }, { id: 'F2', name: 'Farm B', capacity: 50 }],
  users: [user('own-a', 'Farm Owner', 'Farm A'), user('staff-a', 'Farm Staff', 'Farm A', 'Zed'), user('vet-a', 'Veterinarian', 'Farm A', 'Amy'), user('own-b', 'Farm Owner', 'Farm B'), user('admin', 'Admin')],
} as unknown as MasterSetup);
const input = (over: Partial<FarmInput> = {}): FarmInput => ({ name: 'Farm C', address: ' Prey Veng ', capacity: 80, notes: '', ...over });
let n = 0;
const newId = () => `ID${++n}`;

describe('validateFarm', () => {
  it('accepts a complete new farm', () => {
    expect(validateFarm(base(), input(), null)).toEqual({});
  });
  it('rejects an empty or repeated name and a bad capacity', () => {
    expect(validateFarm(base(), input({ name: ' ' }), null).name).toBeTruthy();
    expect(validateFarm(base(), input({ name: ' farm a ' }), null).name).toMatch(/already a farm/);
    expect(validateFarm(base(), input({ capacity: 0 }), null).capacity).toBeTruthy();
    expect(validateFarm(base(), input({ capacity: 2.5 }), null).capacity).toBeTruthy();
  });
  it('lets a farm keep its own name when editing', () => {
    const s = base();
    expect(validateFarm(s, input({ name: 'Farm A' }), s.farms![0])).toEqual({});
  });
});

describe('people of a farm', () => {
  it('finds the owner(s) and lists everyone, owner first', () => {
    const s = base();
    expect(farmOwner(s, 'Farm A')!.id).toBe('own-a');
    expect(farmOwners(s, 'Farm Z')).toEqual([]);
    expect(farmPeople(s, 'Farm A').map(u => u.id)).toEqual(['own-a', 'vet-a', 'staff-a']);
  });
});

describe('saveFarm', () => {
  it('adds a farm, trimmed', () => {
    const r = saveFarm(base(), input(), null, newId);
    expect(r.renamedFrom).toBeNull();
    expect(r.farms.at(-1)).toMatchObject({ name: 'Farm C', address: 'Prey Veng', capacity: 80 });
  });
  it('renames a farm in the list and reports the old name', () => {
    const s = base();
    const r = saveFarm(s, input({ name: 'Farm A2' }), s.farms![0], newId);
    expect(r.renamedFrom).toBe('Farm A');
    expect(r.farms.find(f => f.id === 'F1')!.name).toBe('Farm A2');
  });
  it('drops the old copied owner details when a farm is saved', () => {
    const s = base();
    const f = saveFarm(s, input({ name: 'Farm A' }), s.farms![0], newId).farms.find(x => x.id === 'F1')!;
    expect('ownerName' in f).toBe(false);
    expect('ownerEmail' in f).toBe(false);
  });
});

describe('deleteFarm', () => {
  it('removes the farm only', () => {
    const r = deleteFarm(base(), 'F1');
    expect(r.farms.map(f => f.id)).toEqual(['F2']);
  });
  it('does nothing for an unknown farm', () => {
    expect(deleteFarm(base(), 'nope').farms).toHaveLength(2);
  });
});

describe('company-run farms', () => {
  it('saves the company-run flag, and clears it again when edited', () => {
    const added = saveFarm(base(), input({ name: 'Company Farm', companyRun: true }), null, newId);
    const farm = added.farms.find(f => f.name === 'Company Farm')!;
    expect(farm.companyRun).toBe(true);
    const cleared = saveFarm({ farms: added.farms }, input({ name: 'Company Farm', companyRun: false }), farm, newId).farms.find(f => f.id === farm.id)!;
    expect(cleared.companyRun).toBeUndefined();
  });
  it('a farm that is not company-run has no flag', () => {
    expect(saveFarm(base(), input({ name: 'Plain' }), null, newId).farms.find(f => f.name === 'Plain')!.companyRun).toBeUndefined();
  });
});

