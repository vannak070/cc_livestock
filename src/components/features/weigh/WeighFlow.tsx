'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { StockItem } from '@/lib/types';
import type { WeightRecord } from '@/lib/xlsx-parser';
import { weighSchedules, type WeighSchedule } from '@/lib/attention';
import { useText } from '@/hooks/useText';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, Question, RowButton, today } from '../flow/FlowShell';

interface WeighFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active cattle the person may weigh. */
  cattle: StockItem[];
  weightTracking: WeightRecord[];
  /** Batches the person may weigh together; when given, the first step offers one animal or a batch. */
  batches?: { id: string; name: string; head: number }[];
  onPickBatch?: (batchId: string) => void;
  healthStatuses: string[];
  /** Skips step 1 when the caller already knows which animal. */
  preselectedCowId?: string | null;
  onSave: (cowId: string, weight: number, healthStatus: string, date: string) => Promise<void>;
}

type Step = 'kind' | 'batch' | 'pick' | 'kg' | 'check' | 'done';

type Tx = (key: string, vars?: Record<string, string | number>) => string;

/** A translated sentence with some {placeholders} shown in bold. */
function rich(template: string, bold: Record<string, React.ReactNode>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in bold ? <span key={i} className="font-semibold">{bold[m[1]]}</span> : part;
  });
}

function dueLabel(s: WeighSchedule | undefined, tx: Tx): string {
  if (!s || s.daysElapsed === 999) return tx('neverWeighed');
  if (s.daysElapsed === 0) return tx('weighedToday');
  return tx(s.daysElapsed === 1 ? 'weighedDayOne' : 'weighedDayMany', { n: s.daysElapsed });
}

export default function WeighFlow(props: WeighFlowProps) {
  // Remount on every open so each weigh-in starts from a clean state.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <WeighFlowBody {...props} />}
    </Dialog>
  );
}

