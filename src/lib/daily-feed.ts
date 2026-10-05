import type { BatchItem, FeedProductItem, FeedStockTransaction, HealthLogItem } from './types';
import type { StockItem } from './xlsx-parser';
import { activeCattleIds, activeHeadcount, matchIngredientProduct } from './feed-math';

/**
 * Daily feed records: what each batch was actually fed on a day, written down
 * by the farm (or by the office for them). Kept pure so the screens and the
 * server share one set of rules.
 *
 * Feed only leaves stock when someone records the day: a STOCK_OUT per batch,
 * day and feed with reference `DAILY-<batch>-<day>-<product>`. Nothing is
 * automatic. Days nobody recorded are flagged (`missedFeedDays`) so the farm
 * or the office fills them in. Rows named `AUTO-RATION-...` were written by
 * the automatic job that ran until 2026-10-05; they stay as history, shown as
 * "Automatic (old)", and recording such a day replaces them.
 */

/** The farms are in Cambodia: a "day" is a Phnom Penh calendar day, whatever the server's clock says. */
export const FARM_TIME_ZONE = 'Asia/Phnom_Penh';

/** Today's date at the farms, as YYYY-MM-DD. */
export function farmToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FARM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** A YYYY-MM-DD day moved by n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** The day a stored movement belongs to (dates are stored as midnight UTC of that day). */
export const dayOf = (date?: string): string => (date ?? '').slice(0, 10);

// ─── Units ───────────────────────────────────────────────────────────────────

/** How a feed is counted: 'kg' for loose feed such as grass, otherwise a pack (bag, bale, ...). */
export function feedUnit(p?: Pick<FeedProductItem, 'unit'> | null): string {
  const u = (p?.unit || 'bag').trim().toLowerCase();
  return u === 'kilogram' || u === 'kgs' ? 'kg' : u;
}

/** Kg in one unit: 1 for feed counted in kg, the pack size otherwise. */
export function kgPerUnit(p?: Pick<FeedProductItem, 'unit' | 'weightPerUnit'> | null): number {
  return feedUnit(p) === 'kg' ? 1 : p?.weightPerUnit || 30;
}

