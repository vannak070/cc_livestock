import { describe, it, expect } from 'vitest';
import { assignableRoles, canChangeUser, canOpenPeople, followsRole, isOfficePerson, officeRoleNames, deleteRole, grantable, roleDeleteBlock, rolesOf, saveRole, validatePerson, validateRole, visibleUsers, SYSTEM_ROLES, type PersonInput } from './user-admin';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type MasterSetup, type UserRoleItem } from '@/types/settings.types';

const user = (id: string, role: string, farmLocation?: string, email = `${id}@x.com`): UserRoleItem => ({ id, name: id, email, role, status: 'Active', farmLocation });
const settings = (): MasterSetup => ({
  farms: [{ id: 'F1', name: 'Farm A' }, { id: 'F2', name: 'Farm B' }],
  roles: SYSTEM_ROLES,
  users: [user('sa', 'Super Admin'), user('ad', 'Admin'), user('own', 'Farm Owner', 'Farm A'), user('st', 'Farm Staff', 'Farm A'), user('vet', 'Veterinarian', 'Farm B'), user('co', 'Company')],
} as unknown as MasterSetup);
const input = (over: Partial<PersonInput> = {}): PersonInput => ({ name: 'New Person', email: 'new@x.com', role: 'Farm Staff', farmLocation: 'Farm A', password: '', pin: '', clearPin: false, permissions: DEFAULT_ROLE_PERMISSIONS['Farm Staff'], ...over });
const sa = user('sa', 'Super Admin');
const owner = { ...user('own', 'Farm Owner', 'Farm A'), permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'] };
let n = 0;
const id = () => `I${++n}`;

describe('who sees and who can change whom', () => {
  it('shows a farm owner only the staff and vets of their farm', () => {
    expect(visibleUsers(settings().users, owner).map(u => u.id)).toEqual(['st']);
    expect(visibleUsers(settings().users, sa)).toHaveLength(6);
  });
  it('limits the roles a person may give', () => {
    const roles = rolesOf(settings());
    expect(assignableRoles(roles, sa)).toHaveLength(7);
    expect(assignableRoles(roles, user('ad', 'Admin')).map(r => r.name)).not.toContain('Super Admin');
    expect(assignableRoles(roles, owner).map(r => r.name)).toEqual(['Farm Staff', 'Veterinarian']);
    expect(assignableRoles(roles, user('co', 'Company')).map(r => r.name)).toEqual(['Company', 'Farm Owner', 'Farm Staff', 'Veterinarian', 'Management']);
  });
  it('protects privileged accounts', () => {
    expect(canChangeUser(user('ad', 'Admin'), user('x', 'Super Admin'))).toBe(false);
    expect(canChangeUser(user('co', 'Company'), user('x', 'Admin'))).toBe(false);
    expect(canChangeUser(sa, user('x', 'Admin'))).toBe(true);
    expect(canChangeUser(owner, user('x', 'Farm Staff'))).toBe(true);
  });
  it('only lets people hand out access they hold', () => {
    expect(grantable(sa)).toEqual(ALL_PERMISSIONS);
    expect(grantable(owner)).not.toContain('settings_manage');
  });
});

describe('validatePerson', () => {
  it('accepts a complete new person', () => {
    expect(validatePerson(settings(), input(), null, sa)).toEqual({});
  });
  it('catches missing name, bad or repeated email, short password and weak PIN', () => {
    const e = validatePerson(settings(), input({ name: ' ', email: 'ST@x.com', password: 'short', pin: '123456' }), null, sa);
    expect(Object.keys(e).sort()).toEqual(['email', 'name', 'password', 'pin']);
    expect(validatePerson(settings(), input({ email: 'nope' }), null, sa).email).toMatch(/does not look right/);
  });
  it('lets a person keep their own email when editing', () => {
    const s = settings();
    const st = s.users.find(u => u.id === 'st')!;
    expect(validatePerson(s, input({ email: 'st@x.com' }), st, sa)).toEqual({});
  });
  it('needs a farm for farm roles but not for office roles', () => {
    expect(validatePerson(settings(), input({ farmLocation: '' }), null, sa).farmLocation).toBeTruthy();
    expect(validatePerson(settings(), input({ role: 'Management', farmLocation: '', permissions: DEFAULT_ROLE_PERMISSIONS['Management'] }), null, sa)).toEqual({});
  });
  it('allows one owner per farm', () => {
    const ownerInput = (over: Partial<PersonInput> = {}) => input({ role: 'Farm Owner', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'], ...over });
    // Farm A already has 'own'; Farm B has none.
    expect(validatePerson(settings(), ownerInput({ farmLocation: 'Farm A' }), null, sa).farmLocation).toMatch(/already has an owner \(own\)/);
    expect(validatePerson(settings(), ownerInput({ farmLocation: 'Farm B' }), null, sa)).toEqual({});
    const s = settings();
    const own = s.users.find(u => u.id === 'own')!;
    expect(validatePerson(s, ownerInput({ farmLocation: 'Farm A', email: 'own@x.com' }), own, sa)).toEqual({}); // editing the owner themselves
  });
  it('refuses a role or access the person cannot give', () => {
    expect(validatePerson(settings(), input({ role: 'Admin', farmLocation: '' }), null, owner).role).toBeTruthy();
    expect(validatePerson(settings(), input({ permissions: [...DEFAULT_ROLE_PERMISSIONS['Farm Staff'], 'settings_manage'] }), null, owner).permissions).toMatch(/settings_manage/);
  });
});

describe('your own account', () => {
  const ad = { ...user('ad', 'Admin'), permissions: DEFAULT_ROLE_PERMISSIONS['Admin'] };
  const mine = (over: Partial<PersonInput> = {}) => input({ name: 'ad', email: 'ad@x.com', role: 'Admin', farmLocation: '', permissions: DEFAULT_ROLE_PERMISSIONS['Admin'], ...over });

  it('lets you change your name, email and password', () => {
    expect(validatePerson(settings(), mine({ name: 'Renamed', email: 'me@x.com', password: 'longenough' }), ad, ad)).toEqual({});
  });
  it('stops you changing your own role, farm or access', () => {
    expect(validatePerson(settings(), mine({ role: 'Farm Staff', farmLocation: 'Farm A' }), ad, ad).role).toMatch(/own role/);
    expect(validatePerson(settings(), mine({ farmLocation: 'Farm A' }), ad, ad).farmLocation).toMatch(/own farm/);
    expect(validatePerson(settings(), mine({ permissions: DEFAULT_ROLE_PERMISSIONS['Admin'].filter(p => p !== 'settings_manage') }), ad, ad).permissions).toMatch(/own access/);
  });
  it('still lets a Super Admin change another Super Admin', () => {
    const other = user('sa2', 'Super Admin');
    expect(validatePerson(settings(), input({ name: 'sa2', email: 'sa2@x.com', role: 'Admin', farmLocation: '', permissions: DEFAULT_ROLE_PERMISSIONS['Admin'] }), other, sa)).toEqual({});
  });
});

describe('office people and farm people', () => {
  const farms = ['Farm A', 'Farm B'];
  it('keeps farm owners, staff and vets on a real farm out of the office list', () => {
    expect(isOfficePerson(user('st', 'Farm Staff', 'Farm A'), farms)).toBe(false);
    expect(isOfficePerson(user('own', 'Farm Owner', 'Farm B'), farms)).toBe(false);
    expect(isOfficePerson(user('ad', 'Admin'), farms)).toBe(true);
    expect(isOfficePerson(user('mg', 'Management', 'Farm A'), farms)).toBe(true);
  });
  it('keeps a farm person with no farm, or a farm that is gone, in the office list so they are not lost', () => {
    expect(isOfficePerson(user('st', 'Farm Staff'), farms)).toBe(true);
    expect(isOfficePerson(user('vet', 'Veterinarian', 'Old Farm'), farms)).toBe(true);
  });
  it('gives every role except the farm roles from Settings', () => {
    expect(officeRoleNames(SYSTEM_ROLES)).toEqual(['Super Admin', 'Admin', 'Company', 'Management']);
  });
});

describe('followsRole', () => {
  it('is true for people on the role\'s usual access (any order) or with none stored, false for own access or another role', () => {
    const usual = ['stock_view', 'weight_view'] as const;
    expect(followsRole({ role: 'Farm Staff', permissions: ['weight_view', 'stock_view'] }, 'Farm Staff', [...usual])).toBe(true);
    expect(followsRole({ role: 'Farm Staff', permissions: [] }, 'Farm Staff', [...usual])).toBe(true);
    expect(followsRole({ role: 'Farm Staff' }, 'Farm Staff', [...usual])).toBe(true);
    expect(followsRole({ role: 'Farm Staff', permissions: ['stock_view'] }, 'Farm Staff', [...usual])).toBe(false);
    expect(followsRole({ role: 'Farm Staff', permissions: [...usual, 'sales_view'] }, 'Farm Staff', [...usual])).toBe(false);
    expect(followsRole({ role: 'Veterinarian', permissions: [...usual] }, 'Farm Staff', [...usual])).toBe(false);
  });
});

describe('canOpenPeople', () => {
  it('opens for account managers and for a farm owner with a farm', () => {
    expect(canOpenPeople(sa)).toBe(true);
    expect(canOpenPeople(owner)).toBe(true);
    expect(canOpenPeople({ ...owner, farmLocation: undefined })).toBe(false);
    expect(canOpenPeople({ ...user('st', 'Farm Staff', 'Farm A'), permissions: DEFAULT_ROLE_PERMISSIONS['Farm Staff'] })).toBe(false);
    expect(canOpenPeople(null)).toBe(false);
  });
});

describe('roles', () => {
  const custom = { id: 'ROLE-X', name: 'Feed Manager', description: '', permissions: ['feed_view', 'feed_manage'] as never, isSystem: false };
  it('validates names and access', () => {
    expect(validateRole(settings(), { name: ' ', description: '', permissions: [] }, null, sa)).toMatchObject({ name: expect.any(String), permissions: expect.any(String) });
    expect(validateRole(settings(), { name: 'farm staff', description: '', permissions: ['feed_view'] }, null, sa).name).toMatch(/already/);
    expect(validateRole(settings(), { name: 'Accountant', description: '', permissions: ['sales_view'] }, null, sa)).toEqual({});
  });
  it('adds a role and renames a custom one in place', () => {
    const added = saveRole(settings(), { name: 'Feed Manager', description: 'x', permissions: ['feed_view'] }, null, id);
    const role = added.find(r => r.name === 'Feed Manager')!;
    expect(role.isSystem).toBe(false);
    const renamed = saveRole({ roles: added }, { name: 'Feed Lead', description: 'x', permissions: ['feed_view'] }, role, id);
    expect(renamed.find(r => r.id === role.id)!.name).toBe('Feed Lead');
  });
  it('never renames a built-in role', () => {
    const staff = SYSTEM_ROLES.find(r => r.name === 'Farm Staff')!;
    const roles = saveRole(settings(), { name: 'Something Else', description: 'd', permissions: ['feed_view'] }, staff, id);
    expect(roles.find(r => r.id === staff.id)).toMatchObject({ name: 'Farm Staff', permissions: ['feed_view'] });
  });
  it('blocks deleting a built-in role or one that people still have', () => {
    expect(roleDeleteBlock(settings(), SYSTEM_ROLES[0])).toMatch(/built-in/);
    const s = { ...settings(), roles: [...SYSTEM_ROLES, custom], users: [...settings().users, user('fm', 'Feed Manager', 'Farm A')] } as MasterSetup;
    expect(roleDeleteBlock(s, custom)).toMatch(/1 person has/);
    expect(roleDeleteBlock({ ...s, users: settings().users }, custom)).toBeNull();
    expect(deleteRole(s, 'ROLE-X').map(r => r.id)).not.toContain('ROLE-X');
  });
});
