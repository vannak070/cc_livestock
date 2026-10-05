'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { HealthLogItem, MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { sickCattle } from '@/lib/attention';
import { FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, RowButton, today } from '../flow/FlowShell';

interface TreatFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active cattle the person may treat. */
  cattle: StockItem[];
  common: MasterSetup;
  currentUser?: UserRoleItem;
  /** Skips step 1 when the caller already knows which animal. */
  preselectedCowId?: string | null;
  /** Several animals already chosen, for example a whole batch. */
  preselectedCowIds?: string[];
  onSave: (log: Omit<HealthLogItem, 'id'>) => Promise<void>;
}

type Step = 'pick' | 'what' | 'name' | 'extra' | 'done';
type Kind = HealthLogItem['type'];

const OTHER = '__other__';

const KINDS: { type: Kind; title: string; hint: string; names: string[] }[] = [
  { type: 'Vaccination', title: 'Vaccine', hint: 'A vaccine injection', names: [] },
  { type: 'Treatment', title: 'Treatment', hint: 'Medicine for a sick animal', names: ['Antibiotics Injection'] },
  { type: 'Deworming', title: 'Deworming', hint: 'Worm medicine', names: ['Broad Spectrum Dewormer'] },
  { type: 'Disease', title: 'Illness found', hint: 'Write down a disease you found', names: ['Foot and Mouth Disease'] },
];

export default function TreatFlow(props: TreatFlowProps) {
  // Remount on every open so each entry starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <TreatBody {...props} />}
    </Dialog>
  );
}

