import type { BatchItem, FarmCostItem, FeedStockTransaction, HealthLogItem } from './types';
import type { SalesRecord, StockItem } from './xlsx-parser';
import { dayOf, isDay, parseFeedRef } from './daily-feed';
import { farmMatcher } from './farm-scope';

/**
 * Farm running costs and farm profit, kept pure so the screens and the server
 * share one set of rules.
 *
 * Running costs are only what no other page records: cattle (Add cattle),
 * medicine (Health) and feed (Feed in / daily feed) each have their own
 * records, so they are not offered here and are never counted twice.
 *
 * Farm profit for a month = sales − what the animals sold that month cost to
 * buy − the feed those animals ate − medicine given − running costs.
 * Buying cattle and feeding them are not a cost until the animal is sold:
 * feed eaten by cattle still on the farm is shown apart, as feed "in the herd".
 * Medicine and running costs count in the month they were spent. Feed that
 * cannot be put on any animal (taken out by hand, or a batch with nobody left
 * in it that day) also counts in the month it left the store.
 */

/** The kinds of running cost until someone changes the list in Settings → Lists. */
export const DEFAULT_COST_CATEGORIES = [
  'Wages',
  'Power and water',
  'Fuel and transport',
  'Repairs and equipment',
  'Bank interest',
  'Rent',
  'Other',
] as const;

/** The kinds of running cost people can choose: the Settings list, or the defaults when it is not set. */
export function costCategoriesFrom(settings?: { costCategories?: string[] } | null): string[] {
  return settings?.costCategories?.length ? settings.costCategories : [...DEFAULT_COST_CATEGORIES];
}

export const MAX_CATEGORY_LENGTH = 50; // farm_costs.category is VARCHAR(50)
const MAX_CATEGORIES = 50;

/** Why a new list of cost kinds cannot be saved, or null. */
export function costCategoriesProblem(list: unknown): string | null {
  if (!Array.isArray(list) || list.some(c => typeof c !== 'string')) return 'The list of costs is not valid.';
  const names = (list as string[]).map(c => c.trim());
  if (names.length === 0) return 'Keep at least one kind of cost.';
  if (names.length > MAX_CATEGORIES) return `Keep the list under ${MAX_CATEGORIES} kinds of cost.`;
  if (names.some(c => !c)) return 'A kind of cost cannot be empty.';
  const long = names.find(c => c.length > MAX_CATEGORY_LENGTH);
  if (long) return `"${long.slice(0, 20)}…" is too long. Keep each one under ${MAX_CATEGORY_LENGTH} letters.`;
  if (new Set(names.map(c => c.toLowerCase())).size !== names.length) return 'Each kind of cost can only be in the list once.';
  return null;
}

export interface FarmCostInput {
  farmLocation: string;
  category: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
}

export const MAX_COST_AMOUNT = 10_000_000_000; // 10 billion riel: anything bigger is a typo
const MAX_NOTE = 500;

/** Why a cost cannot be saved, or null. `today` is the farm's today; `categories` the kinds people may choose. */
export function farmCostProblem(input: FarmCostInput, today: string, categories: readonly string[] = DEFAULT_COST_CATEGORIES): string | null {
  if (!input || typeof input !== 'object') return 'Nothing to save.';
  if (typeof input.farmLocation !== 'string' || !input.farmLocation.trim()) return 'Choose which farm paid it.';
  if (typeof input.category !== 'string' || !categories.includes(input.category)) return 'Choose what the cost was for.';
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) return 'Type how much was paid.';
  if (input.amount > MAX_COST_AMOUNT) return 'That amount is too big. Check the number.';
  if (!isDay(input.date)) return 'Choose the date it was paid.';
  if (input.date > today) return 'The date cannot be in the future.';
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > MAX_NOTE)) return `Keep the note under ${MAX_NOTE} letters.`;
  return null;
}

// ─── Farm profit by month ────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(d?: string | null): string | null {
  const m = d ? /^(\d{4})-(\d{2})/.exec(d) : null;
  return m ? `${m[1]}-${m[2]}` : null;
}

export interface FarmMonth {
  /** yyyy-mm */
  month: string;
  /** For example "Oct 2026". */
  label: string;
  sales: number;
  soldCount: number;
  /** What the animals sold this month cost to buy. */
  cattleCost: number;
  medicine: number;
  /** Feed eaten by the animals sold this month, plus feed not put on any animal that left the store this month. */
  feed: number;
  /** Running costs: wages, power and water, ... */
  other: number;
  /** sales − cattleCost − medicine − feed − other */
  profit: number;
}

export interface FarmProfitInput {
  stock: StockItem[];
  sales: SalesRecord[];
  healthLogs: Pick<HealthLogItem, 'cowId' | 'cost' | 'date'>[];
  feedTransactions: FeedStockTransaction[];
  batches: Pick<BatchItem, 'id' | 'farmLocation' | 'cowIds'>[];
  costs: Pick<FarmCostItem, 'farmLocation' | 'amount' | 'date'>[];
  /** Only this farm; all farms when empty. */
  farm?: string;
}

/**
 * The farm a feed movement was eaten (or lost) on: the farm it left, or for
 * the old automatic entries, which were written without one, the batch's farm.
 */
export function feedFarm(t: Pick<FeedStockTransaction, 'sourceFarm' | 'referenceNo'>, batchFarm: Map<string, string | undefined>): string | undefined {
  if (t.sourceFarm && t.sourceFarm !== 'Supplier') return t.sourceFarm;
  const ref = parseFeedRef(t.referenceNo);
  return ref ? batchFarm.get(ref.batchId) : undefined;
}

