import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({
  getSettings: vi.fn(), findUserById: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(),
  setUserStatus: vi.fn(), setUserPassword: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));

import { UserAdminService } from './user-admin.service';
import { AuthzError } from '../lib/authz';
import type { UserRoleItem } from '../lib/types';
import type { PersonInput } from '../lib/user-admin';

const service = new UserAdminService();
const person = (id: string, role: string, farmLocation?: string, extra: object = {}) =>
  ({ id, name: `${role} ${id}`, email: `${id}@x.test`, role, status: 'Active', farmLocation, ...extra }) as UserRoleItem;
const superAdmin = person('SA', 'Super Admin');
const admin = person('AD', 'Admin');
const company = person('CO', 'Company');
const owner = person('OW', 'Farm Owner', 'SNR Farm');
const staffMember = person('ST', 'Farm Staff', 'SNR Farm');
const input = (over: Partial<PersonInput> = {}): PersonInput => ({
  name: ' Sok ', email: ' sok@x.test ', role: 'Farm Staff', farmLocation: 'SNR Farm', password: '', pin: '', clearPin: false, permissions: [], ...over,
});

beforeEach(() => {
  Object.values(settings).forEach(f => f.mockReset());
  settings.getSettings.mockResolvedValue({ users: [superAdmin, admin, company, owner, staffMember], roles: [], farms: [{ id: 'F1', name: 'SNR Farm' }, { id: 'F2', name: 'CC_001' }] });
  settings.findUserById.mockImplementation(async (id: string) => [superAdmin, admin, company, owner, staffMember, person('OTHER', 'Farm Staff', 'CC_001'), person('AD2', 'Admin')].find(u => u.id === id) ?? null);
  settings.createUser.mockImplementation(async (u: object) => ({ user: u }));
});

describe('creating people', () => {
  it('lets an Admin add farm staff, saving trimmed values and an Active account', async () => {
    await service.createUser(admin, input());
    expect(settings.createUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sok', email: 'sok@x.test', role: 'Farm Staff', status: 'Active', farmLocation: 'SNR Farm' }));
  });

  it('only a Super Admin makes a Super Admin', async () => {
    await expect(service.createUser(admin, input({ role: 'Super Admin', farmLocation: '' }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createUser(superAdmin, input({ role: 'Super Admin', farmLocation: '' }))).resolves.toBeDefined();
  });

  it('only a Super Admin or Admin makes an Admin (an office account cannot)', async () => {
    await expect(service.createUser(company, input({ role: 'Admin', farmLocation: '' }))).rejects.toMatchObject({ statusCode: 403 });
    expect(settings.createUser).not.toHaveBeenCalled();
  });

  it('a farm owner adds staff and vets for their own farm only', async () => {
    await expect(service.createUser(owner, input({ role: 'Veterinarian' }))).resolves.toBeDefined();
    await expect(service.createUser(owner, input({ farmLocation: 'CC_001' }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createUser(owner, input({ role: 'Company', farmLocation: '' }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createUser(owner, input({ role: 'Farm Owner' }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('never ties an office role to a farm, even when the form sends one (production bug 11-02)', async () => {
    await service.createUser(superAdmin, input({ role: 'Admin', farmLocation: 'SNR Farm' }));
    expect(settings.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'Admin', farmLocation: undefined }));
    settings.updateUser.mockResolvedValue({});
    await service.updateUser(superAdmin, 'AD2', input({ role: 'Admin', farmLocation: 'SNR Farm' }));
    expect(settings.updateUser).toHaveBeenCalledWith('AD2', expect.objectContaining({ farmLocation: undefined }));
  });

  it('farm staff cannot manage people at all', async () => {
    await expect(service.createUser(staffMember, input())).rejects.toBeInstanceOf(AuthzError);
  });

  it('nobody hands out access they do not have themselves', async () => {
    await expect(service.createUser(owner, input({ permissions: ['settings_manage'] }))).rejects.toThrow(/cannot give access/);
    expect(settings.createUser).not.toHaveBeenCalled();
  });

  it('refuses an email someone already uses, a bad email, and a short password', async () => {
    await expect(service.createUser(admin, input({ email: 'ST@x.test' }))).rejects.toThrow(/already uses that email/);
    await expect(service.createUser(admin, input({ email: 'not-an-email' }))).rejects.toThrow(/does not look right/);
    await expect(service.createUser(admin, input({ password: 'short' }))).rejects.toThrow(/at least 8/);
  });

  it('needs a farm for farm roles', async () => {
    await expect(service.createUser(admin, input({ farmLocation: '' }))).rejects.toThrow(/which farm/);
  });

  it('a farm has one owner', async () => {
    await expect(service.createUser(admin, input({ role: 'Farm Owner', farmLocation: 'SNR Farm' }))).rejects.toThrow(/already has an owner/);
  });
});

describe('changing people', () => {
  it('nobody changes their own role, farm or access (no one locks themselves out)', async () => {
    await expect(service.updateUser(admin, 'AD', { ...input({ role: 'Company', farmLocation: '' }), name: 'Admin' })).rejects.toThrow(/cannot change your own role/);
  });

  it('an Admin cannot change a Super Admin, and cannot change another Admin into a Super Admin', async () => {
    await expect(service.updateUser(admin, 'SA', input({ role: 'Super Admin', farmLocation: '' }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.updateUser(admin, 'AD2', input({ role: 'Super Admin', farmLocation: '' }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("a farm owner cannot change another farm's staff or an office account", async () => {
    await expect(service.updateUser(owner, 'OTHER', input({ farmLocation: 'SNR Farm' }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.updateUser(owner, 'CO', input())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses a person who is gone', async () => {
    await expect(service.updateUser(admin, 'NOPE', input())).rejects.toThrow(/no longer exists/);
  });
});

describe('turning off, removing and resetting', () => {
  it('lets a farm owner switch off their own farm staff', async () => {
    await service.setStatus(owner, 'ST', 'Inactive');
    expect(settings.setUserStatus).toHaveBeenCalledWith('ST', 'Inactive');
  });

  it("refuses a farm owner touching another farm's person, and resetting their password", async () => {
    await expect(service.setStatus(owner, 'OTHER', 'Inactive')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.resetPassword(owner, 'OTHER')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.deleteUser(owner, 'OTHER')).rejects.toMatchObject({ statusCode: 403 });
    expect(settings.setUserStatus).not.toHaveBeenCalled();
    expect(settings.deleteUser).not.toHaveBeenCalled();
  });

  it('nobody turns off or removes their own account', async () => {
    await expect(service.setStatus(admin, 'AD', 'Inactive')).rejects.toThrow(/own account/);
    await expect(service.deleteUser(admin, 'AD')).rejects.toThrow(/own account/);
  });

  it('the Super Admin account is protected, even from another Super Admin; an Admin cannot touch it at all', async () => {
    await expect(service.setStatus(admin, 'SA', 'Inactive')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.deleteUser(admin, 'SA')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.deleteUser(person('SA2', 'Super Admin'), 'SA')).rejects.toThrow(/protected/);
  });

  it('a reset gives a 12-character temporary password and saves it for that person', async () => {
    const { password } = await service.resetPassword(admin, 'ST');
    expect(password).toMatch(/^[0-9a-f]{12}$/);
    expect(settings.setUserPassword).toHaveBeenCalledWith('ST', password);
  });

  it('removes an ordinary person', async () => {
    await service.deleteUser(admin, 'ST');
    expect(settings.deleteUser).toHaveBeenCalledWith('ST');
  });
});
