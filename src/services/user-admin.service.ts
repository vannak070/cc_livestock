import { settingsRepository } from '../repositories/settings.repository';
import { Actor, AuthzError, canManageUsers } from '../lib/authz';
import { generateTempPassword } from '../lib/generate-temp-password';
import { PRIVILEGED_ROLES, isFarmOwner, knownPermissions, validatePerson, type PersonInput } from '../lib/user-admin';
import type { UserRoleItem } from '../lib/types';

const STAFF_ROLES = ['Farm Staff', 'Veterinarian'];
const newId = () => `USR-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;

/**
 * Adding, changing, turning off and removing people, one account at a time.
 * Each call touches only that person's row, so a screen that is out of date
 * can never delete or overwrite anyone else. The same limits as before apply:
 * only a Super Admin touches Super Admins, only an Admin touches Admins, and
 * nobody hands out access they do not hold. A Farm Owner may manage the staff
 * and vets of their own farm, and no one else.
 */
function assertMayManage(actor: Actor, before: UserRoleItem | undefined, after?: { role: string; farmLocation?: string }): void {
  if (isFarmOwner(actor)) {
    if (!actor.farmLocation) throw new AuthzError('Your account has no farm, so you cannot manage people.', 403);
    if (before && !(before.farmLocation === actor.farmLocation && STAFF_ROLES.includes(before.role))) {
      throw new AuthzError('You can only manage the staff and vets on your own farm.', 403);
    }
    if (after && (!STAFF_ROLES.includes(after.role) || after.farmLocation !== actor.farmLocation)) {
      throw new AuthzError('You can only give the Farm Staff or Veterinarian role, on your own farm.', 403);
    }
  } else if (!canManageUsers(actor)) {
    throw new AuthzError('You do not have permission to manage people.', 403);
  }
  const roles = [before?.role, after?.role];
  if (roles.includes('Super Admin') && actor.role !== 'Super Admin') throw new AuthzError('Only a Super Admin can create, change or remove Super Admin accounts.', 403);
  if (roles.some(r => r && PRIVILEGED_ROLES.includes(r)) && !PRIVILEGED_ROLES.includes(actor.role)) throw new AuthzError('Only an Admin can create, change or remove Admin accounts.', 403);
}

async function validated(actor: Actor, input: PersonInput, editing: UserRoleItem | null): Promise<PersonInput> {
  const settings = await settingsRepository.getSettings();
  const own = isFarmOwner(actor) ? { ...input, farmLocation: actor.farmLocation ?? '' } : input;
  // Keys of removed features grant nothing: drop them instead of refusing the save.
  const clean = { ...own, permissions: knownPermissions(own.permissions) };
  const errors = validatePerson(settings, clean, editing, actor);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);
  return clean;
}

export class UserAdminService {
  async createUser(actor: Actor, input: PersonInput): Promise<{ user: UserRoleItem; tempPassword?: string }> {
    assertMayManage(actor, undefined, { role: input.role, farmLocation: input.farmLocation || undefined });
    const clean = await validated(actor, input, null);
    return settingsRepository.createUser({
      id: newId(),
      name: clean.name.trim(),
      email: clean.email.trim(),
      role: clean.role,
      status: 'Active',
      password: clean.password.trim(),
      pin: clean.pin.trim(),
      permissions: clean.permissions,
      farmLocation: clean.farmLocation.trim() || undefined,
    });
  }

  async updateUser(actor: Actor, id: string, input: PersonInput): Promise<UserRoleItem> {
    const before = await settingsRepository.findUserById(id);
    if (!before) throw new Error('That person no longer exists.');
    assertMayManage(actor, before, { role: input.role, farmLocation: input.farmLocation || undefined });
    const clean = await validated(actor, input, before);
    return settingsRepository.updateUser(id, {
      name: clean.name.trim(),
      email: clean.email.trim(),
      role: clean.role,
      permissions: clean.permissions,
      farmLocation: clean.farmLocation.trim() || undefined,
      password: clean.password.trim(),
      pin: clean.pin.trim(),
      clearPin: clean.clearPin,
    });
  }

  async setStatus(actor: Actor, id: string, status: 'Active' | 'Inactive'): Promise<void> {
    const before = await settingsRepository.findUserById(id);
    if (!before) throw new Error('That person no longer exists.');
    assertMayManage(actor, before);
    if (before.id === actor.id) throw new Error('You cannot turn off your own account.');
    if (before.role === 'Super Admin') throw new Error('The Super Admin account is protected and cannot be turned off.');
    await settingsRepository.setUserStatus(id, status);
  }

  async resetPassword(actor: Actor, id: string): Promise<{ password: string }> {
    const before = await settingsRepository.findUserById(id);
    if (!before) throw new Error('That person no longer exists.');
    assertMayManage(actor, before);
    const password = generateTempPassword();
    await settingsRepository.setUserPassword(id, password);
    return { password };
  }

  async deleteUser(actor: Actor, id: string): Promise<void> {
    const before = await settingsRepository.findUserById(id);
    if (!before) throw new Error('That person no longer exists.');
    assertMayManage(actor, before);
    if (before.id === actor.id) throw new Error('You cannot remove your own account.');
    if (before.role === 'Super Admin') throw new Error('The Super Admin account is protected and cannot be removed.');
    await settingsRepository.deleteUser(id);
  }
}

export const userAdminService = new UserAdminService();
