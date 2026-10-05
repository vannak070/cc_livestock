import type { FarmItem, FarmLoanAssumptions, FarmLoanTerms, FeedStockTransaction, LoanRepayment, BatchItem } from './types';
import type { SalesRecord, StockItem, WeightRecord } from './xlsx-parser';
import { growth, weighPoints } from './cattle-stats';
import { addDays, dayOf, farmToday } from './daily-feed';
import { feedFarm } from './farm-costs';
import { farmMatcher } from './farm-scope';

/**
 * A farm's 24-month loan plan: what the farm draws, owes, repays and has in
 * hand each month under the bank agreement. Pure, so the screen only collects
 * the numbers and shows the answers. Money is in Riel (៛).
 *
 * How a loan year runs (months 1 to 12 from the start month):
 * - Cattle are bought at the start of a month, up to the herd size, until
 *   `lastBuyMonth`. The bank pays `financedPct` % of each purchase, as long as
 *   the farm stays under the credit limit; the farm pays the rest.
 * - Interest is paid every month on what is owed after that month's draws.
 * - Feed is paid every month for every animal on the farm (30 days a month).
 * - An animal is sold at the end of the month its fattening ends.
 * - Principal: at each repayment month the farm must have repaid the listed
 *   share (added up) of everything drawn that year so far.
 * - Month 12: CC Livestock buys every animal still on the farm and pays the
 *   bank what is due first; the farm gets the rest.
 * - With `autoRenew`, the loan is drawn again from month 1 of the next year.
 */

/** The bank agreement as agreed: 20% in month 8, 30% in month 11, 50% in month 12. */
export const DEFAULT_REPAYMENTS: LoanRepayment[] = [
  { month: 8, pct: 20 },
  { month: 11, pct: 30 },
  { month: 12, pct: 50 },
];

export function defaultTerms(startMonth: string = farmToday().slice(0, 7)): FarmLoanTerms {
  return { bank: '', creditLimitKhr: 0, annualRatePct: 8, financedPct: 100, startMonth, repayments: DEFAULT_REPAYMENTS.map(r => ({ ...r })), autoRenew: true };
}

/** The standard planning numbers, for a farm with no records to start from. */
export const DEFAULT_ASSUMPTIONS: FarmLoanAssumptions = {
  herdTarget: 100,
  initialWeightKg: 300,
  dailyGainKg: 1.25,
  fatteningDays: 120,
  buyPricePerKgKhr: 11000,
  sellPricePerKgKhr: 12500,
  feedCostPerHeadDayKhr: 6000,
  lastBuyMonth: 9,
  openingCashKhr: 0,
};

export interface LoanMonth {
  /** 1 to 24. */
  index: number;
  /** YYYY-MM */
  month: string;
  /** 1 or 2. */
  year: number;
  /** 1 to 12 within the loan year. */
  monthInYear: number;
  headBought: number;
  headSold: number;
  /** On the farm at the end of the month, after sales. */
  headEnd: number;
  purchaseKhr: number;
  /** Paid by the bank towards this month's purchases. */
  drawKhr: number;
  feedKhr: number;
  /** Cattle sold that month (in month 12, all of it to CC Livestock). */
  salesKhr: number;
  /** Month 12: what CC Livestock pays for the cattle it buys back. */
  buybackKhr: number;
  interestKhr: number;
  principalKhr: number;
  /** Month 12: the part of the principal CC Livestock paid the bank straight from the buyback. */
  paidFromBuybackKhr: number;
  /** Owed to the bank at the end of the month. */
  balanceKhr: number;
  /** The farm's money at the end of the month; below 0 means it needs money from somewhere. */
  cashKhr: number;
}

export interface LoanYearTotals {
  year: number;
  drawnKhr: number;
  interestKhr: number;
  principalKhr: number;
  purchasesKhr: number;
  feedKhr: number;
  salesKhr: number;
  /** sales − cattle bought − feed − interest */
  profitKhr: number;
}

export interface LoanPlan {
  months: LoanMonth[];
  years: LoanYearTotals[];
  fatteningMonths: number;
  headPerMonth: number;
  buyPerHeadKhr: number;
  sellPerHeadKhr: number;
  lowestCashKhr: number;
  lowestCashMonth: string | null;
  /** Own money the farm needs on top of its opening cash so cash never goes below 0. */
  moneyNeededKhr: number;
  /** Months where the farm's cash is below 0. */
  shortMonths: string[];
  /** Repayment months whose payment left the farm's cash below 0. */
  shortRepayments: string[];
  /** Still owed after the last month (the repayments do not add up to 100%). */
  endBalanceKhr: number;
}

