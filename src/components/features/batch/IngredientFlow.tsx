'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { FeedProductItem } from '@/lib/types';
import { FlowFooter, FlowShell, NUM, Question, RowButton, money } from '../flow/FlowShell';

export interface IngredientChoice { name: string; portionPerHead: number; unitCost: number }

interface IngredientFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The feed catalogue to choose from when adding. */
  products: FeedProductItem[];
  /** Feeds the batch already uses, hidden from the list when adding. */
  usedNames?: string[];
  /** The ingredient being changed; leave empty to add one. */
  existing?: { name: string; portionPerHead: number; unitCost: number } | null;
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
  const keepName = !!existing && existingInCatalogue;
  const used = new Set(usedNames.map(n => n.toLowerCase()));
  const options = products.filter(p => p.status !== 'Inactive' && !used.has(p.name.toLowerCase()));
  const [step, setStep] = useState<Step>(keepName ? 'amount' : 'pick');
  const [product, setProduct] = useState<FeedProductItem | null>(null);
  const [kg, setKg] = useState(existing ? String(existing.portionPerHead) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const name = keepName ? existing!.name : product?.name ?? '';
  const unitCost = keepName ? existing!.unitCost : product?.unitCost ?? 0;
  const kgNum = Number(kg);
  const steps: Step[] = keepName ? ['amount'] : ['pick', 'amount'];

  const save = async () => {
    if (!(kgNum > 0)) { setError('Type how many kg each animal gets in a day.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name, portionPerHead: kgNum, unitCost });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={step === 'pick' ? 'Which feed?' : name || 'How much?'}
      subtitle={step === 'pick' ? (existing && !keepName ? `${existing.name} is not in your feed list. Choose the feed it should be.` : 'Choose from your feed list.') : 'How much one animal eats in a day.'}
      summary={step === 'amount' && !keepName ? name : ''}
      error={error}
      onSubmit={step === 'amount' ? save : undefined}
      footer={step === 'amount' ? <FlowFooter onBack={keepName ? undefined : () => { setError(''); setStep('pick'); }} label={saving ? 'Saving…' : 'Save'} busy={saving} /> : null}
    >
      {step === 'pick' && (
        <ul className="space-y-3 pb-2">
          {options.map(p => (
            <li key={p.id}>
              <RowButton onClick={() => { setProduct(p); setError(''); setStep('amount'); }}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{p.name}</span>
                  <span className="block text-base text-ink-muted">{[p.category, `${money(p.unitCost)} a kg`].filter(Boolean).join(' · ')}</span>
                </span>
              </RowButton>
            </li>
          ))}
          {options.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{products.length === 0 ? 'No feeds yet. Add one on the Feed page first.' : 'This batch already uses every feed in your list.'}</li>}
        </ul>
      )}

      {step === 'amount' && (
        <Question label="Kg for each animal each day">
          <Input aria-label="Kg for each animal each day" type="number" inputMode="decimal" autoFocus value={kg} onChange={e => { setKg(e.target.value); setError(''); }} className={`h-20 text-center text-4xl font-semibold ${NUM}`} />
          {kgNum > 0 && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
              {headCount} animals eat <span className="font-semibold">{Math.round(kgNum * headCount * 10) / 10} kg</span> a day · {money(kgNum * unitCost * headCount)} a day
            </p>
          )}
        </Question>
      )}
    </FlowShell>
  );
}
