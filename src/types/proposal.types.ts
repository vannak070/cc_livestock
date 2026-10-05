// Mirrors DEFAULT_PLAN in src/lib/proposal-plan.ts — the full
// set of interactive simulation inputs for the Fattening Proposal Tool.
// Plans are global (not per-farm, not per-user): up to ten named slots that
// everyone with access sees.
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
