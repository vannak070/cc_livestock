import type { FarmLoanAssumptions, FarmLoanTerms } from './loan.types';

// Mirrors DEFAULT_PLAN in src/lib/proposal-plan.ts — the full
// set of interactive simulation inputs for the Fattening Proposal Tool.
// Plans are global (not per-farm, not per-user): up to ten named slots that
// everyone with access sees.
/**
 * One feed in a plan: how much each animal eats of it a day, and what a kg
 * costs (the bought price, or an estimate for feed grown on the farm).
 */
export interface PlanFeedLine {
  /** The feed product it is; missing for a feed typed by hand. */
  productId?: string;
  name: string;
  kgPerHeadDay: number;
  pricePerKgKhr: number;
}

/**
 * A fattening plan's bank loan, run the same way as a farm loan (one payout in
 * month 1, interest monthly, repayments in set months, all paid by the farm). The interest rate is the plan's
 * `bankInterestRateAnnual`; the cattle come from the plan's own numbers.
 */
export type PlanLoan = Omit<FarmLoanTerms, 'annualRatePct'> &
  Pick<FarmLoanAssumptions, 'buyPlan' | 'firstBuyPct' | 'secondBuyMonth' | 'lastBuyMonth' | 'openingCashKhr'>;

export interface ProposalPlanParams {
  targetStockLevel: number;
  numberOfBatches: number;
  cattlePerBatch: number;
  initialWeightKg: number;
  dailyWeightGainKg: number;
  fatteningPeriodDays: number;
  purchasePricePerKgKhr: number;
  sellingPricePerKgKhr: number;
  bankInterestRateAnnual: number;
  grassKgPerHeadDay: number;
  grassCostPerKgKhr: number;
  concentrateKgPerHeadDay: number;
  concentrateCostPerKgKhr: number;
  /** Feed by kind. When set it replaces the grass/concentrate numbers above (kept for older plans). */
  feedLines?: PlanFeedLine[];
  /** The bank loan for this plan; missing means the standard terms. */
  loan?: PlanLoan;
}

/** One saved planning scenario: Plan 1 .. Plan 10. */
export interface ProposalPlanRecord {
  /** 1 to 10. */
  slot: number;
  name: string;
  params: ProposalPlanParams;
  updatedAt: string; // ISO timestamp
  updatedBy?: string;
}

export const MAX_PLANS = 10;
