'use client';

import React, { useMemo } from 'react';
import type { ProposalPlanRecord } from '@/types';
import { calculatePlan } from '@/lib/proposal-plan';

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

interface Metric {
  label: string;
  value: (r: ReturnType<typeof calculatePlan>, p: ProposalPlanRecord['params']) => number;
  show: (n: number) => string;
  /** The row's best value is marked: the highest, or the lowest when "lowest". */
  best?: 'highest' | 'lowest';
}

const METRICS: Metric[] = [
  { label: 'Profit each year', value: r => r.annualProfitKhr, show: riel, best: 'highest' },
  { label: 'Profit each animal', value: r => r.profitPerHeadKhr, show: riel, best: 'highest' },
  { label: 'Return each year', value: r => r.annualRoiPercent, show: pct, best: 'highest' },
  { label: 'Money to start', value: r => r.initialCattlePurchaseKhr, show: riel, best: 'lowest' },
  { label: 'Cattle kept', value: (_, p) => p.targetStockLevel, show: n => n.toLocaleString() },
  { label: 'Days fattening', value: (_, p) => p.fatteningPeriodDays, show: n => String(n) },
  { label: 'Weight when sold', value: r => r.finalWeightKgPerHead, show: n => `${Math.round(n)} kg` },
  { label: 'Daily gain', value: (_, p) => p.dailyWeightGainKg, show: n => `${Math.round(n * 100) / 100} kg` },
  { label: 'Buy price a kg', value: (_, p) => p.purchasePricePerKgKhr, show: riel },
  { label: 'Sell price a kg', value: (_, p) => p.sellingPricePerKgKhr, show: riel },
  { label: 'Feed for one animal', value: r => r.perHeadFeedCostKhr, show: riel },
  { label: 'Bank interest', value: (_, p) => p.bankInterestRateAnnual, show: n => `${n}% a year` },
];

/** Every saved plan side by side, with the best plan in each money row marked. */
export default function PlanComparison({ plans }: { plans: ProposalPlanRecord[] }) {
  const results = useMemo(() => plans.map(p => ({ plan: p, r: calculatePlan(p.params) })), [plans]);

  if (plans.length < 2) {
    return <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Save at least two plans to compare them side by side.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-base text-ink-muted">The best plan in each money row is marked with a ★.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-max border-collapse text-left">
          <caption className="sr-only">Saved plans compared</caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-3 text-base font-medium text-ink-muted"> </th>
              {results.map(({ plan }) => (
                <th key={plan.slot} scope="col" className="px-4 py-3 text-lg font-semibold text-ink">
                  <span className="block text-sm font-normal text-ink-muted">Plan {plan.slot}</span>
                  <span className="block max-w-40 break-words">{plan.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(m => {
              const values = results.map(({ r, plan }) => m.value(r, plan.params));
              const best = m.best === 'highest' ? Math.max(...values) : m.best === 'lowest' ? Math.min(...values) : null;
              return (
                <tr key={m.label} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-base font-normal text-ink-muted">{m.label}</th>
                  {values.map((v, i) => {
                    const isBest = best !== null && v === best && new Set(values).size > 1;
                    const bad = m.best === 'highest' && v < 0;
                    return (
                      <td key={results[i].plan.slot} className={`whitespace-nowrap px-4 py-3 text-lg ${isBest ? 'font-semibold text-emerald-800' : 'text-ink'} ${bad ? 'text-rose-700' : ''}`}>
                        {m.show(v)}{isBest && <span aria-label="best"> ★</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
