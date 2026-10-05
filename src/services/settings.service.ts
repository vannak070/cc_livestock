import { settingsRepository } from '../repositories/settings.repository';
import { CustomRoleDefinition, MasterSetup, PermissionKey } from '../lib/types';
import { withTransaction } from '../config/database';
import { Actor, AuthzError, assertPermission, can, redactSettingsFor } from '../lib/authz';

// Master settings is one document, but different screens own different
// parts of it: the feed category dialog edits feedTypes, and Settings edits
// the other lists and roles. Each changed section is checked on its own.
const SECTION_PERMISSIONS: Partial<Record<keyof MasterSetup, PermissionKey[]>> = {
  feedTypes: ['feed_manage', 'settings_manage']
};

// Written only by their own operations, never by a settings save.
const OWNED_ELSEWHERE: (keyof MasterSetup)[] = ['users', 'farms', 'locations'];

export class SettingsService {
  async getSettings(): Promise<MasterSetup> {
    return settingsRepository.getSettings();
  }

  async getSettingsFor(actor: Actor): Promise<MasterSetup> {
    return redactSettingsFor(actor, await settingsRepository.getSettings());
  }

  /**
   * Saves the master lists and roles. People, farms and the location list have
   * their own operations (user-admin.service, farm.service), so anything sent
   * for them here is ignored: an out-of-date screen can never delete a person
   * or put back a farm name.
   */
  async updateSettings(payload: Partial<MasterSetup>, actor: Actor): Promise<MasterSetup> {
    const current = await settingsRepository.getSettings();
    const patch: Partial<MasterSetup> = {};

    for (const key of Object.keys(payload) as (keyof MasterSetup)[]) {
      if (OWNED_ELSEWHERE.includes(key)) continue;
      if (JSON.stringify(current[key]) === JSON.stringify(payload[key])) continue;
      assertPermission(actor, ...(SECTION_PERMISSIONS[key] || ['settings_manage']));
      (patch as Record<string, unknown>)[key] = payload[key];
    }

    let renames: { from: string; to: string }[] = [];
    if (patch.roles) renames = await this.checkRoleChanges(actor, current.roles ?? [], patch.roles);

    if (Object.keys(patch).length > 0) {
      await withTransaction(async client => {
        await settingsRepository.updateSettings(patch, client);
        for (const r of renames) await settingsRepository.renameRole(r.from, r.to, client);
      });
    }
    return redactSettingsFor(actor, await settingsRepository.getSettings());
  }

  /** Roles: built-in ones keep their names, a role people still hold cannot be removed, and nobody hands a role access they lack. */
  private async checkRoleChanges(actor: Actor, before: CustomRoleDefinition[], after: CustomRoleDefinition[]): Promise<{ from: string; to: string }[]> {
    const renames: { from: string; to: string }[] = [];
    const afterById = new Map(after.map(r => [r.id, r]));
    for (const old of before) {
      const now = afterById.get(old.id);
      if (!now) {
        if (old.isSystem) throw new Error('The built-in roles cannot be deleted.');
        const people = await settingsRepository.countUsersWithRole(old.name);
        if (people > 0) throw new Error(`${people} ${people === 1 ? 'person has' : 'people have'} the ${old.name} role. Change their role first.`);
      } else if (now.name !== old.name) {
        if (old.isSystem) throw new Error('A built-in role keeps its name.');
        renames.push({ from: old.name, to: now.name });
      }
    }
    const names = new Set<string>();
    for (const r of after) {
      if (names.has(r.name.trim().toLowerCase())) throw new Error(`There is already a role called "${r.name}".`);
      names.add(r.name.trim().toLowerCase());
      const old = before.find(b => b.id === r.id);
      const notHeld = (r.permissions || []).filter(p => !(old?.permissions ?? []).includes(p) && !can(actor, p));
      if (notHeld.length > 0) throw new AuthzError(`You cannot give a role access you do not have yourself (${notHeld.join(', ')}).`, 403);
    }
    return renames;
  }
}

export const settingsService = new SettingsService();
