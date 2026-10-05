import type { ERPLivestockData, FeedProductItem, FeedStockTransaction } from './types';
import { activeCattleIds, activeHeadcount, matchIngredientProduct } from './feed-math';

/**
 * "Needs attention" rules, in one place so the Today screen and the pages
 * behind it always agree. All functions are pure: data in, answers out.
 */

export const WEIGH_INTERVAL_DAYS = 14;
export const DUE_SOON_MARGIN_DAYS = 2;
export const SELL_WARNING_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const SICK_STATUSES = ['poor', 'sick', 'critical', 'quarantine'];

/**
 * A date-only value such as "2026-10-10" is a calendar day on the farm, not
 * midnight UTC (which in Cambodia, UTC+7, would shift every count by a day).
 */
function parseLocalDay(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : startOfDay(new Date(value));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type Stock = ERPLivestockData['stock'];

export function activeCattle(stock: Stock): Stock {
  return stock.filter(c => c.status.toLowerCase() === 'active');
}

/** Active cattle whose health status says they are unwell. */
export function sickCattle(stock: Stock): Stock {
  return activeCattle(stock).filter(c => SICK_STATUSES.includes(c.healthStatus?.toLowerCase() || ''));
}

/** Active cattle with a disease or "sick" note in their health history. */
export function cattleWithDiseaseHistory(data: Pick<ERPLivestockData, 'stock' | 'healthLogs'>): Stock {
  return activeCattle(data.stock).filter(c =>
    data.healthLogs.some(l => l.cowId === c.id && (l.type === 'Disease' || l.notes?.toLowerCase().includes('sick')))
  );
}

export type WeighStatus = 'weighed' | 'duesoon' | 'overdue';

export interface WeighSchedule {
  cowId: string;
  lastWeighDate: Date | null;
  /** 999 when the animal has never been weighed. */
  daysElapsed: number;
  status: WeighStatus;
}

/** Weigh-in status of every active animal, most overdue first. */
export function weighSchedules(
  data: Pick<ERPLivestockData, 'stock' | 'weightTracking'>,
  intervalDays = WEIGH_INTERVAL_DAYS,
  now: Date = new Date()
): WeighSchedule[] {
  const lastByCow = new Map<string, number>();
  for (const w of data.weightTracking) {
    if (!w.trackingDate) continue;
    const t = new Date(w.trackingDate).getTime();
    if (!Number.isNaN(t) && t > (lastByCow.get(w.cowId) ?? -Infinity)) lastByCow.set(w.cowId, t);
  }
  return activeCattle(data.stock).map(cow => {
    const last = lastByCow.get(cow.id);
    const daysElapsed = last === undefined ? 999 : Math.floor(Math.abs(now.getTime() - last) / DAY_MS);
    const status: WeighStatus =
      daysElapsed < intervalDays - DUE_SOON_MARGIN_DAYS ? 'weighed'
        : daysElapsed <= intervalDays ? 'duesoon'
          : 'overdue';
    return { cowId: cow.id, lastWeighDate: last === undefined ? null : new Date(last), daysElapsed, status };
  }).sort((a, b) => b.daysElapsed - a.daysElapsed);
}

export interface SellingSoon {
  batchId: string;
  batchName: string;
  /** Negative when the target date has passed. */
  daysRemaining: number;
}

/** Active batches whose target selling date is within `withinDays` (or already passed). A batch management already decided to sell is no longer an alert. */
export function batchesNearSelling(
  data: Pick<ERPLivestockData, 'batches'>,
  withinDays = SELL_WARNING_DAYS,
  now: Date = new Date()
): SellingSoon[] {
  const today = startOfDay(now).getTime();
  return data.batches
    .filter(b => b.status === 'Active' && !!b.sellingTargetDate && b.saleReview?.decision !== 'ready')
    .map(b => ({
      batchId: b.id,
      batchName: b.name,
      daysRemaining: Math.round((parseLocalDay(b.sellingTargetDate as string).getTime() - today) / DAY_MS)
    }))
    .filter(b => b.daysRemaining <= withinDays)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export interface FeedStockLevel {
  productId: string;
  productName: string;
  bags: number;
  kg: number;
  thresholdBags: number;
  thresholdKg: number;
  isLow: boolean;
  /** Ration use per day from active feeding programs, counting only active cattle. */
  dailyUseKg: number;
  /** Whole days of stock left at that rate; null when nothing is being used or the feed is not kept as stock. */
  daysLeft: number | null;
  /** False for feed grown on the farm: only its use counts, never "running low". */
  tracked: boolean;
}

/**
 * Stock on hand per feed product across all farms (stock in minus stock out),
 * with the same low-stock thresholds the Feed page uses (50 bags / 1,500 kg
 * by default) and an estimate of days left at the current ration rate.
 */
export function feedStockLevels(
  data: Pick<ERPLivestockData, 'stock' | 'batches'> & { feedProducts?: FeedProductItem[]; feedTransactions?: FeedStockTransaction[] }
): FeedStockLevel[] {
  const products = data.feedProducts || [];
  const totals = new Map<string, { bags: number; kg: number }>();
  for (const tx of data.feedTransactions || []) {
    const prod = products.find(p => p.id === tx.productId);
    const perUnit = prod?.weightPerUnit || 30;
    const sign = tx.type === 'STOCK_IN' ? 1 : tx.type === 'STOCK_OUT' ? -1 : 0;
    if (!sign) continue;
    const t = totals.get(tx.productId) || { bags: 0, kg: 0 };
    t.bags += sign * (tx.quantityBags || 0);
    t.kg += sign * (tx.quantityKg || (tx.quantityBags || 0) * perUnit);
    totals.set(tx.productId, t);
  }

  const activeIds = activeCattleIds(data.stock);
  const dailyUse = new Map<string, number>();
  for (const b of data.batches) {
    if (b.status !== 'Active' || b.feedingProgram?.status !== 'Active') continue;
    const head = activeHeadcount(b, activeIds);
    for (const ing of b.feedingProgram.ingredients || []) {
      const prod = matchIngredientProduct(ing, products);
      if (!prod || !(ing.portionPerHead > 0)) continue;
      dailyUse.set(prod.id, (dailyUse.get(prod.id) || 0) + ing.portionPerHead * head);
    }
  }

  return products.map(p => {
    const t = totals.get(p.id) || { bags: 0, kg: 0 };
    const bags = Math.max(0, t.bags);
    const kg = Math.max(0, t.kg);
    const thresholdBags = p.minThresholdBags || 50;
    const thresholdKg = p.minThresholdKg || thresholdBags * (p.weightPerUnit || 30);
    const dailyUseKg = dailyUse.get(p.id) || 0;
    const tracked = p.trackStock !== false;
    return {
      productId: p.id,
      productName: p.name,
      bags,
      kg,
      thresholdBags,
      thresholdKg,
      isLow: tracked && (bags <= thresholdBags || kg <= thresholdKg),
      dailyUseKg,
      daysLeft: tracked && dailyUseKg > 0 ? Math.floor(kg / dailyUseKg) : null,
      tracked
    };
  });
}

/** Total head the active feeding programs are feeding (active cattle only). */
export function cattleOnFeed(data: Pick<ERPLivestockData, 'stock' | 'batches'>): number {
  const activeIds = activeCattleIds(data.stock);
  return data.batches
    .filter(b => b.status === 'Active')
    .reduce((sum, b) => sum + activeHeadcount(b, activeIds), 0);
}
