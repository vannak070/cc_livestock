'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ListChecks, Undo2, Wallet, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buybackSchedule, canWritePlans } from '@/lib/action-plans';
import { farmToday } from '@/lib/daily-feed';
import { getErrorMessage } from '@/lib/utils';
import { useText } from '@/hooks/useText';
import PageTabs from '@/components/ui/page-tabs';
import { useActionPlansView } from '@/hooks/useActionPlansView';
import type { StockItem, SalesRecord } from '@/lib/xlsx-parser';
import type { BatchItem, UserRoleItem } from '@/lib/types';
import type { Task } from '@/lib/ops-program';
import type { BuybackTarget } from '../sales/BuybackFlow';
import OpsGuide from '../ops/OpsGuide';
import OpsPrograms from '../ops/OpsPrograms';
import OpsTasks from '../ops/OpsTasks';
import CamcowStock from '../ops/CamcowStock';
import OpsSlots from '../ops/OpsSlots';
import OpsMoney from '../ops/OpsMoney';
import { useCamcowStock } from '@/hooks/useCamcowStock';
import { waitingToReceive } from '@/lib/camcow-stock';
import { useOpsPrograms } from '@/hooks/useOpsPrograms';
import { planPricesByFarm, taskViews } from '@/lib/ops-view';
import type { FarmItem, ProposalPlanRecord } from '@/lib/types';
import BuybacksDue from './BuybacksDue';

interface Props {
  currentUser: UserRoleItem;
  farms: string[];
  batches: BatchItem[];
  stock: StockItem[];
  sales: SalesRecord[];
  /** The saved Planning plans (Plan 1..10): a farm's program takes its numbers from one. */
  plans: ProposalPlanRecord[];
  farmItems: FarmItem[];
  /** The tab to open first (Planning sends people to the program setup). */
  initialTab?: Tab;
  /** Opens the Planning page (where the plans a farm program uses are made). */
  onOpenPlanning?: () => void;
  /** Starts the real work from a task: "sell cattle to this farm" opens Add cattle, a buy-back opens the buy-back flow. Missing when the person may not record them. */
  onAddCattleForTask?: (target: { farm: string; title: string; pricePerKg?: number }) => void;
  onBuyBackForTask?: (target: BuybackTarget) => void;
}

export type Tab = 'tasks' | 'slots' | 'programs' | 'money' | 'camcow' | 'buybacks';

/**
 * Farm plans and their work: the task list (To do), the farms' setup and exchange days, the money record and the
 * finished cattle due for collection with their prices. Super Admin and Admin write; Management reads (the server checks).
 */
