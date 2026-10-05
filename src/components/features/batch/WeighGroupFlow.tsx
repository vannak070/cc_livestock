'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BatchItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import { estimateFromSamples } from '@/lib/batch-stats';
import { FlowDone, FlowFooter, FlowShell, NUM, Question, RowButton, today } from '../flow/FlowShell';

export interface GroupWeight { cowId: string; currentWeight: number; healthStatus: string; trackingDate: string }

interface WeighGroupFlowProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchItem;
  /** The batch's cattle that are still on the farm. */
  cattle: StockItem[];
  onSave: (records: GroupWeight[]) => Promise<void>;
}

type Mode = 'each' | 'sample' | 'lump';
type Step = 'mode' | 'total' | 'weights' | 'best' | 'medium' | 'low' | 'check' | 'done';

const SAMPLE_ROLE: Record<'best' | 'medium' | 'low', { title: string; hint: string }> = {
  best: { title: 'A fast grower', hint: 'Pick an animal that is growing well, then weigh it.' },
  medium: { title: 'An average animal', hint: 'Pick one that grows about like most of the group.' },
  low: { title: 'A slow grower', hint: 'Pick one that is growing less than the others.' },
};

export default function WeighGroupFlow(props: WeighGroupFlowProps) {
  // Remount on every open so each weigh-in starts from a clean state.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <WeighBody {...props} />}
    </Dialog>
  );
}

