'use client';

import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmItem, UserRoleItem } from '@/lib/types';
import type { StockItem, WeightRecord } from '@/lib/xlsx-parser';
import { hasPermission, format2DecimalsWithCommas } from '@/lib/utils';
import { sickCattle, weighSchedules } from '@/lib/attention';
import { growth, weighPoints } from '@/lib/cattle-stats';
import { exportToExcel } from '@/lib/excel-export';
import { useOnChange } from '@/hooks/useOnChange';

interface CattleListProps {
  stock: StockItem[];
  weightTracking: WeightRecord[];
  onViewDetails: (cowId: string) => void;
  onAddCowClick?: () => void;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

type Status = 'Active' | 'Sold' | 'All';

const PAGE = 12;
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const kgText = (n: number) => `${Math.round(n * 10) / 10} kg`;

const SELECT = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';

export default function CattleList({ stock, weightTracking, onViewDetails, onAddCowClick, currentUser, farms = [] }: CattleListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('Active');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [farm, setFarm] = useState('');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visible, setVisible] = useState(PAGE);

  useOnChange(JSON.stringify([search, status, attentionOnly, farm, breed, sex, startDate, endDate]), () => setVisible(PAGE));

  const farmName = (loc?: string) => {
    const l = loc?.trim();
    if (!l) return '';
    return farms.find(f => f.id === l || norm(f.name) === norm(l))?.name ?? l;
  };

  // Weights grouped once so each card does not scan every record.
  const byCow = useMemo(() => {
    const map = new Map<string, WeightRecord[]>();
    for (const r of weightTracking) {
      const list = map.get(r.cowId);
      if (list) list.push(r); else map.set(r.cowId, [r]);
    }
    return map;
  }, [weightTracking]);

  const stats = useMemo(() => {
    const map = new Map<string, ReturnType<typeof growth>>();
    for (const c of stock) map.set(c.id, growth(c, weighPoints(c.id, byCow.get(c.id) ?? [], c.purchaseDate)));
    return map;
  }, [stock, byCow]);

  // Active animals that need something done: overdue to weigh, or unwell.
  const attention = useMemo(() => {
    const flags = new Map<string, 'sick' | 'weigh' | 'never'>();
    for (const s of weighSchedules({ stock, weightTracking })) {
      if (s.status === 'overdue') flags.set(s.cowId, s.daysElapsed === 999 ? 'never' : 'weigh');
    }
    for (const c of sickCattle(stock)) flags.set(c.id, 'sick');
    return flags;
  }, [stock, weightTracking]);

  const counts = useMemo(() => ({
    Active: stock.filter(s => norm(s.status) === 'active').length,
    Sold: stock.filter(s => norm(s.status) === 'sold').length,
    All: stock.length,
  }), [stock]);

  const showFarmFilter = !currentUser?.farmLocation && farms.length > 0;
  const breeds = useMemo(() => [...new Set(stock.map(s => s.breed).filter(Boolean))].sort(), [stock]);
  const sexes = useMemo(() => [...new Set(stock.map(s => s.sex).filter(Boolean))], [stock]);

