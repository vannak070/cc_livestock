'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * The layout every guided Record dialog shares: a progress bar, one question
 * per screen, and Back / Next pinned at the bottom so they never scroll away.
 * Full screen on a phone, a fixed-height card on larger screens.
 */

// Number fields without the browser's tiny up/down arrows.
export const NUM = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export const today = () => new Date().toISOString().split('T')[0];
export const money = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

export function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-14 min-w-24 flex-1 whitespace-normal break-words rounded-xl border-2 px-4 py-2 text-center text-lg font-medium leading-snug transition-colors ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink hover:border-emerald-600'}`}
    >
      {children}
    </button>
  );
}

export function Question({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-lg font-medium text-ink">{label}</p>
      {children}
      {hint && <p className="mt-2 text-base text-ink-muted">{hint}</p>}
    </div>
  );
}

const MAX_BUTTONS = 4;
const SEARCH_FROM = 7;

/**
 * Choose one of many. A few options show as big buttons; a longer list (many
 * farms or breeds) becomes full-width rows that never clip a long name, with a
 * search box once it is long enough to need one.
 */
export function PickList({ options, value, onChange, labelFor = o => o }: { options: string[]; value: string; onChange: (v: string) => void; labelFor?: (o: string) => string }) {
  const [q, setQ] = useState('');
  if (options.length <= MAX_BUTTONS) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {options.map(o => <Choice key={o} selected={value === o} onClick={() => onChange(o)}>{labelFor(o)}</Choice>)}
      </div>
    );
  }
  const needle = q.trim().toLowerCase();
  const shown = needle ? options.filter(o => labelFor(o).toLowerCase().includes(needle)) : options;
  return (
    <div className="space-y-3">
      {options.length >= SEARCH_FROM && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label="Search the list" className="h-12 pl-10 text-lg" />
        </div>
      )}
      <ul className="space-y-2">
        {shown.map(o => (
          <li key={o}>
            <button
              type="button"
              onClick={() => onChange(o)}
              aria-pressed={value === o}
              className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 text-left text-lg font-medium transition-colors ${value === o ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink hover:border-emerald-600'}`}
            >
              <span className="break-words">{labelFor(o)}</span>
              {value === o && <Check className="h-6 w-6 shrink-0" aria-hidden />}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">Nothing matches that.</li>}
      </ul>
    </div>
  );
}

/** A big tappable row, used for lists of animals, feeds and choices with a hint. */
export function RowButton({ onClick, selected, children }: { onClick: () => void; selected?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 px-5 py-3 text-left transition-colors hover:border-emerald-600 ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}
    >
      {children}
    </button>
  );
}

export function FlowFooter({ onBack, label, busy }: { onBack?: () => void; label: string; busy?: boolean }) {
  return (
    <div className="flex gap-3">
      {onBack && <Button type="button" variant="secondary" size="lg" onClick={onBack} aria-label="Go back"><ArrowLeft /></Button>}
      <Button type="submit" size="lg" className="flex-1" disabled={busy}>{label}</Button>
    </div>
  );
}

export function FlowDone({ message, detail, again, onAgain, onClose }: { message: React.ReactNode; detail?: React.ReactNode; again: string; onAgain: () => void; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="space-y-5 pt-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-11 w-11" aria-hidden />
        </div>
        <p className="text-2xl text-ink">{message}</p>
        {detail && <p className="text-lg text-ink-muted">{detail}</p>}
      </div>
      <div className="flex flex-col gap-3">
        <Button type="button" size="lg" onClick={onAgain}>{again}</Button>
        <Button type="button" size="lg" variant="secondary" onClick={onClose}>I&apos;m done</Button>
      </div>
    </div>
  );
}

interface FlowShellProps {
  /** Every step in order; the progress bar counts these. */
  steps: string[];
  step: string;
  title: string;
  subtitle?: string;
  /** What has been entered so far, shown under the title. */
  summary?: string;
  error?: string;
  /** Runs on Enter or the primary button; omit on screens that advance by tapping. */
  onSubmit?: () => void;
  /** Usually a FlowFooter; null on screens that advance by tapping. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function FlowShell({ steps, step, title, subtitle, summary, error, onSubmit, footer, children }: FlowShellProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // Each step starts at the top, not wherever the last one was scrolled to.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);
  const index = steps.indexOf(step);

  return (
    <DialogContent className="flex max-w-lg flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:h-[40rem]">
      <div className="shrink-0 px-6 pb-4 pt-6">
        {index >= 0 && (
          <div className="mb-4 flex gap-1.5 pr-8" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => <span key={s} className={`h-2 flex-1 rounded-full ${i <= index ? 'bg-emerald-600' : 'bg-slate-200'}`} />)}
          </div>
        )}
        <DialogHeader className="space-y-1 text-left sm:text-left">
          <DialogTitle className="text-2xl font-semibold text-ink">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-base text-ink-muted">{subtitle}</DialogDescription>}
        </DialogHeader>
        {summary && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-base font-medium text-ink">{summary}</p>}
      </div>

      <form className="flex min-h-0 flex-1 flex-col" onSubmit={e => { e.preventDefault(); onSubmit?.(); }}>
        <div ref={bodyRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-2">{children}</div>
        {(footer || error) && (
          <div className={`shrink-0 space-y-3 px-6 pb-6 pt-4 ${footer ? 'border-t border-slate-100' : ''}`}>
            {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
            {footer}
          </div>
        )}
      </form>
    </DialogContent>
  );
}
