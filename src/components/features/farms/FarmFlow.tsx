'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FarmItem, MasterSetup } from '@/lib/types';
import { farmOwner, validateFarm, type FarmErrors, type FarmInput } from '@/lib/farm-settings';
import { FlowFooter, FlowShell, NUM, Question } from '../flow/FlowShell';

interface FarmFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The farm being edited; leave empty to add a new one. */
  farm?: FarmItem | null;
  settings: MasterSetup;
  onSave: (input: FarmInput) => Promise<void>;
}

type Step = 'farm' | 'owner' | 'more';
const STEPS: Step[] = ['farm', 'owner', 'more'];

export default function FarmFlow(props: FarmFlowProps) {
  // Remount on every open so each add or edit starts from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <FarmBody {...props} />}
    </Dialog>
  );
}

function FarmBody({ onClose, farm, settings, onSave }: FarmFlowProps) {
  const edit = !!farm;
  const owner = farm ? farmOwner(settings, farm.name) : undefined;

  const [step, setStep] = useState<Step>('farm');
  const [name, setName] = useState(farm?.name ?? '');
  const [capacity, setCapacity] = useState(farm?.capacity ? String(farm.capacity) : '');
  const [ownerName, setOwnerName] = useState(owner?.name ?? farm?.ownerName ?? '');
  const [ownerEmail, setOwnerEmail] = useState(owner?.email ?? farm?.ownerEmail ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState(farm?.address ?? '');
  const [notes, setNotes] = useState(farm?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const at = STEPS.indexOf(step);
  const input = (): FarmInput => ({ name, address, capacity: Number(capacity), ownerName, ownerEmail, ownerPassword: password, notes });
  const fieldsOf: Record<Step, (keyof FarmErrors)[]> = { farm: ['name', 'capacity'], owner: ['ownerName', 'ownerEmail', 'ownerPassword'], more: [] };

  const firstError = (s: Step): string | null => {
    const errors = validateFarm(settings, input(), farm ?? null);
    for (const key of fieldsOf[s]) if (errors[key]) return errors[key]!;
    return null;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(input());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    const problem = firstError(step);
    if (problem) { setError(problem); return; }
    if (step === 'more') { save(); return; }
    setError('');
    setStep(STEPS[at + 1]);
  };
  const back = () => { setError(''); setStep(STEPS[at - 1]); };

  const heading: Record<Step, { title: string; sub: string }> = {
    farm: { title: edit ? 'Edit farm' : 'Add a farm', sub: 'Its name, and how many cattle it can hold.' },
    owner: { title: 'The owner\'s login', sub: edit ? 'Change the owner, or leave the password empty to keep it.' : 'The owner signs in with this email and password.' },
    more: { title: 'A few more details', sub: 'Both are optional.' },
  };

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={step === 'farm' ? '' : name.trim()}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : back} label={step === 'more' ? (saving ? 'Saving…' : 'Save farm') : 'Next'} busy={saving} />}
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

      {step === 'owner' && (
        <>
          <Question label="Owner's name"><Input aria-label="Owner's name" autoFocus value={ownerName} onChange={e => { setOwnerName(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <Question label="Login email"><Input aria-label="Login email" type="email" inputMode="email" autoComplete="off" value={ownerEmail} onChange={e => { setOwnerEmail(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <Question label={owner ? 'New password (optional)' : 'Password'} hint={owner ? 'Leave empty to keep the current password.' : undefined}>
            <div className="flex gap-2">
              <Input aria-label="Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} className="h-14 text-lg" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="min-h-14 shrink-0 rounded-xl border-2 border-slate-200 px-4 text-base font-medium text-ink hover:border-emerald-600">{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </Question>
        </>
      )}

      {step === 'more' && (
        <>
          <Question label="Address (optional)"><Input aria-label="Address" autoFocus value={address} onChange={e => setAddress(e.target.value)} placeholder="District, province" className="h-14 text-lg" /></Question>
          <Question label="Notes (optional)"><Input aria-label="Notes" value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}
    </FlowShell>
  );
}
