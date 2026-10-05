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
  grassReqKg: number;
  concentrateReqKg: number;
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

  // Feed for the whole herd, a month being 30 days.
  const monthlyGrassCostKhr = totalCattle * p.grassKgPerHeadDay * 30 * p.grassCostPerKgKhr;
  const monthlyConcentrateCostKhr = totalCattle * p.concentrateKgPerHeadDay * 30 * p.concentrateCostPerKgKhr;
  const monthlyTotalFeedCostKhr = monthlyGrassCostKhr + monthlyConcentrateCostKhr;

  // One animal over its whole fattening period.
  const perHeadGrassCostKhr = p.grassKgPerHeadDay * p.fatteningPeriodDays * p.grassCostPerKgKhr;
  const perHeadConcentrateCostKhr = p.concentrateKgPerHeadDay * p.fatteningPeriodDays * p.concentrateCostPerKgKhr;
  const perHeadFeedCostKhr = perHeadGrassCostKhr + perHeadConcentrateCostKhr;

  const initialCattlePurchaseKhr = totalCattle * purchasePricePerHeadKhr;
  const monthlyInterestRate = p.bankInterestRateAnnual / 100 / 12;
  const monthlyBankInterestKhr = initialCattlePurchaseKhr * monthlyInterestRate;

  const monthlyReplacementPurchaseKhr = monthlyBatchQty * purchasePricePerHeadKhr;
  const monthlySalesRevenueKhr = monthlyBatchQty * sellingPricePerHeadKhr;
  const totalMonthlyCostKhr = monthlyReplacementPurchaseKhr + monthlyTotalFeedCostKhr + monthlyBankInterestKhr;
  const monthlyProfitKhr = monthlySalesRevenueKhr - totalMonthlyCostKhr;

  const annualSalesRevenueKhr = monthlySalesRevenueKhr * 12;
  const annualCattlePurchasesKhr = monthlyReplacementPurchaseKhr * 12;
  const annualGrassCostKhr = monthlyGrassCostKhr * 12;
  const annualConcentrateCostKhr = monthlyConcentrateCostKhr * 12;
  const annualFeedCostKhr = monthlyTotalFeedCostKhr * 12;
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
    const feedCostKhr = closingStock * p.grassKgPerHeadDay * p.grassCostPerKgKhr * 30 + closingStock * p.concentrateKgPerHeadDay * p.concentrateCostPerKgKhr * 30;
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
    grassReqKg: p.grassKgPerHeadDay * p.fatteningPeriodDays * p.cattlePerBatch,
    concentrateReqKg: p.concentrateKgPerHeadDay * p.fatteningPeriodDays * p.cattlePerBatch,
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
    perHeadGrassCostKhr, perHeadConcentrateCostKhr, perHeadFeedCostKhr, interestPerHeadKhr, costPerHeadKhr, profitPerHeadKhr, marginPerHeadPercent,
    initialCattlePurchaseKhr, monthlyBankInterestKhr, monthlyTotalFeedCostKhr, monthlyReplacementPurchaseKhr, monthlySalesRevenueKhr, totalMonthlyCostKhr, monthlyProfitKhr,
    annualSalesRevenueKhr, annualCattlePurchasesKhr, annualGrassCostKhr, annualConcentrateCostKhr, annualFeedCostKhr, annualBankInterestKhr, annualTotalCostKhr, annualProfitKhr, annualMarginPercent, annualRoiPercent,
    batchRevenueKhr, batchCostKhr, batchProfitKhr,
    months, batches,
  };
}

/** Feed needed, and what it costs, for some animals over some days. */
export function feedForPeriod(p: Pick<ProposalPlanParams, 'grassKgPerHeadDay' | 'grassCostPerKgKhr' | 'concentrateKgPerHeadDay' | 'concentrateCostPerKgKhr'>, head: number, days: number) {
  const grassKg = head * p.grassKgPerHeadDay * days;
  const concentrateKg = head * p.concentrateKgPerHeadDay * days;
  const grassCostKhr = grassKg * p.grassCostPerKgKhr;
  const concentrateCostKhr = concentrateKg * p.concentrateCostPerKgKhr;
  return { grassKg, grassCostKhr, concentrateKg, concentrateCostKhr, totalCostKhr: grassCostKhr + concentrateCostKhr };
}