export default function ActionPlansPage({ currentUser, farms, batches, stock, sales, plans, farmItems, initialTab, onOpenPlanning, onAddCattleForTask, onBuyBackForTask }: Props) {
  const { tx } = useText('actionPlans');
  const ops = useText('opsTasks');
  const camcow = useText('camcowStock');
  const opsQuery = useOpsPrograms();
  const queryClient = useQueryClient();
  const writer = canWritePlans(currentUser);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'tasks');
  // A farm to open straight into its setup (the 3-day calendar's "Set up" buttons); a tab click clears it.
  const [setupFarm, setSetupFarm] = useState<string | undefined>(undefined);

  const query = useActionPlansView(undefined);
  const view = query.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['action-plans'] });
  const opsData = opsQuery.data;
  const farmOfProgram = useMemo(() => new Map((opsData?.programs ?? []).map(p => [p.id, p.farm])), [opsData]);
  const opsViews = useMemo(() => (opsData ? taskViews(opsData.tasks, farmOfProgram, stock, sales) : []), [opsData, farmOfProgram, stock, sales]);
  // Price per kg: the batch's contract, else the price set on the batch, else the farm's plan price.
  const schedule = useMemo(() => buybackSchedule(batches, stock, view?.contracts ?? [], farmToday(), planPricesByFarm(opsData?.programs ?? [])), [batches, stock, view?.contracts, opsData]);
  const refreshOps = () => queryClient.invalidateQueries({ queryKey: ['ops-programs'] });
  // The button that starts the real work; there is none when this person may not record it.
  const doTask = onAddCattleForTask || onBuyBackForTask
    ? (task: Task, farm: string, title: string) => {
        if (task.kind === 'sell_to_farm') onAddCattleForTask?.({ farm, title, pricePerKg: task.pricePerKg });
        else {
          // A collection that has its same-day sale still to do offers it as the next step.
          const open = (s: string) => s !== 'done' && s !== 'cancelled';
          const partner = opsViews.find(v => v.task.programId === task.programId && v.task.kind === 'sell_to_farm' && v.task.dueDate === task.dueDate && open(v.state.status));
          onBuyBackForTask?.({
            farm, batchId: task.batchId, plannedHead: task.plannedHead ?? 0, pricePerKg: task.pricePerKg,
            contractPrices: Object.fromEntries((view?.contracts ?? []).filter(c => c.buybackPricePerKg).map(c => [c.batchId, c.buybackPricePerKg as number])),
            ...(partner && onAddCattleForTask ? { thenAdd: { farm, title: ops.tx('act_sell_to_farm', { n: partner.task.plannedHead ?? 0, farm }), pricePerKg: partner.task.pricePerKg } } : {}),
          });
        }
      }
    : undefined;
  const scopedFarmItems = farmItems.filter(f => farms.includes(f.name));
  // Collected cattle waiting to be received into CamCow stock.
  const camcowQuery = useCamcowStock();
  const toReceive = useMemo(() => (camcowQuery.data ? waitingToReceive(stock, sales, camcowQuery.data.holdings).length : 0), [camcowQuery.data, stock, sales]);

  if (query.isLoading) return <p className="mx-auto max-w-5xl text-lg text-ink-muted" role="status">{tx('loading')}</p>;
  if (query.isError || !view) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{getErrorMessage(query.error, tx('loadFailed'))}</p>
        <Button onClick={() => query.refetch()}>{tx('retry')}</Button>
      </div>
    );
  }

  // The tab bar: To do, Farms (swap days + calendar and setup), Money, Finished cattle.
  type Bar = 'tasks' | 'farms' | 'money' | 'camcow' | 'buybacks';
  const bar: Bar[] = ['tasks', 'farms', 'money', 'camcow', 'buybacks'];
  const inFarms = tab === 'slots' || tab === 'programs';
  const barLabel = (k: Bar) => (k === 'tasks' ? ops.tx('tabTasks') : k === 'farms' ? ops.tx('tabFarms') : k === 'money' ? ops.tx('tabMoney') : k === 'camcow' ? camcow.tx('tab') : tx('tabBuybacks'));
  const BAR_ICON: Record<Bar, React.ReactNode> = {
    tasks: <ListChecks className="h-5 w-5" aria-hidden />,
    farms: <Building2 className="h-5 w-5" aria-hidden />,
    money: <Wallet className="h-5 w-5" aria-hidden />,
    camcow: <Warehouse className="h-5 w-5" aria-hidden />,
    buybacks: <Undo2 className="h-5 w-5" aria-hidden />,
  };
  const lateCount = opsViews.filter(v => v.state.status === 'late').length;
  const badge = (k: Bar) => (k === 'tasks' ? lateCount : k === 'camcow' ? toReceive : 0);
  const goBar = (k: Bar) => { setSetupFarm(undefined); setTab(k === 'farms' ? (inFarms ? tab : 'slots') : k); };
  const waiting = scopedFarmItems.filter(f => !(opsData?.programs ?? []).some(p => p.farm.toLowerCase() === f.name.toLowerCase() && p.status !== 'Closed')).map(f => f.name);
  const setUpCount = scopedFarmItems.length - waiting.length;
  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <PageTabs
        label={tx('title')}
        active={inFarms ? 'farms' : tab}
        onChange={id => goBar(id as Bar)}
        tabs={bar.map(k => ({ id: k, label: barLabel(k), icon: BAR_ICON[k], ...(badge(k) > 0 ? { badge: { n: badge(k), tone: k === 'camcow' ? 'warn' as const : 'bad' as const } } : {}) }))}
      />

      {(tab === 'tasks' || tab === 'buybacks') && <p className="text-base text-ink-muted">{tab === 'tasks' ? ops.tx('tasksHint') : tx('subtitle')}</p>}

      {inFarms && (
        <div className="space-y-4">
          <p className="text-base text-ink-muted">{ops.tx('farmsHint')}</p>
          {writer && opsData && (
            <OpsGuide planCount={plans.length} setUp={setUpCount} waiting={waiting} onPickFarm={farm => { setSetupFarm(farm); setTab('programs'); }} onOpenTasks={() => setTab('tasks')} onOpenPlanning={onOpenPlanning} />
          )}
          <div role="group" aria-label={ops.tx('tabFarms')} className="flex w-fit rounded-xl bg-slate-100 p-1">
            {(['slots', 'programs'] as const).map(v => (
              <button key={v} type="button" aria-pressed={tab === v} onClick={() => { setSetupFarm(undefined); setTab(v); }}
                className={`min-h-10 rounded-lg px-4 text-base font-medium ${tab === v ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                {v === 'slots' ? ops.tx('tabSlots') : ops.tx('viewCalendar')}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'tasks' || tab === 'programs' || tab === 'slots' || tab === 'money' ? (
        opsQuery.isLoading ? <p className="text-lg text-ink-muted" role="status">{ops.tx('loading')}</p>
        : opsQuery.isError || !opsData ? (
          <div className="space-y-3 rounded-2xl bg-rose-50 p-6">
            <p role="alert" className="text-lg text-rose-800">{getErrorMessage(opsQuery.error, ops.tx('loadFailed'))}</p>
            <Button onClick={() => opsQuery.refetch()}>{ops.tx('retry')}</Button>
          </div>
        ) : tab === 'slots'
          ? <OpsSlots currentUser={currentUser} farms={scopedFarmItems} programs={opsData.programs} views={opsViews} onChanged={refreshOps} onSetUpFarm={farm => { setSetupFarm(farm); setTab('programs'); }} />
        : tab === 'money'
          ? <OpsMoney programs={opsData.programs} tasks={opsData.tasks} stock={stock} sales={sales} />
        : tab === 'tasks'
          ? <OpsTasks currentUser={currentUser} views={opsViews} farmOfProgram={farmOfProgram} events={opsData.events} onChanged={refreshOps} onDoTask={doTask} />
          : <OpsPrograms key={setupFarm ?? ''} currentUser={currentUser} farms={scopedFarmItems} programs={opsData.programs} views={opsViews} events={opsData.events} plans={plans} batches={batches} stock={stock} onChanged={refreshOps} onOpenTasks={() => setTab('tasks')} onDoTask={doTask} initialFarm={setupFarm} />
      ) : tab === 'camcow' ? (
        <CamcowStock currentUser={currentUser} stock={stock} sales={sales} batches={batches} />
      ) : tab === 'buybacks' ? (
        <BuybacksDue currentUser={currentUser} rows={schedule} contracts={view.contracts} onSaved={refresh} />
      ) : null}
    </div>
  );
}
