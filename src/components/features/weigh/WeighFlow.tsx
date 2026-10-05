'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StockItem } from '@/lib/types';
import type { WeightRecord } from '@/lib/xlsx-parser';
import { weighSchedules, type WeighSchedule } from '@/lib/attention';

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

type Step = 'pick' | 'weigh' | 'done';

const today = () => new Date().toISOString().split('T')[0];

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
  const [step, setStep] = useState<Step>(preselectedCowId ? 'weigh' : 'pick');
  const [cowId, setCowId] = useState<string | null>(preselectedCowId ?? null);
  const [query, setQuery] = useState('');
  const [weight, setWeight] = useState('');
  const [health, setHealth] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<{ cowId: string; weight: number; change: number | null } | null>(null);

  const schedules = useMemo(() => weighSchedules({ stock: cattle, weightTracking }), [cattle, weightTracking]);
  const scheduleById = useMemo(() => new Map(schedules.map(s => [s.cowId, s])), [schedules]);
  const cowById = useMemo(() => new Map(cattle.map(c => [c.id, c])), [cattle]);

  const cow = cowId ? cowById.get(cowId) : undefined;
  const statuses = healthStatuses.length ? healthStatuses : ['Good', 'Fair', 'Poor'];

  // Animals still to weigh come first; those already done recently go last.
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schedules
      .filter(s => s.status !== 'weighed' || q)
      .map(s => cowById.get(s.cowId)!)
      .filter(c => c && (!q || c.id.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q)));
  }, [schedules, cowById, query]);

  const choose = (c: StockItem) => {
    setCowId(c.id);
    setHealth(c.healthStatus || statuses[0]);
    setWeight('');
    setError('');
    setStep('weigh');
  };

  const kg = Number(weight);
  const change = cow && kg > 0 && cow.weight ? kg - cow.weight : null;

  const save = async () => {
    if (!cow) return;
    if (!(kg > 0)) { setError('Type the weight in kg.'); return; }
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

  const another = () => {
    setCowId(null);
    setQuery('');
    setWeight('');
    setError('');
    setStep('pick');
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold text-ink">
          {step === 'pick' && 'Which animal?'}
          {step === 'weigh' && `Weigh ${cow?.id ?? ''}`}
          {step === 'done' && 'Saved'}
        </DialogTitle>
        <DialogDescription className="text-base text-ink-muted">
          {step === 'pick' && 'Animals due for weighing are at the top.'}
          {step === 'weigh' && [cow?.breed, cow?.location].filter(Boolean).join(' · ')}
          {step === 'done' && 'The weight is on the record.'}
        </DialogDescription>
      </DialogHeader>

      {step === 'pick' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tag number"
              aria-label="Search tag number"
              className="pl-10"
            />
          </div>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {list.map(c => {
              const s = scheduleById.get(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left hover:border-emerald-600"
                  >
                    <span>
                      <span className="block text-lg font-semibold text-ink">{c.id}</span>
                      <span className="block text-sm text-ink-muted">{[c.breed, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`text-sm font-medium ${s?.status === 'overdue' ? 'text-rose-700' : 'text-ink-muted'}`}>
                      {dueLabel(s)}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="rounded-xl bg-slate-50 p-4 text-center text-base text-ink-muted">
                {query ? 'No animal with that tag.' : 'Everyone has been weighed recently. Type a tag to weigh one anyway.'}
              </li>
            )}
          </ul>
        </div>
      )}

      {step === 'weigh' && cow && (
        <div className="space-y-5">
          <div>
            <label htmlFor="weigh-kg" className="mb-1 block text-base font-medium text-ink">Weight (kg)</label>
            <Input
              id="weigh-kg"
              type="number"
              inputMode="decimal"
              autoFocus
              value={weight}
              onChange={e => { setWeight(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') save(); }}
              className="h-16 text-center text-3xl font-semibold"
            />
            <p className="mt-2 text-base text-ink-muted">
              {cow.weight ? `Last weight: ${cow.weight} kg` : 'No earlier weight on record'}
              {change !== null && (
                <span className={`ml-2 inline-flex items-center gap-1 font-medium ${change < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {change < 0 ? <TrendingDown className="h-4 w-4" aria-hidden /> : <TrendingUp className="h-4 w-4" aria-hidden />}
                  {change > 0 ? '+' : ''}{Math.round(change * 10) / 10} kg
                </span>
              )}
            </p>
          </div>

          <div>
            <p className="mb-2 text-base font-medium text-ink">How does it look?</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHealth(h)}
                  aria-pressed={health === h}
                  className={`min-h-12 rounded-xl border-2 px-4 text-base font-medium ${health === h ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink'}`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="weigh-date" className="mb-1 block text-base font-medium text-ink">Date</label>
            <Input id="weigh-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
          </div>

          {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

          <div className="flex gap-3">
            {!preselectedCowId && (
              <Button type="button" variant="secondary" size="lg" onClick={another} aria-label="Back to the list">
                <ArrowLeft />
              </Button>
            )}
            <Button type="button" size="lg" className="flex-1" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save weight'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && lastSaved && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-xl text-ink">
            <span className="font-semibold">{lastSaved.cowId}</span> weighs <span className="font-semibold">{lastSaved.weight} kg</span>
            {lastSaved.change !== null && (
              <span className="block text-base text-ink-muted">
                {lastSaved.change >= 0 ? 'Up' : 'Down'} {Math.abs(Math.round(lastSaved.change * 10) / 10)} kg since last time
              </span>
            )}
          </p>
          {savedCount > 1 && <p className="text-base text-ink-muted">{savedCount} animals weighed this time</p>}
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" onClick={another}>Weigh another animal</Button>
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>I&apos;m done</Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
