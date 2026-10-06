import type { BatchItem, FeedProductItem } from './types';
import type { StockItem, WeightRecord } from './xlsx-parser';
import { SELL_WARNING_DAYS } from './attention';
import { batchSummary } from './batch-stats';

/**
 * Management's view of batches coming up for sale: which are due within the
 * review window (or already late), how they are doing, and what was decided.
 * Pure: the screens only display these numbers.
 */

export const SALE_REVIEW_DAYS = SELL_WARNING_DAYS;
/** From this many days out, a batch is "this week" rather than a heads-up. */
export const SALE_WEEK_DAYS = 7;
/** The length of the standard cycle the app uses when nobody sets a selling date. */
export const STANDARD_CYCLE_DAYS = 90;

/** The smallest and largest warning an admin can choose. */
export const SALE_REVIEW_MIN_DAYS = 1;
export const SALE_REVIEW_MAX_DAYS = 60;

/** The review window from settings: a whole number of days, 15 when unset or out of range. */
export function saleWindowDays(settings: { saleReviewDays?: number } | null | undefined): number {
  const n = settings?.saleReviewDays;
  return Number.isInteger(n) && (n as number) >= SALE_REVIEW_MIN_DAYS && (n as number) <= SALE_REVIEW_MAX_DAYS ? (n as number) : SALE_REVIEW_DAYS;
}

/** Why a chosen window cannot be saved, or null. */
export function saleWindowProblem(value: unknown): string | null {
  return Number.isInteger(value) && (value as number) >= SALE_REVIEW_MIN_DAYS && (value as number) <= SALE_REVIEW_MAX_DAYS
    ? null
    : `Choose a whole number of days from ${SALE_REVIEW_MIN_DAYS} to ${SALE_REVIEW_MAX_DAYS}.`;
}

export type SaleTier = 'overdue' | 'week' | 'soon';

export function saleTier(daysRemaining: number): SaleTier {
  if (daysRemaining < 0) return 'overdue';
  return daysRemaining <= SALE_WEEK_DAYS ? 'week' : 'soon';
}

export interface SaleReviewRow {
  batch: BatchItem;
  farm: string;
  /** Negative when the selling date has passed. */
  daysRemaining: number;
  tier: SaleTier;
  /** Management already decided to sell it. */
  decided: boolean;
  head: number;
  avgWeight: number;
  perDay: number | null;
  males: number;
  females: number;
  /** Lowest and highest current weight, kg; null with no cattle. */
  minWeight: number | null;
  maxWeight: number | null;
  /** The batch's expected selling price, ៛ per kg; null when not set. */
  pricePerKg: number | null;
  /** Average weight x head x the batch's expected price per kg; null when no price is set. */
  expectedValue: number | null;
  /** The date is the app's standard 90 days from the start, so nobody may have chosen it. */
  standardDate: boolean;
}

/** YYYY-MM-DD plus whole days, as a calendar day. */
export function addDaysToDay(day: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)).toISOString().slice(0, 10);
}

/** Active batches due within `window` days or already late. Batches still to decide come first, soonest first; decided ones follow. */
export function saleReviewRows(
  batches: BatchItem[],
  stock: StockItem[],
  weightTracking: WeightRecord[],
  products: FeedProductItem[],
  now: Date = new Date(),
  window: number = SALE_REVIEW_DAYS
): SaleReviewRow[] {
  const rows: SaleReviewRow[] = [];
  for (const batch of batches) {
    if (batch.status !== 'Active' || !batch.sellingTargetDate) continue;
    const s = batchSummary(batch, stock, weightTracking, products, now);
    if (s.daysToTarget === null || s.daysToTarget > window) continue;
    const price = batch.expectedSellingPrice ?? 0;
    rows.push({
      batch,
      farm: batch.farmLocation ?? '',
      daysRemaining: s.daysToTarget,
      tier: saleTier(s.daysToTarget),
      decided: batch.saleReview?.decision === 'ready',
      head: s.head,
      avgWeight: Math.round(s.avgWeight * 10) / 10,
      perDay: s.perDay,
      males: s.males,
      females: s.females,
      minWeight: s.minWeight === null ? null : Math.round(s.minWeight * 10) / 10,
      maxWeight: s.maxWeight === null ? null : Math.round(s.maxWeight * 10) / 10,
      pricePerKg: price > 0 ? price : null,
      expectedValue: price > 0 && s.head > 0 ? Math.round(s.avgWeight * s.head * price) : null,
      standardDate: batch.sellingTargetDate.slice(0, 10) === addDaysToDay((batch.startDate ?? '').slice(0, 10), STANDARD_CYCLE_DAYS),
    });
  }
  return rows.sort((a, b) => Number(a.decided) - Number(b.decided) || a.daysRemaining - b.daysRemaining || a.batch.name.localeCompare(b.batch.name));
}

export interface SaleReviewCounts { overdue: number; week: number; soon: number; decided: number; toReview: number }

/** How many batches sit in each stage; `toReview` is everything not yet decided. */
export function saleReviewCounts(rows: SaleReviewRow[]): SaleReviewCounts {
  const open = rows.filter(r => !r.decided);
  return {
    overdue: open.filter(r => r.tier === 'overdue').length,
    week: open.filter(r => r.tier === 'week').length,
    soon: open.filter(r => r.tier === 'soon').length,
    decided: rows.length - open.length,
    toReview: open.length,
  };
}

export interface SaleReviewInput { decision: 'ready' | 'extend'; note?: string; newTargetDate?: string }

/** Why a review cannot be saved, or null. `today` is the farm's today (YYYY-MM-DD). */
export function saleReviewProblem(input: SaleReviewInput, today: string): string | null {
  if (input.decision !== 'ready' && input.decision !== 'extend') return 'Choose to sell the batch or keep feeding it.';
  if (input.decision === 'extend') {
    if (!input.newTargetDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.newTargetDate) || Number.isNaN(Date.parse(`${input.newTargetDate}T00:00:00Z`))) return 'Choose the new selling date.';
    if (input.newTargetDate <= today) return 'The new selling date must be after today.';
    if (input.newTargetDate > addDaysToDay(today, 365)) return 'The new selling date is more than a year away. Check it.';
  }
  if ((input.note ?? '').length > 500) return 'The note is too long (500 letters at most).';
  return null;
}
