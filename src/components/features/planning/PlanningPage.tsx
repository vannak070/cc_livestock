'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Input } from '@/components/ui/input';
import type { ProposalPlanParams } from '@/types';
import { DEFAULT_PLAN, calculatePlan, feedForPeriod } from '@/lib/proposal-plan';
import { getErrorMessage } from '@/lib/utils';
import { NUM } from '../flow/FlowShell';

interface PlanningPageProps {
  /** The last saved plan, if any; the standard plan is used otherwise. */
  initialPlan?: ProposalPlanParams;
  onSavePlan?: (params: ProposalPlanParams) => Promise<void>;
}

type Tab = 'overview' | 'months' | 'batches' | 'feed';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'months', label: 'Months' },
  { key: 'batches', label: 'Batches' },
  { key: 'feed', label: 'Feed' },
];

type Key = keyof ProposalPlanParams;
const GROUPS: { title: string; fields: { key: Key; label: string; unit: string; step?: string }[] }[] = [
  { title: 'The herd', fields: [
    { key: 'targetStockLevel', label: 'Cattle to keep', unit: 'head' },
    { key: 'fatteningPeriodDays', label: 'Days fattening each animal', unit: 'days' },
    { key: 'numberOfBatches', label: 'Batches in the plan', unit: 'batches' },
    { key: 'cattlePerBatch', label: 'Cattle in each batch', unit: 'head' },
  ] },
  { title: 'Each animal', fields: [
    { key: 'initialWeightKg', label: 'Weight when bought', unit: 'kg' },
    { key: 'dailyWeightGainKg', label: 'Gain each day', unit: 'kg', step: '0.05' },
  ] },
  { title: 'Prices', fields: [
    { key: 'purchasePricePerKgKhr', label: 'Buy price for each kg', unit: '៛' },
    { key: 'sellingPricePerKgKhr', label: 'Sell price for each kg', unit: '៛' },
  ] },
  { title: 'Feed', fields: [
    { key: 'grassKgPerHeadDay', label: 'Grass for each animal each day', unit: 'kg' },
    { key: 'grassCostPerKgKhr', label: 'Grass price for each kg', unit: '៛' },
    { key: 'concentrateKgPerHeadDay', label: 'Concentrate for each animal each day', unit: 'kg' },
    { key: 'concentrateCostPerKgKhr', label: 'Concentrate price for each kg', unit: '៛' },
  ] },
  { title: 'Money', fields: [
    { key: 'bankInterestRateAnnual', label: 'Bank interest', unit: '% a year', step: '0.1' },
  ] },
];

// Chart colours were checked with the colour validator (colour-blind safe): Sales is leaf green, Costs is blue.
const SALES = '#0E7A38';
const COSTS = '#2B6CB0';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const signedRiel = (n: number) => `${n < 0 ? '−' : ''}${riel(Math.abs(n))}`;
const mil = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : `${Math.round(v / 1000)}k`);
const SELECT_INPUT = 'h-12 text-lg';

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  const style = tone === 'bad' ? 'border-rose-300 bg-rose-50' : tone === 'good' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${style}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

function Rows({ rows, total }: { rows: [string, string][]; total?: [string, string, boolean?] }) {
  return (
    <dl className="rounded-2xl border border-slate-200 bg-white px-5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-3 last:border-0"><dt className="text-base text-ink-muted">{k}</dt><dd className="text-base font-medium text-ink">{v}</dd></div>
      ))}
      {total && (
        <div className="flex justify-between gap-4 border-t border-slate-200 py-3"><dt className="text-lg font-medium text-ink">{total[0]}</dt><dd className={`text-lg font-semibold ${total[2] ? 'text-rose-700' : 'text-emerald-800'}`}>{total[1]}</dd></div>
      )}
    </dl>
  );
}

const toFields = (p: ProposalPlanParams): Record<Key, string> =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Record<Key, string>;

