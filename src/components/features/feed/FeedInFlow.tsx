'use client';

import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';

interface FeedInFlowProps {
  isOpen: boolean;
  onClose: () => void;
  products: FeedProductItem[];
  farms: FarmItem[];
  currentUser?: UserRoleItem;
  onSave: (tx: FeedStockTransaction) => Promise<void>;
}

type Step = 'pick' | 'amount' | 'done';

const today = () => new Date().toISOString().split('T')[0];
// Ids are made on demand, not during render.
const newStamp = () => Date.now();
const money = (n: number) => `៛ ${Math.round(n).toLocaleString()}`;

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
  const lockedFarm = currentUser?.farmLocation && !['Super Admin', 'Admin', 'Company'].includes(currentUser.role)
    ? currentUser.farmLocation
    : null;

  const [step, setStep] = useState<Step>(active.length === 1 ? 'amount' : 'pick');
  const [productId, setProductId] = useState(active.length === 1 ? active[0].id : '');
  const [bags, setBags] = useState('');
  const [farm, setFarm] = useState(lockedFarm ?? (farms.length === 1 ? farms[0].name : ''));
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [received, setReceived] = useState<{ name: string; bags: number; kg: number } | null>(null);

  const product = active.find(p => p.id === productId);
  const count = Number(bags);
  const perBag = product?.weightPerUnit || 30;
  const kg = count * perBag;
  const cost = kg * (product?.unitCost || 0);

  const save = async () => {
    if (!product) return;
    if (!(count > 0)) { setError('Type how many bags arrived.'); return; }
    if (!farm) { setError('Choose which farm received it.'); return; }
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

  const another = () => {
    setBags('');
    setRef('');
    setNotes('');
    setError('');
    setStep(active.length === 1 ? 'amount' : 'pick');
    if (active.length !== 1) setProductId('');
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold text-ink">
          {step === 'pick' && 'Which feed arrived?'}
          {step === 'amount' && (product?.name ?? 'Feed')}
          {step === 'done' && 'Feed added'}
        </DialogTitle>
        <DialogDescription className="text-base text-ink-muted">
          {step === 'pick' && 'Choose the feed that was delivered.'}
          {step === 'amount' && 'How much came in?'}
          {step === 'done' && 'The stock count has gone up.'}
        </DialogDescription>
      </DialogHeader>

      {step === 'pick' && (
        <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
          {active.map(p => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => { setProductId(p.id); setError(''); setStep('amount'); }}
                className="flex min-h-14 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-4 py-2 text-left hover:border-emerald-600"
              >
                <span className="text-lg font-semibold text-ink">{p.name}</span>
                <span className="text-sm text-ink-muted">{[p.category, `${p.weightPerUnit} kg per ${p.unit}`].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
          {active.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-base text-ink-muted">No feed products yet. Add one on the Feed page first.</li>}
        </ul>
      )}

      {step === 'amount' && product && (
        <div className="space-y-4">
          <div>
            <label htmlFor="feedin-bags" className="mb-1 block text-base font-medium text-ink">Number of bags</label>
            <Input id="feedin-bags" type="number" inputMode="numeric" autoFocus value={bags} onChange={e => { setBags(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') save(); }} className="h-16 text-center text-3xl font-semibold" />
            <p className="mt-2 text-base text-ink-muted">
              {count > 0 ? <>{kg.toLocaleString()} kg ({perBag} kg per bag) · worth {money(cost)}</> : `${perBag} kg per bag`}
            </p>
          </div>

          {lockedFarm ? (
            <p className="text-base text-ink-muted">Received at: <span className="font-medium text-ink">{lockedFarm}</span></p>
          ) : (
            <div>
              <p className="mb-1 text-base font-medium text-ink">Received at which farm?</p>
              <div className="flex flex-wrap gap-2">
                {farms.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={farm === f.name}
                    onClick={() => { setFarm(f.name); setError(''); }}
                    className={`min-h-12 rounded-xl border-2 px-4 text-base font-medium ${farm === f.name ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink'}`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="feedin-date" className="mb-1 block text-base font-medium text-ink">Date delivered</label>
            <Input id="feedin-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="feedin-ref" className="mb-1 block text-base font-medium text-ink">Invoice number (optional)</label>
            <Input id="feedin-ref" value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <div>
            <label htmlFor="feedin-notes" className="mb-1 block text-base font-medium text-ink">Note (optional)</label>
            <Input id="feedin-notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      {step === 'done' && received && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-xl text-ink">
            <span className="font-semibold">{received.bags} {received.bags === 1 ? 'bag' : 'bags'}</span> of <span className="font-semibold">{received.name}</span> added
            <span className="block text-base text-ink-muted">{received.kg.toLocaleString()} kg</span>
          </p>
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" onClick={another}>Add more feed</Button>
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>I&apos;m done</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

      {step === 'amount' && (
        <div className="flex gap-3">
          {active.length > 1 && (
            <Button type="button" variant="secondary" size="lg" aria-label="Go back" onClick={() => { setError(''); setStep('pick'); }}><ArrowLeft /></Button>
          )}
          <Button type="button" size="lg" className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save feed'}</Button>
        </div>
      )}
    </DialogContent>
  );
}
