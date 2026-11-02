import { describe, expect, it } from 'vitest';
import plan2 from '../db/practice/plan2.fixture.json';
import { companyLedger, farmLedger, type LedgerProgram } from './trade-ledger';
import { generateTasks, type Task } from './ops-program';
import type { ProposalPlanParams } from '../types/proposal.types';
import type { SalesRecord, StockItem } from './xlsx-parser';

const plan = { ...(plan2 as unknown as ProposalPlanParams), loan: { bank: 'ARDB', buyPlan: 'monthly', autoRenew: false, loanCovers: 'all', repayments: [{ pct: 100, month: 12 }], startMonth: '2026-10', financedPct: 100, lastBuyMonth: 9, creditLimitKhr: 0, openingCashKhr: 0 } } as ProposalPlanParams;
const program: LedgerProgram = { id: 'P1', farm: 'F', startDate: '2026-03-12', headPerCycle: 20, plan };
const tasks = generateTasks({ farm: 'F', startDate: program.startDate, headPerCycle: 20, plan }, []).tasks.map((t, i) => ({ ...t, id: `T${i}`, programId: 'P1' }) as unknown as Task);
const cow = (id: string, day: string, total: number) => ({ id, location: 'F', purchaseDate: `${day}T03:00:00.000Z`, totalPrice: total }) as unknown as StockItem;
const sale = (cowId: string, day: string, total: number) => ({ cowId, salesDate: `${day}T05:00:00.000Z`, totalPrice: total }) as unknown as SalesRecord;

describe('farm ledger', () => {
  const stock = [cow('A', '2026-03-12', 3_240_000), cow('B', '2026-07-12', 3_240_000)];
  const sales = [sale('A', '2026-07-12', 5_325_000)];
  const l = farmLedger(program, tasks, stock, sales, '2026-10-15');

  it('covers the 12 months of the loan year from the program start', () => {
    expect(l.rows).toHaveLength(12);
    expect(l.rows[0].month).toBe('2026-03');
    expect(l.rows[11].month).toBe('2027-02');
  });

  it('plans 20 head a month at the plan price, and buys back from the fifth cycle', () => {
    expect(l.rows[0]).toMatchObject({ headBought: 20, boughtPlanned: 64_800_000, headSold: 0, soldPlanned: 0 });
    expect(l.rows[4]).toMatchObject({ month: '2026-07', headBought: 20, headSold: 20 });
    expect(l.rows[4].soldPlanned).toBeGreaterThan(100_000_000);
  });

  it('takes the net from the records once the month\'s swap day has passed, and from the plan until then and for later months', () => {
    expect(l.rows[0]).toMatchObject({ boughtRecorded: 3_240_000, netRecorded: true, net: -3_240_000 });
    expect(l.rows[4]).toMatchObject({ boughtRecorded: 3_240_000, soldRecorded: 5_325_000, net: 2_085_000 });
    expect(l.rows[7]).toMatchObject({ month: '2026-10', netRecorded: true }); // swapped on 12 Oct
    expect(farmLedger(program, tasks, stock, sales, '2026-10-12').rows[7].netRecorded).toBe(false); // the swap day itself is still to be recorded
    expect(l.rows[8]).toMatchObject({ month: '2026-11', netRecorded: false, net: l.rows[8].soldPlanned - l.rows[8].boughtPlanned });
  });

  it("gives the bank's interest every month and the principal once, in the repayment month", () => {
    expect(l.rows.every(r => r.interest > 0)).toBe(true);
    expect(l.rows.filter(r => r.principal > 0)).toHaveLength(1);
    expect(l.rows[11].principal).toBeGreaterThan(200_000_000);
    expect(l.rows[11].balance).toBe(0);
    expect(l.rows[0].balance).toBeGreaterThan(0);
  });

  it('adds farms up per month', () => {
    const c = companyLedger([l, l]);
    expect(c).toHaveLength(12);
    expect(c[0].bought).toBe(2 * l.rows[0].boughtRecorded);
    expect(c[0].interest).toBe(2 * l.rows[0].interest);
  });
});
