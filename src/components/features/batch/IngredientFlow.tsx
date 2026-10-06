'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FeedProductItem } from '@/lib/types';
import { matchIngredientProduct } from '@/lib/feed-math';
import { feedUnit, kgPerUnit, round1 } from '@/lib/daily-feed';
import { FlowFooter, FlowShell, NUM, Question, RowButton, money } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';
import { useFeedUnits } from '../feed/DailyFeedFlow';

export interface IngredientChoice { name: string; productId?: string; portionPerHead: number; unitCost: number }

interface IngredientFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The feed catalogue to choose from when adding. */
  products: FeedProductItem[];
  /** Feeds the batch already uses, hidden from the list when adding. */
  usedNames?: string[];
  /** The ingredient being changed; leave empty to add one. */
  existing?: IngredientChoice | null;
  /** False when the ingredient being changed is not in the feed list; the person then picks a feed to replace it. */
  existingInCatalogue?: boolean;
  headCount: number;
  onSave: (ingredient: IngredientChoice) => Promise<void>;
}

type Step = 'pick' | 'amount';

export default function IngredientFlow(props: IngredientFlowProps) {
  // Remount on every open so each change starts from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <IngredientBody {...props} />}
    </Dialog>
  );
}

function IngredientBody({ onClose, products, usedNames = [], existing, existingInCatalogue = true, headCount, onSave }: IngredientFlowProps) {
  const { tx } = useText('batchesPage');
  const flow = useText('flow');
  const units = useFeedUnits();
  const keepName = !!existing && existingInCatalogue;
  const used = new Set(usedNames.map(n => n.toLowerCase()));
  const options = products.filter(p => p.status !== 'Inactive' && !used.has(p.name.toLowerCase()));
  const [step, setStep] = useState<Step>(keepName ? 'amount' : 'pick');
  // The feed an existing plan line is linked to (or clearly matches by name).
  const linked = keepName ? matchIngredientProduct(existing!, products) ?? null : null;
  const [product, setProduct] = useState<FeedProductItem | null>(null);
  const chosen = keepName ? linked : product;
  // The plan is entered the way farms count it: bags (or kg of grass) a day for the whole batch.
  const perBatch = headCount > 0;
  const toUnits = (kgPerHead: number, p: FeedProductItem | null) => round1((kgPerHead * headCount) / kgPerUnit(p));
  const [amount, setAmount] = useState(existing ? String(perBatch ? toUnits(existing.portionPerHead, linked) : existing.portionPerHead) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const name = keepName ? existing!.name : product?.name ?? '';
  const unitCost = chosen ? chosen.unitCost : existing?.unitCost ?? 0;
  const unit = feedUnit(chosen);
  const amountNum = Number(amount);
  const kgNum = perBatch ? (amountNum * kgPerUnit(chosen)) / headCount : amountNum;
  const steps: Step[] = keepName ? ['amount'] : ['pick', 'amount'];

  const save = async () => {
    if (!(amountNum > 0)) { setError(perBatch ? tx('eUnits', { unit: units.word(unit, 2) }) : tx('eKgEach')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name, productId: chosen?.id, portionPerHead: Math.round(kgNum * 1000) / 1000, unitCost });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('eSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={step === 'pick' ? tx('iTitlePick') : name || tx('iTitleAmount')}
      subtitle={step === 'pick' ? (existing && !keepName ? tx('iSubNotInList', { name: existing.name }) : tx('iSubPick')) : perBatch ? tx('iSubBatch', { n: headCount }) : tx('iSubOne')}
      summary={step === 'amount' && !keepName ? name : ''}
      error={error}
      onSubmit={step === 'amount' ? save : undefined}
      footer={step === 'amount' ? <FlowFooter onBack={keepName ? undefined : () => { setError(''); setStep('pick'); }} label={saving ? flow.tx('saving') : flow.tx('save')} busy={saving} /> : null}
    >
      {step === 'pick' && (
        <ul className="space-y-3 pb-2">
          {options.map(p => (
            <li key={p.id}>
              <RowButton onClick={() => { setProduct(p); setError(''); setStep('amount'); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{p.name}</span>
                  <span className="block text-base text-ink-muted">{[p.category, tx('iAKg', { amount: money(p.unitCost) })].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {options.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{products.length === 0 ? tx('iNoFeeds') : tx('iAllUsed')}</li>}
        </ul>
      )}

      {step === 'amount' && (
        <Question label={perBatch ? tx('iPerBatch', { unit: (w => w.charAt(0).toUpperCase() + w.slice(1))(units.word(unit, 2)) }) : tx('iPerOne')}>
          <Input aria-label={perBatch ? tx('iPerBatch', { unit: units.word(unit, 2) }) : tx('iPerOne')} type="number" step="any" inputMode="decimal" autoFocus value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          {amountNum > 0 && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
              {perBatch
                ? <>{unit !== 'kg' && <>{round1(amountNum * kgPerUnit(chosen)).toLocaleString()} kg · </>}{tx('iAbout', { kg: round1(kgNum), amount: money(amountNum * kgPerUnit(chosen) * unitCost) })}</>
                : tx('iHerd', { n: headCount, kg: round1(kgNum * headCount), amount: money(kgNum * unitCost * headCount) })}
            </p>
          )}
        </Question>
      )}
    </FlowShell>
  );
}
