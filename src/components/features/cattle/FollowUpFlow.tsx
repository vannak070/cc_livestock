'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addDays, farmToday } from '@/lib/daily-feed';
import { FOLLOW_UP_ACTIONS, FOLLOW_UP_NOTE_MAX, followUpProblem, type FollowUpInput } from '@/lib/long-stay';
import type { FollowUpAction } from '@/lib/types';
import { shownDay } from '@/lib/khmer-date';
import { Choice, FlowDone, FlowFooter, FlowShell, Question, RowButton } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';

interface FollowUpFlowProps {
  isOpen: boolean;
  onClose: () => void;
  cowId: string;
  /** Whole months the animal has been on the farm, for the subtitle. */
  months?: number;
  /** The action already recorded, so the dialog starts from it. */
  current?: { action: FollowUpAction; note: string; dueDate?: string };
  onSave: (cowId: string, input: FollowUpInput) => Promise<void>;
}

type Step = 'action' | 'details' | 'done';

/** Record what happens next to an animal that has been on the farm a long time. */
export default function FollowUpFlow(props: FollowUpFlowProps) {
  // Remount on every open so each decision starts clean.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <FollowUpBody {...props} />}
    </Dialog>
  );
}

function FollowUpBody({ onClose, cowId, months, current, onSave }: FollowUpFlowProps) {
  const { tx, language } = useText('longStay');
  const flow = useText('flow');
  const today = farmToday();
  const [step, setStep] = useState<Step>('action');
  const [action, setAction] = useState<FollowUpAction | null>(current?.action ?? null);
  const [dueDate, setDueDate] = useState(current?.dueDate ?? '');
  const [note, setNote] = useState(current?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const input = (): FollowUpInput => ({ action: action!, note, dueDate });

  const save = async () => {
    if (!action) { setError(tx('eChoose')); return; }
    const problem = followUpProblem(input(), today);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(cowId, input());
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('eSave'));
    } finally {
      setSaving(false);
    }
  };

  const choose = (a: FollowUpAction) => { setAction(a); setError(''); setStep('details'); };
  const quick = [
    { key: 'in1w', days: 7 },
    { key: 'in2w', days: 14 },
    { key: 'in1m', days: 30 },
  ];

  return (
    <FlowShell
      steps={['action', 'details']}
      step={step === 'done' ? 'details' : step}
      title={step === 'done' ? tx('savedTitle') : step === 'action' ? tx('flowTitle') : tx('whenTitle')}
      subtitle={months !== undefined ? tx('flowSub', { id: cowId, months }) : tx('flowSubShort', { id: cowId })}
      error={error}
      onSubmit={step === 'details' ? save : undefined}
      footer={step === 'details' ? <FlowFooter onBack={() => { setError(''); setStep('action'); }} label={saving ? tx('saving') : tx('save')} busy={saving} /> : null}
    >
      {step === 'action' && (
        <ul className="space-y-3">
          {FOLLOW_UP_ACTIONS.map(a => (
            <li key={a}>
              <RowButton onClick={() => choose(a)} selected={action === a}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{tx(`a_${a}`)}</span>
                  <span className="block text-base text-ink-muted">{tx(`ah_${a}`)}</span>
                </span>
              </RowButton>
            </li>
          ))}
        </ul>
      )}

      {step === 'details' && action && (
        <>
          <Question label={tx('whenTitle')}>
            <div className="flex flex-wrap gap-3">
              <Choice selected={dueDate === ''} onClick={() => { setDueDate(''); setError(''); }}>{tx('noDate')}</Choice>
              {quick.map(q => (
                <Choice key={q.key} selected={dueDate === addDays(today, q.days)} onClick={() => { setDueDate(addDays(today, q.days)); setError(''); }}>{tx(q.key)}</Choice>
              ))}
            </div>
            <Input aria-label={tx('dateAria')} type="date" min={today} value={dueDate} onChange={e => { setDueDate(e.target.value); setError(''); }} className="mt-3 h-14 text-lg" />
          </Question>
          <Question label={action === 'other' ? tx('noteOther') : tx('note')}>
            <Input aria-label={tx('noteAria')} value={note} maxLength={FOLLOW_UP_NOTE_MAX} onChange={e => { setNote(e.target.value); setError(''); }} className="h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'done' && action && (
        <FlowDone message={tx('savedMsg', { id: cowId, action: tx(`a_${action}`) })} detail={dueDate ? tx('byDay', { day: shownDay(dueDate, language) }) : undefined} onClose={onClose} />
      )}
    </FlowShell>
  );
}
