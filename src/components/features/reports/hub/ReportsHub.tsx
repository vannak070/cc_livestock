'use client';

import React, { useMemo, useState } from 'react';
import { CalendarCheck, FileDown, HeartPulse, Landmark, LayoutDashboard, PackageCheck, TrendingUp, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canSeeActionPlans } from '@/lib/action-plans';
import { getErrorMessage, hasPermission } from '@/lib/utils';
import { PACK_SECTIONS, type PackSection } from '@/lib/report-pack';
import type { ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import { useText } from '@/hooks/useText';
import type { ActiveTabType } from '../../../layout/SidebarLayout';
import CattleReport from '../CattleReport';
import MoneyReport from '../MoneyReport';
import OverviewReport from '../OverviewReport';
import ReportPdfDialog from '../pdf/ReportPdfDialog';
import BuybacksSection from './BuybacksSection';
import FinanceSection from './FinanceSection';
import OperationsSection from './OperationsSection';
import MonthPicker from './MonthPicker';
import ReportTabs, { type ReportTab } from './ReportTabs';
import { SectionFrame } from './SectionFrame';
import StockSection from './StockSection';
import SummarySection from './SummarySection';
import { useReportData } from './useReportData';

interface Props {
  data: ERPLivestockData;
  /** The data narrowed to the chosen farm. */
  scoped: ERPLivestockData;
  currentUser?: UserRoleItem;
  farms: FarmItem[];
  /** The farm chosen in "Working on", or '' for all. */
  farm: string;
  onOpenActionPlans?: () => void;
  onNavigateToTab: (tab: ActiveTabType) => void;
  onOpenSaleReview?: () => void;
}

/**
 * Reports as tabs that follow the Management report template: Summary, Cattle inventory and buy-backs, Financing and cash,
 * Action plan, Herd and health, Sales and profit. One section shows at a time; the month filter applies to the Management sections.
 * "Download report" lets the user choose which sections go into the PDF. The farm comes from "Working on".
 */
export default function ReportsHub({ data, scoped, currentUser, farms, farm, onOpenActionPlans, onNavigateToTab, onOpenSaleReview }: Props) {
  const { tx } = useText('reportsPage');
  const canAnalytics = hasPermission(currentUser, 'analytics_view');
  const canWork = canSeeActionPlans(currentUser);
  // A Farm Owner also gets Financing and cash, for their own farm only (the server checks).
  const isOwner = !canWork && currentUser?.role === 'Farm Owner' && !!currentUser.farmLocation;
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<PackSection | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const r = useReportData({ data, scoped, farms, farm, month, canWork, owner: isOwner });

  const allowed: PackSection[] = useMemo(() => PACK_SECTIONS.filter(id => id === 'overview' || (canWork && ['management', 'finance', 'stock', 'work'].includes(id)) || (isOwner && id === 'finance') || (canAnalytics && ['cattle', 'money'].includes(id))), [canAnalytics, canWork, isOwner]);
  const lateTasks = r.dash?.plan?.byStatus.late ?? 0;
  // The tabs follow the order of the PDF report (Summary, Financing, Sales, Buy-backs, Action plan, Herd), so they match what is printed.
  const tabs: ReportTab[] = useMemo(() => {
    const defs: Record<PackSection, ReportTab> = {
      finance: { id: 'finance', label: tx('navFinance'), icon: <Landmark className="h-5 w-5" /> },
      money: { id: 'money', label: tx('navSales'), icon: <TrendingUp className="h-5 w-5" /> },
      overview: { id: 'overview', label: tx('navSummary'), icon: <LayoutDashboard className="h-5 w-5" /> },
      management: { id: 'management', label: tx('navBuybacks'), icon: <PackageCheck className="h-5 w-5" />, badge: { n: r.dash?.inventory.overdue ?? 0, tone: 'bad' } },
      stock: { id: 'stock', label: tx('navStock'), icon: <Warehouse className="h-5 w-5" />, badge: { n: r.stock?.heldTooLong ?? 0, tone: 'warn' } },
      work: { id: 'work', label: tx('navAction'), icon: <CalendarCheck className="h-5 w-5" />, badge: { n: lateTasks, tone: 'bad' } },
      cattle: { id: 'cattle', label: tx('navHerd'), icon: <HeartPulse className="h-5 w-5" />, badge: { n: r.pack?.overview.sick ?? 0, tone: 'warn' } },
    };
    return allowed.map(id => defs[id]);
  }, [allowed, tx, r.dash, r.pack, r.stock, lateTasks]);
  // The first tab (the Summary) opens by default.
  const active: PackSection = picked && allowed.includes(picked) ? picked : allowed[0];
  const show = (id: string) => { setPicked(id as PackSection); window.scrollTo?.({ top: 0 }); };
  const monthBased = (canWork && ['overview', 'management', 'finance', 'stock', 'work'].includes(active)) || (isOwner && active === 'finance');

  if (r.loading) return <p className="mx-auto max-w-6xl text-lg text-ink-muted" role="status">{tx('hubLoading')}</p>;
  if ((canWork && r.error && !r.dash) || (isOwner && r.error)) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{getErrorMessage(r.error, tx('hubFailed'))}</p>
        <Button onClick={r.retry}>{tx('hubRetry')}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-ink-muted">{tx('filterFarm')}</p>
            <p className="flex min-h-11 items-center rounded-xl bg-white px-4 text-lg font-semibold text-ink ring-1 ring-slate-200">{farm || tx('ctxAllFarms')}</p>
          </div>
          {(canWork || isOwner) && (
            <div>
              <p className="mb-1 text-sm font-medium text-ink-muted">{tx('filterMonth')}</p>
              <MonthPicker value={r.month} onChange={setMonth} currentMonth={r.currentMonth} />
            </div>
          )}
        </div>
        <Button className="min-h-11" onClick={() => setPdfOpen(true)}><FileDown /> {tx('downloadFull')}</Button>
      </div>
      {(canWork || isOwner) && <p className="text-sm text-ink-muted">{monthBased ? tx('filterMonthApplies') : tx('filterMonthNotHere')}</p>}

      <ReportTabs tabs={tabs} active={active} onChange={show} label={tx('sectionsNav')} />

      {active === 'overview' && (
        <SectionFrame id="overview" title={tx('secSummary')} subtitle={tx('subSummary')}>
          {canWork
            ? <SummarySection r={r} onJump={show} />
            : <OverviewReport data={scoped} fullData={data} farm={farm} canAnalytics={canAnalytics} onNavigateToTab={onNavigateToTab} onOpenSaleReview={onOpenSaleReview} onOpenMoney={() => show('money')} />}
        </SectionFrame>
      )}
      {canWork && active === 'management' && currentUser && (
        <SectionFrame id="management" title={tx('secBuybacks')} subtitle={tx('subBuybacks')}>
          <BuybacksSection r={r} data={data} currentUser={currentUser} farm={farm} onOpenActionPlans={onOpenActionPlans} />
        </SectionFrame>
      )}
      {(canWork || isOwner) && active === 'finance' && <SectionFrame id="finance" title={tx('secFinance')} subtitle={tx('subFinance')}><FinanceSection r={r} own={isOwner} /></SectionFrame>}
      {canWork && active === 'stock' && <SectionFrame id="stock" title={tx('secStock')} subtitle={tx('subStock')}><StockSection r={r} /></SectionFrame>}
      {canWork && active === 'work' && (
        <SectionFrame id="work" title={tx('secOperations')} subtitle={tx('subOperations')}>
          <OperationsSection data={data} farms={farms} farm={farm} r={r} onOpenActionPlans={onOpenActionPlans} />
        </SectionFrame>
      )}
      {canAnalytics && active === 'cattle' && <SectionFrame id="cattle" title={tx('secHerd')} subtitle={tx('subHerd')}><CattleReport data={scoped} farm={farm} /></SectionFrame>}
      {canAnalytics && active === 'money' && <SectionFrame id="money" title={tx('secMoney')} subtitle={tx('subMoney')}><MoneyReport data={scoped} fullData={data} farm={farm} /></SectionFrame>}

      <ReportPdfDialog
        open={pdfOpen} onClose={() => setPdfOpen(false)} data={scoped} fullData={data} farms={farms} farm={farm} allowed={allowed}
        initial={allowed} initialMonth={r.month} ownerMode={isOwner} onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
}
