'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cowTrail, filterTrails, type CowFilter, type CowTrail } from '@/lib/camcow-trail';
import type { Holding } from '@/lib/camcow-stock';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import type { BatchItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const kg = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('en-US')} kg`;
const MAX_ROWS = 100;
const STATUS_STYLE = { Held: 'bg-sky-50 text-sky-800', Sold: 'bg-emerald-50 text-emerald-800', Lost: 'bg-rose-50 text-rose-800' } as const;

interface Props {
  holdings: Holding[];
  stock: StockItem[];
  batches: BatchItem[];
  today: string;
  /** Each animal's share of the holding costs. */
  costOf: Map<string, number>;
  /** Show only these animals (a lot, or one buyer's sale), with a label saying where they came from. */
  only?: { ids: string[]; label: string };
  onClearOnly: () => void;
}

/** Every animal in CamCow stock, one row each; a row opens the animal's whole trail from collection to sale or loss. */
export default function CamcowCattle({ holdings, stock, batches, today, costOf, only, onClearOnly }: Props) {
  const { tx, language } = useText('camcowStock');
  const [status, setStatus] = useState<CowFilter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const trails = useMemo(() => holdings.map(h => cowTrail(h, today, costOf.get(h.cowId) ?? 0)).sort((a, b) => b.collectedOn.localeCompare(a.collectedOn) || a.cowId.localeCompare(b.cowId)), [holdings, today, costOf]);
  const onlySet = useMemo(() => (only ? new Set(only.ids) : undefined), [only]);
  const rows = useMemo(() => filterTrails(trails, { status, search, only: onlySet }), [trails, status, search, onlySet]);
  const stockOf = useMemo(() => new Map(stock.map(c => [c.id, c])), [stock]);
  const batchName = (id?: string) => (id ? batches.find(b => b.id === id)?.name ?? id : '—');
  const open = openId ? trails.find(t => t.cowId === openId) : undefined;
  const FILTERS: CowFilter[] = ['all', 'Held', 'Sold', 'Lost'];
  const fLabel = (f: CowFilter) => tx(f === 'all' ? 'fAll' : f === 'Held' ? 'fHeld' : f === 'Sold' ? 'fSold' : 'fLost');

  return (
    <div className="space-y-4">
      <div className="max-w-3xl">
        <h3 className="text-xl font-semibold text-ink">{tx('cattleTitle')}</h3>
        <p className="text-base text-ink-muted">{tx('cattleHint')}</p>
      </div>
      {only && (
        <p className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-3 text-base text-emerald-900">
          <span>{tx('onlyShowing', { n: only.ids.length, label: only.label })}</span>
          <button type="button" className="font-medium underline" onClick={onClearOnly}>{tx('onlyClear')}</button>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" aria-label={tx('searchCattle')} placeholder={tx('searchCattle')} className="min-h-11 max-w-xs text-base" value={search} onChange={e => setSearch(e.target.value)} />
        <div role="group" aria-label={tx('cattleTitle')} className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {FILTERS.map(f => (
            <button key={f} type="button" aria-pressed={status === f} onClick={() => setStatus(f)} className={`min-h-9 rounded-lg px-3 text-sm font-medium ${status === f ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>{fLabel(f)}</button>
          ))}
        </div>
      </div>

      <section className="rounded-xl bg-white ring-1 ring-slate-200" aria-label={tx('cattleTitle')}>
        {rows.length === 0 ? <p className="px-4 py-5 text-base text-ink-muted">{tx('cattleEmpty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-3 py-2 font-medium">{tx('colTag')}</th><th className="px-3 py-2 font-medium">{tx('colFarm')}</th><th className="px-3 py-2 font-medium">{tx('colStatus2')}</th>
                <th className="px-3 py-2 font-medium">{tx('colCollected')}</th><th className="px-3 py-2 text-right font-medium">{tx('colCost')}</th><th className="px-3 py-2 font-medium">{tx('colBuyer')}</th>
                <th className="px-3 py-2 text-right font-medium">{tx('marginAfterTitle')}</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, MAX_ROWS).map(t => (
                  <tr key={t.cowId} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2"><button type="button" className="font-semibold text-emerald-800 underline" onClick={() => setOpenId(t.cowId)}>{t.cowId}</button></td>
                    <td className="px-3 py-2">{t.farm}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{tx(`st${t.status}`)}</span></td>
                    <td className="px-3 py-2 whitespace-nowrap">{shownDay(t.collectedOn, language)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{riel(t.collectionTotal)}</td>
                    <td className="px-3 py-2">{t.buyer ?? '—'}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${t.marginAfterCosts === undefined ? '' : t.marginAfterCosts < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>{t.marginAfterCosts === undefined ? '—' : riel(t.marginAfterCosts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > MAX_ROWS && <p className="px-3 py-2 text-sm text-ink-muted">{tx('cattleMore', { n: MAX_ROWS, total: rows.length })}</p>}
          </div>
        )}
      </section>

      {open && <TrailDialog t={open} item={stockOf.get(open.cowId)} batch={batchName(open.batchId)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function TrailDialog({ t, item, batch, onClose }: { t: CowTrail; item?: StockItem; batch: string; onClose: () => void }) {
  const { tx, language } = useText('camcowStock');
  const day = (d?: string) => (d ? shownDay(d, language) : '—');
  const facts = [item?.breed, item?.sex, item?.age].filter(Boolean).join(' · ');
  const steps: { key: string; title: string; line: string; tone: string }[] = [
    { key: 'c', title: tx('stepCollected'), line: tx('stepCollectedLine', { day: day(t.collectedOn), kg: kg(t.collectionWeight), total: riel(t.collectionTotal), perKg: riel(t.collectionPerKg) }), tone: 'bg-slate-400' },
    t.status === 'Held'
      ? { key: 'h', title: tx('stepHeld'), line: tx('stepHeldLine', { n: t.daysHeld }), tone: 'bg-sky-500' }
      : { key: 'h', title: tx('stepHeld'), line: tx('stepHeldDone', { n: t.daysHeld }), tone: 'bg-sky-500' },
    ...(t.status === 'Sold' ? [{ key: 's', title: tx('stepSold', { buyer: t.buyer ?? '' }), line: tx('stepSoldLine', { day: day(t.soldOn), kg: kg(t.saleWeight ?? 0), perKg: riel(t.salePerKg ?? 0), total: riel(t.saleTotal ?? 0) }), tone: 'bg-emerald-600' }] : []),
    ...(t.status === 'Lost' ? [{ key: 'l', title: tx('stepLost'), line: tx('stepLostLine', { day: day(t.lostOn), cost: riel(t.collectionTotal) }), tone: 'bg-rose-600' }] : []),
  ];
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx('trailTitle', { id: t.cowId })}</DialogTitle>
          <DialogDescription>{tx('trailSub', { farm: t.farm, batch })}{facts ? ` · ${facts}` : ''}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3" aria-label={tx('trailTitle', { id: t.cowId })}>
          {steps.map(s => (
            <li key={s.key} className="flex gap-3">
              <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${s.tone}`} aria-hidden />
              <span><span className="block text-base font-semibold text-ink">{s.title}</span><span className="block text-base text-ink-muted">{s.line}</span></span>
            </li>
          ))}
        </ol>
        {t.status !== 'Held' && t.margin !== undefined && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm text-ink-muted">{t.status === 'Lost' ? tx('lossAfterTitle') : tx('marginAfterTitle')}</p>
              <p className={`text-lg font-semibold tabular-nums ${(t.marginAfterCosts ?? 0) < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>{riel(t.marginAfterCosts ?? t.margin)}</p>
              <p className="text-sm text-ink-muted">{t.status === 'Sold' ? `${tx('marginTitle')}: ${riel(t.margin)} (${tx('marginPerKg', { n: riel(t.marginPerKg ?? 0) })})` : `${tx('lossTitle')}: ${riel(t.margin)}`}</p>
            </div>
            {t.status === 'Sold' && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-ink-muted">{tx('gained')}</p>
                <p className="text-lg font-semibold tabular-nums text-ink">{(t.weightChange ?? 0) > 0 ? '+' : ''}{kg(t.weightChange ?? 0)}</p>
              </div>
            )}
          </div>
        )}
        {t.holdingCost > 0 && <p className="text-base text-ink-muted">{tx('holdingCostLine')}: <b className="text-ink">{riel(t.holdingCost)}</b></p>}
        {t.note && <p className="text-base text-ink-muted">{tx('notePrefix')}: {t.note}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>{tx('close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
