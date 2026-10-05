import { describe, it, expect } from 'vitest';
import { assignableRoles, canChangeUser, deleteRole, grantable, removePerson, resetPassword, roleDeleteBlock, rolesOf, savePerson, saveRole, setPersonStatus, validatePerson, validateRole, visibleUsers, SYSTEM_ROLES, type PersonInput } from './user-admin';
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
  it('refuses a role or access the person cannot give', () => {
    expect(validatePerson(settings(), input({ role: 'Admin', farmLocation: '' }), null, owner).role).toBeTruthy();
    expect(validatePerson(settings(), input({ permissions: [...DEFAULT_ROLE_PERMISSIONS['Farm Staff'], 'settings_manage'] }), null, owner).permissions).toMatch(/settings_manage/);
  });
});

describe('savePerson', () => {
  it('adds a person with a made password and reports it once', () => {
    const { settings: s, tempPassword } = savePerson(settings(), input(), null, id, () => 'tmp-pass-123');
    expect(tempPassword).toBe('tmp-pass-123');
    expect(s.users.at(-1)).toMatchObject({ name: 'New Person', role: 'Farm Staff', status: 'Active', password: 'tmp-pass-123', farmLocation: 'Farm A' });
  });
  it('keeps a typed password and reports none', () => {
    const { tempPassword, settings: s } = savePerson(settings(), input({ password: 'chosen-pass' }), null, id, () => 'unused');
    expect(tempPassword).toBeUndefined();
    expect(s.users.at(-1)!.password).toBe('chosen-pass');
  });
  it('edits without touching the password or PIN unless asked', () => {
    const s = settings();
    const st = { ...s.users.find(u => u.id === 'st')!, hasPin: true };
    s.users = s.users.map(u => (u.id === 'st' ? st : u));
    const kept = savePerson(s, input({ name: 'Renamed', email: 'st@x.com' }), st, id, () => 'x').settings.users.find(u => u.id === 'st')!;
    expect(kept.name).toBe('Renamed');
    expect('password' in kept).toBe(false);
    expect('pin' in kept).toBe(false);
    const changed = savePerson(s, input({ email: 'st@x.com', password: 'brand-new-1', pin: '482913', clearPin: false }), st, id, () => 'x').settings.users.find(u => u.id === 'st')!;
    expect(changed).toMatchObject({ password: 'brand-new-1', pin: '482913' });
    const cleared = savePerson(s, input({ email: 'st@x.com', clearPin: true }), st, id, () => 'x').settings.users.find(u => u.id === 'st')!;
    expect(cleared.clearPin).toBe(true);
  });
  it('turns a person off and on, removes them, and resets a password', () => {
    const s = settings();
    expect(setPersonStatus(s, 'st', 'Inactive').users.find(u => u.id === 'st')!.status).toBe('Inactive');
    expect(removePerson(s, 'st').users.map(u => u.id)).not.toContain('st');
    const r = resetPassword(s, 'st', () => 'newpass-9');
    expect(r.password).toBe('newpass-9');
    expect(r.settings.users.find(u => u.id === 'st')!.password).toBe('newpass-9');
  });
});

describe('roles', () => {
  const custom = { id: 'ROLE-X', name: 'Feed Manager', description: '', permissions: ['feed_view', 'feed_manage'] as never, isSystem: false };
  it('validates names and access', () => {
    expect(validateRole(settings(), { name: ' ', description: '', permissions: [] }, null, sa)).toMatchObject({ name: expect.any(String), permissions: expect.any(String) });
    expect(validateRole(settings(), { name: 'farm staff', description: '', permissions: ['feed_view'] }, null, sa).name).toMatch(/already/);
    expect(validateRole(settings(), { name: 'Accountant', description: '', permissions: ['sales_view'] }, null, sa)).toEqual({});
  });
  it('adds a role and renames a custom role on the people who have it', () => {
    const s = saveRole(settings(), { name: 'Feed Manager', description: 'x', permissions: ['feed_view'] }, null, id);
    const role = s.roles!.find(r => r.name === 'Feed Manager')!;
    expect(role.isSystem).toBe(false);
    const withPerson = { ...s, users: [...s.users, user('fm', 'Feed Manager', 'Farm A')] };
    const renamed = saveRole(withPerson, { name: 'Feed Lead', description: 'x', permissions: ['feed_view'] }, role, id);
    expect(renamed.users.find(u => u.id === 'fm')!.role).toBe('Feed Lead');
  });
  it('never renames a built-in role', () => {
    const staff = SYSTEM_ROLES.find(r => r.name === 'Farm Staff')!;
    const s = saveRole(settings(), { name: 'Something Else', description: 'd', permissions: ['feed_view'] }, staff, id);
    expect(s.roles!.find(r => r.id === staff.id)).toMatchObject({ name: 'Farm Staff', permissions: ['feed_view'] });
  });
  it('blocks deleting a built-in role or one that people still have', () => {
    expect(roleDeleteBlock(settings(), SYSTEM_ROLES[0])).toMatch(/built-in/);
    const s = { ...settings(), roles: [...SYSTEM_ROLES, custom], users: [...settings().users, user('fm', 'Feed Manager', 'Farm A')] } as MasterSetup;
    expect(roleDeleteBlock(s, custom)).toMatch(/1 person has/);
    expect(roleDeleteBlock({ ...s, users: settings().users }, custom)).toBeNull();
    expect(deleteRole({ ...s, users: settings().users }, 'ROLE-X').roles!.map(r => r.id)).not.toContain('ROLE-X');
  });
});
