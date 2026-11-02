'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ERPLivestockData, FarmItem } from '@/lib/types';
import { PACK_SECTIONS, buildReportPack, type PackSection } from '@/lib/report-pack';
import { buildControlDashboard } from '@/lib/control-dashboard';
import { farmToday } from '@/lib/daily-feed';
import { monthLabel } from '@/lib/khmer-date';
import { taskViews } from '@/lib/ops-view';
import { PRINT_WIDTH, printSheet } from '@/lib/print-sheet';
import type { ActiveTabType } from '../../../layout/SidebarLayout';
import { shiftMonth } from '@/lib/billing';
import MonthPicker from '../hub/MonthPicker';
import { buildFinance } from '@/lib/finance-report';
import { lastDayOf } from '@/lib/ops-calendar';
import { farmLedger } from '@/lib/trade-ledger';
import { useActionPlansView } from '@/hooks/useActionPlansView';
import { useCamcowStock } from '@/hooks/useCamcowStock';
import { summarizeStock } from '@/lib/camcow-stock';
import { shareCosts } from '@/lib/camcow-costs';
import { buyerAccounts } from '@/lib/camcow-buyers';
import { useMyFarmMoney } from '@/hooks/useMyFarmMoney';
import { useOpsPrograms } from '@/hooks/useOpsPrograms';
import { useText, useValueText } from '@/hooks/useText';
import ReportSheet from './ReportSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cattle, batches and sales narrowed to the chosen farm. */
  data: ERPLivestockData;
  /** Everything (feed and costs are company-wide). */
  fullData: ERPLivestockData;
  farms: FarmItem[];
  farm: string;
  /** Which parts this person may include. */
  allowed: PackSection[];
  /** The parts ticked to start with (all the parts this person may include, when empty). */
  initial?: PackSection[];
  /** The month the report page is showing (YYYY-MM). */
  initialMonth?: string;
  /** A Farm Owner: the money statement comes from their own farm's program only. */
  ownerMode?: boolean;
  /** Opens a page (Cattle, Weights...) from the Excel list. */
  onNavigateToTab?: (tab: ActiveTabType) => void;
}

const SECTION_KEYS: Record<PackSection, [string, string]> = {
  overview: ['secOverview', 'secOverviewHint'], management: ['secManagement', 'secManagementHint'], stock: ['secStock', 'secStockHint'], finance: ['secFinance', 'secFinanceHint'],
  work: ['secWork', 'secWorkHint'], cattle: ['secCattle', 'secCattleHint'], money: ['secMoney', 'secMoneyHint'],
};

/** Reports > Download report: Management picks the parts, the months and (through "Working on") the farm, and gets a CamCow-branded PDF. */
export default function ReportPdfDialog(props: Props) {
  // Mounted only while open, so the action-plan figures are fetched only when someone asks for the report.
  return props.open ? <Builder {...props} /> : null;
}

