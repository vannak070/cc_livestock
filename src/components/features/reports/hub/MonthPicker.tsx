'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shiftMonth } from '@/lib/billing';
import { monthLabel } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';

interface Props {
  /** YYYY-MM */
  value: string;
  onChange: (month: string) => void;
  /** The current month, for the "This month" shortcut. */
  currentMonth: string;
  /** How far back and ahead months can be chosen (YYYY-MM); defaults to two years back and a year ahead of the current month. */
  min?: string;
  max?: string;
  /** Without the previous and next arrows (for a from/to pair). */
  compact?: boolean;
  label?: string;
}

/** A month filter: arrows for the month before and after, and a calendar of the year to jump to any month, with This month and Last month shortcuts. */
export default function MonthPicker({ value, onChange, currentMonth, min, max, compact, label }: Props) {
  const { tx, language } = useText('reportsPage');
  const lo = min ?? shiftMonth(currentMonth, -24);
  const hi = max ?? shiftMonth(currentMonth, 12);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (m: string) => { onChange(m); setOpen(false); };
  const inRange = (m: string) => m >= lo && m <= hi;
  const monthName = (mm: number) => new Date(Date.UTC(2000, mm - 1, 1)).toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US', { month: 'short', timeZone: 'UTC' });
  const prev = shiftMonth(value, -1);
  const next = shiftMonth(value, 1);

  return (
    <div ref={box} className="relative flex items-center gap-1.5">
      {!compact && <Button variant="outline" size="icon" aria-label={tx('monthPrev')} disabled={!inRange(prev)} onClick={() => onChange(prev)}><ChevronLeft /></Button>}
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={label ?? tx('monthPick')}
        onClick={() => { setYear(Number(value.slice(0, 4))); setOpen(o => !o); }}
        className="flex min-h-11 min-w-44 items-center justify-center gap-2 rounded-xl bg-white px-4 text-lg font-semibold text-ink ring-1 ring-slate-300 hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
        <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden />
        {monthLabel(value, language)}
        <ChevronDown className="h-4 w-4 text-ink-muted" aria-hidden />
      </button>
      {!compact && <Button variant="outline" size="icon" aria-label={tx('monthNext')} disabled={!inRange(next)} onClick={() => onChange(next)}><ChevronRight /></Button>}

      {open && (
        <div role="dialog" aria-label={tx('monthPick')} className="absolute left-0 top-full z-30 mt-2 w-80 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label={tx('yearPrev')} disabled={`${year - 1}-12` < lo} onClick={() => setYear(y => y - 1)}><ChevronLeft /></Button>
            <p className="text-lg font-semibold text-ink">{year}</p>
            <Button variant="ghost" size="icon" aria-label={tx('yearNext')} disabled={`${year + 1}-01` > hi} onClick={() => setYear(y => y + 1)}><ChevronRight /></Button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(mm => {
              const m = `${year}-${String(mm).padStart(2, '0')}`;
              const selected = m === value;
              return (
                <button key={m} type="button" disabled={!inRange(m)} onClick={() => pick(m)} aria-pressed={selected}
                  className={`min-h-11 rounded-lg text-base font-medium ${selected ? 'bg-emerald-700 text-white' : m === currentMonth ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300' : 'text-ink hover:bg-slate-100'} disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent`}>
                  {monthName(mm)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
            <Button variant="outline" size="sm" className="min-h-10 flex-1" onClick={() => pick(currentMonth)}>{tx('monthThis')}</Button>
            <Button variant="outline" size="sm" className="min-h-10 flex-1" disabled={!inRange(shiftMonth(currentMonth, -1))} onClick={() => pick(shiftMonth(currentMonth, -1))}>{tx('monthLast')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
