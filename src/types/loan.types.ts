import type { PlanFeedLine } from './proposal.types';
/**
 * A farm's bank loan for buying cattle (the three-party agreement: the bank
 * lends to the farm; CC Livestock, the guarantee company, sells the farm its
 * cattle and feed and buys the cattle back; only the farm repays the bank).
 * One loan per farm; it renews each year.
 */

/** A principal repayment in a loan year: in `month` (1 to 12), `pct` % of what was drawn that year. */
export interface LoanRepayment {
  month: number;
  pct: number;
}

export interface FarmLoanTerms {
  bank: string;
  /** The most the farm may owe at any time. 0 means no limit. */
  creditLimitKhr: number;
  annualRatePct: number;
  /** Share of what the loan covers (see `loanCovers`), when the amount is worked out. */
  financedPct: number;
  /**
   * What a worked-out loan covers (missing = 'cattle'):
   * - cattle: the cattle bought until the first sale to CC Livestock;
   * - all: those cattle, plus the year's feed and the year's interest.
   */
  loanCovers?: 'cattle' | 'all';
  /**
   * The bank pays the loan out ONCE, in month 1 of each loan year. This is that
   * amount; 0 or missing means: the financed share of the cattle bought until
   * the first sale to CC Livestock, capped by the credit limit.
   */
  loanAmountKhr?: number;
  /** Month 1 of loan year 1, YYYY-MM. */
  startMonth: string;
  repayments: LoanRepayment[];
  /** The loan is drawn again in month 1 of the next year (refinance). */
  autoRenew: boolean;
}

/** What the plan expects the farm's cattle to do. */
export interface FarmLoanAssumptions {
  herdTarget: number;
  initialWeightKg: number;
  dailyGainKg: number;
  fatteningDays: number;
  buyPricePerKgKhr: number;
  sellPricePerKgKhr: number;
  /** Feed for each animal a day in riel: the sum of `feedLines` when they are set. */
  feedCostPerHeadDayKhr: number;
  /** Feed by kind, per animal a day (newer plans). */
  feedLines?: PlanFeedLine[];
  /** No longer used: the monthly trade keeps buying all year. Kept so older plans still load. */
  lastBuyMonth: number;
  /** The farm's own money at the start. */
  openingCashKhr: number;
  /**
   * How cattle are bought in a loan year (missing = 'monthly'):
   * - monthly: stock up a share a month; then every month the cattle that are ready are sold to CC Livestock
   *   and replaced from CC Livestock the same day, so the herd stays full (it carries on into the next loan year);
   * - once: the whole herd in month 1, kept until month 12;
   * - rounds: the whole herd in month 1; each time fattening ends it is sold to CC Livestock and a new
   *   herd is taken from CC Livestock the same day, so the herd stays full; the last herd is sold in month 12;
   * - split: part of the herd in month 1 (`firstBuyPct`), the rest in `secondBuyMonth`, all kept until month 12.
   * In month 12 CC Livestock buys every animal still on the farm.
   */
  buyPlan?: 'monthly' | 'once' | 'rounds' | 'split';
  firstBuyPct?: number;
  secondBuyMonth?: number;
}
