'use client';

import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight } from 'lucide-react';
import type { ERPLivestockData } from '@/lib/types';
import type { ActiveTabType } from '../../layout/SidebarLayout';
import { batchesNearSelling, feedStockLevels, sickCattle, weighSchedules } from '@/lib/attention';
import { saleWindowDays } from '@/lib/sale-review';
import { farmToday, farmsToRecord, missedFeedDays } from '@/lib/daily-feed';
import { batchSummary } from '@/lib/batch-stats';
import { monthlyMoney } from '@/lib/report-stats';
import { farmProfit as computeFarmProfit, sumMonths } from '@/lib/farm-costs';
import { useText, useValueText } from '@/hooks/useText';
import { monthLabel, shownDay } from '@/lib/khmer-date';

interface SummaryPageProps {
  data: ERPLivestockData;
  onNavigateToTab: (tab: ActiveTabType) => void;
  /** Opens the Batches page on the sale review. */
  onOpenSaleReview?: () => void;
  /** Whether the profit box can open Reports (which has the breakdown); otherwise it opens Sales. */
  canSeeReports?: boolean;
}

const SOLD = '#0E7A38';
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

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

export default function SummaryPage({ data, onNavigateToTab, onOpenSaleReview, canSeeReports }: SummaryPageProps) {
  const { tx, txn, language } = useText('summaryPage');
  const val = useValueText();
  const day = (d: string | null | undefined) => shownDay(d, language);
  const active = useMemo(() => data.stock.filter(c => norm(c.status) === 'active'), [data.stock]);
  const soldCount = data.stock.filter(c => norm(c.status) === 'sold').length;
  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);

  const money = useMemo(() => {
    const rows = monthlyMoney(data.stock, data.salesTracking, data.healthLogs);
    return { rows, revenue: rows.reduce((s, r) => s + r.sold, 0), profit: rows.reduce((s, r) => s + r.profit, 0), sales: rows.reduce((s, r) => s + r.soldCount, 0) };
  }, [data.stock, data.salesTracking, data.healthLogs]);
  const months = money.rows.filter(r => r.sold > 0).slice(-6);
  // Farm profit: sales less what the sold cattle cost to buy and feed, medicine and running costs.
  const farmProfit = useMemo(() => {
    const { months: rows } = computeFarmProfit({
      stock: data.stock,
      sales: data.salesTracking,
      healthLogs: data.healthLogs,
      feedTransactions: data.feedTransactions || [],
      batches: data.batches,
      costs: data.farmCosts || [],
    });
    return rows.length ? sumMonths(rows).profit : null;
  }, [data.stock, data.salesTracking, data.healthLogs, data.feedTransactions, data.batches, data.farmCosts]);

  const sick = sickCattle(active);
  const dueToWeigh = weighSchedules(data).filter(s => s.status !== 'weighed');
  const levels = feedStockLevels(data);
  const lowFeed = levels.filter(l => l.isLow);
  const tightest = levels.filter(l => l.daysLeft !== null).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
  const nearSelling = batchesNearSelling(data, saleWindowDays(data.settings));
  const overdueSelling = nearSelling.filter(b => b.daysRemaining < 0).length;

  const activeBatches = data.batches.filter(b => b.status === 'Active');
  const nextSale = useMemo(() => {
    const list = activeBatches
      .map(b => ({ b, s: batchSummary(b, data.stock, data.weightTracking, products) }))
      .filter(x => x.s.daysToTarget !== null)
      .sort((a, c) => (a.s.daysToTarget as number) - (c.s.daysToTarget as number));
    return list[0];
  }, [activeBatches, data.stock, data.weightTracking, products]);

  // Feed only leaves stock when a farm records the day, so missed days are the owner's first worry.
  const feedToday = farmToday();
  const missedFeed = farmsToRecord(data.batches)
    .map(farm => ({ farm, days: missedFeedDays(farm, data.batches, data.stock, products, data.feedTransactions || [], feedToday) }))
    .filter(m => m.days.length > 0);

  const needs: { key: string; text: string; sub?: string; tab: ActiveTabType; tone: 'bad' | 'warn'; onOpen?: () => void }[] = [
    missedFeed.length > 0 && { key: 'feed-missed', text: tx('feedMissed', { list: missedFeed.map(m => tx('feedMissedFarm', { farm: m.farm, days: txn(m.days.length, 'dayOne', 'dayMany') })).join(', ') }), sub: tx('feedMissedSub'), tab: 'feed-inventory' as const, tone: 'bad' as const },
    sick.length > 0 && { key: 'sick', text: txn(sick.length, 'sickOne', 'sickMany'), sub: tx('sickSub'), tab: 'health-tracking' as const, tone: 'bad' as const },
    lowFeed.length > 0 && { key: 'feed', text: lowFeed.length > 1 ? tx('lowFeedMore', { name: lowFeed[0].productName, n: lowFeed.length - 1 }) : tx('lowFeed', { name: lowFeed[0].productName }), sub: tx('lowFeedSub'), tab: 'feed-inventory' as const, tone: 'warn' as const },
    nearSelling.length > 0 && { key: 'sell', text: txn(nearSelling.length, 'sellOne', 'sellMany'), sub: `${overdueSelling > 0 ? tx('sellPast', { n: overdueSelling }) : ''}${nearSelling[0].daysRemaining < 0 ? tx('sellLate', { name: nearSelling[0].batchName, n: -nearSelling[0].daysRemaining }) : tx('sellIn', { name: nearSelling[0].batchName, n: nearSelling[0].daysRemaining })}`, tab: 'batch-management' as const, tone: overdueSelling > 0 ? 'bad' as const : 'warn' as const, onOpen: onOpenSaleReview },
    dueToWeigh.length > 0 && { key: 'weigh', text: txn(dueToWeigh.length, 'weighOne', 'weighMany'), sub: tx('weighSub'), tab: 'weight-tracking' as const, tone: 'warn' as const },
  ].filter(Boolean) as { key: string; text: string; sub?: string; tab: ActiveTabType; tone: 'bad' | 'warn'; onOpen?: () => void }[];

  const recentSales = [...data.salesTracking].sort((a, b) => (b.salesDate ?? '').localeCompare(a.salesDate ?? '')).slice(0, 5);
  const recentCattle = [...data.stock].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '')).slice(0, 5);

  const feedTone = tightest ? (tightest.daysLeft! < 7 ? 'bad' : tightest.daysLeft! < 14 ? 'warn' : undefined) : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div>
        <h2 className="text-2xl font-semibold text-ink">{tx('title')}</h2>
        <p className="text-base text-ink-muted">{tx('intro')}</p>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label={tx('tileCattle')} value={String(active.length)} sub={tx('soldSoFar', { n: soldCount })} onClick={() => onNavigateToTab('cow-inventory')} />
        <Tile label={tx('tileProfit')} value={farmProfit !== null ? `${farmProfit < 0 ? '−' : ''}${riel(Math.abs(farmProfit))}` : '—'} sub={farmProfit !== null ? tx('profitSub', { n: money.sales }) : tx('nothingYet')} tone={farmProfit !== null ? (farmProfit < 0 ? 'bad' : 'good') : undefined} onClick={() => onNavigateToTab(canSeeReports ? 'analytics' : 'sales-finance')} />
        <Tile label={tx('tileFeed')} value={tightest ? tx('daysN', { n: tightest.daysLeft ?? 0 }) : '—'} sub={tightest ? tx('runsOut', { name: tightest.productName }) : tx('noProgram')} tone={feedTone} onClick={() => onNavigateToTab('feed-inventory')} />
        <Tile
          label={tx('tileNextSale')}
          value={nextSale ? (nextSale.s.daysToTarget! < 0 ? tx('daysLate', { n: -nextSale.s.daysToTarget! }) : nextSale.s.daysToTarget === 0 ? tx('today') : tx('daysN', { n: nextSale.s.daysToTarget! })) : '—'}
          sub={nextSale ? nextSale.b.name : txn(activeBatches.length, 'activeBatchOne', 'activeBatchMany')}
          tone={nextSale && nextSale.s.daysToTarget! < 0 ? 'warn' : undefined}
          onClick={() => onNavigateToTab('batch-management')}
        />
      </section>

      <section aria-label={tx('needsTitle')} className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">{tx('needsTitle')}</h3>
        {needs.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 p-5 text-lg text-emerald-900">{tx('nothingNeeds')}</p>
        ) : (
          <ul className="space-y-2">
            {needs.map(n => (
              <li key={n.key}>
                <button type="button" onClick={() => (n.onOpen ? n.onOpen() : onNavigateToTab(n.tab))} className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left hover:border-emerald-600 ${n.tone === 'bad' ? 'border-rose-300' : 'border-amber-300'}`}>
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
        <h3 className="mb-2 text-lg font-semibold text-ink">{tx('salesMonth')}</h3>
        {months.length === 0 ? (
          <p className="py-8 text-center text-base text-ink-muted">{tx('noSales')}</p>
        ) : (
          <>
            <div className="h-56" role="img" aria-label={tx('chartAria')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months.map(m => ({ ...m, label: monthLabel(m.month, language) }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                  <YAxis width={52} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v === 0 ? '0' : v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : `${Math.round(v / 1000)}k`)} />
                  <Tooltip formatter={(v) => [riel(Number(v)), tx('sold')]} />
                  <Bar dataKey="sold" name={tx('sold')} fill={SOLD} radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {[...months].reverse().map(m => (
                <li key={m.month} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-base font-medium text-ink">{monthLabel(m.month, language)}</span>
                  <span className="text-base text-ink">{riel(m.sold)} <span className="text-ink-muted">{tx('soldN', { n: m.soldCount })}</span></span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">{tx('latestSales')}</h3>
            <button type="button" onClick={() => onNavigateToTab('sales-finance')} className="min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">{tx('seeAll')}</button>
          </div>
          {recentSales.length === 0 ? <p className="text-base text-ink-muted">{tx('noSales')}</p> : (
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
            <h3 className="text-lg font-semibold text-ink">{tx('latestCattle')}</h3>
            <button type="button" onClick={() => onNavigateToTab('cow-inventory')} className="min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">{tx('seeAll')}</button>
          </div>
          {recentCattle.length === 0 ? <p className="text-base text-ink-muted">{tx('noCattle')}</p> : (
            <ul className="divide-y divide-slate-100">
              {recentCattle.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div><p className="text-lg font-semibold text-ink">{c.id}</p><p className="text-base text-ink-muted">{[val(c.sex), c.breed, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(' · ')}</p></div>
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
