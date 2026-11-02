'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PageTabs from '@/components/ui/page-tabs';
import { FarmSelect } from '@/components/ui/listbox-select';
import { Building2, CalendarDays, CheckCircle2, ChevronDown, Truck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changeOpsTaskAction } from '@/app/actions';
import { canManagePrograms, taskChangeProblem, type Task, type TaskChange, type TaskKind, type TaskStatus } from '@/lib/ops-program';
import { daysUntil, finishedTasks, swapStates, todoGroups, type TaskView } from '@/lib/ops-view';
import { addDays, farmToday } from '@/lib/daily-feed';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { dayLabel } from '../feed/DailyFeedFlow';
import type { TaskEvent } from '@/repositories/ops-program.repository';
import type { UserRoleItem } from '@/lib/types';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

const PILL: Record<TaskStatus, string> = {
  planned: 'bg-slate-100 text-slate-800',
  due_soon: 'bg-amber-100 text-amber-900',
  in_progress: 'bg-sky-100 text-sky-900',
  done: 'bg-emerald-100 text-emerald-900',
  late: 'bg-rose-100 text-rose-900',
  postponed: 'bg-violet-100 text-violet-900',
  cancelled: 'bg-slate-100 text-slate-500 line-through',
};
const KIND_ICON: Record<TaskKind, React.ReactNode> = {
  sell_to_farm: <Truck className="h-5 w-5" aria-hidden />,
  buy_back: <Undo2 className="h-5 w-5" aria-hidden />,
};
const KIND_TINT: Record<TaskKind, string> = {
  sell_to_farm: 'bg-emerald-100 text-emerald-800',
  buy_back: 'bg-sky-100 text-sky-800',
};

interface Props {
  currentUser: UserRoleItem;
  views: TaskView[];
  farmOfProgram: Map<string, string>;
  events: TaskEvent[];
  onChanged: () => void;
  /** Starts the real work for a task (opens Add cattle or the buy-back flow). */
  onDoTask?: (task: Task, farm: string, title: string) => void;
}

type Segment = 'todo' | 'late' | 'done';
export type Mode = null | 'start' | 'postpone' | 'cancel' | 'done' | 'adjust' | 'notes';

/**
 * The work list: what is late, what is due this week, and the rest behind one button. Each task says in plain words what
 * to do, and the two things operations do most (Mark done, Postpone) are one tap away. Management reads the same list.
 */
