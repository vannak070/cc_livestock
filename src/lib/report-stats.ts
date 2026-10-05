import type { HealthLogItem } from './types';
import type { SalesRecord, StockItem } from './xlsx-parser';
import { money as cattleMoney } from './cattle-stats';

/** Numbers for the Reports screens, pure so the screens only display them. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(d?: string | null): string | null {
  const m = d ? /^(\d{4})-(\d{2})/.exec(d) : null;
  return m ? `${m[1]}-${m[2]}` : null;
}

export interface MonthRow {
  /** yyyy-mm */
  month: string;
  /** For example "Oct 26". */
  label: string;
  /** What the cattle bought that month cost. */
  bought: number;
  /** What the cattle sold that month earned. */
  sold: number;
  soldCount: number;
  /** Sold minus what those animals cost (purchase + health); animals with no record are left out. */
  profit: number;
}

/** Cattle bought and sold per month, oldest first, only months with something in them. */
export function monthlyMoney(stock: StockItem[], sales: SalesRecord[], logs: Pick<HealthLogItem, 'cowId' | 'cost'>[]): MonthRow[] {
  const rows = new Map<string, MonthRow>();
  const row = (key: string): MonthRow => {
    let r = rows.get(key);
    if (!r) {
      r = { month: key, label: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, bought: 0, sold: 0, soldCount: 0, profit: 0 };
      rows.set(key, r);
    }
    return r;
  };
  for (const c of stock) {
    const k = monthKey(c.purchaseDate);
    if (k && c.totalPrice > 0) row(k).bought += c.totalPrice;
  }
  const byId = new Map(stock.map(c => [c.id, c]));
  const logsByCow = new Map<string, Pick<HealthLogItem, 'cowId' | 'cost'>[]>();
  for (const l of logs) {
    const list = logsByCow.get(l.cowId);
    if (list) list.push(l); else logsByCow.set(l.cowId, [l]);
  }
  for (const s of sales) {
    const k = monthKey(s.salesDate);
    if (!k) continue;
    const r = row(k);
    r.sold += s.totalPrice || 0;
    r.soldCount += 1;
    const cow = byId.get(s.cowId);
    if (cow) r.profit += cattleMoney({ totalPrice: cow.totalPrice, status: 'Sold' }, s, logsByCow.get(s.cowId) ?? []).result ?? 0;
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface Share { label: string; count: number; pct: number }

/** How many of each kind, biggest first, with the share of the total. */
export function composition<T>(items: T[], pick: (item: T) => string | undefined | null): Share[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const label = (pick(it) ?? '').trim() || 'Not set';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, pct: items.length ? Math.round((count / items.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface ForecastInput {
  cattle: Pick<StockItem, 'weight' | 'totalPrice'>[];
  /** Health costs already spent on these animals. */
  healthCost: number;
  /** Feed cost for the whole group each day, from the feeding program. */
  feedCostPerDay: number;
  /** Estimated feed already used (days in the batch × today's daily feed cost). */
  feedSoFar: number;
  /** Expected gain per animal per day, kg. */
  perDay: number;
  daysToSell: number;
  pricePerKg: number;
}

export interface Forecast {
  head: number;
  avgNow: number;
  avgFinal: number;
  totalKg: number;
  revenue: number;
  purchase: number;
  healthCost: number;
  feedSoFar: number;
  feedToGo: number;
  totalCost: number;
  profit: number;
  /** Profit as a percentage of everything spent; null when nothing was spent. */
  returnPct: number | null;
}

export function forecast(i: ForecastInput): Forecast {
  const head = i.cattle.length;
  const days = Math.max(0, i.daysToSell);
  const avgNow = head ? i.cattle.reduce((s, c) => s + (c.weight || 0), 0) / head : 0;
  const avgFinal = avgNow + i.perDay * days;
  const totalKg = avgFinal * head;
  const revenue = totalKg * i.pricePerKg;
  const purchase = i.cattle.reduce((s, c) => s + (c.totalPrice || 0), 0);
  const feedToGo = i.feedCostPerDay * days;
  const totalCost = purchase + i.healthCost + i.feedSoFar + feedToGo;
  const profit = revenue - totalCost;
  return {
    head, avgNow, avgFinal, totalKg, revenue, purchase, healthCost: i.healthCost, feedSoFar: i.feedSoFar, feedToGo, totalCost, profit,
    returnPct: totalCost > 0 ? Math.round((profit / totalCost) * 1000) / 10 : null,
  };
}
