import type { FarmItem, MasterSetup, UserRoleItem } from './types';

/**
 * Adding, editing and deleting a farm changes the farm list and the location
 * names together. A farm's people, including its owner, are ordinary accounts
 * managed under People; they are never created or deleted from here.
 */

export interface FarmInput {
  name: string;
  address: string;
  capacity: number;
  notes: string;
  /** Run by the company itself, with no separate farm owner. */
  companyRun?: boolean;
}

export type FarmErrors = Partial<Record<'name' | 'capacity', string>>;

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** The Farm Owner logins of a farm; there should be at most one. */
export function farmOwners(settings: Pick<MasterSetup, 'users'>, farmName: string): UserRoleItem[] {
  return (settings.users || []).filter(u => u.farmLocation === farmName && u.role === 'Farm Owner');
}

export function farmOwner(settings: Pick<MasterSetup, 'users'>, farmName: string): UserRoleItem | undefined {
  return farmOwners(settings, farmName)[0];
}

/** Everyone assigned to a farm, owner first. */
export function farmPeople(settings: Pick<MasterSetup, 'users'>, farmName: string): UserRoleItem[] {
  return (settings.users || [])
    .filter(u => u.farmLocation === farmName)
    .sort((a, b) => Number(b.role === 'Farm Owner') - Number(a.role === 'Farm Owner') || a.name.localeCompare(b.name));
}

export function validateFarm(settings: Pick<MasterSetup, 'farms'>, input: FarmInput, editing: FarmItem | null): FarmErrors {
  const errors: FarmErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Type the name of the farm.';
  else if ((settings.farms || []).some(f => f.id !== editing?.id && norm(f.name) === norm(name))) errors.name = `There is already a farm called "${name}".`;
  if (!(Number.isInteger(input.capacity) && input.capacity >= 1)) errors.capacity = 'Type how many cattle the farm can hold.';
  return errors;
}

/**
 * The farm list after saving a farm. `renamedFrom` is the old name when the
 * farm was renamed, so the caller can move everything that points at it.
 */
export function saveFarm(settings: Pick<MasterSetup, 'farms'>, input: FarmInput, editing: FarmItem | null, newId: () => string): { farms: FarmItem[]; renamedFrom: string | null } {
  const name = input.name.trim();
  const details = { name, address: input.address.trim(), capacity: input.capacity, notes: input.notes.trim(), ...(input.companyRun ? { companyRun: true } : {}) };
  let farms = [...(settings.farms || [])];

  if (editing) {
    // Owner details used to be copied onto the farm; they live on the person now.
    farms = farms.map(f => {
      if (f.id !== editing.id) return f;
      const { ownerName: _n, ownerEmail: _e, companyRun: _c, ...rest } = f; // companyRun is re-set from the input below
      void _n; void _e; void _c;
      return { ...rest, ...details };
    });
    return { farms, renamedFrom: editing.name !== name ? editing.name : null };
  }

  farms.push({ id: `FARM-${newId()}`, ...details });
  return { farms, renamedFrom: null };
}

/** The farm list without the farm. */
export function deleteFarm(settings: Pick<MasterSetup, 'farms'>, farmId: string): { farms: FarmItem[] } {
  return { farms: (settings.farms || []).filter(f => f.id !== farmId) };
}