function WeighBody({ onClose, batch, cattle, onSave }: WeighGroupFlowProps) {
  const canSample = cattle.length >= 4;
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<Mode>('each');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState('');
  const [sample, setSample] = useState<Record<'best' | 'medium' | 'low', { cowId: string; weight: string }>>({
    best: { cowId: '', weight: '' }, medium: { cowId: '', weight: '' }, low: { cowId: '', weight: '' },
  });
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  const steps: Step[] = mode === 'each' ? ['mode', 'weights', 'check'] : mode === 'lump' ? ['mode', 'total', 'check'] : ['mode', 'best', 'medium', 'low', 'check'];
  const at = steps.indexOf(step);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cattle.filter(c => !q || c.id.toLowerCase().includes(q));
  }, [cattle, query]);

  const typedRows = cattle.filter(c => Number(typed[c.id]) > 0);
  const chosen = new Set(Object.values(sample).map(s => s.cowId).filter(Boolean));
  const samples = (['best', 'medium', 'low'] as const).map(k => ({ cowId: sample[k].cowId, weight: Number(sample[k].weight) }));
  const estimate = estimateFromSamples(cattle, samples);

  const lumpKg = Number(total);
  const lumpAvg = lumpKg > 0 && cattle.length ? Math.round((lumpKg / cattle.length) * 10) / 10 : 0;

  const records = (): GroupWeight[] =>
    mode === 'lump'
      ? cattle.map(c => ({ cowId: c.id, currentWeight: lumpAvg, healthStatus: c.healthStatus, trackingDate: date }))
      : mode === 'each'
      ? typedRows.map(c => ({ cowId: c.id, currentWeight: Number(typed[c.id]), healthStatus: c.healthStatus, trackingDate: date }))
      : estimate.records.map(r => ({ cowId: r.cowId, currentWeight: r.currentWeight, healthStatus: cattle.find(c => c.id === r.cowId)?.healthStatus ?? 'Good', trackingDate: date }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const list = records();
      await onSave(list);
      setSavedCount(list.length);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'total' && !(lumpAvg > 0)) { setError('Type the total weight of the group, in kg.'); return; }
    if (step === 'weights' && typedRows.length === 0) { setError('Type the weight of at least one animal.'); return; }
    if (step === 'best' || step === 'medium' || step === 'low') {
      const s = sample[step];
      if (!s.cowId) { setError('Tap an animal.'); return; }
      if (!(Number(s.weight) > 0)) { setError('Type its weight in kg.'); return; }
    }
    if (step === 'check') { if (!date) { setError('Choose the date.'); return; } save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };

  const title: Record<Step, string> = {
    mode: 'Weigh the group',
    total: 'Total weight of the group',
    weights: 'Type the weights',
    best: SAMPLE_ROLE.best.title,
    medium: SAMPLE_ROLE.medium.title,
    low: SAMPLE_ROLE.low.title,
    check: mode !== 'sample' ? 'Check and save' : 'Check the estimate',
    done: 'Saved',
  };
  const subtitle: Record<Step, string> = {
    mode: `${batch.name} · ${cattle.length} animals`,
    total: `${batch.name} · ${cattle.length} animals weighed together`,
    weights: 'Only animals you type a weight for are saved.',
    best: sample.best.cowId ? 'Type what the scale shows.' : SAMPLE_ROLE.best.hint,
    medium: sample.medium.cowId ? 'Type what the scale shows.' : SAMPLE_ROLE.medium.hint,
    low: sample.low.cowId ? 'Type what the scale shows.' : SAMPLE_ROLE.low.hint,
    check: 'Pick the date, then save.',
    done: 'The weights are on the records.',
  };

  const samplePick = (role: 'best' | 'medium' | 'low') => {
    const picked = cattle.find(c => c.id === sample[role].cowId);
    const set = (v: Partial<{ cowId: string; weight: string }>) => { setSample({ ...sample, [role]: { ...sample[role], ...v } }); setError(''); };
    if (picked) {
      const kg = Number(sample[role].weight);
      const gain = picked.weight && kg > 0 ? Math.round((kg - picked.weight) * 10) / 10 : null;
      return (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-3">
            <span>
              <span className="block text-xl font-semibold text-ink">{picked.id}</span>
              <span className="block text-base text-ink-muted">{[picked.breed, picked.weight ? `last ${picked.weight} kg` : null].filter(Boolean).join(' · ')}</span>
            </span>
            <button type="button" onClick={() => set({ cowId: '', weight: '' })} className="rounded-lg px-3 py-2 text-lg font-medium text-emerald-800 underline">Change</button>
          </div>
          <Question label="Weight on the scale (kg)">
            <Input aria-label="Weight in kg" type="number" step="any" inputMode="decimal" autoFocus value={sample[role].weight} onChange={e => set({ weight: e.target.value })} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
            {gain !== null && <p className={`mt-3 text-lg font-medium ${gain < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{gain > 0 ? '+' : ''}{gain} kg since last time</p>}
          </Question>
        </>
      );
    }
    const q = query.trim().toLowerCase();
    const options = cattle.filter(c => !chosen.has(c.id) && (!q || c.id.toLowerCase().includes(q)));
    return (
      <>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="h-14 pl-10 text-lg" />
        </div>
        <ul className="space-y-3 pb-2">
          {options.map(c => (
            <li key={c.id}>
              <RowButton onClick={() => { set({ cowId: c.id }); setQuery(''); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{c.id}</span>
                  <span className="block text-base text-ink-muted">{[c.breed, c.weight ? `last ${c.weight} kg` : null].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {options.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">No animal with that tag.</li>}
        </ul>
      </>
    );
  };

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title[step]}
      subtitle={subtitle[step]}
      error={error}
      onSubmit={step === 'mode' || step === 'done' ? undefined : next}
      footer={step === 'mode' || step === 'done' ? null : (
        <FlowFooter onBack={back} label={step === 'check' ? (saving ? 'Saving…' : 'Save weights') : 'Next'} busy={saving} />
      )}
    >
      {step === 'mode' && (
        <ul className="space-y-3">
          <li>
            <button type="button" onClick={() => { setMode('lump'); setStep('total'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600">
              <span className="text-xl font-semibold text-ink">Weigh the whole group together</span>
              <span className="text-base text-ink-muted">Type one total. Each animal gets the average.</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => { setMode('each'); setStep('weights'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600">
              <span className="text-xl font-semibold text-ink">Weigh each animal</span>
              <span className="text-base text-ink-muted">Type a weight for every animal you weighed.</span>
            </button>
          </li>
          <li>
            <button type="button" disabled={!canSample} onClick={() => { setMode('sample'); setStep('best'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              <span className="text-xl font-semibold text-ink">Weigh 3 and estimate the rest</span>
              <span className="text-base text-ink-muted">{canSample ? 'Weigh a fast, an average and a slow animal. The others get the average gain.' : 'Needs at least 4 animals in the batch.'}</span>
            </button>
          </li>
        </ul>
      )}

      {step === 'total' && (
        <Question label="Total weight (kg)">
          <Input aria-label="Total weight in kg" type="number" step="any" inputMode="decimal" autoFocus value={total} onChange={e => { setTotal(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {lumpAvg > 0 ? <>Average: <span className="font-semibold text-ink">{lumpAvg} kg</span> for each of {cattle.length} animals</> : `Shared between ${cattle.length} animals`}
          </p>
        </Question>
      )}

      {step === 'weights' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="h-14 pl-10 text-lg" />
          </div>
          <p className="text-base text-ink-muted">{typedRows.length} of {cattle.length} typed</p>
          <ul className="space-y-2 pb-2">
            {shown.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-ink">{c.id}</p>
                  <p className="text-base text-ink-muted">{c.weight ? `Last ${c.weight} kg` : 'Not weighed'}</p>
                </div>
                <Input aria-label={`Weight of ${c.id} in kg`} type="number" step="any" inputMode="decimal" value={typed[c.id] ?? ''} onChange={e => { setTyped({ ...typed, [c.id]: e.target.value }); setError(''); }} placeholder="kg" className={`h-14 w-28 text-center text-xl font-semibold ${NUM}`} />
              </li>
            ))}
            {shown.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">No animal with that tag.</li>}
          </ul>
        </>
      )}

      {step === 'best' && samplePick('best')}
      {step === 'medium' && samplePick('medium')}
      {step === 'low' && samplePick('low')}

      {step === 'check' && (
        <>
          {mode === 'sample' && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              {(['best', 'medium', 'low'] as const).map((k, i) => {
                const gain = samples[i].weight - (cattle.find(c => c.id === samples[i].cowId)?.weight ?? 0);
                return (
                  <div key={k} className="flex justify-between gap-3 text-lg">
                    <span className="text-ink-muted">{samples[i].cowId}</span>
                    <span className="font-semibold text-ink">{samples[i].weight} kg ({gain >= 0 ? '+' : ''}{Math.round(gain * 10) / 10})</span>
                  </div>
                );
              })}
              <p className="border-t border-slate-200 pt-3 text-lg text-ink">
                Average gain <span className="font-semibold">{estimate.avgGain >= 0 ? '+' : ''}{Math.round(estimate.avgGain * 10) / 10} kg</span>. The other {cattle.length - 3} animals will be saved with their last weight plus this.
              </p>
            </div>
          )}
          {mode === 'lump' && <p className="rounded-xl bg-slate-50 p-4 text-lg text-ink">Every one of the <span className="font-semibold">{cattle.length}</span> animals is saved at <span className="font-semibold">{lumpAvg} kg</span> (total {lumpKg} kg ÷ {cattle.length}). This is an average, not a scale reading for each animal.</p>}
          {mode === 'each' && <p className="rounded-xl bg-slate-50 p-4 text-lg text-ink">Saving <span className="font-semibold">{typedRows.length}</span> {typedRows.length === 1 ? 'weight' : 'weights'}.</p>}
          <Question label="Date weighed"><Input aria-label="Date weighed" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && (
        <FlowDone
          message={<><span className="font-semibold">{savedCount} {savedCount === 1 ? 'weight' : 'weights'}</span> saved</>}
          detail={mode === 'sample' ? 'Estimates were saved for the animals you did not weigh.' : mode === 'lump' ? 'Each animal was saved at the group average.' : undefined}
          again="Weigh again"
          onAgain={() => { setTyped({}); setTotal(''); setQuery(''); setSample({ best: { cowId: '', weight: '' }, medium: { cowId: '', weight: '' }, low: { cowId: '', weight: '' } }); setError(''); setStep('mode'); }}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
