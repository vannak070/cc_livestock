import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, addMonths, defaultTerms, farmActuals, parseLoanAssumptions, parseLoanTerms, simulateLoan } from './farm-loan';
import type { FarmLoanAssumptions, FarmLoanTerms } from './types';
import type { SalesRecord, StockItem, WeightRecord } from './xlsx-parser';

const terms: FarmLoanTerms = { ...defaultTerms('2026-01'), bank: 'Bank', annualRatePct: 12 };
const a: FarmLoanAssumptions = { ...DEFAULT_ASSUMPTIONS, herdTarget: 100, fatteningDays: 120, initialWeightKg: 300, dailyGainKg: 1, buyPricePerKgKhr: 10000, sellPricePerKgKhr: 12000, feedCostPerHeadDayKhr: 5000, lastBuyMonth: 9 };

describe('addMonths', () => {
  it('moves across years both ways', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-01', 23)).toBe('2027-12');
  });
});

describe('simulateLoan', () => {
  const plan = simulateLoan(terms, a);
  const m = (i: number) => plan.months[i - 1];

  it('runs two loan years when the loan renews', () => {
    expect(plan.months).toHaveLength(24);
    expect(m(1).month).toBe('2026-01');
    expect(m(13)).toMatchObject({ month: '2027-01', year: 2, monthInYear: 1 });
    expect(simulateLoan({ ...terms, autoRenew: false }, a).months).toHaveLength(12);
  });

  it('buys up to the herd size, sells when fattening ends, and stops buying after the last buy month', () => {
    expect(plan.fatteningMonths).toBe(4);
    expect(plan.headPerMonth).toBe(25);
    expect([1, 2, 3, 4, 5].map(i => m(i).headBought)).toEqual([25, 25, 25, 25, 25]);
    expect(m(3).headSold).toBe(0);
    expect(m(4).headSold).toBe(25);
    expect(m(10).headBought).toBe(0);
    // Each animal: 300 kg × 10,000 to buy; 420 kg × 12,000 when sold.
    expect(m(1).purchaseKhr).toBe(25 * 3_000_000);
    expect(m(4).salesKhr).toBe(25 * 420 * 12000);
  });

  it('draws for purchases, charges interest on the balance, and repays 20/30/50% of what was drawn', () => {
    expect(m(1)).toMatchObject({ drawKhr: 75_000_000, interestKhr: 750_000 });
    const drawnBy8 = plan.months.slice(0, 8).reduce((s, x) => s + x.drawKhr, 0);
    expect(m(8).principalKhr).toBe(Math.round(drawnBy8 * 0.2));
    const drawnBy11 = plan.months.slice(0, 11).reduce((s, x) => s + x.drawKhr, 0);
    expect(m(8).principalKhr + m(11).principalKhr).toBe(Math.round(drawnBy11 * 0.5));
    expect(m(12).balanceKhr).toBe(0);
    expect(plan.years[0].principalKhr).toBe(plan.years[0].drawnKhr);
  });

  it('in month 12 CC Livestock buys what is left and pays the bank first', () => {
    expect(m(12).buybackKhr).toBe(m(12).salesKhr);
    expect(m(12).headEnd).toBe(0);
    expect(m(12).paidFromBuybackKhr).toBe(Math.min(m(12).principalKhr, m(12).buybackKhr));
    expect(m(12).paidFromBuybackKhr).toBeGreaterThan(0);
  });

  it('starts again in year 2 (refinance) and repays it by month 24', () => {
    expect(m(13)).toMatchObject({ headBought: 25, drawKhr: 75_000_000 });
    expect(m(24).balanceKhr).toBe(0);
    expect(plan.endBalanceKhr).toBe(0);
  });

  it('shows how much own money the farm needs before the first sales', () => {
    // Months 1-3 have feed and interest but nothing to sell.
    expect(m(1).cashKhr).toBeLessThan(0);
    expect(plan.moneyNeededKhr).toBe(-plan.lowestCashKhr);
    expect(plan.shortMonths).toContain('2026-01');
    expect(simulateLoan(terms, { ...a, openingCashKhr: plan.moneyNeededKhr }).shortMonths).toEqual([]);
  });

  it('keeps under the credit limit and lets the farm pay the rest', () => {
    const capped = simulateLoan({ ...terms, creditLimitKhr: 100_000_000 }, a);
    expect(Math.max(...capped.months.map(x => x.balanceKhr))).toBeLessThanOrEqual(100_000_000);
    expect(capped.months[1].drawKhr).toBe(25_000_000);
  });

  it('carries what is not repaid when the shares add up to less than 100%', () => {
    const part = simulateLoan({ ...terms, autoRenew: false, repayments: [{ month: 12, pct: 50 }] }, a);
    expect(part.endBalanceKhr).toBeGreaterThan(0);
  });
});

