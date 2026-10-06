'use client';

import React, { useMemo, useState } from 'react';
import { khmerShortDay } from '@/lib/khmer-date';
import { ChevronDown, ChevronUp, History, Minus, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BatchItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import {
  addDays, farmHeadCount, farmRations, farmToday, farmsToRecord, feedUnit, kgPerUnit, previousUnits, recordedUnits, round1, unitWord,
  type DailyFeedInput
} from '@/lib/daily-feed';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, money } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';

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
export function dayLabel(day: string, language?: string): string {
  // In Khmer the app writes the day itself (not every phone browser has Khmer dates); otherwise the browser's format, as before.
  if (language === 'km') return khmerShortDay(day);
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Puts React parts (bold names, days) into a translated sentence with {placeholders}. */
export function fillParts(template: string, parts: Record<string, React.ReactNode>): React.ReactNode {
  return template.split(/\{(\w+)\}/).map((piece, i) => (i % 2 === 1 ? <React.Fragment key={i}>{piece in parts ? parts[piece] : `{${piece}}`}</React.Fragment> : piece));
}

/** Feed unit words (bag, bale, kg) and amounts ("6 bags") in the chosen language; other units show as typed. */
export function useFeedUnits() {
  const { tx } = useText('feedFlows');
  const word = (unit: string, n: number): string => {
    const one = Math.abs(n) === 1;
    if (unit === 'kg') return tx('unitKg');
    if (unit === 'bag') return tx(one ? 'unitBag' : 'unitBags');
    if (unit === 'bale') return tx(one ? 'unitBale' : 'unitBales');
    return unitWord(unit, n);
  };
  const amount = (p: Pick<FeedProductItem, 'unit'> | null | undefined, units: number) => `${round1(units).toLocaleString()} ${word(feedUnit(p), round1(units))}`;
  return { word, amount };
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
  const { tx, language } = useText('feedFlows');
  const flow = useText('flow').tx;
  const { word, amount: amountText } = useFeedUnits();
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
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const rations = useMemo(() => (farm ? farmRations(farm, batches, stock, products) : []), [farm, batches, stock, products]);
  const alreadyRecorded = rations.some(r => r.items.some(i => i.product && recordedUnits(transactions, r.batch.id, day, i.product.id) !== null));

  // The amount shown for a feed: what was typed, else what was recorded that day, else the plan.
  const startValue = (batchId: string, productId: string, plan: number) => {
    const recorded = recordedUnits(transactions, batchId, day, productId);
    return String(recorded ?? plan);
  };
  const valueOf = (batchId: string, productId: string, plan: number) => values[key(batchId, productId)] ?? startValue(batchId, productId, plan);
  const setValue = (batchId: string, productId: string, v: string) => { setValues(s => ({ ...s, [key(batchId, productId)]: v })); setError(''); };

  const isOpen = (batchId: string) => opened[batchId] ?? rations.length === 1;
  const toggleOpen = (batchId: string) => setOpened(o => ({ ...o, [batchId]: !isOpen(batchId) }));

  // Amounts from the latest earlier day that was recorded, for batches that have one.
  const lastTime = rations.flatMap(r => r.items.filter(i => i.product).map(i => ({ batchId: r.batch.id, productId: i.product!.id, units: previousUnits(transactions, r.batch.id, i.product!.id, day) })))
    .filter((x): x is { batchId: string; productId: string; units: number } => x.units !== null);
  const useLastTime = () => {
    setValues(s => ({ ...s, ...Object.fromEntries(lastTime.map(x => [key(x.batchId, x.productId), String(x.units)])) }));
    setError('');
  };

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
      setError(e instanceof Error ? e.message : tx('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'where') {
      if (!farm) { setError(tx('errFarm')); return; }
      if (!day || day > todayDay) { setError(tx('errDay')); return; }
      if (rations.length === 0) { setError(tx('errNoBatch', { farm })); return; }
    }
    if (step === 'amounts') {
      if (lines.length === 0) { setError(tx('errNoLinked')); return; }
      if (lines.some(l => !(Number.isFinite(l.units) && l.units >= 0))) { setError(tx('errAmounts')); return; }
    }
    if (step === 'check') { save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };
  const anotherDay = () => { setValues({}); setError(''); setDay(d => addDays(d, -1)); setStep('where'); };

  const title = {
    where: tx('dayWhereTitle'),
    amounts: alreadyRecorded ? tx('dayChangeTitle', { day: dayLabel(day, language) }) : tx('dayAmountsTitle', { day: dayLabel(day, language) }),
    check: tx('dayCheckTitle'),
    done: tx('dayDoneTitle'),
  }[step];
  const subtitle = {
    where: tx('dayWhereSub'),
    amounts: alreadyRecorded ? tx('dayChangeSub') : tx('dayAmountsSub'),
    check: tx('dayCheckSub'),
    done: tx('dayDoneSub'),
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={step === 'amounts' || step === 'check' ? `${farm} · ${dayLabel(day, language)}` : ''}
      error={error}
      onSubmit={step === 'done' ? undefined : next}
      footer={step === 'done' ? null : (
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'check' ? (saving ? flow('saving') : flow('save')) : flow('next')} busy={saving} />
      )}
    >
      {step === 'where' && (
        <>
          {lockedFarm ? (
            <Question label={tx('farm')}><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
          ) : farmOptions.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">{tx('noFarms')}</p>
          ) : (
            <Question label={tx('whichFarm')} hint={farm && !fedFarms.includes(farm) ? tx('farmNotFedHint', { farm }) : undefined}>
              <PickList options={farmOptions} value={farm} labelFor={o => (fedFarms.includes(o) ? o : tx('noFeedingYet', { farm: o }))} onChange={v => { setFarm(v); setValues({}); setError(''); }} />
            </Question>
          )}
          <Question label={tx('whichDay')}>
            <div className="flex gap-3">
              <Choice selected={day === todayDay} onClick={() => { setDay(todayDay); setValues({}); }}>{tx('today')}</Choice>
              <Choice selected={day === addDays(todayDay, -1)} onClick={() => { setDay(addDays(todayDay, -1)); setValues({}); }}>{tx('yesterday')}</Choice>
            </div>
            <Input aria-label={tx('dayAria')} type="date" value={day} max={todayDay} min={addDays(todayDay, -60)} onChange={e => { setDay(e.target.value); setValues({}); setError(''); }} className="mt-3 h-14 text-lg" />
          </Question>
        </>
      )}

      {step === 'amounts' && (
        <div className="space-y-4 pb-2">
          {heads && (
            <div className="rounded-xl bg-slate-50 p-3 text-base text-ink">
              <p><span className="font-semibold">{tx('headsCattle', { n: heads.onFarm })}</span>{tx('headsOn', { farm, bulls: heads.bulls, cows: heads.cows })}{heads.inFedBatches !== heads.onFarm ? tx('headsFed', { n: heads.inFedBatches }) : ''}{tx('stop')}</p>
              <p className="text-ink-muted">{heads.inFedBatches < heads.onFarm ? tx('headsHintOthers') : tx('headsHint')}</p>
            </div>
          )}
          {unlinked.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">
              {tx(unlinked.length === 1 ? 'unlinkedOne' : 'unlinkedMany', { list: unlinked.map(u => `${u.name} (${u.batch})`).join(', ') })}
            </p>
          )}
          {rations.length > 1 && (
            <p className="text-base text-ink-muted">{tx('batchesOnFarm', { n: rations.length, farm })}</p>
          )}
          {lastTime.length > 0 && (
            <button type="button" onClick={useLastTime} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-4 text-lg font-medium text-ink hover:border-emerald-600">
              <History className="h-5 w-5" aria-hidden /> {tx('useLastTime')}
            </button>
          )}
          {rations.map(r => (
            <section key={r.batch.id} className="rounded-2xl border border-slate-200 bg-white">
              {(() => {
                const feeds = r.items.filter(i => i.product);
                const done = feeds.length > 0 && feeds.every(i => recordedUnits(transactions, r.batch.id, day, i.product!.id) !== null);
                const changed = feeds.some(i => Number(valueOf(r.batch.id, i.product!.id, i.planUnits)) !== i.planUnits);
                const chip = done ? { text: tx('chipRecorded'), cls: 'bg-emerald-100 text-emerald-800' } : changed ? { text: tx('chipChanged'), cls: 'bg-amber-100 text-amber-900' } : { text: tx('chipAsPlanned'), cls: 'bg-slate-100 text-ink-muted' };
                return (
                  <button type="button" aria-expanded={isOpen(r.batch.id)} onClick={() => toggleOpen(r.batch.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                    <span className="min-w-0">
                      <span className="block text-xl font-semibold text-ink">{r.batch.name}</span>
                      <span className="block text-base text-ink-muted">{tx('headN', { n: r.head })}{r.bulls || r.cows ? ` (${[r.bulls ? tx('bullsN', { n: r.bulls }) : '', r.cows ? tx('cowsN', { n: r.cows }) : ''].filter(Boolean).join(', ')})` : ''}</span>
                      {!isOpen(r.batch.id) && (
                        <span className="mt-1 block text-base text-ink">
                          {feeds.map(i => `${i.product!.name} ${amountText(i.product!, Number(valueOf(r.batch.id, i.product!.id, i.planUnits)) || 0)}`).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-base font-medium ${chip.cls}`}>{chip.text}</span>
                      {isOpen(r.batch.id) ? <ChevronUp className="h-6 w-6 text-ink-muted" aria-hidden /> : <ChevronDown className="h-6 w-6 text-ink-muted" aria-hidden />}
                    </span>
                  </button>
                );
              })()}
              {isOpen(r.batch.id) && <div className="space-y-3 border-t border-slate-100 p-4">
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
                      <button type="button" aria-label={tx('lessAria', { name: p.name })} onClick={() => bump(-step1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-ink hover:border-emerald-600"><Minus /></button>
                      <Input aria-label={`${p.name}, ${word(unit, 2)}`} type="number" step="any" inputMode="decimal" min={0} value={raw} onChange={e => setValue(r.batch.id, p.id, e.target.value)} className={`h-14 flex-1 text-center text-2xl font-semibold ${NUM}`} />
                      <button type="button" aria-label={tx('moreAria', { name: p.name })} onClick={() => bump(step1)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-ink hover:border-emerald-600"><Plus /></button>
                      <span className="w-14 shrink-0 text-lg text-ink-muted">{word(unit, Number.isFinite(n) ? n : 2)}</span>
                    </div>
                    <p className="mt-1 text-base text-ink-muted">
                      {tx('plan', { amount: amountText(p, i.planUnits) })}{unit !== 'kg' && Number.isFinite(n) ? ` · ${round1(n * kgPerUnit(p)).toLocaleString()} kg` : ''}
                      {Number.isFinite(n) && n !== i.planUnits && <button type="button" onClick={() => setValue(r.batch.id, p.id, String(i.planUnits))} className="ml-2 font-medium text-emerald-700 underline">{tx('usePlan')}</button>}
                    </p>
                  </div>
                );
              })}
              </div>}
            </section>
          ))}
          <p className="text-base text-ink-muted">{tx('everyDayNote')}</p>
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
          <p className="rounded-xl bg-slate-50 p-4 text-lg text-ink">{tx('dayCost')}<span className="font-semibold">{money(totalCost)}</span></p>
          {alreadyRecorded && <p className="text-base text-ink-muted">{tx('replaces', { day: dayLabel(day, language) })}</p>}
        </div>
      )}

      {step === 'done' && (
        <FlowDone
          message={fillParts(tx('dayDoneMessage'), { day: <span className="font-semibold">{dayLabel(day, language)}</span>, farm: <span className="font-semibold">{farm}</span> })}
          detail={totals.map(t => amountText(t.product, t.units) + ' ' + t.product.name).join(' · ')}
          again={tx('againDayBefore')}
          onAgain={anotherDay}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
