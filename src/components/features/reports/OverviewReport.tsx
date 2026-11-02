'use client';

import React, { useMemo } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ERPLivestockData } from '@/lib/types';
import type { ActiveTabType } from '../../layout/SidebarLayout';
import { batchesNearSelling, feedStockLevels, sickCattle, weighSchedules } from '@/lib/attention';
import { saleWindowDays } from '@/lib/sale-review';
import { farmToday, farmsToRecord, missedFeedDays } from '@/lib/daily-feed';
import { batchSummary } from '@/lib/batch-stats';
import { monthlyMoney } from '@/lib/report-stats';
import { farmProfit as computeFarmProfit, sumMonths } from '@/lib/farm-costs';
import { useText } from '@/hooks/useText';
import { StatusBanner, Tile, norm, riel } from './parts';

interface Props {
  /** Cattle, batches and sales already narrowed to the chosen farm. */
  data: ERPLivestockData;
  /** Everything (feed and costs belong to the company, and the profit is worked out per farm from it). */
  fullData: ERPLivestockData;
  /** The farm chosen on the page, or '' for all. */
  farm: string;
  /** Whether the profit box can open the Money tab (otherwise it opens Sales). */
  canAnalytics: boolean;
  onNavigateToTab: (tab: ActiveTabType) => void;
  onOpenSaleReview?: () => void;
  onOpenMoney: () => void;
}

/**
 * Reports → Overview: the farm at a glance (what the old Summary page showed), without repeating the
 * to-do list that lives on Today: it is one box here with a button to Today.
 */
