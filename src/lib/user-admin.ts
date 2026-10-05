import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type CustomRoleDefinition, type MasterSetup, type PermissionKey, type UserRoleItem } from '@/types/settings.types';
import { hasPermission } from './utils';
import { validatePinStrength } from './pin';

/**
 * The rules for the people list and the roles list in Settings. The server
 * enforces the same limits (src/services/settings.service.ts); keeping them
 * here as pure functions lets the screen show only what will be accepted.
 */

export const PRIVILEGED_ROLES = ['Super Admin', 'Admin'];
/** Roles that belong to one farm: without a farm the person would see every farm. */
export const FARM_ROLES = ['Farm Owner', 'Farm Staff', 'Veterinarian'];
export const MIN_PASSWORD_LENGTH = 8;

export const SYSTEM_ROLES: CustomRoleDefinition[] = [
  { id: 'ROLE-01', name: 'Super Admin', description: 'Full system management and security authority.', permissions: DEFAULT_ROLE_PERMISSIONS['Super Admin'], isSystem: true },
  { id: 'ROLE-02', name: 'Admin', description: 'Full business operations control and user creation privileges.', permissions: DEFAULT_ROLE_PERMISSIONS['Admin'], isSystem: true },
  { id: 'ROLE-03', name: 'Company', description: 'Manages user accounts, permissions, and multiple farms under them.', permissions: DEFAULT_ROLE_PERMISSIONS['Company'], isSystem: true },
  { id: 'ROLE-04', name: 'Farm Owner', description: 'Full operational control of their own farm.', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'], isSystem: true },
  { id: 'ROLE-05', name: 'Farm Staff', description: 'Records weights, health and daily work on their farm.', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Staff'], isSystem: true },
  { id: 'ROLE-06', name: 'Veterinarian', description: 'Health tracking, medical records and treatments.', permissions: DEFAULT_ROLE_PERMISSIONS['Veterinarian'], isSystem: true },
  { id: 'ROLE-07', name: 'Management', description: 'Sees every report, changes nothing.', permissions: DEFAULT_ROLE_PERMISSIONS['Management'], isSystem: true },
];

type Actor = Pick<UserRoleItem, 'id' | 'role' | 'permissions' | 'farmLocation'>;

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

export function rolesOf(settings: Pick<MasterSetup, 'roles'>): CustomRoleDefinition[] {
  return settings.roles && settings.roles.length > 0 ? settings.roles : SYSTEM_ROLES;
}

export function effectivePermissions(u: Pick<UserRoleItem, 'role' | 'permissions'>, roles: CustomRoleDefinition[] = SYSTEM_ROLES): PermissionKey[] {
  if (u.permissions && u.permissions.length > 0) return u.permissions;
  return roles.find(r => r.name === u.role)?.permissions ?? DEFAULT_ROLE_PERMISSIONS[u.role] ?? [];
}

/** What a farm owner manages: the staff and vets on their own farm. */
export function isFarmOwner(actor: Pick<UserRoleItem, 'role'>): boolean {
  return actor.role === 'Farm Owner';
}

/**
 * Settings → People lists the office accounts; farm owners, staff and vets are
 * managed from their farm on the Farms page. A farm person whose farm is
 * missing or gone also stays in Settings, so nobody is lost.
 */
export function isOfficePerson(u: Pick<UserRoleItem, 'role' | 'farmLocation'>, farmNames: string[]): boolean {
  return !FARM_ROLES.includes(u.role) || !u.farmLocation || !farmNames.includes(u.farmLocation);
}

/** The roles given from Settings: everything except the farm roles. */
export function officeRoleNames(roles: CustomRoleDefinition[]): string[] {
  return roles.map(r => r.name).filter(n => !FARM_ROLES.includes(n));
}

/** Whether this person gets the People page: account managers, and a farm owner for their own farm. */
export function canOpenPeople(user: Pick<UserRoleItem, 'role' | 'permissions' | 'farmLocation'> | undefined | null): boolean {
  if (!user) return false;
  return hasPermission(user, 'settings_manage') || (isFarmOwner(user) && !!user.farmLocation);
}

export function visibleUsers(users: UserRoleItem[], actor: Actor): UserRoleItem[] {
  if (!isFarmOwner(actor)) return users;
  return users.filter(u => u.farmLocation === actor.farmLocation && (u.role === 'Farm Staff' || u.role === 'Veterinarian'));
}

/** The roles this person may give to someone. */
export function assignableRoles(roles: CustomRoleDefinition[], actor: Pick<UserRoleItem, 'role'>): CustomRoleDefinition[] {
  if (actor.role === 'Super Admin') return roles;
  if (actor.role === 'Admin') return roles.filter(r => r.name !== 'Super Admin');
  if (isFarmOwner(actor)) return roles.filter(r => r.name === 'Farm Staff' || r.name === 'Veterinarian');
  return roles.filter(r => !PRIVILEGED_ROLES.includes(r.name));
}

/** Whether this person may change or remove that account. */
export function canChangeUser(actor: Pick<UserRoleItem, 'role'>, target: Pick<UserRoleItem, 'role'>): boolean {
  if (target.role === 'Super Admin') return actor.role === 'Super Admin';
  if (PRIVILEGED_ROLES.includes(target.role)) return PRIVILEGED_ROLES.includes(actor.role);
  return true;
}

/** Permissions this person may hand out: only ones they hold themselves. */
export function grantable(actor: Pick<UserRoleItem, 'role' | 'permissions'>): PermissionKey[] {
  return ALL_PERMISSIONS.filter(p => hasPermission(actor, p));
}

export interface PersonInput {
  name: string;
  email: string;
  role: string;
  farmLocation: string;
  /** Empty when adding means a temporary password is made; empty when editing keeps the current one. */
  password: string;
  pin: string;
  clearPin: boolean;
  permissions: PermissionKey[];
}

export type PersonErrors = Partial<Record<'name' | 'email' | 'role' | 'farmLocation' | 'password' | 'pin' | 'permissions', string>>;

export function validatePerson(settings: Pick<MasterSetup, 'users' | 'roles' | 'farms'>, input: PersonInput, editing: UserRoleItem | null, actor: Actor): PersonErrors {
  const errors: PersonErrors = {};
  const roles = rolesOf(settings);
  if (!input.name.trim()) errors.name = 'Type the person\'s name.';

  const email = norm(input.email);
  if (!email) errors.email = 'Type their email. It is how they sign in.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'That email does not look right.';
  else if ((settings.users || []).some(u => u.id !== editing?.id && norm(u.email) === email)) errors.email = 'Someone else already uses that email.';

  if (!assignableRoles(roles, actor).some(r => r.name === input.role)) errors.role = 'You cannot give that role.';

  const farms = settings.farms || [];
  if (FARM_ROLES.includes(input.role) && farms.length > 0 && !input.farmLocation.trim()) errors.farmLocation = 'Choose which farm this person works on.';

  if (!errors.farmLocation && input.role === 'Farm Owner' && input.farmLocation.trim()) {
    const other = (settings.users || []).find(u => u.role === 'Farm Owner' && u.farmLocation === input.farmLocation.trim() && u.id !== editing?.id);
    if (other) errors.farmLocation = `${input.farmLocation.trim()} already has an owner (${other.name}). A farm has one owner: change their role first, or choose another farm.`;
  }

  const password = input.password.trim();
  if (password && password.length < MIN_PASSWORD_LENGTH) errors.password = `A password needs at least ${MIN_PASSWORD_LENGTH} characters.`;

  const pin = input.pin.trim();
  if (pin) {
    const problem = validatePinStrength(pin);
    if (problem) errors.pin = problem;
  }

  const before = editing ? effectivePermissions(editing, roles) : [];
  const notHeld = input.permissions.filter(p => !before.includes(p) && !hasPermission(actor, p));
  if (notHeld.length > 0) errors.permissions = `You cannot give access you do not have yourself (${notHeld.join(', ')}).`;

  // Nobody changes their own role, farm or access, so no one can lock themselves
  // (or the last Super Admin) out. Another admin has to do it.
  if (editing && editing.id === actor.id) {
    const ask = 'Ask another admin to change it.';
    if (input.role !== editing.role) errors.role = `You cannot change your own role. ${ask}`;
    if (norm(input.farmLocation) !== norm(editing.farmLocation)) errors.farmLocation = `You cannot change your own farm. ${ask}`;
    const sameAccess = input.permissions.length === before.length && input.permissions.every(p => before.includes(p));
    if (!sameAccess) errors.permissions = `You cannot change your own access. ${ask}`;
  }
  return errors;
}

/**
 * Whether a person uses their role's usual access rather than access made just
 * for them. When the role changes, these people get the new access; people
 * with their own access keep it. The server does the same in SQL
 * (settingsRepository.applyRoleAccess).
 */
export function followsRole(u: Pick<UserRoleItem, 'role' | 'permissions'>, roleName: string, rolePermissions: PermissionKey[]): boolean {
  if (u.role !== roleName) return false;
  const own = u.permissions ?? [];
  return own.length === 0 || (rolePermissions.every(p => own.includes(p)) && own.every(p => rolePermissions.includes(p)));
}

export interface RoleInput { name: string; description: string; permissions: PermissionKey[] }
export type RoleErrors = Partial<Record<'name' | 'permissions', string>>;

export function validateRole(settings: Pick<MasterSetup, 'roles'>, input: RoleInput, editing: CustomRoleDefinition | null, actor: Actor): RoleErrors {
  const errors: RoleErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Type a name for the role.';
  else if (rolesOf(settings).some(r => r.id !== editing?.id && norm(r.name) === norm(name))) errors.name = `There is already a role called "${name}".`;
  if (input.permissions.length === 0) errors.permissions = 'Choose at least one thing this role can do.';
  const before = editing?.permissions ?? [];
  const notHeld = input.permissions.filter(p => !before.includes(p) && !hasPermission(actor, p));
  if (notHeld.length > 0) errors.permissions = `You cannot give access you do not have yourself (${notHeld.join(', ')}).`;
  return errors;
}

/** The roles after adding or changing one. A renamed custom role is renamed on its people by the server. */
export function saveRole(settings: Pick<MasterSetup, 'roles'>, input: RoleInput, editing: CustomRoleDefinition | null, newId: () => string): CustomRoleDefinition[] {
  const roles = rolesOf(settings);
  const name = input.name.trim();
  const description = input.description.trim();
  if (editing) {
    return roles.map(r => (r.id === editing.id ? { ...r, name: editing.isSystem ? r.name : name, description, permissions: input.permissions } : r));
  }
  return [...roles, { id: `ROLE-${newId()}`, name, description: description || 'Custom role', permissions: input.permissions, isSystem: false }];
}

/** Why a role cannot be deleted, or null when it can. */
export function roleDeleteBlock(settings: Pick<MasterSetup, 'users' | 'roles'>, role: CustomRoleDefinition): string | null {
  if (role.isSystem || role.name === 'Super Admin') return 'The built-in roles cannot be deleted.';
  const people = (settings.users || []).filter(u => u.role === role.name).length;
  return people > 0 ? `${people} ${people === 1 ? 'person has' : 'people have'} this role. Change ${people === 1 ? 'their' : 'their'} role first.` : null;
}

export function deleteRole(settings: Pick<MasterSetup, 'roles'>, roleId: string): CustomRoleDefinition[] {
  return rolesOf(settings).filter(r => r.id !== roleId);
}
