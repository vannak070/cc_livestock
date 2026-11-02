'use client';

import React, { useMemo } from 'react';
import { ClipboardList, Truck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addDays, farmToday } from '@/lib/daily-feed';
import { shownDay } from '@/lib/khmer-date';
import { getErrorMessage } from '@/lib/utils';
import { swaps, TASK_STATUSES, type TaskKind, type TaskStatus } from '@/lib/ops-program';
import { attention, completion, farmRows, monthBars, summaryOf, taskViews, type TaskView } from '@/lib/ops-view';
import { useOpsPrograms } from '@/hooks/useOpsPrograms';
import { useText } from '@/hooks/useText';
import type { ERPLivestockData } from '@/lib/types';
import { Fold, StatusBanner } from './parts';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

const BAR: Record<TaskStatus, string> = {
  done: 'bg-emerald-500', in_progress: 'bg-sky-500', due_soon: 'bg-amber-400', planned: 'bg-slate-300', late: 'bg-rose-500', postponed: 'bg-violet-400', cancelled: 'bg-slate-200',
};
const DOT: Record<TaskStatus, string> = {
  done: 'bg-emerald-500', in_progress: 'bg-sky-500', due_soon: 'bg-amber-400', planned: 'bg-slate-300', late: 'bg-rose-500', postponed: 'bg-violet-400', cancelled: 'bg-slate-200',
};
const KIND_ICON: Record<TaskKind, React.ReactNode> = {
  sell_to_farm: <Truck className="h-5 w-5" aria-hidden />,
  buy_back: <Undo2 className="h-5 w-5" aria-hidden />,
};
const KINDS: TaskKind[] = ['sell_to_farm', 'buy_back'];

