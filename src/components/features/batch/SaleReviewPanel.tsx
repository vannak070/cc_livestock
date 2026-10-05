'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { saleReviewCounts, type SaleReviewRow } from '@/lib/sale-review';
import { money } from '../flow/FlowShell';

interface SaleReviewPanelProps {
  rows: SaleReviewRow[];
  windowDays: number;
  /** Whether this person may record a decision. */
  canReview: boolean;
  onReview: (row: SaleReviewRow) => void;
  onOpen: (batchId: string) => void;
}

const TIER: Record<SaleReviewRow['tier'], { chip: string; border: string }> = {
  overdue: { chip: 'bg-rose-100 text-rose-800', border: 'border-rose-300' },
  week: { chip: 'bg-amber-100 text-amber-900', border: 'border-amber-300' },
  soon: { chip: 'bg-slate-100 text-ink', border: 'border-slate-200' },
};

const dueText = (d: number) => (d < 0 ? `${-d} ${-d === 1 ? 'day' : 'days'} past its selling date` : d === 0 ? 'Selling date is today' : `Selling date in ${d} ${d === 1 ? 'day' : 'days'}`);

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'bad' | 'warn' }) {
  const style = tone === 'bad' && value > 0 ? 'border-rose-300 bg-rose-50' : tone === 'warn' && value > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${style}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function SaleReviewPanel({ rows, windowDays, canReview, onReview, onOpen }: SaleReviewPanelProps) {
  const c = saleReviewCounts(rows);
  return (
    <div className="space-y-4">
      <p className="text-base text-ink-muted">Batches within {windowDays} days of their selling date, or already past it. Decide to sell, or keep feeding with a new date.</p>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Tile label="Past the date" value={c.overdue} tone="bad" />
        <Tile label="Within 7 days" value={c.week} tone="warn" />
        <Tile label={`8 to ${windowDays} days`} value={c.soon} />
        <Tile label="Ready to sell" value={c.decided} />
      </section>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 p-6 text-center text-lg text-emerald-900">No batch is near its selling date.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map(r => {
            const last = r.batch.saleReview;
            return (
              <li key={r.batch.id} className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 ${r.decided ? 'border-emerald-300' : TIER[r.tier].border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-2xl font-semibold text-ink">{r.batch.name}</p>
                    <p className="text-base text-ink-muted">{[r.farm, `${r.head} ${r.head === 1 ? 'animal' : 'animals'}`].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${r.decided ? 'bg-emerald-100 text-emerald-800' : TIER[r.tier].chip}`}>{r.decided ? 'Ready to sell' : r.tier === 'overdue' ? 'Past the date' : r.tier === 'week' ? 'This week' : 'Coming up'}</span>
                </div>
                <p className={`text-lg font-medium ${r.tier === 'overdue' && !r.decided ? 'text-rose-700' : 'text-ink'}`}>{dueText(r.daysRemaining)} <span className="font-normal text-ink-muted">({r.batch.sellingTargetDate?.slice(0, 10)})</span></p>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <div><p className="text-sm text-ink-muted">Average</p><p className="text-lg font-semibold text-ink">{r.head ? `${Math.round(r.avgWeight)} kg` : '—'}</p></div>
                  <div><p className="text-sm text-ink-muted">Daily gain</p><p className="text-lg font-semibold text-ink">{r.perDay !== null ? `${r.perDay} kg` : '—'}</p></div>
                  <div><p className="text-sm text-ink-muted">Expected</p><p className="text-lg font-semibold text-ink">{r.expectedValue !== null ? money(r.expectedValue) : '—'}</p></div>
                </div>
                {r.standardDate && !r.decided && <p className="rounded-xl bg-amber-50 p-2 text-base text-amber-900">This is the standard 90-day date, not one anybody chose. Check it is right.</p>}
                {last && (
                  <p className="text-base text-ink-muted">
                    Reviewed by {last.by} on {last.at.slice(0, 10)}: {last.decision === 'ready' ? 'ready to sell' : `kept feeding${last.previousTarget ? ` (was ${last.previousTarget})` : ''}`}{last.note ? `. “${last.note}”` : ''}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {canReview && <Button onClick={() => onReview(r)}>{r.decided ? 'Change decision' : 'Review'}</Button>}
                  <Button variant="outline" onClick={() => onOpen(r.batch.id)}>Open batch</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
