import { canSeeBilling } from './billing';
import { settingsRepository } from '../repositories/settings.repository';
import { canUsePlanning, hasPermission } from './utils';
import { isFarmOwner, visibleUsers } from './user-admin';
import { MasterSetup, PermissionKey, UserRoleItem } from './types';

/**
 * Server-side authorization shared by the Express API (mobile app) and the
 * Next.js server actions (web app). Both entry points resolve the caller to
 * an Actor re-read from the `users` table, then check permissions here — the
 * checks the browser does with `hasPermission` only decide what to *show*.
 */
export type Actor = UserRoleItem;

export class AuthzError extends Error {
  constructor(message: string, public statusCode: 401 | 403) {
    super(message);
    this.name = 'AuthzError';
  }
}

export async function loadActor(userId: string | undefined): Promise<Actor | null> {
  if (!userId) return null;
  return settingsRepository.getActiveUserById(userId);
}

export function can(actor: Actor, key: PermissionKey): boolean {
  return hasPermission(actor, key);
}

/** Throws a 403 unless the actor holds at least one of the given permissions. */
export function assertPermission(actor: Actor, ...anyOf: PermissionKey[]): void {
  if (anyOf.length === 0 || anyOf.some(key => can(actor, key))) return;
  throw new AuthzError('You do not have permission to perform this action.', 403);
}

/** Planning is only for Super Admin, Admin and Management (see PLANNING_ROLES). */
export function assertPlanningAccess(actor: Actor): void {
  if (!canUsePlanning(actor)) throw new AuthzError('Planning is only for Super Admin, Admin and Management.', 403);
}

/** Who may see and change the account roster (Settings → Users, Farms → owners). */
export function canManageUsers(actor: Actor): boolean {
  return can(actor, 'settings_manage') || can(actor, 'farms_manage');
}

/**
 * Account emails and roles are only sent to people who manage accounts. A farm
 * owner gets just the staff and vets of their own farm, the people they manage.
 */
export function redactSettingsFor(actor: Actor, settings: MasterSetup): MasterSetup {
  // The price CC Livestock is billed is only for Super Admin and Admin.
  const { billing, ...rest } = settings;
  const visible = canSeeBilling(actor) ? settings : (rest as MasterSetup);
  void billing;
  if (canManageUsers(actor)) return visible;
  if (isFarmOwner(actor) && actor.farmLocation) return { ...visible, users: visibleUsers(settings.users || [], actor) };
  return { ...visible, users: [] };
}
