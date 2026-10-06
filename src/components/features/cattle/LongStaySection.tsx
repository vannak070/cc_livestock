'use client';

import React, { useState } from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { CattleFollowUp, StockItem } from '@/lib/types';
import { arrivalDay, longStayMonths, monthsBetween, openFollowUp } from '@/lib/long-stay';
import { farmToday } from '@/lib/daily-feed';
import { shownDay } from '@/lib/khmer-date';
import { getErrorMessage } from '@/lib/utils';
import { useText } from '@/hooks/useText';

interface LongStaySectionProps {
  cow: StockItem;
  followUps: CattleFollowUp[];
  /** The "months on the farm" setting. */
  monthsSetting?: number;
  /** Opens the dialog to record the next action; only given to people who may. */
  onRecord?: (cowId: string, months: number | undefined, current?: CattleFollowUp) => void;
  onFinish?: (id: string) => Promise<void>;
}

/**
 * On an animal's page: how long it has been on the farm, its next action, and
 * what was decided before. Shown once the animal has been here the set number
 * of months, or whenever it already has a recorded action.
 */
export default function LongStaySection({ cow, followUps, monthsSetting, onRecord, onFinish }: LongStaySectionProps) {
  const { tx, language } = useText('longStay');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'info' | 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  const arrival = arrivalDay(cow);
  const limit = longStayMonths({ longStayMonths: monthsSetting });
  const today = farmToday();
  const months = arrival ? monthsBetween(arrival, today) : 0;
  const next = openFollowUp(cow.id, followUps);
  const history = followUps.filter(f => f.cowId === cow.id && f.doneAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!arrival || (months < limit && !next && history.length === 0)) return null;

  const overdue = !!next?.dueDate && next.dueDate < today;
  const askDone = (f: CattleFollowUp) => setConfirm({
    title: tx('doneConfirmTitle'),
    description: tx('doneConfirmDesc', { action: tx(`a_${f.action}`), id: cow.id }),
    type: 'info',
    confirmText: tx('markDone'),
    onConfirm: async () => {
      try { await onFinish?.(f.id); } catch (e) { setConfirm({ title: tx('eDone'), description: getErrorMessage(e, tx('eDone')), type: 'danger', confirmText: 'OK' }); }
    },
  });

  return (
    <section aria-label={tx('sectionTitle')} className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-amber-800" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-ink">{tx('sectionTitle')}</h3>
          <p className="text-base text-ink">{months >= limit ? tx('sectionSub', { months, day: shownDay(arrival, language) }) : tx('sectionSubOpen')}</p>
        </div>
      </div>

      {next ? (
        <div className={`space-y-2 rounded-xl bg-white p-3 ${overdue ? 'border-2 border-rose-300' : ''}`}>
          <p className="text-sm text-ink-muted">{tx('nextAction')}</p>
          <p className="text-lg font-semibold text-ink">{tx(`a_${next.action}`)}</p>
          {next.note && <p className="break-words text-base text-ink">{next.note}</p>}
          {next.dueDate && <p className={`text-base font-medium ${overdue ? 'text-rose-700' : 'text-ink-muted'}`}>{overdue ? tx('wasDue', { day: shownDay(next.dueDate, language) }) : tx('byDay', { day: shownDay(next.dueDate, language) })}</p>}
          <p className="text-sm text-ink-muted">{tx('recordedBy', { who: next.createdBy, day: shownDay(next.createdAt, language) })}</p>
          {onRecord && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={() => onRecord(cow.id, months, next)}>{tx('change')}</Button>
              {onFinish && <Button onClick={() => askDone(next)}><CheckCircle2 /> {tx('markDone')}</Button>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-white p-3">
          <p className="text-base font-medium text-amber-900">{tx('noNext')}</p>
          {onRecord && <Button onClick={() => onRecord(cow.id, months)}>{tx('recordNext')}</Button>}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-sm font-medium text-ink-muted">{tx('history')}</p>
          <ul className="mt-1 space-y-1">
            {history.slice(0, 5).map(f => (
              <li key={f.id} className="text-base text-ink">
                <span className="font-medium">{tx(`a_${f.action}`)}</span>
                {f.note ? ` · ${f.note}` : ''} · {tx('recordedBy', { who: f.createdBy, day: shownDay(f.createdAt, language) })}
                {f.doneAt ? ` · ${tx('doneOn', { day: shownDay(f.doneAt, language) })}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirm && <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />}
    </section>
  );
}
