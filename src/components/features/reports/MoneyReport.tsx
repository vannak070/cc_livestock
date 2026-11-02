'use client';

import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ERPLivestockData } from '@/lib/types';
import { batchSummary } from '@/lib/batch-stats';
import { monthlyMoney } from '@/lib/report-stats';
import { farmProfit, sumMonths } from '@/lib/farm-costs';
import { useText } from '@/hooks/useText';
import { monthLabel } from '@/lib/khmer-date';
import { BOUGHT, SOLD, Tile, riel, shortMoney, signedRiel } from './parts';

/**
 * Reports → Money: sales, costs and the profit of the farm, month by month. `data` is narrowed to the chosen farm
 * (cattle, batches, sales, health); feed and running costs come from `fullData` and are worked out for that farm.
 */
export default function MoneyReport({ data, fullData, farm }: { data: ERPLivestockData; fullData: ERPLivestockData; farm: string }) {
  const { tx, language } = useText('reportsPage');
  const products = useMemo(() => fullData.feedProducts || [], [fullData.feedProducts]);
  const activeBatches = useMemo(() => data.batches.filter(b => b.status === 'Active'), [data.batches]);
  const feedPerDay = useMemo(
    () => activeBatches.reduce((s, b) => s + batchSummary(b, data.stock, data.weightTracking, products).feedCostPerDay, 0),
    [activeBatches, data.stock, data.weightTracking, products]
  );

  const months = useMemo(() => monthlyMoney(data.stock, data.salesTracking, data.healthLogs), [data.stock, data.salesTracking, data.healthLogs]);
  const last12 = months.slice(-12);
  const totals = useMemo(() => ({
    revenue: data.salesTracking.reduce((s, x) => s + (x.totalPrice || 0), 0),
    sold: data.salesTracking.length,
  }), [data.salesTracking]);

  // Farm profit: sales less what the sold cattle cost to buy and feed, medicine and running costs.
  const farmMoney = useMemo(() => farmProfit({
    stock: fullData.stock, sales: fullData.salesTracking, healthLogs: fullData.healthLogs, feedTransactions: fullData.feedTransactions || [],
    batches: fullData.batches, costs: fullData.farmCosts || [], farm: farm || undefined,
  }), [fullData, farm]);
  const farmMonths = farmMoney.months;
  const farmTotals = useMemo(() => sumMonths(farmMonths), [farmMonths]);
  const farmCosts = farmTotals.cattleCost + farmTotals.medicine + farmTotals.feed + farmTotals.other;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Tile label={tx('sales')} value={riel(totals.revenue)} sub={tx('soldN', { n: totals.sold })} />
        <Tile label={tx('costs')} value={riel(farmCosts)} sub={tx('costsSub')} />
        <Tile label={tx('farmProfit')} value={farmMonths.length ? signedRiel(farmTotals.profit) : '—'} sub={tx('farmProfitSub')} tone={farmMonths.length ? (farmTotals.profit < 0 ? 'bad' : 'good') : undefined} />
        <Tile label={tx('feedInHerd')} value={riel(farmMoney.feedInHerd)} sub={feedPerDay > 0 ? tx('feedInHerdDay', { amount: riel(feedPerDay) }) : tx('feedInHerdSub')} />
      </section>

      {farmMonths.length > 0 && (
        <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
          <h3 className="mb-2 text-lg font-semibold text-ink">{tx('moneyWent')}</h3>
          <ul className="divide-y divide-slate-100">
            {[
              { label: tx('wentCattle'), hint: tx('wentCattleHint'), value: farmTotals.cattleCost },
              { label: tx('wentFeed'), hint: tx('wentFeedHint'), value: farmTotals.feed },
              { label: tx('wentMedicine'), hint: tx('wentMedicineHint'), value: farmTotals.medicine },
              { label: tx('wentRunning'), hint: tx('wentRunningHint'), value: farmTotals.other },
            ].map(r => (
              <li key={r.label} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0"><span className="block text-base text-ink">{r.label}</span><span className="block text-sm text-ink-muted">{r.hint}</span></span>
                <span className="shrink-0 text-base font-medium text-ink">{riel(r.value)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-muted">{tx('feedNote', { amount: riel(farmMoney.feedInHerd) })}</p>
        </section>
      )}

      {last12.length > 0 && (
        <section className="rounded-xl bg-white ring-1 ring-slate-200 p-3 sm:p-4">
          <h3 className="mb-2 text-lg font-semibold text-ink">{tx('boughtSold')}</h3>
          <div className="h-72" role="img" aria-label={tx('chartAria')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last12.map(m => ({ ...m, label: monthLabel(m.month, language) }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                <YAxis width={52} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={shortMoney} />
                <Tooltip formatter={(v, name) => [riel(Number(v)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 14 }} />
                <Bar dataKey="sold" name={tx('sold')} fill={SOLD} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                <Bar dataKey="bought" name={tx('bought')} fill={BOUGHT} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {farmMonths.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('noMonths')}</p>
      ) : (
        <section>
          <h3 className="mb-2 text-lg font-semibold text-ink">{tx('profitMonth')}</h3>
          <ul className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            {[...farmMonths].slice(-12).reverse().map(m => {
              const spent = m.cattleCost + m.medicine + m.feed + m.other;
              return (
                <li key={m.month} className="border-b border-slate-100 px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-ink">{monthLabel(m.month, language)}</p>
                      <p className="text-base text-ink-muted">{tx('monthLine', { sold: riel(m.sales), count: m.soldCount ? ` (${m.soldCount})` : '', costs: riel(spent) })}</p>
                    </div>
                    <p className={`shrink-0 text-base font-medium ${m.profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{m.profit < 0 ? tx('loss') : tx('profit')} {riel(Math.abs(m.profit))}</p>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {[m.cattleCost && tx('partCattle', { amount: riel(m.cattleCost) }), m.feed && tx('partFeed', { amount: riel(m.feed) }), m.medicine && tx('partMedicine', { amount: riel(m.medicine) }), m.other && tx('partRunning', { amount: riel(m.other) })].filter(Boolean).join(' · ')}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
