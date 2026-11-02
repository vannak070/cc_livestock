'use client';

import React, { useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changeOpsTaskAction } from '@/app/actions';
import { farmToday } from '@/lib/daily-feed';
import { dayLabel } from '../feed/DailyFeedFlow';
import { taskChangeProblem, type TaskChange } from '@/lib/ops-program';
import type { TaskView } from '@/lib/ops-view';
import { useText } from '@/hooks/useText';

interface Props {
  /** The task that was dragged. */
  v: TaskView;
  /** The other half of an exchange day, offered to move together with it. */
  partner?: TaskView;
  farm: string;
  /** The day it was dropped on. */
  toDay: string;
  onClose: () => void;
  /** At least one task was moved (the lists must be loaded again). */
  onMoved: (moved: number) => void;
}

const REASONS = ['mvR1', 'mvR2', 'mvR3'] as const;

/**
 * Asks before a dragged task changes day: it shows what moves where, offers to move the matching exchange task too, and
 * asks why (the reason is kept in the task's history for Management, like any other change to the plan).
 */
export default function OpsMoveDialog({ v, partner, farm, toDay, onClose, onMoved }: Props) {
  const { tx, language } = useText('opsTasks');
  const [both, setBoth] = useState(!!partner);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const day = (d: string) => dayLabel(d, language);
  const line = (t: TaskView['task']) => tx(`act_${t.kind}`, { n: t.plannedHead ?? 0, farm });

  const move = async () => {
    const list = both && partner ? [v, partner] : [v];
    const today = farmToday();
    let moved = 0;
    setBusy(true);
    setError('');
    for (const item of list) {
      const change: TaskChange = { action: 'postpone', newDueDate: toDay, reason: reason.trim() };
      const problem = taskChangeProblem(item.task, change, today);
      if (problem) { setError(problem); break; }
      const res = await changeOpsTaskAction(item.task.id, change);
      if (!res.success) { setError(res.error); break; }
      moved++;
    }
    setBusy(false);
    if (moved > 0) onMoved(moved);
    if (moved === list.length) onClose();
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-1 text-left sm:text-left">
          <DialogTitle className="text-2xl font-semibold text-ink">{tx('mvTitle')}</DialogTitle>
          <DialogDescription className="text-base text-ink-muted">{tx('mvIntro')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            {[v, ...(both && partner ? [partner] : [])].map(item => (
              <p key={item.task.id} className="break-words text-lg font-semibold text-ink">{line(item.task)}</p>
            ))}
            <p className="flex flex-wrap items-center gap-2 text-base text-ink">
              <CalendarDays className="h-4 w-4 text-ink-muted" aria-hidden />
              <span>{day(v.task.dueDate)}</span><ArrowRight className="h-4 w-4 text-ink-muted" aria-hidden /><span className="font-semibold text-emerald-800">{day(toDay)}</span>
            </p>
          </div>

          {partner && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-base text-ink">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" checked={both} onChange={e => setBoth(e.target.checked)} />
              <span><span className="font-medium">{tx('mvBoth')}</span><span className="block text-sm text-ink-muted">{line(partner.task)}</span></span>
            </label>
          )}

          <div className="space-y-2">
            <label className="block text-base font-medium text-ink" htmlFor="mv-reason">{tx('lReason')}</label>
            <Input id="mv-reason" className="min-h-11 text-base" value={reason} maxLength={300} onChange={e => { setReason(e.target.value); setError(''); }} autoFocus />
            <div className="flex flex-wrap gap-2">
              {REASONS.map(k => <button key={k} type="button" onClick={() => { setReason(tx(k)); setError(''); }} className="min-h-9 rounded-full border border-slate-300 bg-white px-3 text-sm text-ink hover:border-emerald-600">{tx(k)}</button>)}
            </div>
            <p className="text-sm text-ink-muted">{tx('reasonHint')}</p>
          </div>

          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={onClose}>{tx('mvCancel')}</Button>
            <Button type="button" size="lg" className="flex-1" disabled={busy || reason.trim().length < 3} onClick={() => void move()}>{busy ? tx('mvMoving') : tx('mvConfirm', { day: day(toDay) })}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