const r0 = (n: number) => Math.round(n);

/** YYYY-MM moved by n months. */
export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12 + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

export function fatteningMonthsFor(days: number): number {
  return Math.max(1, Math.round(days / 30));
}

export function simulateLoan(terms: FarmLoanTerms, a: FarmLoanAssumptions): LoanPlan {
  const fatMonths = fatteningMonthsFor(a.fatteningDays);
  const headPerMonth = Math.max(0, Math.ceil(a.herdTarget / fatMonths));
  const buyPerHead = a.initialWeightKg * a.buyPricePerKgKhr;
  const sellPerHead = (a.initialWeightKg + a.dailyGainKg * a.fatteningDays) * a.sellPricePerKgKhr;
  const rate = terms.annualRatePct / 100 / 12;
  const schedule = [...terms.repayments].sort((x, y) => x.month - y.month);
  const yearsToRun = terms.autoRenew ? 2 : 1;

  const cohorts: { head: number; bought: number }[] = [];
  const months: LoanMonth[] = [];
  let balance = 0;
  let cash = a.openingCashKhr;
  let yearDrawn = 0;
  let yearRepaid = 0;

  for (let t = 0; t < yearsToRun * 12; t++) {
    const monthInYear = (t % 12) + 1;
    const year = Math.floor(t / 12) + 1;
    if (monthInYear === 1) { yearDrawn = 0; yearRepaid = 0; }

    // Buy at the start of the month, up to the herd size.
    const onFarm = cohorts.reduce((s, c) => s + c.head, 0);
    const headBought = monthInYear <= a.lastBuyMonth ? Math.max(0, Math.min(headPerMonth, a.herdTarget - onFarm)) : 0;
    if (headBought > 0) cohorts.push({ head: headBought, bought: t });
    const purchase = headBought * buyPerHead;
    const room = terms.creditLimitKhr > 0 ? Math.max(0, terms.creditLimitKhr - balance) : Infinity;
    const draw = Math.min(purchase * (terms.financedPct / 100), room);
    balance += draw;
    yearDrawn += draw;

    const interest = balance * rate;
    const headInMonth = onFarm + headBought;
    const feed = headInMonth * 30 * a.feedCostPerHeadDayKhr;

    // Sell at the end of the month: finished cattle, or in month 12 everything left (CC Livestock buys it back).
    let headSold = 0;
    let sales = 0;
    for (let i = cohorts.length - 1; i >= 0; i--) {
      const c = cohorts[i];
      const monthsOn = t - c.bought + 1;
      if (monthsOn >= fatMonths || monthInYear === 12) {
        const days = Math.min(a.fatteningDays, monthsOn * 30);
        sales += c.head * (a.initialWeightKg + a.dailyGainKg * days) * a.sellPricePerKgKhr;
        headSold += c.head;
        cohorts.splice(i, 1);
      }
    }
    const buyback = monthInYear === 12 ? sales : 0;

    // Principal due: the listed share (added up) of what was drawn this year, less what is already repaid.
    let principal = 0;
    const due = schedule.filter(r => r.month <= monthInYear).reduce((s, r) => s + r.pct, 0);
    if (schedule.some(r => r.month === monthInYear)) {
      principal = Math.min(balance, Math.max(0, (Math.min(due, 100) / 100) * yearDrawn - yearRepaid));
    }
    balance -= principal;
    yearRepaid += principal;
    const paidFromBuyback = monthInYear === 12 ? Math.min(principal, buyback) : 0;

    cash += draw - purchase + sales - feed - interest - principal;
    months.push({
      index: t + 1,
      month: addMonths(terms.startMonth, t),
      year,
      monthInYear,
      headBought,
      headSold,
      headEnd: cohorts.reduce((s, c) => s + c.head, 0),
      purchaseKhr: r0(purchase),
      drawKhr: r0(draw),
      feedKhr: r0(feed),
      salesKhr: r0(sales),
      buybackKhr: r0(buyback),
      interestKhr: r0(interest),
      principalKhr: r0(principal),
      paidFromBuybackKhr: r0(paidFromBuyback),
      balanceKhr: r0(balance),
      cashKhr: r0(cash),
    });
  }

  const years: LoanYearTotals[] = [];
  for (let y = 1; y <= yearsToRun; y++) {
    const ms = months.filter(m => m.year === y);
    const sum = (k: keyof LoanMonth) => ms.reduce((s, m) => s + (m[k] as number), 0);
    const t = { year: y, drawnKhr: sum('drawKhr'), interestKhr: sum('interestKhr'), principalKhr: sum('principalKhr'), purchasesKhr: sum('purchaseKhr'), feedKhr: sum('feedKhr'), salesKhr: sum('salesKhr'), profitKhr: 0 };
    t.profitKhr = t.salesKhr - t.purchasesKhr - t.feedKhr - t.interestKhr;
    years.push(t);
  }

  const lowest = months.reduce<LoanMonth | null>((lo, m) => (!lo || m.cashKhr < lo.cashKhr ? m : lo), null);
  const lowestCash = Math.min(a.openingCashKhr, lowest?.cashKhr ?? 0);
  return {
    months,
    years,
    fatteningMonths: fatMonths,
    headPerMonth,
    buyPerHeadKhr: r0(buyPerHead),
    sellPerHeadKhr: r0(sellPerHead),
    lowestCashKhr: lowestCash,
    lowestCashMonth: lowest && lowest.cashKhr < 0 ? lowest.month : null,
    moneyNeededKhr: Math.max(0, -lowestCash),
    shortMonths: months.filter(m => m.cashKhr < 0).map(m => m.month),
    shortRepayments: months.filter(m => m.principalKhr > 0 && m.cashKhr < 0).map(m => m.month),
    endBalanceKhr: months.length ? months[months.length - 1].balanceKhr : 0,
  };
}

