'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ERPLivestockData } from '@/lib/types';
import { batchSummary } from '@/lib/batch-stats';
import { composition } from '@/lib/report-stats';
import { useText } from '@/hooks/useText';
import Forecast from './Forecast';
import { Bars, Tile, norm, r1, riel } from './parts';

/**
 * Reports → Cattle: who is on the farm (breed, sex, health, where they came from), then each active batch.
 * "Forecast" opens under a batch: what it earns if sold on a day at a price (it used to be a tab of its own).
 */
export default function CattleReport({ data, farm }: { data: ERPLivestockData; farm: string }) {
  const { tx } = useText('reportsPage');
  const [forecastId, setForecastId] = useState<string | null>(null);
  const forecastRef = useRef<HTMLDivElement>(null);

  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);
  const active = useMemo(() => data.stock.filter(c => norm(c.status) === 'active'), [data.stock]);
  const activeBatches = useMemo(() => data.batches.filter(b => b.status === 'Active'), [data.batches]);
  const summaries = useMemo(
    () => new Map(activeBatches.map(b => [b.id, batchSummary(b, data.stock, data.weightTracking, products)])),
    [activeBatches, data.stock, data.weightTracking, products]
  );

  const herd = useMemo(() => {
    const dead = data.stock.filter(c => norm(c.status) === 'dead' || norm(c.healthStatus) === 'dead').length;
    return {
      head: active.length,
      avgWeight: active.length ? active.reduce((s, c) => s + (c.weight || 0), 0) / active.length : 0,
      cost: active.reduce((s, c) => s + (c.totalPrice || 0), 0),
      dead,
      deadPct: data.stock.length ? (dead / data.stock.length) * 100 : 0,
      breeds: composition(active, c => c.breed),
      sexes: composition(active, c => c.sex),
      health: composition(active, c => c.healthStatus),
      origins: composition(active, c => c.purchaseType || c.buyType),
    };
  }, [active, data.stock]);

  const byFarm = useMemo(() => {
    const names = [...new Set(active.map(c => c.location).filter(Boolean))];
    return names.map(n => {
      const list = active.filter(c => c.location === n);
      return { name: n, head: list.length, avg: list.reduce((s, c) => s + (c.weight || 0), 0) / list.length };
    }).sort((a, b) => b.head - a.head);
  }, [active]);

  const forecastBatch = activeBatches.find(b => b.id === forecastId);
  const openForecast = (id: string) => {
    setForecastId(id);
    // After the panel is drawn, bring it into view (on a phone it opens below the cards).
    requestAnimationFrame(() => forecastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="rep-herd">
        <h3 id="rep-herd" className="text-xl font-semibold text-ink">{tx('herdTitle')}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Tile label={tx('onFarm')} value={String(herd.head)} sub={tx('cattle')} />
          <Tile label={tx('avgWeight')} value={herd.head ? `${Math.round(herd.avgWeight)} kg` : '—'} />
          <Tile label={tx('herdCost')} value={riel(herd.cost)} sub={tx('herdCostSub')} />
          <Tile label={tx('lost')} value={String(herd.dead)} sub={herd.dead ? tx('lostSub', { pct: r1(herd.deadPct) }) : tx('noDeaths')} tone={herd.dead > 0 ? 'bad' : undefined} />
        </div>

        {!farm && byFarm.length > 1 && (
          <section className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
            <h4 className="mb-2 text-lg font-semibold text-ink">{tx('byFarm')}</h4>
            <ul className="divide-y divide-slate-100">
              {byFarm.map(f => (
                <li key={f.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 break-words text-base text-ink">{f.name}</span>
                  <span className="shrink-0 text-base font-medium text-ink">{tx('byFarmLine', { n: f.head, kg: Math.round(f.avg) })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Bars title={tx('breed')} rows={herd.breeds} />
          <Bars title={tx('maleFemale')} rows={herd.sexes} />
          <Bars title={tx('health')} rows={herd.health} />
          <Bars title={tx('origin')} rows={herd.origins} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="rep-batches">
        <h3 id="rep-batches" className="text-xl font-semibold text-ink">{tx('batchesTitle')}</h3>
        {activeBatches.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('noBatches')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeBatches.map(b => {
              const s = summaries.get(b.id)!;
              const perHead = s.head ? s.feedCostPerDay / s.head : 0;
              const perKgGained = s.perDay && s.perDay > 0 && perHead > 0 ? perHead / s.perDay : null;
              const open = forecastId === b.id;
              return (
                <li key={b.id} className={`rounded-2xl border bg-white p-4 ${open ? 'border-emerald-600' : 'border-slate-200'}`}>
                  <p className="text-xl font-semibold text-ink">{b.name}</p>
                  <p className="text-base text-ink-muted">{[b.farmLocation, s.daysIn !== null ? tx('daysIn', { n: s.daysIn }) : null].filter(Boolean).join(' · ')}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div><dt className="text-sm text-ink-muted">{tx('cattleLabel')}</dt><dd className="text-lg font-semibold text-ink">{s.head}</dd></div>
                    <div><dt className="text-sm text-ink-muted">{tx('avgWeight')}</dt><dd className="text-lg font-semibold text-ink">{s.head ? `${Math.round(s.avgWeight)} kg` : '—'}</dd></div>
                    <div><dt className="text-sm text-ink-muted">{tx('dailyGain')}</dt><dd className="text-lg font-semibold text-ink">{s.perDay !== null ? `${s.perDay} kg` : '—'}</dd></div>
                    <div><dt className="text-sm text-ink-muted">{tx('feedEach')}</dt><dd className="text-lg font-semibold text-ink">{perHead > 0 ? tx('aDay', { amount: riel(perHead) }) : '—'}</dd></div>
                  </dl>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-base text-ink">
                    {perKgGained !== null ? tx('kgGainCost', { amount: riel(perKgGained) }) : tx('kgGainNeeds')}
                  </p>
                  <Button className="mt-3 min-h-11" variant={open ? 'default' : 'outline'} aria-expanded={open} onClick={() => (open ? setForecastId(null) : openForecast(b.id))}>
                    {open ? tx('hideForecast') : tx('showForecast')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {forecastBatch && (
          <div ref={forecastRef} className="scroll-mt-4 space-y-3 rounded-2xl border-2 border-emerald-600 bg-white p-4">
            <h4 className="text-lg font-semibold text-ink">{tx('forecastFor', { name: forecastBatch.name })}</h4>
            {/* Keyed so each batch starts from its own plan. */}
            <Forecast key={forecastBatch.id} batch={forecastBatch} data={data} products={products} />
          </div>
        )}
      </section>
    </div>
  );
}
