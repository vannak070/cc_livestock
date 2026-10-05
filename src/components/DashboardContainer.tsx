'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getLivestockDataAction, 
  addStockItemAction, 
  updateStockItemAction,
  addWeightRecordAction, 
  recordSaleAction, 
  recordBatchSaleAction, 
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
import SidebarLayout, { ActiveTabType } from './layout/SidebarLayout';
import DashboardHome from './DashboardHome';
import InventoryTable from './InventoryTable';
import BatchTab from './BatchTab';
import FeedInventoryTab from './FeedInventoryTab';
import HealthTab from './HealthTab';
import WeightTab from './WeightTab';
import FinanceTab from './FinanceTab';
import AnalyticsTab from './AnalyticsTab';
import ProposalPlanTab from './ProposalPlanTab';
import SettingsTab from './SettingsTab';
import FarmsTab from './FarmsTab';
import CowDetails from './CowDetails';
import QuickEntryModal from './QuickEntryModal';
import { ERPLivestockData, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { ProposalPlanParams } from '@/types';
import { SalesRecord } from '@/lib/xlsx-parser';
import { hasPermission } from '@/lib/utils';
import { PermissionKey } from '@/types/settings.types';

interface DashboardContainerProps {
  initialData: ERPLivestockData;
  // Verified server-side from the session cookie (see src/app/page.tsx).
  currentUser: UserRoleItem;
}

export default function DashboardContainer({ initialData, currentUser }: DashboardContainerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTabType>('dashboard');

  // Modal States
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryTab, setQuickEntryTab] = useState<'add' | 'weight' | 'sale'>('add');
  const [preselectedCowId, setPreselectedCowId] = useState<string | null>(null);

  const [selectedCowDetailsId, setSelectedCowDetailsId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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

  const recordBatchSaleMutation = useMutation({
    mutationFn: async ({ batchId, unitPrice, saleType, date }: { batchId: string; unitPrice: number; saleType: 'Weight' | 'Lumpsum'; date?: string }) => {
      const res = await recordBatchSaleAction(batchId, unitPrice, saleType, date);
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
  const healthAlertsCount = activeCows.filter(c =>
    ['poor', 'sick', 'critical', 'quarantine'].includes(c.healthStatus?.toLowerCase() || '')
  ).length;
  const vaccineAlertsCount = activeCows.filter(c =>
    dbData.healthLogs.some(l => l.cowId === c.id && (l.type === 'Disease' || l.notes?.toLowerCase().includes('sick')))
  ).length;

  // Trigger Action panel
  const handleOpenQuickEntry = (tabType: 'add' | 'weight' | 'sale' = 'add', cowId: string | null = null) => {
    setQuickEntryTab(tabType);
    setPreselectedCowId(cowId);
    setIsQuickEntryOpen(true);
  };

  const handleViewDetails = (cowId: string) => {
    setSelectedCowDetailsId(cowId);
    setIsDetailsOpen(true);
  };

  const handleLogout = async () => {
    await logoutAction();
    queryClient.clear();
    router.refresh();
  };

  React.useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'dashboard') return;

    let permissionKey: PermissionKey | null = null;
    if (activeTab === 'cow-inventory') permissionKey = 'stock_view';
    else if (activeTab === 'batch-management') permissionKey = 'batch_view';
    else if (activeTab === 'health-tracking') permissionKey = 'health_view';
    else if (activeTab === 'weight-tracking') permissionKey = 'weight_view';
    else if (activeTab === 'sales-finance') permissionKey = 'sales_view';
    else if (activeTab === 'analytics') permissionKey = 'analytics_view';
    else if (activeTab === 'settings') permissionKey = 'settings_manage';
    else if (activeTab === 'farms') permissionKey = 'farms_manage';

    if (permissionKey && !hasPermission(currentUser, permissionKey)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUser]);

  return (
    <SidebarLayout
      stock={dbData.stock}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onOpenQuickEntry={() => handleOpenQuickEntry('add')}
      healthAlertsCount={healthAlertsCount}
      vaccineAlertsCount={vaccineAlertsCount}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {/* Dynamic Tab Rendering */}
      {activeTab === 'dashboard' && (
        <DashboardHome
          data={dbData}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      )}

      {activeTab === 'cow-inventory' && (
        <InventoryTable
          stock={dbData.stock}
          weightTracking={dbData.weightTracking}
          onViewDetails={handleViewDetails}
          onEditCow={(cowId) => handleOpenQuickEntry('weight', cowId)}
          onRecordSale={(cowId) => handleOpenQuickEntry('sale', cowId)}
          onDeleteCow={async (cowId) => {
            await deleteStockItemMutation.mutateAsync(cowId);
          }}
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
        <FeedInventoryTab
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
          currentUser={currentUser}
          farms={dbData.settings?.farms ?? []}
        />
      )}

      {activeTab === 'health-tracking' && (
        <HealthTab
          data={dbData}
          onAddHealthLog={async (log) => {
            await addHealthLogMutation.mutateAsync(log);          }}
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
        <WeightTab
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

      {/* View Details Modal */}
      <CowDetails
        cowId={selectedCowDetailsId}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        stock={dbData.stock}
        weightTracking={dbData.weightTracking}
        salesTracking={dbData.salesTracking}
        healthLogs={dbData.healthLogs}
        onUpdateCowImage={async (cowId, imageUrl) => {
          await updateStockItemAction(cowId, { imageUrl });
          queryClient.invalidateQueries({ queryKey: ['livestock'] });
        }}
      />

      {/* Quick Entry / Action Modal */}
      <QuickEntryModal
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        common={dbData.settings} // Feed the settings master data instead of old hardcoded sheet
        activeCows={activeCows}
        activeBatches={dbData.batches.filter(b => b.status === 'Active')}
        defaultTab={quickEntryTab}
        preselectedCowId={preselectedCowId}
        currentUser={currentUser}
        onAddCow={async (data) => {
          await addCowMutation.mutateAsync(data);
        }}
        onAddWeight={async (cowId, weight, healthStatus, date) => {
          await addWeightMutation.mutateAsync({ cowId, weight, healthStatus, date });
        }}
        onRecordSale={async (cowId, unitPrice, saleType, date, buyer) => {
          await recordSaleMutation.mutateAsync({ cowId, unitPrice, saleType, date, buyer });
        }}
        onRecordBatchSale={async (batchId, unitPrice, saleType, date) => {
          await recordBatchSaleMutation.mutateAsync({ batchId, unitPrice, saleType, date });
        }}
      />
    </SidebarLayout>
  );
}
