import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN, parsePlanParams } from './proposal-plan';
import { defaultPlanLoan, parsePlanLoan, planLoanInputs } from './plan-loan';
import { simulateLoan } from './farm-loan';

describe('a fattening plan’s bank loan', () => {
  it('uses standard terms (cattle, feed and interest; monthly trade) when the plan has none', () => {
    const { terms, assumptions } = planLoanInputs(DEFAULT_PLAN);
    expect(terms).toMatchObject({ annualRatePct: 8, financedPct: 100, autoRenew: true, loanCovers: 'all' });
    expect(terms.repayments.map(r => r.pct)).toEqual([20, 30, 50]);
    expect(assumptions).toMatchObject({ herdTarget: 400, fatteningDays: 120, buyPlan: 'monthly', feedCostPerHeadDayKhr: 30 * 200 + 7 * 1200 });
  });

  it('runs like a farm loan: one fund that covers the cattle, a year of feed and the interest, so the farm needs no money of its own', () => {
    const { terms, assumptions } = planLoanInputs(DEFAULT_PLAN);
    const sim = simulateLoan(terms, assumptions);
    const y1 = sim.years[0];
    // 400 cattle stocked over the first 4 months, before the first sale.
    expect(y1.startCattleKhr).toBe(400 * 300 * 11000);
    expect(Math.abs(sim.months[0].drawKhr - (y1.startCattleKhr + y1.feedKhr + y1.interestKhr))).toBeLessThan(50);
    expect(sim.moneyNeededKhr).toBe(0);
    // Cattle only: the farm must find the feed and interest until the first sales.
    const cattleOnly = simulateLoan({ ...terms, loanCovers: 'cattle' }, assumptions);
    expect(cattleOnly.months[0].drawKhr).toBe(400 * 300 * 11000);
    expect(cattleOnly.moneyNeededKhr).toBeGreaterThan(0);
  });

  it('is kept with the plan and checked', () => {
    const loan = { ...defaultPlanLoan('2026-10'), bank: 'ARDB', loanAmountKhr: 500_000_000, buyPlan: 'split' as const, firstBuyPct: 60, secondBuyMonth: 3 };
    const saved = parsePlanParams({ ...DEFAULT_PLAN, loan });
    expect(planLoanInputs(parsePlanParams({ ...DEFAULT_PLAN, loan: { ...loan, loanCovers: 'all' } })!).terms.loanCovers).toBe('all');
    expect(saved?.loan).toMatchObject({ bank: 'ARDB', loanAmountKhr: 500_000_000, buyPlan: 'split', firstBuyPct: 60, secondBuyMonth: 3, startMonth: '2026-10' });
    expect(saved?.loan).not.toHaveProperty('annualRatePct');
    expect(planLoanInputs(saved!).terms.annualRatePct).toBe(DEFAULT_PLAN.bankInterestRateAnnual);
    expect(parsePlanParams({ ...DEFAULT_PLAN, loan: { ...loan, startMonth: 'soon' } })).toBeNull();
    expect(parsePlanLoan({ ...loan, secondBuyMonth: 1 }, 8)).toMatch(/second purchase/);
    expect(parsePlanLoan({ ...loan, repayments: [] }, 8)).toMatch(/repayment/);
  });

  it('keeps older plans without a loan as they are', () => {
    expect(parsePlanParams(DEFAULT_PLAN)).not.toHaveProperty('loan');
  });
});
