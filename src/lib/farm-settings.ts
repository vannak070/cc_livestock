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
 * The farm list and location names after saving a farm. `renamedFrom` is the old
 * name when the farm was renamed, so the caller can move everything that points
 * at it.
 */
export function saveFarm(settings: Pick<MasterSetup, 'farms' | 'locations'>, input: FarmInput, editing: FarmItem | null, newId: () => string): { farms: FarmItem[]; locations: string[]; renamedFrom: string | null } {
  const name = input.name.trim();
  const details = { name, address: input.address.trim(), capacity: input.capacity, notes: input.notes.trim() };
  let farms = [...(settings.farms || [])];
  const locations = [...(settings.locations || [])];

  if (editing) {
    // Owner details used to be copied onto the farm; they live on the person now.
    farms = farms.map(f => {
      if (f.id !== editing.id) return f;
      const { ownerName: _n, ownerEmail: _e, ...rest } = f;
      void _n; void _e;
      return { ...rest, ...details };
    });
    const at = locations.indexOf(editing.name);
    if (at !== -1) locations[at] = name;
    if (!locations.includes(name)) locations.push(name);
    return { farms, locations, renamedFrom: editing.name !== name ? editing.name : null };
  }

  farms.push({ id: `FARM-${newId()}`, ...details });
  if (!locations.includes(name)) locations.push(name);
  return { farms, locations, renamedFrom: null };
}

/** The farm list and location names without the farm. */
export function deleteFarm(settings: Pick<MasterSetup, 'farms' | 'locations'>, farmId: string): { farms: FarmItem[]; locations: string[] } {
  const target = (settings.farms || []).find(f => f.id === farmId);
  if (!target) return { farms: settings.farms || [], locations: settings.locations || [] };
  return { farms: (settings.farms || []).filter(f => f.id !== farmId), locations: (settings.locations || []).filter(l => l !== target.name) };
}
