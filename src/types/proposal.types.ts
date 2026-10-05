// Mirrors DEFAULT_PLAN in src/lib/proposal-plan.ts — the full
// set of interactive simulation inputs for the Fattening Proposal Tool.
// This is a single, global "current plan" (not per-farm, not per-user):
// whoever last saved it sets what everyone — including the mobile app's
// read-only summary — sees.
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

export interface ProposalPlanRecord {
  params: ProposalPlanParams;
  updatedAt: string; // ISO timestamp
}