describe('parse', () => {
  it('accepts the defaults and refuses bad terms', () => {
    expect(parseLoanTerms(terms)).toMatchObject({ repayments: [{ month: 8, pct: 20 }, { month: 11, pct: 30 }, { month: 12, pct: 50 }] });
    expect(parseLoanTerms({ ...terms, startMonth: '2026-13' })).toMatch(/month the loan starts/);
    expect(parseLoanTerms({ ...terms, repayments: [{ month: 8, pct: 60 }, { month: 12, pct: 50 }] })).toMatch(/more than 100/);
    expect(parseLoanTerms({ ...terms, repayments: [{ month: 8, pct: 20 }, { month: 8, pct: 20 }] })).toMatch(/twice/);
    expect(parseLoanTerms({ ...terms, annualRatePct: -1 })).toMatch(/interest/);
    expect(parseLoanAssumptions(a)).toEqual(a);
    expect(parseLoanAssumptions({ ...a, herdTarget: 0 })).toMatch(/how many cattle/);
    expect(parseLoanAssumptions({ ...a, lastBuyMonth: 13 })).toMatch(/last month/);
  });
});

describe('farmActuals', () => {
  const stock = [
    { id: 'A', location: 'SNR Farm', status: 'Sold', buyType: 'Weight', unitPrice: 11000, totalPrice: 3_300_000, weight: 300, purchaseDate: '2026-06-01' },
    { id: 'B', location: 'SNR Farm', status: 'Active', buyType: 'Weight', unitPrice: 13000, totalPrice: 3_900_000, weight: 300, purchaseDate: '2026-06-01' },
    { id: 'X', location: 'Other', status: 'Active', buyType: 'Weight', unitPrice: 99999, totalPrice: 1, weight: 1, purchaseDate: '2026-06-01' },
  ] as StockItem[];
  const weights = [
    { cowId: 'B', currentWeight: 300, trackingDate: '2026-06-01' },
    { cowId: 'B', currentWeight: 400, trackingDate: '2026-09-09' },
  ] as WeightRecord[];
  const sales = [{ cowId: 'A', salesDate: '2026-09-29', saleType: 'Scale', unitPrice: 12300, totalPrice: 5_000_000 }] as SalesRecord[];
  const feed = [
    { id: '1', date: '2026-09-20T00:00:00.000Z', type: 'STOCK_OUT', totalCost: 600_000, sourceFarm: 'SNR Farm' },
    { id: '2', date: '2026-05-01T00:00:00.000Z', type: 'STOCK_OUT', totalCost: 9_999_999, sourceFarm: 'SNR Farm' },
  ] as never;

  it('fills in what the farm’s records can tell, and only for that farm', () => {
    const { values, basis } = farmActuals({ name: 'SNR Farm', capacity: 100 }, { stock, weightTracking: weights, salesTracking: sales, feedTransactions: feed, batches: [] }, '2026-10-05');
    expect(values).toMatchObject({ herdTarget: 100, buyPricePerKgKhr: 12000, initialWeightKg: 300, sellPricePerKgKhr: 12300, fatteningDays: 120, dailyGainKg: 1 });
    // 600,000 ៛ over 60 days for 1 animal on the farm now.
    expect(values.feedCostPerHeadDayKhr).toBe(10000);
    expect(basis.sellPricePerKgKhr).toMatch(/1 sales/);
  });

  it('leaves out what it cannot work out', () => {
    const { values } = farmActuals({ name: 'Empty' }, { stock, weightTracking: [], salesTracking: [], batches: [] });
    expect(values).toEqual({});
  });
});