export interface FeedShares {
  /** Feed cost eaten by each animal. */
  byCow: Map<string, number>;
  /** Feed that could not be put on any animal, with the farm and day it left the store. */
  unassigned: { farm?: string; day: string; cost: number }[];
}

/**
 * Splits each batch's daily feed evenly over the animals in the batch that
 * day: bought on or before it, and not sold before it. Membership is the
 * batch's animals today (sold animals stay listed); an animal moved between
 * batches counts only in the batch it is in now.
 */
export function feedShares(
  feedTransactions: FeedStockTransaction[],
  batches: Pick<BatchItem, 'id' | 'farmLocation' | 'cowIds'>[],
  stock: Pick<StockItem, 'id' | 'purchaseDate'>[],
  sales: Pick<SalesRecord, 'cowId' | 'salesDate'>[]
): FeedShares {
  const batchById = new Map(batches.map(b => [b.id, b]));
  const batchFarm = new Map(batches.map(b => [b.id, b.farmLocation]));
  const boughtOn = new Map(stock.map(c => [c.id, dayOf(c.purchaseDate ?? undefined)]));
  const soldOn = new Map(sales.map(s => [s.cowId, dayOf(s.salesDate ?? undefined)]));
  const byCow = new Map<string, number>();
  const unassigned: FeedShares['unassigned'] = [];

  for (const t of feedTransactions) {
    if (t.type !== 'STOCK_OUT' || !(t.totalCost > 0)) continue;
    const ref = parseFeedRef(t.referenceNo);
    const day = ref?.day ?? dayOf(t.date);
    const batch = ref ? batchById.get(ref.batchId) : undefined;
    const eaters = (batch?.cowIds ?? []).filter(id => {
      if (!boughtOn.has(id)) return false;
      const bought = boughtOn.get(id);
      const sold = soldOn.get(id);
      return (!bought || bought <= day) && (!sold || sold > day);
    });
    if (eaters.length === 0) {
      unassigned.push({ farm: feedFarm(t, batchFarm), day, cost: t.totalCost });
      continue;
    }
    const share = t.totalCost / eaters.length;
    for (const id of eaters) byCow.set(id, (byCow.get(id) ?? 0) + share);
  }
  return { byCow, unassigned };
}

export interface FarmProfit {
  /** Oldest first, only months with something in them. */
  months: FarmMonth[];
  /** Feed already eaten by cattle not sold yet; it becomes a cost when they are sold. */
  feedInHerd: number;
}

export function farmProfit(i: FarmProfitInput): FarmProfit {
  const inFarm = i.farm ? farmMatcher(i.farm) : () => true;
  const rows = new Map<string, FarmMonth>();
  const row = (key: string): FarmMonth => {
    let r = rows.get(key);
    if (!r) {
      r = { month: key, label: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, sales: 0, soldCount: 0, cattleCost: 0, medicine: 0, feed: 0, other: 0, profit: 0 };
      rows.set(key, r);
    }
    return r;
  };

  const { byCow, unassigned } = feedShares(i.feedTransactions, i.batches, i.stock, i.sales);
  const cowById = new Map(i.stock.map(c => [c.id, c]));
  const sold = new Set<string>();
  for (const s of i.sales) {
    const k = monthKey(s.salesDate);
    const cow = cowById.get(s.cowId);
    if (!k || !inFarm(cow?.location)) continue;
    sold.add(s.cowId);
    const r = row(k);
    r.sales += s.totalPrice || 0;
    r.soldCount += 1;
    r.cattleCost += cow?.totalPrice || 0;
    r.feed += Math.round(byCow.get(s.cowId) ?? 0); // rounded per animal, as the Sales page shows it
  }

  let feedInHerd = 0;
  for (const [id, cost] of byCow) {
    if (!sold.has(id) && inFarm(cowById.get(id)?.location)) feedInHerd += cost;
  }

  for (const u of unassigned) {
    const k = monthKey(u.day);
    if (k && inFarm(u.farm)) row(k).feed += u.cost;
  }

  for (const l of i.healthLogs) {
    const k = monthKey(l.date);
    if (!k || !(l.cost > 0) || !inFarm(cowById.get(l.cowId)?.location)) continue;
    row(k).medicine += l.cost;
  }

  for (const c of i.costs) {
    const k = monthKey(c.date);
    if (!k || !inFarm(c.farmLocation)) continue;
    row(k).other += c.amount || 0;
  }

  for (const r of rows.values()) {
    r.feed = Math.round(r.feed);
    r.profit = r.sales - r.cattleCost - r.medicine - r.feed - r.other;
  }
  return { months: [...rows.values()].sort((a, b) => a.month.localeCompare(b.month)), feedInHerd: Math.round(feedInHerd) };
}

/** All the months added up. */
export function sumMonths(months: FarmMonth[]): Omit<FarmMonth, 'month' | 'label'> {
  const t = { sales: 0, soldCount: 0, cattleCost: 0, medicine: 0, feed: 0, other: 0, profit: 0 };
  for (const m of months) {
    t.sales += m.sales; t.soldCount += m.soldCount; t.cattleCost += m.cattleCost;
    t.medicine += m.medicine; t.feed += m.feed; t.other += m.other; t.profit += m.profit;
  }
  return t;
}
