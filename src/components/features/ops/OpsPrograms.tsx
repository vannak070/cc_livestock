'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, Truck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Input } from '@/components/ui/input';
import { createFarmProgramAction, refreshFarmProgramAction, setFarmProgramStatusAction } from '@/app/actions';
import { buybackSchedule } from '@/lib/action-plans';
import { farmToday } from '@/lib/daily-feed';
import { limitState } from '@/lib/farm-limit';
import { shownDay } from '@/lib/khmer-date';
import { planDays } from '@/lib/plan-months';
import { canManagePrograms, generateTasks, limitCheck, programProblem, suggestedHeadPerCycle, type ProgramInput, type Task, type TaskKind, type TaskStatus } from '@/lib/ops-program';
import { swapStates, summaryOf, type TaskView } from '@/lib/ops-view';
import { canDropOn, canMoveTask, exchangePartner, farmColorMap } from '@/lib/ops-calendar';
import { useText } from '@/hooks/useText';
import type { TaskEvent, FarmProgram } from '@/repositories/ops-program.repository';
import type { BatchItem, FarmItem, ProposalPlanRecord, UserRoleItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import OpsCalendar, { type CalChip } from './OpsCalendar';
import { TaskCard } from './OpsTasks';
import OpsMoveDialog from './OpsMoveDialog';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

const STATUS_TONE: Record<TaskStatus, { tone: string; dot: string }> = {
  planned: { tone: 'bg-slate-100 text-slate-800', dot: 'bg-slate-400' },
  due_soon: { tone: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  in_progress: { tone: 'bg-sky-100 text-sky-900', dot: 'bg-sky-500' },
  done: { tone: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-500' },
  late: { tone: 'bg-rose-100 text-rose-900', dot: 'bg-rose-500' },
  postponed: { tone: 'bg-violet-100 text-violet-900', dot: 'bg-violet-500' },
  cancelled: { tone: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300' },
};
const KIND_PREVIEW: Record<TaskKind, { tone: string; dot: string }> = {
  sell_to_farm: { tone: 'text-emerald-800', dot: 'bg-emerald-500' },
  buy_back: { tone: 'text-sky-800', dot: 'bg-sky-500' },
};
const chipText = (_kind: TaskKind, head?: number) => String(head ?? 0);

interface Props {
  currentUser: UserRoleItem;
  farms: FarmItem[];
  programs: FarmProgram[];
  views: TaskView[];
  events: TaskEvent[];
  plans: ProposalPlanRecord[];
  batches: BatchItem[];
  stock: StockItem[];
  onChanged: () => void;
  onOpenTasks: () => void;
  /** Starts the real work for a task (opens Add cattle or the buy-back flow). */
  onDoTask?: (task: Task, farm: string, title: string) => void;
  /** A farm to open straight into its setup (from the 3-day calendar's "Set up" button). */
  initialFarm?: string;
}

interface Setup { slot: number; startDate: string; head: string; sellPrice: string; buyPrice: string; editing: boolean }

/** The form's first values: the first saved plan, today, the plan's suggested head count (or the program's own when editing). */
function newSetup(plans: ProposalPlanRecord[], p?: FarmProgram): Setup {
  const slot = p?.planSlot ?? plans[0]?.slot ?? 0;
  const pl = plans.find(x => x.slot === slot);
  return { slot, startDate: p?.startDate ?? farmToday(), head: String(p?.headPerCycle ?? (pl ? suggestedHeadPerCycle(pl.params) : '')), sellPrice: p?.purchasePricePerKg ? String(p.purchasePricePerKg) : '', buyPrice: p?.buybackPricePerKg ? String(p.buybackPricePerKg) : '', editing: !!p };
}

/**
 * Farm programs as a calendar. Pick a farm: its tasks show on the days they are due. A farm with no program is set up on the
 * calendar: choose the Planning plan and click the day the first cattle are sold to the farm; the tasks it will make
 * show as a dashed preview. Admins set up and change programs; Management sees the calendar.
 */
export default function OpsPrograms({ currentUser, farms, programs, views, events, plans, batches, stock, onChanged, onOpenTasks, onDoTask, initialFarm }: Props) {
  const { tx, language } = useText('opsTasks');
  const queryClient = useQueryClient();
  const writer = canManagePrograms(currentUser);
  const today = farmToday();
  const startsInSetup = !!initialFarm && writer && plans.length > 0 && !programs.some(p => p.farm.toLowerCase() === initialFarm.toLowerCase() && p.status !== 'Closed');
  const [farmName, setFarmName] = useState(initialFarm ?? '');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(() => (startsInSetup ? newSetup(plans) : null));
  const [progMore, setProgMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmText: string; onConfirm: () => void }>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // A task dragged to another day, waiting for the person to confirm.
  const [moving, setMoving] = useState<{ id: string; toDay: string } | null>(null);

  const farm = farms.find(f => f.name === farmName) ?? null;
  const openOf = (name: string) => programs.find(p => p.farm.toLowerCase() === name.toLowerCase() && p.status !== 'Closed');
  const program = farm ? openOf(farm.name) : undefined;
  const farmOfProgram = useMemo(() => new Map(programs.map(p => [p.id, p.farm])), [programs]);
  const changed = () => { queryClient.invalidateQueries({ queryKey: ['ops-programs'] }); onChanged(); };

  const shownViews = useMemo(() => views.filter(v => !farmName || farmOfProgram.get(v.task.programId) === farmName), [views, farmName, farmOfProgram]);
  const swapOf = useMemo(() => swapStates(shownViews), [shownViews]);

  // Setup mode: the program that would be made, drawn on the calendar as a dashed preview.
  const plan = setup ? plans.find(p => p.slot === setup.slot) : undefined;
  const input: ProgramInput | null = setup && plan && farm ? { farm: farm.name, startDate: setup.startDate, headPerCycle: Number(setup.head), plan: plan.params, purchasePricePerKg: num(setup.sellPrice), buybackPricePerKg: num(setup.buyPrice) } : null;
  const problem = setup ? (input ? programProblem(input) : tx('noPlans')) : null;
  const preview = useMemo(() => {
    if (!input || problem || !farm) return null;
    const running = buybackSchedule(batches, stock, [], farmToday()).filter(r => r.farm === farm.name).map(r => ({ batchId: r.batchId, name: r.batchName, head: r.head, estKg: r.estKg, dueDate: r.dueDate }));
    const gen = generateTasks(input, running);
    const ls = limitState(farm, stock);
    const count = (k: string) => gen.tasks.filter(t => t.kind === k).length;
    return { gen, sells: count('sell_to_farm'), buys: count('buy_back'), limit: ls.limit > 0 ? limitCheck(ls.left, input.headPerCycle, undefined, { startDate: input.startDate, today: farmToday() }) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.slot, setup?.startDate, setup?.head, setup?.sellPrice, setup?.buyPrice, farmName, batches, stock]);

  const chipsByDay = useMemo(() => {
    const map = new Map<string, CalChip[]>();
    const add = (day: string, c: CalChip) => map.set(day, [...(map.get(day) ?? []), c]);
    if (setup && preview) {
      for (const t of preview.gen.tasks) add(t.dueDate, { key: `p-${t.kind}-${t.cycleKey}-${t.product}`, kind: t.kind, text: chipText(t.kind, t.plannedHead), preview: true, ...KIND_PREVIEW[t.kind] });
    } else {
      for (const v of shownViews) add(v.task.dueDate, { key: v.task.id, kind: v.task.kind, text: chipText(v.task.kind, v.task.plannedHead), farm: farmOfProgram.get(v.task.programId), movable: writer && canMoveTask(v.state.status), ...STATUS_TONE[v.state.status] });
    }
    return map;
  }, [setup, preview, shownViews, farmOfProgram, writer]);

  const swapDays = useMemo(() => {
    const set = new Set<string>();
    if (setup && preview) {
      const buyDays = new Set(preview.gen.tasks.filter(t => t.kind === 'buy_back').map(t => t.dueDate));
      for (const t of preview.gen.tasks) if (t.kind === 'sell_to_farm' && buyDays.has(t.dueDate)) set.add(t.dueDate);
    } else {
      for (const v of shownViews) if (swapOf.has(v.task.id)) set.add(v.task.dueDate);
    }
    return set;
  }, [setup, preview, shownViews, swapOf]);

  // Farm colours and drag and drop (not while a program is being set up: the calendar is then used to pick the start day).
  const colors = useMemo(() => farmColorMap(programs.map(p => p.farm)), [programs]);
  const viewById = useMemo(() => new Map(shownViews.map(v => [v.task.id, v])), [shownViews]);
  const canDropChip = (key: string, toDay: string) => { const v = viewById.get(key); return !!v && canDropOn(v.task.dueDate, toDay, today); };
  const movingView = moving ? viewById.get(moving.id) : undefined;
  const farmsWithTasks = useMemo(() => [...new Set(views.map(v => farmOfProgram.get(v.task.programId)).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b)), [views, farmOfProgram]);

  const startSetup = (f: FarmItem, p?: FarmProgram) => {
    const next = newSetup(plans, p);
    setSetup(next);
    setMonth(next.startDate.slice(0, 7));
    setError('');
    void f;
  };

  const pickFarm = (name: string) => {
    setFarmName(name);
    setSelected(undefined);
    setOpenId(null);
    setMessage(null);
    setSetup(null);
    const f = farms.find(x => x.name === name);
    if (f && writer && !openOf(name) && plans.length > 0) startSetup(f);
    else setMonth(today.slice(0, 7));
  };

  const act = async (work: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setMessage(null);
    const res = await work();
    if (!res.success) { setMessage({ kind: 'error', text: res.error ?? '' }); return; }
    setMessage({ kind: 'ok', text: ok });
    changed();
  };

  const save = async () => {
    if (!setup || !input || problem || !farm) { setError(problem ?? ''); return; }
    setBusy(true);
    setError('');
    const body = { planSlot: setup.slot, startDate: setup.startDate, headPerCycle: input.headPerCycle, purchasePricePerKg: input.purchasePricePerKg, buybackPricePerKg: input.buybackPricePerKg };
    const res = program && setup.editing ? await refreshFarmProgramAction(program.id, body) : await createFarmProgramAction({ farm: farm.name, ...body });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setMessage({ kind: 'ok', text: program && setup.editing ? tx('refreshed', { n: res.data.tasks }) : tx('created', { n: res.data.tasks }) });
    setSetup(null);
    changed();
  };

  const dayViews = selected ? shownViews.filter(v => v.task.dueDate === selected) : [];
  const sum = summaryOf(program ? views.filter(v => v.task.programId === program.id) : []);
  const field = 'min-h-11 text-base';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-ink">{tx('calTitle')}</h3>
        <p className="text-base text-ink-muted">{tx('calHint')}</p>
      </div>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-xl p-3 text-base ${message.kind === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900'}`}>{message.text}</p>}

      <label className="flex max-w-xl flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-base font-medium text-ink">{tx('fFarm')}</span>
        <select className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-ink" value={farmName} onChange={e => pickFarm(e.target.value)}>
          <option value="">{tx('allFarms')}</option>
          {farms.map(f => <option key={f.id} value={f.name}>{`${openOf(f.name) ? '● ' : '○ '}${f.name} · ${openOf(f.name) ? tx('farmHasProgram') : tx('farmNoProgram')}`}</option>)}
        </select>
      </label>

      {farm && !(setup && !program) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold text-ink">{tx('farmProgram', { farm: farm.name })}</p>
            {program ? (
              <p className="text-base text-ink-muted">{tx('progLine', { plan: program.planName, day: shownDay(program.startDate, language), head: program.headPerCycle })} · {tx(`prog_${program.status}`)}
                <span className="block text-sm">{tx('progCounts', { late: sum.byStatus.late, soon: sum.byStatus.due_soon, done: sum.byStatus.done, all: views.filter(v => v.task.programId === program.id).length })}</span></p>
            ) : <p className="text-base text-ink-muted">{tx('noProgram')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onOpenTasks}><ClipboardList /> {tx('openTasks')}</Button>
            {writer && !program && !setup && plans.length > 0 && <Button size="sm" onClick={() => startSetup(farm)}>{tx('setUp')}</Button>}
            {writer && program && !setup && <Button size="sm" variant="outline" onClick={() => startSetup(farm, program)}>{tx('edit')}</Button>}
            {writer && program && !setup && (
              <Button size="sm" variant="ghost" aria-expanded={progMore} onClick={() => setProgMore(v => !v)}>{tx('progMore')} <ChevronDown className={`transition-transform ${progMore ? 'rotate-180' : ''}`} aria-hidden /></Button>
            )}
          </div>
          {writer && program && !setup && progMore && (
            <div className="flex w-full flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button size="sm" variant="outline" onClick={() => act(() => refreshFarmProgramAction(program.id, {}), tx('refreshed', { n: views.filter(v => v.task.programId === program.id).length }))}>{tx('refresh')}</Button>
              {program.status === 'Active' && <Button size="sm" variant="ghost" onClick={() => act(() => setFarmProgramStatusAction(program.id, 'Paused'), tx('prog_Paused'))}>{tx('pause')}</Button>}
              {program.status === 'Paused' && <Button size="sm" variant="ghost" onClick={() => act(() => setFarmProgramStatusAction(program.id, 'Active'), tx('prog_Active'))}>{tx('resume')}</Button>}
              <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => setConfirm({ title: tx('closeProgram'), description: tx('confirmClose', { farm: farm.name }), confirmText: tx('closeProgram'), onConfirm: () => { void act(() => setFarmProgramStatusAction(program.id, 'Closed'), tx('prog_Closed')); } })}>{tx('closeProgram')}</Button>
              <p className="w-full text-sm text-ink-muted">{tx('refreshHint')}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {setup && farm && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 lg:order-first" aria-labelledby="ops-setup">
            <div>
              <h4 id="ops-setup" className="text-lg font-semibold text-ink">{tx('setupTitle', { farm: farm.name })}</h4>
              <p className="text-sm text-ink-muted">{tx('setupIntro')}</p>
            </div>
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-base font-medium text-ink"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white" aria-hidden>1</span>{tx('planLabel')}</span>
              <select className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" value={setup.slot} onChange={e => { const slot = Number(e.target.value); const p = plans.find(x => x.slot === slot); setSetup(s => s && ({ ...s, slot, ...(p && !s.editing ? { head: String(suggestedHeadPerCycle(p.params)) } : {}) })); }}>
                {plans.map(p => <option key={p.slot} value={p.slot}>{p.name}</option>)}
              </select>
              {plan && <span className="block text-sm text-ink-muted">{tx('planSummary', { days: planDays(plan.params), buy: plan.params.purchasePricePerKgKhr.toLocaleString(), sell: plan.params.sellingPricePerKgKhr.toLocaleString() })}</span>}
            </label>
            <div className="space-y-1">
              <span className="flex items-center gap-2 text-base font-medium text-ink"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white" aria-hidden>2</span>{tx('startLabel')}</span>
              <Input type="date" className={field} value={setup.startDate} onChange={e => { setSetup(s => s && ({ ...s, startDate: e.target.value })); if (e.target.value) setMonth(e.target.value.slice(0, 7)); }} />
              <p className="text-sm text-ink-muted">{tx('calPick')}</p>
            </div>
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-base font-medium text-ink"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white" aria-hidden>3</span>{tx('headLabel')}</span>
              <Input inputMode="numeric" className={field} value={setup.head} onChange={e => setSetup(s => s && ({ ...s, head: e.target.value }))} />
              {plan && <span className="block text-sm text-ink-muted">{tx('headHint', { n: suggestedHeadPerCycle(plan.params) })}</span>}
            </label>
            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="min-h-8 cursor-pointer text-base font-medium text-ink">{tx('pricesOptional')}</summary>
              <div className="mt-3 space-y-3">
            <label className="block space-y-1"><span className="text-base font-medium text-ink">{tx('priceSellLabel')}</span><Input inputMode="decimal" className={field} placeholder={plan ? String(plan.params.purchasePricePerKgKhr) : ''} value={setup.sellPrice} onChange={e => setSetup(s => s && ({ ...s, sellPrice: e.target.value }))} /></label>
            <label className="block space-y-1"><span className="text-base font-medium text-ink">{tx('priceBuyLabel')}</span><Input inputMode="decimal" className={field} placeholder={plan ? String(plan.params.sellingPricePerKgKhr) : ''} value={setup.buyPrice} onChange={e => setSetup(s => s && ({ ...s, buyPrice: e.target.value }))} /></label>
            <p className="text-sm text-ink-muted">{tx('priceHint')}</p>

              </div>
            </details>

            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-ink">{tx('previewTitle')}</p>
              {problem ? <p className="text-base text-rose-800">{problem}</p> : preview && (
                <>
                  <p className="text-base text-ink">{tx('previewCount', { n: preview.gen.tasks.length, sells: preview.sells, buys: preview.buys, })}</p>
                  <p className="text-sm text-ink-muted">{tx('swapNote')}</p>
                  {preview.limit
                    ? <p className={`rounded-lg p-2 text-sm ${preview.limit.enough ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>{preview.limit.enough ? tx('limitOk', { left: preview.limit.placesLeft }) : tx('limitWarn', { needed: preview.limit.needed, left: preview.limit.placesLeft })}</p>
                    : <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950">{tx('limitNone')}</p>}
                  {preview.gen.undated.length > 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950">{tx('undatedWarn', { names: preview.gen.undated.map(b => b.name).join(', ') })}</p>}
                </>
              )}
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
            <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 rounded-b-2xl border-t border-slate-200 bg-white p-4">
              <Button disabled={busy || !!problem} onClick={save}>{busy ? tx('saving') : setup.editing ? tx('save') : tx('create')}</Button>
              <Button variant="ghost" onClick={() => { setSetup(null); setError(''); }}>{tx('close')}</Button>
            </div>
          </section>
        )}

        <div className={`space-y-3 ${setup ? '' : 'lg:col-span-2'}`}>
          {setup && <p className="rounded-xl bg-emerald-50 p-3 text-base text-emerald-950">{tx('calStart', { day: setup.startDate ? shownDay(setup.startDate, language) : '—' })} · {tx('calPreview')}</p>}
          <OpsCalendar
            month={month}
            onMonth={setMonth}
            chipsByDay={chipsByDay}
            selected={setup ? setup.startDate : selected}
            startDay={setup?.startDate}
            today={today}
            swapDays={swapDays}
            showFarm={!farmName && !setup}
            farmColor={f => colors.get(f)}
            onMove={writer && !setup ? (key, toDay) => setMoving({ id: key, toDay }) : undefined}
            canDrop={canDropChip}
            onSelect={day => { if (setup) { setSetup(s => s && ({ ...s, startDate: day })); } else { setSelected(day); setOpenId(null); } }}
          />
          {!setup && !farmName && farmsWithTasks.length > 1 && (
            <ul className="flex flex-wrap items-center gap-2" aria-label={tx('calFarms')}>
              {farmsWithTasks.map(f => (
                <li key={f}>
                  <button type="button" onClick={() => pickFarm(f)} className="flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-ink hover:border-emerald-600">
                    <span className={`h-3 w-3 rounded-full ${colors.get(f)?.dot ?? 'bg-slate-400'}`} aria-hidden />{f}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!setup && writer && <p className="text-sm text-ink-muted">{tx('calDragHint')}</p>}
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink-muted" aria-label={tx('calLegend')}>
            <li className="flex items-center gap-1.5"><Truck className="h-4 w-4" aria-hidden /> {tx('legendSell')}</li>
            <li className="flex items-center gap-1.5"><Undo2 className="h-4 w-4" aria-hidden /> {tx('legendBuy')}</li>
            <li aria-hidden className="hidden h-4 w-px bg-slate-300 sm:block" />
            {([['bg-slate-400', 'st_planned'], ['bg-amber-500', 'st_due_soon'], ['bg-sky-500', 'st_in_progress'], ['bg-emerald-500', 'st_done'], ['bg-rose-500', 'st_late'], ['bg-violet-500', 'st_postponed']] as const).map(([c, k]) => (
              <li key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${c}`} aria-hidden /> {tx(k)}</li>
            ))}
            <li>⇄ {tx('calSwapDay')}</li>
          </ul>

          {!setup && selected && (
            <section className="space-y-3" aria-labelledby="ops-day">
              <h4 id="ops-day" className="text-lg font-semibold text-ink">{tx('calDayTitle', { day: shownDay(selected, language) })}</h4>
              {dayViews.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-base text-ink-muted">{tx('calDayEmpty')}</p> : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {dayViews.map(v => (
                    <li key={v.task.id}>
                      <TaskCard v={v} farm={farmOfProgram.get(v.task.programId) ?? ''} swap={swapOf.get(v.task.id)} events={events.filter(e => e.taskId === v.task.id)} writer={writer} open={openId === v.task.id} onToggle={() => setOpenId(openId === v.task.id ? null : v.task.id)} onChanged={changed} onDo={onDoTask} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
      {moving && movingView && (
        <OpsMoveDialog
          key={`${moving.id}-${moving.toDay}`}
          v={movingView}
          partner={exchangePartner(shownViews, movingView.task)}
          farm={farmOfProgram.get(movingView.task.programId) ?? ''}
          toDay={moving.toDay}
          onClose={() => setMoving(null)}
          onMoved={n => { setMessage({ kind: 'ok', text: n > 1 ? tx('mvDoneN', { n, day: shownDay(moving.toDay, language) }) : tx('mvDone', { day: shownDay(moving.toDay, language) }) }); setSelected(moving.toDay); setMonth(moving.toDay.slice(0, 7)); changed(); }}
        />
      )}
      {confirm && <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type="warning" confirmText={confirm.confirmText} />}
    </div>
  );
}
