'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BatchItem, ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import { batchCattle, batchSummary } from '@/lib/batch-stats';
import { composition, forecast, monthlyMoney, type Share } from '@/lib/report-stats';
import { farmProfit, sumMonths } from '@/lib/farm-costs';
import { Input } from '@/components/ui/input';
import { NUM } from '../flow/FlowShell';
import { FarmSelect } from '@/components/ui/listbox-select';

interface ReportsPageProps {
  data: ERPLivestockData;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

type Tab = 'herd' | 'money' | 'batches' | 'forecast';
const TABS: { key: Tab; label: string }[] = [
  { key: 'herd', label: 'Herd' },
  { key: 'money', label: 'Money' },
  { key: 'batches', label: 'Batches' },
  { key: 'forecast', label: 'Forecast' },
];

// Chart colours were checked with the colour validator (colour-blind safe): Sold is leaf green, Bought is blue.
const SOLD = '#0E7A38';
const BOUGHT = '#2B6CB0';
const DAY_MS = 24 * 60 * 60 * 1000;
const SELECT = 'h-11 rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-ink focus:border-emerald-600 focus:outline-none';

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const r1 = (n: number) => Math.round(n * 10) / 10;
const signedRiel = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${riel(Math.abs(n))}`;

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

function Bars({ title, rows }: { title: string; rows: Share[] }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? <p className="text-base text-ink-muted">Nothing to show yet.</p> : (
        <ul className="space-y-3">
          {rows.slice(0, 8).map(r => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words text-base text-ink">{r.label}</span>
                <span className="shrink-0 text-base font-medium text-ink">{r.count} <span className="text-ink-muted">({r.pct}%)</span></span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: SOLD }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function parseDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? Math.round(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / DAY_MS) : null;
}

export default function ReportsPage({ data, currentUser, farms = [] }: ReportsPageProps) {
  const [tab, setTab] = useState<Tab>('herd');
  const [farm, setFarm] = useState('');
  const [batchId, setBatchId] = useState('');

  const showFarmFilter = !currentUser?.farmLocation && farms.length > 0;
  const effectiveFarm = currentUser?.farmLocation || farm;

  // Everything below works on the chosen farm only.
  const scoped = useMemo(() => {
    if (!effectiveFarm) return data;
    const stock = data.stock.filter(s => s.location === effectiveFarm);
    const ids = new Set(stock.map(s => s.id));
    return {
      ...data,
      stock,
      batches: data.batches.filter(b => b.farmLocation === effectiveFarm || b.cowIds?.some(id => ids.has(id))),
      weightTracking: data.weightTracking.filter(w => ids.has(w.cowId)),
      healthLogs: data.healthLogs.filter(h => ids.has(h.cowId)),
      salesTracking: data.salesTracking.filter(s => ids.has(s.cowId)),
    };
  }, [data, effectiveFarm]);

  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);
  const active = useMemo(() => scoped.stock.filter(c => norm(c.status) === 'active'), [scoped.stock]);
  const activeBatches = useMemo(() => scoped.batches.filter(b => b.status === 'Active'), [scoped.batches]);
  const summaries = useMemo(
    () => new Map(activeBatches.map(b => [b.id, batchSummary(b, scoped.stock, scoped.weightTracking, products)])),
    [activeBatches, scoped.stock, scoped.weightTracking, products]
  );

  const herd = useMemo(() => {
    const dead = scoped.stock.filter(c => norm(c.status) === 'dead' || norm(c.healthStatus) === 'dead').length;
    return {
      head: active.length,
      avgWeight: active.length ? active.reduce((s, c) => s + (c.weight || 0), 0) / active.length : 0,
      cost: active.reduce((s, c) => s + (c.totalPrice || 0), 0),
      dead,
      deadPct: scoped.stock.length ? (dead / scoped.stock.length) * 100 : 0,
      breeds: composition(active, c => c.breed),
      sexes: composition(active, c => c.sex),
      health: composition(active, c => c.healthStatus),
      origins: composition(active, c => c.purchaseType || c.buyType),
    };
  }, [active, scoped.stock]);

  const byFarm = useMemo(() => {
    const names = [...new Set(active.map(c => c.location).filter(Boolean))];
    return names.map(n => {
      const list = active.filter(c => c.location === n);
      return { name: n, head: list.length, avg: list.reduce((s, c) => s + (c.weight || 0), 0) / list.length };
    }).sort((a, b) => b.head - a.head);
  }, [active]);

  const months = useMemo(() => monthlyMoney(scoped.stock, scoped.salesTracking, scoped.healthLogs), [scoped.stock, scoped.salesTracking, scoped.healthLogs]);
  const last12 = months.slice(-12);
  const totals = useMemo(() => ({
    revenue: scoped.salesTracking.reduce((s, x) => s + (x.totalPrice || 0), 0),
    sold: scoped.salesTracking.length,
  }), [scoped.salesTracking]);
  const feedPerDay = [...summaries.values()].reduce((s, x) => s + x.feedCostPerDay, 0);

  // Farm profit: sales less what the sold cattle cost to buy and feed, medicine and running costs.
  const farmMoney = useMemo(() => farmProfit({
    stock: data.stock,
    sales: data.salesTracking,
    healthLogs: data.healthLogs,
    feedTransactions: data.feedTransactions || [],
    batches: data.batches,
    costs: data.farmCosts || [],
    farm: effectiveFarm || undefined,
  }), [data.stock, data.salesTracking, data.healthLogs, data.feedTransactions, data.batches, data.farmCosts, effectiveFarm]);
  const farmMonths = farmMoney.months;
  const farmTotals = useMemo(() => sumMonths(farmMonths), [farmMonths]);
  const farmCosts = farmTotals.cattleCost + farmTotals.medicine + farmTotals.feed + farmTotals.other;

  const forecastBatch = activeBatches.find(b => b.id === batchId) ?? activeBatches[0];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Reports</h2>
          <p className="text-base text-ink-muted">How the herd and the money are doing.</p>
        </div>
        {showFarmFilter && (
          <FarmSelect farms={farms.map(f => f.name)} value={farm} onChange={setFarm} size="compact" align="right" />
        )}
      </div>

      <div role="tablist" aria-label="Reports" className="flex rounded-xl bg-slate-100 p-1 sm:w-fit">
        {TABS.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-base font-medium sm:px-5 ${tab === t.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'herd' && (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Tile label="On the farm" value={String(herd.head)} sub="cattle" />
            <Tile label="Average weight" value={herd.head ? `${Math.round(herd.avgWeight)} kg` : '—'} />
            <Tile label="Herd cost" value={riel(herd.cost)} sub="paid for these cattle" />
            <Tile label="Lost" value={String(herd.dead)} sub={herd.dead ? `${r1(herd.deadPct)}% of all cattle` : 'No deaths'} tone={herd.dead > 0 ? 'bad' : undefined} />
          </section>

          {!effectiveFarm && byFarm.length > 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-lg font-semibold text-ink">By farm</h3>
              <ul className="divide-y divide-slate-100">
                {byFarm.map(f => (
                  <li key={f.name} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 break-words text-base text-ink">{f.name}</span>
                    <span className="shrink-0 text-base font-medium text-ink">{f.head} cattle · {Math.round(f.avg)} kg average</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Bars title="Breed" rows={herd.breeds} />
            <Bars title="Male and female" rows={herd.sexes} />
            <Bars title="Health" rows={herd.health} />
            <Bars title="Where they came from" rows={herd.origins} />
          </div>
        </div>
      )}

      {tab === 'money' && (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Tile label="Sales" value={riel(totals.revenue)} sub={`${totals.sold} sold`} />
            <Tile label="Costs" value={riel(farmCosts)} sub="of the cattle sold, plus running" />
            <Tile label="Farm profit" value={farmMonths.length ? signedRiel(farmTotals.profit) : '—'} sub="sales less all costs" tone={farmMonths.length ? (farmTotals.profit < 0 ? 'bad' : 'good') : undefined} />
            <Tile label="Feed in the herd" value={riel(farmMoney.feedInHerd)} sub={feedPerDay > 0 ? `eaten, not sold yet · ${riel(feedPerDay)} a day` : 'eaten, not sold yet'} />
          </section>

          {farmMonths.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-lg font-semibold text-ink">Where the money went</h3>
              <ul className="divide-y divide-slate-100">
                {[
                  { label: 'Cattle that were sold', hint: 'what they cost to buy', value: farmTotals.cattleCost },
                  { label: 'Feed they ate', hint: 'their share of the daily feed records', value: farmTotals.feed },
                  { label: 'Medicine', hint: 'from Health', value: farmTotals.medicine },
                  { label: 'Running costs', hint: 'wages, power, fuel and more, from Costs', value: farmTotals.other },
                ].map(r => (
                  <li key={r.label} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0"><span className="block text-base text-ink">{r.label}</span><span className="block text-sm text-ink-muted">{r.hint}</span></span>
                    <span className="shrink-0 text-base font-medium text-ink">{riel(r.value)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-muted">
                Feed counts when the animals that ate it are sold: each day&apos;s feed is shared evenly by the batch&apos;s animals that day. Feed eaten by cattle still on the farm ({riel(farmMoney.feedInHerd)}) is not a cost yet. Feed taken out by hand counts in the month it left the store. The Sales page shows the same profit per animal, before running costs.
              </p>
            </section>
          )}

          {last12.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <h3 className="mb-2 text-lg font-semibold text-ink">Bought and sold each month</h3>
              <div className="h-72" role="img" aria-label="Cattle bought and sold each month; profit by month is listed below the chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last12} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                    <YAxis width={52} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1_000_000 ? `${r1(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip formatter={(v, name) => [riel(Number(v)), String(name)]} />
                    <Legend wrapperStyle={{ fontSize: 14 }} />
                    <Bar dataKey="sold" name="Sold" fill={SOLD} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                    <Bar dataKey="bought" name="Bought" fill={BOUGHT} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {farmMonths.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Money by month appears once cattle are sold, or feed and other costs are recorded.</p>
          ) : (
            <section>
              <h3 className="mb-2 text-lg font-semibold text-ink">Farm profit each month</h3>
              <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {[...farmMonths].slice(-12).reverse().map(m => {
                  const spent = m.cattleCost + m.medicine + m.feed + m.other;
                  return (
                    <li key={m.month} className="border-b border-slate-100 px-4 py-3 last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-ink">{m.label}</p>
                          <p className="text-base text-ink-muted">Sold {riel(m.sales)}{m.soldCount ? ` (${m.soldCount})` : ''} · Costs {riel(spent)}</p>
                        </div>
                        <p className={`shrink-0 text-base font-medium ${m.profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{m.profit < 0 ? 'Loss' : 'Profit'} {riel(Math.abs(m.profit))}</p>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {[m.cattleCost && `Cattle ${riel(m.cattleCost)}`, m.feed && `Feed ${riel(m.feed)}`, m.medicine && `Medicine ${riel(m.medicine)}`, m.other && `Running ${riel(m.other)}`].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === 'batches' && (
        activeBatches.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No active batches. Start one under Batches.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeBatches.map(b => {
              const s = summaries.get(b.id)!;
              const perHead = s.head ? s.feedCostPerDay / s.head : 0;
              const perKgGained = s.perDay && s.perDay > 0 && perHead > 0 ? perHead / s.perDay : null;
              return (
                <li key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xl font-semibold text-ink">{b.name}</p>
                  <p className="text-base text-ink-muted">{[b.farmLocation, s.daysIn !== null ? `${s.daysIn} days in` : null].filter(Boolean).join(' · ')}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div><dt className="text-sm text-ink-muted">Cattle</dt><dd className="text-lg font-semibold text-ink">{s.head}</dd></div>
                    <div><dt className="text-sm text-ink-muted">Average weight</dt><dd className="text-lg font-semibold text-ink">{s.head ? `${Math.round(s.avgWeight)} kg` : '—'}</dd></div>
                    <div><dt className="text-sm text-ink-muted">Daily gain</dt><dd className="text-lg font-semibold text-ink">{s.perDay !== null ? `${s.perDay} kg` : '—'}</dd></div>
                    <div><dt className="text-sm text-ink-muted">Feed each animal</dt><dd className="text-lg font-semibold text-ink">{perHead > 0 ? `${riel(perHead)} a day` : '—'}</dd></div>
                  </dl>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-base text-ink">
                    {perKgGained !== null ? <>Each kg gained costs about <span className="font-semibold">{riel(perKgGained)}</span> in feed.</> : 'Cost per kg gained needs feeding and two weigh-ins.'}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'forecast' && (
        forecastBatch ? (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">Which batch?</span>
              <select aria-label="Batch" value={forecastBatch.id} onChange={e => setBatchId(e.target.value)} className={`${SELECT} w-full sm:w-auto`}>
                {activeBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {/* Keyed so each batch starts from its own plan. */}
            <Forecast key={forecastBatch.id} batch={forecastBatch} data={scoped} products={products} />
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">A forecast needs an active batch. Start one under Batches.</p>
        )
      )}
    </div>
  );
}

function Forecast({ batch, data, products }: { batch: BatchItem; data: ERPLivestockData; products: ERPLivestockData['feedProducts'] }) {
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

  const missing = [sellDay === null ? 'the sell date' : '', !(Number(price) > 0) ? 'the price for each kg' : '', !(Number(gain) > 0) ? 'the daily gain' : ''].filter(Boolean);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-base font-medium text-ink">Sell on</span><Input type="date" value={sellBy} onChange={e => setSellBy(e.target.value)} className="h-12 text-lg" /></label>
        <label className="block"><span className="mb-1 block text-base font-medium text-ink">Price for each kg (៛)</span><Input type="number" step="any" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} className={`h-12 text-lg ${NUM}`} /></label>
        <label className="block">
          <span className="mb-1 block text-base font-medium text-ink">Daily gain (kg each)</span>
          <Input type="number" step="any" inputMode="decimal" value={gain} onChange={e => setGain(e.target.value)} className={`h-12 text-lg ${NUM}`} />
          <span className="mt-1 block text-sm text-ink-muted">{summary.perDay !== null ? `Measured so far: ${summary.perDay} kg` : 'Not measured yet. Weigh the group twice.'}</span>
        </label>
      </section>

      {!f ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">
          {cattle.length === 0 ? 'This batch has no cattle yet.' : `Fill in ${missing.join(', ')} to see the forecast.`}
        </p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            <Tile label="Weight at sale" value={`${Math.round(f.avgFinal)} kg`} sub={`each, now ${Math.round(f.avgNow)} kg`} />
            <Tile label="Sales" value={riel(f.revenue)} sub={`${Math.round(f.totalKg).toLocaleString()} kg in all`} />
            <Tile label="Profit" value={signedRiel(f.profit)} sub={f.returnPct !== null ? `${f.returnPct}% of cost` : undefined} tone={f.profit < 0 ? 'bad' : 'good'} />
          </section>
          <dl className="rounded-2xl border border-slate-200 bg-white px-5">
            {[
              ['Cattle bought for', f.purchase],
              ['Health costs so far', f.healthCost],
              ['Feed so far (estimate)', f.feedSoFar],
              ['Feed until the sale', f.feedToGo],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 border-b border-slate-100 py-3"><dt className="text-base text-ink-muted">{k}</dt><dd className="text-base font-medium text-ink">{riel(v as number)}</dd></div>
            ))}
            <div className="flex justify-between gap-4 py-3"><dt className="text-lg font-medium text-ink">Total cost</dt><dd className="text-lg font-semibold text-ink">{riel(f.totalCost)}</dd></div>
          </dl>
          <p className="text-base text-ink-muted">A forecast, not a promise. It assumes {Number(gain)} kg a day for {(sellDay as number) - todayDay > 0 ? (sellDay as number) - todayDay : 0} more days, and today&apos;s feed cost.</p>
        </>
      )}
    </div>
  );
}
