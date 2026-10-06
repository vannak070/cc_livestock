'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { saleReviewCounts, type SaleReviewRow } from '@/lib/sale-review';
import { money } from '../flow/FlowShell';
import { useText, type Tx } from '@/hooks/useText';
import { shownDay } from '@/lib/khmer-date';

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

const dueText = (d: number, tx: Tx) => (d < 0 ? tx(d === -1 ? 'rDuePastOne' : 'rDuePastMany', { n: -d }) : d === 0 ? tx('rDueToday') : tx(d === 1 ? 'rDueInOne' : 'rDueInMany', { n: d }));

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
  const { tx, txn, language } = useText('batchesPage');
  const c = saleReviewCounts(rows);
  return (
    <div className="space-y-4">
      <p className="text-base text-ink-muted">{tx('rIntro', { n: windowDays })}</p>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Tile label={tx('rPast')} value={c.overdue} tone="bad" />
        <Tile label={tx('rWeek')} value={c.week} tone="warn" />
        <Tile label={tx('rSoon', { n: windowDays })} value={c.soon} />
        <Tile label={tx('rReady')} value={c.decided} />
      </section>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 p-6 text-center text-lg text-emerald-900">{tx('rNone')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map(r => {
            const last = r.batch.saleReview;
            return (
              <li key={r.batch.id} className={`flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 ${r.decided ? 'border-emerald-300' : TIER[r.tier].border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold text-ink [overflow-wrap:anywhere]">{r.batch.name}</p>
                    <p className="text-base text-ink-muted">{[r.farm, txn(r.head, 'animalOne', 'animalMany')].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${r.decided ? 'bg-emerald-100 text-emerald-800' : TIER[r.tier].chip}`}>{r.decided ? tx('rReady') : r.tier === 'overdue' ? tx('rPast') : r.tier === 'week' ? tx('rThisWeek') : tx('rComingUp')}</span>
                </div>
                <p className={`text-lg font-medium ${r.tier === 'overdue' && !r.decided ? 'text-rose-700' : 'text-ink'}`}>{dueText(r.daysRemaining, tx)} <span className="font-normal text-ink-muted">({shownDay(r.batch.sellingTargetDate, language)})</span></p>
                {/* Two columns on phones, so the expected value (a full riel amount) gets the whole row. */}
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                  <div><p className="text-sm text-ink-muted">{tx('average')}</p><p className="text-lg font-semibold text-ink">{r.head ? `${Math.round(r.avgWeight)} kg` : '—'}</p></div>
                  <div><p className="text-sm text-ink-muted">{tx('dailyGain')}</p><p className="text-lg font-semibold text-ink">{r.perDay !== null ? `${r.perDay} kg` : '—'}</p></div>
                  <div className="col-span-2 sm:col-span-1"><p className="text-sm text-ink-muted">{tx('rExpected')}</p><p className="text-lg font-semibold text-ink">{r.expectedValue !== null ? money(r.expectedValue) : '—'}</p></div>
                </div>
                {r.standardDate && !r.decided && <p className="rounded-xl bg-amber-50 p-2 text-base text-amber-900">{tx('rStandard')}</p>}
                {last && (
                  <p className="text-base text-ink-muted">
                    {last.decision === 'ready'
                      ? tx('rLastReady', { by: last.by, day: shownDay(last.at, language), note: last.note ? `. “${last.note}”` : '' })
                      : tx('rLastKept', { by: last.by, day: shownDay(last.at, language), was: last.previousTarget ? tx('rWas', { date: shownDay(last.previousTarget, language) }) : '', note: last.note ? `. “${last.note}”` : '' })}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {canReview && <Button onClick={() => onReview(r)}>{r.decided ? tx('rChange') : tx('rReview')}</Button>}
                  <Button variant="outline" onClick={() => onOpen(r.batch.id)}>{tx('rOpen')}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