function monthName(month: string, language: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(language === 'km' ? 'km-KH' : undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Reports → Operations status: how the farm programs' tasks stand (cattle sold to the farm, buy-backs, DSR-16 feed).
 * Read only. The status comes from the dates and the real records, so Admin and Management see the same.
 */
export default function OperationsStatus({ data, farm, onOpenActionPlans }: { data: ERPLivestockData; farm: string; onOpenActionPlans?: () => void }) {
  const { tx, language } = useText('opsTasks');
  const query = useOpsPrograms();
  const ops = query.data;

  const farmOfProgram = useMemo(() => new Map((ops?.programs ?? []).map(p => [p.id, p.farm])), [ops]);
  const allViews = useMemo(() => (ops ? taskViews(ops.tasks, farmOfProgram, data.stock, data.salesTracking) : []), [ops, farmOfProgram, data.stock, data.salesTracking]);
  const views: TaskView[] = useMemo(() => allViews.filter(v => !farm || farmOfProgram.get(v.task.programId) === farm), [allViews, farm, farmOfProgram]);
  const programs = useMemo(() => (ops?.programs ?? []).filter(p => !farm || p.farm === farm), [ops, farm]);
  const today = farmToday();
  const sum = summaryOf(views);
  // The bar counts what is due soon enough to matter (a program runs a year ahead, so most tasks are far off).
  const horizon = addDays(today, 30);
  const barViews = views.filter(v => v.task.dueDate <= horizon || v.state.status !== 'planned');
  const barSum = summaryOf(barViews);
  // Per kind: what was due by today against what is done, and the whole program in small print.
  const byKind = Object.fromEntries(KINDS.map(k => {
    const mine = views.filter(v => v.task.kind === k && v.state.status !== 'cancelled');
    const due = mine.filter(v => v.task.dueDate <= today);
    return [k, {
      tasks: due.length, done: due.filter(v => v.state.status === 'done').length, late: mine.filter(v => v.state.status === 'late').length,
      plannedHead: due.reduce((s, v) => s + (v.task.plannedHead ?? 0), 0), doneHead: due.reduce((s, v) => s + Math.round(v.evidence.doneAmount), 0),
      programKg: mine.reduce((s, v) => s + (v.task.plannedKg ?? 0), 0), programValue: mine.reduce((s, v) => s + (v.task.plannedValue ?? 0), 0),
      soldValue: k === 'buy_back' ? mine.reduce((s, v) => s + (v.evidence.doneValue ?? 0), 0) : 0,
    }];
  })) as Record<TaskKind, { tasks: number; done: number; late: number; plannedHead: number; doneHead: number; programKg: number; programValue: number; soldValue: number }>;
  const done = completion(views, today);
  const attn = attention(views);
  const rows = farmRows(views, programs);
  const bars = monthBars(views);
  const openSwaps = (() => {
    const status = new Map(views.map(v => [v.task.id, v.state.status]));
    let n = 0;
    for (const p of programs) n += swaps(views.filter(v => v.task.programId === p.id).map(v => v.task), t => status.get(t.id) ?? 'planned').filter(s => s.state === 'open').length;
    return n;
  })();

  if (query.isLoading) return <p className="text-lg text-ink-muted" role="status">{tx('loading')}</p>;
  if (query.isError || !ops) {
    return (
      <div className="space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{getErrorMessage(query.error, tx('loadFailed'))}</p>
        <Button onClick={() => query.refetch()}>{tx('retry')}</Button>
      </div>
    );
  }

  const total = TASK_STATUSES.filter(s => s !== 'cancelled').reduce((n, s) => n + barSum.byStatus[s], 0);
  const severe = attn.late.filter(v => v.state.severe).length;
  const tile = (label: string, value: React.ReactNode, sub: string, color?: string) => (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-ink" style={{ color }}>{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{sub}</p>
    </div>
  );
  const level: 'act' | 'watch' | 'ok' = sum.byStatus.late > 0 ? 'act' : sum.byStatus.due_soon > 0 ? 'watch' : 'ok';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-xl font-semibold text-ink">{tx('opsTitle')}</h3>
        {onOpenActionPlans && <Button variant="outline" onClick={onOpenActionPlans}><ClipboardList /> {tx('opsOpenActionPlans')}</Button>}
      </div>

      {views.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-base text-ink-muted">{tx('opsEmpty')}</p> : (
        <>
          <StatusBanner level={level}>
            <p className="text-lg text-ink">{tx('opsStatusLine', { late: sum.byStatus.late, soon: sum.byStatus.due_soon })}</p>
          </StatusBanner>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={tx('opsTitle')}>
            {tile(tx('opsCompletion'), `${done.pct}%`, tx('opsCompletionSub', { done: done.doneToDate, due: done.dueToDate }), '#138E46')}
            {tile(tx('opsLate'), sum.byStatus.late, tx('opsLateSub', { n: severe }), sum.byStatus.late > 0 ? '#B32C33' : undefined)}
            {tile(tx('opsDueSoon'), sum.byStatus.due_soon, tx('st_due_soon'), sum.byStatus.due_soon > 0 ? '#B4690E' : undefined)}
            {tile(tx('opsDelayed'), sum.delayed, tx('opsDelayedSub'), sum.delayed > 0 ? '#6D4BB5' : undefined)}
            {tile(tx('opsSwaps'), openSwaps, tx('opsSwapsSub'), openSwaps > 0 ? '#B4690E' : undefined)}
          </section>

          <section className="space-y-2" aria-label={tx('opsTitle')}>
            <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={TASK_STATUSES.filter(s => s !== 'cancelled' && barSum.byStatus[s] > 0).map(s => `${tx(`st_${s}`)} ${barSum.byStatus[s]}`).join(', ')}>
              {TASK_STATUSES.filter(s => s !== 'cancelled').map(s => barSum.byStatus[s] > 0 && <div key={s} className={BAR[s]} style={{ width: `${(barSum.byStatus[s] / Math.max(1, total)) * 100}%` }} />)}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
              {TASK_STATUSES.filter(s => s !== 'cancelled' && barSum.byStatus[s] > 0).map(s => <li key={s} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${DOT[s]}`} aria-hidden /> {tx(`st_${s}`)} {barSum.byStatus[s]}</li>)}
            </ul>
            <p className="text-sm text-ink-muted">{tx('opsBarHint')}</p>
          </section>

          <section className="space-y-3" aria-labelledby="ops-kinds">
            <h4 id="ops-kinds" className="text-lg font-semibold text-ink">{tx('opsByKind')}</h4>
            <div className="grid gap-3 md:grid-cols-3">
              {KINDS.map(k => {
                const t = byKind[k];
                return (
                  <div key={k} className="space-y-1 rounded-xl bg-white ring-1 ring-slate-200 p-4">
                    <p className="flex items-center gap-2 text-lg font-semibold text-ink">{KIND_ICON[k]} {tx(`kind_${k}`)}</p>
                    <p className="text-base text-ink">{tx('opsKindTasks', { done: t.done, n: t.tasks })}{t.late > 0 && <span className="font-semibold text-rose-800"> · {tx('st_late')} {t.late}</span>}</p>
                    <p className="text-base text-ink-muted">{tx('opsKindHead', { done: t.doneHead, planned: t.plannedHead })}</p>
                    {t.soldValue > 0 && <p className="text-sm text-ink-muted">{tx('opsKindSold', { value: riel(t.soldValue) })}</p>}
                    <p className="text-sm text-ink-muted">{tx('opsKindKg', { kg: Math.round(t.programKg).toLocaleString(), value: riel(t.programValue) })}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="ops-attention">
            <h4 id="ops-attention" className="text-lg font-semibold text-ink">{tx('opsAttention')}</h4>
            {attn.late.length === 0 && attn.delayed.length === 0 ? <p className="text-base text-ink-muted">{tx('opsNoAttention')}</p> : (
              <div className="grid gap-3 lg:grid-cols-2">
                {attn.late.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="font-semibold" style={{ color: '#B32C33' }}>{tx('opsLateList')} ({attn.late.length})</p>
                    <ul className="space-y-2">
                      {attn.late.slice(0, 8).map(v => (
                        <li key={v.task.id} className="text-base text-ink">
                          <span className="font-semibold">{farmOfProgram.get(v.task.programId)}</span> · {tx(`kind_${v.task.kind}`)} · {v.state.daysLate === 1 ? tx('dayLateOne') : tx('daysLateN', { n: v.state.daysLate })}
                          <span className="block text-sm opacity-80">{tx('due', { day: shownDay(v.task.dueDate, language) })}{v.task.owner ? ` · ${tx('owner', { name: v.task.owner })}` : ` · ${tx('noOwner')}`}{v.task.notes ? ` · ${v.task.notes}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {attn.delayed.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="font-semibold" style={{ color: '#6D4BB5' }}>{tx('opsDelayedList')} ({attn.delayed.length})</p>
                    <ul className="space-y-2">
                      {attn.delayed.slice(0, 8).map(v => (
                        <li key={v.task.id} className="text-base text-ink">
                          <span className="font-semibold">{farmOfProgram.get(v.task.programId)}</span> · {tx(`kind_${v.task.kind}`)} · {tx('delayFlag', { n: v.state.delayDays })}
                          <span className="block text-sm opacity-80">{tx('movedFrom', { day: shownDay(v.task.originalDueDate, language) })} → {shownDay(v.task.dueDate, language)}{v.task.reason ? ` · ${v.task.reason}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <Fold title={tx('opsByFarm')} headline={tx('opsFarmsHeadline', { n: rows.length })}>
            <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
              <table className="w-full min-w-[720px] text-left text-base">
                <thead className="bg-slate-50 text-ink-muted">
                  <tr>
                    <th className="px-3 py-3 font-medium">{tx('opsColFarm')}</th>
                    <th className="px-3 py-3 text-right font-medium">{tx('opsColLate')}</th>
                    <th className="px-3 py-3 text-right font-medium">{tx('opsColSoon')}</th>
                    <th className="px-3 py-3 text-right font-medium">{tx('opsColProgress')}</th>
                    <th className="px-3 py-3 text-right font-medium">{tx('opsColDone')}</th>
                    <th className="px-3 py-3 font-medium">{tx('opsColNext')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.farm} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-ink"><span className="font-medium">{r.farm}</span><span className="block text-sm text-ink-muted">{r.plan}{r.status === 'Paused' ? ` · ${tx('opsPaused')}` : ''}</span></td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.late > 0 ? 'font-semibold text-rose-800' : 'text-ink'}`}>{r.late}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{r.dueSoon}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{r.inProgress}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{r.done} / {r.total}</td>
                      <td className="px-3 py-2 text-ink">{r.next ? <>{tx(`kind_${r.next.kind}`)}<span className={`block text-sm ${r.next.late ? 'text-rose-800' : 'text-ink-muted'}`}>{shownDay(r.next.dueDate, language)}</span></> : <span className="text-ink-muted">{tx('opsNothingLeft')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Fold>

          {bars.length > 0 && (
            <Fold title={tx('opsByMonth')} headline={tx('opsMonthsHeadline', { n: bars.length })} note={tx('opsMonthHint')}>
              <div className="flex items-end gap-2 overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200 p-4">
                {(() => {
                  const max = Math.max(...bars.map(b => b.total));
                  return bars.map(b => (
                    <div key={b.month} className="flex min-w-14 flex-1 flex-col items-center gap-1">
                      <span className="text-sm tabular-nums text-ink">{b.total}</span>
                      <div className="flex w-full flex-col-reverse overflow-hidden rounded-md" style={{ height: `${Math.max(8, (b.total / max) * 120)}px` }}>
                        {TASK_STATUSES.filter(s => s !== 'cancelled' && b.counts[s] > 0).map(s => <div key={s} className={BAR[s]} style={{ flexGrow: b.counts[s] }} title={`${tx(`st_${s}`)} ${b.counts[s]}`} />)}
                      </div>
                      <span className="text-xs text-ink-muted">{monthName(b.month, language)}</span>
                    </div>
                  ));
                })()}
              </div>
            </Fold>
          )}
        </>
      )}
    </div>
  );
}
