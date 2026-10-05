'use client';

import React, { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BatchItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import {
  addDays, amountText, farmHeadCount, farmRations, farmToday, farmsToRecord, feedUnit, kgPerUnit, recordedUnits, round1, unitWord,
  type DailyFeedInput
} from '@/lib/daily-feed';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, money } from '../flow/FlowShell';

interface DailyFeedFlowProps {
  isOpen: boolean;
  onClose: () => void;
  batches: BatchItem[];
  stock: StockItem[];
  products: FeedProductItem[];
  transactions: FeedStockTransaction[];
  /** Every farm, so the office can choose any of them. */
  farms?: { name: string }[];
  currentUser?: UserRoleItem;
  /** Start with this farm (the office recording for a farm) and/or day (filling in a missed day). */
  presetFarm?: string;
  presetDay?: string;
  onSave: (input: DailyFeedInput) => Promise<void>;
}

type Step = 'where' | 'amounts' | 'check' | 'done';

const OFFICE_ROLES = ['Super Admin', 'Admin', 'Company'];
const key = (batchId: string, productId: string) => `${batchId}|${productId}`;

/** "Mon 5 Oct" for a YYYY-MM-DD day. */
export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export default function DailyFeedFlow(props: DailyFeedFlowProps) {
  // Remount on every open so each day starts from the plan or what was recorded.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <DailyFeedBody {...props} />}
    </Dialog>
  );
}

