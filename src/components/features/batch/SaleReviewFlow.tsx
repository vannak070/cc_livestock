'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addDays, farmToday } from '@/lib/daily-feed';
import { saleReviewProblem, type SaleReviewInput, type SaleReviewRow } from '@/lib/sale-review';
import { Choice, FlowDone, FlowFooter, FlowShell, Question, RowButton, money } from '../flow/FlowShell';
import { useText, type Tx } from '@/hooks/useText';
import { shownDay } from '@/lib/khmer-date';

interface SaleReviewFlowProps {
  isOpen: boolean;
  onClose: () => void;
  row: SaleReviewRow | null;
  /** Days before the selling date a batch is flagged, shown in the reminder note. */
  windowDays: number;
  onSave: (batchId: string, input: SaleReviewInput) => Promise<void>;
}

type Step = 'decide' | 'details' | 'done';

export default function SaleReviewFlow(props: SaleReviewFlowProps) {
  // Remount on every open so each review starts clean.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && props.row && <SaleReviewBody {...props} row={props.row} />}
    </Dialog>
  );
}

const when = (days: number, tx: Tx) => (days < 0 ? tx('sWhenPast', { n: -days }) : days === 0 ? tx('sWhenToday') : tx('sWhenIn', { n: days }));

function SaleReviewBody({ onClose, row, onSave, windowDays }: SaleReviewFlowProps & { row: SaleReviewRow }) {
  const { tx, language } = useText('batchesPage');
  const flow = useText('flow');
  const today = farmToday();
  const [step, setStep] = useState<Step>('decide');
  const [decision, setDecision] = useState<'ready' | 'extend' | null>(null);
  const [newDate, setNewDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { batch } = row;
  const steps: Step[] = ['decide', 'details'];
  const input = (): SaleReviewInput => ({ decision: decision!, note: note.trim() || undefined, newTargetDate: decision === 'extend' ? newDate : undefined });

  const save = async () => {
    const problem = saleReviewProblem(input(), today);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(batch.id, input());
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('eSave'));
    } finally {
      setSaving(false);
    }
  };

  const choose = (d: 'ready' | 'extend') => { setDecision(d); setError(''); setStep('details'); };
  const last = batch.saleReview;

  return (
    <FlowShell
      steps={steps}
      step={step === 'done' ? 'details' : step}
      title={step === 'decide' ? tx('sTitle', { name: batch.name }) : step === 'details' ? (decision === 'ready' ? tx('sTitleReady') : tx('sTitleKeep')) : tx('sTitleSaved')}
      subtitle={step === 'decide' ? [row.farm, tx('sAnimalsN', { n: row.head }), when(row.daysRemaining, tx)].filter(Boolean).join(' · ') : step === 'details' ? (decision === 'ready' ? tx('sSubReady') : tx('sSubKeep')) : tx('sSubSaved')}
      error={error}
      onSubmit={step === 'details' ? save : undefined}
      footer={step === 'details' ? <FlowFooter onBack={() => { setError(''); setStep('decide'); }} label={saving ? flow.tx('saving') : tx('sSave')} busy={saving} /> : null}
    >
      {step === 'decide' && (
        <>
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div><dt className="text-sm text-ink-muted">{tx('average')}</dt><dd className="text-lg font-semibold text-ink">{row.head ? `${Math.round(row.avgWeight)} kg` : '—'}</dd></div>
            <div><dt className="text-sm text-ink-muted">{tx('dailyGain')}</dt><dd className="text-lg font-semibold text-ink">{row.perDay !== null ? `${row.perDay} kg` : '—'}</dd></div>
            <div><dt className="text-sm text-ink-muted">{tx('rExpected')}</dt><dd className="text-lg font-semibold text-ink">{row.expectedValue !== null ? money(row.expectedValue) : '—'}</dd></div>
          </dl>
          {last && (
            <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">
              {last.decision === 'ready'
                ? tx('sLastReady', { by: last.by, day: shownDay(last.at, language), note: last.note ? `. “${last.note}”` : '' })
                : tx('sLastKept', { by: last.by, day: shownDay(last.at, language), from: last.previousTarget ? tx('sFrom', { date: shownDay(last.previousTarget, language) }) : '', note: last.note ? `. “${last.note}”` : '' })}
            </p>
          )}
          <ul className="space-y-3">
            <li>
              <RowButton onClick={() => choose('ready')} selected={decision === 'ready'}>
                <span><span className="block text-xl font-semibold text-ink">{tx('sTitleReady')}</span><span className="block text-base text-ink-muted">{tx('sReadyHint')}</span></span>
              </RowButton>
            </li>
            <li>
              <RowButton onClick={() => choose('extend')} selected={decision === 'extend'}>
                <span><span className="block text-xl font-semibold text-ink">{tx('sTitleKeep')}</span><span className="block text-base text-ink-muted">{tx('sKeepHint')}</span></span>
              </RowButton>
            </li>
          </ul>
        </>
      )}

      {step === 'details' && (
        <>
          {decision === 'extend' && (
            <Question label={tx('sNewDate')} hint={tx('sNewDateHint', { date: batch.sellingTargetDate ? shownDay(batch.sellingTargetDate, language) : tx('none'), n: windowDays })}>
              <div className="flex flex-wrap gap-3">
                {[30, 60, 90].map(n => (
                  <Choice key={n} selected={newDate === addDays(today, n)} onClick={() => { setNewDate(addDays(today, n)); setError(''); }}>{n === 30 ? tx('sInMonthOne') : tx('sInMonths', { n: n / 30 })}</Choice>
                ))}
              </div>
              <Input aria-label={tx('sNewDate')} type="date" min={addDays(today, 1)} value={newDate} onChange={e => { setNewDate(e.target.value); setError(''); }} className="mt-3 h-14 text-lg" />
            </Question>
          )}
          <Question label={tx('sNote')} hint={decision === 'extend' ? tx('sNoteKeepHint') : tx('sNoteReadyHint')}>
            <Input aria-label={tx('sNoteAria')} value={note} maxLength={500} onChange={e => setNote(e.target.value)} className="h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'done' && (
        <FlowDone
          message={decision === 'ready' ? tx('sDoneReady', { name: batch.name }) : tx('sDoneKeep', { name: batch.name, date: shownDay(newDate, language) })}
          detail={decision === 'ready' ? tx('sDoneReadyDetail') : tx('sDoneKeepDetail', { n: windowDays })}
          again={tx('sAgain')}
          onAgain={onClose}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
