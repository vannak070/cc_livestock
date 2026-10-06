'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FarmItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { feedUnit, kgPerUnit } from '@/lib/daily-feed';
import { FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, RowButton, money, today } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';
import { fillParts, useFeedUnits } from './DailyFeedFlow';

interface FeedInFlowProps {
  isOpen: boolean;
  onClose: () => void;
  products: FeedProductItem[];
  farms: FarmItem[];
  currentUser?: UserRoleItem;
  /** The farm an office account is working on; used as the starting choice. */
  defaultFarm?: string;
  onSave: (tx: FeedStockTransaction) => Promise<void>;
  /** 'out' records feed used by hand (spoilage, a correction); the daily ration job does the usual deductions. */
  mode?: 'in' | 'out';
}

type Step = 'pick' | 'bags' | 'where' | 'extra' | 'done';

// Ids are made on demand, not during render.
const newStamp = () => Date.now();

export default function FeedInFlow(props: FeedInFlowProps) {
  // Remount on every open so each delivery starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <FeedInBody {...props} />}
    </Dialog>
  );
}

function FeedInBody({ onClose, products, farms, currentUser, defaultFarm, onSave, mode = 'in' }: FeedInFlowProps) {
  const { tx } = useText('feedFlows');
  const flow = useText('flow').tx;
  const { word: unitWord } = useFeedUnits();
  const out = mode === 'out';
  // Feed grown on the farm is not kept as stock, so it never comes in or goes out by hand.
  const active = products.filter(p => p.status !== 'Inactive' && p.trackStock !== false);
  const single = active.length === 1;
  const lockedFarm = currentUser?.farmLocation && !['Super Admin', 'Admin', 'Company'].includes(currentUser.role)
    ? currentUser.farmLocation
    : null;

  const [step, setStep] = useState<Step>(single ? 'bags' : 'pick');
  const [productId, setProductId] = useState(single ? active[0].id : '');
  const [bags, setBags] = useState('');
  const [farm, setFarm] = useState(lockedFarm ?? (defaultFarm && farms.some(f => f.name === defaultFarm) ? defaultFarm : farms.length === 1 ? farms[0].name : ''));
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [received, setReceived] = useState<{ name: string; bags: number; kg: number; unit: string } | null>(null);

  const steps: Step[] = single ? ['bags', 'where', 'extra'] : ['pick', 'bags', 'where', 'extra'];
  const at = steps.indexOf(step);

  const product = active.find(p => p.id === productId);
  const count = Number(bags);
  const perBag = kgPerUnit(product);
  const unit = feedUnit(product);
  const packs = unitWord(unit, 2);
  const kg = count * perBag;
  const cost = kg * (product?.unitCost || 0);

  const save = async () => {
    if (!product) return;
    setSaving(true);
    setError('');
    try {
      const now = newStamp();
      await onSave({
        id: `TX-FEED-${now}`,
        date,
        productId: product.id,
        productName: product.name,
        type: out ? 'STOCK_OUT' : 'STOCK_IN',
        quantityBags: count,
        quantityKg: kg,
        unitCost: product.unitCost,
        totalCost: cost,
        sourceFarm: out ? farm : 'Supplier',
        targetFarm: out ? 'Daily Feeding Ration' : farm,
        referenceNo: (!out && ref.trim()) || `TX-${now.toString().slice(-6)}`,
        recordedBy: currentUser?.name || 'Admin User',
        notes: notes.trim(),
      });
      setReceived({ name: product.name, bags: count, kg, unit });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('errSave'));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'bags' && !(count > 0)) { setError(tx(out ? 'errOutCount' : 'errInCount', { packs })); return; }
    if (step === 'where' && !farm) { setError(tx('errWhere')); return; }
    if (step === 'extra') { save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };
  const another = () => {
    setBags(''); setRef(''); setNotes(''); setError('');
    if (!single) setProductId('');
    setStep(steps[0]);
  };

  const summary = product && (step === 'where' || step === 'extra')
    ? [product.name, `${count} ${unitWord(unit, count)}`, step === 'extra' ? farm : ''].filter(Boolean).join(' · ')
    : '';

  const title = {
    pick: tx(out ? 'outPickTitle' : 'inPickTitle'),
    bags: product ? tx(out ? 'outBagsTitle' : 'inBagsTitle', { name: product.name }) : tx('bagsTitle'),
    where: tx(out ? 'outWhereTitle' : 'inWhereTitle'),
    extra: tx('extraTitle'),
    done: tx(out ? 'outDoneTitle' : 'inDoneTitle'),
  }[step];
  const subtitle = {
    pick: tx(out ? 'outPickSub' : 'inPickSub'),
    bags: unit === 'kg' ? tx(out ? 'outBagsSubKg' : 'inBagsSubKg') : tx(out ? 'outBagsSub' : 'inBagsSub', { packs }),
    where: tx(out ? 'outWhereSub' : 'inWhereSub'),
    extra: tx(out ? 'outExtraSub' : 'inExtraSub'),
    done: tx(out ? 'outDoneSub' : 'inDoneSub'),
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={summary}
      error={error}
      onSubmit={step === 'pick' || step === 'done' ? undefined : next}
      footer={step === 'pick' || step === 'done' ? null : (
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'extra' ? (saving ? flow('saving') : out ? flow('save') : tx('saveFeed')) : flow('next')} busy={saving} />
      )}
    >
      {step === 'pick' && (
        <ul className="space-y-3 pb-2">
          {active.map(p => (
            <li key={p.id}>
              <RowButton onClick={() => { setProductId(p.id); setError(''); setStep('bags'); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{p.name}</span>
                  <span className="block text-base text-ink-muted">{[p.category, feedUnit(p) === 'kg' ? tx('countedInKg') : tx('kgPer', { kg: p.weightPerUnit, unit: unitWord(feedUnit(p), 1) })].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {active.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{tx('noProducts')}</li>}
        </ul>
      )}

      {step === 'bags' && (
        <Question label={unit === 'kg' ? tx('kgLabel') : tx('numberOf', { packs })}>
          <Input aria-label={unit === 'kg' ? tx('kgLabel') : tx('numberOf', { packs })} type="number" step="any" inputMode="decimal" autoFocus value={bags} onChange={e => { setBags(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {unit === 'kg' ? (count > 0 ? tx('worth', { money: money(cost) }) : null) : count > 0 ? `${kg.toLocaleString()} kg (${tx('kgPer', { kg: perBag, unit: unitWord(unit, 1) })}) · ${tx('worth', { money: money(cost) })}` : tx('kgPer', { kg: perBag, unit: unitWord(unit, 1) })}
          </p>
        </Question>
      )}

      {step === 'where' && (
        <>
          {lockedFarm ? (
            <Question label={tx('farm')}><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
          ) : (
            <Question label={tx('whichFarm')}>
              <PickList options={farms.map(f => f.name)} value={farm} onChange={v => { setFarm(v); setError(''); }} />
            </Question>
          )}
          <Question label={tx('dateDelivered')}><Input aria-label={tx('dateDelivered')} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'extra' && (
        <>
          {!out && <Question label={tx('invoiceOpt')}><Input aria-label={tx('invoiceAria')} value={ref} onChange={e => setRef(e.target.value)} className="h-14 text-lg" /></Question>}
          <Question label={tx(out ? 'reasonOpt' : 'noteOpt')}><Input aria-label={tx('noteAria')} value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && received && (
        <FlowDone
          message={fillParts(tx(out ? 'outDoneMessage' : 'inDoneMessage'), { amount: <span className="font-semibold">{received.bags} {unitWord(received.unit, received.bags)}</span>, name: <span className="font-semibold">{received.name}</span> })}
          detail={received.unit === 'kg' ? undefined : `${received.kg.toLocaleString()} kg`}
          again={tx(out ? 'againOut' : 'againIn')}
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