export default function PlanningPage({ initialPlan, onSavePlan }: PlanningPageProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [fields, setFields] = useState<Record<Key, string>>(() => toFields({ ...DEFAULT_PLAN, ...(initialPlan || {}) }));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedHead, setFeedHead] = useState('');
  const [feedDays, setFeedDays] = useState('30');

  const params = useMemo<ProposalPlanParams>(
    () => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Number(v) || 0])) as unknown as ProposalPlanParams,
    [fields]
  );
  const r = useMemo(() => calculatePlan(params), [params]);
  const feed = useMemo(() => feedForPeriod(params, Number(feedHead) || params.targetStockLevel, Number(feedDays) || 0), [params, feedHead, feedDays]);

  const set = (key: Key, value: string) => { setFields(f => ({ ...f, [key]: value })); setSavedAt(null); };

  const save = async () => {
    if (!onSavePlan) return;
    setSaving(true);
    setError('');
    try {
      await onSavePlan(params);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(getErrorMessage(e, 'Could not save the plan.'));
    } finally {
      setSaving(false);
    }
  };

  const mismatch = params.numberOfBatches * params.cattlePerBatch !== params.targetStockLevel;
  const chart = r.months.map(m => ({ label: `M${m.month}`, Sales: m.revenueKhr, Costs: m.totalCostKhr }));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Planning</h2>
          <p className="text-base text-ink-muted">Try a fattening plan and see what it earns. It does not change your real herd.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfirmReset(true)}><RotateCcw /> Standard plan</Button>
          {onSavePlan && <Button size="lg" onClick={save} disabled={saving}><Save /> {saving ? 'Saving…' : 'Save plan'}</Button>}
        </div>
      </div>
      {(savedAt || error) && <p role={error ? 'alert' : 'status'} className={`text-base font-medium ${error ? 'text-rose-700' : 'text-emerald-800'}`}>{error || `Plan saved at ${savedAt}.`}</p>}

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label="Profit each year" value={signedRiel(r.annualProfitKhr)} sub="once the herd is full" tone={r.annualProfitKhr < 0 ? 'bad' : 'good'} />
        <Tile label="Profit each animal" value={signedRiel(r.profitPerHeadKhr)} sub={`${Math.round(r.marginPerHeadPercent * 10) / 10}% of the sale price`} tone={r.profitPerHeadKhr < 0 ? 'bad' : undefined} />
        <Tile label="Money to start" value={riel(r.initialCattlePurchaseKhr)} sub={`to buy ${r.totalCattle.toLocaleString()} cattle`} />
        <Tile label="Return each year" value={`${Math.round(r.annualRoiPercent * 10) / 10}%`} sub="profit over the money to start" tone={r.annualRoiPercent < 0 ? 'bad' : undefined} />
      </section>

      <details open className="group rounded-2xl border border-slate-200 bg-white">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 text-lg font-semibold text-ink">
          <span>The plan</span>
          <span className="text-base font-normal text-ink-muted group-open:hidden">Tap to change the numbers</span>
        </summary>
        <div className="grid grid-cols-1 gap-6 border-t border-slate-100 p-4 md:grid-cols-2">
          {GROUPS.map(g => (
            <fieldset key={g.title} className="space-y-3">
              <legend className="mb-1 text-lg font-semibold text-ink">{g.title}</legend>
              {g.fields.map(f => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-base text-ink">{f.label}</span>
                  <div className="flex items-center gap-2">
                    <Input type="number" inputMode="decimal" step={f.step} value={fields[f.key]} onChange={e => set(f.key, e.target.value)} className={`${SELECT_INPUT} ${NUM}`} />
                    <span className="w-16 shrink-0 text-base text-ink-muted">{f.unit}</span>
                  </div>
                </label>
              ))}
              {g.title === 'The herd' && mismatch && (
                <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">{params.numberOfBatches} batches of {params.cattlePerBatch} is {(params.numberOfBatches * params.cattlePerBatch).toLocaleString()} cattle, but you keep {params.targetStockLevel.toLocaleString()}. The Batches tab uses the batch numbers; everything else uses the herd size.</p>
              )}
              {g.title === 'Each animal' && <p className="text-base text-ink-muted">Weight when sold: <span className="font-semibold text-ink">{Math.round(r.finalWeightKgPerHead)} kg</span></p>}
              {g.title === 'Prices' && <p className="text-base text-ink-muted">Buy {riel(r.purchasePricePerHeadKhr)} · sell {riel(r.sellingPricePerHeadKhr)} for each animal</p>}
              {g.title === 'Feed' && <p className="text-base text-ink-muted">Feed for one animal for the whole time: <span className="font-semibold text-ink">{riel(r.perHeadFeedCostKhr)}</span></p>}
            </fieldset>
          ))}
        </div>
      </details>

      <div role="tablist" aria-label="Plan results" className="flex rounded-xl bg-slate-100 p-1 sm:w-fit">
        {TABS.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-base font-medium sm:px-5 ${tab === t.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-ink">One animal</h3>
            <Rows
              rows={[
                ['Sells for', riel(r.sellingPricePerHeadKhr)],
                ['Bought for', riel(r.purchasePricePerHeadKhr)],
                ['Grass', riel(r.perHeadGrassCostKhr)],
                ['Concentrate', riel(r.perHeadConcentrateCostKhr)],
                ['Bank interest', riel(r.interestPerHeadKhr)],
                ['Total cost', riel(r.costPerHeadKhr)],
              ]}
              total={['Profit', signedRiel(r.profitPerHeadKhr), r.profitPerHeadKhr < 0]}
            />
          </section>
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-ink">One year, herd full</h3>
            <Rows
              rows={[
                ['Sales', riel(r.annualSalesRevenueKhr)],
                ['Cattle bought', riel(r.annualCattlePurchasesKhr)],
                ['Grass', riel(r.annualGrassCostKhr)],
                ['Concentrate', riel(r.annualConcentrateCostKhr)],
                ['Bank interest', riel(r.annualBankInterestKhr)],
                ['Total cost', riel(r.annualTotalCostKhr)],
              ]}
              total={['Profit', signedRiel(r.annualProfitKhr), r.annualProfitKhr < 0]}
            />
            <p className="text-base text-ink-muted">About {r.monthlyBatchQty.toLocaleString()} animals are bought and sold each month, and each stays {params.fatteningPeriodDays} days.</p>
          </section>
        </div>
      )}

      {tab === 'months' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <h3 className="mb-2 text-lg font-semibold text-ink">Sales and costs, first 12 months</h3>
            <div className="h-72" role="img" aria-label="Sales and costs for each of the first 12 months; the same numbers are listed below">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                  <YAxis width={56} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={mil} />
                  <Tooltip formatter={(v, name) => [riel(Number(v)), String(name)]} />
                  <Legend wrapperStyle={{ fontSize: 14 }} />
                  <Bar dataKey="Sales" fill={SALES} radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={false} />
                  <Bar dataKey="Costs" fill={COSTS} radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {r.months.map(m => (
              <li key={m.month} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-lg font-semibold text-ink">Month {m.month}</p>
                  <p className={`text-lg font-semibold ${m.netProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{m.netProfitKhr < 0 ? 'Loss' : 'Profit'} {riel(Math.abs(m.netProfitKhr))}</p>
                </div>
                <p className="text-base text-ink-muted">{m.closingStock} on the farm · {m.purchaseQty} bought · {m.salesQty} sold</p>
                <p className="mt-1 text-base text-ink">Sales {riel(m.revenueKhr)} · Costs {riel(m.totalCostKhr)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'batches' && (
        r.batches.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Set the number of batches under The plan.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {r.batches.map(b => (
              <li key={b.no} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xl font-semibold text-ink">Batch {b.no}</p>
                  <p className={`text-lg font-semibold ${b.netProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{b.netProfitKhr < 0 ? 'Loss' : 'Profit'} {riel(Math.abs(b.netProfitKhr))}</p>
                </div>
                <p className="text-base text-ink-muted">{b.cattleCount} cattle · bought month {b.purchaseMonth} · sold month {b.saleMonth}</p>
                <p className="mt-1 text-base text-ink">Costs {riel(b.totalCostKhr)} · Sales {riel(b.revenueKhr)}</p>
                <p className="text-base text-ink-muted">Needs {Math.round(b.grassReqKg).toLocaleString()} kg grass and {Math.round(b.concentrateReqKg).toLocaleString()} kg concentrate</p>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'feed' && (
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-base font-medium text-ink">How many animals?</span><Input type="number" inputMode="numeric" value={feedHead} placeholder={String(params.targetStockLevel)} onChange={e => setFeedHead(e.target.value)} className={`${SELECT_INPUT} ${NUM}`} /></label>
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">For how many days?</span>
              <Input type="number" inputMode="numeric" value={feedDays} onChange={e => setFeedDays(e.target.value)} className={`${SELECT_INPUT} ${NUM}`} />
            </label>
          </section>
          <Rows
            rows={[
              ['Grass', `${Math.round(feed.grassKg).toLocaleString()} kg · ${riel(feed.grassCostKhr)}`],
              ['Concentrate', `${Math.round(feed.concentrateKg).toLocaleString()} kg · ${riel(feed.concentrateCostKhr)}`],
            ]}
            total={['Feed cost', riel(feed.totalCostKhr)]}
          />
        </div>
      )}

      {confirmReset && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmReset(false)}
          onConfirm={() => { setFields(toFields({ ...DEFAULT_PLAN })); setFeedHead(''); setFeedDays('30'); setSavedAt(null); }}
          title="Go back to the standard plan?"
          description="This puts every number back to the standard plan (400 cattle, 120 days, 1.25 kg a day). Your saved plan is not changed until you press Save plan."
          type="warning"
          confirmText="Use standard plan"
        />
      )}
    </div>
  );
}
