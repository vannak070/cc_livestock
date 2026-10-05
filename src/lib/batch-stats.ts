import type { BatchItem, FeedProductItem, FeedingProgramConfig } from './types';
import type { StockItem, WeightRecord } from './xlsx-parser';
import { growth, weighPoints } from './cattle-stats';
import { matchIngredientProduct } from './feed-math';

/**
 * Numbers for the batch (feeding group) screens, kept pure so the screens only
 * display them. A "batch" feeds its cattle that are still on the farm; sold or
 * dead cattle can stay listed on it for history and are never counted.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const t = (m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)).getTime();
  return Number.isNaN(t) ? null : Math.round(t / DAY_MS);
}

const today = (now: Date) => Math.round(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / DAY_MS);

/** The batch's cattle that are still on the farm. */
export function batchCattle(batch: Pick<BatchItem, 'cowIds'>, stock: StockItem[]): StockItem[] {
  const ids = new Set(batch.cowIds || []);
  return stock.filter(c => ids.has(c.id) && c.status.toLowerCase() === 'active');
}

/** Active cattle that are not in any active batch, so free to enrol. */
export function unassignedCattle(stock: StockItem[], batches: Pick<BatchItem, 'status' | 'cowIds'>[]): StockItem[] {
  const taken = new Set(batches.filter(b => b.status === 'Active').flatMap(b => b.cowIds || []));
  return stock.filter(c => c.status.toLowerCase() === 'active' && !taken.has(c.id));
}

export interface Sample { cowId: string; weight: number }

/**
 * Weigh three animals (a good, an average and a poor grower) and estimate the
 * rest: every other animal gets its last weight plus the samples' average gain.
 */
export function estimateFromSamples(cattle: Pick<StockItem, 'id' | 'weight'>[], samples: Sample[]): { avgGain: number; records: { cowId: string; currentWeight: number }[] } {
  const bySample = new Map(samples.map(s => [s.cowId, s.weight]));
  const gains = samples.map(s => s.weight - (cattle.find(c => c.id === s.cowId)?.weight ?? 0));
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  return {
    avgGain,
    records: cattle.map(c => ({
      cowId: c.id,
      currentWeight: bySample.has(c.id) ? bySample.get(c.id)! : Math.round((c.weight + avgGain) * 10) / 10,
    })),
  };
}

/** The catalogue feed an ingredient refers to: by id, then by name either way round. No fallback. */
export function matchFeedProduct(name: string, products: FeedProductItem[], productId?: string): FeedProductItem | null {
  return matchIngredientProduct({ name, productId }, products) ?? null;
}

export interface FeedLine {
  name: string;
  kgPerHead: number;
  /** ៛ per kg: the catalogue price when the feed is in the list, otherwise the price saved with the ingredient. */
  unitCost: number;
  costPerHead: number;
  /** False when the ingredient is not in the feed list, so stock cannot be deducted for it. */
  inCatalogue: boolean;
  /** The feed list entry it is taken from, when there is one. */
  product?: FeedProductItem;
  productId?: string;
}

export function feedLines(program: FeedingProgramConfig | undefined, products: FeedProductItem[]): FeedLine[] {
  return (program?.ingredients ?? []).map(ing => {
    const p = matchFeedProduct(ing.name, products, ing.productId);
    const unitCost = p ? p.unitCost : ing.unitCost || 0;
    const kgPerHead = ing.portionPerHead || 0;
    return { name: ing.name, kgPerHead, unitCost, costPerHead: kgPerHead * unitCost, inCatalogue: !!p, product: p ?? undefined, productId: ing.productId };
  });
}

export interface BatchSummary {
  head: number;
  avgWeight: number;
  /** Average daily gain in kg across animals with two weigh-ins; null until there is one. */
  perDay: number | null;
  /** Days since the batch started; null without a start date. */
  daysIn: number | null;
  /** Days until the planned sell date; negative when it has passed; null if none set. */
  daysToTarget: number | null;
  feedCostPerDay: number;
  feedKgPerDay: number;
}

export function batchSummary(batch: BatchItem, stock: StockItem[], weightTracking: WeightRecord[], products: FeedProductItem[], now: Date = new Date()): BatchSummary {
  const cattle = batchCattle(batch, stock);
  const byCow = new Map<string, WeightRecord[]>();
  for (const r of weightTracking) {
    const list = byCow.get(r.cowId);
    if (list) list.push(r); else byCow.set(r.cowId, [r]);
  }
  const stats = cattle.map(c => growth(c, weighPoints(c.id, byCow.get(c.id) ?? [], c.purchaseDate)));
  const withGain = stats.filter(s => s.perDay !== null);
  const lines = batch.feedingProgram?.status === 'Active' || !batch.feedingProgram?.status ? feedLines(batch.feedingProgram, products) : [];
  const start = dayNumber(batch.startDate);
  const target = dayNumber(batch.sellingTargetDate);
  return {
    head: cattle.length,
    avgWeight: cattle.length ? stats.reduce((s, x) => s + x.currentWeight, 0) / cattle.length : 0,
    perDay: withGain.length ? Math.round((withGain.reduce((s, x) => s + (x.perDay ?? 0), 0) / withGain.length) * 100) / 100 : null,
    daysIn: start === null ? null : Math.max(0, today(now) - start),
    daysToTarget: target === null ? null : target - today(now),
    feedCostPerDay: lines.reduce((s, l) => s + l.costPerHead, 0) * cattle.length,
    feedKgPerDay: lines.reduce((s, l) => s + l.kgPerHead, 0) * cattle.length,
  };
}

export interface BatchWeighIn {
  /** YYYY-MM-DD */
  date: string;
  /** Animals of the batch weighed that day. */
  head: number;
  /** Average weight of those animals, kg. */
  avg: number;
  /** Average now minus the average of the weigh-in before it; null for the first. */
  change: number | null;
  /** That change spread over the days between the two weigh-ins; null for the first. */
  perDay: number | null;
}

/**
 * The batch's weigh-ins, newest first: every day on which any of its animals
 * (including ones since sold, so history stays) was weighed, with the average
 * and how it moved since the weigh-in before.
 */
export function batchWeighIns(batch: Pick<BatchItem, 'cowIds'>, weightTracking: WeightRecord[]): BatchWeighIn[] {
  const ids = new Set(batch.cowIds || []);
  const byDay = new Map<string, Map<string, number>>();
  for (const r of weightTracking) {
    const date = (r.trackingDate ?? '').slice(0, 10);
    if (!ids.has(r.cowId) || !date || !(r.currentWeight > 0)) continue;
    const cows = byDay.get(date) ?? new Map<string, number>();
    cows.set(r.cowId, r.currentWeight); // an animal weighed twice that day counts once
    byDay.set(date, cows);
  }
  const days = [...byDay.keys()].sort();
  const rows = days.map((date, i) => {
    const weights = [...byDay.get(date)!.values()];
    const avg = weights.reduce((s, w) => s + w, 0) / weights.length;
    return { date, head: weights.length, avg: Math.round(avg * 10) / 10, i };
  });
  return rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const gap = prev ? (dayNumber(r.date)! - dayNumber(prev.date)!) : 0;
    return {
      date: r.date,
      head: r.head,
      avg: r.avg,
      change: prev ? Math.round((r.avg - prev.avg) * 10) / 10 : null,
      perDay: prev && gap > 0 ? Math.round(((r.avg - prev.avg) / gap) * 100) / 100 : null,
    };
  }).reverse();
}

