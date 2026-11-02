'use client';

import React, { useMemo, useState } from 'react';
import type { BatchItem, ERPLivestockData } from '@/lib/types';
import { batchCattle, batchSummary } from '@/lib/batch-stats';
import { forecast } from '@/lib/report-stats';
import { Input } from '@/components/ui/input';
import { NUM } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';
import { Tile, riel, signedRiel } from './parts';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? Math.round(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / DAY_MS) : null;
}

/** What a batch will earn if it is sold on a chosen day at a chosen price: the same sums as before, now opened from the batch itself. */
export default function Forecast({ batch, data, products }: { batch: BatchItem; data: ERPLivestockData; products: ERPLivestockData['feedProducts'] }) {
  const { tx } = useText('reportsPage');
  const summary = useMemo(() => batchSummary(batch, data.stock, data.weightTracking, products ?? []), [batch, data.stock, data.weightTracking, products]);
  const cattle = useMemo(() => batchCattle(batch, data.stock), [batch, data.stock]);
  const [sellBy, setSellBy] = useState(batch.sellingTargetDate ?? '');
  const [price, setPrice] = useState(batch.expectedSellingPrice ? String(batch.expectedSellingPrice) : '');
  const [gain, setGain] = useState(summary.perDay !== null && summary.perDay > 0 ? String(summary.perDay) : '');

  const sellDay = parseDay(sellBy);
  const todayDay = Math.round(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() / DAY_MS);
  const ready = sellDay !== null && Number(price) > 0 && Number(gain) > 0 && cattle.length > 0;

  const f = useMemo(() => {
    if (!ready) return null;
    const ids = new Set(cattle.map(c => c.id));
    return forecast({
      cattle,
      healthCost: data.healthLogs.filter(l => ids.has(l.cowId)).reduce((s, l) => s + (l.cost || 0), 0),
      feedCostPerDay: summary.feedCostPerDay,
      feedSoFar: (summary.daysIn ?? 0) * summary.feedCostPerDay,
      perDay: Number(gain),
      daysToSell: (sellDay as number) - todayDay,
      pricePerKg: Number(price),
    });
  }, [ready, cattle, data.healthLogs, summary, gain, sellDay, todayDay, price]);

  const missing = [sellDay === null ? tx('missSellDate') : '', !(Number(price) > 0) ? tx('missPrice') : '', !(Number(gain) > 0) ? tx('missGain') : ''].filter(Boolean);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 rounded-xl bg-white ring-1 ring-slate-200 p-4 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('sellOn')}</span><Input type="date" value={sellBy} onChange={e => setSellBy(e.target.value)} className="h-12 text-lg" /></label>
        <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('priceKg')}</span><Input type="number" step="any" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} className={`h-12 text-lg ${NUM}`} /></label>
        <label className="block">
          <span className="mb-1 block text-base font-medium text-ink">{tx('gainEach')}</span>
          <Input type="number" step="any" inputMode="decimal" value={gain} onChange={e => setGain(e.target.value)} className={`h-12 text-lg ${NUM}`} />
          <span className="mt-1 block text-sm text-ink-muted">{summary.perDay !== null ? tx('measured', { kg: summary.perDay }) : tx('notMeasured')}</span>
        </label>
      </section>

      {!f ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">
          {cattle.length === 0 ? tx('noCattle') : tx('fillIn', { list: missing.join(', ') })}
        </p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            <Tile label={tx('weightAtSale')} value={`${Math.round(f.avgFinal)} kg`} sub={tx('weightAtSaleSub', { kg: Math.round(f.avgNow) })} />
            <Tile label={tx('sales')} value={riel(f.revenue)} sub={tx('kgInAll', { kg: Math.round(f.totalKg).toLocaleString() })} />
            <Tile label={tx('profit')} value={signedRiel(f.profit)} sub={f.returnPct !== null ? tx('ofCost', { pct: f.returnPct }) : undefined} tone={f.profit < 0 ? 'bad' : 'good'} />
          </section>
          <dl className="rounded-xl bg-white ring-1 ring-slate-200 px-5">
            {[
              [tx('fBought'), f.purchase],
              [tx('fHealth'), f.healthCost],
              [tx('fFeedSoFar'), f.feedSoFar],
              [tx('fFeedToGo'), f.feedToGo],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 border-b border-slate-100 py-3"><dt className="text-base text-ink-muted">{k}</dt><dd className="text-base font-medium text-ink">{riel(v as number)}</dd></div>
            ))}
            <div className="flex justify-between gap-4 py-3"><dt className="text-lg font-medium text-ink">{tx('fTotal')}</dt><dd className="text-lg font-semibold text-ink">{riel(f.totalCost)}</dd></div>
          </dl>
          <p className="text-base text-ink-muted">{tx('fNote', { kg: Number(gain), days: (sellDay as number) - todayDay > 0 ? (sellDay as number) - todayDay : 0 })}</p>
        </>
      )}
    </div>
  );
}
