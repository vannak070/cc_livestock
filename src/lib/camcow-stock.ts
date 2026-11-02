/**
 * CC Livestock's own stock (user, 2026-10-16): after it collects finished cattle from a farm (a sale to CC Livestock, see
 * buyback.ts) the animals are RECEIVED into stock held by CC Livestock, then SOLD on to a buyer by scale, or marked LOST.
 * Pure and browser-safe; the server writes the rows (camcow-stock.service.ts, migration 029).
 *
 * Phase 1 (defaults chosen by the assistant on "go ahead with defaults"): one stock site, no capacity limit, sales by scale
 * (weight x price a kg). The margin here is the sale less what CC Livestock paid at the collection; holding costs come later.
 */
import { addDays, farmToday, isDay } from './daily-feed';
import { isBuybackSale } from './buyback';

export { canSeeActionPlans as canSeeCamcowStock, canWritePlans as canManageCamcowStock } from './action-plans';

/** Cattle held longer than this many days without a sale raise the "unsold" alert. */
export const HELD_ALERT_DAYS = 30;

export type HoldingStatus = 'Held' | 'Sold' | 'Lost';

export interface Holding {
  cowId: string;
  sourceFarm: string;
  batchId?: string;
  /** YYYY-MM-DD */
  collectedOn: string;
  collectionWeight: number;
  collectionTotal: number;
  status: HoldingStatus;
  soldOn?: string;
  buyer?: string;
  buyerId?: string;
  saleWeight?: number;
  salePricePerKg?: number;
  saleTotal?: number;
  lostOn?: string;
  note: string;
}

/** An animal that was collected (sold to CC Livestock) but is not in stock yet. */
export interface Waiting { cowId: string; farm: string; batchId?: string; collectedOn: string; weight: number; total: number }

/** The farm-calendar day of a stored date, or '' when there is none. */
const dayOf = (d: string | Date | null | undefined) => (d ? farmToday(new Date(d)) : '');
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Collected cattle not yet received: the animals with a sale to CC Livestock and no holding row. An animal sold to CC Livestock
 * twice counts once, with its latest collection.
 */
export function waitingToReceive(
  stock: { id: string; location?: string }[],
  sales: { cowId: string; buyer?: string; salesDate?: string | Date | null; weight?: number; totalPrice?: number }[],
  holdings: { cowId: string }[],
  batchOf: (cowId: string) => string | undefined = () => undefined,
): Waiting[] {
  const held = new Set(holdings.map(h => h.cowId));
  const farmOf = new Map(stock.map(c => [c.id, c.location ?? '']));
  const latest = new Map<string, Waiting>();
  for (const s of sales) {
    if (!isBuybackSale(s) || held.has(s.cowId) || !farmOf.has(s.cowId)) continue;
    const on = dayOf(s.salesDate);
    const w: Waiting = { cowId: s.cowId, farm: farmOf.get(s.cowId) ?? '', batchId: batchOf(s.cowId), collectedOn: on, weight: Number(s.weight) || 0, total: Number(s.totalPrice) || 0 };
    const old = latest.get(s.cowId);
    if (!old || on >= old.collectedOn) latest.set(s.cowId, w);
  }
  return [...latest.values()].sort((a, b) => a.collectedOn.localeCompare(b.collectedOn) || a.farm.localeCompare(b.farm) || a.cowId.localeCompare(b.cowId));
}

export interface WaitingGroup { key: string; farm: string; batchId?: string; collectedOn: string; head: number; kg: number; total: number; cowIds: string[] }

/** Waiting animals grouped by farm, batch and collection day (one tap receives a group). */
export function waitingGroups(rows: Waiting[]): WaitingGroup[] {
  const by = new Map<string, WaitingGroup>();
  for (const w of rows) {
    const key = `${w.farm}|${w.batchId ?? ''}|${w.collectedOn}`;
    const g = by.get(key) ?? { key, farm: w.farm, batchId: w.batchId, collectedOn: w.collectedOn, head: 0, kg: 0, total: 0, cowIds: [] };
    g.head++; g.kg += w.weight; g.total += w.total; g.cowIds.push(w.cowId);
    by.set(key, g);
  }
  return [...by.values()].sort((a, b) => a.collectedOn.localeCompare(b.collectedOn) || a.farm.localeCompare(b.farm));
}

export interface HeldLot { key: string; farm: string; batchId?: string; collectedOn: string; head: number; kg: number; cost: number; daysHeld: number; cowIds: string[] }

/** The cattle in stock, grouped into lots (farm, batch, collection day), oldest first. */
export function heldLots(holdings: Holding[], today: string): HeldLot[] {
  const by = new Map<string, HeldLot>();
  for (const h of holdings.filter(x => x.status === 'Held')) {
    const key = `${h.sourceFarm}|${h.batchId ?? ''}|${h.collectedOn}`;
    const l = by.get(key) ?? { key, farm: h.sourceFarm, batchId: h.batchId, collectedOn: h.collectedOn, head: 0, kg: 0, cost: 0, daysHeld: Math.max(0, daysBetween(h.collectedOn, today)), cowIds: [] };
    l.head++; l.kg += h.collectionWeight; l.cost += h.collectionTotal; l.cowIds.push(h.cowId);
    by.set(key, l);
  }
  return [...by.values()].sort((a, b) => a.collectedOn.localeCompare(b.collectedOn) || a.farm.localeCompare(b.farm));
}

export interface SoldLot { cowIds: string[]; key: string; soldOn: string; buyer: string; farm: string; head: number; kg: number; total: number; margin: number }