function WeighFlowBody({ onClose, cattle, weightTracking, healthStatuses, preselectedCowId, batches = [], onPickBatch, onSave }: WeighFlowProps) {
  const { tx } = useText('weighFlow');
  const { tx: ftx } = useText('flow');
  const known = preselectedCowId ? cattle.find(c => c.id === preselectedCowId) : undefined;
  const statuses = healthStatuses.length ? healthStatuses : ['Good', 'Fair', 'Poor'];

  const canBatch = !known && batches.length > 0 && !!onPickBatch;
  const [step, setStep] = useState<Step>(known ? 'kg' : canBatch ? 'kind' : 'pick');
  const [cowId, setCowId] = useState<string | null>(known?.id ?? null);
  const [query, setQuery] = useState('');
  // Choosing a batch leaves this dialog for the group weigh-in, so that path only has two steps here.
  const [viaBatch, setViaBatch] = useState(false);
  const [weight, setWeight] = useState('');
  const [health, setHealth] = useState(known?.healthStatus || statuses[0]);
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<{ cowId: string; weight: number; change: number | null } | null>(null);

  const schedules = useMemo(() => weighSchedules({ stock: cattle, weightTracking }), [cattle, weightTracking]);
  const scheduleById = useMemo(() => new Map(schedules.map(s => [s.cowId, s])), [schedules]);
  const cowById = useMemo(() => new Map(cattle.map(c => [c.id, c])), [cattle]);
  const cow = cowId ? cowById.get(cowId) : undefined;

  // Animals still to weigh come first; those done recently only show when searched for.
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schedules
      .filter(s => s.status !== 'weighed' || q)
      .map(s => cowById.get(s.cowId)!)
      .filter(c => c && (!q || c.id.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q)));
  }, [schedules, cowById, query]);

  const steps: Step[] = known ? ['kg', 'check'] : canBatch ? (viaBatch ? ['kind', 'batch'] : ['kind', 'pick', 'kg', 'check']) : ['pick', 'kg', 'check'];
  const kg = Number(weight);
  const change = cow && kg > 0 && cow.weight ? Math.round((kg - cow.weight) * 10) / 10 : null;

  const choose = (c: StockItem) => {
    setCowId(c.id);
    setHealth(c.healthStatus || statuses[0]);
    setWeight('');
    setError('');
    setStep('kg');
  };

  const save = async () => {
    if (!cow) return;
    setSaving(true);
    setError('');
    try {
      await onSave(cow.id, kg, health || cow.healthStatus, date);
      setLastSaved({ cowId: cow.id, weight: kg, change });
      setSavedCount(n => n + 1);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'kg') {
      if (!(kg > 0)) { setError(tx('errWeight')); return; }
      setError('');
      setStep('check');
    } else if (step === 'check') save();
  };

  const back = () => { setError(''); if (step === 'batch') setViaBatch(false); setStep(step === 'check' ? 'kg' : step === 'batch' ? 'kind' : canBatch && step === 'pick' ? 'kind' : 'pick'); };


  const another = () => { setCowId(null); setQuery(''); setWeight(''); setError(''); setStep(canBatch ? 'kind' : 'pick'); };

  const summary = cow && step !== 'done' && step !== 'pick'
    ? [cow.id, kg > 0 && step === 'check' ? `${kg} kg` : ''].filter(Boolean).join(' · ')
    : '';

  const title = { kind: tx('kindTitle'), batch: tx('batchTitle'), pick: tx('pickTitle'), kg: tx('kgTitle', { tag: cow?.id ?? '' }), check: tx('checkTitle'), done: tx('saved') }[step];
  const subtitle = {
    kind: tx('kindSub'),
    batch: tx('batchSub'),
    pick: tx('pickSub'),
    kg: [cow?.breed, cow?.location].filter(Boolean).join(' · '),
    check: tx('checkSub'),
    done: tx('doneSub'),
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={summary && step === 'check' ? summary : ''}
      error={error}
      onSubmit={step === 'kind' || step === 'batch' || step === 'pick' || step === 'done' ? undefined : next}
      footer={step === 'batch' || (step === 'pick' && canBatch) ? <Button type="button" variant="secondary" size="lg" onClick={back} aria-label={ftx('back')}><ArrowLeft /></Button> : step === 'kg' || step === 'check'
        ? <FlowFooter onBack={step === 'kg' && known ? undefined : back} label={step === 'check' ? (saving ? ftx('saving') : tx('saveWeight')) : ftx('next')} busy={saving} />
        : null}
    >
      {step === 'kind' && (
        <ul className="space-y-3">
          <li>
            <button type="button" onClick={() => { setViaBatch(false); setStep('pick'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600">
              <span className="text-xl font-semibold text-ink">{tx('oneAnimal')}</span>
              <span className="text-base text-ink-muted">{tx('oneAnimalHint')}</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => { setViaBatch(true); setStep('batch'); }} className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600">
              <span className="text-xl font-semibold text-ink">{tx('wholeBatch')}</span>
              <span className="text-base text-ink-muted">{tx('wholeBatchHint')}</span>
            </button>
          </li>
        </ul>
      )}

      {step === 'batch' && (
        <ul className="space-y-3 pb-2">
          {batches.map(b => (
            <li key={b.id}>
              <RowButton onClick={() => onPickBatch?.(b.id)}>
                <span className="block text-xl font-semibold text-ink">{b.name}</span>
                <span className="text-lg text-ink-muted">{tx('animalMany', { n: b.head })}</span>
              </RowButton>
            </li>
          ))}
        </ul>
      )}

      {step === 'pick' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('searchTag')} aria-label={tx('searchTag')} className="h-14 pl-10 text-lg" />
          </div>
          <ul className="space-y-3 pb-2">
            {list.map(c => {
              const s = scheduleById.get(c.id);
              return (
                <li key={c.id}>
                  <RowButton onClick={() => choose(c)}>
                    <span>
                      <span className="block text-xl font-semibold text-ink">{c.id}</span>
                      <span className="block text-base text-ink-muted">{[c.breed, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`text-base font-medium ${s?.status === 'overdue' ? 'text-rose-700' : 'text-ink-muted'}`}>{dueLabel(s, tx)}</span>
                  </RowButton>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">
                {cattle.length === 0 ? tx('noCattle') : query ? tx('noTag') : tx('allWeighed')}
              </li>
            )}
          </ul>
        </>
      )}

      {step === 'kg' && cow && (
        <Question label={tx('weightKg')}>
          <Input aria-label={tx('weightAria')} type="number" step="any" inputMode="decimal" autoFocus value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {cow.weight ? tx('lastWeight', { kg: cow.weight }) : tx('noEarlierWeight')}
            {change !== null && (
              <span className={`ml-2 inline-flex items-center gap-1 font-medium ${change < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {change < 0 ? <TrendingDown className="h-5 w-5" aria-hidden /> : <TrendingUp className="h-5 w-5" aria-hidden />}
                {change > 0 ? '+' : ''}{change} kg
              </span>
            )}
          </p>
        </Question>
      )}

      {step === 'check' && (
        <>
          <Question label={tx('health')}>
            <div className="flex flex-wrap gap-3">{statuses.map(h => <Choice key={h} selected={health === h} onClick={() => setHealth(h)}>{h}</Choice>)}</div>
          </Question>
          <Question label={tx('dateWeighed')}>
            <Input aria-label={tx('dateWeighed')} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'done' && lastSaved && (
        <FlowDone
          message={<>{rich(tx('doneMessage'), { tag: lastSaved.cowId, kg: `${lastSaved.weight} kg` })}</>}
          detail={<>
            {lastSaved.change !== null && <span className="block">{tx(lastSaved.change >= 0 ? 'upSince' : 'downSince', { kg: Math.abs(lastSaved.change) })}</span>}
            {savedCount > 1 && <span className="block">{tx('weighedThisTime', { n: savedCount })}</span>}
          </>}
          again={tx('weighAnother')}
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
