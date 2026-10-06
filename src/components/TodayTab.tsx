'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import type { ERPLivestockData, UserRoleItem } from '@/lib/types';
import { hasPermission } from '@/lib/utils';
import {
  activeCattle,
  batchesNearSelling,
  cattleWithDiseaseHistory,
  feedStockLevels,
  sickCattle,
  weighSchedules,
  WEIGH_INTERVAL_DAYS,
} from '@/lib/attention';
import { SALE_WEEK_DAYS, saleWindowDays } from '@/lib/sale-review';
import { farmToday, farmsToRecord, missedFeedDays, todayNotRecorded, unlinkedRationFeeds } from '@/lib/daily-feed';
import { dayLabel } from './features/feed/DailyFeedFlow';
import { useText } from '@/hooks/useText';
import type { ActiveTabType, RecordAction } from './layout/SidebarLayout';

interface TodayTabProps {
  data: ERPLivestockData;
  currentUser: UserRoleItem;
  recordActions: RecordAction[];
  onNavigate: (tab: ActiveTabType) => void;
  /** Opens the Batches page on the sale review. */
  onOpenSaleReview?: () => void;
  /** Opens the feed record for a farm and day (today when no day); only for people who may record feed. */
  onRecordFeed?: (farm: string, day?: string) => void;
}

type Severity = 'urgent' | 'attention';

interface AttentionItem {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}

