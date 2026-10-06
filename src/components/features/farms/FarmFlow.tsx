'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmItem, MasterSetup } from '@/lib/types';
import { validateFarm, type FarmErrors, type FarmInput } from '@/lib/farm-settings';
import { Choice, FlowFooter, FlowShell, NUM, Question } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';

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
  /** Only a Super Admin or Admin sets the cattle limit; others see it locked. */
  canSetLimit?: boolean;
  /** Cattle already registered on the farm being edited (the limit cannot go below it). */
  used?: number;
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

function FarmBody({ onClose, farm, settings, onSave, onAddOwner, canSetLimit = false, used = 0 }: FarmFlowProps) {
  const { tx } = useText('farmsPage');
  const lim = useText('farmLimits');
  const flow = useText('flow');
  const edit = !!farm;
  const [step, setStep] = useState<Step>('farm');
  const [name, setName] = useState(farm?.name ?? '');
  const [capacity, setCapacity] = useState(farm?.capacity ? String(farm.capacity) : '');
  const [address, setAddress] = useState(farm?.address ?? '');
  const [notes, setNotes] = useState(farm?.notes ?? '');
  const [companyRun, setCompanyRun] = useState(!!farm?.companyRun);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<FarmItem | null>(null);

  const steps: Step[] = ['farm', 'more'];
  const input = (): FarmInput => ({ name, address, capacity: Number(capacity), notes, companyRun });

  const problem = (): string | null => {
    const errors: FarmErrors = validateFarm(settings, input(), farm ?? null);
    if (errors.name) return errors.name;
    if (!canSetLimit) return null; // the server keeps the existing limit for everyone else
    const n = Number(capacity);
    if (!(Number.isInteger(n) && n >= used)) return lim.tx('eLimit', { min: used });
    return null;
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
      setError(e instanceof Error ? e.message : tx('fErrSave'));
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
      title={step === 'done' ? tx('fTitleDone') : edit ? tx('fTitleEdit') : tx('fTitleAdd')}
      subtitle={step === 'farm' ? tx('fSubFarm') : step === 'more' ? tx('fSubMore') : tx('fSubDone')}
      summary={step === 'more' ? name.trim() : ''}
      error={error}
      onSubmit={step === 'done' ? undefined : next}
      footer={step === 'done' ? null : <FlowFooter onBack={step === 'more' ? () => { setError(''); setStep('farm'); } : undefined} label={step === 'more' ? (saving ? flow.tx('saving') : tx('fSave')) : flow.tx('next')} busy={saving} />}
    >
      {step === 'farm' && (
        <>
          <Question label={tx('fName')}>
            <Input aria-label={tx('fName')} autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          {canSetLimit ? (
            <Question label={lim.tx('limitLabel')} hint={lim.tx('limitHint')}>
              <Input aria-label={lim.tx('limitLabel')} type="number" inputMode="numeric" min={used} step="1" value={capacity} onChange={e => { setCapacity(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
              {/* How full the farm is, and quick ways to give it more room (every registered animal counts, sold ones too). */}
              {(() => {
                const typed = Number(capacity);
                const valid = capacity.trim() !== '' && Number.isInteger(typed) && typed >= 0;
                const left = valid ? typed - used : 0;
                const tone = !valid || typed === 0 ? 'text-ink-muted' : left < 0 ? 'text-rose-700' : left === 0 ? 'text-amber-800' : 'text-emerald-800';
                const line = !valid || typed === 0 ? lim.tx('limitNowNone') : left < 0 ? lim.tx('limitNowBelow', { used }) : left === 0 ? lim.tx('limitNowFull', { used }) : lim.tx('limitNow', { used, left });
                const add = (n: number) => { setCapacity(String((valid ? typed : 0) + n)); setError(''); };
                const was = farm?.capacity ?? 0;
                return (
                  <div className="mt-3 space-y-3">
                    <p role="status" className={`text-base font-medium ${tone}`}>
                      {line}{edit && valid && typed !== was ? ` · ${lim.tx('limitWas', { from: was })}` : ''}
                    </p>
                    <div>
                      <p className="mb-2 text-base font-medium text-ink">{lim.tx('limitAdd')}</p>
                      <div className="flex flex-wrap gap-2">
                        {[10, 50, 100].map(n => (
                          <Button key={n} type="button" variant="outline" aria-label={lim.tx('limitAddAria', { n })} onClick={() => add(n)}>{lim.tx('limitAddBtn', { n })}</Button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Question>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-base text-ink">
              {farm?.capacity ? lim.tx('limitLocked', { limit: farm.capacity }) : lim.tx('limitLockedNone')}
            </p>
          )}
          <Question label={tx('fWhoRuns')} hint={companyRun ? tx('fCompanyHint') : tx('fOwnerHint')}>
            <div className="flex flex-wrap gap-3">
              <Choice selected={!companyRun} onClick={() => setCompanyRun(false)}>{tx('fAnOwner')}</Choice>
              <Choice selected={companyRun} onClick={() => setCompanyRun(true)}>{tx('fCompany')}</Choice>
            </div>
          </Question>
        </>
      )}

      {step === 'more' && (
        <>
          <Question label={tx('fAddress')}><Input aria-label={tx('fAddressAria')} autoFocus value={address} onChange={e => setAddress(e.target.value)} placeholder={tx('fAddressPh')} className="h-14 text-lg" /></Question>
          <Question label={tx('fNotes')}><Input aria-label={tx('fNotesAria')} value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && saved && (
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-5 pt-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-11 w-11" aria-hidden /></div>
            <p className="text-2xl font-semibold text-ink">{tx('fAdded', { name: saved.name })}</p>
            <p className="text-lg text-ink-muted">{saved.companyRun ? tx('fAddedCompany') : tx('fAddedOwner')}</p>
          </div>
          <div className="flex flex-col gap-3">
            {onAddOwner && !saved.companyRun && <Button type="button" size="lg" onClick={() => { onAddOwner(saved); onClose(); }}>{tx('addTheOwner')}</Button>}
            <Button type="button" size="lg" variant={saved.companyRun ? 'default' : 'secondary'} onClick={onClose}>{saved.companyRun ? tx('fDone') : tx('fLater')}</Button>
          </div>
        </div>
      )}
    </FlowShell>
  );
}
