/**
 * A farm's bank loan for buying cattle (the three-party agreement: the bank
 * lends to the farm, CC Livestock buys the cattle back in month 12 and pays
 * the bank first). One loan per farm; it renews each year.
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
  /** Share of each cattle purchase the bank pays; the farm pays the rest. */
  financedPct: number;
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
  feedCostPerHeadDayKhr: number;
  /** The last month of each loan year cattle are bought in. */
  lastBuyMonth: number;
  /** The farm's own money at the start. */
  openingCashKhr: number;
}

export interface FarmLoanRecord {
  farmLocation: string;
  terms: FarmLoanTerms;
  assumptions: FarmLoanAssumptions;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}
