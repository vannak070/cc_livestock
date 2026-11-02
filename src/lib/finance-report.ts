/**
 * The financing and cash blocks of the Management report (the ARDB financing and cash position groups of the CAmCOW
 * control dashboard), worked out from the farms' money statements (src/lib/trade-ledger.ts). Pure and browser-safe.
 *
 * It is a RECORD of what the plan says each farm owes the bank and trades with CC Livestock: nothing is "paid" in the system
 * (money moves outside it), so the words here are "scheduled", "due" and "outstanding", never "paid".
 */
import { companyLedger, type CompanyMonth, type FarmLedger } from './trade-ledger';

export interface LoanFarmRow {
  farm: string;
  /** Loan drawn (paid out by the bank to the farm). */
  drawn: number;
  /** Owed to the bank at the end of the current month (0 before the loan starts or after it is repaid). */
  outstanding: number;
  /** Interest due each month while the loan runs. */
  interestMonthly: number;
  /** Interest due from the loan start to the end of the current month. */
  interestToDate: number;
  /** The month the principal is repaid (YYYY-MM), or '' when the plan has none. */
  principalMonth: string;
  principal: number;
}

export interface FinanceBlock {
  /** The month everything is worked out for (YYYY-MM). */
  month: string;
  loan: {
    drawn: number;
    outstanding: number;
    interestMonthly: number;
    interestToDate: number;
    /** Principal falling due in the next 90 days. */
    principalNext90: number;
    /** Principal still to be repaid over the loan year. */
    principalRemaining: number;
    farms: LoanFarmRow[];
  };
  cash: {
    thisMonth: CompanyMonth | null;
    /** The six months to now and the next three, for the chart and table. */
    months: CompanyMonth[];
  };
}

const addMonthsKey = (month: string, n: number) => {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

export function buildFinance(ledgers: FarmLedger[], today: string): FinanceBlock {
  const month = today.slice(0, 7);
  const in90 = addMonthsKey(month, 3);
  const farms: LoanFarmRow[] = ledgers.map(l => {
    const upTo = l.rows.filter(r => r.month <= month);
    const current = l.rows.find(r => r.month === month);
    const repay = l.rows.find(r => r.principal > 0);
    return {
      farm: l.farm,
      drawn: l.rows.filter(r => r.month <= month).reduce((s, r) => s + r.draw, 0),
      outstanding: current ? current.balance : 0,
      interestMonthly: current?.interest ?? l.rows[0]?.interest ?? 0,
      interestToDate: upTo.reduce((s, r) => s + r.interest, 0),
      principalMonth: repay?.month ?? '',
      principal: repay?.principal ?? 0,
    };
  }).sort((a, b) => a.farm.localeCompare(b.farm));
  const sum = (pick: (r: LoanFarmRow) => number) => farms.reduce((s, r) => s + pick(r), 0);
  const all = ledgers.flatMap(l => l.rows);
  const company = companyLedger(ledgers);
  return {
    month,
    loan: {
      drawn: sum(r => r.drawn),
      outstanding: sum(r => r.outstanding),
      interestMonthly: sum(r => r.interestMonthly),
      interestToDate: sum(r => r.interestToDate),
      principalNext90: all.filter(r => r.month > month && r.month <= in90).reduce((s, r) => s + r.principal, 0),
      principalRemaining: all.filter(r => r.month > month).reduce((s, r) => s + r.principal, 0),
      farms,
    },
    cash: {
      thisMonth: company.find(c => c.month === month) ?? null,
      months: company.filter(c => c.month >= addMonthsKey(month, -5) && c.month <= addMonthsKey(month, 3)),
    },
  };
}
