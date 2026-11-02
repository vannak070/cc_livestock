'use client';

import { planDays } from '@/lib/plan-months';
import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProposalPlanRecord } from '@/types';
import { calculatePlan } from '@/lib/proposal-plan';
import { planLoanInputs } from '@/lib/plan-loan';
import { simulateLoan } from '@/lib/farm-loan';
import { useText } from '@/hooks/useText';

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

type Calc = ReturnType<typeof calculatePlan> & { loan: { payout: number; interestY1: number; ownMoney: number } };

interface Metric {
  label: string;
  /** Rows are grouped under a heading: result, bank loan, the plan's numbers. */
  group: 'result' | 'loan' | 'numbers';
  value: (r: Calc, p: ProposalPlanRecord['params']) => number;
  show: (n: number) => string;
  /** The row's best value is marked: the highest, or the lowest when "lowest". */
  best?: 'highest' | 'lowest';
}

// Labels are planning.<label>.
const METRICS: Metric[] = [
  { label: 'mProfitYear', group: 'result', value: r => r.annualProfitKhr, show: riel, best: 'highest' },
  { label: 'mProfitAnimal', group: 'result', value: r => r.profitPerHeadKhr, show: riel, best: 'highest' },
  { label: 'mReturn', group: 'result', value: r => r.annualRoiPercent, show: pct, best: 'highest' },
  { label: 'mStart', group: 'result', value: r => r.initialCattlePurchaseKhr, show: riel, best: 'lowest' },
  { label: 'mLoan', group: 'loan', value: r => r.loan.payout, show: riel },
  { label: 'mInterestY1', group: 'loan', value: r => r.loan.interestY1, show: riel, best: 'lowest' },
  { label: 'mOwnMoney', group: 'loan', value: r => r.loan.ownMoney, show: riel, best: 'lowest' },
  { label: 'mKept', group: 'numbers', value: (_, p) => p.targetStockLevel, show: n => n.toLocaleString() },
  { label: 'mDays', group: 'numbers', value: (_, p) => planDays(p), show: n => String(n) },
  { label: 'mWeightSold', group: 'numbers', value: r => r.finalWeightKgPerHead, show: n => `${Math.round(n)} kg` },
  { label: 'mGain', group: 'numbers', value: (_, p) => p.dailyWeightGainKg, show: n => `${Math.round(n * 100) / 100} kg` },
  { label: 'mBuyKg', group: 'numbers', value: (_, p) => p.purchasePricePerKgKhr, show: riel },
  { label: 'mSellKg', group: 'numbers', value: (_, p) => p.sellingPricePerKgKhr, show: riel },
  { label: 'mFeedOne', group: 'numbers', value: r => r.perHeadFeedCostKhr, show: riel },
  { label: 'mInterest', group: 'numbers', value: (_, p) => p.bankInterestRateAnnual, show: n => String(n) },
];

/** The most plans put side by side at first; the person can choose any of them. */
const FIRST_PICK = 3;

/** Saved plans side by side: the person chooses which ones, the best plan in each money row is marked. */
export default function PlanComparison({ plans }: { plans: ProposalPlanRecord[] }) {
  const { tx } = useText('planning');
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const chosen = useMemo(() => picked ?? new Set(plans.slice(0, FIRST_PICK).map(p => p.slot)), [picked, plans]);
  const toggle = (slot: number) => setPicked(() => { const next = new Set(chosen); if (next.has(slot)) next.delete(slot); else next.add(slot); return next; });

  const all = useMemo(() => plans.map(p => {
    const { terms, assumptions } = planLoanInputs(p.params);
    const sim = simulateLoan(terms, assumptions);
    return { plan: p, r: { ...calculatePlan(p.params), loan: { payout: sim.months[0]?.drawKhr ?? 0, interestY1: sim.years[0]?.interestKhr ?? 0, ownMoney: sim.moneyNeededKhr } } as Calc };
  }), [plans]);
  const results = all.filter(x => chosen.has(x.plan.slot));

  if (plans.length < 2) {
    return <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('needTwo')}</p>;
  }

  const topProfit = results.length > 1 ? results.reduce((a, b) => (b.r.annualProfitKhr > a.r.annualProfitKhr ? b : a)) : null;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold text-ink">{tx('compareChoose')} <span className="text-base font-normal text-ink-muted">({tx('compareChosen', { n: results.length, total: plans.length })})</span></legend>
        <div className="flex flex-wrap items-center gap-2">
          {all.map(({ plan }) => {
            const on = chosen.has(plan.slot);
            return (
              <button key={plan.slot} type="button" aria-pressed={on} onClick={() => toggle(plan.slot)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 text-base font-medium transition-colors ${on ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-ink hover:border-emerald-600'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded border ${on ? 'border-white bg-white text-emerald-700' : 'border-slate-300'}`} aria-hidden>{on && <Check className="h-4 w-4" />}</span>
                <span className="text-sm opacity-80">{tx('planN', { n: plan.slot })}</span>
                <span className="max-w-48 truncate">{plan.name}</span>
              </button>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => setPicked(new Set(plans.map(p => p.slot)))} disabled={chosen.size === plans.length}>{tx('compareAll')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())} disabled={chosen.size === 0}>{tx('compareNone')}</Button>
        </div>
      </fieldset>

      {results.length < 2 ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('pickTwo')}</p>
      ) : (
        <>
          <p className="text-base text-ink-muted">
            {topProfit && <span className="mr-2 font-medium text-emerald-800">{tx('topProfit', { name: topProfit.plan.name, amount: riel(topProfit.r.annualProfitKhr) })}</span>}
            {tx('bestMarked')}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-max border-collapse text-left">
              <caption className="sr-only">{tx('compareCaption')}</caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-3 text-base font-medium text-ink-muted"> </th>
                  {results.map(({ plan }) => (
                    <th key={plan.slot} scope="col" className="px-4 py-3 text-lg font-semibold text-ink">
                      <span className="block text-sm font-normal text-ink-muted">{tx('planN', { n: plan.slot })}</span>
                      <span className="block max-w-40 break-words">{plan.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m, idx) => {
                  const values = results.map(({ r, plan }) => m.value(r, plan.params));
                  const best = m.best === 'highest' ? Math.max(...values) : m.best === 'lowest' ? Math.min(...values) : null;
                  const firstOfGroup = idx === 0 || METRICS[idx - 1].group !== m.group;
                  return (
                    <React.Fragment key={m.label}>
                      {firstOfGroup && (
                        <tr className="bg-slate-50">
                          <th scope="colgroup" colSpan={results.length + 1} className="sticky left-0 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">{tx(`group_${m.group}`)}</th>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100 last:border-0">
                        <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-base font-normal text-ink-muted">{tx(m.label)}</th>
                        {values.map((v, i) => {
                          const isBest = best !== null && v === best && new Set(values).size > 1;
                          const bad = (m.best === 'highest' && v < 0) || (m.label === 'mOwnMoney' && v > 0);
                          return (
                            <td key={results[i].plan.slot} className={`whitespace-nowrap px-4 py-3 text-lg ${isBest ? 'font-semibold text-emerald-800' : 'text-ink'} ${bad ? 'text-rose-700' : ''}`}>
                              {m.label === 'mInterest' ? tx('pctYear', { n: m.show(v) }) : m.show(v)}{isBest && <span aria-label={tx('best')}> ★</span>}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
