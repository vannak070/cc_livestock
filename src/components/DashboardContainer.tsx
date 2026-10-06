'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getLivestockDataAction, 
  addStockItemAction, 
  addWeightRecordAction, 
  recordSaleAction, 
  createBatchAction, 
  assignCowsToBatchAction, 
  addHealthLogAction, 
  removeCowFromBatchAction, 
  updateBatchAction, 
  recordBatchWeightsAction, 
  reviewBatchSaleAction,
  deleteStockItemAction,
  deleteBatchAction,
  deleteHealthLogAction,
  updateHealthLogAction,
  deleteWeightRecordAction,
  updateWeightRecordAction,
  deleteSalesRecordAction,
  updateSalesRecordAction,
  saveFeedProductAction,
  deleteFeedProductAction,
  addFeedTransactionAction,
  recordDailyFeedAction,
  moveBatchFarmAction,
  moveCowToBatchAction,
  saveProposalPlanAction,
  deleteProposalPlanAction,
  addFarmCostAction,
  deleteFarmCostAction,
  logoutAction
} from '@/app/actions';
import { useRouter } from 'next/navigation';
import SidebarLayout, { ActiveTabType, RecordAction } from './layout/SidebarLayout';
import TodayTab from './TodayTab';
import SummaryPage from './features/summary/SummaryPage';
import BatchesPage, { type Show as BatchesShow } from './features/batch/BatchesPage';
import type { SaleReviewInput } from '@/lib/sale-review';
import FeedPage from './features/feed/FeedPage';
import HealthPage from './features/health/HealthPage';
import WeightsPage from './features/weight/WeightsPage';
import SalesPage from './features/sales/SalesPage';
import ReportsPage from './features/reports/ReportsPage';
import PlanningPage from './features/planning/PlanningPage';
import SettingsPage from './features/settings/SettingsPage';
import FarmsPage from './features/farms/FarmsPage';
import { useOnChange } from '@/hooks/useOnChange';
import CattleList from './features/cattle/CattleList';
import CattleDetailPage from './features/cattle/CattleDetailPage';
import FeedInFlow from './features/feed/FeedInFlow';
import DailyFeedFlow from './features/feed/DailyFeedFlow';
import type { DailyFeedInput } from '@/lib/daily-feed';
import TreatFlow from './features/health/TreatFlow';
import SellFlow from './features/sales/SellFlow';
import WeighFlow from './features/weigh/WeighFlow';
import WeighGroupFlow from './features/batch/WeighGroupFlow';
import { batchCattle } from '@/lib/batch-stats';
import AddCattleFlow from './features/stock/AddCattleFlow';
import CostsPage from './features/costs/CostsPage';
import CostFlow from './features/costs/CostFlow';
import { costCategoriesFrom, type FarmCostInput } from '@/lib/farm-costs';
import { ERPLivestockData, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { ProposalPlanParams } from '@/types';
import { SalesRecord } from '@/lib/xlsx-parser';
import { canUsePlanning, hasPermission } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { canOpenPeople } from '@/lib/user-admin';
import { scopeDataToFarm } from '@/lib/farm-view';
import { readFocus, saveFocus, validFocus } from '@/lib/working-on';
import WorkingOnSwitcher from './layout/WorkingOnSwitcher';
import { PermissionKey } from '@/types/settings.types';
import { sickCattle, cattleWithDiseaseHistory } from '@/lib/attention';
import { Scale, Syringe, PlusCircle, DollarSign, Package, Wheat, Receipt } from 'lucide-react';

interface DashboardContainerProps {
  initialData: ERPLivestockData;
  // Verified server-side from the session cookie (see src/app/page.tsx).
  currentUser: UserRoleItem;
}

export default function DashboardContainer({ initialData, currentUser }: DashboardContainerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useLanguage();
  // Management is read-only oversight: it starts on the Summary. Everyone else
  // starts on Today, the list of what needs doing.
  const [activeTab, setActiveTab] = useState<ActiveTabType>(currentUser.role === 'Management' ? 'dashboard' : 'today');

  // Modal States
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryTab, setQuickEntryTab] = useState<'add' | 'weight' | 'sale' | 'treat' | 'feed'>('add');
  const [preselectedCowId, setPreselectedCowId] = useState<string | null>(null);
  const [weighBatchId, setWeighBatchId] = useState<string | null>(null);
  // Alerts link straight to the sale review; any other way into Batches starts on the usual list.
  const [batchesShow, setBatchesShow] = useState<BatchesShow>('Active');
  const changeTab = (tab: ActiveTabType) => { setBatchesShow('Active'); setActiveTab(tab); };
  const openSaleReview = () => { setBatchesShow('Review'); setActiveTab('batch-management'); };
  // The day's feed dialog: optionally for one farm (the office helping a farm) and/or a missed day.
  const [dailyFeed, setDailyFeed] = useState<null | { farm?: string; day?: string }>(null);
  // Several animals chosen up front for Treat, for example a whole batch.
  const [treatCowIds, setTreatCowIds] = useState<string[] | undefined>(undefined);
  const [costOpen, setCostOpen] = useState(false);

  const [selectedCowDetailsId, setSelectedCowDetailsId] = useState<string | null>(null);
  // Leaving the Cattle page closes the animal that was open.
  useOnChange(activeTab, () => { setSelectedCowDetailsId(null); });

  // TanStack Query for dynamic data fetching
  const { data: rawDbData } = useQuery<ERPLivestockData>({
    queryKey: ['livestock'],
    queryFn: async () => {
      const res = await getLivestockDataAction();
      if (res.success) return res.data;
      // Session expired or revoked: re-render on the server, which shows
      // the login screen.
      if (res.status === 401) router.refresh();
      throw new Error(res.error || 'Failed to fetch data');
    },
    initialData: initialData,
    refetchOnWindowFocus: true,
  });

  // Already scoped to this user's farm on the server (src/lib/data-scope.ts).
  const fullData = rawDbData;

  // "Working on": an office account can look at one farm at a time. Every page and form
  // then works on that farm only, as a farm's own staff see it. It is a view choice, not
  // a permission, and is remembered on this browser. Farms and Settings keep seeing everything.
  const farmNames = useMemo(() => (fullData.settings?.farms ?? []).map(f => f.name), [fullData.settings?.farms]);
  const canChooseFarm = !currentUser.farmLocation && farmNames.length > 1;
  const [focus, setFocus] = useState('');
  useEffect(() => { setFocus(readFocus(currentUser.id)); }, [currentUser.id]);
  const focusFarm = canChooseFarm ? validFocus(focus, farmNames) : '';
  const chooseFarm = (farm: string) => { setFocus(farm); saveFocus(currentUser.id, farm); };
  const dbData = useMemo(() => (focusFarm ? scopeDataToFarm(fullData, focusFarm, { includeFeed: true }) : fullData), [fullData, focusFarm]);
  // The same person, tied to the chosen farm, for the pages that hide their own farm filters for farm staff.
  const pageUser = useMemo(() => (focusFarm ? { ...currentUser, farmLocation: focusFarm } : currentUser), [currentUser, focusFarm]);

  // Mutations
  const addCowMutation = useMutation({
    mutationFn: async (newCow: Omit<Parameters<typeof addStockItemAction>[0], 'status'> & { status?: string }) => {
      const res = await addStockItemAction({ ...newCow, status: newCow.status ?? 'Active' });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const addWeightMutation = useMutation({
    mutationFn: async ({ cowId, weight, healthStatus, date }: { cowId: string; weight: number; healthStatus: string; date?: string }) => {
      const res = await addWeightRecordAction(cowId, weight, healthStatus, date);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const recordSaleMutation = useMutation({
    mutationFn: async ({ cowId, unitPrice, saleType, date, buyer }: { cowId: string; unitPrice: number; saleType: 'Weight' | 'Lumpsum'; date?: string; buyer?: string }) => {
      const res = await recordSaleAction(cowId, unitPrice, saleType, date, buyer);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const createBatchMutation = useMutation({
    mutationFn: async (batch: Parameters<typeof createBatchAction>[0]) => {
      const res = await createBatchAction(batch);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const assignCowsMutation = useMutation({
    mutationFn: async ({ batchId, cowIds }: { batchId: string; cowIds: string[] }) => {
      const res = await assignCowsToBatchAction(batchId, cowIds);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const addHealthLogMutation = useMutation({
    mutationFn: async (log: Parameters<typeof addHealthLogAction>[0]) => {
      const res = await addHealthLogAction(log);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const removeCowMutation = useMutation({
    mutationFn: async ({ batchId, cowId }: { batchId: string; cowId: string }) => {
      const res = await removeCowFromBatchAction(batchId, cowId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const updateBatchMutation = useMutation({
    mutationFn: async ({ batchId, updates }: { batchId: string; updates: Parameters<typeof updateBatchAction>[1] }) => {
      const res = await updateBatchAction(batchId, updates);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const recordBatchWeightsMutation = useMutation({
    mutationFn: async (records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]) => {
      const res = await recordBatchWeightsAction(records);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const reviewBatchSaleMutation = useMutation({
    mutationFn: async ({ batchId, input }: { batchId: string; input: SaleReviewInput }) => {
      const res = await reviewBatchSaleAction(batchId, input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteStockItemMutation = useMutation({
    mutationFn: async (cowId: string) => {
      const res = await deleteStockItemAction(cowId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await deleteBatchAction(batchId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteHealthLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await deleteHealthLogAction(logId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const updateHealthLogMutation = useMutation({
    mutationFn: async ({ logId, updates }: { logId: string; updates: Parameters<typeof updateHealthLogAction>[1] }) => {
      const res = await updateHealthLogAction(logId, updates);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteWeightRecordMutation = useMutation({
    mutationFn: async ({ cowId, trackingDate }: { cowId: string; trackingDate: string }) => {
      const res = await deleteWeightRecordAction(cowId, trackingDate);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const updateWeightRecordMutation = useMutation({
    mutationFn: async ({ cowId, trackingDate, currentWeight, healthStatus }: { cowId: string; trackingDate: string; currentWeight: number; healthStatus: string }) => {
      const res = await updateWeightRecordAction(cowId, trackingDate, currentWeight, healthStatus);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteSalesRecordMutation = useMutation({
    mutationFn: async (cowId: string) => {
      const res = await deleteSalesRecordAction(cowId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const updateSalesRecordMutation = useMutation({
    mutationFn: async ({ cowId, updates }: { cowId: string; updates: Parameters<typeof updateSalesRecordAction>[1] }) => {
      const res = await updateSalesRecordAction(cowId, updates);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const saveFeedProductMutation = useMutation({
    mutationFn: async (product: FeedProductItem) => {
      const res = await saveFeedProductAction(product);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteFeedProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await deleteFeedProductAction(productId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const saveProposalPlanMutation = useMutation({
    mutationFn: async ({ slot, name, params }: { slot: number; name: string; params: ProposalPlanParams }) => {
      const res = await saveProposalPlanAction(slot, name, params);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const deleteProposalPlanMutation = useMutation({
    mutationFn: async (slot: number) => {
      const res = await deleteProposalPlanAction(slot);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const addFeedTransactionMutation = useMutation({
    mutationFn: async (tx: FeedStockTransaction) => {
      const res = await addFeedTransactionAction(tx);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const moveBatchFarmMutation = useMutation({
    mutationFn: async ({ batchId, farm, moveCattle }: { batchId: string; farm: string; moveCattle: boolean }) => {
      const res = await moveBatchFarmAction(batchId, farm, moveCattle);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); }
  });

  const moveCowMutation = useMutation({
    mutationFn: async ({ cowId, fromBatchId, toBatchId }: { cowId: string; fromBatchId: string; toBatchId: string }) => {
      const res = await moveCowToBatchAction(cowId, fromBatchId, toBatchId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); }
  });

  const recordDailyFeedMutation = useMutation({
    mutationFn: async (input: DailyFeedInput) => {
      const res = await recordDailyFeedAction(input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const addCostMutation = useMutation({
    mutationFn: async (input: FarmCostInput) => {
      const res = await addFarmCostAction(input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); }
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteFarmCostAction(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); }
  });

  // Active cows list & health alert counters (strictly scoped to current user's farm)
  const activeCows = dbData.stock.filter(c => c.status.toLowerCase() === 'active');
  const healthAlertsCount = sickCattle(dbData.stock).length;
  const vaccineAlertsCount = cattleWithDiseaseHistory(dbData).length;

  // Trigger Action panel
  const handleOpenQuickEntry = (tabType: 'add' | 'weight' | 'sale' | 'treat' | 'feed' = 'add', cowId: string | null = null) => {
    setQuickEntryTab(tabType);
    setPreselectedCowId(cowId);
    setTreatCowIds(undefined);
    setIsQuickEntryOpen(true);
  };

  // What this person may record, shown on Today and behind the phone's Record
  // button. Each opens a guided dialog.
  const recordActions: RecordAction[] = ([
    hasPermission(currentUser, 'feed_record') && { key: 'feed-day', label: t('record.feedToday'), icon: <Wheat className="h-7 w-7" />, onClick: () => setDailyFeed({}) },
    hasPermission(currentUser, 'weight_record') && { key: 'weigh', label: t('record.weigh'), icon: <Scale className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('weight') },
    hasPermission(currentUser, 'health_record') && { key: 'treat', label: t('record.treat'), icon: <Syringe className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('treat') },
    hasPermission(currentUser, 'stock_create') && { key: 'add', label: t('record.addCattle'), icon: <PlusCircle className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('add') },
    hasPermission(currentUser, 'sales_record') && { key: 'sell', label: t('record.sell'), icon: <DollarSign className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('sale') },
    (hasPermission(currentUser, 'feed_manage') || (hasPermission(currentUser, 'feed_own_products') && !!currentUser?.farmLocation)) && { key: 'feed', label: t('record.feedIn'), icon: <Package className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('feed') },
    hasPermission(currentUser, 'costs_record') && { key: 'cost', label: t('record.cost'), icon: <Receipt className="h-7 w-7" />, onClick: () => setCostOpen(true) }
  ] as (RecordAction | false)[]).filter((a): a is RecordAction => !!a);

  const handleViewDetails = (cowId: string) => {
    setSelectedCowDetailsId(cowId);
  };

  const handleLogout = async () => {
    await logoutAction();
    queryClient.clear();
    router.refresh();
  };

  React.useEffect(() => {
    if (!currentUser) return;

    let permissionKey: PermissionKey | null = null;
    if (activeTab === 'today' || activeTab === 'dashboard') permissionKey = 'dashboard_view';
    else if (activeTab === 'cow-inventory') permissionKey = 'stock_view';
    else if (activeTab === 'batch-management') permissionKey = 'batch_view';
    else if (activeTab === 'health-tracking') permissionKey = 'health_view';
    else if (activeTab === 'weight-tracking') permissionKey = 'weight_view';
    else if (activeTab === 'sales-finance') permissionKey = 'sales_view';
    else if (activeTab === 'analytics') permissionKey = 'analytics_view';
    else if (activeTab === 'farms') permissionKey = 'farms_manage';
    else if (activeTab === 'feed-inventory') permissionKey = 'feed_view';
    else if (activeTab === 'costs') permissionKey = 'costs_view';

    // Settings is also a farm owner's People page, and Planning is for a few roles only, so they have their own rules.
    const blocked = activeTab === 'settings' ? !canOpenPeople(currentUser)
      : activeTab === 'proposal-plan' ? !canUsePlanning(currentUser)
      : !!permissionKey && !hasPermission(currentUser, permissionKey);
    if (blocked && activeTab !== 'today') {
      setActiveTab('today');
    }
  }, [activeTab, currentUser]);

  return (
    <SidebarLayout
      activeTab={activeTab}
      setActiveTab={changeTab}
      recordActions={recordActions}
      healthAlertsCount={healthAlertsCount}
      vaccineAlertsCount={vaccineAlertsCount}
      currentUser={currentUser}
      onLogout={handleLogout}
      workingOn={canChooseFarm ? <WorkingOnSwitcher farms={farmNames} value={focusFarm} onChange={chooseFarm} /> : undefined}
    >
      {/* Dynamic Tab Rendering */}
      {activeTab === 'today' && (
        <TodayTab
          data={dbData}
          currentUser={pageUser}
          recordActions={recordActions}
          onNavigate={changeTab}
          onOpenSaleReview={openSaleReview}
          onRecordFeed={hasPermission(currentUser, 'feed_record') ? (farm, day) => setDailyFeed({ farm, day }) : undefined}
        />
      )}

      {activeTab === 'dashboard' && (
        <SummaryPage
          data={dbData}
          onNavigateToTab={changeTab}
          onOpenSaleReview={openSaleReview}
          canSeeReports={hasPermission(currentUser, 'analytics_view')}
        />
      )}

      {activeTab === 'cow-inventory' && selectedCowDetailsId && (
        <CattleDetailPage
          cowId={selectedCowDetailsId}
          stock={dbData.stock}
          weightTracking={dbData.weightTracking}
          salesTracking={dbData.salesTracking}
          healthLogs={dbData.healthLogs}
          feedTransactions={dbData.feedTransactions}
          batches={dbData.batches}
          currentUser={pageUser}
          onBack={() => setSelectedCowDetailsId(null)}
          onWeigh={cowId => handleOpenQuickEntry('weight', cowId)}
          onTreat={cowId => handleOpenQuickEntry('treat', cowId)}
          onSell={cowId => handleOpenQuickEntry('sale', cowId)}
          onDelete={async cowId => {
            await deleteStockItemMutation.mutateAsync(cowId);
          }}
        />
      )}

      {activeTab === 'cow-inventory' && !selectedCowDetailsId && (
        <CattleList
          stock={dbData.stock}
          weightTracking={dbData.weightTracking}
          onViewDetails={handleViewDetails}
          onAddCowClick={() => handleOpenQuickEntry('add', null)}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'batch-management' && (
        <BatchesPage
          data={dbData}
          initialShow={batchesShow}
          onReviewBatch={async (batchId, input) => { await reviewBatchSaleMutation.mutateAsync({ batchId, input }); }}
          onCreateBatch={async (batch) => {
            const batchWithLoc = {
              ...batch,
              farmLocation: batch.farmLocation || pageUser?.farmLocation || undefined
            };
            await createBatchMutation.mutateAsync(batchWithLoc);
          }}
          onAssignCows={async (batchId, cowIds) => {
            await assignCowsMutation.mutateAsync({ batchId, cowIds });
          }}
          onRemoveCow={async (batchId, cowId) => {
            await removeCowMutation.mutateAsync({ batchId, cowId });
          }}
          onUpdateBatch={async (batchId, updates) => {
            await updateBatchMutation.mutateAsync({ batchId, updates });
          }}
          onRecordBatchWeights={async (records) => {
            await recordBatchWeightsMutation.mutateAsync(records);
          }}
          onDeleteBatch={async (batchId) => {
            await deleteBatchMutation.mutateAsync(batchId);
          }}
          onMoveBatchFarm={currentUser?.farmLocation ? undefined : async (batchId, farm, moveCattle) => {
            await moveBatchFarmMutation.mutateAsync({ batchId, farm, moveCattle });
          }}
          onMoveCow={async (cowId, fromBatchId, toBatchId) => {
            await moveCowMutation.mutateAsync({ cowId, fromBatchId, toBatchId });
          }}
          onTreatGroup={(cowIds) => {
            setQuickEntryTab('treat');
            setPreselectedCowId(null);
            setTreatCowIds(cowIds);
            setIsQuickEntryOpen(true);
          }}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'feed-inventory' && (
        <FeedPage
          data={dbData}
          onSaveProduct={async (product) => {
            await saveFeedProductMutation.mutateAsync(product);
          }}
          onDeleteProduct={async (productId) => {
            await deleteFeedProductMutation.mutateAsync(productId);
          }}
          onAddTransaction={async (tx) => {
            await addFeedTransactionMutation.mutateAsync(tx);
          }}
          onOpenFeedIn={() => handleOpenQuickEntry('feed')}
          onRecordDay={hasPermission(currentUser, 'feed_record') ? (farm, day) => setDailyFeed({ farm, day }) : undefined}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'health-tracking' && (
        <HealthPage
          data={dbData}
          onOpenTreat={cowId => handleOpenQuickEntry('treat', cowId ?? null)}
          onDeleteHealthLog={async (logId) => {
            await deleteHealthLogMutation.mutateAsync(logId);
          }}
          onUpdateHealthLog={async (logId, updates) => {
            await updateHealthLogMutation.mutateAsync({ logId, updates });
          }}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'weight-tracking' && (
        <WeightsPage
          data={dbData}
          onOpenLogWeight={(cowId) => handleOpenQuickEntry('weight', cowId || null)}
          onWeighBatch={setWeighBatchId}
          onDeleteWeightRecord={async (cowId, trackingDate) => {
            await deleteWeightRecordMutation.mutateAsync({ cowId, trackingDate });
          }}
          onUpdateWeightRecord={async (cowId, trackingDate, currentWeight, healthStatus) => {
            await updateWeightRecordMutation.mutateAsync({ cowId, trackingDate, currentWeight, healthStatus });
          }}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'sales-finance' && (
        <SalesPage
          data={dbData}
          onDeleteSalesRecord={async (cowId: string) => {
            await deleteSalesRecordMutation.mutateAsync(cowId);
          }}
          onUpdateSalesRecord={async (cowId: string, updates: Partial<SalesRecord>) => {
            await updateSalesRecordMutation.mutateAsync({ cowId, updates });
          }}
          onRecordSaleClick={() => handleOpenQuickEntry('sale', null)}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'costs' && (
        <CostsPage
          costs={dbData.farmCosts ?? []}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
          onRecordCost={() => setCostOpen(true)}
          onDeleteCost={async id => {
            await deleteCostMutation.mutateAsync(id);
          }}
        />
      )}

      {activeTab === 'analytics' && (
        <ReportsPage
          data={dbData}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'proposal-plan' && (
        <PlanningPage
          plans={dbData.proposalPlans ?? []}
          onSavePlan={async (slot, name, params) => {
            await saveProposalPlanMutation.mutateAsync({ slot, name, params });
          }}
          onDeletePlan={async (slot) => {
            await deleteProposalPlanMutation.mutateAsync(slot);
          }}
          data={dbData}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsPage
          settings={dbData.settings}
          currentUser={currentUser}
          onOpenFarms={hasPermission(currentUser, 'farms_manage') ? () => setActiveTab('farms') : undefined}
        />
      )}

      {activeTab === 'farms' && (
        <FarmsPage
          settings={dbData.settings}
          currentUser={currentUser}
          stock={fullData.stock}
          batches={fullData.batches}
          onRecordFeed={hasPermission(currentUser, 'feed_record') ? farm => setDailyFeed({ farm }) : undefined}
        />
      )}


      {/* Quick Entry / Action Modal */}
      <WeighFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'weight'}
        onClose={() => setIsQuickEntryOpen(false)}
        cattle={activeCows}
        weightTracking={dbData.weightTracking}
        healthStatuses={dbData.settings.healthStatuses}
        preselectedCowId={preselectedCowId}
        batches={dbData.batches.filter(b => b.status === 'Active' && batchCattle(b, activeCows).length > 0).map(b => ({ id: b.id, name: b.name, head: batchCattle(b, activeCows).length }))}
        onPickBatch={id => { setIsQuickEntryOpen(false); setWeighBatchId(id); }}
        onSave={async (cowId, weight, healthStatus, date) => {
          await addWeightMutation.mutateAsync({ cowId, weight, healthStatus, date });
        }}
      />
      {weighBatchId && (() => {
        const wb = dbData.batches.find(b => b.id === weighBatchId);
        return wb ? (
          <WeighGroupFlow
            isOpen
            onClose={() => setWeighBatchId(null)}
            batch={wb}
            cattle={batchCattle(wb, activeCows)}
            onSave={async records => { await recordBatchWeightsMutation.mutateAsync(records); }}
          />
        ) : null;
      })()}
      <AddCattleFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'add'}
        onClose={() => setIsQuickEntryOpen(false)}
        common={dbData.settings}
        existingCattle={activeCows}
        currentUser={currentUser}
        defaultFarm={focusFarm || undefined}
        onSave={async cow => {
          await addCowMutation.mutateAsync(cow);
        }}
      />
      <FeedInFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'feed'}
        onClose={() => setIsQuickEntryOpen(false)}
        products={hasPermission(currentUser, 'feed_manage') ? dbData.feedProducts || [] : (dbData.feedProducts || []).filter(p => p.ownerFarm === currentUser?.farmLocation)}
        farms={dbData.settings?.farms ?? []}
        currentUser={currentUser}
        defaultFarm={focusFarm || undefined}
        onSave={async tx => {
          await addFeedTransactionMutation.mutateAsync(tx);
        }}
      />
      <DailyFeedFlow
        isOpen={!!dailyFeed}
        onClose={() => setDailyFeed(null)}
        batches={dbData.batches}
        stock={dbData.stock}
        products={dbData.feedProducts || []}
        transactions={dbData.feedTransactions || []}
        farms={dbData.settings?.farms ?? []}
        currentUser={currentUser}
        presetFarm={dailyFeed?.farm ?? (focusFarm || undefined)}
        presetDay={dailyFeed?.day}
        onSave={async input => {
          await recordDailyFeedMutation.mutateAsync(input);
        }}
      />
      <CostFlow
        isOpen={costOpen}
        onClose={() => setCostOpen(false)}
        farms={dbData.settings?.farms ?? []}
        categories={costCategoriesFrom(dbData.settings)}
        currentUser={currentUser}
        onSave={async input => {
          await addCostMutation.mutateAsync(input);
        }}
      />
      <TreatFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'treat'}
        onClose={() => setIsQuickEntryOpen(false)}
        cattle={activeCows}
        common={dbData.settings}
        currentUser={currentUser}
        preselectedCowId={preselectedCowId}
        preselectedCowIds={treatCowIds}
        onSave={async log => {
          await addHealthLogMutation.mutateAsync(log);
        }}
      />
      <SellFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'sale'}
        onClose={() => setIsQuickEntryOpen(false)}
        cattle={activeCows}
        preselectedCowId={preselectedCowId}
        onWeigh={async (cowId, weight, healthStatus, date) => {
          await addWeightMutation.mutateAsync({ cowId, weight, healthStatus, date });
        }}
        onSell={async (cowId, unitPrice, saleType, date, buyer) => {
          await recordSaleMutation.mutateAsync({ cowId, unitPrice, saleType, date, buyer });
        }}
      />
    </SidebarLayout>
  );
}
