'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useText, useValueText } from '@/hooks/useText';
import type { Share } from '@/lib/report-stats';

/** Pieces the Reports tabs share: number tiles, a bar list, and the money format. */

// Chart colours were checked with the colour validator (colour-blind safe): Sold is leaf green, Bought is blue.
export const SOLD = '#0E7A38';
export const BOUGHT = '#2B6CB0';

export const norm = (s?: string) => (s ?? '').toLowerCase().trim();
export const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const signedRiel = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${riel(Math.abs(n))}`;
/** 1.2M, 340k: short money for chart axes. */
export const shortMoney = (v: number) => (v === 0 ? '0' : v >= 1_000_000 ? `${r1(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

const TONE_COLOR = { bad: '#B32C33', warn: '#B4690E', good: '#138E46' } as const;

/** One number with its label. Quiet: a white card, and only the number takes a colour. Opens something when `onClick` is given. */
export function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'warn'; onClick?: () => void }) {
  const inner = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold text-ink" style={tone ? { color: TONE_COLOR[tone] } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </>
  );
  const cls = 'block w-full rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 sm:p-4';
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} transition-shadow hover:ring-2 hover:ring-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

/** The status line at the top of a page: a coloured bar and one sentence. */
export function StatusBanner({ level, children }: { level: 'act' | 'watch' | 'ok'; children: React.ReactNode }) {
  const color = { act: '#B32C33', watch: '#D9822B', ok: '#138E46' }[level];
  return <section aria-live="polite" className="bg-white p-4 ring-1 ring-slate-200" style={{ borderLeft: `4px solid ${color}`, borderRadius: 0 }}>{children}</section>;
}

/** A closed section: its title and one headline figure show; the detail opens on demand. */
export function Fold({ title, headline, note, children, defaultOpen }: { title: string; headline?: string; note?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl bg-white ring-1 ring-slate-200 open:ring-slate-300">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-ink">{title}</span>
          {headline && <span className="block text-base text-ink-muted">{headline}</span>}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 py-4">
        {note && <p className="text-sm text-ink-muted">{note}</p>}
        {children}
      </div>
    </details>
  );
}

const KNOWN_ORIGINS = ['Purchase', 'Born in Farm', 'Transfer', 'Partnership'];

/** A list of shares as bars (breed, sex, health, where cattle came from). */
export function Bars({ title, rows }: { title: string; rows: Share[] }) {
  const { tx } = useText('reportsPage');
  const origin = useText('addCattle');
  const val = useValueText();
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
      <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? <p className="text-base text-ink-muted">{tx('nothingYet')}</p> : (
        <ul className="space-y-3">
          {rows.slice(0, 8).map(r => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words text-base text-ink">{r.label === 'Not set' ? tx('notSet') : KNOWN_ORIGINS.includes(r.label) ? origin.tx(`o_${r.label}`) : val(r.label)}</span>
                <span className="shrink-0 text-base font-medium text-ink">{r.count} <span className="text-ink-muted">({r.pct}%)</span></span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: SOLD }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
