import type { FarmItem, StockItem } from './types';
import { limitOf, limitUsed } from './farm-limit';

/**
 * Warnings that a farm is running out of room under its cattle limit
 * (src/lib/farm-limit.ts): at 80%, 90% and 100% used, shown in the app (Today,
 * Farms). Not sent to Telegram. Pure and browser-safe.
 */

export const CAPACITY_STEPS = [80, 90, 100] as const;
export type CapacityStep = (typeof CAPACITY_STEPS)[number];

/** The highest step reached: used/limit >= step%. 0 below 80%, and for a farm with no limit set. */
export function capacityStep(used: number, limit: number): 0 | CapacityStep {
  if (!(limit > 0)) return 0;
  let reached: 0 | CapacityStep = 0;
  for (const step of CAPACITY_STEPS) if (used * 100 >= step * limit) reached = step;
  return reached;
}

export interface CapacityLevel {
  farm: string;
  limit: number;
  used: number;
  left: number;
  step: 0 | CapacityStep;
  /** Whole percent used, capped at 100 for display. */
  percent: number;
}

/** Every farm that has a limit, with how full it is. Every registered animal counts, sold ones too. */
export function capacityLevels(farms: Pick<FarmItem, 'name' | 'capacity'>[], stock: Pick<StockItem, 'location'>[]): CapacityLevel[] {
  return farms.flatMap(f => {
    const limit = limitOf(f);
    if (limit === 0) return [];
    const used = limitUsed(f.name, stock);
    return [{ farm: f.name, limit, used, left: Math.max(0, limit - used), step: capacityStep(used, limit), percent: Math.min(100, Math.floor((used * 100) / limit)) }];
  });
}

/** Levels at 80% or more, fullest first. */
export const nearLimit = (levels: CapacityLevel[]): CapacityLevel[] =>
  levels.filter(l => l.step > 0).sort((a, b) => b.used / b.limit - a.used / a.limit || a.farm.localeCompare(b.farm));
