'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BatchItem, StockItem } from '@/lib/types';
import { BUYBACK_BUYER } from '@/lib/buyback';
import { FlowDone, FlowFooter, FlowShell, NUM, Question, RowButton, money, today } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';
import { shownDay } from '@/lib/khmer-date';

export interface BuybackTarget {
  farm: string;
  /** The batch the task is about, when it is known (a batch already on the farm). */
  batchId?: string;
  plannedHead: number;
  /** Riel per kg from the program. */
  pricePerKg?: number;
  /** Contract prices per kg by batch: a batch's contract overrides the plan price. */
  contractPrices?: Record<string, number>;
  /** The other half of a same-day exchange (the new cattle sold to the farm), when it is still to do. */
  thenAdd?: { farm: string; title: string; pricePerKg?: number };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  target: BuybackTarget | null;
  batches: BatchItem[];
  /** Every animal, to find the batch's cattle still on the farm. */
  stock: StockItem[];
  /** Sells every animal of the batch still on the farm to CC Livestock and closes the batch. */
  onBuyBack: (batchId: string, pricePerKg: number, date: string) => Promise<void>;
  /** Moves on to adding the new cattle of the same exchange (this dialog closes). */
  onThenAdd?: (next: NonNullable<BuybackTarget['thenAdd']>) => void;
}

type Step = 'batch' | 'price' | 'confirm' | 'done';

export default function BuybackFlow(props: Props) {
  // Remount on every open so each buy-back starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && props.target && <Body {...props} target={props.target} />}
    </Dialog>
  );
}

function Body({ onClose, target, batches, stock, onBuyBack, onThenAdd }: Props & { target: BuybackTarget }) {
  const { tx, language } = useText('buybackFlow');
  const flow = useText('flow');
  const active = (c: StockItem) => (c.status ?? '').toLowerCase() === 'active';
  const options = useMemo(() => batches
    .filter(b => b.status === 'Active' && b.farmLocation === target.farm)
    .map(b => {
      const cattle = (b.cowIds ?? []).map(id => stock.find(c => c.id === id)).filter((c): c is StockItem => !!c && active(c));
      return { batch: b, head: cattle.length, kg: Math.round(cattle.reduce((s, c) => s + (Number(c.weight) || 0), 0)) };
    })
    .filter(o => o.head > 0), [batches, stock, target.farm]);

  const known = target.batchId && options.some(o => o.batch.id === target.batchId) ? target.batchId : null;
  const steps: Step[] = known ? ['price', 'confirm'] : ['batch', 'price', 'confirm'];
  const [step, setStep] = useState<Step>(steps[0]);
  const [batchId, setBatchId] = useState<string | null>(known);
  // Starting price: the batch's contract, else the price set on the batch, else the plan's price from the task.
  const batchPrice = (id: string | null) => (id ? batches.find(x => x.id === id)?.expectedSellingPrice || undefined : undefined);
  const ownPrice = (id: string | null) => (id ? target.contractPrices?.[id] ?? batchPrice(id) : undefined);
  const [price, setPrice] = useState(() => { const p = ownPrice(known) ?? target.pricePerKg; return p ? String(p) : ''; });
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ head: number; total: number } | null>(null);

  const chosen = options.find(o => o.batch.id === batchId);
  const unit = Number(price);
  const total = chosen ? chosen.kg * unit : 0;
  const at = steps.indexOf(step as Step);

  const record = async () => {
    if (!chosen) return;
    setSaving(true);
    setError('');
    try {
      await onBuyBack(chosen.batch.id, unit, date);
      setResult({ head: chosen.head, total });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('errRecord'));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'price' && !(unit > 0)) { setError(tx('errPrice')); return; }
    if (step === 'confirm') { record(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };

  const title = { batch: tx('tBatch'), price: tx('tPrice'), confirm: tx('tConfirm'), done: tx('tDone') }[step];
  const subtitle = {
    batch: tx('sBatch', { farm: target.farm, n: target.plannedHead }),
    price: target.contractPrices?.[batchId ?? ''] ? tx('sPriceContract') : batchPrice(batchId) ? tx('sPriceBatch') : target.pricePerKg ? tx('sPricePlan') : tx('sPrice'),
    confirm: tx('sConfirm'),
    done: tx('sDone'),
  }[step];

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={title}
      subtitle={subtitle}
      summary={chosen && step !== 'batch' && step !== 'done' ? `${chosen.batch.name} · ${tx('cattleN', { n: chosen.head })}` : ''}
      error={error}
      onSubmit={step === 'batch' || step === 'done' ? undefined : next}
      footer={step === 'batch' || step === 'done' ? null : (
        <FlowFooter onBack={at === 0 ? undefined : back} label={step === 'confirm' ? (saving ? flow.tx('saving') : tx('record')) : flow.tx('next')} busy={saving} />
      )}
    >
      {step === 'batch' && (options.length === 0
        ? <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">{tx('noBatch', { farm: target.farm })}</p>
        : (
          <ul className="space-y-3 pb-2">
            {options.map(o => (
              <li key={o.batch.id}>
                <RowButton onClick={() => { setBatchId(o.batch.id); const p = ownPrice(o.batch.id) ?? target.pricePerKg; setPrice(p ? String(p) : ''); setError(''); setStep('price'); }}>
                  <span>
                    <span className="block text-xl font-semibold text-ink">{o.batch.name}</span>
                    <span className="block text-base text-ink-muted">{tx('cattleN', { n: o.head })} · {o.kg.toLocaleString()} kg</span>
                  </span>
                </RowButton>
              </li>
            ))}
          </ul>
        ))}

      {step === 'price' && (
        <>
          <Question label={tx('priceKg')} hint={target.contractPrices?.[batchId ?? ''] ? tx('priceHintContract') : batchPrice(batchId) ? tx('priceHintBatch') : target.pricePerKg ? tx('priceHint') : undefined}>
            <Input aria-label={tx('priceKg')} type="number" step="any" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            {chosen && unit > 0 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">{tx('total')} <span className="font-semibold">{money(total)}</span> <span className="text-ink-muted">({chosen.kg.toLocaleString()} kg × {money(unit)})</span></p>}
          </Question>
          <Question label={tx('date')}><Input aria-label={tx('date')} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'confirm' && chosen && (
        <>
          <dl className="space-y-4 rounded-xl bg-slate-50 p-4">
            {[
              [tx('batch'), chosen.batch.name],
              [tx('cattle'), `${chosen.head}`],
              [tx('weight'), `${chosen.kg.toLocaleString()} kg × ${money(unit)}`],
              [tx('buyer'), BUYBACK_BUYER],
              [tx('date'), shownDay(date, language)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-lg text-ink-muted">{k}</dt><dd className="text-lg font-semibold text-ink">{v}</dd></div>
            ))}
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-4"><dt className="text-xl font-medium text-ink">{tx('total')}</dt><dd className="text-xl font-semibold text-emerald-700">{money(total)}</dd></div>
          </dl>
          {chosen.head !== target.plannedHead && <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">{tx('headDiffers', { planned: target.plannedHead, n: chosen.head })}</p>}
          <p className="text-base text-ink-muted">{tx('closes')}</p>
        </>
      )}

      {step === 'done' && result && (
        <FlowDone
          message={tx('doneMsg', { n: result.head, amount: money(result.total) })}
          detail={target.thenAdd ? tx('doneThen') : tx('doneDetail')}
          again={target.thenAdd && onThenAdd ? tx('thenAdd') : undefined}
          onAgain={target.thenAdd && onThenAdd ? () => onThenAdd(target.thenAdd!) : undefined}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
