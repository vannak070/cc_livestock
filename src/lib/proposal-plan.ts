import { feedNeeds, parseFeedLines, planFeedLines } from './feed-lines';
import { parsePlanLoan } from './plan-loan';
import type { ProposalPlanParams } from '@/types';

/**
 * The fattening plan calculator: what a plan earns, in a steady state, from a
 * handful of assumptions. Pure, so the Planning screen only collects the
 * inputs and shows the answers. Money is in Riel (៛).
 */

/** The standard plan: 400 head, 120 days, 1.25 kg a day, 8% interest. */
export const DEFAULT_PLAN: ProposalPlanParams = {
  targetStockLevel: 400,
  numberOfBatches: 10,
  cattlePerBatch: 40,
  initialWeightKg: 300,
  dailyWeightGainKg: 1.25,
  fatteningPeriodDays: 120,
  purchasePricePerKgKhr: 11000,
  sellingPricePerKgKhr: 12500,
  bankInterestRateAnnual: 8.0,
  grassKgPerHeadDay: 30,
  grassCostPerKgKhr: 200,
  concentrateKgPerHeadDay: 7,
  concentrateCostPerKgKhr: 1200,
};

export interface MonthPlan {
  month: number;
  openingStock: number;
  purchaseQty: number;
  salesQty: number;
  closingStock: number;
  purchaseCostKhr: number;
  feedCostKhr: number;
  bankInterestMonthKhr: number;
  revenueKhr: number;
  totalCostKhr: number;
  netProfitKhr: number;
}

export interface BatchPlan {
  no: number;
  cattleCount: number;
  purchaseMonth: number;
  saleMonth: number;
  /** Feed the batch needs over its fattening, by kind. */
  feedKg: { name: string; kg: number }[];
  cattleCostKhr: number;
  feedCostKhr: number;
  bankInterestCostKhr: number;
  totalCostKhr: number;
  revenueKhr: number;
  netProfitKhr: number;
}

