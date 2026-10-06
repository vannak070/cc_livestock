import type { BillingPrice, BillingSettings, CattleRegistration } from './types';

/**
 * The monthly bill for CC Livestock: every animal registered is billed once,
 * in the month it was registered, at the price for that month. Pure and
 * browser-safe so the screens and the server use the same rules.
 *
 * - Billing starts in the earliest month of the price list; earlier
 *   registrations are not billed.
 * - A registration an admin removed as a mistake is shown but not billed.
 * - Months are the farm's calendar months (Cambodia time), `YYYY-MM`.
 */

/** Only these roles see the bill and set the price. */
export const BILLING_ROLES = ['Super Admin', 'Admin'];
export const canSeeBilling = (user: { role?: string } | null | undefined): boolean => !!user && BILLING_ROLES.includes(user.role ?? '');

export const MAX_PRICE = 100_000_000;
export const MAX_PRICE_RULES = 60;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (m: unknown): m is string => typeof m === 'string' && MONTH.test(m);

/** The price list sorted oldest first. */
export const sortedPrices = (settings: BillingSettings | null | undefined): BillingPrice[] =>
  [...(settings?.prices ?? [])].sort((a, b) => a.from.localeCompare(b.from));

/** The month billing starts (the first price month), or undefined when no price is set. */
export const billingStart = (settings: BillingSettings | null | undefined): string | undefined => sortedPrices(settings)[0]?.from;

/** The price for a month: the latest price rule that starts on or before it; undefined before billing starts. */
export function priceForMonth(settings: BillingSettings | null | undefined, month: string): number | undefined {
  let found: number | undefined;
  for (const rule of sortedPrices(settings)) {
    if (rule.from <= month) found = rule.price;
  }
  return found;
}

/** Why a price list cannot be saved, or null. */
export function billingProblem(settings: unknown): string | null {
  const prices = (settings as BillingSettings | null | undefined)?.prices;
  if (!Array.isArray(prices) || prices.length === 0) return 'Add a price.';
  if (prices.length > MAX_PRICE_RULES) return `Keep the price list under ${MAX_PRICE_RULES} entries.`;
  const seen = new Set<string>();
  for (const p of prices) {
    if (!p || !isMonth(p.from)) return 'Choose the month the price starts (year and month).';
    if (!(Number.isInteger(p.price) && p.price >= 0 && p.price <= MAX_PRICE)) return `Type the price in ៛ as a whole number from 0 to ${MAX_PRICE.toLocaleString()}.`;
    if (seen.has(p.from)) return 'Two prices start in the same month.';
    seen.add(p.from);
  }
  return null;
}

/** A price list with `rule` added; a rule for the same month replaces the old one. */
export function withPrice(settings: BillingSettings | null | undefined, rule: BillingPrice): BillingSettings {
  return { prices: sortedPrices({ prices: [...(settings?.prices ?? []).filter(p => p.from !== rule.from), rule] }) };
}

/** A price list without the rule starting in `from`. */
export function withoutPrice(settings: BillingSettings | null | undefined, from: string): BillingSettings {
  return { prices: sortedPrices({ prices: (settings?.prices ?? []).filter(p => p.from !== from) }) };
}

export interface FarmBill {
  farm: string;
  cattle: number;
  amount: number;
}

export interface MonthStatement {
  month: string;
  /** False before the first price month, or when no price is set at all. */
  billed: boolean;
  /** The price per animal used for this month (undefined when not billed). */
  price?: number;
  farms: FarmBill[];
  cattle: number;
  amount: number;
  /** Registrations an admin removed as mistakes in this month (shown, not billed). */
  removed: number;
  /** Every billable registration of the month, newest first. */
  animals: CattleRegistration[];
}

const isBillable = (r: CattleRegistration) => !r.removedAt;

/** One month's statement from the registration records. */
export function monthStatement(month: string, registrations: CattleRegistration[], settings: BillingSettings | null | undefined): MonthStatement {
  const price = priceForMonth(settings, month);
  const inMonth = registrations.filter(r => r.month === month);
  const live = inMonth.filter(isBillable);
  const removed = inMonth.length - live.length;
  const animals = [...live].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt) || a.cowId.localeCompare(b.cowId));
  if (price === undefined) {
    return { month, billed: false, farms: [], cattle: 0, amount: 0, removed, animals };
  }
  const byFarm = new Map<string, number>();
  for (const r of live) byFarm.set(r.farm || '—', (byFarm.get(r.farm || '—') ?? 0) + 1);
  const farms = [...byFarm.entries()]
    .map(([farm, cattle]) => ({ farm, cattle, amount: cattle * price }))
    .sort((a, b) => b.cattle - a.cattle || a.farm.localeCompare(b.farm));
  return { month, billed: true, price, farms, cattle: live.length, amount: live.length * price, removed, animals };
}

export interface MonthTotal {
  month: string;
  cattle: number;
  amount: number;
  billed: boolean;
}

/** The totals of the last `count` months ending at `endMonth`, newest first. */
export function recentMonths(endMonth: string, count: number, registrations: CattleRegistration[], settings: BillingSettings | null | undefined): MonthTotal[] {
  const out: MonthTotal[] = [];
  let [y, m] = endMonth.split('-').map(Number);
  for (let i = 0; i < count; i++) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    const s = monthStatement(month, registrations, settings);
    out.push({ month, cattle: s.cattle, amount: s.amount, billed: s.billed });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/** What the billing screen needs for one month: the statement, the last twelve months, and the price list. */
export interface BillingView {
  settings: BillingSettings;
  month: string;
  statement: MonthStatement;
  recent: MonthTotal[];
  /** This month on the farm's calendar (the one still open). */
  currentMonth: string;
}

/** The month before or after a YYYY-MM month. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
