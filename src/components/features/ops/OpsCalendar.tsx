'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Truck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KM_WEEKDAYS, monthLabel } from '@/lib/khmer-date';
import { EN_WEEKDAYS, monthGrid, type FarmColor } from '@/lib/ops-calendar';
import type { TaskKind } from '@/lib/ops-program';
import { useText } from '@/hooks/useText';

/** One item on a calendar day: a task (or a preview of one). */
export interface CalChip {
  key: string;
  kind: TaskKind;
  /** Short text: the head count, or the tonnes of feed. */
  text: string;
  /** Tailwind colour classes for the item (the status). */
  tone: string;
  /** The colour of the small dot shown on phones. */
  dot: string;
  /** A task the program would make, not yet saved. */
  preview?: boolean;
  /** Which farm, when several farms share the calendar. */
  farm?: string;
  /** Can be dragged to another day. */
  movable?: boolean;
}

const ICON: Record<TaskKind, React.ReactNode> = {
  sell_to_farm: <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />,
  buy_back: <Undo2 className="h-3.5 w-3.5 shrink-0" aria-hidden />,
};

interface Props {
  month: string;
  onMonth: (month: string) => void;
  chipsByDay: Map<string, CalChip[]>;
  selected?: string;
  onSelect: (day: string) => void;
  today: string;
  /** Days that are same-day swaps (a buy-back and its replacement sale). */
  swapDays?: Set<string>;
  /** A day marked as the program's start. */
  startDay?: string;
  /** Write the farm's name on each item (the calendar shows several farms). */
  showFarm?: boolean;
  farmColor?: (farm: string) => FarmColor | undefined;
  /** An item was dropped on a day. Only items marked `movable` can be dragged. */
  onMove?: (chipKey: string, toDay: string) => void;
  /** Whether the item being dragged may be dropped on this day (past days may not). */
  canDrop?: (chipKey: string, toDay: string) => boolean;
}

