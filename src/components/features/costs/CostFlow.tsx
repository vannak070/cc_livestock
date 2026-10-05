'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FarmItem, UserRoleItem } from '@/lib/types';
import type { FarmCostInput } from '@/lib/farm-costs';
import { farmToday } from '@/lib/daily-feed';
import { FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, money } from '../flow/FlowShell';
import { useCostText } from './useCostText';

interface CostFlowProps {
  isOpen: boolean;
  onClose: () => void;
  farms: FarmItem[];
  /** The kinds of cost to choose from (Settings → Lists). */
  categories: string[];
  currentUser?: UserRoleItem;
  onSave: (input: FarmCostInput) => Promise<void>;
}

type Step = 'what' | 'amount' | 'where' | 'note' | 'done';
const STEPS: Step[] = ['what', 'amount', 'where', 'note'];

export default function CostFlow(props: CostFlowProps) {
  // Remount on every open so each cost starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <CostBody {...props} />}
    </Dialog>
  );
}

function CostBody({ onClose, farms, categories, currentUser, onSave }: CostFlowProps) {
  const { text, category: label, inline } = useCostText();
  const lockedFarm = currentUser?.farmLocation || null;
  const [step, setStep] = useState<Step>('what');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [farm, setFarm] = useState(lockedFarm ?? (farms.length === 1 ? farms[0].name : ''));
  const [date, setDate] = useState(farmToday());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ category: string; amount: number } | null>(null);

  const at = STEPS.indexOf(step);
  const value = Number(amount);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave({ farmLocation: farm, category, amount: value, date, note: note.trim() || undefined });
      setSaved({ category, amount: value });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : text('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'amount' && !(value > 0)) { setError(text('errAmount')); return; }
    if (step === 'where' && !farm) { setError(text('errFarm')); return; }
    if (step === 'where' && !date) { setError(text('errDate')); return; }
    if (step === 'note') { save(); return; }
    setError('');
    setStep(STEPS[at + 1]);
  };
  const back = () => { setError(''); setStep(STEPS[at - 1]); };
  const another = () => {
    setCategory(''); setAmount(''); setNote(''); setError('');
    setStep('what');
  };

  const summary = step === 'amount' ? label(category)
    : step === 'where' || step === 'note' ? [label(category), money(value), step === 'note' ? farm : ''].filter(Boolean).join(' · ')
    : '';

  const title = {
    what: text('whatTitle'),
    amount: category === 'Other' ? text('amountTitleOther') : text('amountTitle', { category: inline(category) }),
    where: text('whereTitle'),
    note: text('noteTitle'),
    done: text('doneTitle'),
  }[step];
  const subtitle = {
    what: text('whatSub'),
    amount: text('amountSub'),
    where: lockedFarm ? text('whereSubLocked') : text('whereSub'),
    note: text('noteSub'),
    done: text('doneSub'),
  }[step];
  const pickText = { searchText: text('search'), searchAria: text('searchAria'), noMatchText: text('noMatch') };

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={summary}
      error={error}
      onSubmit={step === 'what' || step === 'done' ? undefined : next}
      footer={step === 'what' || step === 'done' ? null : (
        <FlowFooter onBack={back} label={step === 'note' ? (saving ? text('saving') : text('save')) : text('next')} busy={saving} />
      )}
    >
      {step === 'what' && (
        <PickList options={categories} value={category} labelFor={label} {...pickText} onChange={v => { setCategory(v); setError(''); setStep('amount'); }} />
      )}

      {step === 'amount' && (
        <Question label={text('amountLabel')}>
          <Input aria-label={text('amountAria')} type="number" step="any" min="0" inputMode="decimal" autoFocus value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          {value > 0 && <p className="mt-3 text-lg text-ink-muted">{money(value)}</p>}
        </Question>
      )}

      {step === 'where' && (
        <>
          {lockedFarm ? (
            <Question label={text('farm')}><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
          ) : (
            <Question label={text('whichFarm')}>
              <PickList options={farms.map(f => f.name)} value={farm} {...pickText} onChange={v => { setFarm(v); setError(''); }} />
            </Question>
          )}
          <Question label={text('datePaid')}><Input aria-label={text('datePaid')} type="date" value={date} max={farmToday()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'note' && (
        <Question label={text('noteLabel')}><Input aria-label={text('noteAria')} value={note} maxLength={500} onChange={e => setNote(e.target.value)} className="h-14 text-lg" /></Question>
      )}

      {step === 'done' && saved && (
        <FlowDone
          message={text('doneMessage', { amount: money(saved.amount), category: inline(saved.category) })}
          again={text('again')}
          doneText={text('finished')}
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
