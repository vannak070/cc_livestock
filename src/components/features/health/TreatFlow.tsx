'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HealthLogItem, MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { sickCattle } from '@/lib/attention';

interface TreatFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active cattle the person may treat. */
  cattle: StockItem[];
  common: MasterSetup;
  currentUser?: UserRoleItem;
  /** Skips step 1 when the caller already knows which animal. */
  preselectedCowId?: string | null;
  onSave: (log: Omit<HealthLogItem, 'id'>) => Promise<void>;
}

type Step = 'pick' | 'what' | 'details' | 'done';
type Kind = HealthLogItem['type'];

const today = () => new Date().toISOString().split('T')[0];
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

function TreatBody({ onClose, cattle, common, currentUser, preselectedCowId, onSave }: TreatFlowProps) {
  const initial = preselectedCowId && cattle.some(c => c.id === preselectedCowId) ? [preselectedCowId] : [];
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

  const sickIds = useMemo(() => new Set(sickCattle(cattle).map(c => c.id)), [cattle]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cattle
      .filter(c => !q || c.id.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q))
      .sort((a, b) => Number(sickIds.has(b.id)) - Number(sickIds.has(a.id)));
  }, [cattle, query, sickIds]);

  const toggle = (id: string) => {
    setError('');
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  };

  const kindInfo = KINDS.find(k => k.type === kind);
  const names = kind === 'Vaccination' ? common.vaccineTypes ?? [] : kindInfo?.names ?? [];
  const finalName = choice === OTHER ? custom.trim() : choice;
  const each = Number(cost) || 0;

  const toDetails = (k: Kind) => {
    setKind(k);
    setChoice('');
    setCustom('');
    setError('');
    setStep('details');
  };

  const save = async () => {
    if (!kind) return;
    if (!finalName) { setError(choice === OTHER ? 'Type the name.' : 'Choose what was given.'); return; }
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

  const another = () => {
    setPicked([]);
    setQuery('');
    setKind(null);
    setChoice('');
    setCustom('');
    setCost('');
    setNotes('');
    setError('');
    setStep('pick');
  };

  const title = {
    pick: 'Which animals?',
    what: 'What was done?',
    details: kindInfo?.title ?? 'Details',
    done: 'Saved',
  }[step];

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold text-ink">{title}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">
          {step === 'pick' && 'Tap every animal that was treated. Sick animals are at the top.'}
          {step === 'what' && `${picked.length} ${picked.length === 1 ? 'animal' : 'animals'} selected`}
          {step === 'details' && `For ${picked.length === 1 ? picked[0] : `${picked.length} animals`}`}
          {step === 'done' && 'It is on the health record.'}
        </DialogDescription>
      </DialogHeader>

      {step === 'pick' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="pl-10" />
          </div>
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
            {list.map(c => {
              const on = picked.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 text-left ${on ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-600'}`}
                  >
                    <span>
                      <span className="block text-lg font-semibold text-ink">{c.id}</span>
                      <span className="block text-sm text-ink-muted">{[c.breed, c.sex].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {sickIds.has(c.id) && <span className="text-sm font-medium text-rose-700">{c.healthStatus}</span>}
                      {on && <Check className="h-6 w-6 text-emerald-700" aria-hidden />}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-base text-ink-muted">No animal with that tag.</li>}
          </ul>
        </div>
      )}

      {step === 'what' && (
        <ul className="space-y-2">
          {KINDS.map(k => (
            <li key={k.type}>
              <button
                type="button"
                onClick={() => toDetails(k.type)}
                className="flex min-h-14 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-4 py-2 text-left hover:border-emerald-600"
              >
                <span className="text-lg font-semibold text-ink">{k.title}</span>
                <span className="text-sm text-ink-muted">{k.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 'details' && (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-base font-medium text-ink">{kind === 'Disease' ? 'Which illness?' : kind === 'Vaccination' ? 'Which vaccine?' : 'What was given?'}</p>
            <div className="flex flex-wrap gap-2">
              {[...names, OTHER].map(n => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={choice === n}
                  onClick={() => { setChoice(n); setError(''); }}
                  className={`min-h-12 rounded-xl border-2 px-4 text-base font-medium ${choice === n ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink'}`}
                >
                  {n === OTHER ? 'Something else' : n}
                </button>
              ))}
            </div>
            {choice === OTHER && (
              <Input autoFocus aria-label="Name" value={custom} onChange={e => { setCustom(e.target.value); setError(''); }} placeholder="Type the name" className="mt-2" />
            )}
          </div>

          <div>
            <label htmlFor="treat-cost" className="mb-1 block text-base font-medium text-ink">Cost for each animal (៛, optional)</label>
            <Input id="treat-cost" type="number" inputMode="numeric" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div>
            <label htmlFor="treat-by" className="mb-1 block text-base font-medium text-ink">Given by</label>
            <Input id="treat-by" value={by} onChange={e => { setBy(e.target.value); setError(''); }} />
          </div>
          <div>
            <label htmlFor="treat-date" className="mb-1 block text-base font-medium text-ink">Date</label>
            <Input id="treat-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="treat-notes" className="mb-1 block text-base font-medium text-ink">Note (optional)</label>
            <Input id="treat-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      {step === 'done' && saved && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-xl text-ink">
            <span className="font-semibold">{saved.name}</span> recorded for <span className="font-semibold">{saved.count} {saved.count === 1 ? 'animal' : 'animals'}</span>
          </p>
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" onClick={another}>Treat more animals</Button>
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>I&apos;m done</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

      {step !== 'done' && (
        <div className="flex gap-3">
          {(step === 'details' || (step === 'what' && !initial.length)) && (
            <Button type="button" variant="secondary" size="lg" aria-label="Go back" onClick={() => { setError(''); setStep(step === 'details' ? 'what' : 'pick'); }}>
              <ArrowLeft />
            </Button>
          )}
          {step === 'pick' && (
            <Button type="button" size="lg" className="flex-1" onClick={() => (picked.length ? setStep('what') : setError('Tap at least one animal.'))}>
              Next{picked.length ? ` (${picked.length})` : ''}
            </Button>
          )}
          {step === 'details' && (
            <Button type="button" size="lg" className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          )}
        </div>
      )}
    </DialogContent>
  );
}
