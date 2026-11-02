'use client';

import { useMemo } from 'react';
import { buildControlDashboard, type ControlDashboard } from '@/lib/control-dashboard';
import { farmToday } from '@/lib/daily-feed';
import { buildFinance, type FinanceBlock } from '@/lib/finance-report';
import { lastDayOf } from '@/lib/ops-calendar';
import { taskViews, type TaskView } from '@/lib/ops-view';
import { buildReportPack, type ReportPack } from '@/lib/report-pack';
import { farmLedger, type FarmLedger } from '@/lib/trade-ledger';
import { useActionPlansView } from '@/hooks/useActionPlansView';
import { useCamcowStock } from '@/hooks/useCamcowStock';
import { shareCosts } from '@/lib/camcow-costs';
import { buyerAccounts, type BuyerAccount } from '@/lib/camcow-buyers';
import { summarizeStock, type Holding, type StockSummary } from '@/lib/camcow-stock';
import { useMyFarmMoney } from '@/hooks/useMyFarmMoney';
import { useOpsPrograms } from '@/hooks/useOpsPrograms';
import type { ERPLivestockData, FarmItem } from '@/lib/types';

interface Args {
  /** Everything (the money and plan figures are company-wide and narrowed by farm below). */
  data: ERPLivestockData;
  /** The data narrowed to the chosen farm. */
  scoped: ERPLivestockData;
  farms: FarmItem[];
  /** The farm chosen in "Working on", or '' for all. */
  farm: string;
  /** YYYY-MM chosen on the page; nothing means the current month. */
  month: string | undefined;
  /** Whether this person may see the action plans, tasks and money record (Super Admin, Admin, Management). */
  canWork: boolean;
  /** A Farm Owner: sees the money statement of their own farm (no action-plan tasks or other farms). */
  owner?: boolean;
}

export interface ReportData {
  loading: boolean;
  error: unknown;
  retry: () => void;
  /** The month the report is for (YYYY-MM) and the current month. */
  month: string;
  currentMonth: string;
  dash: ControlDashboard | null;
  pack: ReportPack | null;
  views: TaskView[];
  ledgers: FarmLedger[];
  finance: FinanceBlock | null;
  programs: NonNullable<ReturnType<typeof useOpsPrograms>['data']>['programs'];
  /** The cattle CC Livestock holds after collecting them (the chosen farm's, or all), and their summary for the chosen month. */
  holdings: Holding[];
  /** What each buyer of CamCow stock bought, paid and owes (all farms; empty when one farm is chosen, as buyers are not tied to a farm). */
  buyers: BuyerAccount[];
  stock: StockSummary | null;
}

/** Everything the Management sections show, worked out once from the same records and shared by every section and the PDF. */
export function useReportData({ data, scoped, farms, farm, month, canWork, owner = false }: Args): ReportData {
  const today = farmToday();
  const query = useActionPlansView(month, canWork);
  const stockQuery = useCamcowStock(canWork);
  const officeOps = useOpsPrograms(canWork);
  const ownOps = useMyFarmMoney(owner && !canWork);
  const opsQuery = owner && !canWork ? ownOps : officeOps;
  const view = query.data;
  const ops = opsQuery.data as { programs: ReportData['programs']; tasks: import('@/lib/ops-program').Task[] } | undefined;
  const chosen = view?.month ?? month ?? today.slice(0, 7);

  const views = useMemo(
    () => (ops ? taskViews(ops.tasks, new Map(ops.programs.map(p => [p.id, p.farm])), data.stock, data.salesTracking) : []),
    [ops, data.stock, data.salesTracking]
  );
  const holdings = useMemo(() => (stockQuery.data?.holdings ?? []).filter(h => !farm || h.sourceFarm === farm), [stockQuery.data, farm]);
  const buyers = useMemo(() => (stockQuery.data && !farm ? buyerAccounts(stockQuery.data.holdings, stockQuery.data.buyers) : []), [stockQuery.data, farm]);
  // Costs are shared over every animal in stock, then summed for the chosen farm's animals.
  const costOf = useMemo(() => shareCosts(stockQuery.data?.holdings ?? [], stockQuery.data?.costs ?? []).perCow, [stockQuery.data]);
  const stock = useMemo(() => (stockQuery.data ? summarizeStock(holdings, today, chosen, chosen, costOf) : null), [stockQuery.data, holdings, today, chosen, costOf]);
  const dash = useMemo(
    () => (view ? buildControlDashboard({ farms, batches: data.batches, stock: data.stock, sales: data.salesTracking, contracts: view.contracts, month: view.month, today, farm: farm || null, ...(stockQuery.data ? { camcow: { held: summarizeStock(holdings, today).held, sold: holdings.filter(h => h.status === 'Sold').length, heldTooLong: summarizeStock(holdings, today).heldTooLong } } : {}), ...(ops ? { ops: { views, programs: ops.programs } } : {}) }) : null),
    [view, farms, data.batches, data.stock, data.salesTracking, farm, ops, views, today, stockQuery.data, holdings]
  );
  const pack = useMemo(() => (view ? buildReportPack(scoped, data, farm, { from: view.month, to: view.month }) : null), [view, scoped, data, farm]);

  // The money record, as at the end of the chosen month (or today, for the current one).
  const asOf = chosen === today.slice(0, 7) ? today : lastDayOf(chosen);
  const ledgers = useMemo(
    () => (ops ? ops.programs.filter(p => p.status !== 'Closed' && (!farm || p.farm === farm)).map(p => farmLedger({ ...p }, ops.tasks, data.stock, data.salesTracking, asOf)).sort((a, b) => a.farm.localeCompare(b.farm)) : []),
    [ops, farm, data.stock, data.salesTracking, asOf]
  );
  const finance = useMemo(() => (ops ? buildFinance(ledgers, asOf) : null), [ops, ledgers, asOf]);

  return {
    loading: (canWork && (query.isLoading || opsQuery.isLoading)) || (owner && !canWork && ownOps.isLoading),
    error: query.error ?? opsQuery.error,
    retry: () => { void query.refetch(); void opsQuery.refetch(); },
    month: chosen,
    currentMonth: view?.currentMonth ?? today.slice(0, 7),
    dash, pack, views, ledgers, finance,
    programs: ops?.programs ?? [],
    holdings, buyers, stock,
  };
}
