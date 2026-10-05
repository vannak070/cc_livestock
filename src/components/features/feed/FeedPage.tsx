'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, Download, Pencil, Plus, Search, Settings, SlidersHorizontal, Trash2, Wheat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, FarmItem, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { format2DecimalsWithCommas, getErrorMessage, hasPermission } from '@/lib/utils';
import { feedStockLevels } from '@/lib/attention';
import { addDays, amountText, dailyFeedReport, farmToday, farmsToRecord, feedUnit, missedFeedDays, movementOnFarm, round1, unitWord, type FeedDayStatus } from '@/lib/daily-feed';
import { dayLabel } from './DailyFeedFlow';
import { exportToExcel } from '@/lib/excel-export';
import { useOnChange } from '@/hooks/useOnChange';
import FeedProductFlow from './FeedProductFlow';
import { FeedCategoryModal } from './FeedCategoryModal';
import FeedInFlow from './FeedInFlow';
import { canAddProduct, canEditProduct, isDefaultProduct } from '@/lib/feed-products';
import { FarmSelect } from '@/components/ui/listbox-select';

interface FeedPageProps {
  data: ERPLivestockData;
  onSaveProduct: (product: FeedProductItem) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onAddTransaction: (tx: FeedStockTransaction) => Promise<void>;
  /** Opens the guided Feed in dialog. */
  onOpenFeedIn: () => void;
  /** Opens the day's feed record, optionally for a farm and day; only for people who may record feed. */
  onRecordDay?: (farm?: string, day?: string) => void;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

type Tab = 'daily' | 'stock' | 'moves' | 'products';
type Move = 'ALL' | 'STOCK_IN' | 'STOCK_OUT';

const PAGE = 15;
const SELECT = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString();
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');
const isPlace = (s?: string) => !!s && !s.startsWith('Daily Feed') && s !== 'Supplier' && s !== 'Central Warehouse';

const STATUS_TEXT: Record<FeedDayStatus, string> = { recorded: 'Recorded', partly: 'Partly recorded', estimated: 'Automatic (old)', missing: 'Not recorded' };
const STATUS_STYLE: Record<FeedDayStatus, string> = {
  recorded: 'bg-emerald-100 text-emerald-800',
  partly: 'bg-amber-100 text-amber-900',
  estimated: 'bg-amber-100 text-amber-900',
  missing: 'bg-rose-100 text-rose-800',
};

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'bad' }) {
  const style = tone === 'bad' ? 'border-rose-300 bg-rose-50' : tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${style}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

export default function FeedPage({ data, onSaveProduct, onDeleteProduct, onAddTransaction, onOpenFeedIn, onRecordDay, currentUser, farms = [] }: FeedPageProps) {
  const [tab, setTab] = useState<Tab>('stock');
  const [days, setDays] = useState<7 | 30>(7);
  const [showFilters, setShowFilters] = useState(false);
  const [farm, setFarm] = useState('');
  const [category, setCategory] = useState('');
  const [move, setMove] = useState<Move>('ALL');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [productModal, setProductModal] = useState<{ open: boolean; product: FeedProductItem | null }>({ open: false, product: null });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  useOnChange(JSON.stringify([tab, farm, category, move, query, startDate, endDate, days]), () => setVisible(PAGE));

  const canManage = hasPermission(currentUser, 'feed_manage');
  // A farm owner puts their own farm's products into stock too.
  const canFeedIn = canManage || (hasPermission(currentUser, 'feed_own_products') && !!currentUser?.farmLocation);
  const showFarmFilter = !currentUser?.farmLocation && farms.length > 0;
  const effectiveFarm = currentUser?.farmLocation || farm;
  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);
  const transactions = useMemo(() => data.feedTransactions || [], [data.feedTransactions]);
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products]);

  // Movements that touch the chosen farm (all of them when no farm is chosen).
  // Old automatic rows carry no farm; they count for the farm of their batch.
  const scopedTx = useMemo(() => {
    if (!effectiveFarm) return transactions;
    const batchFarm = new Map((data.batches || []).map(b => [b.id, b.farmLocation]));
    return transactions.filter(t => movementOnFarm(t, effectiveFarm, batchFarm));
  }, [transactions, effectiveFarm, data.batches]);

  // Same rule as the Today screen: stock from the movements, days left from the feeding programs.
  const levels = useMemo(() => {
    const batches = (data.batches || []).filter(b => !effectiveFarm || !b.farmLocation || b.farmLocation === effectiveFarm);
    return feedStockLevels({ stock: data.stock, batches, feedProducts: products, feedTransactions: scopedTx })
      .filter(l => !category || productById.get(l.productId)?.category === category);
  }, [data.batches, data.stock, products, scopedTx, effectiveFarm, category, productById]);

  const stockRows = useMemo(() => {
    const q = norm(query);
    return levels
      .filter(l => !q || norm(l.productName).includes(q))
      .sort((a, b) => Number(b.isLow) - Number(a.isLow) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || a.productName.localeCompare(b.productName));
  }, [levels, query]);

  // The banner asks someone to buy more, so someone who restocks only hears about what they can restock:
  // a farm owner is not nagged about the office's default feeds. People who cannot restock still see everything.
  const lowItems = levels.filter(l => l.isLow && (!canFeedIn || canManage || canEditProduct(currentUser, productById.get(l.productId) ?? { ownerFarm: undefined })));
  const stocked = levels.filter(l => l.tracked);
  const totalKg = stocked.reduce((s, l) => s + l.kg, 0);
  const totalBags = stocked.reduce((s, l) => s + l.bags, 0);
  const dailyKg = levels.reduce((s, l) => s + l.dailyUseKg, 0);
  const tightest = levels.filter(l => l.daysLeft !== null).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
  const daysTone = tightest ? (tightest.daysLeft! < 7 ? 'bad' : tightest.daysLeft! < 14 ? 'warn' : undefined) : undefined;

  const moves = useMemo(() => {
    const q = norm(query);
    return scopedTx
      // A day recorded as "nothing fed" is stored as a 0 row; it says nothing in the list.
      .filter(t => (t.quantityBags || 0) !== 0 || (t.quantityKg || 0) !== 0)
      .filter(t => move === 'ALL' || t.type === move)
      .filter(t => !category || productById.get(t.productId)?.category === category)
      .filter(t => !q || norm(t.productName).includes(q) || norm(t.referenceNo).includes(q) || norm(t.notes).includes(q))
      .filter(t => {
        const d = day(t.date);
        return !((startDate && d < startDate) || (endDate && d > endDate));
      })
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [scopedTx, move, category, query, startDate, endDate, productById]);

  // One row per farm per day: recorded by the farm, estimated from the plan, or missing.
  const todayDay = farmToday();
  const report = useMemo(
    () => dailyFeedReport({ batches: data.batches || [], stock: data.stock || [], feedProducts: products, feedTransactions: transactions, healthLogs: data.healthLogs || [] }, addDays(todayDay, -(days - 1)), todayDay, effectiveFarm || undefined),
    [data.batches, data.stock, data.healthLogs, products, transactions, days, todayDay, effectiveFarm]
  );
  const reportRecorded = report.filter(r => r.status === 'recorded').length;
  // Past days nobody wrote down, per farm: feed only leaves stock when a day is recorded.
  const missed = useMemo(
    () => (effectiveFarm ? [effectiveFarm] : farmsToRecord(data.batches || []))
      .map(f => ({ farm: f, days: missedFeedDays(f, data.batches || [], data.stock || [], products, transactions, todayDay) }))
      .filter(m => m.days.length > 0),
    [effectiveFarm, data.batches, data.stock, products, transactions, todayDay]
  );
  const reportCost = report.reduce((s, r) => s + r.cost, 0);

  const exportReport = () => exportToExcel({
    filename: `CC_Livestock_Daily_Feed_${todayDay}.xlsx`,
    sheetName: 'Daily Feed',
    data: report.map(r => ({ ...r, feed: r.items.map(i => `${amountText({ unit: i.unit }, i.units)} ${i.productName}`).join('; '), statusText: STATUS_TEXT[r.status] })),
    columns: [
      { header: 'Day', key: 'day' },
      { header: 'Farm', key: 'farm' },
      { header: 'Status', key: 'statusText' },
      { header: 'Recorded by', key: 'recordedBy' },
      { header: 'Head in fed batches now', key: 'head' },
      { header: 'On the farm now', key: 'onFarm' },
      { header: 'Bulls', key: 'bulls' },
      { header: 'Cows', key: 'cows' },
      { header: 'Feed', key: 'feed' },
      { header: 'Kg', key: 'kg', formatter: (v) => String(round1(Number(v) || 0)) },
      { header: 'Cost (៛)', key: 'cost', formatter: (v) => format2DecimalsWithCommas(v) },
      { header: 'Treatments', key: 'treatments' },
    ],
  });

  const productRows = useMemo(() => {
    const q = norm(query);
    return products.filter(p => (!category || p.category === category) && (!q || norm(p.name).includes(q) || norm(p.id).includes(q)));
  }, [products, category, query]);

  const activeFilters = [farm, category, startDate, endDate].filter(Boolean).length;

  const exportMoves = () => exportToExcel({
    filename: `CC_Livestock_Feed_Movements_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Feed Movements',
    data: moves,
    columns: [
      { header: 'Date', key: 'date', formatter: (v) => (v ? new Date(v).toLocaleDateString() : 'N/A') },
      { header: 'Type', key: 'type', formatter: (v) => (v === 'STOCK_IN' ? 'In' : 'Out') },
      { header: 'Product', key: 'productName' },
      { header: 'Bags', key: 'quantityBags' },
      { header: 'Kg', key: 'quantityKg' },
      { header: 'Total (៛)', key: 'totalCost', formatter: (v) => `៛ ${format2DecimalsWithCommas(v)}` },
      { header: 'From', key: 'sourceFarm' },
      { header: 'To', key: 'targetFarm' },
      { header: 'Reference', key: 'referenceNo' },
      { header: 'Recorded by', key: 'recordedBy' },
      { header: 'Notes', key: 'notes', formatter: (v) => v || '-' },
    ],
  });

  const askDelete = (p: FeedProductItem) => setConfirm({
    title: 'Delete this feed?',
    description: `This removes "${p.name}" from the product list. Past movements stay in the history.`,
    type: 'danger',
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await onDeleteProduct(p.id);
      } catch (e) {
        setConfirm({ title: 'Could not delete', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' });
      }
    },
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stock', label: 'Stock' },
    { key: 'daily', label: 'Daily' },
    { key: 'moves', label: 'Movements' },
    { key: 'products', label: 'Products' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Feed</h2>
          <p className="text-base text-ink-muted">What is in store and how long it will last.</p>
        </div>
        {(canFeedIn || onRecordDay) && (
          <div className="flex flex-wrap gap-2">
            {onRecordDay && <Button size="lg" onClick={() => onRecordDay()}><Wheat /> Record today&apos;s feed</Button>}
            {canFeedIn && <Button size="lg" variant={onRecordDay ? 'outline' : 'default'} onClick={onOpenFeedIn}><ArrowDownToLine /> Feed in</Button>}
          </div>
        )}
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile
          label="Lasts about"
          value={tightest ? `${tightest.daysLeft} days` : '—'}
          sub={tightest ? `then ${tightest.productName} runs out` : 'No feeding program'}
          tone={daysTone}
        />
        <Tile label="In store" value={`${num(totalKg)} kg`} sub={`${num(totalBags)} bags`} />
        <Tile label="Eaten daily" value={dailyKg > 0 ? `${num(dailyKg)} kg` : '—'} sub="all active batches" />
      </section>

      {missed.map(m => (
        <div key={m.farm} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4">
          <p className="text-lg text-ink">
            <span className="font-semibold">Feed not written down{effectiveFarm ? '' : ` at ${m.farm}`}: </span>
            {m.days.map(dayLabel).join(', ')}. No feed was taken from stock for {m.days.length === 1 ? 'that day' : 'those days'}.
          </p>
          {onRecordDay && <Button onClick={() => onRecordDay(m.farm, m.days[0])}><Wheat /> Record {dayLabel(m.days[0])}</Button>}
        </div>
      ))}

      {lowItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-lg text-ink">
            <span className="font-semibold">Running low: </span>
            {lowItems.slice(0, 3).map(l => `${l.productName} (${amountText(productById.get(l.productId), l.bags)})`).join(', ')}{lowItems.length > 3 ? ` and ${lowItems.length - 3} more` : ''}
          </p>
          {canFeedIn && <Button onClick={onOpenFeedIn}><ArrowDownToLine /> Feed in</Button>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Feed" className="flex flex-1 rounded-xl bg-slate-100 p-1 sm:flex-none">
          {tabs.map(t => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-base font-medium sm:px-4 ${tab === t.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(v => !v)}
          className="ml-auto flex min-h-11 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-base font-medium text-ink hover:border-emerald-600"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden /> Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          {showFarmFilter && (
            <div className="block">
              <span className="mb-1 block text-base font-medium text-ink">Farm</span>
              <FarmSelect farms={farms.map(f => f.name)} value={farm} onChange={setFarm} />
            </div>
          )}
          {categories.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">Kind of feed</span>
              <select value={category} onChange={e => setCategory(e.target.value)} className={SELECT}>
                <option value="">All kinds</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {tab === 'moves' && (
            <>
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">From date</span>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 text-lg" />
              </label>
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">Until date</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 text-lg" />
              </label>
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={exportMoves} disabled={moves.length === 0}><Download /> Download Excel</Button>
              </div>
            </>
          )}
          {activeFilters > 0 && (
            <div className="sm:col-span-2"><Button type="button" variant="ghost" onClick={() => { setFarm(''); setCategory(''); setStartDate(''); setEndDate(''); }}>Clear filters</Button></div>
          )}
        </div>
      )}

      {(tab === 'moves' || tab === 'products') && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === 'moves' ? 'Search feed, invoice or note' : 'Search feed'} aria-label="Search" className="h-14 pl-11 text-lg" />
        </div>
      )}

      {tab === 'daily' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Days" className="flex rounded-xl bg-slate-100 p-1">
              {([7, 30] as const).map(n => (
                <button key={n} role="tab" type="button" aria-selected={days === n} onClick={() => setDays(n)} className={`min-h-11 rounded-lg px-4 text-base font-medium ${days === n ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>Last {n} days</button>
              ))}
            </div>
            <Button variant="outline" className="ml-auto" onClick={exportReport} disabled={report.length === 0}><Download /> Download Excel</Button>
          </div>
          {report.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No batch is being fed{effectiveFarm ? ` on ${effectiveFarm}` : ''}. Turn feeding on in a batch&apos;s Feeding tab.</p>
          ) : (
            <>
              <p className="text-base text-ink-muted">{reportRecorded} of {report.length} farm days written down · feed cost {riel(reportCost)}</p>
              <ul className="space-y-3">
                {report.slice(0, visible).map(r => (
                  <li key={`${r.farm}|${r.day}`} className={`rounded-2xl border-2 bg-white p-4 ${r.status === 'missing' ? 'border-rose-200' : r.status === 'recorded' ? 'border-slate-200' : 'border-amber-200'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xl font-semibold text-ink">{dayLabel(r.day)}{r.day === todayDay ? ' (today)' : ''}</p>
                        <p className="text-base text-ink-muted">{r.farm} · {r.head} head in fed batches now{r.bulls || r.cows ? ` (${r.bulls} bulls, ${r.cows} cows)` : ''}{r.onFarm !== r.head ? ` · ${r.onFarm} on the farm` : ''}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                    </div>
                    {r.items.length > 0 ? (
                      <p className="mt-2 text-lg text-ink">{r.items.map(i => `${amountText({ unit: i.unit }, i.units)} ${i.productName}`).join(' · ')}</p>
                    ) : (
                      <p className="mt-2 text-lg text-ink-muted">{r.status === 'missing' ? 'Nothing written down for this day.' : 'Nothing fed.'}</p>
                    )}
                    <p className="text-base text-ink-muted">
                      {[r.cost > 0 ? `Cost ${riel(r.cost)}` : '', r.recordedBy && r.status !== 'estimated' ? `by ${r.recordedBy}` : '', r.treatments > 0 ? `${r.treatments} ${r.treatments === 1 ? 'treatment' : 'treatments'}` : ''].filter(Boolean).join(' · ')}
                    </p>
                    {onRecordDay && (
                      <div className="mt-3">
                        <Button size="sm" variant={r.status === 'recorded' ? 'ghost' : 'default'} onClick={() => onRecordDay(r.farm, r.day)}>
                          <Wheat /> {r.status === 'recorded' ? 'Change' : 'Record this day'}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {report.length > visible && <div className="flex justify-center"><Button size="lg" variant="outline" onClick={() => setVisible(v => v + PAGE)}>Show more ({report.length - visible} left)</Button></div>}
              <p className="text-base text-ink-muted">Feed is only taken from stock when a day is recorded. &quot;Automatic (old)&quot; days were filled in by the app before 5 Oct 2026; recording such a day replaces it. Head counts are today&apos;s numbers.</p>
            </>
          )}
        </div>
      )}

      {tab === 'stock' && (
        stockRows.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No feed products yet. Add one under Products.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {stockRows.map(l => {
              const p = productById.get(l.productId);
              if (!l.tracked) {
                // Grown or cut on the farm: only how much is eaten matters.
                return (
                  <li key={l.productId} className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xl font-semibold text-ink">{l.productName}</p>
                        <p className="text-base text-ink-muted">{p?.category}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-ink">Grown on the farm</span>
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-ink">{num(l.dailyUseKg)} <span className="text-lg font-medium text-ink-muted">kg a day</span></p>
                    <p className="text-base text-ink-muted">{l.dailyUseKg > 0 ? 'From the feeding plans. Not kept as stock.' : 'Not in any feeding plan yet.'}</p>
                  </li>
                );
              }
              return (
                <li key={l.productId} className={`rounded-2xl border-2 bg-white p-4 ${l.isLow ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xl font-semibold text-ink">{l.productName}</p>
                      <p className="text-base text-ink-muted">{p?.category}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${l.isLow ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{l.isLow ? 'Running low' : 'Enough'}</span>
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-ink">{num(l.bags)} <span className="text-lg font-medium text-ink-muted">{unitWord(feedUnit(p), round1(l.bags))}</span></p>
                  <p className="text-base text-ink-muted">{feedUnit(p) === 'kg' ? '' : `${num(l.kg)} kg · `}worth {riel(l.kg * (p?.unitCost ?? 0))}</p>
                  <p className="mt-2 border-t border-slate-100 pt-2 text-base text-ink">
                    {l.daysLeft !== null ? `Lasts about ${l.daysLeft} days (${num(l.dailyUseKg)} kg a day)` : 'Not used by any feeding program'}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'moves' && (
        <div className="space-y-3">
          <div role="tablist" aria-label="Show" className="flex w-fit rounded-xl bg-slate-100 p-1">
            {([['ALL', 'All'], ['STOCK_IN', 'Came in'], ['STOCK_OUT', 'Used']] as [Move, string][]).map(([k, label]) => (
              <button key={k} role="tab" type="button" aria-selected={move === k} onClick={() => setMove(k)} className={`min-h-11 rounded-lg px-4 text-base font-medium ${move === k ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>{label}</button>
            ))}
          </div>
          {moves.length > 0 ? (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {moves.slice(0, visible).map(t => {
                const incoming = t.type === 'STOCK_IN';
                return (
                  <li key={t.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-ink">{t.productName}</p>
                      <p className="text-base text-ink-muted">{[day(t.date), incoming ? (isPlace(t.targetFarm) ? `to ${t.targetFarm}` : 'from supplier') : (isPlace(t.sourceFarm) ? `from ${t.sourceFarm}` : 'daily ration'), t.referenceNo].filter(Boolean).join(' · ')}</p>
                      {t.notes && <p className="mt-1 text-base text-ink">{t.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-semibold ${incoming ? 'text-emerald-700' : 'text-ink'}`}>{incoming ? '+' : '−'}{amountText(productById.get(t.productId), t.quantityBags)}</p>
                      {feedUnit(productById.get(t.productId)) !== 'kg' && <p className="text-base text-ink-muted">{num(t.quantityKg)} kg</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No movements match.</p>
          )}
          {moves.length > visible && <div className="flex justify-center"><Button size="lg" variant="outline" onClick={() => setVisible(v => v + PAGE)}>Show more ({moves.length - visible} left)</Button></div>}
          {canManage && <div><Button variant="ghost" onClick={() => setUseOpen(true)}>Take feed out by hand</Button></div>}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-3">
          {canAddProduct(currentUser) && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setProductModal({ open: true, product: null })}><Plus /> Add feed</Button>
              {canManage && <Button variant="outline" onClick={() => setCategoryOpen(true)}><Settings /> Kinds of feed</Button>}
            </div>
          )}
          {!canManage && canAddProduct(currentUser) && <p className="text-base text-ink-muted">Feeds marked Default are set by the office and cannot be changed. You can add and change your own.</p>}
          {productRows.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No feed products match.</p>
          ) : (
            <ul className="space-y-3">
              {productRows.map(p => (
                <li key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xl font-semibold text-ink">
                      {p.name}
                      <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${isDefaultProduct(p) ? 'bg-slate-100 text-ink-muted' : 'bg-emerald-100 text-emerald-800'}`}>{isDefaultProduct(p) ? 'Default' : currentUser?.farmLocation ? 'Your farm' : p.ownerFarm}</span>
                    </p>
                    <p className="text-base text-ink-muted">{[p.category, feedUnit(p) === 'kg' ? 'counted in kg' : `${p.weightPerUnit} kg per ${feedUnit(p)}`].filter(Boolean).join(' · ')}</p>
                    <p className="text-base text-ink">{feedUnit(p) === 'kg' ? `${riel(p.unitCost)} a kg` : `${riel(p.costPerBag || p.unitCost * p.weightPerUnit)} a ${feedUnit(p)} · ${riel(p.unitCost)} a kg`}</p>
                    <p className="text-base text-ink-muted">{p.trackStock === false ? 'Grown or cut on the farm, not kept as stock' : `Warn below ${amountText(p, p.minThresholdBags || 50)}`}{p.supplier ? ` · ${p.supplier}` : ''}</p>
                  </div>
                  {canEditProduct(currentUser, p) && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setProductModal({ open: true, product: p })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => askDelete(p)}><Trash2 className="text-rose-700" /></Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <FeedProductFlow
        isOpen={productModal.open}
        onClose={() => setProductModal({ open: false, product: null })}
        onSubmit={onSaveProduct}
        initialProduct={productModal.product}
        categories={data.settings?.feedTypes}
        onManageCategories={canManage ? () => setCategoryOpen(true) : undefined}
      />
      <FeedCategoryModal isOpen={categoryOpen} onClose={() => setCategoryOpen(false)} settings={data.settings} />
      <FeedInFlow
        mode="out"
        isOpen={useOpen}
        onClose={() => setUseOpen(false)}
        products={products}
        farms={farms}
        currentUser={currentUser}
        onSave={onAddTransaction}
      />

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
