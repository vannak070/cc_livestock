/**
 * The money record of a farm's trade with CC Livestock (user, 2026-10-15). It only RECORDS amounts: money moves outside
 * the system and the accountant does that, so nothing here is "paid" or "unpaid". Pure and browser-safe.
 *
 * Per month, for the 12 months of a farm's loan year starting at its program start:
 *  - the farm buys cattle from CC Livestock (what the program planned, and what the records show was registered);
 *  - CC Livestock buys the finished cattle back the same day (planned, and what the sales show);
 *  - the net of the two: positive = CC Livestock pays the farm, negative = the farm pays CC Livestock;
 *  - the farm's bank payments for the plan's loan: interest every month, the principal in the repayment month.
 * Feed is not part of the plan, so it is not in these figures.
 */
import { planLoanInputs } from './plan-loan';
import { simulateLoan } from './farm-loan';
import { cycleMonths, type Task } from './ops-program';
import type { ProposalPlanParams } from '../types/proposal.types';
import type { SalesRecord, StockItem } from './xlsx-parser';
import { farmToday } from './daily-feed';

export interface LedgerProgram {
  id: string;
  farm: string;
  startDate: string;
  headPerCycle: number;
  plan: ProposalPlanParams;
  purchasePricePerKg?: number;
  buybackPricePerKg?: number;
}

export interface LedgerMonth {
  /** YYYY-MM */
  month: string;
  /** Cattle the farm buys from CC Livestock: planned head and money, and what the records show. */
  headBought: number;
  boughtPlanned: number;
  boughtRecorded: number;
  /** Cattle CC Livestock buys back, and the money. */
  headSold: number;
  soldPlanned: number;
  soldRecorded: number;
  /** soldAmount - boughtAmount, from the records once the month's swap day has passed, else from the plan. */
  net: number;
  /** True when `net` comes from the records. */
  netRecorded: boolean;
  /** What the bank pays out to the farm this month (the loan is drawn once, in the first month). */
  draw: number;
  /** The farm's payments to the bank this month. */
  interest: number;
  principal: number;
  /** What the farm still owes the bank at the end of the month. */
  balance: number;
}

export interface FarmLedger {
  farm: string;
  rows: LedgerMonth[];
  totals: { bought: number; sold: number; net: number; interest: number; principal: number };
}

const monthOf = (day: string | null | undefined) => (day ? farmToday(new Date(day)).slice(0, 7) : '');

/** The loan schedule the plan's bank terms give this farm, anchored at its start month, for cattle only (feed is not in the plan). */
function bankRows(p: LedgerProgram) {
  const { terms, assumptions } = planLoanInputs({ ...p.plan, loan: { ...(p.plan.loan ?? {}), startMonth: p.startDate.slice(0, 7) } as ProposalPlanParams['loan'] });
  const F = cycleMonths(p.plan);
  const a = {
    ...assumptions, herdTarget: p.headPerCycle * F, feedLines: [], feedCostPerHeadDayKhr: 0,
    buyPricePerKgKhr: p.purchasePricePerKg ?? assumptions.buyPricePerKgKhr, sellPricePerKgKhr: p.buybackPricePerKg ?? assumptions.sellPricePerKgKhr,
  };
  return simulateLoan(terms, a).months;
}

/** One farm's statement: tasks give the plan, stock and sales give what was recorded. */
export function farmLedger(program: LedgerProgram, tasks: Pick<Task, 'programId' | 'kind' | 'dueDate' | 'plannedHead' | 'plannedValue' | 'manualState'>[], stock: StockItem[], sales: SalesRecord[], today = farmToday()): FarmLedger {
  const mine = tasks.filter(t => t.programId === program.id && t.manualState !== 'cancelled');
  const ids = new Set(stock.filter(c => c.location === program.farm).map(c => c.id));
  const bought = new Map<string, number>();
  for (const c of stock) if (c.location === program.farm) { const m = monthOf(c.purchaseDate); if (m) bought.set(m, (bought.get(m) ?? 0) + (c.totalPrice || 0)); }
  const sold = new Map<string, number>();
  for (const s of sales) if (ids.has(s.cowId)) { const m = monthOf(s.salesDate); if (m) sold.set(m, (sold.get(m) ?? 0) + (s.totalPrice || 0)); }
  const bank = new Map(bankRows(program).map(m => [m.month, m]));

  const rows: LedgerMonth[] = [...bank.keys()].sort().map(month => {
    const inMonth = (kind: Task['kind']) => mine.filter(t => t.kind === kind && t.dueDate.slice(0, 7) === month);
    const sells = inMonth('sell_to_farm');
    const buys = inMonth('buy_back');
    const boughtPlanned = Math.round(sells.reduce((s, t) => s + (t.plannedValue ?? 0), 0));
    const soldPlanned = Math.round(buys.reduce((s, t) => s + (t.plannedValue ?? 0), 0));
    const boughtRecorded = Math.round(bought.get(month) ?? 0);
    const soldRecorded = Math.round(sold.get(month) ?? 0);
    // The records count once the month's swap day has passed; until then (and for later months) the plan is shown.
    const swapDay = `${month}-${program.startDate.slice(8, 10)}`;
    const netRecorded = swapDay < today;
    const b = bank.get(month)!;
    return {
      month,
      headBought: sells.reduce((s, t) => s + (t.plannedHead ?? 0), 0), boughtPlanned, boughtRecorded,
      headSold: buys.reduce((s, t) => s + (t.plannedHead ?? 0), 0), soldPlanned, soldRecorded,
      net: netRecorded ? soldRecorded - boughtRecorded : soldPlanned - boughtPlanned, netRecorded,
      draw: Math.round(b.drawKhr), interest: Math.round(b.interestKhr), principal: Math.round(b.principalKhr), balance: Math.round(b.balanceKhr),
    };
  });
  const sum = (pick: (r: LedgerMonth) => number) => rows.reduce((s, r) => s + pick(r), 0);
  return {
    farm: program.farm, rows,
    totals: {
      bought: sum(r => (r.netRecorded ? r.boughtRecorded : r.boughtPlanned)), sold: sum(r => (r.netRecorded ? r.soldRecorded : r.soldPlanned)),
      net: sum(r => r.net), interest: sum(r => r.interest), principal: sum(r => r.principal),
    },
  };
}

export interface CompanyMonth {
  month: string;
  bought: number;
  sold: number;
  net: number;
  interest: number;
  principal: number;
}

/** All farms added up per month (what CC Livestock sells and buys back, and what the farms pay the bank). */
export function companyLedger(ledgers: FarmLedger[]): CompanyMonth[] {
  const by = new Map<string, CompanyMonth>();
  for (const l of ledgers) {
    for (const r of l.rows) {
      const m = by.get(r.month) ?? { month: r.month, bought: 0, sold: 0, net: 0, interest: 0, principal: 0 };
      m.bought += r.netRecorded ? r.boughtRecorded : r.boughtPlanned;
      m.sold += r.netRecorded ? r.soldRecorded : r.soldPlanned;
      m.net += r.net;
      m.interest += r.interest;
      m.principal += r.principal;
      by.set(r.month, m);
    }
  }
  return [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
}
