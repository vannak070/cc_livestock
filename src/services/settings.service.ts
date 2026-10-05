import { settingsRepository } from '../repositories/settings.repository';
import { MasterSetup, PermissionKey, UserRoleItem, DEFAULT_ROLE_PERMISSIONS } from '../lib/types';
import { Actor, AuthzError, assertPermission, can, canManageUsers, redactSettingsFor } from '../lib/authz';

// Master settings is one document, but different screens own different
// parts of it: the Farms screen edits farms/locations (and creates farm
// owner accounts), the feed category dialog edits feedTypes, and Settings
// edits everything else. Each changed section is checked on its own.
const SECTION_PERMISSIONS: Partial<Record<keyof MasterSetup, PermissionKey[]>> = {
  farms: ['farms_manage', 'settings_manage'],
  locations: ['farms_manage', 'settings_manage'],
  feedTypes: ['feed_manage', 'settings_manage']
};

const PRIVILEGED_ROLES = ['Super Admin', 'Admin'];

function effectivePermissions(u: UserRoleItem): PermissionKey[] {
  return u.permissions && u.permissions.length > 0 ? u.permissions : DEFAULT_ROLE_PERMISSIONS[u.role] || [];
}

function userChanged(before: UserRoleItem | undefined, after: UserRoleItem): boolean {
  if (!before) return true;
  return before.name !== after.name
    || before.email !== after.email
    || before.role !== after.role
    || (before.status || 'Active') !== (after.status || 'Active')
    || (before.farmLocation || '') !== (after.farmLocation || '')
    || JSON.stringify(effectivePermissions(before)) !== JSON.stringify(effectivePermissions(after))
    || !!(after.password || '').trim()
    || !!(after.pin || '').trim()
    || !!after.clearPin;
}

// Stops anyone from using the account roster to give themselves (or a
// stooge account) more than they already have.
function assertUserChangesAllowed(actor: Actor, current: UserRoleItem[], next: UserRoleItem[]): void {
  const before = new Map(current.map(u => [u.id, u]));
  const nextIds = new Set(next.map(u => u.id));

  const touched: { before?: UserRoleItem; after?: UserRoleItem }[] = [
    ...current.filter(u => !nextIds.has(u.id)).map(u => ({ before: u })),
    ...next.filter(u => userChanged(before.get(u.id), u)).map(u => ({ before: before.get(u.id), after: u }))
  ];

  for (const { before: b, after: a } of touched) {
    const roles = [b?.role, a?.role];
    if (roles.includes('Super Admin') && actor.role !== 'Super Admin') {
      throw new AuthzError('Only a Super Admin can create, change or remove Super Admin accounts.', 403);
    }
    if (roles.some(r => r && PRIVILEGED_ROLES.includes(r)) && !PRIVILEGED_ROLES.includes(actor.role)) {
      throw new AuthzError('Only an Admin can create, change or remove Admin accounts.', 403);
    }
    if (a) {
      const granted = effectivePermissions(a).filter(p => !b || !effectivePermissions(b).includes(p));
      const notHeld = granted.filter(p => !can(actor, p));
      if (notHeld.length > 0) {
        throw new AuthzError(`You cannot grant permissions you do not have yourself (${notHeld.join(', ')}).`, 403);
      }
    }
  }
}

export class SettingsService {
  async getSettings(): Promise<MasterSetup> {
    return settingsRepository.getSettings();
  }

  async getSettingsFor(actor: Actor): Promise<MasterSetup> {
    return redactSettingsFor(actor, await settingsRepository.getSettings());
  }

  async updateSettings(payload: MasterSetup, actor: Actor): Promise<MasterSetup> {
    const current = await settingsRepository.getSettings();

    // Sections the caller left out keep their stored value, so a partial
    // payload can never blank out a list by omission.
    const next: MasterSetup = { ...current, ...payload };

    for (const key of Object.keys(next) as (keyof MasterSetup)[]) {
      if (key === 'users') continue;
      if (JSON.stringify(current[key]) === JSON.stringify(next[key])) continue;
      assertPermission(actor, ...(SECTION_PERMISSIONS[key] || ['settings_manage']));
    }

    if (canManageUsers(actor) && Array.isArray(payload.users)) {
      assertUserChangesAllowed(actor, current.users, payload.users);
    } else {
      // Callers who can't manage accounts were sent an empty roster, so what
      // comes back is not an instruction to delete everyone — leave the
      // `users` table exactly as it is.
      delete (next as Partial<MasterSetup>).users;
    }

    const saved = await settingsRepository.updateSettings(next);
    return redactSettingsFor(actor, saved);
  }
}

export const settingsService = new SettingsService();
