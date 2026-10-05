'use client';

import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight } from 'lucide-react';
import type { ERPLivestockData } from '@/lib/types';
import type { ActiveTabType } from '../../layout/SidebarLayout';
import { batchesNearSelling, feedStockLevels, sickCattle, weighSchedules } from '@/lib/attention';
import { batchSummary } from '@/lib/batch-stats';
import { monthlyMoney } from '@/lib/report-stats';

interface SummaryPageProps {
  data: ERPLivestockData;
  onNavigateToTab: (tab: ActiveTabType) => void;
}

const SOLD = '#0E7A38';
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'warn'; onClick?: () => void }) {
  const style = tone === 'bad' ? 'border-rose-300 bg-rose-50' : tone === 'warn' ? 'border-amber-300 bg-amber-50' : tone === 'good' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white';
  const inner = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </>
  );
  const cls = `block w-full rounded-2xl border p-3 text-left sm:p-4 ${style}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export default function SummaryPage({ data, onNavigateToTab }: SummaryPageProps) {
  const active = useMemo(() => data.stock.filter(c => norm(c.status) === 'active'), [data.stock]);
  const soldCount = data.stock.filter(c => norm(c.status) === 'sold').length;
  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);

  const money = useMemo(() => {
    const rows = monthlyMoney(data.stock, data.salesTracking, data.healthLogs);
    return { rows, revenue: rows.reduce((s, r) => s + r.sold, 0), profit: rows.reduce((s, r) => s + r.profit, 0), sales: rows.reduce((s, r) => s + r.soldCount, 0) };
  }, [data.stock, data.salesTracking, data.healthLogs]);
  const months = money.rows.filter(r => r.sold > 0).slice(-6);

  const sick = sickCattle(active);
  const dueToWeigh = weighSchedules(data).filter(s => s.status !== 'weighed');
  const levels = feedStockLevels(data);
  const lowFeed = levels.filter(l => l.isLow);
  const tightest = levels.filter(l => l.daysLeft !== null).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
  const nearSelling = batchesNearSelling(data);

  const activeBatches = data.batches.filter(b => b.status === 'Active');
  const nextSale = useMemo(() => {
    const list = activeBatches
      .map(b => ({ b, s: batchSummary(b, data.stock, data.weightTracking, products) }))
      .filter(x => x.s.daysToTarget !== null)
      .sort((a, c) => (a.s.daysToTarget as number) - (c.s.daysToTarget as number));
    return list[0];
  }, [activeBatches, data.stock, data.weightTracking, products]);

  const needs: { key: string; text: string; sub?: string; tab: ActiveTabType; tone: 'bad' | 'warn' }[] = [
    sick.length > 0 && { key: 'sick', text: `${plural(sick.length, 'animal is', 'animals are')} sick`, sub: 'Open Health to treat them', tab: 'health-tracking' as const, tone: 'bad' as const },
    lowFeed.length > 0 && { key: 'feed', text: `${lowFeed[0].productName}${lowFeed.length > 1 ? ` and ${lowFeed.length - 1} more` : ''} running low`, sub: 'Order or record a delivery under Feed', tab: 'feed-inventory' as const, tone: 'warn' as const },
    nearSelling.length > 0 && { key: 'sell', text: `${plural(nearSelling.length, 'batch is', 'batches are')} near the sell date`, sub: nearSelling[0].daysRemaining < 0 ? `${nearSelling[0].batchName} is ${-nearSelling[0].daysRemaining} days past it` : `${nearSelling[0].batchName} in ${nearSelling[0].daysRemaining} days`, tab: 'batch-management' as const, tone: 'warn' as const },
    dueToWeigh.length > 0 && { key: 'weigh', text: `${plural(dueToWeigh.length, 'animal is', 'animals are')} due for weighing`, sub: 'Open Weights', tab: 'weight-tracking' as const, tone: 'warn' as const },
  ].filter(Boolean) as { key: string; text: string; sub?: string; tab: ActiveTabType; tone: 'bad' | 'warn' }[];

  const recentSales = [...data.salesTracking].sort((a, b) => (b.salesDate ?? '').localeCompare(a.salesDate ?? '')).slice(0, 5);
  const recentCattle = [...data.stock].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '')).slice(0, 5);

  const feedTone = tightest ? (tightest.daysLeft! < 7 ? 'bad' : tightest.daysLeft! < 14 ? 'warn' : undefined) : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Summary</h2>
        <p className="text-base text-ink-muted">The farm at a glance. Tap any box to open it.</p>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label="Cattle on the farm" value={String(active.length)} sub={`${soldCount} sold so far`} onClick={() => onNavigateToTab('cow-inventory')} />
        <Tile label="Profit" value={money.sales ? `${money.profit < 0 ? '−' : ''}${riel(Math.abs(money.profit))}` : '—'} sub={money.sales ? `from ${money.sales} sold` : 'No sales yet'} tone={money.sales ? (money.profit < 0 ? 'bad' : 'good') : undefined} onClick={() => onNavigateToTab('sales-finance')} />
        <Tile label="Feed lasts about" value={tightest ? `${tightest.daysLeft} days` : '—'} sub={tightest ? `then ${tightest.productName} runs out` : 'No feeding program'} tone={feedTone} onClick={() => onNavigateToTab('feed-inventory')} />
        <Tile
          label="Next sale"
          value={nextSale ? (nextSale.s.daysToTarget! < 0 ? `${-nextSale.s.daysToTarget!} days late` : nextSale.s.daysToTarget === 0 ? 'Today' : `${nextSale.s.daysToTarget} days`) : '—'}
          sub={nextSale ? nextSale.b.name : `${plural(activeBatches.length, 'active batch', 'active batches')}`}
          tone={nextSale && nextSale.s.daysToTarget! < 0 ? 'warn' : undefined}
          onClick={() => onNavigateToTab('batch-management')}
        />
      </section>

      <section aria-label="Needs attention" className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">Needs attention</h3>
        {needs.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 p-5 text-lg text-emerald-900">Nothing needs attention right now.</p>
        ) : (
          <ul className="space-y-2">
            {needs.map(n => (
              <li key={n.key}>
                <button type="button" onClick={() => onNavigateToTab(n.tab)} className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left hover:border-emerald-600 ${n.tone === 'bad' ? 'border-rose-300' : 'border-amber-300'}`}>
                  <span>
                    <span className="block text-lg font-semibold text-ink">{n.text}</span>
                    {n.sub && <span className="block text-base text-ink-muted">{n.sub}</span>}
                  </span>
                  <ChevronRight className="h-6 w-6 shrink-0 text-ink-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <h3 className="mb-2 text-lg font-semibold text-ink">Sales each month</h3>
        {months.length === 0 ? (
          <p className="py-8 text-center text-base text-ink-muted">No sales yet.</p>
        ) : (
          <>
            <div className="h-56" role="img" aria-label="Sales each month; the same numbers are listed below the chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                  <YAxis width={52} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : `${Math.round(v / 1000)}k`)} />
                  <Tooltip formatter={(v) => [riel(Number(v)), 'Sold']} />
                  <Bar dataKey="sold" name="Sold" fill={SOLD} radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {[...months].reverse().map(m => (
                <li key={m.month} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-base font-medium text-ink">{m.label}</span>
                  <span className="text-base text-ink">{riel(m.sold)} <span className="text-ink-muted">({m.soldCount} sold)</span></span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">Latest sales</h3>
            <button type="button" onClick={() => onNavigateToTab('sales-finance')} className="min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">See all</button>
          </div>
          {recentSales.length === 0 ? <p className="text-base text-ink-muted">No sales yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {recentSales.map(s => (
                <li key={s.cowId} className="flex items-center justify-between gap-3 py-2.5">
                  <div><p className="text-lg font-semibold text-ink">{s.cowId}</p><p className="text-base text-ink-muted">{day(s.salesDate)}{s.buyer ? ` · ${s.buyer}` : ''}</p></div>
                  <p className="shrink-0 text-lg font-semibold text-emerald-800">{riel(s.totalPrice)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">Latest cattle added</h3>
            <button type="button" onClick={() => onNavigateToTab('cow-inventory')} className="min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">See all</button>
          </div>
          {recentCattle.length === 0 ? <p className="text-base text-ink-muted">No cattle yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {recentCattle.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div><p className="text-lg font-semibold text-ink">{c.id}</p><p className="text-base text-ink-muted">{[c.sex, c.breed, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(' · ')}</p></div>
                  <p className="shrink-0 text-base text-ink-muted">{day(c.purchaseDate)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
