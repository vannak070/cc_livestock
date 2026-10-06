'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BatchItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import { estimateFromSamples } from '@/lib/batch-stats';
import { useText } from '@/hooks/useText';
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

/** Keys in the weighFlow section for each sample animal's title and hint. */
const SAMPLE_ROLE: Record<'best' | 'medium' | 'low', { title: string; hint: string }> = {
  best: { title: 'fastTitle', hint: 'fastHint' },
  medium: { title: 'averageTitle', hint: 'averageHint' },
  low: { title: 'slowTitle', hint: 'slowHint' },
};

/** A translated sentence with some {placeholders} shown in bold. */
function rich(template: string, bold: Record<string, React.ReactNode>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in bold ? <span key={i} className="font-semibold">{bold[m[1]]}</span> : part;
  });
}

export default function WeighGroupFlow(props: WeighGroupFlowProps) {
  // Remount on every open so each weigh-in starts from a clean state.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <WeighBody {...props} />}
    </Dialog>
  );
}

function WeighBody({ onClose, batch, cattle, onSave }: WeighGroupFlowProps) {
  const { tx, txn } = useText('weighFlow');
  const { tx: ftx } = useText('flow');
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
      setError(e instanceof Error ? e.message : tx('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'total' && !(lumpAvg > 0)) { setError(tx('errTotal')); return; }
    if (step === 'weights' && typedRows.length === 0) { setError(tx('errOneWeight')); return; }
    if (step === 'best' || step === 'medium' || step === 'low') {
      const s = sample[step];
      if (!s.cowId) { setError(tx('errTap')); return; }
      if (!(Number(s.weight) > 0)) { setError(tx('errItsWeight')); return; }
    }
    if (step === 'check') { if (!date) { setError(tx('errDate')); return; } save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };

  const title: Record<Step, string> = {
    mode: tx('modeTitle'),
    total: tx('totalTitle'),
    weights: tx('weightsTitle'),
    best: tx(SAMPLE_ROLE.best.title),
    medium: tx(SAMPLE_ROLE.medium.title),
    low: tx(SAMPLE_ROLE.low.title),
    check: mode !== 'sample' ? tx('checkSaveTitle') : tx('checkEstimateTitle'),
    done: tx('saved'),
  };
  const subtitle: Record<Step, string> = {
    mode: tx('modeSub', { batch: batch.name, n: cattle.length }),
    total: tx('totalSub', { batch: batch.name, n: cattle.length }),
    weights: tx('weightsSub'),
    best: sample.best.cowId ? tx('typeScale') : tx(SAMPLE_ROLE.best.hint),
    medium: sample.medium.cowId ? tx('typeScale') : tx(SAMPLE_ROLE.medium.hint),
    low: sample.low.cowId ? tx('typeScale') : tx(SAMPLE_ROLE.low.hint),
    check: tx('checkDateSub'),
    done: tx('groupDoneSub'),
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
              <span className="block text-base text-ink-muted">{[picked.breed, picked.weight ? tx('lastKg', { kg: picked.weight }) : null].filter(Boolean).join(' · ')}</span>
            </span>
            <button type="button" onClick={() => set({ cowId: '', weight: '' })} className="rounded-lg px-3 py-2 text-lg font-medium text-emerald-800 underline">{tx('change')}</button>
          </div>
          <Question label={tx('scaleWeight')}>
            <Input aria-label={tx('weightAria')} type="number" step="any" inputMode="decimal" autoFocus value={sample[role].weight} onChange={e => set({ weight: e.target.value })} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
            {gain !== null && <p className={`mt-3 text-lg font-medium ${gain < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{tx('sinceLast', { kg: `${gain > 0 ? '+' : ''}${gain}` })}</p>}
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
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('searchTag')} aria-label={tx('searchTag')} className="h-14 pl-10 text-lg" />
        </div>
        <ul className="space-y-3 pb-2">
          {options.map(c => (
            <li key={c.id}>
              <RowButton onClick={() => { set({ cowId: c.id }); setQuery(''); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{c.id}</span>
                  <span className="block text-base text-ink-muted">{[c.breed, c.weight ? tx('lastKg', { kg: c.weight }) : null].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {options.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{tx('noTag')}</li>}
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
        <FlowFooter onBack={back} label={step === 'check' ? (saving ? ftx('saving') : tx('saveWeights')) : ftx('next')} busy={saving} />
      )}
    >
      {step === 'mode' && (
        <ul className="space-y-3">
          <li>
            <button type="button" onClick={() => { setMode('lump'); setStep('total'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600">
              <span className="text-xl font-semibold text-ink">{tx('lumpMode')}</span>
              <span className="text-base text-ink-muted">{tx('lumpModeHint')}</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => { setMode('each'); setStep('weights'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600">
              <span className="text-xl font-semibold text-ink">{tx('eachMode')}</span>
              <span className="text-base text-ink-muted">{tx('eachModeHint')}</span>
            </button>
          </li>
          <li>
            <button type="button" disabled={!canSample} onClick={() => { setMode('sample'); setStep('best'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              <span className="text-xl font-semibold text-ink">{tx('sampleMode')}</span>
              <span className="text-base text-ink-muted">{canSample ? tx('sampleModeHint') : tx('sampleNeeds4')}</span>
            </button>
          </li>
        </ul>
      )}

      {step === 'total' && (
        <Question label={tx('totalKg')}>
          <Input aria-label={tx('totalAria')} type="number" step="any" inputMode="decimal" autoFocus value={total} onChange={e => { setTotal(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {lumpAvg > 0 ? rich(tx('lumpAverage', { n: cattle.length }), { avg: <span className="text-ink">{lumpAvg} kg</span> }) : tx('sharedBetween', { n: cattle.length })}
          </p>
        </Question>
      )}

      {step === 'weights' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('searchTag')} aria-label={tx('searchTag')} className="h-14 pl-10 text-lg" />
          </div>
          <p className="text-base text-ink-muted">{tx('typedOf', { typed: typedRows.length, n: cattle.length })}</p>
          <ul className="space-y-2 pb-2">
            {shown.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-ink">{c.id}</p>
                  <p className="text-base text-ink-muted">{c.weight ? tx('lastKgCap', { kg: c.weight }) : tx('notWeighed')}</p>
                </div>
                <Input aria-label={tx('weightOfAria', { tag: c.id })} type="number" step="any" inputMode="decimal" value={typed[c.id] ?? ''} onChange={e => { setTyped({ ...typed, [c.id]: e.target.value }); setError(''); }} placeholder="kg" className={`h-14 w-28 text-center text-xl font-semibold ${NUM}`} />
              </li>
            ))}
            {shown.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{tx('noTag')}</li>}
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
                {rich(tx('avgGainNote', { n: cattle.length - 3 }), { gain: `${estimate.avgGain >= 0 ? '+' : ''}${Math.round(estimate.avgGain * 10) / 10} kg` })}
              </p>
            </div>
          )}
          {mode === 'lump' && <p className="rounded-xl bg-slate-50 p-4 text-lg text-ink">{rich(tx('lumpNote', { total: lumpKg, n: cattle.length }), { count: cattle.length, avg: `${lumpAvg} kg` })}</p>}
          {mode === 'each' && <p className="rounded-xl bg-slate-50 p-4 text-lg text-ink">{rich(tx(typedRows.length === 1 ? 'savingOne' : 'savingMany'), { count: typedRows.length })}</p>}
          <Question label={tx('dateWeighed')}><Input aria-label={tx('dateWeighed')} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && (
        <FlowDone
          message={<>{rich(tx('doneSaved'), { count: txn(savedCount, 'weightOne', 'weightMany') })}</>}
          detail={mode === 'sample' ? tx('sampleDone') : mode === 'lump' ? tx('lumpDone') : undefined}
          again={tx('weighAgain')}
          onAgain={() => { setTyped({}); setTotal(''); setQuery(''); setSample({ best: { cowId: '', weight: '' }, medium: { cowId: '', weight: '' }, low: { cowId: '', weight: '' } }); setError(''); setStep('mode'); }}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