// ─── Checking what is saved ─────────────────────────────────────────────────

const MAX_KHR = 1_000_000_000_000; // a trillion riel: anything bigger is a typo

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** A loan's terms from untrusted input, or an error message. */
export function parseLoanTerms(raw: unknown): FarmLoanTerms | string {
  if (!raw || typeof raw !== 'object') return 'The loan is not valid.';
  const r = raw as Record<string, unknown>;
  const bank = typeof r.bank === 'string' ? r.bank.trim() : '';
  if (bank.length > 100) return 'Keep the bank name under 100 letters.';
  const creditLimitKhr = num(r.creditLimitKhr, 0, MAX_KHR);
  if (creditLimitKhr === null) return 'Type the credit limit (0 for no limit).';
  const annualRatePct = num(r.annualRatePct, 0, 100);
  if (annualRatePct === null) return 'Type the interest rate, between 0 and 100% a year.';
  const financedPct = num(r.financedPct, 0, 100);
  if (financedPct === null) return 'Type how much of each purchase the bank pays, between 0 and 100%.';
  const startMonth = typeof r.startMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.startMonth) ? r.startMonth : null;
  if (!startMonth) return 'Choose the month the loan starts.';
  if (!Array.isArray(r.repayments) || r.repayments.length === 0 || r.repayments.length > 12) return 'Add at least one repayment month.';
  const repayments: LoanRepayment[] = [];
  for (const x of r.repayments as unknown[]) {
    const month = num((x as LoanRepayment)?.month, 1, 12);
    const pct = num((x as LoanRepayment)?.pct, 0, 100);
    if (month === null || !Number.isInteger(month) || pct === null || pct <= 0) return 'Each repayment needs a month from 1 to 12 and a share above 0%.';
    if (repayments.some(p => p.month === month)) return `Month ${month} is listed twice.`;
    repayments.push({ month, pct });
  }
  repayments.sort((x, y) => x.month - y.month);
  if (repayments.reduce((s, p) => s + p.pct, 0) > 100.0001) return 'The repayments add up to more than 100%.';
  return { bank, creditLimitKhr, annualRatePct, financedPct, startMonth, repayments, autoRenew: r.autoRenew !== false };
}

/** The plan's numbers from untrusted input, or an error message. */
export function parseLoanAssumptions(raw: unknown): FarmLoanAssumptions | string {
  if (!raw || typeof raw !== 'object') return 'The plan is not valid.';
  const r = raw as Record<string, unknown>;
  const checks: [keyof FarmLoanAssumptions, number, number, string][] = [
    ['herdTarget', 1, 100_000, 'Type how many cattle the farm keeps.'],
    ['initialWeightKg', 1, 2000, 'Type the weight when bought.'],
    ['dailyGainKg', 0, 5, 'Type the gain each day (0 to 5 kg).'],
    ['fatteningDays', 1, 720, 'Type the days of fattening (1 to 720).'],
    ['buyPricePerKgKhr', 0, 1_000_000, 'Type the buy price for each kg.'],
    ['sellPricePerKgKhr', 0, 1_000_000, 'Type the sell price for each kg.'],
    ['feedCostPerHeadDayKhr', 0, 1_000_000, 'Type the feed cost for each animal each day.'],
    ['lastBuyMonth', 1, 12, 'Choose the last month cattle are bought (1 to 12).'],
    ['openingCashKhr', 0, MAX_KHR, 'Type the money the farm has at the start (0 or more).'],
  ];
  const out = {} as FarmLoanAssumptions;
  for (const [key, min, max, message] of checks) {
    const v = num(r[key], min, max);
    if (v === null) return message;
    out[key] = key === 'herdTarget' || key === 'lastBuyMonth' ? Math.round(v) : v;
  }
  return out;
}

