import { withTransaction } from '../config/database';
import { farmRepository } from '../repositories/farm.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { Actor, AuthzError, assertPermission, can, canManageUsers } from '../lib/authz';
import { deleteFarm as withoutFarm, farmOwners, saveFarm as withFarm, validateFarm, type FarmInput } from '../lib/farm-settings';
import { DEFAULT_ROLE_PERMISSIONS, type FarmItem } from '../lib/types';

const newId = () => Math.random().toString(36).slice(2, 11).toUpperCase();
const OWNER_CANDIDATE_ROLES = ['Farm Owner', 'Farm Staff', 'Veterinarian'];

/**
 * Adding, renaming and deleting a farm, and choosing its owner. A farm is known
 * by its name in many places (cattle, batches, feed movements, people), so a
 * rename moves all of them in one transaction, and a farm that still has
 * cattle, an active batch or any person cannot be deleted. People, including
 * the owner, are ordinary accounts: this service never creates or deletes one.
 */
export class FarmService {
  private assertMay(actor: Actor): void {
    assertPermission(actor, 'farms_manage', 'settings_manage');
  }

  async saveFarm(actor: Actor, input: FarmInput, farmId: string | null): Promise<FarmItem> {
    this.assertMay(actor);
    const settings = await settingsRepository.getSettings();
    const editing = farmId ? (settings.farms || []).find(f => f.id === farmId) ?? null : null;
    if (farmId && !editing) throw new Error('That farm no longer exists.');

    const errors = validateFarm(settings, input, editing);
    const first = Object.values(errors)[0];
    if (first) throw new Error(first);

    const { farms, renamedFrom } = withFarm(settings, input, editing, newId);
    const name = input.name.trim();
    await withTransaction(async client => {
      if (renamedFrom) await farmRepository.renameEverywhere(renamedFrom, name, client);
      await settingsRepository.patchBlob({ farms }, client);
    });
    return farms.find(f => (editing ? f.id === editing.id : f.name === name))!;
  }

  /** Why a farm cannot be deleted yet, or null when it can. */
  async deleteBlock(name: string): Promise<string | null> {
    const [cattle, batches, people] = await Promise.all([farmRepository.countActiveCattle(name), farmRepository.countActiveBatches(name), farmRepository.countPeople(name)]);
    const parts = [
      cattle > 0 ? `${cattle} active ${cattle === 1 ? 'animal' : 'animals'}` : '',
      batches > 0 ? `${batches} active ${batches === 1 ? 'batch' : 'batches'}` : '',
      people > 0 ? `${people} ${people === 1 ? 'person' : 'people'}` : '',
    ].filter(Boolean);
    return parts.length ? `${name} still has ${parts.join(', ')}. Move, sell or remove ${cattle + batches + people === 1 ? 'it' : 'them'} first, then delete the farm.` : null;
  }

  async deleteFarm(actor: Actor, farmId: string): Promise<void> {
    this.assertMay(actor);
    const settings = await settingsRepository.getSettings();
    const farm = (settings.farms || []).find(f => f.id === farmId);
    if (!farm) throw new Error('That farm no longer exists.');
    const block = await this.deleteBlock(farm.name);
    if (block) throw new Error(block);
    const { farms } = withoutFarm(settings, farmId);
    await settingsRepository.patchBlob({ farms });
  }

  /**
   * Makes a person on the farm its owner. A farm has one owner, so the owner
   * it had becomes Farm Staff of the same farm. Both change together or not at all.
   */
  async setOwner(actor: Actor, farmId: string, userId: string): Promise<void> {
    this.assertMay(actor);
    if (!canManageUsers(actor)) throw new AuthzError('You do not have permission to manage people.', 403);
    const settings = await settingsRepository.getSettings();
    const farm = (settings.farms || []).find(f => f.id === farmId);
    if (!farm) throw new Error('That farm no longer exists.');
    const target = await settingsRepository.findUserById(userId);
    if (!target || target.farmLocation !== farm.name) throw new Error('Choose someone who works on this farm.');
    if (!OWNER_CANDIDATE_ROLES.includes(target.role)) throw new Error(`A ${target.role} cannot be made the owner of a farm.`);

    const ownerPermissions = DEFAULT_ROLE_PERMISSIONS['Farm Owner'];
    if (target.role !== 'Farm Owner') {
      const notHeld = ownerPermissions.filter(p => !can(actor, p));
      if (notHeld.length > 0) throw new AuthzError(`You cannot give owner access you do not have yourself (${notHeld.join(', ')}).`, 403);
    }
    const others = farmOwners(settings, farm.name).filter(o => o.id !== userId);
    await withTransaction(async client => {
      for (const o of others) await settingsRepository.setUserRole(o.id, 'Farm Staff', DEFAULT_ROLE_PERMISSIONS['Farm Staff'], client);
      if (target.role !== 'Farm Owner') await settingsRepository.setUserRole(userId, 'Farm Owner', ownerPermissions, client);
    });
  }
}

export const farmService = new FarmService();
