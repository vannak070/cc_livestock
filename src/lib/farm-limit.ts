import type { FarmItem, StockItem } from './types';

/**
 * A farm's cattle limit: how many cattle may be registered on it. Every animal
 * registered on the farm counts, whether it is still there, sold or dead, so
 * selling does not free a place; when the limit is used up the farm asks a
 * Super Admin or Admin for more. A limit of 0 means none has been set yet,
 * and no cattle can be added until one is. Only Super Admin and Admin set it.
 * Pure, so the screens and the server apply the same rules.
 */

/** The roles that set a farm's cattle limit and decide requests for more. */
export const LIMIT_ROLES = ['Super Admin', 'Admin'];

export const canSetLimits = (user: { role?: string } | null | undefined): boolean => !!user && LIMIT_ROLES.includes(user.role ?? '');

/** The most extra cattle one request may ask for, to catch typing slips. */
export const MAX_EXTRA = 100_000;

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/** The farm's limit; 0 when none is set. */
export const limitOf = (farm: Pick<FarmItem, 'capacity'> | null | undefined): number => Math.max(0, Math.floor(farm?.capacity ?? 0));

/** Cattle registered on the farm (any status): what counts toward its limit. */
export function limitUsed(farmName: string, stock: Pick<StockItem, 'location'>[]): number {
  const n = norm(farmName);
  return stock.filter(c => norm(c.location) === n).length;
}

export interface LimitState {
  limit: number;
  used: number;
  /** Places left; 0 when the limit is used up or not set. */
  left: number;
}

export function limitState(farm: Pick<FarmItem, 'name' | 'capacity'>, stock: Pick<StockItem, 'location'>[]): LimitState {
  const limit = limitOf(farm);
  const used = limitUsed(farm.name, stock);
  return { limit, used, left: Math.max(0, limit - used) };
}

export type LimitBlock = { reason: 'not-set' | 'full'; farm: string; limit: number; used: number };

/** Why `adding` more cattle cannot go onto the farm, or null when they fit. */
export function limitBlock(farm: Pick<FarmItem, 'name' | 'capacity'> | null | undefined, used: number, adding = 1): LimitBlock | null {
  if (!farm) return null; // an unknown farm is refused elsewhere
  const limit = limitOf(farm);
  if (limit === 0) return { reason: 'not-set', farm: farm.name, limit, used };
  if (used + adding > limit) return { reason: 'full', farm: farm.name, limit, used };
  return null;
}

/** The server's message for a block (the screens show their own, in the chosen language). */
export function limitBlockMessage(b: LimitBlock, adding = 1): string {
  if (b.reason === 'not-set') return `${b.farm} has no cattle limit yet. Ask a Super Admin or Admin to set it.`;
  return adding > 1
    ? `${b.farm} has room for ${Math.max(0, b.limit - b.used)} more of its ${b.limit} cattle, not ${adding}. Ask a Super Admin or Admin for more.`
    : `${b.farm} has used its cattle limit (${b.used} of ${b.limit}). Ask a Super Admin or Admin for more.`;
}

export interface LimitRequestInput {
  farm: string;
  extra: number;
  reason: string;
}

/** Why a request for more cattle cannot be sent, or null. */
export function limitRequestProblem(input: LimitRequestInput, farms: Pick<FarmItem, 'name'>[]): string | null {
  if (!farms.some(f => norm(f.name) === norm(input.farm))) return 'Choose a farm from the list.';
  if (!(Number.isInteger(input.extra) && input.extra >= 1 && input.extra <= MAX_EXTRA)) return 'Type how many more cattle the farm needs (a whole number).';
  if ((input.reason ?? '').trim().length > 500) return 'Keep the reason under 500 letters.';
  return null;
}

/** Why a decision on a request cannot be saved, or null. A new limit below what is used is refused. */
export function limitDecisionProblem(approve: boolean, newLimit: number, used: number): string | null {
  if (!approve) return null;
  if (!(Number.isInteger(newLimit) && newLimit >= 1 && newLimit <= 10_000_000)) return 'Type the new cattle limit (a whole number).';
  if (newLimit < used) return `The farm already has ${used} cattle registered; the limit cannot be lower.`;
  return null;
}