export function calculatePlan(p: ProposalPlanParams) {
  const totalCattle = p.targetStockLevel || 400;
  const fatteningMonths = Math.max(1, Math.round(p.fatteningPeriodDays / 30));
  const monthlyBatchQty = Math.max(1, Math.round(totalCattle / fatteningMonths));

  const weightGainKgPerHead = p.dailyWeightGainKg * p.fatteningPeriodDays;
  const finalWeightKgPerHead = p.initialWeightKg + weightGainKgPerHead;
  const purchasePricePerHeadKhr = p.initialWeightKg * p.purchasePricePerKgKhr;
  const sellingPricePerHeadKhr = finalWeightKgPerHead * p.sellingPricePerKgKhr;

  // Feed by kind (older plans: grass and concentrate). A month is 30 days.
  const lines = planFeedLines(p);
  const dailyFeedPerHeadKhr = lines.reduce((s, l) => s + l.kgPerHeadDay * l.pricePerKgKhr, 0);
  const monthlyTotalFeedCostKhr = totalCattle * 30 * dailyFeedPerHeadKhr;

  // One animal over its whole fattening period.
  const perHeadFeedCostKhr = dailyFeedPerHeadKhr * p.fatteningPeriodDays;

  const initialCattlePurchaseKhr = totalCattle * purchasePricePerHeadKhr;
  const monthlyInterestRate = p.bankInterestRateAnnual / 100 / 12;
  const monthlyBankInterestKhr = initialCattlePurchaseKhr * monthlyInterestRate;

  const monthlyReplacementPurchaseKhr = monthlyBatchQty * purchasePricePerHeadKhr;
  const monthlySalesRevenueKhr = monthlyBatchQty * sellingPricePerHeadKhr;
  const totalMonthlyCostKhr = monthlyReplacementPurchaseKhr + monthlyTotalFeedCostKhr + monthlyBankInterestKhr;
  const monthlyProfitKhr = monthlySalesRevenueKhr - totalMonthlyCostKhr;

  const annualSalesRevenueKhr = monthlySalesRevenueKhr * 12;
  const annualCattlePurchasesKhr = monthlyReplacementPurchaseKhr * 12;
  const annualFeedCostKhr = monthlyTotalFeedCostKhr * 12;
  // Each feed: for one animal over its fattening, and for the full herd over a year.
  const feed = lines.map((l, i) => ({
    name: l.name,
    kgPerHeadDay: l.kgPerHeadDay,
    pricePerKgKhr: l.pricePerKgKhr,
    perHeadKhr: l.kgPerHeadDay * l.pricePerKgKhr * p.fatteningPeriodDays,
    annualKg: feedNeeds(lines, totalCattle * 360)[i].kg,
    annualKhr: l.kgPerHeadDay * l.pricePerKgKhr * totalCattle * 360,
  }));
  const annualBankInterestKhr = monthlyBankInterestKhr * 12;
  const annualTotalCostKhr = annualCattlePurchasesKhr + annualFeedCostKhr + annualBankInterestKhr;
  const annualProfitKhr = annualSalesRevenueKhr - annualTotalCostKhr;
  const annualMarginPercent = annualSalesRevenueKhr > 0 ? (annualProfitKhr / annualSalesRevenueKhr) * 100 : 0;
  const annualRoiPercent = initialCattlePurchaseKhr > 0 ? (annualProfitKhr / initialCattlePurchaseKhr) * 100 : 0;

  // One animal.
  const interestPerHeadKhr = purchasePricePerHeadKhr * (monthlyInterestRate * fatteningMonths);
  const costPerHeadKhr = purchasePricePerHeadKhr + perHeadFeedCostKhr + interestPerHeadKhr;
  const profitPerHeadKhr = sellingPricePerHeadKhr - costPerHeadKhr;
  const marginPerHeadPercent = sellingPricePerHeadKhr > 0 ? (profitPerHeadKhr / sellingPricePerHeadKhr) * 100 : 0;

  // One batch.
  const batchRevenueKhr = p.cattlePerBatch * sellingPricePerHeadKhr;
  const batchCostKhr = p.cattlePerBatch * purchasePricePerHeadKhr + perHeadFeedCostKhr * p.cattlePerBatch + p.cattlePerBatch * interestPerHeadKhr;
  const batchProfitKhr = batchRevenueKhr - batchCostKhr;

  // The first 12 months: stock builds up, then settles once the first animals are sold.
  const months: MonthPlan[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    let openingStock: number, purchaseQty: number, salesQty: number, closingStock: number;
    if (month < fatteningMonths) {
      openingStock = (month - 1) * monthlyBatchQty; purchaseQty = monthlyBatchQty; salesQty = 0; closingStock = month * monthlyBatchQty;
    } else if (month === fatteningMonths) {
      openingStock = (month - 1) * monthlyBatchQty; purchaseQty = monthlyBatchQty; salesQty = monthlyBatchQty; closingStock = totalCattle;
    } else {
      openingStock = totalCattle; purchaseQty = monthlyBatchQty; salesQty = monthlyBatchQty; closingStock = totalCattle;
    }
    const purchaseCostKhr = purchaseQty * purchasePricePerHeadKhr;
    const feedCostKhr = closingStock * 30 * dailyFeedPerHeadKhr;
    const bankInterestMonthKhr = closingStock * purchasePricePerHeadKhr * monthlyInterestRate;
    const totalCostKhr = purchaseCostKhr + feedCostKhr + bankInterestMonthKhr;
    const revenueKhr = salesQty * sellingPricePerHeadKhr;
    return { month, openingStock, purchaseQty, salesQty, closingStock, purchaseCostKhr, feedCostKhr, bankInterestMonthKhr, revenueKhr, totalCostKhr, netProfitKhr: revenueKhr - totalCostKhr };
  });

  const batches: BatchPlan[] = Array.from({ length: p.numberOfBatches }, (_, i) => ({
    no: i + 1,
    cattleCount: p.cattlePerBatch,
    purchaseMonth: i + 1,
    saleMonth: i + 1 + fatteningMonths,
    feedKg: feedNeeds(lines, p.fatteningPeriodDays * p.cattlePerBatch).map(f => ({ name: f.name, kg: f.kg })),
    cattleCostKhr: p.cattlePerBatch * purchasePricePerHeadKhr,
    feedCostKhr: perHeadFeedCostKhr * p.cattlePerBatch,
    bankInterestCostKhr: p.cattlePerBatch * interestPerHeadKhr,
    totalCostKhr: batchCostKhr,
    revenueKhr: batchRevenueKhr,
    netProfitKhr: batchProfitKhr,
  }));

  return {
    totalCattle, fatteningMonths, monthlyBatchQty,
    weightGainKgPerHead, finalWeightKgPerHead, purchasePricePerHeadKhr, sellingPricePerHeadKhr,
    feed, dailyFeedPerHeadKhr, perHeadFeedCostKhr, interestPerHeadKhr, costPerHeadKhr, profitPerHeadKhr, marginPerHeadPercent,
    initialCattlePurchaseKhr, monthlyBankInterestKhr, monthlyTotalFeedCostKhr, monthlyReplacementPurchaseKhr, monthlySalesRevenueKhr, totalMonthlyCostKhr, monthlyProfitKhr,
    annualSalesRevenueKhr, annualCattlePurchasesKhr, annualFeedCostKhr, annualBankInterestKhr, annualTotalCostKhr, annualProfitKhr, annualMarginPercent, annualRoiPercent,
    batchRevenueKhr, batchCostKhr, batchProfitKhr,
    months, batches,
  };
}

type NumberKey = Exclude<keyof ProposalPlanParams, 'feedLines' | 'loan'>;
const PARAM_KEYS = (Object.keys(DEFAULT_PLAN) as (keyof ProposalPlanParams)[]).filter((k): k is NumberKey => k !== 'feedLines' && k !== 'loan');

/** A plan's numbers from untrusted input, or null when anything is missing, not a number, or negative. */
export function parsePlanParams(raw: unknown): ProposalPlanParams | null {
  if (!raw || typeof raw !== 'object') return null;
  const out = {} as ProposalPlanParams;
  for (const key of PARAM_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    out[key] = value;
  }
  const feedLines = parseFeedLines((raw as Record<string, unknown>).feedLines);
  if (typeof feedLines === 'string') return null;
  if (feedLines.length > 0) out.feedLines = feedLines;
  const rawLoan = (raw as Record<string, unknown>).loan;
  if (rawLoan !== undefined && rawLoan !== null) {
    const loan = parsePlanLoan(rawLoan, out.bankInterestRateAnnual);
    if (typeof loan === 'string') return null;
    out.loan = loan;
  }
  return out;
}

/** The name to keep for a plan: trimmed, at most 60 characters, "Plan N" when empty. */
export function planName(raw: unknown, slot: number): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 60) : '';
  return name || `Plan ${slot}`;
}
