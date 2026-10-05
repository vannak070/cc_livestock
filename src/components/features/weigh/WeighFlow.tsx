'use client';

import React, { useMemo, useState } from 'react';
import { Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { StockItem } from '@/lib/types';
import type { WeightRecord } from '@/lib/xlsx-parser';
import { weighSchedules, type WeighSchedule } from '@/lib/attention';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, Question, RowButton, today } from '../flow/FlowShell';

interface WeighFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active cattle the person may weigh. */
  cattle: StockItem[];
  weightTracking: WeightRecord[];
  healthStatuses: string[];
  /** Skips step 1 when the caller already knows which animal. */
  preselectedCowId?: string | null;
  onSave: (cowId: string, weight: number, healthStatus: string, date: string) => Promise<void>;
}

type Step = 'pick' | 'kg' | 'check' | 'done';

function dueLabel(s: WeighSchedule | undefined): string {
  if (!s || s.daysElapsed === 999) return 'Never weighed';
  if (s.daysElapsed === 0) return 'Weighed today';
  return `Weighed ${s.daysElapsed} day${s.daysElapsed === 1 ? '' : 's'} ago`;
}

export default function WeighFlow(props: WeighFlowProps) {
  // Remount on every open so each weigh-in starts from a clean state.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <WeighFlowBody {...props} />}
    </Dialog>
  );
}

function WeighFlowBody({ onClose, cattle, weightTracking, healthStatuses, preselectedCowId, onSave }: WeighFlowProps) {
  const known = preselectedCowId ? cattle.find(c => c.id === preselectedCowId) : undefined;
  const statuses = healthStatuses.length ? healthStatuses : ['Good', 'Fair', 'Poor'];

  const [step, setStep] = useState<Step>(known ? 'kg' : 'pick');
  const [cowId, setCowId] = useState<string | null>(known?.id ?? null);
  const [query, setQuery] = useState('');
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

  const steps: Step[] = known ? ['kg', 'check'] : ['pick', 'kg', 'check'];
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
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'kg') {
      if (!(kg > 0)) { setError('Type the weight in kg.'); return; }
      setError('');
      setStep('check');
    } else if (step === 'check') save();
  };

  const back = () => { setError(''); setStep(step === 'check' ? 'kg' : 'pick'); };

  const another = () => { setCowId(null); setQuery(''); setWeight(''); setError(''); setStep('pick'); };

  const summary = cow && step !== 'done' && step !== 'pick'
    ? [cow.id, kg > 0 && step === 'check' ? `${kg} kg` : ''].filter(Boolean).join(' · ')
    : '';

  const title = { pick: 'Which animal?', kg: `Weigh ${cow?.id ?? ''}`, check: 'How does it look?', done: 'Saved' }[step];
  const subtitle = {
    pick: 'Animals due for weighing are at the top.',
    kg: [cow?.breed, cow?.location].filter(Boolean).join(' · '),
    check: 'Pick one, then save.',
    done: 'The weight is on the record.',
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={summary && step === 'check' ? summary : ''}
      error={error}
      onSubmit={step === 'pick' || step === 'done' ? undefined : next}
      footer={step === 'kg' || step === 'check'
        ? <FlowFooter onBack={step === 'kg' && known ? undefined : back} label={step === 'check' ? (saving ? 'Saving…' : 'Save weight') : 'Next'} busy={saving} />
        : null}
    >
      {step === 'pick' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="h-14 pl-10 text-lg" />
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
                    <span className={`text-base font-medium ${s?.status === 'overdue' ? 'text-rose-700' : 'text-ink-muted'}`}>{dueLabel(s)}</span>
                  </RowButton>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">
                {query ? 'No animal with that tag.' : 'Everyone has been weighed recently. Type a tag to weigh one anyway.'}
              </li>
            )}
          </ul>
        </>
      )}

      {step === 'kg' && cow && (
        <Question label="Weight (kg)">
          <Input aria-label="Weight in kg" type="number" step="any" inputMode="decimal" autoFocus value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {cow.weight ? `Last weight: ${cow.weight} kg` : 'No earlier weight on record'}
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
          <Question label="Health">
            <div className="flex flex-wrap gap-3">{statuses.map(h => <Choice key={h} selected={health === h} onClick={() => setHealth(h)}>{h}</Choice>)}</div>
          </Question>
          <Question label="Date weighed">
            <Input aria-label="Date weighed" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'done' && lastSaved && (
        <FlowDone
          message={<><span className="font-semibold">{lastSaved.cowId}</span> weighs <span className="font-semibold">{lastSaved.weight} kg</span></>}
          detail={<>
            {lastSaved.change !== null && <span className="block">{lastSaved.change >= 0 ? 'Up' : 'Down'} {Math.abs(lastSaved.change)} kg since last time</span>}
            {savedCount > 1 && <span className="block">{savedCount} animals weighed this time</span>}
          </>}
          again="Weigh another animal"
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
