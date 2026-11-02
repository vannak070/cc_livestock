'use client';

import React, { useMemo, useState } from 'react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { refreshFarmProgramAction } from '@/app/actions';
import { farmToday } from '@/lib/daily-feed';
import { dayLabel } from '../feed/DailyFeedFlow';
import { Button } from '@/components/ui/button';
import { canManagePrograms } from '@/lib/ops-program';
import { SLOT_COUNT, moveToSlot, slotBoard, slotLabel, slotOf } from '@/lib/ops-slots';
import type { TaskView } from '@/lib/ops-view';
import { useText } from '@/hooks/useText';
import type { FarmProgram } from '@/repositories/ops-program.repository';
import type { FarmItem, UserRoleItem } from '@/lib/types';

interface Props {
  currentUser: UserRoleItem;
  farms: FarmItem[];
  programs: FarmProgram[];
  views: TaskView[];
  onChanged: () => void;
  /** Opens the setup of a farm that has no program (Calendar and setup tab). */
  onSetUpFarm?: (farm: string) => void;
}

/**
 * The 3-day calendar: ten slots a month, each with the farms that swap their cattle in it (buy back and sell new, the same
 * day, once a month). Operations arrange farms by location; Admins move a farm to another slot, Management reads.
 */
export default function OpsSlots({ currentUser, farms, programs, views, onChanged, onSetUpFarm }: Props) {
  const { tx, language } = useText('opsTasks');
  const writer = canManagePrograms(currentUser);
  const today = farmToday();
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmText: string; onConfirm: () => void }>(null);

  const addressOf = useMemo(() => new Map(farms.map(f => [f.name, f.address])), [farms]);
  const board = useMemo(() => slotBoard(programs, addressOf, today), [programs, addressOf, today]);
  const lateOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of views) if (v.state.status === 'late') m.set(v.task.programId, (m.get(v.task.programId) ?? 0) + 1);
    return m;
  }, [views]);
  const withProgram = new Set(programs.filter(p => p.status !== 'Closed').map(p => p.farm));
  const without = farms.filter(f => !withProgram.has(f.name));
  const thisSlot = slotOf(today);

  const move = async (programId: string, farm: string, slot: number) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;
    setBusy(true);
    setMessage(null);
    const res = await refreshFarmProgramAction(programId, { startDate: moveToSlot(program.startDate, slot) });
    setBusy(false);
    setMoving(null);
    if (!res.success) { setMessage({ kind: 'error', text: res.error }); return; }
    setMessage({ kind: 'ok', text: tx('slotMoved', { farm, days: slotLabel(slot) }) });
    onChanged();
  };

  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <h3 className="text-xl font-semibold text-ink">{tx('slotsTitle')}</h3>
        <p className="text-base text-ink-muted">{tx('slotsHint')}</p>
        <p className="mt-1 text-base font-medium text-ink">{tx('slotSummary', { farms: board.reduce((n, b) => n + b.farms.length, 0), windows: SLOT_COUNT })}</p>
      </div>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-xl p-3 text-base ${message.kind === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900'}`}>{message.text}</p>}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {board.map(box => (
          <li key={box.slot} className={`rounded-xl bg-white p-4 ring-1 ${box.slot === thisSlot ? 'ring-2 ring-emerald-600' : 'ring-slate-200'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lg font-semibold text-ink">{tx('slotDays', { days: box.label })}</p>
              <p className="text-sm text-ink-muted">{box.slot === thisSlot ? tx('slotNow') : tx('slotFarms', { n: box.farms.length })}</p>
            </div>
            {box.farms.length === 0 ? <p className="mt-2 text-base text-ink-muted">{tx('slotEmpty')}</p> : (
              <ul className="mt-2 divide-y divide-slate-100">
                {box.farms.map(f => {
                  const late = lateOf.get(f.programId) ?? 0;
                  return (
                    <li key={f.farm} className="space-y-1 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-base font-medium text-ink">{f.farm}</span>
                        {late > 0 && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-sm font-medium text-rose-900">{tx('slotLate', { n: late })}</span>}
                      </div>
                      <p className="text-sm text-ink-muted"><span className={f.location ? '' : 'italic'}>{f.location || tx('slotNoLocation')}</span><span className="block text-ink">{tx('slotNext', { day: dayLabel(f.nextSwap, language) })}</span></p>
                      {writer && (moving === f.farm ? (
                        <div className="flex items-center gap-2">
                          <select
                            autoFocus
                            aria-label={`${tx('slotMoveTo')} · ${f.farm}`}
                            className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-base text-ink"
                            value="" disabled={busy}
                            onChange={e => {
                              const slot = Number(e.target.value);
                              if (!slot) return;
                              setConfirm({ title: tx('slotMoveTitle', { farm: f.farm }), description: tx('slotMoveBody', { days: slotLabel(slot) }), confirmText: tx('slotMoveConfirm'), onConfirm: () => { void move(f.programId, f.farm, slot); } });
                            }}>
                            <option value="">{tx('slotMoveTo')}</option>
                            {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).filter(n => n !== box.slot).map(n => <option key={n} value={n}>{tx('slotDays', { days: slotLabel(n) })}</option>)}
                          </select>
                          <Button size="sm" variant="ghost" onClick={() => setMoving(null)}>{tx('slotChangeCancel')}</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="-ml-2 text-emerald-800" disabled={busy} onClick={() => setMoving(f.farm)}>{tx('slotChange')}</Button>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {without.length > 0 && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h4 className="text-lg font-semibold text-ink">{tx('slotNoProgram')}</h4>
          <p className="text-base text-ink-muted">{without.map(f => f.name).join(', ')}</p>
          <p className="mt-1 text-sm text-ink-muted">{tx('slotNoProgramHint')}</p>
          {writer && onSetUpFarm && <div className="mt-3 flex flex-wrap gap-2">{without.map(f => <Button key={f.id} size="sm" onClick={() => onSetUpFarm(f.name)}>{tx('slotSetUp', { farm: f.name })}</Button>)}</div>}
        </section>
      )}

      {confirm && <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type="warning" confirmText={confirm.confirmText} />}
    </div>
  );
}
