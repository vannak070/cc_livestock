'use client';

import React, { useState } from 'react';
import { feedUnit, unitWord } from '@/lib/daily-feed';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FeedProductItem } from '@/lib/types';
import { Choice, FlowFooter, FlowShell, NUM, PickList, Question, money } from '../flow/FlowShell';

interface FeedProductFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: FeedProductItem) => Promise<void>;
  /** The feed being edited; leave empty to add a new one. */
  initialProduct?: FeedProductItem | null;
  categories?: string[];
  onManageCategories?: () => void;
}

type Step = 'name' | 'size' | 'price' | 'extra';
const STEPS: Step[] = ['name', 'size', 'price', 'extra'];
const DEFAULT_KINDS = ['Concentrate', 'Silage', 'Roughage', 'Supplement', 'Medicine', 'Other'];

// Ids are made on demand, not during render.
const newCode = () => `PROD-F${Date.now().toString().slice(-6)}`;

export default function FeedProductFlow(props: FeedProductFlowProps) {
  // Remount on every open so each add or edit starts from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <FeedProductBody {...props} />}
    </Dialog>
  );
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function FeedProductBody({ onClose, onSubmit, initialProduct, categories, onManageCategories }: FeedProductFlowProps) {
  const edit = !!initialProduct;
  const kinds = categories && categories.length > 0 ? categories : DEFAULT_KINDS;

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(initialProduct?.name ?? '');
  const [category, setCategory] = useState(initialProduct?.category ?? (kinds.length === 1 ? kinds[0] : ''));
  // Bought feed is kept as stock; feed grown or cut on the farm only has its daily use recorded.
  const [grown, setGrown] = useState(initialProduct?.trackStock === false);
  // How the feed is counted: in packs (bags, bales) of a set size, or loose in kg (grass).
  const [unit, setUnit] = useState(feedUnit(initialProduct ?? { unit: 'bag' }));
  const unitChoices = [...new Set(['bag', 'bale', 'kg', unit])];
  const loose = unit === 'kg';
  const [weight, setWeight] = useState(String(initialProduct && feedUnit(initialProduct) !== 'kg' ? initialProduct.weightPerUnit : 30));
  const [warnBags, setWarnBags] = useState(String(initialProduct?.minThresholdBags ?? 50));
  const [perBag, setPerBag] = useState(initialProduct?.costType !== 'per_kg');
  const [price, setPrice] = useState(() => {
    if (!initialProduct) return '';
    const bag = initialProduct.costPerBag ?? initialProduct.unitCost * initialProduct.weightPerUnit;
    return initialProduct.costType === 'per_kg' ? fmt(initialProduct.unitCost) : fmt(bag);
  });
  const [supplier, setSupplier] = useState(initialProduct?.supplier ?? '');
  const [notes, setNotes] = useState(initialProduct?.description ?? '');
  const [active, setActive] = useState(initialProduct ? initialProduct.status !== 'Inactive' : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const kg = loose ? 1 : Number(weight);
  const priceNum = Number(price);
  const byPack = perBag && !loose;
  const perBagCost = byPack ? priceNum : priceNum * kg;
  const perKgCost = byPack ? (kg > 0 ? priceNum / kg : 0) : priceNum;
  const packs = unitWord(unit, 2);
  const at = STEPS.indexOf(step);

  const fail = (msg: string) => { setError(msg); return false; };
  const valid: Partial<Record<Step, () => boolean>> = {
    name: () => (!name.trim() ? fail('Type the name of the feed.') : !category ? fail('Choose the kind of feed.') : true),
    size: () => (!(kg > 0) ? fail(`Type how many kg are in one ${unit}.`) : !grown && (!(Number(warnBags) >= 0) || warnBags === '') ? fail(`Type the number of ${packs} to warn at.`) : true),
    // A farm-grown feed may have no price (0); a bought one needs its price.
    price: () => (grown ? (priceNum >= 0 || price === '' ? true : fail('The cost cannot be below 0.')) : !(priceNum > 0) ? fail(byPack ? `Type the price of one ${unit}.` : 'Type the price of one kg.') : true),
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const bags = Number(warnBags) || 0;
      await onSubmit({
        id: initialProduct?.id ?? newCode(),
        name: name.trim(),
        category,
        unit,
        weightPerUnit: kg,
        unitCost: perKgCost,
        costType: byPack ? 'per_bag' : 'per_kg',
        costPerBag: perBagCost,
        minThresholdBags: bags,
        minThresholdKg: bags * kg,
        description: notes.trim(),
        supplier: supplier.trim(),
        status: active ? 'Active' : 'Inactive',
        trackStock: !grown,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (valid[step] && !valid[step]!()) return;
    if (step === 'extra') { save(); return; }
    setError('');
    setStep(STEPS[at + 1]);
  };
  const back = () => { setError(''); setStep(STEPS[at - 1]); };

  const heading: Record<Step, { title: string; sub: string }> = {
    name: { title: edit ? 'Edit feed' : 'Add a feed', sub: 'What it is called, and what kind it is.' },
    size: { title: 'How it is counted', sub: loose ? 'Loose feed such as grass is counted in kg.' : `How big one ${unit} is, and when to warn.` },
    price: { title: grown ? 'Cost (optional)' : 'Price', sub: grown ? 'What it costs you to grow or cut, if you know it. Used for the feed cost in reports.' : 'Choose how you know the price.' },
    extra: { title: 'A few more details', sub: 'All optional.' },
  };

  const summary = step === 'name' ? '' : [name.trim(), step === 'price' || step === 'extra' ? (loose ? 'counted in kg' : `${kg} kg a ${unit}`) : '', step === 'extra' && perBagCost > 0 ? `${money(perBagCost)} a ${unit}` : ''].filter(Boolean).join(' · ');

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={summary}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : back} label={step === 'extra' ? (saving ? 'Saving…' : 'Save feed') : 'Next'} busy={saving} />}
    >
      {step === 'name' && (
        <>
          <Question label="Name of the feed" hint="For example DSR-16 Concentrate.">
            <Input aria-label="Name of the feed" autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          <Question label="Kind of feed">
            <PickList options={kinds} value={category} onChange={v => { setCategory(v); setError(''); }} />
            {onManageCategories && (
              <button type="button" onClick={onManageCategories} className="mt-2 min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">Change the list of kinds</button>
            )}
          </Question>
          <Question label="Where does it come from?" hint={grown ? 'Its daily use is recorded, but it is not kept as stock: no Feed in and no running-low warning.' : undefined}>
            <div className="grid grid-cols-2 gap-3">
              <Choice selected={!grown} onClick={() => setGrown(false)}>We buy it</Choice>
              <Choice selected={grown} onClick={() => { setGrown(true); if (!edit) setUnit('kg'); }}>We grow or cut it</Choice>
            </div>
          </Question>
        </>
      )}

      {step === 'size' && (
        <>
          <Question label="Counted in">
            <div className="grid grid-cols-3 gap-3">
              {unitChoices.map(u => <Choice key={u} selected={unit === u} onClick={() => { setUnit(u); setError(''); }}>{u === 'kg' ? 'Kg' : unitWord(u, 2)[0].toUpperCase() + unitWord(u, 2).slice(1)}</Choice>)}
            </div>
          </Question>
          {!loose && (
            <Question label={`Kg in one ${unit}`}>
              <Input aria-label={`Kg in one ${unit}`} type="number" step="any" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            </Question>
          )}
          {!grown && <Question label={loose ? 'Warn me when less than (kg)' : `Warn me when fewer ${packs} than`} hint={!loose && Number(warnBags) > 0 && kg > 0 ? `That is ${(Number(warnBags) * kg).toLocaleString()} kg.` : undefined}>
            <Input aria-label={`Warn at this many ${packs}`} type="number" step="any" inputMode="numeric" value={warnBags} onChange={e => { setWarnBags(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
          </Question>}
        </>
      )}

      {step === 'price' && (
        <>
          {!loose && (
            <Question label="I know the price of">
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={perBag} onClick={() => { setPerBag(true); setError(''); }}>One {unit}</Choice>
                <Choice selected={!perBag} onClick={() => { setPerBag(false); setError(''); }}>One kg</Choice>
              </div>
            </Question>
          )}
          <Question label={grown ? (byPack ? `Cost of one ${unit} (៛, optional)` : 'Cost of one kg (៛, optional)') : byPack ? `Price of one ${unit} (៛)` : 'Price of one kg (៛)'}>
            <Input aria-label="Price" type="number" step="any" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            {priceNum > 0 && kg > 0 && !loose && (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
                {money(perBagCost)} a {unit} · {money(perKgCost)} a kg
              </p>
            )}
          </Question>
        </>
      )}

      {step === 'extra' && (
        <>
          <Question label="Supplier (optional)"><Input aria-label="Supplier" value={supplier} onChange={e => setSupplier(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label="Note (optional)"><Input aria-label="Note" value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
          {edit && (
            <Question label="Still using this feed?" hint="Choose No to hide it from Feed in without deleting it.">
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={active} onClick={() => setActive(true)}>Yes</Choice>
                <Choice selected={!active} onClick={() => setActive(false)}>No</Choice>
              </div>
            </Question>
          )}
        </>
      )}
    </FlowShell>
  );
}
