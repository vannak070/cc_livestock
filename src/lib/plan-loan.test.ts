import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN, parsePlanParams } from './proposal-plan';
import { defaultPlanLoan, parsePlanLoan, planLoanInputs } from './plan-loan';
import { simulateLoan } from './farm-loan';

describe('a fattening plan’s bank loan', () => {
  it('uses standard terms (cattle, plus feed and interest for the first months; monthly trade) when the plan has none', () => {
    const { terms, assumptions } = planLoanInputs(DEFAULT_PLAN);
    expect(terms).toMatchObject({ annualRatePct: 8, financedPct: 100, autoRenew: true, loanCovers: 'start' });
    expect(terms.repayments.map(r => r.pct)).toEqual([20, 30, 50]);
    expect(assumptions).toMatchObject({ herdTarget: 400, fatteningDays: 120, buyPlan: 'monthly', feedCostPerHeadDayKhr: 30 * 200 + 7 * 1200 });
  });

  it('runs like a farm loan: one fund that covers the cattle and the feed and interest of the months before the first sale', () => {
    const { terms, assumptions } = planLoanInputs(DEFAULT_PLAN);
    const sim = simulateLoan(terms, assumptions);
    const y1 = sim.years[0];
    // 400 cattle stocked over the first 4 months, before the first sale.
    expect(y1.startCattleKhr).toBe(400 * 300 * 11000);
    expect(y1.noTradeMonths).toBe(4);
    const parts = y1.loanParts!;
    expect(parts.cattleKhr).toBe(y1.startCattleKhr);
    expect(Math.abs(sim.months[0].drawKhr - (parts.cattleKhr + parts.feedKhr + parts.interestKhr))).toBeLessThan(50);
    // The farm needs no money of its own for the months without trade, and the later months are paid from the sales.
    expect(sim.months.slice(0, 4).every(x => x.cashKhr >= 0)).toBe(true);
    // A year of feed and interest costs more to borrow, and cattle only leaves the farm to find the feed and interest.
    const all = simulateLoan({ ...terms, loanCovers: 'all' }, assumptions);
    expect(all.months[0].drawKhr).toBeGreaterThan(sim.months[0].drawKhr);
    const cattleOnly = simulateLoan({ ...terms, loanCovers: 'cattle' }, assumptions);
    expect(cattleOnly.months[0].drawKhr).toBe(400 * 300 * 11000);
    expect(cattleOnly.moneyNeededKhr).toBeGreaterThan(0);
  });

  it('is kept with the plan and checked', () => {
    const loan = { ...defaultPlanLoan('2026-10'), bank: 'ARDB', loanAmountKhr: 500_000_000, buyPlan: 'once' as never };
    const saved = parsePlanParams({ ...DEFAULT_PLAN, loan });
    expect(planLoanInputs(parsePlanParams({ ...DEFAULT_PLAN, loan: { ...loan, loanCovers: 'all' } })!).terms.loanCovers).toBe('all');
    // An older plan holding another buying choice is kept as the monthly trade.
    expect(saved?.loan).toMatchObject({ bank: 'ARDB', loanAmountKhr: 500_000_000, buyPlan: 'monthly', startMonth: '2026-10' });
    expect(saved?.loan).not.toHaveProperty('annualRatePct');
    expect(planLoanInputs(saved!).terms.annualRatePct).toBe(DEFAULT_PLAN.bankInterestRateAnnual);
    expect(parsePlanParams({ ...DEFAULT_PLAN, loan: { ...loan, startMonth: 'soon' } })).toBeNull();
    expect(parsePlanLoan({ ...loan, repayments: [] }, 8)).toMatch(/repayment/);
  });

  it('keeps older plans without a loan as they are', () => {
    expect(parsePlanParams(DEFAULT_PLAN)).not.toHaveProperty('loan');
  });
});
