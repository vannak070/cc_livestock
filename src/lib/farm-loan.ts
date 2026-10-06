import type { FarmLoanAssumptions, FarmLoanTerms, LoanRepayment } from './types';
import { farmToday } from './daily-feed';
import { parseFeedLines } from './feed-lines';

/**
 * A farm's 24-month loan plan: what the farm draws, owes, repays and has in
 * hand each month under the bank agreement. Pure, so the screen only collects
 * the numbers and shows the answers. Money is in Riel (៛).
 *
 * How a loan year runs (months 1 to 12 from the start month):
 * - The bank pays the loan out ONCE, in month 1 of each loan year, as one
 *   fund the farm keeps as cash: the amount agreed (`loanAmountKhr`), or else
 *   `financedPct` % of what it must cover (`loanCovers`): the cattle the farm
 *   buys until its first sale to CC Livestock (later cattle are paid from the
 *   sales), and with 'all' also the year's feed and interest. Capped by the
 *   credit limit.
 * - CC Livestock is the guarantee company and the farm's only trading partner:
 *   the farm buys its cattle and its feed from CC Livestock, and sells every
 *   finished animal back to CC Livestock. When a group is sold the farm takes
 *   new cattle from CC Livestock, to keep its herd. Sale and purchase are
 *   separate payments.
 * - How the cattle are bought follows the farm's buying plan (`buyPlan`); with
 *   the monthly trade the herd carries on from one loan year to the next.
 * - Interest is paid every month on what is owed.
 * - Feed is paid every month for every animal on the farm (30 days a month).
 * - An animal is sold at the end of the month its fattening ends.
 * - Principal: at each repayment month the farm must have repaid the listed
 *   share (added up) of everything drawn that year so far.
 * - Only the farm pays the bank (interest and principal). CC Livestock does
 *   not repay the bank.
 * - With the other buying plans, CC Livestock buys every animal still on the
 *   farm in month 12. At the end of the plan everything left is sold.
 * - With `autoRenew`, the loan renews: the new payout reaches the farm on
 *   renewal day (the end of month 12, with the last repayment) and is owed
 *   from month 1 of the next year.
 */

/** The bank agreement as agreed: 20% in month 8, 30% in month 11, 50% in month 12. */
export const DEFAULT_REPAYMENTS: LoanRepayment[] = [
  { month: 8, pct: 20 },
  { month: 11, pct: 30 },
  { month: 12, pct: 50 },
];

