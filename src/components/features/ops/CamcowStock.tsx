'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { markCamcowCattleLostAction, receiveCamcowCattleAction, sellCamcowCattleAction } from '@/app/actions';
import { canManageCamcowStock, heldLots, saleProblem, soldLots, summarizeStock, waitingGroups, waitingToReceive, HELD_ALERT_DAYS, type Holding } from '@/lib/camcow-stock';
import { farmToday } from '@/lib/daily-feed';
import { shownDay } from '@/lib/khmer-date';
import { getErrorMessage } from '@/lib/utils';
import { useCamcowStock } from '@/hooks/useCamcowStock';
import { useText } from '@/hooks/useText';
import type { BatchItem, UserRoleItem } from '@/lib/types';
import type { SalesRecord, StockItem } from '@/lib/xlsx-parser';
import { Tile } from '../reports/parts';
import CamcowBuyers, { BuyerDialog } from './CamcowBuyers';
import CamcowCattle from './CamcowCattle';
import CamcowCosts from './CamcowCosts';
import { shareCosts } from '@/lib/camcow-costs';
import { Download } from 'lucide-react';
import { exportCamcowStock } from '@/lib/camcow-export';
import type { Buyer } from '@/lib/camcow-buyers';

interface Props {
  currentUser: UserRoleItem;
  stock: StockItem[];
  sales: SalesRecord[];
  batches: BatchItem[];
}

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const mil = (n: number) => `${(n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M ៛`;

/**
 * CamCow stock: cattle CC Livestock holds after collecting them from farms. Collected cattle wait to be received, are held
 * in lots, and are sold on to a buyer by scale (or marked lost). Super Admin and Admin change it; Management reads.
 */