/** A month calendar (Monday first) with the tasks on their days. Clicking a day selects it. */
export default function OpsCalendar({ month, onMonth, chipsByDay, selected, onSelect, today, swapDays, startDay, showFarm, farmColor, onMove, canDrop }: Props) {
  const { tx, language } = useText('opsTasks');
  const weeks = monthGrid(month);
  const names = language === 'km' ? [...KM_WEEKDAYS.slice(1), KM_WEEKDAYS[0]] : EN_WEEKDAYS;
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  // Holding a dragged item over a month arrow turns the page every moment, so a task can be moved into another month.
  const [hoverBy, setHoverBy] = useState<-1 | 0 | 1>(0);
  const hoverShift = (by: -1 | 1) => dragKey ? {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragEnter: () => setHoverBy(by),
    onDragLeave: () => setHoverBy(0),
  } : {};
  const endDrag = () => { setHoverBy(0); setDragKey(null); setOverDay(null); };
  const shift = (by: number) => { const y = Number(month.slice(0, 4)); const m = Number(month.slice(5, 7)) - 1 + by; onMonth(`${y + Math.floor(m / 12)}-${String(((m % 12) + 12) % 12 + 1).padStart(2, '0')}`); };

  useEffect(() => {
    if (!dragKey || hoverBy === 0) return;
    const id = setTimeout(() => shift(hoverBy), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragKey, hoverBy, month]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
          <Button variant="ghost" size="icon" aria-label={tx('calPrev')} onClick={() => shift(-1)} {...hoverShift(-1)}><ChevronLeft /></Button>
          <p className="min-w-36 px-2 text-center text-lg font-semibold text-ink" aria-live="polite">{monthLabel(month, language)}</p>
          <Button variant="ghost" size="icon" aria-label={tx('calNext')} onClick={() => shift(1)} {...hoverShift(1)}><ChevronRight /></Button>
        </div>
        {month !== today.slice(0, 7) && <Button variant="outline" onClick={() => onMonth(today.slice(0, 7))}>{tx('calToday')}</Button>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" role="grid" aria-label={monthLabel(month, language)}>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-sm font-medium text-ink-muted" role="row">
          {names.map(n => <div key={n} className="py-2" role="columnheader">{n}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7" role="row">
            {week.map(({ day, inMonth }) => {
              const chips = chipsByDay.get(day) ?? [];
              const isToday = day === today;
              const isSel = day === selected;
              const isStart = day === startDay;
              const allowed = !!dragKey && !!canDrop?.(dragKey, day);
              const hovered = allowed && overDay === day;
              return (
                <div
                  key={day}
                  role="gridcell"
                  tabIndex={0}
                  aria-selected={isSel}
                  aria-label={`${day}${chips.length ? `, ${chips.length}` : ''}`}
                  onClick={() => onSelect(day)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(day); } }}
                  onDragOver={dragKey ? e => { if (allowed) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overDay !== day) setOverDay(day); } else e.dataTransfer.dropEffect = 'none'; } : undefined}
                  onDragLeave={dragKey ? () => { if (overDay === day) setOverDay(null); } : undefined}
                  onDrop={dragKey ? e => { e.preventDefault(); const key = dragKey; endDrag(); if (allowed && key) onMove?.(key, day); } : undefined}
                  className={`flex min-h-16 cursor-pointer flex-col gap-1 border-b border-r border-slate-100 p-1 text-left align-top transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 sm:min-h-24 sm:p-1.5 ${inMonth ? 'bg-white' : 'bg-slate-50/70 text-ink-muted'} ${isSel && !dragKey ? 'ring-2 ring-inset ring-emerald-600' : dragKey ? '' : 'hover:bg-emerald-50/60'} ${isStart ? 'bg-emerald-50' : ''} ${hovered ? '!bg-emerald-100 ring-2 ring-inset ring-emerald-500' : allowed ? 'bg-emerald-50/60' : dragKey ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span className="flex items-center justify-between">
                    <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-sm ${isToday ? 'bg-emerald-600 font-semibold text-white' : inMonth ? 'text-ink' : 'text-ink-muted'}`}>{Number(day.slice(8, 10))}</span>
                    {swapDays?.has(day) && <span className="text-xs text-ink-muted" title={tx('calSwapDay')} aria-hidden>⇄</span>}
                  </span>
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {chips.slice(0, 4).map(c => {
                      const color = showFarm && c.farm ? farmColor?.(c.farm) : undefined;
                      return (
                        <span
                          key={c.key}
                          draggable={!!c.movable && !!onMove}
                          onDragStart={c.movable && onMove ? e => { e.dataTransfer.setData('text/plain', c.key); e.dataTransfer.effectAllowed = 'move'; setDragKey(c.key); } : undefined}
                          onDragEnd={endDrag}
                          className={`flex items-center gap-0.5 truncate rounded-md px-1 py-0.5 text-[11px] font-medium ${c.tone} ${c.preview ? 'border border-dashed border-current bg-white/70' : ''} ${color ? `border-l-4 ${color.bar}` : ''} ${c.movable && onMove ? 'cursor-grab active:cursor-grabbing' : ''} ${dragKey === c.key ? 'opacity-40' : ''}`}
                          title={[c.farm, c.movable && onMove ? tx('calDragTip') : ''].filter(Boolean).join(' · ') || undefined}
                        >
                          {ICON[c.kind]}
                          {showFarm && c.farm && <span className="min-w-0 flex-1 truncate">{c.farm}</span>}
                          <span className={showFarm && c.farm ? 'shrink-0 font-semibold' : 'truncate'}>{c.text}</span>
                        </span>
                      );
                    })}
                    {chips.length > 4 && <span className="px-1 text-xs text-ink-muted">{tx('calMore', { n: chips.length - 4 })}</span>}
                  </span>
                  <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                    {chips.slice(0, 4).map(c => <span key={c.key} className={`h-2 w-2 rounded-full ${c.dot} ${c.preview ? 'opacity-50' : ''}`} />)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
