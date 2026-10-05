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
  SELL_WARNING_DAYS
} from '@/lib/attention';
import type { ActiveTabType, RecordAction } from './layout/SidebarLayout';

interface TodayTabProps {
  data: ERPLivestockData;
  currentUser: UserRoleItem;
  recordActions: RecordAction[];
  onNavigate: (tab: ActiveTabType) => void;
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * The first screen for people doing the daily work: what needs attention
 * today, each with one clear button, then big buttons to record things.
 * Every rule lives in src/lib/attention.ts so the pages behind it agree.
 */
export default function TodayTab({ data, currentUser, recordActions, onNavigate }: TodayTabProps) {
  const can = (key: Parameters<typeof hasPermission>[1]) => hasPermission(currentUser, key);
  const now = new Date();
  const onFarm = activeCattle(data.stock).length;
  const firstName = (currentUser.name || '').split(' ')[0];

  const items: AttentionItem[] = [];

  if (can('health_view')) {
    const sick = sickCattle(data.stock);
    if (sick.length > 0) {
      items.push({
        key: 'sick',
        severity: 'urgent',
        title: `${plural(sick.length, 'animal is', 'animals are')} sick`,
        detail: sick.slice(0, 5).map(c => c.id).join(', ') + (sick.length > 5 ? ` and ${sick.length - 5} more` : ''),
        actionLabel: 'See them',
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
        title: `Feed running low: ${l.productName}`,
        detail: l.daysLeft === null || l.daysLeft <= 0
          ? `Only ${Math.round(l.bags)} bags left`
          : `About ${plural(l.daysLeft, 'day', 'days')} left (${Math.round(l.bags)} bags)`,
        actionLabel: can('feed_manage') ? 'Add feed' : 'Open feed',
        onAction: () => onNavigate('feed-inventory')
      });
    }
    const otherLow = levels.filter(l => l.isLow && l.dailyUseKg === 0).length;
    if (otherLow > 0) {
      items.push({
        key: 'feed-other',
        severity: 'attention',
        title: `${plural(otherLow, 'other feed product is', 'other feed products are')} at or below the minimum`,
        detail: 'Not used by any feeding program right now',
        actionLabel: 'Open feed',
        onAction: () => onNavigate('feed-inventory')
      });
    }
  }

  if (can('weight_view')) {
    const schedule = weighSchedules(data, WEIGH_INTERVAL_DAYS, now);
    const overdue = schedule.filter(s => s.status === 'overdue').length;
    const dueSoon = schedule.filter(s => s.status === 'duesoon').length;
    if (overdue + dueSoon > 0) {
      const parts = [overdue > 0 ? `${overdue} overdue` : '', dueSoon > 0 ? `${dueSoon} due in the next 2 days` : ''].filter(Boolean);
      items.push({
        key: 'weigh',
        severity: 'attention',
        title: `${plural(overdue + dueSoon, 'animal is', 'animals are')} due for weighing`,
        detail: `${parts.join(' · ')} (weighed every ${WEIGH_INTERVAL_DAYS} days)`,
        actionLabel: 'Weigh now',
        onAction: () => onNavigate('weight-tracking')
      });
    }
  }

  if (can('batch_view')) {
    for (const b of batchesNearSelling(data, SELL_WARNING_DAYS, now).slice(0, 3)) {
      items.push({
        key: `sell-${b.batchId}`,
        severity: b.daysRemaining < 0 ? 'urgent' : 'attention',
        title: `Batch ${b.batchName}: ${b.daysRemaining < 0 ? 'selling date has passed' : 'selling date is near'}`,
        detail: b.daysRemaining < 0
          ? `${plural(-b.daysRemaining, 'day', 'days')} overdue`
          : b.daysRemaining === 0 ? 'Planned for today' : `In ${plural(b.daysRemaining, 'day', 'days')}`,
        actionLabel: 'Open batch',
        onAction: () => onNavigate('batch-management')
      });
    }
  }

  if (can('health_view')) {
    const history = cattleWithDiseaseHistory(data);
    if (history.length > 0) {
      items.push({
        key: 'disease',
        severity: 'attention',
        title: `${plural(history.length, 'animal has', 'animals have')} a disease on record`,
        detail: 'Check they are recovering',
        actionLabel: 'Open health',
        onAction: () => onNavigate('health-tracking')
      });
    }
  }

  items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1));

  const farmLine = currentUser.farmLocation
    ? `${currentUser.farmLocation} · ${plural(onFarm, 'animal', 'animals')} on the farm`
    : `All farms · ${plural(onFarm, 'animal', 'animals')} on farms`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-ink">{greeting(now)}{firstName ? `, ${firstName}` : ''}</h2>
        <p className="text-base text-ink-muted mt-1">{farmLine}</p>
      </section>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <h3 id="attention-heading" className="text-xl font-semibold text-ink">Needs attention today</h3>

        {items.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800">
            <CheckCircle2 className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
            <p className="text-base font-semibold">All good today. Nothing needs attention.</p>
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
                      ? <AlertTriangle className="h-6 w-6" aria-label="Urgent" />
                      : <Info className="h-6 w-6" aria-label="Needs attention" />}
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
          <h3 id="record-heading" className="text-xl font-semibold text-ink">Record</h3>
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