// ─── Starting from the farm's own records ───────────────────────────────────

export interface FarmActuals {
  /** Only the numbers the records can give; each with what it was worked out from. */
  values: Partial<FarmLoanAssumptions>;
  basis: Partial<Record<keyof FarmLoanAssumptions, string>>;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const byWeight = (s: Pick<SalesRecord, 'saleType'>) => ['scale', 'weight'].includes((s.saleType ?? '').toLowerCase().trim());
const FEED_LOOKBACK_DAYS = 60;

export function farmActuals(
  farm: Pick<FarmItem, 'name' | 'capacity'>,
  data: { stock: StockItem[]; weightTracking: WeightRecord[]; salesTracking: SalesRecord[]; feedTransactions?: FeedStockTransaction[]; batches: Pick<BatchItem, 'id' | 'farmLocation'>[] },
  today: string = farmToday()
): FarmActuals {
  const values: Partial<FarmLoanAssumptions> = {};
  const basis: FarmActuals['basis'] = {};
  const onFarm = farmMatcher(farm.name);
  const cattle = data.stock.filter(c => onFarm(c.location));
  const active = cattle.filter(c => c.status.toLowerCase() === 'active');

  if (farm.capacity && farm.capacity > 0) { values.herdTarget = farm.capacity; basis.herdTarget = 'the farm’s capacity'; }

  const gains = cattle
    .map(c => growth(c, weighPoints(c.id, data.weightTracking, c.purchaseDate)).perDay)
    .filter((g): g is number => g !== null && g > 0 && g < 5);
  const gain = avg(gains);
  if (gain !== null) { values.dailyGainKg = Math.round(gain * 100) / 100; basis.dailyGainKg = `${gains.length} weighed animals`; }

  const boughtByKg = cattle.filter(c => (c.buyType ?? '').toLowerCase() === 'weight' && c.unitPrice > 0 && c.totalPrice > 0);
  const buyPrice = avg(boughtByKg.map(c => c.unitPrice));
  const buyWeight = avg(boughtByKg.map(c => c.totalPrice / c.unitPrice));
  if (buyPrice !== null) { values.buyPricePerKgKhr = Math.round(buyPrice); basis.buyPricePerKgKhr = `${boughtByKg.length} animals bought by weight`; }
  if (buyWeight !== null) { values.initialWeightKg = Math.round(buyWeight); basis.initialWeightKg = `${boughtByKg.length} animals bought by weight`; }

  const ids = new Set(cattle.map(c => c.id));
  const sold = data.salesTracking.filter(s => ids.has(s.cowId));
  const soldByKg = sold.filter(s => byWeight(s) && s.unitPrice > 0);
  const sellPrice = avg(soldByKg.map(s => s.unitPrice));
  if (sellPrice !== null) { values.sellPricePerKgKhr = Math.round(sellPrice); basis.sellPricePerKgKhr = `${soldByKg.length} sales by weight`; }

  const cowById = new Map(cattle.map(c => [c.id, c]));
  const kept = sold
    .map(s => { const c = cowById.get(s.cowId); const from = dayOf(c?.purchaseDate ?? undefined); const to = dayOf(s.salesDate ?? undefined); return from && to ? (Date.parse(to) - Date.parse(from)) / 86_400_000 : null; })
    .filter((d): d is number => d !== null && d > 0);
  const days = avg(kept);
  if (days !== null) { values.fatteningDays = Math.round(days); basis.fatteningDays = `${kept.length} animals sold`; }

  // Feed taken out at this farm over the last 60 days, for the cattle on it now.
  const since = addDays(today, -FEED_LOOKBACK_DAYS);
  const batchFarm = new Map(data.batches.map(b => [b.id, b.farmLocation]));
  const feedCost = (data.feedTransactions ?? [])
    .filter(t => t.type === 'STOCK_OUT' && dayOf(t.date) > since && dayOf(t.date) <= today && onFarm(feedFarm(t, batchFarm)))
    .reduce((s, t) => s + (t.totalCost || 0), 0);
  if (feedCost > 0 && active.length > 0) {
    values.feedCostPerHeadDayKhr = Math.round(feedCost / (active.length * FEED_LOOKBACK_DAYS));
    basis.feedCostPerHeadDayKhr = `feed used in the last ${FEED_LOOKBACK_DAYS} days for ${active.length} animals`;
  }
  return { values, basis };
}
