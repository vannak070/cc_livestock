'use client';

import React, { useState } from 'react';
import { feedUnit } from '@/lib/daily-feed';
import { useText } from '@/hooks/useText';
import { useFeedUnits } from './DailyFeedFlow';
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
  const { tx } = useText('feedFlows');
  const flow = useText('flow').tx;
  const { word: unitWord } = useFeedUnits();
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
  // The unit's own word ("bag"), in the chosen language.
  const one = unitWord(unit, 1);
  const at = STEPS.indexOf(step);

  const fail = (msg: string) => { setError(msg); return false; };
  const valid: Partial<Record<Step, () => boolean>> = {
    name: () => (!name.trim() ? fail(tx('errName')) : !category ? fail(tx('errKind')) : true),
    size: () => (!(kg > 0) ? fail(tx('errKgPerUnit', { unit: one })) : !grown && (!(Number(warnBags) >= 0) || warnBags === '') ? fail(tx('errWarn', { packs })) : true),
    // A farm-grown feed may have no price (0); a bought one needs its price.
    price: () => (grown ? (priceNum >= 0 || price === '' ? true : fail(tx('errCostNeg'))) : !(priceNum > 0) ? fail(byPack ? tx('errPriceUnit', { unit: one }) : tx('errPriceKg')) : true),
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
      setError(e instanceof Error ? e.message : tx('errSave'));
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
    name: { title: edit ? tx('editFeed') : tx('addFeed'), sub: tx('nameSub') },
    size: { title: tx('sizeTitle'), sub: loose ? tx('sizeSubLoose') : tx('sizeSub', { unit: one }) },
    price: { title: grown ? tx('costOptTitle') : tx('priceTitle'), sub: grown ? tx('costSub') : tx('priceSub') },
    extra: { title: tx('detailsTitle'), sub: tx('allOptional') },
  };

  const summary = step === 'name' ? '' : [name.trim(), step === 'price' || step === 'extra' ? (loose ? tx('countedInKg') : tx('kgAUnit', { kg, unit: one })) : '', step === 'extra' && perBagCost > 0 ? tx('priceAUnit', { price: money(perBagCost), unit: one }) : ''].filter(Boolean).join(' · ');

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={summary}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : back} label={step === 'extra' ? (saving ? flow('saving') : tx('saveFeed')) : flow('next')} busy={saving} />}
    >
      {step === 'name' && (
        <>
          <Question label={tx('nameLabel')} hint={tx('nameHint')}>
            <Input aria-label={tx('nameLabel')} autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          <Question label={tx('kindLabel')}>
            <PickList options={kinds} value={category} onChange={v => { setCategory(v); setError(''); }} />
            {onManageCategories && (
              <button type="button" onClick={onManageCategories} className="mt-2 min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">{tx('changeKinds')}</button>
            )}
          </Question>
          <Question label={tx('sourceLabel')} hint={grown ? tx('grownHint') : undefined}>
            <div className="grid grid-cols-2 gap-3">
              <Choice selected={!grown} onClick={() => setGrown(false)}>{tx('weBuy')}</Choice>
              <Choice selected={grown} onClick={() => { setGrown(true); if (!edit) setUnit('kg'); }}>{tx('weGrow')}</Choice>
            </div>
          </Question>
        </>
      )}

      {step === 'size' && (
        <>
          <Question label={tx('countedIn')}>
            <div className="grid grid-cols-3 gap-3">
              {unitChoices.map(u => <Choice key={u} selected={unit === u} onClick={() => { setUnit(u); setError(''); }}>{u === 'kg' ? tx('kgLabel') : unitWord(u, 2)[0].toUpperCase() + unitWord(u, 2).slice(1)}</Choice>)}
            </div>
          </Question>
          {!loose && (
            <Question label={tx('kgInOne', { unit: one })}>
              <Input aria-label={tx('kgInOne', { unit: one })} type="number" step="any" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            </Question>
          )}
          {!grown && <Question label={loose ? tx('warnLoose') : tx('warnPacks', { packs })} hint={!loose && Number(warnBags) > 0 && kg > 0 ? tx('warnHint', { kg: (Number(warnBags) * kg).toLocaleString() }) : undefined}>
            <Input aria-label={tx('warnAria', { packs })} type="number" step="any" inputMode="numeric" value={warnBags} onChange={e => { setWarnBags(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
          </Question>}
        </>
      )}

      {step === 'price' && (
        <>
          {!loose && (
            <Question label={tx('priceKnow')}>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={perBag} onClick={() => { setPerBag(true); setError(''); }}>{tx('oneUnit', { unit: one })}</Choice>
                <Choice selected={!perBag} onClick={() => { setPerBag(false); setError(''); }}>{tx('oneKg')}</Choice>
              </div>
            </Question>
          )}
          <Question label={grown ? (byPack ? tx('costUnitOpt', { unit: one }) : tx('costKgOpt')) : byPack ? tx('priceUnit', { unit: one }) : tx('priceKg')}>
            <Input aria-label={tx('priceAria')} type="number" step="any" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            {priceNum > 0 && kg > 0 && !loose && (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
                {tx('priceAUnit', { price: money(perBagCost), unit: one })} · {tx('priceAKg', { price: money(perKgCost) })}
              </p>
            )}
          </Question>
        </>
      )}

      {step === 'extra' && (
        <>
          <Question label={tx('supplierOpt')}><Input aria-label={tx('supplierAria')} value={supplier} onChange={e => setSupplier(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label={tx('noteOpt')}><Input aria-label={tx('noteAria')} value={notes} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
          {edit && (
            <Question label={tx('stillUsing')} hint={tx('stillHint')}>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={active} onClick={() => setActive(true)}>{tx('yes')}</Choice>
                <Choice selected={!active} onClick={() => setActive(false)}>{tx('no')}</Choice>
              </div>
            </Question>
          )}
        </>
      )}
    </FlowShell>
  );
}