/** "bag"/"bags", "bale"/"bales", "kg". */
export function unitWord(unit: string, n: number): string {
  if (unit === 'kg') return 'kg';
  return Math.abs(n) === 1 ? unit : `${unit}s`;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** "6 bags", "450 kg". */
export function amountText(p: Pick<FeedProductItem, 'unit'> | null | undefined, units: number): string {
  const unit = feedUnit(p);
  return `${round1(units).toLocaleString()} ${unitWord(unit, round1(units))}`;
}

// ─── References ──────────────────────────────────────────────────────────────

export const dailyRefPrefix = (batchId: string, day: string) => `DAILY-${batchId}-${day}-`;
export const autoRefPrefix = (batchId: string, day: string) => `AUTO-RATION-${batchId}-${day}-`;
export const dailyRef = (batchId: string, day: string, productId: string) => `${dailyRefPrefix(batchId, day)}${productId}`;

/** Which batch and day a daily record or estimate belongs to; null for any other movement. */
export function parseFeedRef(ref?: string): { kind: 'recorded' | 'estimated'; batchId: string; day: string } | null {
  const m = /^(DAILY|AUTO-RATION)-(.+)-(\d{4}-\d{2}-\d{2})-(.*)$/.exec(ref ?? '');
  if (!m) return null;
  return { kind: m[1] === 'DAILY' ? 'recorded' : 'estimated', batchId: m[2], day: m[3] };
}

// ─── The plan for a farm ─────────────────────────────────────────────────────

export interface RationItem {
  /** The name in the batch's feeding plan. */
  name: string;
  /** The feed it is taken from; missing when the plan's feed is not in the feed list. */
  product?: FeedProductItem;
  /** Planned amount for the whole batch per day, in the feed's unit (bags, kg, ...). */
  planUnits: number;
  kgPerHead: number;
}

export interface BatchRation {
  batch: BatchItem;
  head: number;
  bulls: number;
  cows: number;
  items: RationItem[];
}

/** Active batches on a farm whose feeding is on, with their planned daily amounts. */
export function farmRations(farm: string, batches: BatchItem[], stock: StockItem[], products: FeedProductItem[]): BatchRation[] {
  const activeIds = activeCattleIds(stock);
  const byId = new Map(stock.map(c => [c.id, c]));
  return batches
    .filter(b => b.status === 'Active' && b.farmLocation === farm && b.feedingProgram?.status === 'Active' && (b.feedingProgram.ingredients || []).length > 0)
    .map(batch => {
      const head = activeHeadcount(batch, activeIds);
      const live = (batch.cowIds || []).filter(id => activeIds.has(id)).map(id => byId.get(id));
      const bulls = live.filter(c => /^m/i.test(c?.sex ?? '')).length;
      const cows = live.filter(c => /^f/i.test(c?.sex ?? '')).length;
      const items = (batch.feedingProgram!.ingredients || []).map(ing => {
        const product = matchIngredientProduct(ing, products);
        const kgPerHead = ing.portionPerHead || 0;
        return { name: ing.name, product, kgPerHead, planUnits: round1((kgPerHead * head) / kgPerUnit(product)) };
      });
      return { batch, head, bulls, cows, items };
    })
    .sort((a, b) => a.batch.name.localeCompare(b.batch.name));
}

export interface FarmHeadCount {
  /** Cattle the app has on the farm now (status Active). */
  onFarm: number;
  bulls: number;
  cows: number;
  /** Of those, how many are in a batch being fed (and so in the daily feed record). */
  inFedBatches: number;
}

/**
 * The app's head count for a farm, to compare with the farm's own count. A
 * difference means the cattle list is out of date (a sale, death or move not
 * entered) or some animals are in no batch being fed.
 */
export function farmHeadCount(farm: string, batches: BatchItem[], stock: StockItem[]): FarmHeadCount {
  const here = stock.filter(c => c.location === farm && c.status.toLowerCase() === 'active');
  const ids = new Set(here.map(c => c.id));
  const fed = new Set(batches
    .filter(b => b.status === 'Active' && b.farmLocation === farm && b.feedingProgram?.status === 'Active')
    .flatMap(b => (b.cowIds || []).filter(id => ids.has(id))));
  return {
    onFarm: here.length,
    bulls: here.filter(c => /^m/i.test(c.sex ?? '')).length,
    cows: here.filter(c => /^f/i.test(c.sex ?? '')).length,
    inFedBatches: fed.size,
  };
}

/** Farms that have something to record: an active batch with feeding on. */
export function farmsToRecord(batches: BatchItem[]): string[] {
  return [...new Set(batches
    .filter(b => b.status === 'Active' && b.farmLocation && b.feedingProgram?.status === 'Active' && (b.feedingProgram.ingredients || []).length > 0)
    .map(b => b.farmLocation as string))].sort();
}

/** Units already recorded for a batch, day and feed; null when that day was not recorded. */
export function recordedUnits(transactions: FeedStockTransaction[], batchId: string, day: string, productId: string): number | null {
  const ref = dailyRef(batchId, day, productId);
  const rows = transactions.filter(t => t.referenceNo === ref);
  return rows.length ? rows.reduce((s, t) => s + (t.quantityBags || 0), 0) : null;
}

export type FeedDayStatus = 'recorded' | 'partly' | 'estimated' | 'missing';

/** Whether a farm's day was written down, has only an old automatic entry, or has nothing. */
export function feedDayStatus(transactions: FeedStockTransaction[], batchIds: string[], day: string): FeedDayStatus {
  const recorded = new Set<string>();
  let estimated = false;
  for (const t of transactions) {
    const ref = parseFeedRef(t.referenceNo);
    if (!ref || ref.day !== day || !batchIds.includes(ref.batchId)) continue;
    if (ref.kind === 'recorded') recorded.add(ref.batchId);
    else estimated = true;
  }
  if (batchIds.length > 0 && recorded.size === batchIds.length) return 'recorded';
  if (recorded.size > 0) return 'partly';
  return estimated ? 'estimated' : 'missing';
}

/** How many past days the alerts look back over. */
export const MISSED_DAYS_LOOKBACK = 7;

/**
 * Past days (yesterday and the days before, up to `lookback`) on which a farm
 * fed cattle but nobody wrote down all of its batches. Only days on or after
 * the earliest start of its fed batches count. Oldest first. Days that only
 * have an old automatic entry already took stock, so they are not flagged.
 */
export function missedFeedDays(
  farm: string,
  batches: BatchItem[],
  stock: StockItem[],
  products: FeedProductItem[],
  transactions: FeedStockTransaction[],
  today: string,
  lookback: number = MISSED_DAYS_LOOKBACK
): string[] {
  const rations = farmRations(farm, batches, stock, products).filter(r => r.items.some(i => i.product));
  if (rations.length === 0) return [];
  const batchIds = rations.map(r => r.batch.id);
  const starts = rations.map(r => (r.batch.startDate || '').slice(0, 10)).filter(isDay).sort();
  const from = starts[0] && starts[0] > addDays(today, -lookback) ? starts[0] : addDays(today, -lookback);
  const missed: string[] = [];
  for (let day = from; day < today; day = addDays(day, 1)) {
    const status = feedDayStatus(transactions, batchIds, day);
    if (status === 'missing' || status === 'partly') missed.push(day);
  }
  return missed;
}

/** Fed batches whose plan has a feed that is not in the feed list: it cannot be recorded until it is chosen. */
export function unlinkedRationFeeds(batches: BatchItem[], products: FeedProductItem[], onlyFarm?: string): { batch: BatchItem; names: string[] }[] {
  return batches
    .filter(b => b.status === 'Active' && b.feedingProgram?.status === 'Active' && (!onlyFarm || b.farmLocation === onlyFarm))
    .map(batch => ({ batch, names: (batch.feedingProgram!.ingredients || []).filter(i => !matchIngredientProduct(i, products)).map(i => i.name) }))
    .filter(x => x.names.length > 0);
}

/** Whether a farm still has to write down today's feed. */
export function todayNotRecorded(farm: string, batches: BatchItem[], stock: StockItem[], products: FeedProductItem[], transactions: FeedStockTransaction[], today: string): boolean {
  const batchIds = farmRations(farm, batches, stock, products).filter(r => r.items.some(i => i.product)).map(r => r.batch.id);
  return batchIds.length > 0 && feedDayStatus(transactions, batchIds, today) !== 'recorded';
}

// ─── Saving a day ────────────────────────────────────────────────────────────

export interface DailyFeedInput {
  farm: string;
  day: string;
  batches: { batchId: string; items: { productId: string; units: number }[] }[];
}

/** Why a day's record cannot be saved, or null. `today` is the farm's today. */
export function dailyFeedProblem(input: DailyFeedInput, today: string): string | null {
  if (!input.farm?.trim()) return 'Choose the farm.';
  if (!isDay(input.day)) return 'Choose the day.';
  if (input.day > today) return 'You cannot record a day that has not happened yet.';
  if (input.day < addDays(today, -60)) return 'You can only record the last 60 days.';
  if (!input.batches?.some(b => b.items?.length)) return 'There is no feed to record on this farm. Check the batches\' feeding plans.';
  for (const b of input.batches) {
    for (const i of b.items) {
      if (!(Number.isFinite(i.units) && i.units >= 0)) return 'Amounts must be 0 or more.';
      if (i.units > 100000) return 'One of the amounts is far too large. Check it.';
    }
  }
  return null;
}

// ─── Daily report ────────────────────────────────────────────────────────────

export interface DailyFeedReportItem { productId: string; productName: string; unit: string; units: number; kg: number; cost: number }

export interface DailyFeedReportRow {
  day: string;
  farm: string;
  status: FeedDayStatus;
  /** Who wrote the day down (several names when batches were recorded by different people). */
  recordedBy: string;
  /** Cattle in the farm's fed batches now (the app keeps no head count per past day). */
  head: number;
  bulls: number;
  cows: number;
  items: DailyFeedReportItem[];
  kg: number;
  cost: number;
  /** Treatments logged that day for cattle on the farm. */
  treatments: number;
  /** All cattle on the farm now, in or out of a fed batch. */
  onFarm: number;
}

/**
 * One row per farm per day, newest first: what was fed (recorded or
 * estimated), what it cost, and whether the farm wrote the day down.
 */
export function dailyFeedReport(
  data: { batches: BatchItem[]; stock: StockItem[]; feedProducts?: FeedProductItem[]; feedTransactions?: FeedStockTransaction[]; healthLogs?: HealthLogItem[] },
  from: string,
  to: string,
  onlyFarm?: string
): DailyFeedReportRow[] {
  const products = data.feedProducts || [];
  const productById = new Map(products.map(p => [p.id, p]));
  const transactions = data.feedTransactions || [];
  const farms = onlyFarm ? [onlyFarm] : farmsToRecord(data.batches);
  const rows: DailyFeedReportRow[] = [];
  const cowFarm = new Map(data.stock.map(c => [c.id, c.location]));

  for (const farm of farms) {
    const rations = farmRations(farm, data.batches, data.stock, products);
    const batchIds = rations.map(r => r.batch.id);
    const head = rations.reduce((s, r) => s + r.head, 0);
    const bulls = rations.reduce((s, r) => s + r.bulls, 0);
    const cows = rations.reduce((s, r) => s + r.cows, 0);
    const { onFarm } = farmHeadCount(farm, data.batches, data.stock);
    for (let day = to; day >= from; day = addDays(day, -1)) {
      const status = feedDayStatus(transactions, batchIds, day);
      const items = new Map<string, DailyFeedReportItem>();
      const people = new Set<string>();
      for (const t of transactions) {
        const ref = parseFeedRef(t.referenceNo);
        if (!ref || ref.day !== day || !batchIds.includes(ref.batchId)) continue;
        // On a partly recorded day, the recorded batches count their record and the others their estimate.
        if (ref.kind === 'estimated' && transactions.some(x => parseFeedRef(x.referenceNo)?.kind === 'recorded' && x.referenceNo!.startsWith(dailyRefPrefix(ref.batchId, day)))) continue;
        if (ref.kind === 'recorded' && t.recordedBy) people.add(t.recordedBy);
        const p = productById.get(t.productId);
        const it = items.get(t.productId) || { productId: t.productId, productName: p?.name ?? t.productName, unit: feedUnit(p), units: 0, kg: 0, cost: 0 };
        it.units += t.quantityBags || 0;
        it.kg += t.quantityKg || 0;
        it.cost += t.totalCost || 0;
        items.set(t.productId, it);
      }
      const list = [...items.values()].filter(i => i.units > 0 || i.kg > 0).sort((a, b) => a.productName.localeCompare(b.productName));
      const treatments = (data.healthLogs || []).filter(h => dayOf(h.date) === day && cowFarm.get(h.cowId) === farm).length;
      rows.push({
        day, farm, status, recordedBy: [...people].join(', '), head, bulls, cows,
        items: list,
        kg: list.reduce((s, i) => s + i.kg, 0),
        cost: list.reduce((s, i) => s + i.cost, 0),
        treatments,
        onFarm,
      });
    }
  }
  return rows.sort((a, b) => b.day.localeCompare(a.day) || a.farm.localeCompare(b.farm));
}