export default function OpsTasks({ currentUser, views, farmOfProgram, events, onChanged, onDoTask }: Props) {
  const { tx, txn } = useText('opsTasks');
  const writer = canManagePrograms(currentUser);
  const today = farmToday();
  const [segment, setSegment] = useState<Segment>('todo');
  const [farm, setFarm] = useState('');
  const [showLater, setShowLater] = useState(false);
  const [showOlderDone, setShowOlderDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const farms = useMemo(() => [...new Set(views.map(v => farmOfProgram.get(v.task.programId) ?? ''))].filter(Boolean).sort(), [views, farmOfProgram]);
  const inFarm = useMemo(() => views.filter(v => !farm || farmOfProgram.get(v.task.programId) === farm), [views, farm, farmOfProgram]);
  const groups = useMemo(() => todoGroups(inFarm, today), [inFarm, today]);
  const finished = useMemo(() => finishedTasks(inFarm, today, showOlderDone ? 0 : 30), [inFarm, today, showOlderDone]);
  const finishedAll = useMemo(() => finishedTasks(inFarm, today, 0).length, [inFarm, today]);
  const swapOf = useMemo(() => swapStates(views), [views]);

  if (views.length === 0) return <p className="rounded-2xl bg-slate-50 p-5 text-base text-ink-muted">{tx('noProgramsYet')}</p>;

  // "To do" counts what the list shows by default; the rest waits behind "Show later tasks".
  const openCount = groups.late.length + groups.week.length;
  const card = (v: TaskView) => (
    <li key={v.task.id}>
      <TaskCard
        v={v}
        farm={farmOfProgram.get(v.task.programId) ?? ''}
        swap={swapOf.get(v.task.id)}
        events={events.filter(e => e.taskId === v.task.id)}
        writer={writer}
        open={openId === v.task.id}
        onToggle={() => setOpenId(openId === v.task.id ? null : v.task.id)}
        onChanged={onChanged}
        onDo={onDoTask}
        compact
      />
    </li>
  );
  // Under a title, the tasks are grouped by farm (the farm with the oldest task first) so each farm's work reads together.
  const byFarm = (list: TaskView[]) => {
    const map = new Map<string, TaskView[]>();
    for (const v of list) {
      const f = farmOfProgram.get(v.task.programId) ?? '';
      map.set(f, [...(map.get(f) ?? []), v]);
    }
    return [...map.entries()].sort((x, y) => x[1][0].task.dueDate.localeCompare(y[1][0].task.dueDate) || x[0].localeCompare(y[0]));
  };
  const section = (title: string, tone: string, list: TaskView[], summary?: React.ReactNode) => list.length > 0 && (
    <section className="space-y-3" aria-label={title}>
      <h3 className={`flex items-center gap-2 text-lg font-semibold ${tone}`}>{title}{!summary && <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold tabular-nums ring-1 ring-current">{list.length}</span>}</h3>
      {summary}
      {farm || farms.length < 2
        ? <ul className="space-y-3">{list.map(card)}</ul>
        : byFarm(list).map(([name, tasks]) => (
          <div key={name} className="space-y-2">
            <h4 className="flex items-center gap-2 text-base font-semibold text-ink"><Building2 className="h-4 w-4 text-ink-muted" aria-hidden />{name}<span className="text-sm font-normal text-ink-muted">{txn(tasks.length, 'farmTaskOne', 'farmTaskMany')}</span></h4>
            <ul className="space-y-3">{tasks.map(card)}</ul>
          </div>
        ))}
    </section>
  );
  // One sentence on how bad it is, and the farms with late work (a tap shows only that farm), so the first look says where to start.
  const lateByFarm = [...byFarm(groups.late)].map(([name, tasks]) => ({ name, n: tasks.length })).sort((x, y) => y.n - x.n || x.name.localeCompare(y.name));
  const lateSummary = groups.late.length > 1 && (
    <div className="space-y-2 rounded-xl bg-rose-50 p-3 text-base text-rose-900">
      <p>{tx('lateSummary', { tasks: txn(groups.late.length, 'lateTaskOne', 'lateTaskMany'), farms: txn(lateByFarm.length, 'lateFarmOne', 'lateFarmMany'), days: Math.max(...groups.late.map(v => v.state.daysLate)) })}</p>
      {!farm && lateByFarm.length > 1 && (
        <p className="flex flex-wrap items-center gap-2">
          {lateByFarm.map(f => (
            <button key={f.name} type="button" onClick={() => setFarm(f.name)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-rose-900 ring-1 ring-rose-200 hover:ring-rose-400">
              {f.name} <span className="tabular-nums font-semibold">{f.n}</span>
            </button>
          ))}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* The same tab bar and farm choice as Batches and Reports; the red number on Late is the warning. */}
      <div className="flex flex-wrap items-center gap-3">
        <PageTabs
          label={tx('tasksTitle')}
          active={segment}
          onChange={id => setSegment(id as Segment)}
          tabs={[
            { id: 'todo', label: `${tx('segTodo')} (${openCount})` },
            { id: 'late', label: tx('segLate'), ...(groups.late.length > 0 ? { badge: { n: groups.late.length, tone: 'bad' as const } } : {}) },
            { id: 'done', label: `${tx('segDone')} (${finishedAll})` },
          ]}
        />
        {farms.length > 1 && <FarmSelect farms={farms} value={farm} onChange={setFarm} allLabel={tx('allFarms')} label={tx('fFarm')} size="compact" align="right" className="ml-auto" />}
      </div>

      {!writer && <p className="text-sm text-ink-muted">{tx('readOnly')}</p>}

      {segment === 'todo' && (
        <div className="space-y-6">
          {groups.late.length + groups.week.length === 0 && (
            <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-5 text-lg text-emerald-900"><CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden /> {tx('allClear')}</p>
          )}
          {section(tx('grpLate'), 'text-rose-800', groups.late, lateSummary)}
          {section(tx('grpWeek'), 'text-ink', groups.week)}
          {groups.later.length > 0 && (
            <div className="space-y-3">
              <Button variant="outline" className="w-full" aria-expanded={showLater} onClick={() => setShowLater(v => !v)}>
                {showLater ? tx('hideLater') : tx('showLater', { n: groups.later.length })}
              </Button>
              {showLater && section(tx('grpLater'), 'text-ink-muted', groups.later)}
            </div>
          )}
        </div>
      )}

      {segment === 'late' && (groups.late.length === 0
        ? <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-5 text-lg text-emerald-900"><CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden /> {tx('noLate')}</p>
        : section(tx('grpLate'), 'text-rose-800', groups.late, lateSummary))}

      {segment === 'done' && (
        <div className="space-y-3">
          {finished.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-base text-ink-muted">{tx('noDone')}</p> : <ul className="space-y-3">{finished.map(card)}</ul>}
          {!showOlderDone && finishedAll > finished.length && <Button variant="outline" className="w-full" onClick={() => setShowOlderDone(true)}>{tx('showOlderDone')}</Button>}
        </div>
      )}
    </div>
  );
}

/** Works one task through the server: checks the change first so the message appears at once. */
function useTaskChange(task: Task, onChanged: () => void) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (change: TaskChange): Promise<boolean> => {
    const problem = taskChangeProblem(task, change, farmToday());
    if (problem) { setError(problem); return false; }
    setBusy(true);
    setError('');
    const res = await changeOpsTaskAction(task.id, change);
    setBusy(false);
    if (!res.success) { setError(res.error); return false; }
    queryClient.invalidateQueries({ queryKey: ['ops-programs'] });
    onChanged();
    return true;
  };
  return { run, busy, error, setError };
}

export function TaskCard({ v, farm, swap, events, writer, open, onToggle, onChanged, onDo, compact = false }: {
  v: TaskView; farm: string; swap?: 'complete' | 'open' | 'waiting'; events: TaskEvent[]; writer: boolean; open: boolean; onToggle: () => void; onChanged: () => void;
  /** Starts the real work (Add cattle for a sale to the farm, Record the buy-back); given the task, its farm and its sentence. */
  onDo?: (task: Task, farm: string, title: string) => void;
  /** The work-list row: on a wide screen the buttons sit to the right of the task instead of under it. */
  compact?: boolean;
}) {
  const { tx, language } = useText('opsTasks');
  const { task: t, state: s, evidence } = v;
  const [mode, setMode] = useState<Mode>(null);
  const change = useTaskChange(t, onChanged);
  const planned = t.plannedHead ?? 0;
  const partial = s.status !== 'done' && evidence.doneAmount > 0 && planned > 0;
  const isOpen = s.status !== 'done' && s.status !== 'cancelled';
  const today = farmToday();

  const title = tx(`act_${t.kind}`, { n: t.plannedHead ?? 0, farm });
  const left = daysUntil(t.dueDate, today);
  const when = s.status === 'late'
    ? (s.daysLate === 1 ? tx('dayLateOne') : tx('daysLateN', { n: s.daysLate }))
    : left <= 0 ? tx('whenToday') : left === 1 ? tx('whenTomorrow') : tx('whenInDays', { n: left });
  // The title already says how many cattle; the line under it adds the weight and (for readers who cannot write) the value.
  const amountParts = [t.plannedKg ? tx('kgN', { n: t.plannedKg.toLocaleString() }) : '', !writer && t.plannedValue ? tx('value', { amount: riel(t.plannedValue) }) : ''].filter(Boolean);
  const accent = s.status === 'late' ? (s.severe ? 'bg-rose-600' : 'bg-rose-400') : s.status === 'due_soon' ? 'bg-amber-400' : s.status === 'in_progress' ? 'bg-sky-500' : s.status === 'done' ? 'bg-emerald-500' : s.status === 'postponed' ? 'bg-violet-400' : 'bg-slate-300';
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm ${compact ? 'md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-center md:gap-x-5' : ''}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} aria-hidden />
      <div className="min-w-0">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${KIND_TINT[t.kind]}`}>{KIND_ICON[t.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-semibold leading-snug text-ink">{title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base text-ink-muted">
            <span className="inline-flex items-center gap-1.5 text-ink"><CalendarDays className="h-4 w-4 text-ink-muted" aria-hidden />{isOpen ? dayLabel(t.dueDate, language) : tx('due', { day: dayLabel(t.dueDate, language) })}</span>
          </p>
          {(amountParts.length > 0 || t.originalDueDate !== t.dueDate) && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-base text-ink-muted">
              {amountParts.map(a => <span key={a} className="whitespace-nowrap">{a}</span>)}
              {t.originalDueDate !== t.dueDate && <span>{tx('movedFrom', { day: dayLabel(t.originalDueDate, language) })}</span>}
            </p>
          )}
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${isOpen && (s.status === 'planned' || s.status === 'due_soon' || s.status === 'late') ? (s.status === 'late' ? 'bg-rose-100 text-rose-900' : s.status === 'due_soon' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800') : PILL[s.status]}`}>
          {isOpen && (s.status === 'planned' || s.status === 'due_soon' || s.status === 'late') ? when : tx(`st_${s.status}`)}
        </span>
      </div>

      {partial && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)}>
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round(s.progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{tx('progressCattle', { done: Math.round(evidence.doneAmount), total: planned })}</p>
        </div>
      )}
      {s.status === 'done' && s.byHand && <p className="mt-2 text-sm text-amber-800">{tx('byHand')}{t.doneOn && t.doneBy ? ` · ${tx('doneOnBy', { day: shownDay(t.doneOn, language), name: t.doneBy })}` : ''}</p>}
      {s.delayDays > 0 && s.status !== 'done' && <p className="mt-2 text-sm text-violet-800">{tx('delayFlag', { n: s.delayDays })}{t.reason ? ` · ${t.reason}` : ''}</p>}
      {swap && <p className={`mt-2 text-sm ${swap === 'open' ? 'font-medium text-amber-800' : 'text-ink-muted'}`}>{swap === 'open' ? tx(t.kind === 'buy_back' ? 'swapOpenCollect' : 'swapOpenSell') : tx('sameDay')}</p>}
      </div>

      {!mode && (
        <div className={`mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 ${compact ? 'md:mt-0 md:flex-col md:items-stretch md:border-0 md:pt-0' : ''}`}>
          {writer && isOpen && onDo && <Button className="min-h-12 w-full" onClick={() => onDo(t, farm, title)}>{tx(t.kind === 'sell_to_farm' ? 'aDoSell' : 'aDoBuyback')}</Button>}
          <div className={`flex flex-wrap items-center gap-2 ${writer && isOpen && onDo ? 'w-full' : ''}`}>
            {writer && isOpen && (
              <>
                <Button variant={onDo ? 'outline' : 'default'} className={`min-w-0 flex-1 ${compact ? 'min-h-11 px-2 text-sm md:text-base' : 'min-h-12'}`} onClick={() => setMode('done')}>{tx('aDone')}</Button>
                <Button variant="outline" className={`min-w-0 flex-1 ${compact ? 'min-h-11 px-2 text-sm md:text-base' : 'min-h-12'}`} onClick={() => setMode('postpone')}>{tx('aPostpone')}</Button>
              </>
            )}
            <Button variant="ghost" className={`shrink-0 ${compact ? 'min-h-11 px-2' : 'min-h-12'}`} aria-expanded={open} onClick={onToggle}>
              <span className={compact ? 'md:sr-only' : ''}>{writer && isOpen ? (open ? tx('bLess') : tx('bMore')) : tx('bDetails')}</span> <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </Button>
          </div>
          {t.owner && <span className="min-w-0 truncate text-sm text-ink-muted">{tx('owner', { name: t.owner })}</span>}
        </div>
      )}

      {mode && writer && <div className={compact ? 'md:col-span-2' : ''}><TaskForm task={t} mode={mode} change={change} onClose={() => { setMode(null); change.setError(''); }} /></div>}
      {open && !mode && <div className={compact ? 'md:col-span-2' : ''}><TaskMore task={t} status={s.status} events={events} writer={writer} change={change} onMode={setMode} /></div>}
    </div>
  );
}

