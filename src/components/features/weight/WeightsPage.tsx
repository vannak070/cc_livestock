'use client';

import React, { useMemo, useState } from 'react';
import { Download, Pencil, Scale, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import type { WeightRecord } from '@/lib/xlsx-parser';
import { getErrorMessage, hasPermission } from '@/lib/utils';
import { weighSchedules } from '@/lib/attention';
import { growth, weighPoints } from '@/lib/cattle-stats';
import { batchWeighIns } from '@/lib/batch-stats';
import { exportToExcel } from '@/lib/excel-export';
import { useOnChange } from '@/hooks/useOnChange';
import { Choice, NUM } from '../flow/FlowShell';
import { FarmSelect } from '@/components/ui/listbox-select';

interface WeightsPageProps {
  data: ERPLivestockData;
  onOpenLogWeight: (cowId?: string) => void;
  /** Opens the group weigh-in for a batch. */
  onWeighBatch?: (batchId: string) => void;
  onDeleteWeightRecord?: (cowId: string, trackingDate: string) => Promise<void>;
  onUpdateWeightRecord?: (cowId: string, trackingDate: string, currentWeight: number, healthStatus: string) => Promise<void>;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

type Tab = 'due' | 'batches' | 'growth' | 'history';

const PAGE = 15;
const SELECT = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const r1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number) => `${n > 0 ? '+' : ''}${r1(n)}`;
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

export default function WeightsPage({ data, onOpenLogWeight, onWeighBatch, onDeleteWeightRecord, onUpdateWeightRecord, currentUser, farms = [] }: WeightsPageProps) {
  const [tab, setTab] = useState<Tab>('due');
  const [showAllDue, setShowAllDue] = useState(false);
  const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [farm, setFarm] = useState('');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [editing, setEditing] = useState<{ cowId: string; trackingDate: string; weight: string; health: string } | null>(null);
  const [editError, setEditError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'success'; confirmText: string; onConfirm?: () => void }>(null);

  useOnChange(JSON.stringify([tab, batchId, farm, query, startDate, endDate]), () => setVisible(PAGE));

  const canWeigh = hasPermission(currentUser, 'weight_record');
  const canDelete = !!onDeleteWeightRecord && hasPermission(currentUser, 'weight_delete');
  const showFarmFilter = !currentUser?.farmLocation && farms.length > 0;
  const batches = useMemo(() => data.batches || [], [data.batches]);
  const healthStatuses = data.settings?.healthStatuses?.length ? data.settings.healthStatuses : ['Good', 'Fair', 'Poor'];

  const batchOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of batches) for (const id of b.cowIds) map.set(id, b.id);
    return map;
  }, [batches]);
  const cowById = useMemo(() => new Map(data.stock.map(c => [c.id, c])), [data.stock]);

  const inScope = (cowId: string) => {
    const cow = cowById.get(cowId);
    if (farm && cow?.location !== farm) return false;
    if (batchId && batchOf.get(cowId) !== batchId) return false;
    return true;
  };

  const activeScoped = useMemo(
    () => data.stock.filter(c => norm(c.status) === 'active' && inScope(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.stock, farm, batchId, batchOf]
  );

  const byCow = useMemo(() => {
    const map = new Map<string, WeightRecord[]>();
    for (const r of data.weightTracking) {
      const list = map.get(r.cowId);
      if (list) list.push(r); else map.set(r.cowId, [r]);
    }
    return map;
  }, [data.weightTracking]);

  const schedules = useMemo(() => weighSchedules({ stock: activeScoped, weightTracking: data.weightTracking }), [activeScoped, data.weightTracking]);
  const due = schedules.filter(s => s.status !== 'weighed');
  const upToDate = schedules.filter(s => s.status === 'weighed');

  const growthRows = useMemo(() => {
    return activeScoped
      .map(c => ({ cow: c, g: growth(c, weighPoints(c.id, byCow.get(c.id) ?? [], c.purchaseDate)) }))
      .filter(x => x.g.perDay !== null);
  }, [activeScoped, byCow]);

  const avgWeight = activeScoped.length ? activeScoped.reduce((sum, c) => sum + (growthRows.find(x => x.cow.id === c.id)?.g.currentWeight ?? c.weight ?? 0), 0) / activeScoped.length : 0;
  const avgGain = growthRows.length ? growthRows.reduce((sum, x) => sum + (x.g.perDay ?? 0), 0) / growthRows.length : null;

  const ranked = [...growthRows].sort((a, b) => (b.g.perDay ?? 0) - (a.g.perDay ?? 0));
  const fastest = ranked.slice(0, 5);
  const slowest = ranked.length > 5 ? ranked.slice(-Math.min(5, ranked.length - 5)).reverse() : [];

  const history = useMemo(() => {
    const q = norm(query);
    return data.weightTracking
      .filter(r => inScope(r.cowId))
      .filter(r => !q || norm(r.cowId).includes(q))
      .filter(r => {
        const d = r.trackingDate?.slice(0, 10);
        if (!d) return true;
        return !((startDate && d < startDate) || (endDate && d > endDate));
      })
      .sort((a, b) => (b.trackingDate ?? '').localeCompare(a.trackingDate ?? '') || a.cowId.localeCompare(b.cowId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weightTracking, query, startDate, endDate, farm, batchId, batchOf, cowById]);

  // Each active batch (narrowed by the farm and batch filters) with its weigh-ins over time.
  const batchRows = useMemo(
    () => batches
      .filter(b => b.status === 'Active' && (!batchId || b.id === batchId))
      .filter(b => !farm || b.farmLocation === farm)
      .map(batch => ({ batch, head: batch.cowIds.filter(id => norm(cowById.get(id)?.status) === 'active').length, weighIns: batchWeighIns(batch, data.weightTracking) }))
      .sort((a, b) => a.batch.name.localeCompare(b.batch.name)),
    [batches, batchId, farm, cowById, data.weightTracking]
  );

  const activeFilters = [batchId, farm, startDate, endDate].filter(Boolean).length;

  const exportHistory = () => exportToExcel({
    filename: `CC_Livestock_Weight_Tracking_History_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Weight Tracking History',
    data: history,
    columns: [
      { header: 'Cow ID', key: 'cowId' },
      { header: 'Breed', key: 'breed' },
      { header: 'Tracking Date', key: 'trackingDate', formatter: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
      { header: 'Previous Weight (kg)', key: 'oldWeight' },
      { header: 'Current Weight (kg)', key: 'currentWeight' },
      { header: 'Weight Change (%)', key: 'gainLoss', formatter: (val) => `${val > 0 ? '+' : ''}${(val * 100).toFixed(1)}%` },
      { header: 'Health Status', key: 'status' },
    ],
  });

  const saveEdit = async () => {
    if (!editing || !onUpdateWeightRecord) return;
    const kg = Number(editing.weight);
    if (!(kg > 0)) { setEditError('Type the weight in kg.'); return; }
    try {
      await onUpdateWeightRecord(editing.cowId, editing.trackingDate, kg, editing.health);
      setEditing(null);
    } catch (e) {
      setEditError(getErrorMessage(e, 'Could not save. Please try again.'));
    }
  };

  const askDelete = (r: WeightRecord) => setConfirm({
    title: 'Delete this weigh-in?',
    description: `This removes the weight of ${r.cowId} on ${day(r.trackingDate)} (${r.currentWeight} kg). It cannot be undone.`,
    type: 'danger',
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await onDeleteWeightRecord?.(r.cowId, r.trackingDate || '');
      } catch (e) {
        setConfirm({ title: 'Could not delete', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' });
      }
    },
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'due', label: `To weigh (${due.length})` },
    { key: 'batches', label: 'Batches' },
    { key: 'growth', label: 'Growth' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Weights</h2>
          <p className="text-base text-ink-muted">Weigh every 14 days to see who is growing.</p>
        </div>
        {canWeigh && <Button size="lg" onClick={() => onOpenLogWeight()}><Scale /> Weigh</Button>}
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="To weigh" value={String(due.length)} sub={due.length === 0 ? 'All up to date' : 'animals'} tone={due.length > 0 ? 'warn' : undefined} />
        <Tile label="Average weight" value={activeScoped.length ? `${Math.round(avgWeight)} kg` : '—'} sub={`${activeScoped.length} animals`} />
        <Tile label="Daily gain" value={avgGain !== null ? `${r1(avgGain)} kg` : '—'} sub="average each day" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Weights" className="flex flex-1 rounded-xl bg-slate-100 p-1 sm:flex-none">
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
          {batches.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">Batch</span>
              <select value={batchId} onChange={e => setBatchId(e.target.value)} className={SELECT}>
                <option value="">All cattle</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          {tab === 'history' && (
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
                <Button type="button" variant="outline" onClick={exportHistory} disabled={history.length === 0}><Download /> Download Excel</Button>
              </div>
            </>
          )}
          {activeFilters > 0 && (
            <div className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => { setBatchId(''); setFarm(''); setStartDate(''); setEndDate(''); }}>Clear filters</Button>
            </div>
          )}
        </div>
      )}

      {tab === 'due' && (
        <div className="space-y-3">
          {due.length === 0 && (
            <p className="rounded-2xl bg-emerald-50 p-6 text-center text-lg text-emerald-900">Everyone has been weighed recently.</p>
          )}
          <ul className="space-y-3">
            {due.map(s => {
              const cow = cowById.get(s.cowId);
              return (
                <li key={s.cowId} className={`flex items-center justify-between gap-3 rounded-2xl border-2 bg-white p-4 ${s.status === 'overdue' ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-ink">{s.cowId}</p>
                    <p className="text-base text-ink-muted">{[cow?.breed, cow?.weight ? `${cow.weight} kg` : null].filter(Boolean).join(' · ')}</p>
                    <p className={`text-base font-medium ${s.status === 'overdue' ? 'text-amber-800' : 'text-ink-muted'}`}>
                      {s.daysElapsed === 999 ? 'Never weighed' : s.status === 'duesoon' ? `Weigh soon · last ${s.daysElapsed} days ago` : `Last weighed ${s.daysElapsed} days ago`}
                    </p>
                  </div>
                  {canWeigh && <Button onClick={() => onOpenLogWeight(s.cowId)} className="shrink-0"><Scale /> Weigh</Button>}
                </li>
              );
            })}
          </ul>
          {upToDate.length > 0 && (
            <>
              <Button variant="ghost" onClick={() => setShowAllDue(v => !v)}>
                {showAllDue ? 'Hide' : 'Show'} {upToDate.length} up to date
              </Button>
              {showAllDue && (
                <ul className="space-y-2">
                  {upToDate.map(s => (
                    <li key={s.cowId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-lg font-semibold text-ink">{s.cowId}</span>
                      <span className="text-base text-ink-muted">{s.daysElapsed === 0 ? 'Weighed today' : `${s.daysElapsed} days ago`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'batches' && (
        <div className="space-y-3">
          {batchRows.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No batch to show. Add cattle to a batch on the Batches page first.</p>
          ) : batchRows.map(({ batch, head, weighIns }) => {
            const latest = weighIns[0];
            const first = weighIns[weighIns.length - 1];
            const open = openBatches[batch.id] ?? false;
            const shown = open ? weighIns : weighIns.slice(0, 3);
            return (
              <section key={batch.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-ink">{batch.name}</p>
                    <p className="text-base text-ink-muted">{head} {head === 1 ? 'animal' : 'animals'}{batch.farmLocation ? ` · ${batch.farmLocation}` : ''}</p>
                  </div>
                  {canWeigh && onWeighBatch && head > 0 && <Button onClick={() => onWeighBatch(batch.id)} className="shrink-0"><Scale /> Weigh batch</Button>}
                </div>
                {latest ? (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Tile label="Average now" value={`${r1(latest.avg)} kg`} sub={`${latest.head} weighed ${latest.date}`} />
                      <Tile label="Last change" value={latest.change === null ? '—' : `${signed(latest.change)} kg`} sub={latest.perDay === null ? 'needs 2 weigh-ins' : `${signed(latest.perDay)} kg a day`} />
                      <Tile label="Since first" value={weighIns.length > 1 ? `${signed(latest.avg - first.avg)} kg` : '—'} sub={weighIns.length > 1 ? `from ${r1(first.avg)} kg` : 'needs 2 weigh-ins'} />
                    </div>
                    <ul className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                      {shown.map(w => (
                        <li key={w.date} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
                          <span>
                            <span className="block text-lg font-medium text-ink">{w.date}</span>
                            <span className="block text-base text-ink-muted">{w.head} weighed</span>
                          </span>
                          <span className="text-right">
                            <span className="block text-lg font-semibold text-ink">{r1(w.avg)} kg</span>
                            <span className={`block text-base ${w.change !== null && w.change < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{w.change === null ? 'first' : `${signed(w.change)} kg`}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {weighIns.length > 3 && (
                      <Button variant="ghost" className="mt-1" onClick={() => setOpenBatches(o => ({ ...o, [batch.id]: !open }))}>
                        {open ? 'Show fewer' : `Show all ${weighIns.length} weigh-ins`}
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-base text-ink-muted">Not weighed yet.</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {tab === 'growth' && (
        <div className="space-y-6">
          {growthRows.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Growth appears once animals have been weighed on two different days.</p>
          ) : (
            <>
              {[
                { title: 'Growing fastest', rows: fastest, tone: 'text-emerald-700' },
                { title: 'Gaining least', rows: slowest, tone: 'text-amber-800' },
              ].filter(sec => sec.rows.length > 0).map(sec => (
                <section key={sec.title}>
                  <h3 className="mb-2 text-lg font-semibold text-ink">{sec.title}</h3>
                  <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {sec.rows.map(({ cow, g }) => (
                      <li key={cow.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                        <div>
                          <p className="text-lg font-semibold text-ink">{cow.id}</p>
                          <p className="text-base text-ink-muted">{[cow.breed, `${r1(g.currentWeight)} kg`].join(' · ')}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${sec.tone}`}>{g.perDay} kg a day</p>
                          <p className="text-base text-ink-muted">{signed(g.gain)} kg in {g.days} days</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <p className="text-base text-ink-muted">Based on {growthRows.length} animals with two or more weigh-ins. Open an animal under Cattle to see its chart.</p>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by tag number" aria-label="Search weigh-ins" className="h-14 pl-11 text-lg" />
          </div>
          {history.length > 0 ? (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {history.slice(0, visible).map(r => {
                const change = r.oldWeight > 0 ? r1(r.currentWeight - r.oldWeight) : null;
                return (
                  <li key={`${r.cowId}-${r.trackingDate}-${r.currentWeight}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-ink">{r.cowId}</p>
                      <p className="text-base text-ink-muted">{day(r.trackingDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-ink">{r1(r.currentWeight)} kg</p>
                      <p className={`text-base font-medium ${change === null ? 'text-ink-muted' : change < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{change === null ? 'First' : `${signed(change)} kg`}</p>
                    </div>
                    {(canWeigh && onUpdateWeightRecord) || canDelete ? (
                      <div className="flex shrink-0">
                        {canWeigh && onUpdateWeightRecord && (
                          <Button variant="ghost" size="icon" aria-label={`Edit weigh-in of ${r.cowId}`} onClick={() => { setEditError(''); setEditing({ cowId: r.cowId, trackingDate: r.trackingDate || '', weight: String(r.currentWeight), health: r.healthStatus || healthStatuses[0] }); }}><Pencil /></Button>
                        )}
                        {canDelete && <Button variant="ghost" size="icon" aria-label={`Delete weigh-in of ${r.cowId}`} onClick={() => askDelete(r)}><Trash2 className="text-rose-700" /></Button>}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No weigh-ins match.</p>
          )}
          {history.length > visible && (
            <div className="flex justify-center"><Button size="lg" variant="outline" onClick={() => setVisible(v => v + PAGE)}>Show more ({history.length - visible} left)</Button></div>
          )}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={open => { if (!open) setEditing(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold text-ink">Edit weigh-in</DialogTitle>
              <DialogDescription className="text-base text-ink-muted">{editing.cowId} · {day(editing.trackingDate)}</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveEdit(); }} className="space-y-5">
              <label className="block">
                <span className="mb-1 block text-lg font-medium text-ink">Weight (kg)</span>
                <Input type="number" step="any" inputMode="decimal" autoFocus value={editing.weight} onChange={e => { setEditing({ ...editing, weight: e.target.value }); setEditError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
              </label>
              <div>
                <p className="mb-2 text-lg font-medium text-ink">Health</p>
                <div className="flex flex-wrap gap-3">{healthStatuses.map(h => <Choice key={h} selected={editing.health === h} onClick={() => setEditing({ ...editing, health: h })}>{h}</Choice>)}</div>
              </div>
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
