import type { StockItem, WeightRecord, SalesRecord } from './xlsx-parser';
import type { HealthLogItem } from './types';

/**
 * Per-animal numbers for the cattle page, kept pure so the screen only
 * displays them. Dates are calendar days on the farm, not UTC instants.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : Math.round(t / DAY_MS);
}

export interface WeighPoint {
  /** yyyy-mm-dd */
  date: string;
  weight: number;
  /** Change since the weigh-in before this one; null for the first. */
  change: number | null;
}

/**
 * Weigh-ins for one animal, oldest first. Several on one day keep the last.
 * Registering an animal does not write a weigh-in, but its first weigh-in keeps
 * the weight it had before (`oldWeight`); when an arrival date is given, that
 * becomes the starting point, so one weigh-in already shows growth since arrival.
 */
export function weighPoints(cowId: string, records: WeightRecord[], arrival?: string | null): WeighPoint[] {
  const byDay = new Map<string, number>();
  let firstDay = '';
  let firstOld = 0;
  for (const r of records) {
    if (r.cowId !== cowId || !r.trackingDate || !(r.currentWeight > 0)) continue;
    const d = r.trackingDate.slice(0, 10);
    byDay.set(d, r.currentWeight);
    if (!firstDay || d < firstDay) { firstDay = d; firstOld = r.oldWeight > 0 ? r.oldWeight : 0; }
  }
  const arrivalDay = arrival ? arrival.slice(0, 10) : '';
  if (firstOld > 0 && arrivalDay && arrivalDay < firstDay && !byDay.has(arrivalDay)) byDay.set(arrivalDay, firstOld);
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  return days.map(([date, weight], i) => ({
    date,
    weight,
    change: i === 0 ? null : Math.round((weight - days[i - 1][1]) * 10) / 10,
  }));
}

export interface Growth {
  startWeight: number;
  currentWeight: number;
  gain: number;
  /** Days between the first and the latest point. */
  days: number;
  /** Average daily gain in kg, null until there are two separate dates. */
  perDay: number | null;
}

export function growth(cow: Pick<StockItem, 'weight'>, points: WeighPoint[]): Growth {
  const first = points[0];
  const last = points[points.length - 1];
  const startWeight = first?.weight ?? cow.weight ?? 0;
  const currentWeight = last?.weight ?? cow.weight ?? 0;
  const gain = Math.round((currentWeight - startWeight) * 10) / 10;
  const from = dayNumber(first?.date);
  const to = dayNumber(last?.date);
  const days = from !== null && to !== null ? Math.max(0, to - from) : 0;
  return { startWeight, currentWeight, gain, days, perDay: days > 0 && points.length > 1 ? Math.round((gain / days) * 100) / 100 : null };
}

/** Whole days on the farm: arrival to the sale date if sold, otherwise to `now`. */
export function daysOnFarm(cow: Pick<StockItem, 'purchaseDate' | 'status'>, sale: Pick<SalesRecord, 'salesDate'> | undefined, now: Date = new Date()): number | null {
  const from = dayNumber(cow.purchaseDate);
  if (from === null) return null;
  const to = cow.status.toLowerCase() === 'sold' && sale ? dayNumber(sale.salesDate) : Math.round(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / DAY_MS);
  return to === null ? null : Math.max(0, to - from);
}

export interface Money {
  cost: number;
  medical: number;
  /** cost + medical */
  invested: number;
  revenue: number | null;
  /** Only known once the animal is sold (or lost); null while it is still on the farm. */
  result: number | null;
}

export function money(cow: Pick<StockItem, 'totalPrice' | 'status'>, sale: Pick<SalesRecord, 'totalPrice'> | undefined, logs: Pick<HealthLogItem, 'cost'>[]): Money {
  const cost = cow.totalPrice || 0;
  const medical = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const invested = cost + medical;
  const status = cow.status.toLowerCase();
  const revenue = status === 'sold' && sale ? sale.totalPrice : null;
  const result = revenue !== null ? revenue - invested : status === 'dead' ? -invested : null;
  return { cost, medical, invested, revenue, result };
}