type TaskChanger = ReturnType<typeof useTaskChange>;

/** The small form under a task for one action; saving closes it. */
function TaskForm({ task, mode, change, onClose }: { task: Task; mode: Exclude<Mode, null>; change: TaskChanger; onClose: () => void }) {
  const { tx } = useText('opsTasks');
  const today = farmToday();
  // A late task's own date is already past, so the new date starts a week from today (or from its date, when that is later).
  const [f, setF] = useState({
    owner: task.owner, notes: task.notes, newDate: addDays(task.dueDate > today ? task.dueDate : today, 7), reason: '', note: '', doneOn: today,
    head: String(task.plannedHead ?? ''), kg: String(task.plannedKg ?? ''), price: String(task.pricePerKg ?? ''),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(x => ({ ...x, [k]: e.target.value })); change.setError(''); };
  const field = 'min-h-12 text-base';

  const submit = async () => {
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    let c: TaskChange;
    switch (mode) {
      case 'start': c = { action: 'start', owner: f.owner }; break;
      case 'postpone': c = { action: 'postpone', newDueDate: f.newDate, reason: f.reason }; break;
      case 'cancel': c = { action: 'cancel', reason: f.reason }; break;
      case 'done': c = { action: 'done', note: f.note, doneOn: f.doneOn }; break;
      case 'adjust': {
        const head = num(f.head), kg = num(f.kg), price = num(f.price);
        c = { action: 'adjust', ...(head !== undefined && head !== task.plannedHead ? { plannedHead: head } : {}), ...(kg !== undefined && kg !== task.plannedKg ? { plannedKg: kg } : {}), ...(price !== undefined && price !== task.pricePerKg ? { pricePerKg: price } : {}), reason: f.reason };
        break;
      }
      default: c = { action: 'note', owner: f.owner, notes: f.notes };
    }
    if (await change.run(c)) onClose();
  };

  const label = (key: string, children: React.ReactNode) => <label className="block space-y-1"><span className="text-base font-medium text-ink">{tx(key)}</span>{children}</label>;
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      {(mode === 'start' || mode === 'notes') && label('lOwner', <Input className={field} value={f.owner} maxLength={100} onChange={set('owner')} />)}
      {mode === 'notes' && label('lNotes', <textarea className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base" rows={3} maxLength={1000} value={f.notes} onChange={set('notes')} />)}
      {mode === 'postpone' && label('lNewDate', <Input type="date" className={field} min={today} value={f.newDate} onChange={set('newDate')} />)}
      {mode === 'done' && label('lDoneOn', <Input type="date" className={field} max={today} value={f.doneOn} onChange={set('doneOn')} />)}
      {mode === 'adjust' && (
        <div className="grid gap-3 sm:grid-cols-3">
          {label('lHead', <Input inputMode="numeric" className={field} value={f.head} onChange={set('head')} />)}
          {label('lKg', <Input inputMode="decimal" className={field} value={f.kg} onChange={set('kg')} />)}
          {label('lPrice', <Input inputMode="decimal" className={field} value={f.price} onChange={set('price')} />)}
        </div>
      )}
      {(mode === 'postpone' || mode === 'cancel' || mode === 'adjust') && label('lReason', <><Input className={field} value={f.reason} maxLength={300} onChange={set('reason')} /><span className="block text-sm text-ink-muted">{tx('reasonHint')}</span></>)}
      {mode === 'done' && (
        <div className="space-y-2">
          {label('lNote', <Input className={field} value={f.note} maxLength={300} onChange={set('note')} />)}
          <div className="flex flex-wrap gap-2" role="group" aria-label={tx('lNote')}>
            {(['quickAsPlanned', 'quickRecordsFollow'] as const).map(k => (
              <Button key={k} type="button" size="sm" variant="outline" onClick={() => { setF(x => ({ ...x, note: tx(k) })); change.setError(''); }}>{tx(k)}</Button>
            ))}
          </div>
        </div>
      )}
      {change.error && <p role="alert" className="text-base text-rose-800">{change.error}</p>}
      <div className="flex gap-2">
        <Button className="min-h-12 flex-1 sm:flex-none" disabled={change.busy} onClick={submit}>{change.busy ? tx('saving') : tx('save')}</Button>
        <Button className="min-h-12" variant="ghost" onClick={onClose}>{tx('close')}</Button>
      </div>
    </div>
  );
}

/** The less common actions and the task's history, behind "More". */
function TaskMore({ task, status, events, writer, change, onMode }: { task: Task; status: TaskStatus; events: TaskEvent[]; writer: boolean; change: TaskChanger; onMode: (m: Exclude<Mode, null>) => void }) {
  const { tx, language } = useText('opsTasks');
  const cancelled = task.manualState === 'cancelled';
  const finished = status === 'done';
  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      {writer && (
        <div className="flex flex-wrap gap-2">
          {!cancelled && !finished && <Button size="sm" variant="outline" onClick={() => onMode('start')}>{tx('aStart')}</Button>}
          {!cancelled && !finished && <Button size="sm" variant="outline" onClick={() => onMode('adjust')}>{tx('aAdjust')}</Button>}
          {!cancelled && <Button size="sm" variant="outline" onClick={() => onMode('cancel')}>{tx('aCancel')}</Button>}
          {task.manualState && <Button size="sm" variant="outline" disabled={change.busy} onClick={() => change.run({ action: 'reopen' })}>{tx('aReopen')}</Button>}
          <Button size="sm" variant="ghost" onClick={() => onMode('notes')}>{tx('aNotes')}</Button>
        </div>
      )}
      {change.error && <p role="alert" className="text-base text-rose-800">{change.error}</p>}
      {(task.notes || task.owner) && (
        <p className="text-sm text-ink-muted">{task.owner ? `${tx('owner', { name: task.owner })}` : ''}{task.owner && task.notes ? ' · ' : ''}{task.notes}</p>
      )}
      {events.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-ink">{tx('history')}</p>
          <ol className="mt-1 space-y-1">
            {[...events].reverse().map(e => (
              <li key={e.id} className="text-sm text-ink">
                <span className="tabular-nums text-ink-muted">{shownDay(farmToday(new Date(e.at)), language)}</span> · <span className="font-medium">{e.by}</span> {tx(`e_${e.action}` as 'e_created')}
                {e.note && e.action !== 'created' && <span className="block pl-4 text-ink-muted">“{e.note}”</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
