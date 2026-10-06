import type { FarmItem, StockItem } from './types';
import { escapeHtml } from './alerts';
import { limitOf, limitUsed } from './farm-limit';

/**
 * Warnings that a farm is running out of room under its cattle limit
 * (src/lib/farm-limit.ts): at 80%, 90% and 100% used. Each step is announced
 * once per limit size, so raising the limit starts the warnings over. Pure and
 * browser-safe: Today, Farms and the Telegram message use the same rules.
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

/** One alert already sent (or being sent): this farm, at this limit size, reached this step. */
export interface SentCapacityAlert {
  farm: string;
  limit: number;
  step: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * What still has to be announced: for each farm at 80% or more, its current
 * step, unless that step (or a higher one) was already sent for this limit size.
 * A farm that jumps from 70% to 100% gets one alert, for 100%.
 */
export function planCapacityAlerts(levels: CapacityLevel[], sent: SentCapacityAlert[]): CapacityLevel[] {
  return nearLimit(levels).filter(l => !sent.some(s => norm(s.farm) === norm(l.farm) && s.limit === l.limit && s.step >= l.step));
}

/** The Telegram message for one farm (HTML subset; farm names are escaped). Plain words. */
export function buildCapacityAlert(level: CapacityLevel, options: { appUrl?: string } = {}): string {
  const link = options.appUrl ? `\n\n<a href="${escapeHtml(options.appUrl)}">Open CC Livestock</a>` : '';
  const title = `<b>Cattle limit · ${escapeHtml(level.farm)}</b>`;
  if (level.step === 100) {
    return `🔴 ${title}\n\nThe limit is reached: ${level.used} of ${level.limit} cattle.\nNo more cattle can be registered until a Super Admin or Admin raises the limit.${link}`;
  }
  return `⚠️ ${title}\n\n${level.step}% used: ${level.used} of ${level.limit} cattle. ${level.left} places left.\nPlease ask for a higher limit before it is full.${link}`;
}
