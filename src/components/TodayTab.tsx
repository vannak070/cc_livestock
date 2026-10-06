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
import { canSetLimits, limitBlock, limitUsed } from '@/lib/farm-limit';
import { capacityLevels, nearLimit } from '@/lib/capacity-alerts';
import { longStayCattle, longStayMonths } from '@/lib/long-stay';
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
  /** Opens "Ask for more cattle" for a farm; only for people who may ask. */
  onAskMore?: (farm: string) => void;
  /** Opens the Cattle page showing the long-stay list. */
  onOpenLongStay?: () => void;
}

type Severity = 'urgent' | 'attention';

interface AttentionItem {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  /** No button when there is nothing to do but wait (e.g. a request already sent). */
  actionLabel?: string;
  onAction?: () => void;
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
export default function TodayTab({ data, currentUser, recordActions, onNavigate, onOpenSaleReview, onRecordFeed, onAskMore, onOpenLongStay }: TodayTabProps) {
  const lsText = useText('longStay');
  const { tx, txn, language } = useText('todayPage');
  const lim = useText('farmLimits');
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

  // Cattle on the farm a long time (src/lib/long-stay.ts), for people who see cattle.
  if (can('stock_view') && onOpenLongStay) {
    const months = longStayMonths(data.settings);
    const rows = longStayCattle(data.stock, months, data.cattleFollowUps ?? [], farmToday(now));
    if (rows.length > 0) {
      const none = rows.filter(r => !r.next).length;
      const late = rows.filter(r => r.overdue).length;
      items.push({
        key: 'long-stay',
        severity: 'attention',
        title: rows.length === 1 ? lsText.tx('todayOne', { months }) : lsText.tx('todayMany', { n: rows.length, months }),
        detail: [none > 0 ? lsText.tx('noNextN', { n: none }) : lsText.tx('allPlanned'), late > 0 ? lsText.tx('overdueN', { n: late }) : ''].filter(Boolean).join(' · '),
        actionLabel: lsText.tx('seeThem'),
        onAction: onOpenLongStay
      });
    }
  }

  // Cattle limits (src/lib/farm-limit.ts): admins answer requests; a farm sees when its limit is used up.
  const limitRequests = data.farmLimitRequests ?? [];
  if (canSetLimits(currentUser)) {
    const waiting = limitRequests.filter(r => r.status === 'pending').length;
    // Farms at 80% or more of their cattle limit (src/lib/capacity-alerts.ts), fullest first.
    const near = nearLimit(capacityLevels(data.settings?.farms ?? [], data.stock));
    if (near.length > 0) {
      const full = near.filter(l => l.step === 100).length;
      items.push({
        key: 'limit-near',
        severity: full > 0 ? 'urgent' : 'attention',
        title: near.length === 1 ? lim.tx('adminNearOne') : lim.tx('adminNearMany', { n: near.length }),
        detail: near.slice(0, 4).map(l => lim.tx('adminNearLine', { farm: l.farm, used: l.used, limit: l.limit, pct: l.percent })).join(' · ') + (near.length > 4 ? ` · +${near.length - 4}` : ''),
        actionLabel: lim.tx('openFarms'),
        onAction: () => onNavigate('farms')
      });
    }
    if (waiting > 0) {
      items.push({
        key: 'limit-requests',
        severity: 'attention',
        title: waiting === 1 ? lim.tx('todayRequestOne') : lim.tx('todayRequests', { n: waiting }),
        detail: lim.tx('todayRequestsSub'),
        actionLabel: lim.tx('answer'),
        onAction: () => onNavigate('farms')
      });
    }
  } else if (currentUser.farmLocation && can('stock_create')) {
    const farmName = currentUser.farmLocation;
    const same = (a: string) => a.trim().toLowerCase() === farmName.trim().toLowerCase();
    const farm = (data.settings?.farms ?? []).find(f => same(f.name));
    const block = farm ? limitBlock(farm, limitUsed(farm.name, data.stock)) : null;
    const pending = limitRequests.find(r => r.status === 'pending' && same(r.farmLocation));
    const level = farm ? capacityLevels([farm], data.stock)[0] : undefined;
    if (!block && level && level.step > 0 && level.step < 100) {
      items.push({
        key: 'limit-near',
        severity: 'attention',
        title: lim.tx('farmNearTitle', { pct: level.percent }),
        detail: pending ? lim.tx('waiting', { n: pending.extra }) : lim.tx('farmNearDetail', { used: level.used, limit: level.limit, left: level.left }),
        ...(pending || !onAskMore ? {} : { actionLabel: lim.tx('askMore'), onAction: () => onAskMore(level.farm) })
      });
    }
    if (block) {
      items.push({
        key: 'limit-full',
        severity: pending ? 'attention' : 'urgent',
        title: block.reason === 'not-set' ? lim.tx('noLimit') : lim.tx('todayFull', { farm: block.farm }),
        detail: pending ? lim.tx('waiting', { n: pending.extra })
          : block.reason === 'not-set' ? lim.tx('noLimitHint') : lim.tx('todayFullSub', { used: block.used, limit: block.limit }),
        ...(pending || !onAskMore ? {} : { actionLabel: lim.tx('askMore'), onAction: () => onAskMore(block.farm) })
      });
    }
    // The answer to the farm's latest request, for a week after it was given.
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const answered = limitRequests
      .filter(r => r.status !== 'pending' && same(r.farmLocation) && (r.decidedAt ?? '') >= weekAgo)
      .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))[0];
    if (answered && !pending) {
      items.push({
        key: `limit-answer-${answered.id}`,
        severity: 'attention',
        title: lim.tx('todayAnswered', { n: answered.extra, result: lim.tx(answered.status === 'approved' ? 'approved' : 'declined') }),
        detail: answered.decisionNote || (answered.status === 'approved' && answered.newLimit ? lim.tx('usedOf', { used: limitUsed(farmName, data.stock), limit: answered.newLimit }) : '')
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
                    {item.detail && <p className="text-sm text-ink-muted mt-0.5">{item.detail}</p>}
                  </div>
                </div>
                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold flex items-center justify-center gap-1 cursor-pointer sm:flex-shrink-0"
                  >
                    {item.actionLabel}
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
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