/** Cattle sold on, grouped by day, buyer and the farm they came from, newest first. */
export function soldLots(holdings: Holding[]): SoldLot[] {
  const by = new Map<string, SoldLot>();
  for (const h of holdings.filter(x => x.status === 'Sold')) {
    const key = `${h.soldOn ?? ''}|${h.buyer ?? ''}|${h.sourceFarm}`;
    const l = by.get(key) ?? { key, soldOn: h.soldOn ?? '', buyer: h.buyer ?? '', farm: h.sourceFarm, head: 0, kg: 0, total: 0, margin: 0, cowIds: [] };
    l.cowIds.push(h.cowId);
    l.head++; l.kg += h.saleWeight ?? 0; l.total += h.saleTotal ?? 0; l.margin += (h.saleTotal ?? 0) - h.collectionTotal;
    by.set(key, l);
  }
  return [...by.values()].sort((a, b) => b.soldOn.localeCompare(a.soldOn) || a.farm.localeCompare(b.farm) || a.buyer.localeCompare(b.buyer));
}

/** Money made on an animal sold on to a buyer: the sale less what CC Livestock paid at the collection (holding costs not counted yet). */
export const marginOf = (h: Pick<Holding, 'saleTotal' | 'collectionTotal'>) => (h.saleTotal ?? 0) - h.collectionTotal;

export interface StockSummary {
  /** In stock now. */
  held: number;
  heldKg: number;
  /** What CC Livestock paid for the cattle in stock. */
  heldCost: number;
  avgDaysHeld: number;
  oldestDaysHeld: number;
  /** In stock longer than HELD_ALERT_DAYS. */
  heldTooLong: number;
  sold: number;
  soldRevenue: number;
  /** Margin on the cattle sold on (sale less collection price). */
  margin: number;
  /** Holding costs shared to the cattle sold on in the same period (0 when no costs are given). */
  soldCost: number;
  /** Margin less those holding costs. */
  marginAfterCosts: number;
  lost: number;
  /** What CC Livestock paid for cattle that were lost. */
  lostCost: number;
}

/** `from` and `to` (YYYY-MM) limit the sold figures to the months between them; the cattle in stock are always as at today. `costOf` is each animal's share of the holding costs (camcow-costs.ts). */
export function summarizeStock(holdings: Holding[], today: string, from?: string, to?: string, costOf?: Map<string, number>): StockSummary {
  const held = holdings.filter(h => h.status === 'Held');
  const soldAll = holdings.filter(h => h.status === 'Sold');
  const sold = soldAll.filter(h => { const m = (h.soldOn ?? '').slice(0, 7); return (!from || m >= from) && (!to || m <= to); });
  const lost = holdings.filter(h => h.status === 'Lost');
  const days = held.map(h => Math.max(0, daysBetween(h.collectedOn, today)));
  return {
    held: held.length,
    heldKg: held.reduce((s, h) => s + h.collectionWeight, 0),
    heldCost: held.reduce((s, h) => s + h.collectionTotal, 0),
    avgDaysHeld: days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0,
    oldestDaysHeld: days.length ? Math.max(...days) : 0,
    heldTooLong: days.filter(d => d > HELD_ALERT_DAYS).length,
    sold: sold.length,
    soldRevenue: sold.reduce((s, h) => s + (h.saleTotal ?? 0), 0),
    margin: sold.reduce((s, h) => s + marginOf(h), 0),
    soldCost: Math.round(sold.reduce((s, h) => s + (costOf?.get(h.cowId) ?? 0), 0)),
    marginAfterCosts: Math.round(sold.reduce((s, h) => s + marginOf(h) - (costOf?.get(h.cowId) ?? 0), 0)),
    lost: lost.length,
    lostCost: lost.reduce((s, h) => s + h.collectionTotal, 0),
  };
}

export interface SaleInput {
  cowIds: string[];
  buyerId: string;
  date: string;
  pricePerKg: number;
  /** The scale weight of each animal, kg. */
  weights: Record<string, number>;
}

/** What is wrong with a sale to a buyer, or null. `held` is the set of animals in stock. */
export function saleProblem(input: SaleInput, held: Set<string>, today: string): string | null {
  if (!Array.isArray(input.cowIds) || input.cowIds.length === 0) return 'Choose the cattle to sell.';
  if (input.cowIds.length > 500) return 'Sell at most 500 animals at a time.';
  if (new Set(input.cowIds).size !== input.cowIds.length) return 'An animal is listed twice.';
  if (input.cowIds.some(id => !held.has(id))) return 'One of the animals is not in stock any more. Reload the page and try again.';
  if (!(input.buyerId ?? '').trim()) return 'Choose the buyer.';
  if (!isDay(input.date)) return 'Choose the day of the sale.';
  if (input.date > today) return 'The day of the sale cannot be in the future.';
  if (!(Number.isFinite(input.pricePerKg) && input.pricePerKg > 0 && input.pricePerKg <= 1_000_000)) return 'Enter the price per kg in riel (more than 0).';
  for (const id of input.cowIds) {
    const w = input.weights?.[id];
    if (!(typeof w === 'number' && Number.isFinite(w) && w > 0 && w <= 2000)) return `Enter the weight of ${id} in kg (more than 0).`;
  }
  return null;
}

/** What is wrong with marking animals as lost, or null. */
export function lostProblem(cowIds: string[], date: string, note: string, held: Set<string>, today: string): string | null {
  if (!Array.isArray(cowIds) || cowIds.length === 0) return 'Choose the cattle.';
  if (cowIds.some(id => !held.has(id))) return 'One of the animals is not in stock any more. Reload the page and try again.';
  if (!isDay(date)) return 'Choose the day it was lost.';
  if (date > today) return 'The day cannot be in the future.';
  if ((note ?? '').length > 500) return 'Keep the note under 500 characters.';
  return null;
}

/** The day `n` days after a collection, for the seed and tests. */
export const afterCollection = (collectedOn: string, n: number) => addDays(collectedOn, n);