export default function CamcowStock({ currentUser, stock, sales, batches }: Props) {
  const { tx, language } = useText('camcowStock');
  const queryClient = useQueryClient();
  const writer = canManageCamcowStock(currentUser);
  const query = useCamcowStock();
  const today = farmToday();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | 'sell' | 'lost'>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<'stock' | 'buyers' | 'cattle' | 'costs'>('stock');
  const [only, setOnly] = useState<{ ids: string[]; label: string } | undefined>(undefined);

  const holdings = query.data?.holdings;
  const batchOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of batches) for (const id of b.cowIds ?? []) if (!m.has(id)) m.set(id, b.id);
    return m;
  }, [batches]);
  const waiting = useMemo(() => (holdings ? waitingToReceive(stock, sales, holdings, id => batchOf.get(id)) : []), [holdings, stock, sales, batchOf]);
  const groups = useMemo(() => waitingGroups(waiting), [waiting]);
  const lots = useMemo(() => (holdings ? heldLots(holdings, today) : []), [holdings, today]);
  const costs = query.data?.costs;
  const costShare = useMemo(() => shareCosts(holdings ?? [], costs ?? []), [holdings, costs]);
  const sum = useMemo(() => (holdings ? summarizeStock(holdings, today, today.slice(0, 7), today.slice(0, 7), costShare.perCow) : null), [holdings, today, costShare]);
  const soldRows = useMemo(() => soldLots(holdings ?? []), [holdings]);
  const buyers = query.data?.buyers ?? [];
  const seeCattle = (ids: string[], label: string) => { setOnly({ ids, label }); setView('cattle'); };
  const byId = useMemo(() => new Map((holdings ?? []).map(h => [h.cowId, h])), [holdings]);
  const batchName = (id?: string) => (id ? batches.find(b => b.id === id)?.name ?? id : '—');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['camcow-stock'] });

  if (query.isLoading) return <p className="text-lg text-ink-muted" role="status">{tx('loading')}</p>;
  if (query.isError || !holdings || !sum) {
    return (
      <div className="space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{getErrorMessage(query.error, tx('loadFailed'))}</p>
        <Button onClick={() => query.refetch()}>{tx('retry')}</Button>
      </div>
    );
  }

  const receive = async (cowIds: string[]) => {
    setBusy(true); setMessage(null);
    const res = await receiveCamcowCattleAction(cowIds);
    setBusy(false);
    if (!res.success) { setMessage({ kind: 'error', text: res.error }); return; }
    setMessage({ kind: 'ok', text: tx('received', { n: res.data.received }) });
    refresh();
  };
  const toggle = (ids: string[], on: boolean) => setChosen(prev => { const next = new Set(prev); ids.forEach(id => (on ? next.add(id) : next.delete(id))); return next; });
  const chosenIds = [...chosen].filter(id => byId.get(id)?.status === 'Held');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-xl font-semibold text-ink">{tx('title')}</h3>
          <p className="text-base text-ink-muted">{tx('hint')}</p>
        </div>
        <Button variant="outline" className="min-h-11" disabled={exporting} onClick={async () => { setExporting(true); try { await exportCamcowStock(holdings, buyers, costs ?? [], today, batchName); } catch (e) { setMessage({ kind: 'error', text: getErrorMessage(e, tx('exportFailed')) }); } finally { setExporting(false); } }}><Download className="h-5 w-5" aria-hidden /> {tx('exportExcel')}</Button>
      </div>

      <div role="group" aria-label={tx('title')} className="flex w-fit rounded-xl bg-slate-100 p-1">
        {(['stock', 'buyers', 'cattle', 'costs'] as const).map(v => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => { if (v !== 'cattle') setOnly(undefined); setView(v); }}
            className={`min-h-10 rounded-lg px-4 text-base font-medium ${view === v ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {v === 'stock' ? tx('viewStock') : v === 'buyers' ? tx('viewBuyers') : v === 'cattle' ? tx('viewCattle') : tx('viewCosts')}
          </button>
        ))}
      </div>

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-xl p-3 text-base ${message.kind === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900'}`}>{message.text}</p>}

      {view === 'costs' && <CamcowCosts holdings={holdings} costs={costs ?? []} today={today} writer={writer} onChanged={text => { setMessage({ kind: 'ok', text }); refresh(); }} />}

      {view === 'cattle' && <CamcowCattle costOf={costShare.perCow} holdings={holdings} stock={stock} batches={batches} today={today} only={only} onClearOnly={() => setOnly(undefined)} />}

      {view === 'buyers' && <CamcowBuyers onSeeCattle={seeCattle} holdings={holdings} buyers={buyers} writer={writer} onChanged={text => { if (text) setMessage({ kind: 'ok', text }); refresh(); }} />}

      {view === 'stock' && <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={tx('title')}>
        <Tile label={tx('tInStock')} value={String(sum.held)} sub={tx('tInStockSub', { kg: Math.round(sum.heldKg).toLocaleString('en-US'), cost: mil(sum.heldCost) })} />
        <Tile label={tx('tDays')} value={String(sum.avgDaysHeld)} sub={sum.held ? tx('tDaysSub', { n: sum.oldestDaysHeld }) : undefined} />
        <Tile label={tx('tTooLong', { n: HELD_ALERT_DAYS })} value={String(sum.heldTooLong)} tone={sum.heldTooLong > 0 ? 'warn' : undefined} />
        <Tile label={tx('tSold')} value={String(sum.sold)} sub={tx('tSoldSub', { amount: mil(sum.soldRevenue) })} />
        <Tile label={tx('tMargin')} value={sum.sold ? mil(sum.marginAfterCosts) : '—'} sub={sum.soldCost > 0 ? tx('tMarginAfter', { cost: mil(sum.soldCost) }) : tx('tMarginSub')} tone={sum.sold ? (sum.marginAfterCosts >= 0 ? 'good' : 'bad') : undefined} />
      </section>

      {groups.length > 0 && (
        <section className="rounded-xl bg-white ring-1 ring-amber-300" aria-labelledby="cs-wait">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h4 id="cs-wait" className="text-lg font-semibold text-ink">{tx('waitTitle', { n: waiting.length })}</h4>
              <p className="text-sm text-ink-muted">{tx('waitHint')}</p>
            </div>
            {writer && <Button className="min-h-11" disabled={busy} onClick={() => receive(waiting.map(w => w.cowId))}>{tx('receiveAll')}</Button>}
          </div>
          <ul className="divide-y divide-slate-100">
            {groups.map(g => (
              <li key={g.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0 text-base text-ink"><b className="font-semibold">{g.farm}</b> · {batchName(g.batchId)}<span className="block text-sm text-ink-muted">{tx('waitLine', { head: g.head, kg: Math.round(g.kg).toLocaleString('en-US'), day: shownDay(g.collectedOn, language) })}</span></span>
                {writer && <Button variant="outline" size="sm" className="min-h-10" disabled={busy} onClick={() => receive(g.cowIds)}>{tx('receive')}</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-white ring-1 ring-slate-200" aria-labelledby="cs-lots">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h4 id="cs-lots" className="text-lg font-semibold text-ink">{tx('lotsTitle')}</h4>
          {writer && lots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chosenIds.length > 0 && <span className="text-sm text-ink-muted">{tx('selected', { n: chosenIds.length })}</span>}
              <Button className="min-h-10" disabled={chosenIds.length === 0} onClick={() => setDialog('sell')}>{tx('sell')}</Button>
              <Button variant="outline" className="min-h-10" disabled={chosenIds.length === 0} onClick={() => setDialog('lost')}>{tx('markLost')}</Button>
            </div>
          )}
        </div>
        {lots.length === 0 ? <p className="px-4 py-5 text-base text-ink-muted">{tx('lotsEmpty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                {writer && <th className="w-10 px-3 py-2" />}
                <th className="px-3 py-2 font-medium">{tx('colFarm')}</th><th className="px-3 py-2 font-medium">{tx('colBatch')}</th><th className="px-3 py-2 font-medium">{tx('colCollected')}</th>
                <th className="px-3 py-2 text-right font-medium">{tx('colHead')}</th><th className="px-3 py-2 text-right font-medium">{tx('colKg')}</th><th className="px-3 py-2 text-right font-medium">{tx('colCost')}</th><th className="px-3 py-2 text-right font-medium">{tx('colDays')}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {lots.map(l => {
                  const all = l.cowIds.every(id => chosen.has(id));
                  return (
                    <tr key={l.key} className="border-t border-slate-100">
                      {writer && <td className="px-3 py-2"><input type="checkbox" className="h-5 w-5 accent-emerald-700" aria-label={`${l.farm} ${batchName(l.batchId)}`} checked={all} onChange={e => toggle(l.cowIds, e.target.checked)} /></td>}
                      <td className="px-3 py-2 font-medium text-ink">{l.farm}</td>
                      <td className="px-3 py-2">{batchName(l.batchId)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{shownDay(l.collectedOn, language)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.head}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Math.round(l.kg).toLocaleString('en-US')} kg</td>
                      <td className="px-3 py-2 text-right tabular-nums">{riel(l.cost)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${l.daysHeld > HELD_ALERT_DAYS ? 'font-semibold text-amber-800' : ''}`}>{l.daysHeld}</td>
                      <td className="px-3 py-2 text-right"><button type="button" className="text-sm text-emerald-800 underline" onClick={() => seeCattle(l.cowIds, `${l.farm} · ${batchName(l.batchId)}`)}>{tx('seeCattle')}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200" aria-labelledby="cs-sold">
        <h4 id="cs-sold" className="border-b border-slate-100 px-4 py-3 text-lg font-semibold text-ink">{tx('soldTitle')}</h4>
        {soldRows.length === 0 ? <p className="px-4 py-5 text-base text-ink-muted">{tx('soldEmpty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-3 py-2 font-medium">{tx('colSoldOn')}</th><th className="px-3 py-2 font-medium">{tx('colBuyer')}</th><th className="px-3 py-2 font-medium">{tx('colFarm')}</th>
                <th className="px-3 py-2 text-right font-medium">{tx('colHead')}</th><th className="px-3 py-2 text-right font-medium">{tx('colKg')}</th><th className="px-3 py-2 text-right font-medium">{tx('colSale')}</th><th className="px-3 py-2 text-right font-medium">{tx('colMargin')}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {soldRows.slice(0, 15).map(l => (
                  <tr key={l.key} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{shownDay(l.soldOn, language)}</td>
                    <td className="px-3 py-2">{l.buyer}</td>
                    <td className="px-3 py-2">{l.farm}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.head}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(l.kg).toLocaleString('en-US')} kg</td>
                    <td className="px-3 py-2 text-right tabular-nums">{riel(l.total)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${l.margin < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>{riel(l.margin)}</td>
                    <td className="px-3 py-2 text-right"><button type="button" className="text-sm text-emerald-800 underline" onClick={() => seeCattle(l.cowIds, `${l.buyer} · ${shownDay(l.soldOn, language)}`)}>{tx('seeCattle')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {soldRows.length > 15 && <p className="px-3 py-2 text-sm text-ink-muted">{tx('more', { n: 15, total: soldRows.length })}</p>}
          </div>
        )}
      </section>
      <p className="text-sm text-ink-muted">{tx('note')}</p>
      </>}

      {dialog === 'sell' && <SellDialog cattle={chosenIds.map(id => byId.get(id)!)} buyers={buyers} today={today} onBuyerAdded={refresh} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); setChosen(new Set()); setMessage({ kind: 'ok', text }); refresh(); }} />}
      {dialog === 'lost' && <LostDialog ids={chosenIds} today={today} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); setChosen(new Set()); setMessage({ kind: 'ok', text }); refresh(); }} />}
    </div>
  );
}

function SellDialog({ cattle, buyers, today, onBuyerAdded, onClose, onDone }: { cattle: Holding[]; buyers: Buyer[]; today: string; onBuyerAdded: () => void; onClose: () => void; onDone: (text: string) => void }) {
  const { tx } = useText('camcowStock');
  const active = buyers.filter(b => b.active);
  const [buyerId, setBuyerId] = useState(active[0]?.id ?? '');
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState('');
  const [weights, setWeights] = useState<Record<string, string>>(() => Object.fromEntries(cattle.map(h => [h.cowId, String(Math.round(h.collectionWeight * 10) / 10)])));
  const [off, setOff] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = cattle.filter(h => !off.has(h.cowId));
  const input = { cowIds: rows.map(h => h.cowId), buyerId, date, pricePerKg: Number(price), weights: Object.fromEntries(rows.map(h => [h.cowId, Number(weights[h.cowId])])) };
  const total = rows.reduce((s, h) => s + Math.round((Number(weights[h.cowId]) || 0) * (Number(price) || 0)), 0);
  const cost = rows.reduce((s, h) => s + h.collectionTotal, 0);
  const submit = async () => {
    const problem = saleProblem(input, new Set(cattle.map(h => h.cowId)), today);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    const res = await sellCamcowCattleAction(input);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone(tx('sold', { n: res.data.sold, amount: riel(res.data.total) }));
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{tx('sellTitle', { n: rows.length })}</DialogTitle><DialogDescription>{tx('sellHint')}</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="text-sm text-ink-muted sm:col-span-3">
            <label htmlFor="cs-buyer">{tx('lBuyer')}</label>
            <div className="mt-1 flex gap-2">
              <select id="cs-buyer" className="min-h-12 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-ink" value={buyerId} onChange={e => { setBuyerId(e.target.value); setError(''); }}>
                <option value="">{tx('chooseBuyer')}</option>
                {active.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <Button type="button" variant="outline" className="min-h-12" onClick={() => setAdding(true)}>{tx('newBuyer')}</Button>
            </div>
            {active.length === 0 && <p className="mt-1">{tx('noActiveBuyer')}</p>}
          </div>
          <label className="text-sm text-ink-muted">{tx('lDate')}<Input type="date" max={today} className="mt-1 min-h-12 text-base" value={date} onChange={e => { setDate(e.target.value); setError(''); }} /></label>
          <label className="text-sm text-ink-muted sm:col-span-2">{tx('lPrice')}<Input inputMode="numeric" className="mt-1 min-h-12 text-base" value={price} onChange={e => { setPrice(e.target.value); setError(''); }} /></label>
        </div>
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-200">
          {cattle.map(h => (
            <li key={h.cowId} className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" className="h-5 w-5 accent-emerald-700" aria-label={h.cowId} checked={!off.has(h.cowId)} onChange={e => setOff(prev => { const n = new Set(prev); if (e.target.checked) n.delete(h.cowId); else n.add(h.cowId); return n; })} />
              <span className="min-w-0 flex-1 truncate text-base text-ink">{h.cowId}</span>
              <Input inputMode="decimal" aria-label={`${tx('lWeight')} ${h.cowId}`} className="min-h-10 w-28 text-right text-base" disabled={off.has(h.cowId)} value={weights[h.cowId]} onChange={e => { setWeights(w => ({ ...w, [h.cowId]: e.target.value })); setError(''); }} />
              <span className="w-8 text-sm text-ink-muted">kg</span>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-base text-ink">
          {tx('sellTotal')}: <b>{riel(total)}</b> · {tx('sellMargin')}: <b className={total - cost < 0 ? 'text-rose-800' : 'text-emerald-800'}>{riel(total - cost)}</b>
        </p>
        {error && <p role="alert" className="text-base text-rose-700">{error}</p>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{tx('cancel')}</Button><Button disabled={busy || rows.length === 0} onClick={submit}>{tx('sellConfirm')}</Button></DialogFooter>
        {adding && <BuyerDialog others={buyers.map(b => b.name)} onClose={() => setAdding(false)} onSaved={b => { setAdding(false); setBuyerId(b.id); setError(''); onBuyerAdded(); }} />}
      </DialogContent>
    </Dialog>
  );
}

function LostDialog({ ids, today, onClose, onDone }: { ids: string[]; today: string; onClose: () => void; onDone: (text: string) => void }) {
  const { tx } = useText('camcowStock');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError('');
    const res = await markCamcowCattleLostAction(ids, date, note);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone(tx('lostDone', { n: res.data.lost }));
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tx('lostTitle', { n: ids.length })}</DialogTitle><DialogDescription>{tx('lostHint')}</DialogDescription></DialogHeader>
        <label className="text-sm text-ink-muted">{tx('lDay')}<Input type="date" max={today} className="mt-1 min-h-12 text-base" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="text-sm text-ink-muted">{tx('lNote')}<Input className="mt-1 min-h-12 text-base" value={note} onChange={e => setNote(e.target.value)} /></label>
        {error && <p role="alert" className="text-base text-rose-700">{error}</p>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{tx('cancel')}</Button><Button disabled={busy} onClick={submit}>{tx('lostConfirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
