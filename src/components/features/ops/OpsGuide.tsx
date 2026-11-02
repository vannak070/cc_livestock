'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useText } from '@/hooks/useText';

interface Props {
  /** How many Planning plans are saved (a farm program takes its numbers from one). */
  planCount: number;
  /** Farms that already have a running program, and those still waiting for one. */
  setUp: number;
  waiting: string[];
  onPickFarm: (farm: string) => void;
  onOpenTasks: () => void;
  onOpenPlanning?: () => void;
}

/**
 * "How to set up": three numbered steps with their real state (Planning plan saved, farms set up, tasks to work), so
 * someone who has never set a program up knows what to press next. Open while something is still to do; one tap folds it.
 */
export default function OpsGuide({ planCount, setUp, waiting, onPickFarm, onOpenTasks, onOpenPlanning }: Props) {
  const { tx } = useText('opsTasks');
  const allDone = planCount > 0 && waiting.length === 0;
  const [open, setOpen] = useState(!allDone);
  const steps = [
    { n: 1, done: planCount > 0, title: tx('gTitle1'), body: planCount > 0 ? tx('gDone1', { n: planCount }) : tx('gBody1') },
    { n: 2, done: planCount > 0 && waiting.length === 0, title: tx('gTitle2'), body: waiting.length === 0 && planCount > 0 ? tx('gDone2', { n: setUp }) : tx('gBody2', { done: setUp, all: setUp + waiting.length }) },
    { n: 3, done: false, title: tx('gTitle3'), body: tx('gBody3') },
  ];
  // The step to do now: the first one not done.
  const current = steps.find(s => !s.done && s.n !== 3)?.n ?? 3;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60" aria-labelledby="ops-guide">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="flex items-center gap-2 text-lg font-semibold text-emerald-950" id="ops-guide"><ListChecks className="h-5 w-5" aria-hidden /> {tx('guideTitle')}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-emerald-900 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ol className="grid gap-3 px-4 pb-4 md:grid-cols-3">
          {steps.map(s => (
            <li key={s.n} className={`flex flex-col gap-2 rounded-xl bg-white p-4 ring-1 ${s.n === current ? 'ring-2 ring-emerald-600' : 'ring-slate-200'}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${s.done ? 'bg-emerald-600 text-white' : s.n === current ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600' : 'bg-slate-100 text-ink-muted'}`}>
                  {s.done ? <Check className="h-4 w-4" aria-hidden /> : s.n}
                </span>
                <p className="text-base font-semibold text-ink">{s.title}</p>
              </div>
              <p className="text-base text-ink-muted">{s.body}</p>
              {s.n === 1 && planCount === 0 && onOpenPlanning && <Button className="mt-auto self-start" onClick={onOpenPlanning}>{tx('gOpenPlanning')}</Button>}
              {s.n === 2 && planCount > 0 && waiting.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-2">
                  {waiting.slice(0, 3).map(f => <Button key={f} size="sm" variant={f === waiting[0] ? 'default' : 'outline'} onClick={() => onPickFarm(f)}>{tx('gSetUp', { farm: f })}</Button>)}
                  {waiting.length > 3 && <span className="self-center text-sm text-ink-muted">{tx('gMore', { n: waiting.length - 3 })}</span>}
                </div>
              )}
              {s.n === 3 && <Button className="mt-auto self-start" variant="outline" onClick={onOpenTasks}>{tx('gOpenTasks')}</Button>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
