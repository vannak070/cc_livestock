'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addDays, farmToday } from '@/lib/daily-feed';
import { saleReviewProblem, type SaleReviewInput, type SaleReviewRow } from '@/lib/sale-review';
import { Choice, FlowDone, FlowFooter, FlowShell, Question, RowButton, money } from '../flow/FlowShell';

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

const when = (days: number) => (days < 0 ? `${-days} days past its selling date` : days === 0 ? 'selling date is today' : `selling date in ${days} days`);

function SaleReviewBody({ onClose, row, onSave, windowDays }: SaleReviewFlowProps & { row: SaleReviewRow }) {
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
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
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
      title={step === 'decide' ? `Review ${batch.name}` : step === 'details' ? (decision === 'ready' ? 'Ready to sell' : 'Keep feeding') : 'Saved'}
      subtitle={step === 'decide' ? [row.farm, `${row.head} animals`, when(row.daysRemaining)].filter(Boolean).join(' · ') : step === 'details' ? (decision === 'ready' ? 'Add a note if you like.' : 'Choose the new selling date.') : 'The review is on the batch.'}
      error={error}
      onSubmit={step === 'details' ? save : undefined}
      footer={step === 'details' ? <FlowFooter onBack={() => { setError(''); setStep('decide'); }} label={saving ? 'Saving…' : 'Save review'} busy={saving} /> : null}
    >
      {step === 'decide' && (
        <>
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
            <div><dt className="text-sm text-ink-muted">Average</dt><dd className="text-lg font-semibold text-ink">{row.head ? `${Math.round(row.avgWeight)} kg` : '—'}</dd></div>
            <div><dt className="text-sm text-ink-muted">Daily gain</dt><dd className="text-lg font-semibold text-ink">{row.perDay !== null ? `${row.perDay} kg` : '—'}</dd></div>
            <div><dt className="text-sm text-ink-muted">Expected</dt><dd className="text-lg font-semibold text-ink">{row.expectedValue !== null ? money(row.expectedValue) : '—'}</dd></div>
          </dl>
          {last && (
            <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">
              Last review by <span className="font-semibold">{last.by}</span> on {last.at.slice(0, 10)}: {last.decision === 'ready' ? 'ready to sell' : `kept feeding${last.previousTarget ? `, from ${last.previousTarget}` : ''}`}{last.note ? `. “${last.note}”` : ''}
            </p>
          )}
          <ul className="space-y-3">
            <li>
              <RowButton onClick={() => choose('ready')} selected={decision === 'ready'}>
                <span><span className="block text-xl font-semibold text-ink">Ready to sell</span><span className="block text-base text-ink-muted">Sell this batch now. It stops raising alerts.</span></span>
              </RowButton>
            </li>
            <li>
              <RowButton onClick={() => choose('extend')} selected={decision === 'extend'}>
                <span><span className="block text-xl font-semibold text-ink">Keep feeding</span><span className="block text-base text-ink-muted">Not ready yet. Choose a new selling date.</span></span>
              </RowButton>
            </li>
          </ul>
        </>
      )}

      {step === 'details' && (
        <>
          {decision === 'extend' && (
            <Question label="New selling date" hint={`Now: ${batch.sellingTargetDate?.slice(0, 10) ?? 'none'}. You will be reminded ${windowDays} days before the new date.`}>
              <div className="flex flex-wrap gap-3">
                {[30, 60, 90].map(n => (
                  <Choice key={n} selected={newDate === addDays(today, n)} onClick={() => { setNewDate(addDays(today, n)); setError(''); }}>In {n / 30} {n === 30 ? 'month' : 'months'}</Choice>
                ))}
              </div>
              <Input aria-label="New selling date" type="date" min={addDays(today, 1)} value={newDate} onChange={e => { setNewDate(e.target.value); setError(''); }} className="mt-3 h-14 text-lg" />
            </Question>
          )}
          <Question label="Note (optional)" hint={decision === 'extend' ? 'For example why it needs longer.' : 'For example the buyer or the price.'}>
            <Input aria-label="Note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} className="h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'done' && (
        <FlowDone
          message={decision === 'ready' ? <><span className="font-semibold">{batch.name}</span> is marked ready to sell</> : <><span className="font-semibold">{batch.name}</span> will be fed until <span className="font-semibold">{newDate}</span></>}
          detail={decision === 'ready' ? 'Sell its cattle on the Sales page.' : `You will be reminded ${windowDays} days before the new date.`}
          again="Review another batch"
          onAgain={onClose}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
