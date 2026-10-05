'use client';

import React, { useState } from 'react';
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
  recordBatchHealthLogAction, 
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
  saveProposalPlanAction,
  logoutAction
} from '@/app/actions';
import { useRouter } from 'next/navigation';
import SidebarLayout, { ActiveTabType, RecordAction } from './layout/SidebarLayout';
import TodayTab from './TodayTab';
import DashboardHome from './DashboardHome';
import BatchTab from './BatchTab';
import FeedPage from './features/feed/FeedPage';
import HealthPage from './features/health/HealthPage';
import WeightsPage from './features/weight/WeightsPage';
import FinanceTab from './FinanceTab';
import AnalyticsTab from './AnalyticsTab';
import ProposalPlanTab from './ProposalPlanTab';
import SettingsTab from './SettingsTab';
import FarmsTab from './FarmsTab';
import { useOnChange } from '@/hooks/useOnChange';
import CattleList from './features/cattle/CattleList';
import CattleDetailPage from './features/cattle/CattleDetailPage';
import FeedInFlow from './features/feed/FeedInFlow';
import TreatFlow from './features/health/TreatFlow';
import SellFlow from './features/sales/SellFlow';
import WeighFlow from './features/weigh/WeighFlow';
import AddCattleFlow from './features/stock/AddCattleFlow';
import { ERPLivestockData, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { ProposalPlanParams } from '@/types';
import { SalesRecord } from '@/lib/xlsx-parser';
import { hasPermission } from '@/lib/utils';
import { PermissionKey } from '@/types/settings.types';
import { sickCattle, cattleWithDiseaseHistory } from '@/lib/attention';
import { Scale, Syringe, PlusCircle, DollarSign, Package } from 'lucide-react';

interface DashboardContainerProps {
  initialData: ERPLivestockData;
  // Verified server-side from the session cookie (see src/app/page.tsx).
  currentUser: UserRoleItem;
}

export default function DashboardContainer({ initialData, currentUser }: DashboardContainerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  // Management is read-only oversight: it starts on the Summary. Everyone else
  // starts on Today, the list of what needs doing.
  const [activeTab, setActiveTab] = useState<ActiveTabType>(currentUser.role === 'Management' ? 'dashboard' : 'today');

  // Modal States
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryTab, setQuickEntryTab] = useState<'add' | 'weight' | 'sale' | 'treat' | 'feed'>('add');
  const [preselectedCowId, setPreselectedCowId] = useState<string | null>(null);

  const [selectedCowDetailsId, setSelectedCowDetailsId] = useState<string | null>(null);
  // Leaving the Cattle page closes the animal that was open.
  useOnChange(activeTab, () => setSelectedCowDetailsId(null));

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
  const dbData = rawDbData;

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

  const recordBatchHealthLogMutation = useMutation({
    mutationFn: async ({ batchId, log }: { batchId: string; log: Parameters<typeof recordBatchHealthLogAction>[1] }) => {
      const res = await recordBatchHealthLogAction(batchId, log);
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
    mutationFn: async (params: ProposalPlanParams) => {
      const res = await saveProposalPlanAction(params);
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

  // Active cows list & health alert counters (strictly scoped to current user's farm)
  const activeCows = dbData.stock.filter(c => c.status.toLowerCase() === 'active');
  const healthAlertsCount = sickCattle(dbData.stock).length;
  const vaccineAlertsCount = cattleWithDiseaseHistory(dbData).length;

  // Trigger Action panel
  const handleOpenQuickEntry = (tabType: 'add' | 'weight' | 'sale' | 'treat' | 'feed' = 'add', cowId: string | null = null) => {
    setQuickEntryTab(tabType);
    setPreselectedCowId(cowId);
    setIsQuickEntryOpen(true);
  };

  // What this person may record, shown on Today and behind the phone's Record
  // button. Each opens a guided dialog.
  const recordActions: RecordAction[] = ([
    hasPermission(currentUser, 'weight_record') && { key: 'weigh', label: 'Weigh', icon: <Scale className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('weight') },
    hasPermission(currentUser, 'health_record') && { key: 'treat', label: 'Treat', icon: <Syringe className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('treat') },
    hasPermission(currentUser, 'stock_create') && { key: 'add', label: 'Add cattle', icon: <PlusCircle className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('add') },
    hasPermission(currentUser, 'sales_record') && { key: 'sell', label: 'Sell', icon: <DollarSign className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('sale') },
    hasPermission(currentUser, 'feed_manage') && { key: 'feed', label: 'Feed in', icon: <Package className="h-7 w-7" />, onClick: () => handleOpenQuickEntry('feed') }
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
    else if (activeTab === 'settings') permissionKey = 'settings_manage';
    else if (activeTab === 'farms') permissionKey = 'farms_manage';
    else if (activeTab === 'feed-inventory') permissionKey = 'feed_view';
    else if (activeTab === 'proposal-plan') permissionKey = 'analytics_view';

    if (permissionKey && !hasPermission(currentUser, permissionKey) && activeTab !== 'today') {
      setActiveTab('today');
    }
  }, [activeTab, currentUser]);

  return (
    <SidebarLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      recordActions={recordActions}
      healthAlertsCount={healthAlertsCount}
      vaccineAlertsCount={vaccineAlertsCount}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {/* Dynamic Tab Rendering */}
      {activeTab === 'today' && (
        <TodayTab
          data={dbData}
          currentUser={currentUser}
          recordActions={recordActions}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardHome
          data={dbData}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      )}

      {activeTab === 'cow-inventory' && selectedCowDetailsId && (
        <CattleDetailPage
          cowId={selectedCowDetailsId}
          stock={dbData.stock}
          weightTracking={dbData.weightTracking}
          salesTracking={dbData.salesTracking}
          healthLogs={dbData.healthLogs}
          currentUser={currentUser}
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
          currentUser={currentUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'batch-management' && (
        <BatchTab
          data={dbData}
          onCreateBatch={async (batch) => {
            const batchWithLoc = {
              ...batch,
              farmLocation: batch.farmLocation || currentUser?.farmLocation || undefined
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
          onRecordBatchHealthLog={async (batchId, log) => {
            await recordBatchHealthLogMutation.mutateAsync({ batchId, log });
          }}
          onDeleteBatch={async (batchId) => {
            await deleteBatchMutation.mutateAsync(batchId);
          }}
          currentUser={currentUser}
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
          currentUser={currentUser}
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
          currentUser={currentUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'weight-tracking' && (
        <WeightsPage
          data={dbData}
          onOpenLogWeight={(cowId) => handleOpenQuickEntry('weight', cowId || null)}
          onDeleteWeightRecord={async (cowId, trackingDate) => {
            await deleteWeightRecordMutation.mutateAsync({ cowId, trackingDate });
          }}
          onUpdateWeightRecord={async (cowId, trackingDate, currentWeight, healthStatus) => {
            await updateWeightRecordMutation.mutateAsync({ cowId, trackingDate, currentWeight, healthStatus });
          }}
          currentUser={currentUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'sales-finance' && (
        <FinanceTab
          data={dbData}
          onDeleteSalesRecord={async (cowId: string) => {
            await deleteSalesRecordMutation.mutateAsync(cowId);
          }}
          onUpdateSalesRecord={async (cowId: string, updates: Partial<SalesRecord>) => {
            await updateSalesRecordMutation.mutateAsync({ cowId, updates });
          }}
          onRecordSaleClick={() => handleOpenQuickEntry('sale', null)}
          currentUser={currentUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          data={dbData}
          currentUser={currentUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'proposal-plan' && (
        <ProposalPlanTab
          initialPlan={dbData.proposalPlan?.params}
          onSavePlan={async (params) => {
            await saveProposalPlanMutation.mutateAsync(params);
          }}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          settings={dbData.settings}
          currentUser={currentUser}
        />
      )}

      {activeTab === 'farms' && (
        <FarmsTab
          settings={dbData.settings}
          currentUser={currentUser}
          stock={dbData.stock}
          batches={dbData.batches}
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
        onSave={async (cowId, weight, healthStatus, date) => {
          await addWeightMutation.mutateAsync({ cowId, weight, healthStatus, date });
        }}
      />
      <AddCattleFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'add'}
        onClose={() => setIsQuickEntryOpen(false)}
        common={dbData.settings}
        existingCattle={activeCows}
        currentUser={currentUser}
        onSave={async cow => {
          await addCowMutation.mutateAsync(cow);
        }}
      />
      <FeedInFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'feed'}
        onClose={() => setIsQuickEntryOpen(false)}
        products={dbData.feedProducts || []}
        farms={dbData.settings?.farms ?? []}
        currentUser={currentUser}
        onSave={async tx => {
          await addFeedTransactionMutation.mutateAsync(tx);
        }}
      />
      <TreatFlow
        isOpen={isQuickEntryOpen && quickEntryTab === 'treat'}
        onClose={() => setIsQuickEntryOpen(false)}
        cattle={activeCows}
        common={dbData.settings}
        currentUser={currentUser}
        preselectedCowId={preselectedCowId}
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
