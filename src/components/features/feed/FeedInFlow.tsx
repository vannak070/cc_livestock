'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FarmItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, Question, RowButton, money, today } from '../flow/FlowShell';

interface FeedInFlowProps {
  isOpen: boolean;
  onClose: () => void;
  products: FeedProductItem[];
  farms: FarmItem[];
  currentUser?: UserRoleItem;
  onSave: (tx: FeedStockTransaction) => Promise<void>;
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

function FeedInBody({ onClose, products, farms, currentUser, onSave }: FeedInFlowProps) {
  const active = products.filter(p => p.status !== 'Inactive');
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
  const [received, setReceived] = useState<{ name: string; bags: number; kg: number } | null>(null);

  const steps: Step[] = single ? ['bags', 'where', 'extra'] : ['pick', 'bags', 'where', 'extra'];
  const at = steps.indexOf(step);

  const product = active.find(p => p.id === productId);
  const count = Number(bags);
  const perBag = product?.weightPerUnit || 30;
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
        type: 'STOCK_IN',
        quantityBags: count,
        quantityKg: kg,
        unitCost: product.unitCost,
        totalCost: cost,
        sourceFarm: 'Supplier',
        targetFarm: farm,
        referenceNo: ref.trim() || `TX-${now.toString().slice(-6)}`,
        recordedBy: currentUser?.name || 'Admin User',
        notes: notes.trim(),
      });
      setReceived({ name: product.name, bags: count, kg });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'bags' && !(count > 0)) { setError('Type how many bags arrived.'); return; }
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
    ? [product.name, `${count} ${count === 1 ? 'bag' : 'bags'}`, step === 'extra' ? farm : ''].filter(Boolean).join(' · ')
    : '';

  const title = { pick: 'Which feed arrived?', bags: product ? `How much ${product.name}?` : 'How much?', where: 'Where was it delivered?', extra: 'Anything else?', done: 'Feed added' }[step];
  const subtitle = {
    pick: 'Choose the feed that was delivered.',
    bags: 'Count the bags that came in.',
    where: 'Which farm received it, and when.',
    extra: 'Both are optional.',
    done: 'The stock count has gone up.',
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
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'extra' ? (saving ? 'Saving…' : 'Save feed') : 'Next'} busy={saving} />
      )}
    >
      {step === 'pick' && (
        <ul className="space-y-3 pb-2">
          {active.map(p => (
            <li key={p.id}>
              <RowButton onClick={() => { setProductId(p.id); setError(''); setStep('bags'); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{p.name}</span>
                  <span className="block text-base text-ink-muted">{[p.category, `${p.weightPerUnit} kg per ${p.unit}`].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {active.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">No feed products yet. Add one on the Feed page first.</li>}
        </ul>
      )}

      {step === 'bags' && (
        <Question label="Number of bags">
          <Input aria-label="Number of bags" type="number" inputMode="numeric" autoFocus value={bags} onChange={e => { setBags(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          <p className="mt-3 text-lg text-ink-muted">
            {count > 0 ? <>{kg.toLocaleString()} kg ({perBag} kg per bag) · worth {money(cost)}</> : `${perBag} kg per bag`}
          </p>
        </Question>
      )}

      {step === 'where' && (
        <>
          {lockedFarm ? (
            <Question label="Farm"><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
          ) : (
            <Question label="Which farm?">
              <div className="flex flex-wrap gap-3">{farms.map(f => <Choice key={f.id} selected={farm === f.name} onClick={() => { setFarm(f.name); setError(''); }}>{f.name}</Choice>)}</div>
            </Question>
          )}
          <Question label="Date delivered"><Input aria-label="Date delivered" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'extra' && (
        <>
          <Question label="Invoice number (optional)"><Input aria-label="Invoice number" value={ref} onChange={e => setRef(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label="Note (optional)"><Input aria-label="Note" value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'done' && received && (
        <FlowDone
          message={<><span className="font-semibold">{received.bags} {received.bags === 1 ? 'bag' : 'bags'}</span> of <span className="font-semibold">{received.name}</span> added</>}
          detail={`${received.kg.toLocaleString()} kg`}
          again="Add more feed"
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
