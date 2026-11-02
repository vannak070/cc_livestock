import { describe, expect, it } from 'vitest';
import plan2 from '../db/practice/plan2.fixture.json';
import { buildFinance } from './finance-report';
import { farmLedger, type LedgerProgram } from './trade-ledger';
import { generateTasks, type Task } from './ops-program';
import type { ProposalPlanParams } from '../types/proposal.types';

const plan = { ...(plan2 as unknown as ProposalPlanParams), loan: { bank: 'ARDB', buyPlan: 'monthly', autoRenew: false, loanCovers: 'all', repayments: [{ pct: 100, month: 12 }], startMonth: '2026-10', financedPct: 100, lastBuyMonth: 9, creditLimitKhr: 0, openingCashKhr: 0 } } as ProposalPlanParams;
const ledgerOf = (farm: string, startDate: string) => {
  const program: LedgerProgram = { id: farm, farm, startDate, headPerCycle: 20, plan };
  const tasks = generateTasks({ farm, startDate, headPerCycle: 20, plan }, []).tasks.map((t, i) => ({ ...t, id: `${farm}${i}`, programId: farm }) as unknown as Task);
  return farmLedger(program, tasks, [], [], '2026-10-15');
};

describe('buildFinance', () => {
  const f = buildFinance([ledgerOf('A', '2026-03-02'), ledgerOf('B', '2026-11-16')], '2026-10-15');

  it('counts the loan only from the month it is drawn', () => {
    const a = f.loan.farms.find(x => x.farm === 'A')!;
    const b = f.loan.farms.find(x => x.farm === 'B')!;
    expect(a.drawn).toBeGreaterThan(200_000_000);
    expect(a.outstanding).toBe(a.drawn);
    expect(b).toMatchObject({ drawn: 0, outstanding: 0, interestToDate: 0 });
    expect(f.loan.drawn).toBe(a.drawn);
  });

  it('adds up interest to date and finds the principal that falls due', () => {
    const a = f.loan.farms.find(x => x.farm === 'A')!;
    expect(a.interestToDate).toBe(8 * a.interestMonthly); // March to October
    expect(a.principalMonth).toBe('2027-02');
    expect(f.loan.principalNext90).toBe(0); // February is more than 90 days away
    expect(f.loan.principalRemaining).toBeGreaterThan(a.drawn); // A's principal plus B's, still to be repaid
  });

  it('gives the cash record for this month and a window of months around it', () => {
    expect(f.cash.thisMonth?.month).toBe('2026-10');
    expect(f.cash.months[0].month).toBe('2026-05');
    expect(f.cash.months.at(-1)?.month).toBe('2027-01');
  });
});
