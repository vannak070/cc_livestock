import type { ERPLivestockData } from './types';
import { composition, type Share } from './report-stats';
import { farmProfit, sumMonths, type FarmMonth } from './farm-costs';
import { sickCattle } from './attention';

/**
 * The numbers of the branded PDF report (Reports > Download report), pure so the sheet only draws them.
 * Cattle figures are a snapshot of today; money figures follow the chosen period (yyyy-mm to yyyy-mm).
 */

/**
 * The parts of the report, in the order of the tabs, the section list and the printed PDF (user, 2026-10-15): Summary first,
 * then Financing and cash, then Sales and profit, then Cattle inventory and buy-backs, CamCow stock, the Action plan, and Herd and health.
 */
export type PackSection = 'overview' | 'finance' | 'money' | 'management' | 'stock' | 'work' | 'cattle';
export const PACK_SECTIONS: PackSection[] = ['overview', 'finance', 'money', 'management', 'stock', 'work', 'cattle'];

export interface PackPeriod { from: string; to: string }

const norm = (s?: string) => (s ?? '').toLowerCase().trim();

/** True when yyyy-mm-dd (or yyyy-mm) falls inside the period. */
export function inPeriod(date: string | null | undefined, period: PackPeriod): boolean {
  const m = date && /^(\d{4}-\d{2})/.exec(date);
  return !!m && m[1] >= period.from && m[1] <= period.to;
}

export interface ReportPack {
  overview: { head: number; sold: number; salesAmount: number; profit: number | null; sick: number; batches: number };
  cattle: {
    head: number; avgWeight: number; cost: number; dead: number;
    breeds: Share[]; sexes: Share[]; health: Share[];
    byFarm: { name: string; head: number; avg: number }[];
    batches: { name: string; farm: string; head: number; avgWeight: number; startDate: string }[];
  };
  money: { months: FarmMonth[]; totals: ReturnType<typeof sumMonths>; costs: number };
}

/** `data` is already narrowed to the chosen farm; `full` is everything (feed and running costs are company-wide and worked out per farm). */
export function buildReportPack(data: ERPLivestockData, full: ERPLivestockData, farm: string, period: PackPeriod): ReportPack {
  const active = data.stock.filter(c => norm(c.status) === 'active');
  const sales = data.salesTracking.filter(s => inPeriod(s.salesDate, period));
  const months = farmProfit({
    stock: full.stock, sales: full.salesTracking, healthLogs: full.healthLogs, feedTransactions: full.feedTransactions || [],
    batches: full.batches, costs: full.farmCosts || [], farm: farm || undefined,
  }).months.filter(m => m.month >= period.from && m.month <= period.to);
  const totals = sumMonths(months);
  const avg = (list: { weight?: number }[]) => (list.length ? list.reduce((s, c) => s + (c.weight || 0), 0) / list.length : 0);
  const farmNames = [...new Set(active.map(c => c.location).filter(Boolean))];
  const activeBatches = data.batches.filter(b => b.status === 'Active');
  return {
    overview: {
      head: active.length,
      sold: sales.length,
      salesAmount: sales.reduce((s, x) => s + (x.totalPrice || 0), 0),
      profit: months.length ? totals.profit : null,
      sick: sickCattle(active).length,
      batches: activeBatches.length,
    },
    cattle: {
      head: active.length,
      avgWeight: avg(active),
      cost: active.reduce((s, c) => s + (c.totalPrice || 0), 0),
      dead: data.stock.filter(c => norm(c.status) === 'dead' || norm(c.healthStatus) === 'dead').length,
      breeds: composition(active, c => c.breed),
      sexes: composition(active, c => c.sex),
      health: composition(active, c => c.healthStatus),
      byFarm: farmNames.map(n => { const l = active.filter(c => c.location === n); return { name: n, head: l.length, avg: avg(l) }; }).sort((a, b) => b.head - a.head),
      batches: activeBatches.map(b => {
        const ids = new Set(b.cowIds ?? []);
        const cows = active.filter(c => ids.has(c.id));
        return { name: b.name, farm: b.farmLocation ?? '', head: cows.length, avgWeight: avg(cows), startDate: (b.startDate ?? '').slice(0, 10) };
      }),
    },
    money: { months, totals, costs: totals.cattleCost + totals.medicine + totals.feed + totals.other },
  };
}
