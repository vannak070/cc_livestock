'use client';

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { FarmItem, FarmLoanRecord } from '@/lib/types';
import { simulateLoan } from '@/lib/farm-loan';

interface FarmLoansPanelProps {
  farms: FarmItem[];
  loans: FarmLoanRecord[];
  onOpen: (farm: FarmItem) => void;
}

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Every farm, with its loan plan's answer: can it pay, and how much of its own money it needs. */
export default function FarmLoansPanel({ farms, loans, onOpen }: FarmLoansPanelProps) {
  const byFarm = useMemo(() => new Map(loans.map(l => [l.farmLocation, l])), [loans]);
  if (farms.length === 0) return <p className="rounded-2xl bg-slate-50 p-8 text-center text-lg text-ink-muted">Add a farm on the Farms page first.</p>;
  return (
    <div className="space-y-3">
      <p className="text-base text-ink-muted">Each farm borrows from the bank to buy cattle and repays 20% in month 8, 30% in month 11 and 50% in month 12, when CC Livestock buys the cattle back and pays the bank first. Open a farm to plan its loan for 24 months.</p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {farms.map(f => {
          const loan = byFarm.get(f.name);
          const plan = loan ? simulateLoan(loan.terms, loan.assumptions) : null;
          return (
            <li key={f.id}>
              <button type="button" onClick={() => onOpen(f)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                <span className="min-w-0">
                  <span className="block break-words text-xl font-semibold text-ink">{f.name}</span>
                  {loan && plan ? (
                    <>
                      <span className="block text-base text-ink-muted">{[loan.terms.bank || 'Bank not set', `from ${monthLabel(loan.terms.startMonth)}`, `${loan.terms.annualRatePct}% a year`].join(' · ')}</span>
                      <span className="block text-base text-ink">Loan year 1: {riel(plan.years[0]?.drawnKhr ?? 0)}</span>
                      <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-sm font-medium ${plan.moneyNeededKhr > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {plan.moneyNeededKhr > 0 ? `Needs ${riel(plan.moneyNeededKhr)} of its own money` : 'Covers every repayment'}
                      </span>
                    </>
                  ) : (
                    <span className="block text-base text-ink-muted">No loan plan yet{f.capacity ? ` · room for ${f.capacity} cattle` : ''}</span>
                  )}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