  const filtered = useMemo(() => {
    const q = norm(search);
    return stock
      .filter(c => {
        if (status !== 'All' && norm(c.status) !== norm(status)) return false;
        if (attentionOnly && !attention.has(c.id)) return false;
        if (farm && farmName(c.location) !== farm) return false;
        if (breed && c.breed !== breed) return false;
        if (sex && norm(c.sex) !== norm(sex)) return false;
        const day = c.purchaseDate?.split('T')[0];
        if (day && ((startDate && day < startDate) || (endDate && day > endDate))) return false;
        return !q || norm(c.id).includes(q) || norm(c.ownerName).includes(q) || norm(farmName(c.location)).includes(q);
      })
      // Newest arrivals first, then the highest tag.
      .sort((a, b) => {
        const da = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        const db = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        return da !== db ? db - da : b.id.localeCompare(a.id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, search, status, attentionOnly, attention, farm, breed, sex, startDate, endDate, farms]);

  const activeFilters = [farm, breed, sex, startDate, endDate].filter(Boolean).length;
  const clearAll = () => { setSearch(''); setStatus('Active'); setAttentionOnly(false); setFarm(''); setBreed(''); setSex(''); setStartDate(''); setEndDate(''); };
  const anyChange = search || status !== 'Active' || attentionOnly || activeFilters > 0;
  const attentionCount = [...attention.keys()].filter(id => stock.find(c => c.id === id && norm(c.status) === 'active')).length;

  const exportList = () => exportToExcel({
    filename: `CC_Livestock_Cattle_Herd_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Cattle Herd Inventory',
    data: filtered,
    columns: [
      { header: 'Cattle ID', key: 'id' },
      { header: 'Farm Location', key: 'location', formatter: (val) => farmName(val) || 'N/A' },
      { header: 'Breed', key: 'breed' },
      { header: 'Sex', key: 'sex' },
      { header: 'Initial Weight (kg)', key: 'id', formatter: (_, row) => stats.get(row.id)?.startWeight ?? row.weight },
      { header: 'Current Weight (kg)', key: 'id', formatter: (_, row) => stats.get(row.id)?.currentWeight ?? row.weight },
      { header: 'Weight Gain (kg)', key: 'id', formatter: (_, row) => stats.get(row.id)?.gain ?? 0 },
      { header: 'Purchase Price (៛)', key: 'totalPrice', formatter: (val) => val ? `៛ ${format2DecimalsWithCommas(val)}` : 'N/A' },
      { header: 'Health Status', key: 'healthStatus' },
      { header: 'Stock Status', key: 'status' },
      { header: 'Purchase Date', key: 'purchaseDate', formatter: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
    ],
  });

  const shown = filtered.slice(0, visible);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Cattle</h2>
          <p className="text-base text-ink-muted">{counts.Active} active · {counts.Sold} sold</p>
        </div>
        {onAddCowClick && hasPermission(currentUser, 'stock_create') && (
          <Button size="lg" onClick={onAddCowClick}><Plus /> Add cattle</Button>
        )}
      </div>

      {/* Search, then one row of simple choices. Everything else sits behind Filters. */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by tag number or seller" aria-label="Search cattle" className="h-14 pl-11 text-lg" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Show" className="flex rounded-xl bg-slate-100 p-1">
            {(['Active', 'Sold', 'All'] as Status[]).map(s => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={`min-h-11 rounded-lg px-4 text-base font-medium ${status === s ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              >
                {s} ({counts[s]})
              </button>
            ))}
          </div>

          {attentionCount > 0 && (
            <button
              type="button"
              aria-pressed={attentionOnly}
              onClick={() => { setAttentionOnly(v => !v); if (!attentionOnly) setStatus('Active'); }}
              className={`min-h-11 rounded-xl border-2 px-4 text-base font-medium ${attentionOnly ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-ink hover:border-amber-500'}`}
            >
              Needs attention ({attentionCount})
            </button>
          )}

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
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">Farm</span>
                <select value={farm} onChange={e => setFarm(e.target.value)} className={SELECT}>
                  <option value="">All farms</option>
                  {farms.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">Breed</span>
              <select value={breed} onChange={e => setBreed(e.target.value)} className={SELECT}>
                <option value="">All breeds</option>
                {breeds.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">Sex</span>
              <select value={sex} onChange={e => setSex(e.target.value)} className={SELECT}>
                <option value="">Male and female</option>
                {sexes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">Arrived from</span>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 text-lg" />
              </label>
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">Arrived until</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 text-lg" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="button" variant="outline" onClick={exportList} disabled={filtered.length === 0}><Download /> Download Excel</Button>
              {activeFilters > 0 && <Button type="button" variant="ghost" onClick={() => { setFarm(''); setBreed(''); setSex(''); setStartDate(''); setEndDate(''); }}><X /> Clear filters</Button>}
            </div>
          </div>
        )}
      </div>

      {filtered.length > 0 && <p className="text-base text-ink-muted" aria-live="polite">{filtered.length === 1 ? '1 animal' : `${filtered.length} animals`}</p>}

      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(c => {
            const g = stats.get(c.id);
            const flag = norm(c.status) === 'active' ? attention.get(c.id) : undefined;
            const isSick = flag === 'sick';
            const st = norm(c.status);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onViewDetails(c.id)}
                  className="flex h-full w-full flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-2xl font-semibold text-ink">{c.id}</span>
                    {st === 'active' ? (
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${isSick ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{c.healthStatus || 'Active'}</span>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${st === 'dead' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-ink'}`}>{c.status}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg text-ink">{[c.sex, c.breed].filter(Boolean).join(' · ') || '—'}</p>
                    <p className="text-base text-ink-muted">{farmName(c.location) || 'No farm set'}</p>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xl font-semibold text-ink">{g ? kgText(g.currentWeight) : '—'}</p>
                      {g && g.gain !== 0 && (
                        <p className={`text-base font-medium ${g.gain < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{g.gain > 0 ? '+' : ''}{Math.round(g.gain * 10) / 10} kg</p>
                      )}
                    </div>
                    {flag && flag !== 'sick' && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">{flag === 'never' ? 'Never weighed' : 'Time to weigh'}</span>
                    )}
                    {isSick && <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800">Needs a look</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-lg text-ink-muted">{stock.length === 0 ? 'No cattle yet.' : 'No cattle match what you chose.'}</p>
          {anyChange ? <Button variant="outline" onClick={clearAll}>Show all active cattle</Button>
            : onAddCowClick && hasPermission(currentUser, 'stock_create') && <Button onClick={onAddCowClick}><Plus /> Add cattle</Button>}
        </div>
      )}

      {filtered.length > visible && (
        <div className="flex justify-center">
          <Button size="lg" variant="outline" onClick={() => setVisible(v => v + PAGE)}>Show more ({filtered.length - visible} left)</Button>
        </div>
      )}
    </div>
  );
}
