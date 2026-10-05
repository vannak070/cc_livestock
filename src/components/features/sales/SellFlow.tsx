'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StockItem } from '@/lib/types';

interface SellFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active cattle the person may sell. */
  cattle: StockItem[];
  /** Skips step 1 when the caller already knows which animal. */
  preselectedCowId?: string | null;
  /** Saves a new weight first, so the sale uses the scale reading. */
  onWeigh: (cowId: string, weight: number, healthStatus: string, date: string) => Promise<void>;
  onSell: (cowId: string, unitPrice: number, saleType: 'Weight' | 'Lumpsum', date: string, buyer?: string) => Promise<void>;
}

type Step = 'pick' | 'price' | 'confirm' | 'done';

const today = () => new Date().toISOString().split('T')[0];
const money = (n: number) => `៛ ${Math.round(n).toLocaleString()}`;

export default function SellFlow(props: SellFlowProps) {
  // Remount on every open so each sale starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <SellBody {...props} />}
    </Dialog>
  );
}

function SellBody({ onClose, cattle, preselectedCowId, onWeigh, onSell }: SellFlowProps) {
  const initial = preselectedCowId ? cattle.find(c => c.id === preselectedCowId) : undefined;
  const [step, setStep] = useState<Step>(initial ? 'price' : 'pick');
  const [cowId, setCowId] = useState<string | null>(initial?.id ?? null);
  const [query, setQuery] = useState('');
  const [perKg, setPerKg] = useState(true);
  const [weight, setWeight] = useState(initial?.weight ? String(initial.weight) : '');
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [soldCount, setSoldCount] = useState(0);
  const [lastSale, setLastSale] = useState<{ cowId: string; total: number } | null>(null);

  const cow = cattle.find(c => c.id === cowId);
  const kg = Number(weight);
  const unit = Number(price);
  const total = perKg ? kg * unit : unit;
  const cost = cow?.totalPrice ?? 0;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cattle.filter(c => !q || c.id.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q) || c.sex?.toLowerCase().includes(q));
  }, [cattle, query]);

  const choose = (c: StockItem) => {
    setCowId(c.id);
    setWeight(c.weight ? String(c.weight) : '');
    setPrice('');
    setError('');
    setStep('price');
  };

  const review = () => {
    if (perKg && !(kg > 0)) { setError('Type the weight from the scale, in kg.'); return; }
    if (!(unit > 0)) { setError(perKg ? 'Type the price for each kg.' : 'Type the price the buyer pays.'); return; }
    setError('');
    setStep('confirm');
  };

  const sell = async () => {
    if (!cow) return;
    setSaving(true);
    setError('');
    try {
      if (perKg && kg !== cow.weight) await onWeigh(cow.id, kg, cow.healthStatus, date);
      await onSell(cow.id, unit, perKg ? 'Weight' : 'Lumpsum', date, buyer.trim() || undefined);
      setLastSale({ cowId: cow.id, total });
      setSoldCount(n => n + 1);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the sale. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const another = () => {
    setCowId(null);
    setQuery('');
    setWeight('');
    setPrice('');
    setError('');
    setStep('pick');
  };

  const title = {
    pick: 'Which animal is sold?',
    price: `Sell ${cow?.id ?? ''}`,
    confirm: 'Check the sale',
    done: 'Sale recorded',
  }[step];

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold text-ink">{title}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">
          {step === 'pick' && 'Choose the animal the buyer is taking.'}
          {step === 'price' && [cow?.breed, cow?.sex, cow?.location].filter(Boolean).join(' · ')}
          {step === 'confirm' && 'Once saved, the animal leaves the active herd.'}
          {step === 'done' && 'It is in the sales list.'}
        </DialogDescription>
      </DialogHeader>

      {step === 'pick' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="pl-10" />
          </div>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {list.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left hover:border-emerald-600"
                >
                  <span>
                    <span className="block text-lg font-semibold text-ink">{c.id}</span>
                    <span className="block text-sm text-ink-muted">{[c.sex, c.breed].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-base font-medium text-ink">{c.weight ? `${c.weight} kg` : '—'}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-base text-ink-muted">No animal with that tag.</li>}
          </ul>
        </div>
      )}

      {step === 'price' && cow && (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-base font-medium text-ink">How is the price set?</p>
            <div className="flex flex-wrap gap-2">
              {[{ v: true, t: 'Price per kg' }, { v: false, t: 'One price for the animal' }].map(o => (
                <button
                  key={o.t}
                  type="button"
                  aria-pressed={perKg === o.v}
                  onClick={() => { setPerKg(o.v); setError(''); }}
                  className={`min-h-12 rounded-xl border-2 px-4 text-base font-medium ${perKg === o.v ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink'}`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>

          {perKg && (
            <div>
              <label htmlFor="sell-kg" className="mb-1 block text-base font-medium text-ink">Weight on the scale (kg)</label>
              <Input id="sell-kg" type="number" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className="h-14 text-xl font-semibold" />
              {cow.weight ? <p className="mt-1 text-sm text-ink-muted">Last weight: {cow.weight} kg</p> : null}
            </div>
          )}

          <div>
            <label htmlFor="sell-price" className="mb-1 block text-base font-medium text-ink">{perKg ? 'Price for each kg (៛)' : 'Price the buyer pays (៛)'}</label>
            <Input id="sell-price" type="number" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className="h-14 text-xl font-semibold" />
          </div>

          <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">
            Total: <span className="font-semibold">{money(total > 0 ? total : 0)}</span>
          </p>

          <div>
            <label htmlFor="sell-buyer" className="mb-1 block text-base font-medium text-ink">Buyer (optional)</label>
            <Input id="sell-buyer" value={buyer} onChange={e => setBuyer(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sell-date" className="mb-1 block text-base font-medium text-ink">Date sold</label>
            <Input id="sell-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      )}

      {step === 'confirm' && cow && (
        <dl className="space-y-3 rounded-xl bg-slate-50 p-4 text-base">
          <div className="flex justify-between"><dt className="text-ink-muted">Animal</dt><dd className="font-semibold text-ink">{cow.id}</dd></div>
          {perKg && <div className="flex justify-between"><dt className="text-ink-muted">Weight</dt><dd className="font-semibold text-ink">{kg} kg × {money(unit)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-muted">Buyer</dt><dd className="font-semibold text-ink">{buyer.trim() || '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-muted">Date</dt><dd className="font-semibold text-ink">{date}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-lg"><dt className="font-medium text-ink">Sale total</dt><dd className="font-semibold text-emerald-700">{money(total)}</dd></div>
          {cost > 0 && (
            <div className="flex justify-between text-sm">
              <dt className="text-ink-muted">Bought for {money(cost)}</dt>
              <dd className={`font-medium ${total - cost < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {total - cost < 0 ? 'Loss' : 'Profit'} {money(Math.abs(total - cost))}
              </dd>
            </div>
          )}
        </dl>
      )}

      {step === 'done' && lastSale && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-xl text-ink"><span className="font-semibold">{lastSale.cowId}</span> sold for <span className="font-semibold">{money(lastSale.total)}</span></p>
          {soldCount > 1 && <p className="text-base text-ink-muted">{soldCount} animals sold this time</p>}
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" onClick={another}>Sell another animal</Button>
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>I&apos;m done</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

      {(step === 'price' || step === 'confirm') && (
        <div className="flex gap-3">
          {(step === 'confirm' || !preselectedCowId) && (
            <Button type="button" variant="secondary" size="lg" aria-label="Go back" onClick={() => { setError(''); setStep(step === 'confirm' ? 'price' : 'pick'); }}>
              <ArrowLeft />
            </Button>
          )}
          {step === 'price'
            ? <Button type="button" size="lg" className="flex-1" onClick={review}>Next</Button>
            : <Button type="button" size="lg" className="flex-1" onClick={sell} disabled={saving}>{saving ? 'Saving…' : 'Record sale'}</Button>}
        </div>
      )}
    </DialogContent>
  );
}