function DailyFeedBody({ onClose, batches, stock, products, transactions, farms = [], currentUser, presetFarm, presetDay, onSave }: DailyFeedFlowProps) {
  const todayDay = farmToday();
  const lockedFarm = currentUser?.farmLocation && !OFFICE_ROLES.includes(currentUser.role) ? currentUser.farmLocation : null;
  // Farms with a batch being fed come first; the office can still pick any farm.
  const fedFarms = useMemo(() => farmsToRecord(batches), [batches]);
  const farmOptions = useMemo(
    () => (lockedFarm ? [lockedFarm] : [...new Set([...fedFarms, ...farms.map(f => f.name).sort((a, b) => a.localeCompare(b))])]),
    [lockedFarm, fedFarms, farms]
  );

  const [farm, setFarm] = useState(lockedFarm ?? presetFarm ?? (fedFarms.length === 1 ? fedFarms[0] : farmOptions.length === 1 ? farmOptions[0] : ''));
  const [day, setDay] = useState(presetDay ?? todayDay);
  const [step, setStep] = useState<Step>(farm && presetDay ? 'amounts' : 'where');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rations = useMemo(() => (farm ? farmRations(farm, batches, stock, products) : []), [farm, batches, stock, products]);
  const alreadyRecorded = rations.some(r => r.items.some(i => i.product && recordedUnits(transactions, r.batch.id, day, i.product.id) !== null));

  // The amount shown for a feed: what was typed, else what was recorded that day, else the plan.
  const startValue = (batchId: string, productId: string, plan: number) => {
    const recorded = recordedUnits(transactions, batchId, day, productId);
    return String(recorded ?? plan);
  };
  const valueOf = (batchId: string, productId: string, plan: number) => values[key(batchId, productId)] ?? startValue(batchId, productId, plan);
  const setValue = (batchId: string, productId: string, v: string) => { setValues(s => ({ ...s, [key(batchId, productId)]: v })); setError(''); };

  const lines = rations.flatMap(r => r.items.filter(i => i.product).map(i => {
    const p = i.product!;
    const units = Number(valueOf(r.batch.id, p.id, i.planUnits));
    return { batchId: r.batch.id, product: p, units, kg: units * kgPerUnit(p), plan: i.planUnits };
  }));
  const totalsBy = new Map<string, { product: FeedProductItem; units: number; kg: number }>();
  for (const l of lines) {
    const t = totalsBy.get(l.product.id) || { product: l.product, units: 0, kg: 0 };
    t.units += Number.isFinite(l.units) ? l.units : 0;
    t.kg += Number.isFinite(l.kg) ? l.kg : 0;
    totalsBy.set(l.product.id, t);
  }
  const totals = [...totalsBy.values()];
  const totalCost = totals.reduce((s, t) => s + t.kg * (t.product.unitCost || 0), 0);
  const heads = farm ? farmHeadCount(farm, batches, stock) : null;
  const unlinked = rations.flatMap(r => r.items.filter(i => !i.product).map(i => ({ batch: r.batch.name, name: i.name })));

  const steps: Step[] = ['where', 'amounts', 'check'];
  const at = steps.indexOf(step);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave({
        farm,
        day,
        // A batch whose feeds are all unlinked has nothing to record; it is left as it is.
        batches: rations.filter(r => r.items.some(i => i.product)).map(r => ({
          batchId: r.batch.id,
          items: r.items.filter(i => i.product).map(i => ({ productId: i.product!.id, units: round1(Number(valueOf(r.batch.id, i.product!.id, i.planUnits))) })),
        })),
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'where') {
      if (!farm) { setError('Choose the farm.'); return; }
      if (!day || day > todayDay) { setError('Choose today or an earlier day.'); return; }
      if (rations.length === 0) { setError(`${farm} has no batch being fed. Turn feeding on in a batch's Feeding tab first.`); return; }
    }
    if (step === 'amounts') {
      if (lines.length === 0) { setError('None of the feeds is in your feed list yet. Fix the feeding plan first (see the note above).'); return; }
      if (lines.some(l => !(Number.isFinite(l.units) && l.units >= 0))) { setError('Type an amount of 0 or more for every feed.'); return; }
    }
    if (step === 'check') { save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };
  const anotherDay = () => { setValues({}); setError(''); setDay(d => addDays(d, -1)); setStep('where'); };

  const title = {
    where: 'Record the day\'s feed',
    amounts: alreadyRecorded ? `Change ${dayLabel(day)}` : `What did they eat on ${dayLabel(day)}?`,
    check: 'Check and save',
    done: 'Feed saved',
  }[step];
  const subtitle = {
    where: 'Which farm, and which day.',
    amounts: alreadyRecorded ? 'This day was already recorded. Change what is different.' : 'Filled in from the feeding plan. Change only what was different.',
    check: 'This is taken out of the feed stock.',
    done: 'The day is written down and the stock has been updated.',
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={step === 'amounts' || step === 'check' ? `${farm} · ${dayLabel(day)}` : ''}
      error={error}
      onSubmit={step === 'done' ? undefined : next}
      footer={step === 'done' ? null : (
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'check' ? (saving ? 'Saving…' : 'Save') : 'Next'} busy={saving} />
      )}
    >
      {step === 'where' && (
        <>
          {lockedFarm ? (
            <Question label="Farm"><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
          ) : farmOptions.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">There are no farms yet. Add one on the Farms page first.</p>
          ) : (
            <Question label="Which farm?" hint={farm && !fedFarms.includes(farm) ? `${farm} has no batch being fed yet. Turn feeding on in one of its batches (Feeding tab) to record its feed.` : undefined}>
              <PickList options={farmOptions} value={farm} labelFor={o => (fedFarms.includes(o) ? o : `${o} (no feeding yet)`)} onChange={v => { setFarm(v); setValues({}); setError(''); }} />
            </Question>
          )}
          <Question label="Which day?">
            <div className="flex gap-3">
              <Choice selected={day === todayDay} onClick={() => { setDay(todayDay); setValues({}); }}>Today</Choice>
              <Choice selected={day === addDays(todayDay, -1)} onClick={() => { setDay(addDays(todayDay, -1)); setValues({}); }}>Yesterday</Choice>
            </div>
            <Input aria-label="Day" type="date" value={day} max={todayDay} min={addDays(todayDay, -60)} onChange={e => { setDay(e.target.value); setValues({}); setError(''); }} className="mt-3 h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'amounts' && (
        <div className="space-y-4 pb-2">
          {heads && (
            <div className="rounded-xl bg-slate-50 p-3 text-base text-ink">
              <p><span className="font-semibold">{heads.onFarm} cattle</span> on {farm} in the app ({heads.bulls} bulls, {heads.cows} cows){heads.inFedBatches !== heads.onFarm ? `, ${heads.inFedBatches} of them in a batch being fed` : ''}.</p>
              <p className="text-ink-muted">Different from your count? Update the cattle list (sold, dead or moved animals){heads.inFedBatches < heads.onFarm ? ' or add the others to a batch' : ''}.</p>
            </div>
          )}
          {unlinked.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">
              {unlinked.map(u => `${u.name} (${u.batch})`).join(', ')} {unlinked.length === 1 ? 'is' : 'are'} not in your feed list, so {unlinked.length === 1 ? 'it' : 'they'} cannot be recorded. Open the batch, Feeding tab, tap the pencil and choose the feed.
            </p>
          )}
          {rations.map(r => (
            <section key={r.batch.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-xl font-semibold text-ink">{r.batch.name}</p>
                <p className="text-base text-ink-muted">{r.head} head{r.bulls || r.cows ? ` (${[r.bulls ? `${r.bulls} bulls` : '', r.cows ? `${r.cows} cows` : ''].filter(Boolean).join(', ')})` : ''}</p>
              </div>
              {r.items.filter(i => i.product).map(i => {
                const p = i.product!;
                const unit = feedUnit(p);
                const step1 = unit === 'kg' ? 10 : 1;
                const raw = valueOf(r.batch.id, p.id, i.planUnits);
                const n = Number(raw);
                const bump = (d: number) => setValue(r.batch.id, p.id, String(Math.max(0, round1((Number.isFinite(n) ? n : 0) + d))));
                return (
                  <div key={p.id}>
                    <p className="mb-1 text-lg font-medium text-ink">{p.name}</p>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={`Less ${p.name}`} onClick={() => bump(-step1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-ink hover:border-emerald-600"><Minus /></button>
                      <Input aria-label={`${p.name}, ${unitWord(unit, 2)}`} type="number" step="any" inputMode="decimal" min={0} value={raw} onChange={e => setValue(r.batch.id, p.id, e.target.value)} className={`h-14 flex-1 text-center text-2xl font-semibold ${NUM}`} />
                      <button type="button" aria-label={`More ${p.name}`} onClick={() => bump(step1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-ink hover:border-emerald-600"><Plus /></button>
                      <span className="w-14 shrink-0 text-lg text-ink-muted">{unitWord(unit, Number.isFinite(n) ? n : 2)}</span>
                    </div>
                    <p className="mt-1 text-base text-ink-muted">
                      Plan {amountText(p, i.planUnits)}{unit !== 'kg' && Number.isFinite(n) ? ` · ${round1(n * kgPerUnit(p)).toLocaleString()} kg` : ''}
                      {Number.isFinite(n) && n !== i.planUnits && <button type="button" onClick={() => setValue(r.batch.id, p.id, String(i.planUnits))} className="ml-2 font-medium text-emerald-700 underline">Use the plan</button>}
                    </p>
                  </div>
                );
              })}
            </section>
          ))}
          <p className="text-base text-ink-muted">To feed something every day (for example grass), add it to the batch&apos;s feeding plan.</p>
        </div>
      )}

      {step === 'check' && (
        <div className="space-y-3">
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {totals.map(t => (
              <li key={t.product.id} className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <span className="text-lg text-ink">{t.product.name}</span>
                <span className="text-right">
                  <span className="block text-lg font-semibold text-ink">{amountText(t.product, t.units)}</span>
                  {feedUnit(t.product) !== 'kg' && <span className="block text-base text-ink-muted">{round1(t.kg).toLocaleString()} kg</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="rounded-xl bg-slate-50 p-4 text-lg text-ink">Feed cost for the day: <span className="font-semibold">{money(totalCost)}</span></p>
          {alreadyRecorded && <p className="text-base text-ink-muted">This replaces what was recorded for {dayLabel(day)} before.</p>}
        </div>
      )}

      {step === 'done' && (
        <FlowDone
          message={<>Feed for <span className="font-semibold">{dayLabel(day)}</span> at <span className="font-semibold">{farm}</span> saved</>}
          detail={totals.map(t => amountText(t.product, t.units) + ' ' + t.product.name).join(' · ')}
          again="Record the day before"
          onAgain={anotherDay}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
