'use client';

import React, { useMemo, useState } from 'react';
import { Download, Pencil, Search, SlidersHorizontal, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import type { SalesRecord } from '@/lib/xlsx-parser';
import { format2DecimalsWithCommas, getErrorMessage, hasPermission } from '@/lib/utils';
import { money as cattleMoney } from '@/lib/cattle-stats';
import { feedShares } from '@/lib/farm-costs';
import { exportToExcel } from '@/lib/excel-export';
import { useOnChange } from '@/hooks/useOnChange';
import { Choice, NUM } from '../flow/FlowShell';

interface SalesPageProps {
  data: ERPLivestockData;
  onDeleteSalesRecord?: (cowId: string) => Promise<void>;
  onUpdateSalesRecord?: (cowId: string, updates: Partial<SalesRecord>) => Promise<void>;
  /** Opens the guided Sell dialog. */
  onRecordSaleClick?: () => void;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

const PAGE = 15;
const SELECT = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');
/** Sales are stored as 'Scale' (priced by kg) or 'Lumpsum' (one price); older rows may say 'Weight'. */
const byWeight = (s: Pick<SalesRecord, 'saleType'>) => ['scale', 'weight'].includes(norm(s.saleType));

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

export default function SalesPage({ data, onDeleteSalesRecord, onUpdateSalesRecord, onRecordSaleClick, currentUser, farms = [] }: SalesPageProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [farm, setFarm] = useState('');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [editing, setEditing] = useState<{ cowId: string; date: string; buyer: string; perKg: boolean; weight: string; price: string } | null>(null);
  const [editError, setEditError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  useOnChange(JSON.stringify([farm, query, startDate, endDate]), () => setVisible(PAGE));

  const canSell = !!onRecordSaleClick && hasPermission(currentUser, 'sales_record');
  const canEdit = !!onUpdateSalesRecord && hasPermission(currentUser, 'sales_record');
  const canCancel = !!onDeleteSalesRecord && hasPermission(currentUser, 'sales_delete');
  const showFarmFilter = !currentUser?.farmLocation && farms.length > 0;
  const cowById = useMemo(() => new Map(data.stock.map(c => [c.id, c])), [data.stock]);

  const sales = useMemo(() => {
    const q = norm(query);
    return data.salesTracking
      .filter(s => !farm || cowById.get(s.cowId)?.location === farm)
      .filter(s => !q || norm(s.cowId).includes(q) || norm(s.buyer).includes(q))
      .filter(s => {
        const d = day(s.salesDate);
        return !((startDate && d < startDate) || (endDate && d > endDate));
      })
      .sort((a, b) => (b.salesDate ?? '').localeCompare(a.salesDate ?? '') || a.cowId.localeCompare(b.cowId));
  }, [data.salesTracking, cowById, farm, query, startDate, endDate]);

  // Each animal's share of its batch's daily feed (the same split Reports uses for farm profit).
  const feedByCow = useMemo(
    () => feedShares(data.feedTransactions || [], data.batches, data.stock, data.salesTracking).byCow,
    [data.feedTransactions, data.batches, data.stock, data.salesTracking]
  );

  // Profit per sale: what the buyer paid, less what the animal cost to buy, treat and feed.
  const { profits, breakdown } = useMemo(() => {
    const profits = new Map<string, number | null>();
    const breakdown = new Map<string, { bought: number; feed: number; medicine: number }>();
    for (const s of sales) {
      const cow = cowById.get(s.cowId);
      if (!cow) { profits.set(s.cowId, null); continue; }
      const m = cattleMoney({ totalPrice: cow.totalPrice, status: 'Sold' }, s, data.healthLogs.filter(l => l.cowId === s.cowId));
      const feed = Math.round(feedByCow.get(s.cowId) ?? 0);
      profits.set(s.cowId, m.result === null ? null : m.result - feed);
      breakdown.set(s.cowId, { bought: m.cost, feed, medicine: m.medical });
    }
    return { profits, breakdown };
  }, [sales, cowById, data.healthLogs, feedByCow]);

  const revenue = sales.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
  const known = sales.filter(s => profits.get(s.cowId) !== null && profits.get(s.cowId) !== undefined);
  const profit = known.reduce((sum, s) => sum + (profits.get(s.cowId) ?? 0), 0);
  const kgSold = sales.filter(byWeight).reduce((sum, s) => sum + (s.weight || 0), 0);
  const kgRevenue = sales.filter(byWeight).reduce((sum, s) => sum + (s.totalPrice || 0), 0);
  const perKg = kgSold > 0 ? kgRevenue / kgSold : null;
  const activeFilters = [farm, startDate, endDate].filter(Boolean).length;

  const exportSales = () => exportToExcel({
    filename: `CC_Livestock_Sales_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Sales',
    data: sales,
    columns: [
      { header: 'Cattle ID', key: 'cowId' },
      { header: 'Breed', key: 'breed' },
      { header: 'Sales Date', key: 'salesDate', formatter: (v) => (v ? new Date(v).toLocaleDateString() : 'N/A') },
      { header: 'Sales Type', key: 'saleType', formatter: (_, row) => (byWeight(row) ? 'By weight' : 'One price') },
      { header: 'Sold To', key: 'buyer' },
      { header: 'Sale Weight (kg)', key: 'weight' },
      { header: 'Unit Price (៛)', key: 'unitPrice', formatter: (v) => `៛ ${format2DecimalsWithCommas(v)}` },
      { header: 'Total (៛)', key: 'totalPrice', formatter: (v) => `៛ ${format2DecimalsWithCommas(v)}` },
      { header: 'Bought for (៛)', key: 'cowId', formatter: (id) => { const b = breakdown.get(id); return b ? `៛ ${format2DecimalsWithCommas(b.bought)}` : ''; } },
      { header: 'Feed (៛)', key: 'cowId', formatter: (id) => { const b = breakdown.get(id); return b ? `៛ ${format2DecimalsWithCommas(b.feed)}` : ''; } },
      { header: 'Medicine (៛)', key: 'cowId', formatter: (id) => { const b = breakdown.get(id); return b ? `៛ ${format2DecimalsWithCommas(b.medicine)}` : ''; } },
      { header: 'Profit (៛)', key: 'cowId', formatter: (id) => { const p = profits.get(id); return p === null || p === undefined ? '' : `៛ ${format2DecimalsWithCommas(p)}`; } },
    ],
  });

  const startEdit = (s: SalesRecord) => {
    setEditError('');
    setEditing({ cowId: s.cowId, date: day(s.salesDate), buyer: s.buyer ?? '', perKg: byWeight(s), weight: String(s.weight ?? ''), price: String(s.unitPrice ?? '') });
  };

  const editTotal = editing ? (editing.perKg ? Number(editing.weight) * Number(editing.price) : Number(editing.price)) : 0;

  const saveEdit = async () => {
    if (!editing || !onUpdateSalesRecord) return;
    if (editing.perKg && !(Number(editing.weight) > 0)) { setEditError('Type the weight in kg.'); return; }
    if (!(Number(editing.price) > 0)) { setEditError(editing.perKg ? 'Type the price for each kg.' : 'Type the price paid.'); return; }
    try {
      await onUpdateSalesRecord(editing.cowId, {
        salesDate: editing.date,
        saleType: editing.perKg ? 'Scale' : 'Lumpsum',
        buyer: editing.buyer.trim(),
        weight: editing.perKg ? Number(editing.weight) : (data.salesTracking.find(s => s.cowId === editing.cowId)?.weight ?? 0),
        unitPrice: Number(editing.price),
      });
      setEditing(null);
    } catch (e) {
      setEditError(getErrorMessage(e, 'Could not save. Please try again.'));
    }
  };

  const askCancel = (s: SalesRecord) => setConfirm({
    title: 'Cancel this sale?',
    description: `${s.cowId} was sold for ${riel(s.totalPrice)}. Cancelling removes the sale and puts the animal back on the farm as active.`,
    type: 'danger',
    confirmText: 'Cancel the sale',
    onConfirm: async () => {
      try {
        await onDeleteSalesRecord?.(s.cowId);
      } catch (e) {
        setConfirm({ title: 'Could not cancel', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' });
      }
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Sales</h2>
          <p className="text-base text-ink-muted">Cattle sold, and what they earned.</p>
        </div>
        {canSell && <Button size="lg" onClick={onRecordSaleClick}><DollarSign /> Sell</Button>}
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="Sales" value={riel(revenue)} sub={`${sales.length} ${sales.length === 1 ? 'animal' : 'animals'} sold`} />
        <Tile label="Profit" value={known.length ? `${profit < 0 ? '−' : ''}${riel(Math.abs(profit))}` : '—'} sub={known.length ? 'after buying, feed and medicine' : 'No sales yet'} tone={known.length ? (profit < 0 ? 'bad' : 'good') : undefined} />
        <Tile label="Average price" value={perKg !== null ? riel(perKg) : '—'} sub="for each kg sold" />
      </section>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by tag or buyer" aria-label="Search sales" className="h-14 pl-11 text-lg" />
          </div>
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)} className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-base font-medium text-ink hover:border-emerald-600">
            <SlidersHorizontal className="h-5 w-5" aria-hidden /> Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            {showFarmFilter && (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-base font-medium text-ink">Farm</span>
                <select value={farm} onChange={e => setFarm(e.target.value)} className={SELECT}>
                  <option value="">All farms</option>
                  {farms.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </label>
            )}
            <label className="block"><span className="mb-1 block text-base font-medium text-ink">Sold from</span><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 text-lg" /></label>
            <label className="block"><span className="mb-1 block text-base font-medium text-ink">Sold until</span><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 text-lg" /></label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="button" variant="outline" onClick={exportSales} disabled={sales.length === 0}><Download /> Download Excel</Button>
              {activeFilters > 0 && <Button type="button" variant="ghost" onClick={() => { setFarm(''); setStartDate(''); setEndDate(''); }}>Clear filters</Button>}
            </div>
          </div>
        )}
      </div>

      {sales.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-lg text-ink-muted">{data.salesTracking.length === 0 ? 'No sales yet.' : 'No sales match what you chose.'}</p>
          {canSell && data.salesTracking.length === 0 && <Button size="lg" onClick={onRecordSaleClick}><DollarSign /> Sell</Button>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sales.slice(0, visible).map(s => {
            const p = profits.get(s.cowId);
            const b = breakdown.get(s.cowId);
            return (
              <li key={s.cowId} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-ink">{s.cowId}</p>
                    <p className="text-base text-ink-muted">{[day(s.salesDate), s.buyer || null].filter(Boolean).join(' · ')}</p>
                  </div>
                  {(canEdit || canCancel) && (
                    <div className="flex shrink-0">
                      {canEdit && <Button variant="ghost" size="icon" aria-label={`Edit the sale of ${s.cowId}`} onClick={() => startEdit(s)}><Pencil /></Button>}
                      {canCancel && <Button variant="ghost" size="icon" aria-label={`Cancel the sale of ${s.cowId}`} onClick={() => askCancel(s)}><Trash2 className="text-rose-700" /></Button>}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-2xl font-semibold text-ink">{riel(s.totalPrice)}</p>
                <p className="text-base text-ink-muted">{byWeight(s) ? `${s.weight} kg × ${riel(s.unitPrice)} a kg` : 'One price for the animal'}</p>
                {p !== null && p !== undefined && (
                  <>
                    <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${p < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{p < 0 ? 'Loss' : 'Profit'} {riel(Math.abs(p))}</p>
                    {b && <p className="mt-1 text-sm text-ink-muted">{[`Bought ${riel(b.bought)}`, `feed ${riel(b.feed)}`, b.medicine > 0 ? `medicine ${riel(b.medicine)}` : null].filter(Boolean).join(' · ')}</p>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sales.length > visible && <div className="flex justify-center"><Button size="lg" variant="outline" onClick={() => setVisible(v => v + PAGE)}>Show more ({sales.length - visible} left)</Button></div>}

      {editing && (
        <Dialog open onOpenChange={open => { if (!open) setEditing(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold text-ink">Edit sale</DialogTitle>
              <DialogDescription className="text-base text-ink-muted">{editing.cowId}</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveEdit(); }} className="space-y-4">
              <div>
                <p className="mb-2 text-lg font-medium text-ink">How was the price set?</p>
                <div className="grid grid-cols-2 gap-3">
                  <Choice selected={editing.perKg} onClick={() => setEditing({ ...editing, perKg: true })}>Price per kg</Choice>
                  <Choice selected={!editing.perKg} onClick={() => setEditing({ ...editing, perKg: false })}>One price</Choice>
                </div>
              </div>
              {editing.perKg && (
                <label className="block"><span className="mb-1 block text-lg font-medium text-ink">Weight (kg)</span><Input type="number" step="any" inputMode="decimal" value={editing.weight} onChange={e => { setEditing({ ...editing, weight: e.target.value }); setEditError(''); }} className={`h-14 text-lg ${NUM}`} /></label>
              )}
              <label className="block"><span className="mb-1 block text-lg font-medium text-ink">{editing.perKg ? 'Price for each kg (៛)' : 'Price paid (៛)'}</span><Input type="number" step="any" inputMode="numeric" value={editing.price} onChange={e => { setEditing({ ...editing, price: e.target.value }); setEditError(''); }} className={`h-14 text-lg ${NUM}`} /></label>
              <p className="rounded-xl bg-slate-50 p-3 text-lg text-ink">Total: <span className="font-semibold">{riel(editTotal > 0 ? editTotal : 0)}</span></p>
              <label className="block"><span className="mb-1 block text-lg font-medium text-ink">Buyer</span><Input value={editing.buyer} onChange={e => setEditing({ ...editing, buyer: e.target.value })} className="h-14 text-lg" /></label>
              <label className="block"><span className="mb-1 block text-lg font-medium text-ink">Date sold</span><Input type="date" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} className="h-14 text-lg" /></label>
              {editError && <p role="alert" className="text-base font-medium text-rose-700">{editError}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" size="lg" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" size="lg" className="flex-1">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
