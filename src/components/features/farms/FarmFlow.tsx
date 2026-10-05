'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmItem, MasterSetup } from '@/lib/types';
import { validateFarm, type FarmErrors, type FarmInput } from '@/lib/farm-settings';
import { FlowFooter, FlowShell, NUM, Question } from '../flow/FlowShell';

interface FarmFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The farm being edited; leave empty to add a new one. */
  farm?: FarmItem | null;
  settings: MasterSetup;
  /** Saves and returns the saved farm. */
  onSave: (input: FarmInput) => Promise<FarmItem>;
  /** After a new farm is saved, the person may go straight on to add its owner. */
  onAddOwner?: (farm: FarmItem) => void;
}

type Step = 'farm' | 'more' | 'done';

export default function FarmFlow(props: FarmFlowProps) {
  // Remount on every open so each add or edit starts from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <FarmBody {...props} />}
    </Dialog>
  );
}

function FarmBody({ onClose, farm, settings, onSave, onAddOwner }: FarmFlowProps) {
  const edit = !!farm;
  const [step, setStep] = useState<Step>('farm');
  const [name, setName] = useState(farm?.name ?? '');
  const [capacity, setCapacity] = useState(farm?.capacity ? String(farm.capacity) : '');
  const [address, setAddress] = useState(farm?.address ?? '');
  const [notes, setNotes] = useState(farm?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<FarmItem | null>(null);

  const steps: Step[] = ['farm', 'more'];
  const input = (): FarmInput => ({ name, address, capacity: Number(capacity), notes });

  const problem = (): string | null => {
    const errors: FarmErrors = validateFarm(settings, input(), farm ?? null);
    return errors.name ?? errors.capacity ?? null;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await onSave(input());
      if (edit) { onClose(); return; }
      setSaved(result);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'farm') {
      const p = problem();
      if (p) { setError(p); return; }
      setError('');
      setStep('more');
    } else if (step === 'more') save();
  };

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={step === 'done' ? 'Farm added' : edit ? 'Edit farm' : 'Add a farm'}
      subtitle={step === 'farm' ? 'Its name, and how many cattle it can hold.' : step === 'more' ? 'Both are optional.' : 'It is ready to use.'}
      summary={step === 'more' ? name.trim() : ''}
      error={error}
      onSubmit={step === 'done' ? undefined : next}
      footer={step === 'done' ? null : <FlowFooter onBack={step === 'more' ? () => { setError(''); setStep('farm'); } : undefined} label={step === 'more' ? (saving ? 'Saving…' : 'Save farm') : 'Next'} busy={saving} />}
    >
      {step === 'farm' && (
        <>
          <Question label="Name of the farm">
            <Input aria-label="Name of the farm" autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          <Question label="Cattle it can hold" hint="Used to show how full the farm is.">
            <Input aria-label="Cattle it can hold" type="number" inputMode="numeric" value={capacity} onChange={e => { setCapacity(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
          </Question>
        </>
      )}

      {step === 'more' && (
        <>
          <Question label="Address (optional)"><Input aria-label="Address" autoFocus value={address} onChange={e => setAddress(e.target.value)} placeholder="District, province" className="h-14 text-lg" /></Question>
          <Question label="Notes (optional)"><Input aria-label="Notes" value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && saved && (
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-5 pt-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-11 w-11" aria-hidden /></div>
            <p className="text-2xl text-ink"><span className="font-semibold">{saved.name}</span> was added</p>
            <p className="text-lg text-ink-muted">Next, add the person who owns and runs it. They sign in with their own email and password.</p>
          </div>
          <div className="flex flex-col gap-3">
            {onAddOwner && <Button type="button" size="lg" onClick={() => { onAddOwner(saved); onClose(); }}>Add the owner</Button>}
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>Later</Button>
          </div>
        </div>
      )}
    </FlowShell>
  );
}