function TreatBody({ onClose, cattle, common, currentUser, preselectedCowId, preselectedCowIds, onSave }: TreatFlowProps) {
  const known = new Set(cattle.map(c => c.id));
  const initial = preselectedCowIds?.length
    ? preselectedCowIds.filter(id => known.has(id))
    : preselectedCowId && known.has(preselectedCowId) ? [preselectedCowId] : [];
  const [step, setStep] = useState<Step>(initial.length ? 'what' : 'pick');
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind | null>(null);
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(today());
  const [cost, setCost] = useState('');
  const [by, setBy] = useState(currentUser?.name ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ count: number; name: string } | null>(null);

  const steps: Step[] = initial.length ? ['what', 'name', 'extra'] : ['pick', 'what', 'name', 'extra'];
  const at = steps.indexOf(step);

  const sickIds = useMemo(() => new Set(sickCattle(cattle).map(c => c.id)), [cattle]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cattle
      .filter(c => !q || c.id.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q))
      .sort((a, b) => Number(sickIds.has(b.id)) - Number(sickIds.has(a.id)));
  }, [cattle, query, sickIds]);

  const toggle = (id: string) => { setError(''); setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])); };

  const kindInfo = KINDS.find(k => k.type === kind);
  const names = kind === 'Vaccination' ? common.vaccineTypes ?? [] : kindInfo?.names ?? [];
  const finalName = choice === OTHER ? custom.trim() : choice;
  const each = Number(cost) || 0;

  const save = async () => {
    if (!kind) return;
    if (!by.trim()) { setError('Type who gave it.'); return; }
    setSaving(true);
    setError('');
    const done: string[] = [];
    try {
      for (const cowId of picked) {
        await onSave({ cowId, type: kind, name: finalName, date, administeredBy: by.trim(), cost: each, notes: notes.trim() || undefined });
        done.push(cowId);
      }
      setSaved({ count: done.length, name: finalName });
      setStep('done');
    } catch (e) {
      // Drop the animals already saved so a retry does not record them twice.
      setPicked(p => p.filter(id => !done.includes(id)));
      const msg = e instanceof Error ? e.message : 'Could not save.';
      setError(done.length ? `${msg} ${done.length} saved before this; the rest are still selected.` : `${msg} Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'pick') { if (!picked.length) { setError('Tap at least one animal.'); return; } }
    if (step === 'name' && !finalName) { setError(choice === OTHER ? 'Type the name.' : 'Choose what was given.'); return; }
    if (step === 'extra') { save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };

  const another = () => {
    setPicked([]); setQuery(''); setKind(null); setChoice(''); setCustom(''); setCost(''); setNotes(''); setError('');
    setStep('pick');
  };

  const who = picked.length === 1 ? picked[0] : `${picked.length} animals`;
  const summary = step === 'name' || step === 'extra'
    ? [who, kindInfo?.title, step === 'extra' ? finalName : ''].filter(Boolean).join(' · ')
    : step === 'what' && picked.length ? who : '';

  const title = { pick: 'Which animals?', what: 'What was done?', name: kind === 'Disease' ? 'Which illness?' : kind === 'Vaccination' ? 'Which vaccine?' : 'What was given?', extra: 'A few more details', done: 'Saved' }[step];
  const subtitle = {
    pick: 'Tap every animal that was treated. Sick ones are at the top.',
    what: 'Choose one.',
    name: 'Pick one, or choose "Something else".',
    extra: 'Who gave it, and when.',
    done: 'It is on the health record.',
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={summary}
      error={error}
      onSubmit={step === 'what' || step === 'done' ? undefined : next}
      footer={step === 'what' || step === 'done' ? (step === 'what' && at > 0 ? <FlowBackOnly onBack={back} /> : null) : (
        <FlowFooter
          onBack={at === 0 ? undefined : back}
          label={step === 'extra' ? (saving ? 'Saving…' : 'Save') : step === 'pick' && picked.length ? `Next (${picked.length})` : 'Next'}
          busy={saving}
        />
      )}
    >
      {step === 'pick' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="h-14 pl-10 text-lg" />
          </div>
          <ul className="space-y-3 pb-2">
            {list.map(c => {
              const on = picked.includes(c.id);
              return (
                <li key={c.id}>
                  <RowButton onClick={() => toggle(c.id)} selected={on}>
                    <span>
                      <span className="block text-xl font-semibold text-ink">{c.id}</span>
                      <span className="block text-base text-ink-muted">{[c.breed, c.sex].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {sickIds.has(c.id) && <span className="text-base font-medium text-rose-700">{c.healthStatus}</span>}
                      {on && <Check className="h-7 w-7 text-emerald-700" aria-hidden />}
                    </span>
                  </RowButton>
                </li>
              );
            })}
            {list.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">No animal with that tag.</li>}
          </ul>
        </>
      )}

      {step === 'what' && (
        <ul className="space-y-3">
          {KINDS.map(k => (
            <li key={k.type}>
              <button
                type="button"
                onClick={() => { setKind(k.type); setChoice(''); setCustom(''); setError(''); setStep('name'); }}
                className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600"
              >
                <span className="text-xl font-semibold text-ink">{k.title}</span>
                <span className="text-base text-ink-muted">{k.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 'name' && (
        <>
          <PickList options={[...names, OTHER]} value={choice} onChange={v => { setChoice(v); setError(''); }} labelFor={n => (n === OTHER ? 'Something else' : n)} />
          {choice === OTHER && <Input autoFocus aria-label="Name" value={custom} onChange={e => { setCustom(e.target.value); setError(''); }} placeholder="Type the name" className="h-14 text-lg" />}
        </>
      )}

      {step === 'extra' && (
        <>
          <Question label="Given by"><Input aria-label="Given by" value={by} onChange={e => { setBy(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <Question label="Date"><Input aria-label="Date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label="Cost for each animal (៛, optional)"><Input aria-label="Cost for each animal" type="number" inputMode="numeric" value={cost} onChange={e => setCost(e.target.value)} className={`h-14 text-lg ${NUM}`} /></Question>
          <Question label="Note (optional)"><Input aria-label="Note" value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && saved && (
        <FlowDone
          message={<><span className="font-semibold">{saved.name}</span> recorded for <span className="font-semibold">{saved.count} {saved.count === 1 ? 'animal' : 'animals'}</span></>}
          again="Treat more animals"
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}

function FlowBackOnly({ onBack }: { onBack: () => void }) {
  return (
    <Button type="button" variant="secondary" size="lg" onClick={onBack} aria-label="Go back"><ArrowLeft /></Button>
  );
}