export function defaultTerms(startMonth: string = farmToday().slice(0, 7)): FarmLoanTerms {
  return { bank: '', creditLimitKhr: 0, annualRatePct: 8, financedPct: 100, loanCovers: 'all', startMonth, repayments: DEFAULT_REPAYMENTS.map(r => ({ ...r })), autoRenew: true };
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
  /** Animal-days fed this month (head on the farm × 30), for feed needs by kind. */
  headDays: number;
  purchaseKhr: number;
  /** Paid out by the bank this month (only in month 1 of a loan year). */
  drawKhr: number;
  feedKhr: number;
  /** Cattle sold that month, all of it to CC Livestock. */
  salesKhr: number;
  /** What CC Livestock pays the farm for the cattle it buys this month (= salesKhr). */
  buybackKhr: number;
  interestKhr: number;
  principalKhr: number;
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
  /** sales − what the cattle sold cost to buy − feed − interest (cattle still on the farm count when they are sold) */
  profitKhr: number;
  /** Animal-days fed in the year. */
  headDays: number;
  /** Cattle bought until the first sale to CC Livestock: what a worked-out loan must pay for. */
  startCattleKhr: number;
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

/** A group of cattle bought together: month bought and month sold (0-based, sold at its end), and days on the farm. */
export interface Cohort { head: number; bought: number; sellAt: number; days: number }

/**
 * Every group of cattle the plan buys, following the farm's buying plan.
 *
 * Monthly trade (the default): the farm stocks up a share a month until the
 * herd is full; from then on, each month the cattle that have finished their
 * fattening are sold to CC Livestock and replaced from CC Livestock the same
 * day, so the herd stays full across loan years. Only at the end of the plan
 * is everything left sold.
 *
 * The other plans run one loan year at a time, and everything still on the
 * farm is sold to CC Livestock at the end of month 12.
 */
export function herdPlan(a: FarmLoanAssumptions, years: number): Cohort[] {
  const fatMonths = fatteningMonthsFor(a.fatteningDays);
  const herd = Math.max(0, Math.round(a.herdTarget));
  const out: Cohort[] = [];
  if ((a.buyPlan ?? 'monthly') === 'monthly') {
    const end = years * 12 - 1;
    const perMonth = Math.max(0, Math.ceil(herd / fatMonths));
    for (let t = 0; t <= end; t++) {
      // On the farm at the start of the month: everything bought before and not yet sold.
      const onFarm = out.filter(c => c.bought < t && c.sellAt >= t).reduce((s, c) => s + c.head, 0);
      // Cattle sold at the end of last month are replaced now (the same day).
      const head = Math.max(0, Math.min(perMonth, herd - onFarm));
      if (head > 0) {
        const sellAt = Math.min(t + fatMonths - 1, end);
        out.push({ head, bought: t, sellAt, days: Math.min(a.fatteningDays, (sellAt - t + 1) * 30) });
      }
    }
    return out;
  }
  const keepToEnd = (head: number, bought: number, o: number) => { if (head > 0) out.push({ head, bought, sellAt: o + 11, days: (o + 11 - bought + 1) * 30 }); };
  for (let y = 0; y < years; y++) {
    const o = y * 12;
    const plan = a.buyPlan ?? 'monthly';
    if (plan === 'once') {
      keepToEnd(herd, o, o);
    } else if (plan === 'rounds') {
      // Swap with CC Livestock each time fattening ends: sell the herd, take a new one the same day.
      // As many full rounds as fit in the year; what is left over makes one more round when it is
      // at least half a fattening, else the last round runs longer. The last herd is sold in month 12.
      const lengths: number[] = Array(Math.max(1, Math.floor(12 / fatMonths))).fill(fatMonths);
      const leftover = 12 - lengths.length * fatMonths;
      if (leftover > 0 && leftover >= fatMonths / 2) lengths.push(leftover);
      let start = 0;
      lengths.forEach((len, i) => {
        if (i === lengths.length - 1) keepToEnd(herd, o + start, o);
        else out.push({ head: herd, bought: o + start, sellAt: o + start + len - 1, days: a.fatteningDays });
        start += len;
      });
    } else if (plan === 'split') {
      const first = Math.round(herd * Math.min(100, Math.max(0, a.firstBuyPct ?? 50)) / 100);
      const second = Math.min(12, Math.max(1, Math.round(a.secondBuyMonth ?? 4)));
      keepToEnd(first, o, o);
      keepToEnd(herd - first, o + second - 1, o);
    }
  }
  return out;
}

export function simulateLoan(terms: FarmLoanTerms, a: FarmLoanAssumptions): LoanPlan {
  const fatMonths = fatteningMonthsFor(a.fatteningDays);
  const headPerMonth = Math.max(0, Math.ceil(a.herdTarget / fatMonths));
  const buyPerHead = a.initialWeightKg * a.buyPricePerKgKhr;
  const sellPerHead = (a.initialWeightKg + a.dailyGainKg * a.fatteningDays) * a.sellPricePerKgKhr;
  const rate = terms.annualRatePct / 100 / 12;
  const schedule = [...terms.repayments].sort((x, y) => x.month - y.month);
  const yearsToRun = terms.autoRenew ? 2 : 1;

  // The herd plan does not depend on the loan, so the year's purchases are known up front.
  const cohorts = herdPlan(a, yearsToRun);
  const plannedBuys = Array.from({ length: yearsToRun * 12 }, (_, t) => cohorts.filter(c => c.bought === t).reduce((s, c) => s + c.head, 0));
  // The loan pays for the cattle bought until the first sale to CC Livestock; after that, new cattle are paid from the sales.
  const yearPurchases = (year: number) => {
    const o = (year - 1) * 12;
    const firstSale = Math.min(o + 11, ...cohorts.filter(c => c.sellAt >= o && c.sellAt <= o + 11).map(c => c.sellAt));
    return cohorts.filter(c => c.bought >= o && c.bought <= firstSale).reduce((s, c) => s + c.head * buyPerHead, 0);
  };
  // Head on the farm in a month (bought at its start, or there from before and not sold before it).
  const headIn = (t: number) => cohorts.filter(c => c.bought <= t && c.sellAt >= t).reduce((s, c) => s + c.head, 0);
  const yearFeed = (year: number) => Array.from({ length: 12 }, (_, m) => headIn((year - 1) * 12 + m)).reduce((s, h) => s + h * 30 * a.feedCostPerHeadDayKhr, 0);
  // The year's interest on a payout P is P × rate × (what is still owed each month, as a share of P, added up).
  const owedShares = Array.from({ length: 12 }, (_, m) => Math.max(0, 1 - schedule.filter(r => r.month < m + 1).reduce((s, r) => s + r.pct, 0) / 100)).reduce((s, x) => s + x, 0);
  /** The one payout of a loan year. */
  const loanFor = (year: number) => {
    const share = terms.financedPct / 100;
    // Cattle and feed, and the interest on the loan itself: P = base + P × rate × owedShares.
    const worked = terms.loanCovers === 'all'
      ? (share * (yearPurchases(year) + yearFeed(year))) / Math.max(0.01, 1 - rate * owedShares)
      : share * yearPurchases(year);
    const wanted = terms.loanAmountKhr && terms.loanAmountKhr > 0 ? terms.loanAmountKhr : worked;
    return terms.creditLimitKhr > 0 ? Math.min(wanted, terms.creditLimitKhr) : wanted;
  };

  const months: LoanMonth[] = [];
  let balance = 0;
  let cash = a.openingCashKhr;
  let yearDrawn = 0;
  let yearRepaid = 0;
  // The renewed loan is paid out on renewal day, the end of month 12, when the old one is repaid; it shows in month 1.
  let paidOnRenewal = 0;

  for (let t = 0; t < yearsToRun * 12; t++) {
    const monthInYear = (t % 12) + 1;
    const year = Math.floor(t / 12) + 1;
    if (monthInYear === 1) { yearDrawn = 0; yearRepaid = 0; }

    // Cattle are bought at the start of a month and sold at the end of their last month.
    const onFarm = cohorts.filter(c => c.bought < t && c.sellAt >= t).reduce((s, c) => s + c.head, 0);
    const headBought = plannedBuys[t];
    const purchase = headBought * buyPerHead;
    // One payout a loan year, in its first month (less anything still owed, so the limit holds).
    const room = terms.creditLimitKhr > 0 ? Math.max(0, terms.creditLimitKhr - balance) : Infinity;
    const draw = monthInYear === 1 ? (t === 0 ? Math.min(loanFor(year), room) : paidOnRenewal) : 0;
    balance += draw;
    yearDrawn += draw;

    const interest = balance * rate;
    const headInMonth = onFarm + headBought;
    const feed = headInMonth * 30 * a.feedCostPerHeadDayKhr;

    // Sold to CC Livestock at the end of the month: finished cattle, and in month 12 everything left.
    const selling = cohorts.filter(c => c.sellAt === t);
    const headSold = selling.reduce((s, c) => s + c.head, 0);
    const sales = selling.reduce((s, c) => s + c.head * (a.initialWeightKg + a.dailyGainKg * c.days) * a.sellPricePerKgKhr, 0);
    const buyback = sales; // all of it from CC Livestock

    // Principal due: the listed share (added up) of what was drawn this year, less what is already repaid.
    let principal = 0;
    const due = schedule.filter(r => r.month <= monthInYear).reduce((s, r) => s + r.pct, 0);
    if (schedule.some(r => r.month === monthInYear)) {
      principal = Math.min(balance, Math.max(0, (Math.min(due, 100) / 100) * yearDrawn - yearRepaid));
    }
    balance -= principal;
    yearRepaid += principal;

    // On renewal day the new payout reaches the farm with the old loan's last repayment.
    const renewal = monthInYear === 12 && t + 1 < yearsToRun * 12
      ? Math.min(loanFor(year + 1), terms.creditLimitKhr > 0 ? Math.max(0, terms.creditLimitKhr - balance) : Infinity)
      : 0;
    if (monthInYear === 12) paidOnRenewal = renewal;
    cash += (t === 0 ? draw : 0) + renewal - purchase + sales - feed - interest - principal;
    months.push({
      index: t + 1,
      month: addMonths(terms.startMonth, t),
      year,
      monthInYear,
      headBought,
      headSold,
      headEnd: cohorts.filter(c => c.bought <= t && c.sellAt > t).reduce((s, c) => s + c.head, 0),
      headDays: headInMonth * 30,
      purchaseKhr: r0(purchase),
      drawKhr: r0(draw),
      feedKhr: r0(feed),
      salesKhr: r0(sales),
      buybackKhr: r0(buyback),
      interestKhr: r0(interest),
      principalKhr: r0(principal),
      balanceKhr: r0(balance),
      cashKhr: r0(cash),
    });
  }

  const years: LoanYearTotals[] = [];
  for (let y = 1; y <= yearsToRun; y++) {
    const ms = months.filter(m => m.year === y);
    const sum = (k: keyof LoanMonth) => ms.reduce((s, m) => s + (m[k] as number), 0);
    const t = { year: y, drawnKhr: sum('drawKhr'), interestKhr: sum('interestKhr'), principalKhr: sum('principalKhr'), purchasesKhr: sum('purchaseKhr'), feedKhr: sum('feedKhr'), salesKhr: sum('salesKhr'), profitKhr: 0, headDays: sum('headDays'), startCattleKhr: r0(yearPurchases(y)) };
    // Cattle count when they are sold, so a herd still on the farm at the year end is not a loss.
    t.profitKhr = t.salesKhr - ms.reduce((s, m) => s + m.headSold, 0) * buyPerHead - t.feedKhr - t.interestKhr;
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
  const loanAmountKhr = r.loanAmountKhr === undefined || r.loanAmountKhr === null ? 0 : num(r.loanAmountKhr, 0, MAX_KHR);
  if (loanAmountKhr === null) return 'Type the loan amount (0 to work it out from the cattle).';
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
  if (r.loanCovers !== undefined && r.loanCovers !== null && r.loanCovers !== 'cattle' && r.loanCovers !== 'all') return 'Choose what the loan covers.';
  const loanCovers = r.loanCovers === 'all' ? 'all' as const : undefined;
  return { bank, creditLimitKhr, annualRatePct, financedPct, ...(loanAmountKhr > 0 ? { loanAmountKhr } : {}), ...(loanCovers ? { loanCovers } : {}), startMonth, repayments, autoRenew: r.autoRenew !== false };
}

/** The plan's numbers from untrusted input, or an error message. */
export function parseLoanAssumptions(raw: unknown): FarmLoanAssumptions | string {
  if (!raw || typeof raw !== 'object') return 'The plan is not valid.';
  const r = raw as Record<string, unknown>;
  const checks: [Exclude<keyof FarmLoanAssumptions, 'feedLines' | 'buyPlan' | 'firstBuyPct' | 'secondBuyMonth'>, number, number, string][] = [
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
  // How cattle are bought (older plans: every month).
  const plans = ['monthly', 'once', 'rounds', 'split'] as const;
  if (r.buyPlan !== undefined && r.buyPlan !== null) {
    if (!plans.includes(r.buyPlan as (typeof plans)[number])) return 'Choose how the cattle are bought.';
    out.buyPlan = r.buyPlan as FarmLoanAssumptions['buyPlan'];
  }
  if (out.buyPlan === 'split') {
    const pct = num(r.firstBuyPct, 1, 99);
    if (pct === null) return 'Type the share of the herd bought first (1 to 99%).';
    const month = num(r.secondBuyMonth, 2, 12);
    if (month === null || !Number.isInteger(month)) return 'Choose the month of the second purchase (2 to 12).';
    out.firstBuyPct = pct;
    out.secondBuyMonth = month;
  }
  // Feed by kind: when given, the feed cost a day is their sum.
  const feedLines = parseFeedLines(r.feedLines);
  if (typeof feedLines === 'string') return feedLines;
  if (feedLines.length > 0) {
    out.feedLines = feedLines;
    out.feedCostPerHeadDayKhr = feedPerHeadDay(feedLines).costKhr;
  }
  return out;
}

// ─── The payment plan with the bank ─────────────────────────────────────────

export interface BankPaymentRow {
  index: number;
  /** YYYY-MM */
  month: string;
  year: number;
  monthInYear: number;
  /** Owed at the start of the month, before this month's draws. */
  openingKhr: number;
  drawKhr: number;
  interestKhr: number;
  principalKhr: number;
  /** interest + principal: what the bank receives this month. */
  totalKhr: number;
  /** Owed at the end of the month. */
  closingKhr: number;
}

export interface BankPaymentYear {
  year: number;
  drawKhr: number;
  interestKhr: number;
  principalKhr: number;
  totalKhr: number;
}

/** What the farm owes and pays the bank each month, and each year's totals. The farm pays all of it. */
export function bankSchedule(plan: LoanPlan): { rows: BankPaymentRow[]; years: BankPaymentYear[] } {
  const rows = plan.months.map((m, i): BankPaymentRow => {
    const total = m.interestKhr + m.principalKhr;
    return {
      index: m.index,
      month: m.month,
      year: m.year,
      monthInYear: m.monthInYear,
      openingKhr: i === 0 ? 0 : plan.months[i - 1].balanceKhr,
      drawKhr: m.drawKhr,
      interestKhr: m.interestKhr,
      principalKhr: m.principalKhr,
      totalKhr: total,
      closingKhr: m.balanceKhr,
    };
  });
  const years = [...new Set(rows.map(r => r.year))].map(year => {
    const ys = rows.filter(r => r.year === year);
    const sum = (k: keyof BankPaymentRow) => ys.reduce((s, r) => s + (r[k] as number), 0);
    return { year, drawKhr: sum('drawKhr'), interestKhr: sum('interestKhr'), principalKhr: sum('principalKhr'), totalKhr: sum('totalKhr') };
  });
  return { rows, years };
}

/** One month's trade between the farm and CC Livestock, as separate payments. */
export interface CcTradeRow {
  index: number;
  month: string;
  year: number;
  monthInYear: number;
  /** Cattle ready for sale, sold to CC Livestock at the end of the month, and what CC Livestock pays the farm for them. */
  headSold: number;
  saleKhr: number;
  /** New cattle the farm buys from CC Livestock on this row, and what it pays for them. */
  headBought: number;
  purchaseKhr: number;
  /** Of those, taken the same day as the sale to replace the cattle sold (on the farm from the next month). */
  sameDayHead: number;
  /** Feed the farm buys from CC Livestock this month. */
  feedKhr: number;
  swap: boolean;
}

/**
 * Every month the farm and CC Livestock trade cattle or feed, with the totals
 * for each loan year. Cattle bought at the start of a month to replace cattle
 * sold at the end of the month before were taken the same day as that sale,
 * so they are shown on the month of the sale (also across a renewal).
 */
export function ccTrades(plan: LoanPlan): { rows: CcTradeRow[]; years: (Omit<CcTradeRow, 'index' | 'month' | 'monthInYear' | 'swap' | 'sameDayHead'>)[] } {
  const ms = plan.months;
  const buyPerHead = plan.buyPerHeadKhr;
  // Head bought in month i+1 that replace the cattle sold at the end of month i.
  const moved = ms.map((m, i) => {
    const next = ms[i + 1];
    return next ? Math.min(next.headBought, m.headSold) : 0;
  });
  const rows: CcTradeRow[] = [];
  ms.forEach((m, i) => {
    const own = m.headBought - (i > 0 ? moved[i - 1] : 0);
    const sameDayHead = moved[i];
    const headBought = own + sameDayHead;
    if (m.headSold === 0 && headBought === 0 && m.feedKhr === 0) return;
    rows.push({
      index: m.index, month: m.month, year: m.year, monthInYear: m.monthInYear,
      headSold: m.headSold, saleKhr: m.buybackKhr,
      headBought, purchaseKhr: Math.round(headBought * buyPerHead), sameDayHead,
      feedKhr: m.feedKhr, swap: sameDayHead > 0,
    });
  });
  const years = [...new Set(ms.map(m => m.year))].map(year => {
    const ys = rows.filter(r => r.year === year);
    const sum = (k: keyof CcTradeRow) => ys.reduce((s, r) => s + (r[k] as number), 0);
    return { year, headSold: sum('headSold'), saleKhr: sum('saleKhr'), headBought: sum('headBought'), purchaseKhr: sum('purchaseKhr'), feedKhr: sum('feedKhr') };
  });
  return { rows, years };
}
