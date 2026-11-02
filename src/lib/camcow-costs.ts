/**
 * What it costs to keep cattle at CamCow's stock site (user, 2026-10-16: "please improve stock"). A cost is entered with a date
 * and an amount, never against one animal. It is shared EVENLY between the animals in stock on that date, so each animal (and each
 * sale) can show its margin after costs. A cost on a day with nothing in stock is "not shared" and shown separately.
 * Pure and browser-safe (camcow-stock.service.ts writes).
 */
import { isDay } from './daily-feed';
import type { Holding } from './camcow-stock';

export const COST_KINDS = ['feed', 'medicine', 'labour', 'transport', 'other'] as const;
export type CostKind = (typeof COST_KINDS)[number];

export interface StockCost { id: string; date: string; kind: CostKind; amount: number; note: string }
export interface CostInput { date: string; kind: CostKind; amount: number; note?: string }

/** What is wrong with a cost, or null. */
export function costProblem(input: CostInput, today: string): string | null {
  if (!isDay(input.date)) return 'Choose the day of the cost.';
  if (input.date > today) return 'The day of the cost cannot be in the future.';
  if (!COST_KINDS.includes(input.kind)) return 'Choose what the cost is for.';
  if (!(Number.isFinite(input.amount) && Number.isInteger(input.amount) && input.amount > 0 && input.amount <= 1_000_000_000)) return 'Enter the amount in riel (more than 0).';
  if ((input.note ?? '').length > 300) return 'Keep the note under 300 characters.';
  return null;
}

/** The last day an animal counts as in stock: its sale or loss day, or none while it is still held. */
const endOf = (h: Holding): string | undefined => (h.status === 'Sold' ? h.soldOn : h.status === 'Lost' ? h.lostOn : undefined);

export interface CostShare {
  /** Riel shared to each animal over its whole stay (not rounded). */
  perCow: Map<string, number>;
  /** Costs on days with nothing in stock. */
  notShared: number;
  total: number;
}

/** Shares every cost evenly between the animals in stock on its date (collection day to sale or loss day, both included). */
export function shareCosts(holdings: Holding[], costs: StockCost[]): CostShare {
  const perCow = new Map<string, number>();
  let notShared = 0;
  let total = 0;
  for (const c of costs) {
    total += c.amount;
    const present = holdings.filter(h => h.collectedOn <= c.date && (endOf(h) === undefined || endOf(h)! >= c.date));
    if (present.length === 0) { notShared += c.amount; continue; }
    const each = c.amount / present.length;
    for (const h of present) perCow.set(h.cowId, (perCow.get(h.cowId) ?? 0) + each);
  }
  return { perCow, notShared, total };
}

export interface CostSummary {
  total: number;
  byKind: Record<CostKind, number>;
  /** Costs on days with nothing in stock. */
  notShared: number;
  /** Total a head a day, riel, over the days that had animals (0 when none). */
  perHeadPerDay: number;
}

/** The costs dated in the months from..to (YYYY-MM; both optional). `animalDays` is how many head-days were in stock in the same period. */
export function summarizeCosts(costs: StockCost[], holdings: Holding[], from?: string, to?: string): CostSummary {
  const inRange = costs.filter(c => { const m = c.date.slice(0, 7); return (!from || m >= from) && (!to || m <= to); });
  const byKind = Object.fromEntries(COST_KINDS.map(k => [k, 0])) as Record<CostKind, number>;
  let total = 0;
  for (const c of inRange) { byKind[c.kind] += c.amount; total += c.amount; }
  const share = shareCosts(holdings, inRange);
  // Head-days in stock on the days that have a cost: the figure a head a day is worked out from.
  const days = new Set(inRange.map(c => c.date));
  let headDays = 0;
  for (const d of days) headDays += holdings.filter(h => h.collectedOn <= d && (endOf(h) === undefined || endOf(h)! >= d)).length;
  const shared = total - share.notShared;
  return { total, byKind, notShared: share.notShared, perHeadPerDay: headDays > 0 ? Math.round(shared / headDays) : 0 };
}
