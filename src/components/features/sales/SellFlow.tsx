'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { StockItem } from '@/lib/types';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, Question, RowButton, money, today } from '../flow/FlowShell';

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

type Step = 'pick' | 'how' | 'price' | 'buyer' | 'confirm' | 'done';

export default function SellFlow(props: SellFlowProps) {
  // Remount on every open so each sale starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <SellBody {...props} />}
    </Dialog>
  );
}

function SellBody({ onClose, cattle, preselectedCowId, onWeigh, onSell }: SellFlowProps) {
  const known = preselectedCowId ? cattle.find(c => c.id === preselectedCowId) : undefined;
  const [step, setStep] = useState<Step>(known ? 'how' : 'pick');
  const [cowId, setCowId] = useState<string | null>(known?.id ?? null);
  const [query, setQuery] = useState('');
  const [perKg, setPerKg] = useState(true);
  const [weight, setWeight] = useState(known?.weight ? String(known.weight) : '');
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

  const steps: Step[] = known ? ['how', 'price', 'buyer', 'confirm'] : ['pick', 'how', 'price', 'buyer', 'confirm'];
  const order = steps;
  const at = order.indexOf(step);

  const choose = (c: StockItem) => {
    setCowId(c.id);
    setWeight(c.weight ? String(c.weight) : '');
    setPrice('');
    setError('');
    setStep('how');
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

  const next = () => {
    if (step === 'how' && perKg && !(kg > 0)) { setError('Type the weight from the scale, in kg.'); return; }
    if (step === 'price' && !(unit > 0)) { setError(perKg ? 'Type the price for each kg.' : 'Type the price the buyer pays.'); return; }
    if (step === 'confirm') { sell(); return; }
    setError('');
    setStep(order[at + 1]);
  };
  const back = () => { setError(''); setStep(order[at - 1]); };
  const another = () => { setCowId(null); setQuery(''); setWeight(''); setPrice(''); setError(''); setStep('pick'); };

  const summary = cow && step !== 'pick' && step !== 'done' && step !== 'confirm'
    ? [cow.id, perKg && kg > 0 && step !== 'how' ? `${kg} kg` : '', total > 0 && step === 'buyer' ? money(total) : ''].filter(Boolean).join(' · ')
    : '';

  const title = {
    pick: 'Which animal is sold?',
    how: `Sell ${cow?.id ?? ''}`,
    price: 'What does the buyer pay?',
    buyer: 'Who bought it?',
    confirm: 'Check the sale',
    done: 'Sale recorded',
  }[step];
  const subtitle = {
    pick: 'Choose the animal the buyer is taking.',
    how: [cow?.breed, cow?.sex, cow?.location].filter(Boolean).join(' · '),
    price: perKg ? 'The price for each kg.' : 'One price for the whole animal.',
    buyer: 'Both are optional except the date.',
    confirm: 'Once saved, the animal leaves the active herd.',
    done: 'It is in the sales list.',
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
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'confirm' ? (saving ? 'Saving…' : 'Record sale') : 'Next'} busy={saving} />
      )}
    >
      {step === 'pick' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tag number" aria-label="Search tag number" className="h-14 pl-10 text-lg" />
          </div>
          <ul className="space-y-3 pb-2">
            {list.map(c => (
              <li key={c.id}>
                <RowButton onClick={() => choose(c)}>
                  <span>
                    <span className="block text-xl font-semibold text-ink">{c.id}</span>
                    <span className="block text-base text-ink-muted">{[c.sex, c.breed].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-lg font-medium text-ink">{c.weight ? `${c.weight} kg` : '—'}</span>
                </RowButton>
              </li>
            ))}
            {/* An empty farm is not a search that found nothing. */}
            {list.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{cattle.length === 0 ? 'There are no animals on the farm to sell. Add cattle first.' : 'No animal with that tag.'}</li>}
          </ul>
        </>
      )}

      {step === 'how' && cow && (
        <>
          <Question label="How is the price set?">
            <div className="flex flex-wrap gap-3">
              <Choice selected={perKg} onClick={() => { setPerKg(true); setError(''); }}>Price per kg</Choice>
              <Choice selected={!perKg} onClick={() => { setPerKg(false); setError(''); }}>One price for the animal</Choice>
            </div>
          </Question>
          {perKg && (
            <Question label="Weight on the scale (kg)" hint={cow.weight ? `Last weight: ${cow.weight} kg` : undefined}>
              <Input aria-label="Weight on the scale in kg" type="number" step="any" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            </Question>
          )}
        </>
      )}

      {step === 'price' && (
        <Question label={perKg ? 'Price for each kg (៛)' : 'Price the buyer pays (៛)'}>
          <Input aria-label="Price" type="number" step="any" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
            Total: <span className="font-semibold">{money(total > 0 ? total : 0)}</span>
            {perKg && kg > 0 && unit > 0 && <span className="text-ink-muted"> ({kg} kg × {money(unit)})</span>}
          </p>
        </Question>
      )}

      {step === 'buyer' && (
        <>
          <Question label="Buyer (optional)"><Input aria-label="Buyer" value={buyer} onChange={e => setBuyer(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label="Date sold"><Input aria-label="Date sold" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'confirm' && cow && (
        <dl className="space-y-4 rounded-xl bg-slate-50 p-4">
          {[
            ['Animal', cow.id],
            ...(perKg ? [['Weight', `${kg} kg × ${money(unit)}`]] : []),
            ['Buyer', buyer.trim() || '—'],
            ['Date', date],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-lg text-ink-muted">{k}</dt><dd className="text-lg font-semibold text-ink">{v}</dd></div>
          ))}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-4"><dt className="text-xl font-medium text-ink">Sale total</dt><dd className="text-xl font-semibold text-emerald-700">{money(total)}</dd></div>
          {cost > 0 && (
            <div className="flex justify-between gap-3 text-base">
              <dt className="text-ink-muted">Bought for {money(cost)}</dt>
              <dd className={`font-medium ${total - cost < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{total - cost < 0 ? 'Loss' : 'Profit'} {money(Math.abs(total - cost))}</dd>
            </div>
          )}
        </dl>
      )}

      {step === 'done' && lastSale && (
        <FlowDone
          message={<><span className="font-semibold">{lastSale.cowId}</span> sold for <span className="font-semibold">{money(lastSale.total)}</span></>}
          detail={soldCount > 1 ? `${soldCount} animals sold this time` : undefined}
          again="Sell another animal"
          onAgain={another}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