function Builder({ onClose, data, fullData, farms, farm, allowed, initial, initialMonth, ownerMode, onNavigateToTab }: Props) {
  const { tx, language } = useText('reportPdf');
  const value = useValueText();
  const today = farmToday();
  const thisMonth = today.slice(0, 7);
  // Quick choices: the three reports people ask for most. The open tab decides which one starts selected.
  type Preset = { key: string; label: string; hint: string; parts: PackSection[]; months: number };
  const presets: Preset[] = ([
    { key: 'monthly', label: tx('presetMonthly'), hint: tx('presetMonthlyHint'), parts: ['overview', 'management', 'finance', 'work', 'money'], months: 0 },
    { key: 'cattleMoney', label: tx('presetCattleMoney'), hint: tx('presetCattleMoneyHint'), parts: ['overview', 'cattle', 'money'], months: 2 },
    { key: 'work', label: tx('presetWork'), hint: tx('presetWorkHint'), parts: ['work'], months: 0 },
  ] as Preset[]).map(p => ({ ...p, parts: p.parts.filter(x => allowed.includes(x)) })).filter(p => p.parts.length > 0);
  const month0 = initialMonth ?? thisMonth;
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<PackSection[]>(() => (initial?.length ? PACK_SECTIONS.filter(x => allowed.includes(x) && initial.includes(x)) : PACK_SECTIONS.filter(x => allowed.includes(x))));
  const [from, setFrom] = useState(month0);
  const [to, setTo] = useState(month0);
  const root = useRef<HTMLDivElement>(null);

  const applyPreset = (p: Preset) => { setPresetKey(p.key); setPicked(p.parts); setTo(thisMonth); setFrom(shiftMonth(thisMonth, -p.months)); };
  const excel: [string, ActiveTabType][] = [['xlCattle', 'cow-inventory'], ['xlWeights', 'weight-tracking'], ['xlHealth', 'health-tracking'], ['xlFeed', 'feed-inventory'], ['xlSales', 'sales-finance']];

  const needsDash = picked.includes('work') || picked.includes('management');
  const needsOps = needsDash || picked.includes('finance');
  const view = useActionPlansView(needsDash ? to : undefined);
  const needsStock = !ownerMode && (picked.includes('stock') || picked.includes('management'));
  const stockQuery = useCamcowStock(needsStock);
  const holdings = useMemo(() => (stockQuery.data?.holdings ?? []).filter(h => !farm || h.sourceFarm === farm), [stockQuery.data, farm]);
  const buyers = useMemo(() => (stockQuery.data && !farm ? buyerAccounts(stockQuery.data.holdings, stockQuery.data.buyers) : []), [stockQuery.data, farm]);
  const costOf = useMemo(() => shareCosts(stockQuery.data?.holdings ?? [], stockQuery.data?.costs ?? []).perCow, [stockQuery.data]);
  const officeOps = useOpsPrograms(needsOps && !ownerMode);
  const ownOps = useMyFarmMoney(needsOps && !!ownerMode);
  const opsQuery = ownerMode ? ownOps : officeOps;
  const opsData = opsQuery.data;
  const opsViews = useMemo(() => (opsData ? taskViews(opsData.tasks, new Map(opsData.programs.map(p => [p.id, p.farm])), data.stock, data.salesTracking) : []), [opsData, data.stock, data.salesTracking]);

  const period = useMemo(() => ({ from, to }), [from, to]);
  const pack = useMemo(() => buildReportPack(data, fullData, farm, period), [data, fullData, farm, period]);
  const dash = useMemo(() => (view.data
    ? buildControlDashboard({ farms, batches: data.batches, stock: data.stock, sales: data.salesTracking, contracts: view.data.contracts, month: view.data.month, today, farm: farm || null, ...(stockQuery.data ? { camcow: { held: summarizeStock(holdings, today).held, sold: holdings.filter(h => h.status === 'Sold').length, heldTooLong: summarizeStock(holdings, today).heldTooLong } } : {}), ...(opsData ? { ops: { views: opsViews, programs: opsData.programs } } : {}) })
    : null), [view.data, farms, data.batches, data.stock, data.salesTracking, farm, today, opsData, opsViews, stockQuery.data, holdings]);

  // The money record as at the end of the last month chosen (or today, for this month).
  const asOf = to === thisMonth ? today : lastDayOf(to);
  const finance = useMemo(() => {
    if (!opsData) return null;
    const ledgers = opsData.programs.filter(p => p.status !== 'Closed' && (!farm || p.farm === farm)).map(p => farmLedger({ ...p }, opsData.tasks, fullData.stock, fullData.salesTracking, asOf)).sort((a, b) => a.farm.localeCompare(b.farm));
    return ledgers.length > 0 ? buildFinance(ledgers, asOf) : null;
  }, [opsData, farm, fullData.stock, fullData.salesTracking, asOf]);

  const badPeriod = !from || !to || from > to;
  const waiting = (needsDash && (view.isLoading || !dash)) || (needsOps && opsQuery.isLoading) || (needsStock && stockQuery.isLoading);
  const problem = picked.length === 0 ? tx('pickOne') : badPeriod ? tx('badPeriod') : '';
  const toggle = (s: PackSection) => { setPresetKey(null); setPicked(p => (p.includes(s) ? p.filter(x => x !== s) : [...p, s])); };
  const ordered = PACK_SECTIONS.filter(s => picked.includes(s));
  const periodText = from === to ? monthLabel(from, language) : `${monthLabel(from, language)} – ${monthLabel(to, language)}`;
  const download = () => { if (root.current && !problem && !waiting) { printSheet(root.current, { footer: { left: `${tx('reportTitle')} · ${tx('coverTitle')}`, page: tx('pageWord'), of: tx('ofWord') }, title: `${tx('fileName')}${ordered.length === 1 ? `_${part(ordered[0]).replace(/\s+/g, '_')}` : ''}_${today}`, language }); } };
  const part = (s: PackSection) => tx(SECTION_KEYS[s][0]);

  return (
    <>
      <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tx('dialogTitle')}</DialogTitle>
            <DialogDescription>{tx('dialogHint')}</DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-base font-semibold text-ink">{tx('chooseSections')}</legend>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPresetKey(null); setPicked(PACK_SECTIONS.filter(x => allowed.includes(x))); }}>{tx('selectAll')}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPresetKey(null); setPicked([]); }}>{tx('clearAll')}</Button>
              </div>
            </div>
            {PACK_SECTIONS.filter(x => allowed.includes(x)).map(x => (
              <label key={x} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-700" checked={picked.includes(x)} onChange={() => toggle(x)} />
                <span><span className="block text-base font-medium text-ink">{part(x)}</span><span className="block text-sm text-ink-muted">{tx(SECTION_KEYS[x][1])}</span></span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <p className="text-base font-semibold text-ink">{tx('period')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <MonthPicker compact value={from} currentMonth={thisMonth} max={to} label={tx('fromMonth')} onChange={m => { setPresetKey(null); setFrom(m); }} />
              <span className="text-ink-muted" aria-hidden>→</span>
              <MonthPicker compact value={to} currentMonth={thisMonth} min={from} label={tx('toMonth')} onChange={m => { setPresetKey(null); setTo(m); }} />
            </div>
            <p className="text-sm text-ink-muted">{tx('customNote')}</p>
          </div>

          {presets.length > 1 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-muted">{tx('presets')}</p>
              <div className="flex flex-wrap gap-2">
                {presets.map(p => (
                  <Button key={p.key} type="button" variant={presetKey === p.key ? 'default' : 'outline'} size="sm" className="min-h-10" title={p.hint} onClick={() => applyPreset(p)}>{p.label}</Button>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-base text-ink">
            {ordered.map(part).join(' · ') || '—'}<br />
            <span className="text-sm text-ink-muted">{periodText} · {farm || tx('allFarms')}</span>
          </p>
          {onNavigateToTab && (
            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="min-h-8 cursor-pointer text-base font-medium text-ink">{tx('excelTitle')}</summary>
              <p className="mt-2 text-sm text-ink-muted">{tx('excelHint')}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {excel.map(([k, t]) => <Button key={k} type="button" variant="outline" size="sm" className="min-h-10" onClick={() => { onClose(); onNavigateToTab(t); }}>{tx(k)}</Button>)}
              </div>
            </details>
          )}
          {problem && <p role="alert" className="text-base text-rose-700">{problem}</p>}
          {waiting && !problem && <p role="status" className="text-base text-ink-muted">{tx('loading')}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>{tx('cancel')}</Button>
            <Button onClick={download} disabled={!!problem || waiting}><FileDown /> {tx('download')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -(PRINT_WIDTH + 200), width: PRINT_WIDTH }}>
        <div ref={root} className="bg-white text-ink" style={{ width: PRINT_WIDTH, minWidth: PRINT_WIDTH }}>
          <ReportSheet ordered={ordered} pack={pack} dash={dash} finance={finance} holdings={holdings} costOf={costOf} buyers={buyers} own={!!ownerMode} farm={farm} periodText={periodText} today={today} value={value} />
        </div>
      </div>
    </>
  );
}
