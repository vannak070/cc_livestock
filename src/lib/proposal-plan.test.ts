import { describe, it, expect } from 'vitest';
import { DEFAULT_PLAN, calculatePlan, feedForPeriod } from './proposal-plan';

describe('calculatePlan with the standard plan', () => {
  const r = calculatePlan(DEFAULT_PLAN);
  it('works out one animal', () => {
    expect(r.finalWeightKgPerHead).toBe(450);
    expect(r.purchasePricePerHeadKhr).toBe(3_300_000);
    expect(r.sellingPricePerHeadKhr).toBe(5_625_000);
    expect(r.perHeadFeedCostKhr).toBe(720_000 + 1_008_000);
    expect(Math.round(r.interestPerHeadKhr)).toBe(88_000);
    expect(Math.round(r.profitPerHeadKhr)).toBe(509_000);
    expect(Math.round(r.marginPerHeadPercent * 100) / 100).toBe(9.05);
  });
  it('works out a steady month and a year', () => {
    expect(r.fatteningMonths).toBe(4);
    expect(r.monthlyBatchQty).toBe(100);
    expect(r.monthlySalesRevenueKhr).toBe(562_500_000);
    expect(r.monthlyReplacementPurchaseKhr).toBe(330_000_000);
    expect(r.monthlyTotalFeedCostKhr).toBe(72_000_000 + 100_800_000);
    expect(Math.round(r.monthlyBankInterestKhr)).toBe(8_800_000);
    expect(Math.round(r.annualProfitKhr)).toBe(Math.round((562_500_000 - 330_000_000 - 172_800_000 - 8_800_000_000 / 1000) * 12));
    expect(Math.round(r.annualRoiPercent * 10) / 10).toBe(46.3);
  });
  it('builds up the herd over the first months, then holds it steady', () => {
    expect(r.months.map(m => m.closingStock)).toEqual([100, 200, 300, 400, 400, 400, 400, 400, 400, 400, 400, 400]);
    expect(r.months.map(m => m.salesQty).slice(0, 5)).toEqual([0, 0, 0, 100, 100]);
    expect(r.months[0].netProfitKhr).toBeLessThan(0);
  });
  it('lists the batches in the plan', () => {
    expect(r.batches).toHaveLength(10);
    expect(r.batches[0]).toMatchObject({ cattleCount: 40, purchaseMonth: 1, saleMonth: 5, cattleCostKhr: 132_000_000 });
  });
});

describe('calculatePlan edge cases', () => {
  it('never divides by zero', () => {
    const r = calculatePlan({ ...DEFAULT_PLAN, sellingPricePerKgKhr: 0, initialWeightKg: 0, fatteningPeriodDays: 0 });
    expect(r.marginPerHeadPercent).toBe(0);
    expect(r.annualRoiPercent).toBe(0);
    expect(r.fatteningMonths).toBe(1);
  });
});

describe('feedForPeriod', () => {
  it('gives kg and cost of each feed', () => {
    expect(feedForPeriod(DEFAULT_PLAN, 100, 30)).toEqual({ grassKg: 90_000, grassCostKhr: 18_000_000, concentrateKg: 21_000, concentrateCostKhr: 25_200_000, totalCostKhr: 43_200_000 });
  });
});
