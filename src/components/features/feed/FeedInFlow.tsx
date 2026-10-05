'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FarmItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { feedUnit, kgPerUnit, unitWord } from '@/lib/daily-feed';
import { FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, RowButton, money, today } from '../flow/FlowShell';

interface FeedInFlowProps {
  isOpen: boolean;
  onClose: () => void;
  products: FeedProductItem[];
  farms: FarmItem[];
  currentUser?: UserRoleItem;
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

function FeedInBody({ onClose, products, farms, currentUser, onSave, mode = 'in' }: FeedInFlowProps) {
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
  const [farm, setFarm] = useState(lockedFarm ?? (farms.length === 1 ? farms[0].name : ''));
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
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'bags' && !(count > 0)) { setError(out ? `Type how many ${packs} were used.` : `Type how many ${packs} arrived.`); return; }
    if (step === 'where' && !farm) { setError('Choose which farm received it.'); return; }
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
    pick: out ? 'Which feed was used?' : 'Which feed arrived?',
    bags: product ? (out ? `How much ${product.name} was used?` : `How much ${product.name}?`) : 'How much?',
    where: out ? 'Taken from where?' : 'Where was it delivered?',
    extra: 'Anything else?',
    done: out ? 'Feed taken out' : 'Feed added',
  }[step];
  const subtitle = {
    pick: out ? 'Choose the feed that was taken out of store.' : 'Choose the feed that was delivered.',
    bags: unit === 'kg' ? (out ? 'Weigh how much was taken out.' : 'Weigh how much came in.') : out ? `Count the ${packs} taken out.` : `Count the ${packs} that came in.`,
    where: out ? 'Which farm store, and when.' : 'Which farm received it, and when.',
    extra: out ? 'Say why, for example spoiled or damaged (optional).' : 'Both are optional.',
    done: out ? 'The stock count has gone down.' : 'The stock count has gone up.',
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
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'extra' ? (saving ? 'Saving…' : out ? 'Save' : 'Save feed') : 'Next'} busy={saving} />
      )}
    >
      {step === 'pick' && (
        <ul className="space-y-3 pb-2">
          {active.map(p => (
            <li key={p.id}>
              <RowButton onClick={() => { setProductId(p.id); setError(''); setStep('bags'); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{p.name}</span>
                  <span className="block text-base text-ink-muted">{[p.category, feedUnit(p) === 'kg' ? 'counted in kg' : `${p.weightPerUnit} kg per ${feedUnit(p)}`].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {active.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">No feed products yet. Add one on the Feed page first.</li>}
        </ul>
      )}

      {step === 'bags' && (
        <Question label={unit === 'kg' ? 'Kg' : `Number of ${packs}`}>
          <Input aria-label={unit === 'kg' ? 'Kg' : `Number of ${packs}`} type="number" step="any" inputMode="decimal" autoFocus value={bags} onChange={e => { setBags(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {unit === 'kg' ? (count > 0 ? <>worth {money(cost)}</> : null) : count > 0 ? <>{kg.toLocaleString()} kg ({perBag} kg per {unit}) · worth {money(cost)}</> : `${perBag} kg per ${unit}`}
          </p>
        </Question>
      )}

      {step === 'where' && (
        <>
          {lockedFarm ? (
            <Question label="Farm"><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
          ) : (
            <Question label="Which farm?">
              <PickList options={farms.map(f => f.name)} value={farm} onChange={v => { setFarm(v); setError(''); }} />
            </Question>
          )}
          <Question label="Date delivered"><Input aria-label="Date delivered" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'extra' && (
        <>
          {!out && <Question label="Invoice number (optional)"><Input aria-label="Invoice number" value={ref} onChange={e => setRef(e.target.value)} className="h-14 text-lg" /></Question>}
          <Question label={out ? 'Reason (optional)' : 'Note (optional)'}><Input aria-label="Note" value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && received && (
        <FlowDone
          message={<><span className="font-semibold">{received.bags} {unitWord(received.unit, received.bags)}</span> of <span className="font-semibold">{received.name}</span> {out ? 'taken out' : 'added'}</>}
          detail={received.unit === 'kg' ? undefined : `${received.kg.toLocaleString()} kg`}
          again={out ? 'Take out more' : 'Add more feed'}
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
