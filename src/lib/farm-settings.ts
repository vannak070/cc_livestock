import { DEFAULT_ROLE_PERMISSIONS } from '@/types/settings.types';
import type { FarmItem, MasterSetup, UserRoleItem } from './types';

/**
 * Adding, editing and deleting a farm changes several things in the settings at
 * once: the farm list, the location names, and the Farm Owner login of that
 * farm. Kept pure here so the screen only collects the answers.
 */

export interface FarmInput {
  name: string;
  address: string;
  capacity: number;
  ownerName: string;
  ownerEmail: string;
  /** Needed for a new owner login; when editing, empty keeps the current password. */
  ownerPassword: string;
  notes: string;
}

export type FarmErrors = Partial<Record<'name' | 'capacity' | 'ownerName' | 'ownerEmail' | 'ownerPassword', string>>;

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** The Farm Owner login that belongs to a farm, if there is one. */
export function farmOwner(settings: Pick<MasterSetup, 'users'>, farmName: string): UserRoleItem | undefined {
  return (settings.users || []).find(u => u.farmLocation === farmName && u.role === 'Farm Owner');
}

export function validateFarm(settings: Pick<MasterSetup, 'farms' | 'users'>, input: FarmInput, editing: FarmItem | null): FarmErrors {
  const errors: FarmErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Type the name of the farm.';
  else if ((settings.farms || []).some(f => f.id !== editing?.id && norm(f.name) === norm(name))) errors.name = `There is already a farm called "${name}".`;

  if (!(Number.isInteger(input.capacity) && input.capacity >= 1)) errors.capacity = 'Type how many cattle the farm can hold.';

  if (!input.ownerName.trim()) errors.ownerName = 'Type the owner\'s name.';

  const email = norm(input.ownerEmail);
  const existingOwner = editing ? farmOwner(settings, editing.name) : undefined;
  if (!email) errors.ownerEmail = 'Type the owner\'s email. It is their login.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.ownerEmail = 'That email does not look right.';
  else if ((settings.users || []).some(u => u.id !== existingOwner?.id && norm(u.email) === email)) errors.ownerEmail = 'Someone else already uses that email.';

  if (!existingOwner && !input.ownerPassword.trim()) errors.ownerPassword = 'Choose a password for the owner.';
  return errors;
}

/**
 * The settings after saving a farm. `renamedFrom` is the old name when the farm
 * was renamed, so the caller can move its cattle to the new name.
 */
export function saveFarm(settings: MasterSetup, input: FarmInput, editing: FarmItem | null, newId: () => string): { settings: MasterSetup; renamedFrom: string | null } {
  const name = input.name.trim();
  const email = input.ownerEmail.trim().toLowerCase();
  const ownerName = input.ownerName.trim();
  const password = input.ownerPassword.trim();
  let farms = [...(settings.farms || [])];
  const locations = [...(settings.locations || [])];
  let users = [...(settings.users || [])];

  const details = { name, address: input.address.trim(), capacity: input.capacity, ownerName, ownerEmail: email, notes: input.notes.trim() };
  const ownerUser = (): UserRoleItem => ({
    id: `USR-${newId()}`,
    name: ownerName,
    email,
    role: 'Farm Owner',
    status: 'Active',
    password,
    farmLocation: name,
    permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'],
  });

  if (editing) {
    const oldName = editing.name;
    farms = farms.map(f => (f.id === editing.id ? { ...f, ...details } : f));

    const at = locations.indexOf(oldName);
    if (at !== -1) locations[at] = name;
    if (!locations.includes(name)) locations.push(name);

    const ownerIdx = users.findIndex(u => u.farmLocation === oldName && u.role === 'Farm Owner');
    if (ownerIdx !== -1) {
      users[ownerIdx] = {
        ...users[ownerIdx],
        name: ownerName,
        email,
        // Left out when nothing was typed, so the saved password is kept.
        ...(password ? { password } : {}),
        farmLocation: name,
        permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'],
      };
    } else {
      users.push(ownerUser());
    }
    // Staff and vets of this farm follow it to the new name.
    users = users.map(u => (u.farmLocation === oldName && u.role !== 'Farm Owner' ? { ...u, farmLocation: name } : u));
    return { settings: { ...settings, farms, locations, users }, renamedFrom: oldName !== name ? oldName : null };
  }

  farms.push({ id: `FARM-${newId()}`, ...details });
  if (!locations.includes(name)) locations.push(name);
  users.push(ownerUser());
  return { settings: { ...settings, farms, locations, users }, renamedFrom: null };
}

/** The settings without the farm: its owner login goes, other users on it become unassigned. */
export function deleteFarm(settings: MasterSetup, farmId: string): MasterSetup {
  const target = (settings.farms || []).find(f => f.id === farmId);
  if (!target) return settings;
  return {
    ...settings,
    farms: (settings.farms || []).filter(f => f.id !== farmId),
    locations: (settings.locations || []).filter(l => l !== target.name),
    users: (settings.users || [])
      .filter(u => !(u.farmLocation === target.name && u.role === 'Farm Owner'))
      .map(u => (u.farmLocation === target.name ? { ...u, farmLocation: undefined } : u)),
  };
}
