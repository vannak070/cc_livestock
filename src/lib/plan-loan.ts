import type { FarmLoanAssumptions, FarmLoanTerms, PlanLoan, ProposalPlanParams } from './types';
import { DEFAULT_ASSUMPTIONS, defaultTerms, parseLoanAssumptions, parseLoanTerms } from './farm-loan';
import { planFeedLines } from './feed-lines';

/**
 * A fattening plan's bank loan: the plan's cattle numbers and its loan terms
 * put into the farm loan calculator (simulateLoan), so a plan gets the same
 * payments to the bank and trades with CC Livestock as a farm's loan.
 */

/** The loan a plan uses when it has none saved: standard terms (cattle, feed and interest), trading with CC Livestock every month. */
export function defaultPlanLoan(startMonth?: string): PlanLoan {
  const { annualRatePct: _rate, ...terms } = defaultTerms(startMonth);
  void _rate;
  return { ...terms, buyPlan: 'monthly', lastBuyMonth: DEFAULT_ASSUMPTIONS.lastBuyMonth, openingCashKhr: 0 };
}

/** The plan as loan terms and cattle numbers for simulateLoan. */
export function planLoanInputs(p: ProposalPlanParams): { terms: FarmLoanTerms; assumptions: FarmLoanAssumptions; loan: PlanLoan } {
  const loan = p.loan ?? defaultPlanLoan();
  const lines = planFeedLines(p);
  const terms: FarmLoanTerms = {
    bank: loan.bank,
    creditLimitKhr: loan.creditLimitKhr,
    annualRatePct: p.bankInterestRateAnnual,
    financedPct: loan.financedPct,
    ...(loan.loanAmountKhr ? { loanAmountKhr: loan.loanAmountKhr } : {}),
    ...(loan.loanCovers ? { loanCovers: loan.loanCovers } : {}),
    startMonth: loan.startMonth,
    repayments: loan.repayments,
    autoRenew: loan.autoRenew,
  };
  const assumptions: FarmLoanAssumptions = {
    herdTarget: p.targetStockLevel,
    initialWeightKg: p.initialWeightKg,
    dailyGainKg: p.dailyWeightGainKg,
    fatteningDays: p.fatteningPeriodDays,
    buyPricePerKgKhr: p.purchasePricePerKgKhr,
    sellPricePerKgKhr: p.sellingPricePerKgKhr,
    feedCostPerHeadDayKhr: lines.reduce((s, l) => s + l.kgPerHeadDay * l.pricePerKgKhr, 0),
    feedLines: lines,
    lastBuyMonth: loan.lastBuyMonth,
    openingCashKhr: loan.openingCashKhr,
    ...(loan.buyPlan ? { buyPlan: loan.buyPlan } : {}),
    ...(loan.buyPlan === 'split' ? { firstBuyPct: loan.firstBuyPct, secondBuyMonth: loan.secondBuyMonth } : {}),
  };
  return { terms, assumptions, loan };
}

/** A plan's loan from untrusted input, or an error message. The interest rate is checked with the plan. */
export function parsePlanLoan(raw: unknown, annualRatePct: number): PlanLoan | string {
  if (!raw || typeof raw !== 'object') return 'The bank loan is not valid.';
  const r = raw as Record<string, unknown>;
  const terms = parseLoanTerms({ ...r, annualRatePct });
  if (typeof terms === 'string') return terms;
  // The buying plan, last buy month and own money are checked by the farm loan rules, on standard cattle numbers.
  const buying = parseLoanAssumptions({
    ...DEFAULT_ASSUMPTIONS,
    buyPlan: r.buyPlan, firstBuyPct: r.firstBuyPct, secondBuyMonth: r.secondBuyMonth, lastBuyMonth: r.lastBuyMonth, openingCashKhr: r.openingCashKhr,
  });
  if (typeof buying === 'string') return buying;
  const { annualRatePct: _rate, ...rest } = terms;
  void _rate;
  return {
    ...rest,
    lastBuyMonth: buying.lastBuyMonth,
    openingCashKhr: buying.openingCashKhr,
    ...(buying.buyPlan ? { buyPlan: buying.buyPlan } : {}),
    ...(buying.buyPlan === 'split' ? { firstBuyPct: buying.firstBuyPct, secondBuyMonth: buying.secondBuyMonth } : {}),
  };
}