function greeting(now: Date, tx: (key: string) => string): string {
  const h = now.getHours();
  return tx(h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening');
}

/**
 * The first screen for people doing the daily work: what needs attention
 * today, each with one clear button, then big buttons to record things.
 * Every rule lives in src/lib/attention.ts so the pages behind it agree.
 */
export default function TodayTab({ data, currentUser, recordActions, onNavigate, onOpenSaleReview, onRecordFeed }: TodayTabProps) {
  const { tx, txn, language } = useText('todayPage');
  const can = (key: Parameters<typeof hasPermission>[1]) => hasPermission(currentUser, key);
  const now = new Date();
  const onFarm = activeCattle(data.stock).length;
  const firstName = (currentUser.name || '').split(' ')[0];

  const items: AttentionItem[] = [];

  // Feed only leaves stock when someone writes the day down, so every missed day is flagged.
  if (onRecordFeed) {
    const today = farmToday(now);
    const products = data.feedProducts || [];
    const txs = data.feedTransactions || [];
    const farms = currentUser.farmLocation ? [currentUser.farmLocation] : farmsToRecord(data.batches);
    const many = farms.length > 1;
    for (const farm of farms) {
      const missed = missedFeedDays(farm, data.batches, data.stock, products, txs, today);
      if (missed.length > 0) {
        items.push({
          key: `feed-missed-${farm}`,
          severity: 'urgent',
          title: many ? txn(missed.length, 'feedMissedOneAt', 'feedMissedManyAt', { farm }) : txn(missed.length, 'feedMissedOne', 'feedMissedMany'),
          detail: tx('feedMissedDetail', { days: missed.map(d => dayLabel(d, language)).join(', ') }),
          actionLabel: tx('record'),
          onAction: () => onRecordFeed(farm, missed[0])
        });
      }
      if (todayNotRecorded(farm, data.batches, data.stock, products, txs, today)) {
        items.push({
          key: `feed-day-${farm}`,
          severity: 'attention',
          title: many ? tx('todayFeedNotRecordedAt', { farm }) : tx('todayFeedNotRecorded'),
          detail: tx('todayFeedDetail'),
          actionLabel: tx('recordFeed'),
          onAction: () => onRecordFeed(farm)
        });
      }
    }
    for (const u of unlinkedRationFeeds(data.batches, products, currentUser.farmLocation || undefined)) {
      items.push({
        key: `feed-unlinked-${u.batch.id}`,
        severity: 'attention',
        title: tx('feedUnlinked', { batch: u.batch.name }),
        detail: tx('feedUnlinkedDetail', { names: u.names.join(', ') }),
        actionLabel: tx('openBatches'),
        onAction: () => onNavigate('batch-management')
      });
    }
  }

  if (can('health_view')) {
    const sick = sickCattle(data.stock);
    if (sick.length > 0) {
      items.push({
        key: 'sick',
        severity: 'urgent',
        title: txn(sick.length, 'sickOne', 'sickMany'),
        detail: sick.slice(0, 5).map(c => c.id).join(', ') + (sick.length > 5 ? tx('andMore', { n: sick.length - 5 }) : ''),
        actionLabel: tx('seeThem'),
        onAction: () => onNavigate('health-tracking')
      });
    }
  }

  if (can('feed_view')) {
    const levels = feedStockLevels(data);
    const inUseLow = levels.filter(l => l.isLow && l.dailyUseKg > 0).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
    for (const l of inUseLow.slice(0, 2)) {
      items.push({
        key: `feed-${l.productId}`,
        severity: l.daysLeft !== null && l.daysLeft <= 3 ? 'urgent' : 'attention',
        title: tx('feedLow', { name: l.productName }),
        detail: l.daysLeft === null || l.daysLeft <= 0
          ? tx('onlyBagsLeft', { bags: Math.round(l.bags) })
          : txn(l.daysLeft, 'daysLeftOne', 'daysLeftMany', { bags: Math.round(l.bags) }),
        actionLabel: tx(can('feed_manage') ? 'addFeed' : 'openFeed'),
        onAction: () => onNavigate('feed-inventory')
      });
    }
    const otherLow = levels.filter(l => l.isLow && l.dailyUseKg === 0).length;
    if (otherLow > 0) {
      items.push({
        key: 'feed-other',
        severity: 'attention',
        title: txn(otherLow, 'otherLowOne', 'otherLowMany'),
        detail: tx('otherLowDetail'),
        actionLabel: tx('openFeed'),
        onAction: () => onNavigate('feed-inventory')
      });
    }
  }

  if (can('weight_view')) {
    const schedule = weighSchedules(data, WEIGH_INTERVAL_DAYS, now);
    const overdue = schedule.filter(s => s.status === 'overdue').length;
    const dueSoon = schedule.filter(s => s.status === 'duesoon').length;
    if (overdue + dueSoon > 0) {
      const parts = [overdue > 0 ? tx('overdueCount', { n: overdue }) : '', dueSoon > 0 ? tx('dueSoonCount', { n: dueSoon }) : ''].filter(Boolean);
      items.push({
        key: 'weigh',
        severity: 'attention',
        title: txn(overdue + dueSoon, 'weighDueOne', 'weighDueMany'),
        detail: `${parts.join(' · ')} ${tx('weighEvery', { n: WEIGH_INTERVAL_DAYS })}`,
        // Read-only people (Management) only look, so the button says where it goes.
        actionLabel: tx(can('weight_record') ? 'weighNow' : 'openWeights'),
        onAction: () => onNavigate('weight-tracking')
      });
    }
  }

  if (can('batch_view')) {
    const near = batchesNearSelling(data, saleWindowDays(data.settings), now);
    const openReview = () => (onOpenSaleReview ? onOpenSaleReview() : onNavigate('batch-management'));
    const label = tx(can('batch_review') ? 'review' : 'openBatches');
    for (const b of near.slice(0, 3)) {
      items.push({
        key: `sell-${b.batchId}`,
        severity: b.daysRemaining < 0 ? 'urgent' : 'attention',
        title: tx(b.daysRemaining < 0 ? 'batchSellPassed' : b.daysRemaining <= SALE_WEEK_DAYS ? 'batchSellThisWeek' : 'batchSellComing', { name: b.batchName }),
        detail: b.daysRemaining < 0
          ? txn(-b.daysRemaining, 'daysOverdueOne', 'daysOverdueMany')
          : b.daysRemaining === 0 ? tx('plannedToday') : txn(b.daysRemaining, 'inDaysOne', 'inDaysMany'),
        actionLabel: label,
        onAction: openReview
      });
    }
    if (near.length > 3) {
      items.push({
        key: 'sell-more',
        severity: near.some(b => b.daysRemaining < 0) ? 'urgent' : 'attention',
        title: txn(near.length - 3, 'moreBatchesOne', 'moreBatchesMany'),
        detail: tx('seeAllSaleReview'),
        actionLabel: label,
        onAction: openReview
      });
    }
  }

  if (can('health_view')) {
    const history = cattleWithDiseaseHistory(data);
    if (history.length > 0) {
      items.push({
        key: 'disease',
        severity: 'attention',
        title: txn(history.length, 'diseaseOne', 'diseaseMany'),
        detail: tx('diseaseDetail'),
        actionLabel: tx('openHealth'),
        onAction: () => onNavigate('health-tracking')
      });
    }
  }

  items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1));

  const farmLine = currentUser.farmLocation
    ? txn(onFarm, 'farmLineOne', 'farmLineMany', { farm: currentUser.farmLocation })
    : txn(onFarm, 'allFarmsLineOne', 'allFarmsLineMany');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-ink">{greeting(now, tx)}{firstName ? `, ${firstName}` : ''}</h2>
        <p className="text-base text-ink-muted mt-1">{farmLine}</p>
      </section>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <h3 id="attention-heading" className="text-xl font-semibold text-ink">{tx('needsAttentionToday')}</h3>

        {items.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800">
            <CheckCircle2 className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
            <p className="text-base font-semibold">{tx('allGood')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(item => (
              <li key={item.key} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span
                    className={`h-11 w-11 flex-shrink-0 rounded-xl flex items-center justify-center ${
                      item.severity === 'urgent' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {item.severity === 'urgent'
                      ? <AlertTriangle className="h-6 w-6" aria-label={tx('urgent')} />
                      : <Info className="h-6 w-6" aria-label={tx('needsAttention')} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base md:text-lg font-semibold text-ink">{item.title}</p>
                    <p className="text-sm text-ink-muted mt-0.5">{item.detail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={item.onAction}
                  className="h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold flex items-center justify-center gap-1 cursor-pointer sm:flex-shrink-0"
                >
                  {item.actionLabel}
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recordActions.length > 0 && (
        <section aria-labelledby="record-heading" className="space-y-3">
          <h3 id="record-heading" className="text-xl font-semibold text-ink">{tx('record')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recordActions.map(a => (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                className="min-h-24 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-2 text-base font-semibold text-ink hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer"
              >
                <span className="text-emerald-700">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
