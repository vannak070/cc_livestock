'use client';

import React, { useMemo, useState } from 'react';
import { Download, Pencil, Search, SlidersHorizontal, Syringe, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, FarmItem, HealthLogItem, UserRoleItem } from '@/lib/types';
import { getErrorMessage, hasPermission, format2DecimalsWithCommas } from '@/lib/utils';
import { sickCattle } from '@/lib/attention';
import { exportToExcel } from '@/lib/excel-export';
import { useOnChange } from '@/hooks/useOnChange';
import { Choice, NUM } from '../flow/FlowShell';
import { FarmSelect } from '@/components/ui/listbox-select';
import { useText } from '@/hooks/useText';

interface HealthPageProps {
  data: ERPLivestockData;
  /** Opens the guided Treat dialog, optionally for one animal. */
  onOpenTreat: (cowId?: string) => void;
  onDeleteHealthLog?: (logId: string) => Promise<void>;
  onUpdateHealthLog?: (logId: string, updates: Partial<HealthLogItem>) => Promise<void>;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

type Tab = 'sick' | 'vaccines' | 'history';
type Kind = HealthLogItem['type'];

const PAGE = 15;
const SELECT = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';
/** Kinds are saved in English; the label shown comes from the healthPage section. */
const KIND_KEY: Record<Kind, string> = { Vaccination: 'kindVaccination', Treatment: 'kindTreatment', Deworming: 'kindDeworming', Disease: 'kindDisease' };
const STATUS_KEY: Record<string, string> = { poor: 'statusPoor', sick: 'statusSick', critical: 'statusCritical', quarantine: 'statusQuarantine' };
const KIND_STYLE: Record<Kind, string> = {
  Vaccination: 'bg-emerald-100 text-emerald-800',
  Treatment: 'bg-sky-100 text-sky-900',
  Deworming: 'bg-slate-200 text-ink',
  Disease: 'bg-rose-100 text-rose-800',
};
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');

function daysAgoCutoff(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

export default function HealthPage({ data, onOpenTreat, onDeleteHealthLog, onUpdateHealthLog, currentUser, farms = [] }: HealthPageProps) {
  const { tx, language } = useText('healthPage');
  const kindLabel = (k: Kind) => (KIND_KEY[k] ? tx(KIND_KEY[k]) : k);
  const statusLabel = (s: string) => (language !== 'en' && STATUS_KEY[norm(s)] ? tx(STATUS_KEY[norm(s)]) : s);
  const [tab, setTab] = useState<Tab>('sick');
  const [showFilters, setShowFilters] = useState(false);
  const [farm, setFarm] = useState('');
  const [batchId, setBatchId] = useState('');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [openVaccine, setOpenVaccine] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; type: Kind; name: string; date: string; by: string; cost: string; notes: string } | null>(null);
  const [editError, setEditError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  useOnChange(JSON.stringify([tab, farm, batchId, kind, query, startDate, endDate]), () => setVisible(PAGE));

  const canTreat = hasPermission(currentUser, 'health_record');
  const canDelete = !!onDeleteHealthLog && hasPermission(currentUser, 'health_delete');
  const showFarmFilter = !currentUser?.farmLocation && farms.length > 0;
  const batches = useMemo(() => data.batches || [], [data.batches]);
  const vaccineTypes = useMemo(() => data.settings?.vaccineTypes ?? [], [data.settings?.vaccineTypes]);

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
  const scopedLogs = useMemo(
    () => data.healthLogs.filter(l => inScope(l.cowId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.healthLogs, farm, batchId, batchOf, cowById]
  );

  const sick = useMemo(() => sickCattle(activeScoped), [activeScoped]);
  const lastLogByCow = useMemo(() => {
    const map = new Map<string, HealthLogItem>();
    for (const l of data.healthLogs) {
      const cur = map.get(l.cowId);
      if (!cur || l.date > cur.date) map.set(l.cowId, l);
    }
    return map;
  }, [data.healthLogs]);

  const cutoff = daysAgoCutoff(30);
  const recent = scopedLogs.filter(l => day(l.date) >= cutoff);
  const recentCost = recent.reduce((s, l) => s + (l.cost || 0), 0);

  // For each vaccine in Settings: who has had it, and when it was last given.
  const coverage = useMemo(() => {
    const activeIds = new Set(activeScoped.map(c => c.id));
    return vaccineTypes.map(name => {
      const given = scopedLogs.filter(l => l.type === 'Vaccination' && norm(l.name) === norm(name));
      const done = new Set(given.map(l => l.cowId).filter(id => activeIds.has(id)));
      const last = given.reduce((m, l) => (l.date > m ? l.date : m), '');
      const missing = activeScoped.filter(c => !done.has(c.id)).map(c => c.id);
      return { name, done: done.size, total: activeScoped.length, last, missing };
    });
  }, [vaccineTypes, scopedLogs, activeScoped]);

  const history = useMemo(() => {
    const q = norm(query);
    return scopedLogs
      .filter(l => !kind || l.type === kind)
      .filter(l => !q || norm(l.cowId).includes(q) || norm(l.name).includes(q))
      .filter(l => {
        const d = day(l.date);
        return !((startDate && d < startDate) || (endDate && d > endDate));
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [scopedLogs, kind, query, startDate, endDate]);

  const activeFilters = [farm, batchId, kind, startDate, endDate].filter(Boolean).length;

  const exportHistory = () => exportToExcel({
    filename: `CC_Livestock_Health_Medical_Logs_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Health Medical Logs',
    data: history,
    columns: [
      { header: 'Log ID', key: 'id' },
      { header: 'Cow ID', key: 'cowId' },
      { header: 'Event Type', key: 'type' },
      { header: 'Vaccine / Diagnostic Name', key: 'name' },
      { header: 'Tracking Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
      { header: 'Administered By', key: 'administeredBy' },
      { header: 'Cost (៛)', key: 'cost', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` },
      { header: 'Medical Notes', key: 'notes', formatter: (val) => val || '-' },
    ],
  });

  const saveEdit = async () => {
    if (!editing || !onUpdateHealthLog) return;
    if (!editing.name.trim()) { setEditError(tx('errName')); return; }
    if (!editing.by.trim()) { setEditError(tx('errBy')); return; }
    try {
      await onUpdateHealthLog(editing.id, { type: editing.type, name: editing.name.trim(), date: editing.date, administeredBy: editing.by.trim(), cost: Number(editing.cost) || 0, notes: editing.notes.trim() });
      setEditing(null);
    } catch (e) {
      setEditError(getErrorMessage(e, tx('errSave')));
    }
  };

  const askDelete = (l: HealthLogItem) => setConfirm({
    title: tx('delTitle'),
    description: tx('delDesc', { name: l.name, tag: l.cowId, date: day(l.date) }),
    type: 'danger',
    confirmText: tx('delete'),
    onConfirm: async () => {
      try {
        await onDeleteHealthLog?.(l.id);
      } catch (e) {
        setConfirm({ title: tx('delFailTitle'), description: getErrorMessage(e, tx('delFail')), type: 'danger', confirmText: tx('ok') });
      }
    },
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sick', label: tx('tabSick', { n: sick.length }) },
    { key: 'vaccines', label: tx('tabVaccines') },
    { key: 'history', label: tx('tabHistory') },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{tx('title')}</h2>
          <p className="text-base text-ink-muted">{tx('intro')}</p>
        </div>
        {canTreat && <Button size="lg" onClick={() => onOpenTreat()}><Syringe /> {tx('treat')}</Button>}
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label={tx('tileSick')} value={String(sick.length)} sub={sick.length === 0 ? tx('allWell') : tx('animals')} tone={sick.length > 0 ? 'bad' : undefined} />
        <Tile label={tx('tileRecent')} value={String(recent.length)} sub={tx('treatments')} />
        <Tile label={tx('tileCost')} value={riel(recentCost)} sub={tx('last30')} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={tx('tabsAria')} className="flex flex-1 rounded-xl bg-slate-100 p-1 sm:flex-none">
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
          <SlidersHorizontal className="h-5 w-5" aria-hidden /> {tx('filters')}{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          {showFarmFilter && (
            <div className="block">
              <span className="mb-1 block text-base font-medium text-ink">{tx('farm')}</span>
              <FarmSelect farms={farms.map(f => f.name)} value={farm} onChange={setFarm} />
            </div>
          )}
          {batches.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-base font-medium text-ink">{tx('batch')}</span>
              <select value={batchId} onChange={e => setBatchId(e.target.value)} className={SELECT}>
                <option value="">{tx('allCattle')}</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          {tab === 'history' && (
            <>
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">{tx('type')}</span>
                <select value={kind} onChange={e => setKind(e.target.value)} className={SELECT}>
                  <option value="">{tx('allTypes')}</option>
                  {(Object.keys(KIND_KEY) as Kind[]).map(k => <option key={k} value={k}>{kindLabel(k)}</option>)}
                </select>
              </label>
              <div className="hidden sm:block" />
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">{tx('fromDate')}</span>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-12 text-lg" />
              </label>
              <label className="block">
                <span className="mb-1 block text-base font-medium text-ink">{tx('untilDate')}</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-12 text-lg" />
              </label>
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={exportHistory} disabled={history.length === 0}><Download /> {tx('download')}</Button>
              </div>
            </>
          )}
          {activeFilters > 0 && (
            <div className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => { setFarm(''); setBatchId(''); setKind(''); setStartDate(''); setEndDate(''); }}>{tx('clearFilters')}</Button>
            </div>
          )}
        </div>
      )}

      {tab === 'sick' && (
        sick.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 p-6 text-center text-lg text-emerald-900">{tx('noneSick')}</p>
        ) : (
          <ul className="space-y-3">
            {sick.map(c => {
              const last = lastLogByCow.get(c.id);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-white p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xl font-semibold text-ink">{c.id}</p>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800">{statusLabel(c.healthStatus)}</span>
                    </div>
                    <p className="text-base text-ink-muted">{[c.breed, c.location].filter(Boolean).join(' · ')}</p>
                    <p className="text-base text-ink">{last ? tx('lastTreat', { name: last.name, date: day(last.date) }) : tx('noTreatYet')}</p>
                  </div>
                  {canTreat && <Button onClick={() => onOpenTreat(c.id)} className="shrink-0"><Syringe /> {tx('treat')}</Button>}
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'vaccines' && (
        coverage.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('noVaccines')}</p>
        ) : (
          <ul className="space-y-3">
            {coverage.map(v => {
              const pct = v.total ? Math.round((v.done / v.total) * 100) : 0;
              const open = openVaccine === v.name;
              return (
                <li key={v.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">{v.name}</p>
                      <p className="text-base text-ink-muted">{v.last ? tx('lastGiven', { date: day(v.last) }) : tx('neverGiven')}</p>
                    </div>
                    <p className="shrink-0 text-lg font-semibold text-ink">{tx('doneOf', { done: v.done, total: v.total })}</p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={tx('vaccAria', { name: v.name, pct })}>
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                  {v.missing.length > 0 ? (
                    <>
                      <button type="button" aria-expanded={open} onClick={() => setOpenVaccine(open ? null : v.name)} className="mt-3 min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline">
                        {tx(open ? 'hideMissing' : 'seeMissing', { n: v.missing.length })}
                      </button>
                      {open && <p className="mt-1 break-words text-base text-ink">{v.missing.join(', ')}</p>}
                    </>
                  ) : (
                    <p className="mt-3 text-base font-medium text-emerald-800">{tx('allVaccinated')}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('searchPlaceholder')} aria-label={tx('searchAria')} className="h-14 pl-11 text-lg" />
          </div>
          {history.length > 0 ? (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {history.slice(0, visible).map(l => (
                <li key={l.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-ink">{l.cowId}</p>
                      <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${KIND_STYLE[l.type] ?? 'bg-slate-200 text-ink'}`}>{kindLabel(l.type)}</span>
                    </div>
                    <p className="text-base font-medium text-ink">{l.name}</p>
                    <p className="text-base text-ink-muted">{[day(l.date), l.administeredBy, l.cost > 0 ? riel(l.cost) : null].filter(Boolean).join(' · ')}</p>
                    {l.notes && <p className="mt-1 text-base text-ink">{l.notes}</p>}
                  </div>
                  {(canTreat && onUpdateHealthLog) || canDelete ? (
                    <div className="flex shrink-0">
                      {canTreat && onUpdateHealthLog && (
                        <Button variant="ghost" size="icon" aria-label={tx('editAria', { tag: l.cowId })} onClick={() => { setEditError(''); setEditing({ id: l.id, type: l.type, name: l.name, date: day(l.date), by: l.administeredBy, cost: String(l.cost || ''), notes: l.notes ?? '' }); }}><Pencil /></Button>
                      )}
                      {canDelete && <Button variant="ghost" size="icon" aria-label={tx('deleteAria', { tag: l.cowId })} onClick={() => askDelete(l)}><Trash2 className="text-rose-700" /></Button>}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('noMatch')}</p>
          )}
          {history.length > visible && (
            <div className="flex justify-center"><Button size="lg" variant="outline" onClick={() => setVisible(v => v + PAGE)}>{tx('showMore', { n: history.length - visible })}</Button></div>
          )}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={open => { if (!open) setEditing(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold text-ink">{tx('editTitle')}</DialogTitle>
              <DialogDescription className="text-base text-ink-muted">{tx('editSub')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveEdit(); }} className="space-y-4">
              <div>
                <p className="mb-2 text-lg font-medium text-ink">{tx('type')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(KIND_KEY) as Kind[]).map(k => <Choice key={k} selected={editing.type === k} onClick={() => setEditing({ ...editing, type: k })}>{kindLabel(k)}</Choice>)}
                </div>
              </div>
              <label className="block"><span className="mb-1 block text-lg font-medium text-ink">{tx('name')}</span><Input value={editing.name} onChange={e => { setEditing({ ...editing, name: e.target.value }); setEditError(''); }} className="h-14 text-lg" /></label>
              <label className="block"><span className="mb-1 block text-lg font-medium text-ink">{tx('givenBy')}</span><Input value={editing.by} onChange={e => { setEditing({ ...editing, by: e.target.value }); setEditError(''); }} className="h-14 text-lg" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-lg font-medium text-ink">{tx('date')}</span><Input type="date" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} className="h-14 text-lg" /></label>
                <label className="block"><span className="mb-1 block text-lg font-medium text-ink">{tx('cost')}</span><Input type="number" step="any" inputMode="numeric" value={editing.cost} onChange={e => setEditing({ ...editing, cost: e.target.value })} className={`h-14 text-lg ${NUM}`} /></label>
              </div>
              <label className="block"><span className="mb-1 block text-lg font-medium text-ink">{tx('note')}</span><Input value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} className="h-14 text-lg" /></label>
              {editError && <p role="alert" className="text-base font-medium text-rose-700">{editError}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" size="lg" onClick={() => setEditing(null)}>{tx('cancel')}</Button>
                <Button type="submit" size="lg" className="flex-1">{tx('save')}</Button>
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