export default function OverviewReport({ data, fullData, farm, canAnalytics, onNavigateToTab, onOpenSaleReview, onOpenMoney }: Props) {
  const { tx, txn } = useText('summaryPage');
  const rp = useText('reportsPage');
  const active = useMemo(() => data.stock.filter(c => norm(c.status) === 'active'), [data.stock]);
  const soldCount = data.stock.filter(c => norm(c.status) === 'sold').length;
  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);

  const money = useMemo(() => {
    const rows = monthlyMoney(data.stock, data.salesTracking, data.healthLogs);
    return { rows, sales: rows.reduce((s, r) => s + r.soldCount, 0) };
  }, [data.stock, data.salesTracking, data.healthLogs]);

  // Farm profit: sales less what the sold cattle cost to buy and feed, medicine and running costs.
  const farmProfit = useMemo(() => {
    const { months: rows } = computeFarmProfit({
      stock: fullData.stock, sales: fullData.salesTracking, healthLogs: fullData.healthLogs, feedTransactions: fullData.feedTransactions || [],
      batches: fullData.batches, costs: fullData.farmCosts || [], farm: farm || undefined,
    });
    return rows.length ? sumMonths(rows).profit : null;
  }, [fullData, farm]);

  const sick = sickCattle(active);
  const dueToWeigh = weighSchedules(data).filter(s => s.status !== 'weighed');
  const levels = feedStockLevels(fullData);
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

  // Feed only leaves stock when a farm records the day, so missed days come first.
  const feedToday = farmToday();
  const missedFeed = farmsToRecord(data.batches)
    .map(f => ({ farm: f, days: missedFeedDays(f, data.batches, data.stock, products, data.feedTransactions || [], feedToday) }))
    .filter(m => m.days.length > 0);

  // What needs attention, as short lines. The full list with its buttons is on Today.
  const needs: { key: string; text: string; bad: boolean }[] = [
    missedFeed.length > 0 && { key: 'feed-missed', text: tx('feedMissed', { list: missedFeed.map(m => tx('feedMissedFarm', { farm: m.farm, days: txn(m.days.length, 'dayOne', 'dayMany') })).join(', ') }), bad: true },
    sick.length > 0 && { key: 'sick', text: txn(sick.length, 'sickOne', 'sickMany'), bad: true },
    lowFeed.length > 0 && { key: 'feed', text: lowFeed.length > 1 ? tx('lowFeedMore', { name: lowFeed[0].productName, n: lowFeed.length - 1 }) : tx('lowFeed', { name: lowFeed[0].productName }), bad: false },
    nearSelling.length > 0 && { key: 'sell', text: txn(nearSelling.length, 'sellOne', 'sellMany'), bad: overdueSelling > 0 },
    dueToWeigh.length > 0 && { key: 'weigh', text: txn(dueToWeigh.length, 'weighOne', 'weighMany'), bad: false },
  ].filter(Boolean) as { key: string; text: string; bad: boolean }[];
  const anyBad = needs.some(n => n.bad);

  const feedTone = tightest ? (tightest.daysLeft! < 7 ? 'bad' : tightest.daysLeft! < 14 ? 'warn' : undefined) : undefined;
  const openSale = onOpenSaleReview ?? (() => onNavigateToTab('batch-management'));

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label={tx('tileCattle')} value={String(active.length)} sub={tx('soldSoFar', { n: soldCount })} onClick={() => onNavigateToTab('cow-inventory')} />
        <Tile label={tx('tileProfit')} value={farmProfit !== null ? `${farmProfit < 0 ? '−' : ''}${riel(Math.abs(farmProfit))}` : '—'} sub={farmProfit !== null ? tx('profitSub', { n: money.sales }) : tx('nothingYet')} tone={farmProfit !== null ? (farmProfit < 0 ? 'bad' : 'good') : undefined} onClick={() => (canAnalytics ? onOpenMoney() : onNavigateToTab('sales-finance'))} />
        <Tile label={tx('tileFeed')} value={tightest ? tx('daysN', { n: tightest.daysLeft ?? 0 }) : '—'} sub={tightest ? tx('runsOut', { name: tightest.productName }) : tx('noProgram')} tone={feedTone} onClick={() => onNavigateToTab('feed-inventory')} />
        <Tile
          label={tx('tileNextSale')}
          value={nextSale ? (nextSale.s.daysToTarget! < 0 ? tx('daysLate', { n: -nextSale.s.daysToTarget! }) : nextSale.s.daysToTarget === 0 ? tx('today') : tx('daysN', { n: nextSale.s.daysToTarget! })) : '—'}
          sub={nextSale ? nextSale.b.name : txn(activeBatches.length, 'activeBatchOne', 'activeBatchMany')}
          tone={nextSale && nextSale.s.daysToTarget! < 0 ? 'warn' : undefined}
          onClick={openSale}
        />
      </section>

      {needs.length === 0 ? (
        <StatusBanner level="ok"><p className="flex items-center gap-2 text-lg text-ink"><CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden /> {tx('nothingNeeds')}</p></StatusBanner>
      ) : (
        <StatusBanner level={anyBad ? 'act' : 'watch'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-ink"><TriangleAlert className={`h-6 w-6 shrink-0 ${anyBad ? 'text-rose-700' : 'text-amber-700'}`} aria-hidden /> {txn(needs.length, 'attnOne', 'attnMany')}</h3>
            <Button className="min-h-11" onClick={() => onNavigateToTab('today')}>{tx('openToday')}</Button>
          </div>
          <ul className="mt-2 space-y-1 text-base text-ink">
            {needs.slice(0, 3).map(n => <li key={n.key} className="flex gap-2"><span aria-hidden>•</span> <span className="min-w-0">{n.text}</span></li>)}
            {needs.length > 3 && <li className="text-ink-muted">{tx('attnMore', { n: needs.length - 3 })}</li>}
          </ul>
        </StatusBanner>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white ring-1 ring-slate-200 p-4">
        <p className="min-w-0 text-base text-ink-muted">{rp.tx('salesOnMoney')}</p>
        <div className="flex flex-wrap gap-2">
          {canAnalytics && <Button className="min-h-11" variant="outline" onClick={onOpenMoney}>{rp.tx('openMoney')}</Button>}
          <Button className="min-h-11" variant="ghost" onClick={() => onNavigateToTab('sales-finance')}>{tx('allSales')}</Button>
          <Button className="min-h-11" variant="ghost" onClick={() => onNavigateToTab('cow-inventory')}>{tx('allCattle')}</Button>
        </div>
      </section>
    </div>
  );
}
