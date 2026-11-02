'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getLivestockDataAction, 
  addStockItemAction, 
  readReceiptAction,
  getLivestockPartsAction,
  registerReceiptAction,
  checkReceiptDuplicateAction,
  addWeightRecordAction, 
  recordSaleAction, recordBatchSaleAction, 
  createBatchAction, 
  assignCowsToBatchAction, 
  addHealthLogAction, 
  removeCowFromBatchAction, 
  updateBatchAction, 
  recordBatchWeightsAction, 
  reviewBatchSaleAction,
  recordFollowUpAction,
  finishFollowUpAction,
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
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import SidebarLayout, { ActiveTabType, RecordAction } from './layout/SidebarLayout';
import TodayTab from './TodayTab';
import type { Show as BatchesShow } from './features/batch/BatchesPage';
import type { SaleReviewInput } from '@/lib/sale-review';
import { LimitRequestFlow } from './features/farms/FarmLimitFlows';
import FollowUpFlow from './features/cattle/FollowUpFlow';
import type { Tab as PlansTab } from './features/action-plans/ActionPlansPage';
import { canSeeActionPlans } from '@/lib/action-plans';
import { canSeeBilling } from '@/lib/billing';
import { canOpenWebsitePage } from '@/lib/website/access';
import type { FollowUpInput } from '@/lib/long-stay';
import type { CattleFollowUp } from '@/lib/types';
import { canSetLimits, limitState } from '@/lib/farm-limit';
import { RECEIPT_IMPORT_ENABLED, type ReceiptFile, type RegisterInput } from '@/lib/receipt-import';
import type { DataPart } from '@/lib/data-parts';
import { useOnChange } from '@/hooks/useOnChange';
import CattleList from './features/cattle/CattleList';
import FeedInFlow from './features/feed/FeedInFlow';
import DailyFeedFlow from './features/feed/DailyFeedFlow';
import type { DailyFeedInput } from '@/lib/daily-feed';
import TreatFlow from './features/health/TreatFlow';
import SellFlow from './features/sales/SellFlow';
import BuybackFlow, { type BuybackTarget } from './features/sales/BuybackFlow';
import { BUYBACK_BUYER } from '@/lib/buyback';
import WeighFlow from './features/weigh/WeighFlow';
import WeighGroupFlow from './features/batch/WeighGroupFlow';
import { batchCattle } from '@/lib/batch-stats';
import AddCattleFlow, { type AddCattlePrefill } from './features/stock/AddCattleFlow';
import CostFlow from './features/costs/CostFlow';
import { costCategoriesFrom, type FarmCostInput } from '@/lib/farm-costs';
import { ERPLivestockData, FeedProductItem, FeedStockTransaction, UserRoleItem } from '@/lib/types';
import { ProposalPlanParams } from '@/types';
import { SalesRecord } from '@/lib/xlsx-parser';
import { canOpenReports, canUsePlanning, hasPermission } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { canOpenPeople } from '@/lib/user-admin';
import { scopeDataToFarm } from '@/lib/farm-view';
import { focusKey, validFocus } from '@/lib/working-on';
import { useStoredValue } from '@/hooks/useStoredValue';
import WorkingOnSwitcher from './layout/WorkingOnSwitcher';
import IdleSignOut from './providers/IdleSignOut';
import { PermissionKey } from '@/types/settings.types';
import { sickCattle, cattleWithDiseaseHistory } from '@/lib/attention';
import { Scale, Syringe, PlusCircle, DollarSign, Package, Wheat, Receipt } from 'lucide-react';

// Each page is its own download, fetched the first time its tab opens (the first screen stays small).
const TabLoading = () => <div role="status" aria-busy="true" className="mx-auto h-64 max-w-5xl animate-pulse rounded-2xl bg-slate-100" />;
const BatchesPage = dynamic(() => import('./features/batch/BatchesPage'), { loading: TabLoading });
const FeedPage = dynamic(() => import('./features/feed/FeedPage'), { loading: TabLoading });
const HealthPage = dynamic(() => import('./features/health/HealthPage'), { loading: TabLoading });
const WeightsPage = dynamic(() => import('./features/weight/WeightsPage'), { loading: TabLoading });
const SalesPage = dynamic(() => import('./features/sales/SalesPage'), { loading: TabLoading });
const ReportsPage = dynamic(() => import('./features/reports/ReportsPage'), { loading: TabLoading });
const PlanningPage = dynamic(() => import('./features/planning/PlanningPage'), { loading: TabLoading });
const SettingsPage = dynamic(() => import('./features/settings/SettingsPage'), { loading: TabLoading });
const FarmsPage = dynamic(() => import('./features/farms/FarmsPage'), { loading: TabLoading });
const BillingPage = dynamic(() => import('./features/billing/BillingPage'), { loading: TabLoading });
const ActionPlansPage = dynamic(() => import('./features/action-plans/ActionPlansPage'), { loading: TabLoading });
const WebsitePage = dynamic(() => import('./features/website/WebsitePage'), { loading: TabLoading });
const CostsPage = dynamic(() => import('./features/costs/CostsPage'), { loading: TabLoading });
const CattleDetailPage = dynamic(() => import('./features/cattle/CattleDetailPage'), { loading: TabLoading });
const ReceiptImportFlow = dynamic(() => import('./features/cattle/ReceiptImportFlow'), { loading: () => null });
const MyAccountDialog = dynamic(() => import('./features/account/MyAccountDialog'), { loading: () => null });

const TAB_PERMISSION: Partial<Record<ActiveTabType, PermissionKey>> = {
  today: 'dashboard_view',
  'cow-inventory': 'stock_view',
  'batch-management': 'batch_view',
  'health-tracking': 'health_view',
  'weight-tracking': 'weight_view',
  'sales-finance': 'sales_view',
  farms: 'farms_manage',
  'feed-inventory': 'feed_view',
  costs: 'costs_view',
};

/** True when this person may not open the tab. Settings is also a farm owner's People page, and Planning is for a few roles only, so they have their own rules. */
function isTabBlocked(tab: ActiveTabType, user: UserRoleItem): boolean {
  if (tab === 'settings') return !canOpenPeople(user);
  if (tab === 'analytics') return !canOpenReports(user);
  if (tab === 'billing') return !canSeeBilling(user);
  if (tab === 'action-plans') return !canSeeActionPlans(user);
  if (tab === 'website') return !canOpenWebsitePage(user);
  if (tab === 'proposal-plan') return !canUsePlanning(user);
  const key = TAB_PERMISSION[tab];
  return !!key && !hasPermission(user, key);
}

interface DashboardContainerProps {
  initialData: ERPLivestockData;
  // Verified server-side from the session cookie (see src/app/page.tsx).
  currentUser: UserRoleItem;
  /** When the sign-in runs out without activity (src/lib/session-policy.ts). */
  session: { expiresAt: number; idleMinutes: number };
}

const signOutOnServer = async () => { await logoutAction(); };

export default function DashboardContainer({ initialData, currentUser, session }: DashboardContainerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useLanguage();
  // Management is read-only oversight: it starts on the Summary. Everyone else
  // starts on Today, the list of what needs doing.
  // Which Action plans tab opens first (Planning's "Use for a farm" opens the calendar and setup).
  const [plansTab, setPlansTab] = useState<PlansTab>('tasks');
  // Real work started from a farm task: cattle sold to a farm are registered, a buy-back sells the batch to CC Livestock.
  const [addForTask, setAddForTask] = useState<AddCattlePrefill | null>(null);
  const [buybackTarget, setBuybackTarget] = useState<BuybackTarget | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTabType>(currentUser.role === 'Management' ? 'analytics' : 'today');

  // Modal States
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [quickEntryTab, setQuickEntryTab] = useState<'add' | 'weight' | 'sale' | 'treat' | 'feed'>('add');
  const [preselectedCowId, setPreselectedCowId] = useState<string | null>(null);
  const [weighBatchId, setWeighBatchId] = useState<string | null>(null);
  // Alerts link straight to the sale review; any other way into Batches starts on the usual list.
  const [batchesShow, setBatchesShow] = useState<BatchesShow>('Active');
  // Today can open the Cattle page already showing the long-stay list.
  const [cattleLongStay, setCattleLongStay] = useState(false);
  const changeTab = (tab: ActiveTabType) => { setBatchesShow('Active'); setCattleLongStay(false); setPlansTab('tasks'); setActiveTab(tab); };
  const openLongStay = () => { setCattleLongStay(true); setSelectedCowDetailsId(null); setActiveTab('cow-inventory'); };
  // The "what happens next" dialog for a long-stay animal.
  const [followUpFor, setFollowUpFor] = useState<null | { cowId: string; months?: number; current?: CattleFollowUp }>(null);
  const openSaleReview = () => { setBatchesShow('Review'); setActiveTab('batch-management'); };
  // The day's feed dialog: optionally for one farm (the office helping a farm) and/or a missed day.
  const [dailyFeed, setDailyFeed] = useState<null | { farm?: string; day?: string }>(null);
  // "Ask for more cattle" (a farm's cattle limit, src/lib/farm-limit.ts), opened from Today, Farms and Add cattle.
  const [askLimitFarm, setAskLimitFarm] = useState<string | null>(null);
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
    // Coming back to the tab reloads only when the data is over 5 minutes old (other people's changes), not every time.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // After a save, load again only the pieces it changed and merge them in (not the whole database).
  // The data keeps its old "last loaded" time, so a quick save does not hide other people's changes elsewhere.
  const refreshParts = async (parts: DataPart[]) => {
    const key = ['livestock'];
    const res = await getLivestockPartsAction(parts);
    if (!res.success) {
      if (res.status === 401) router.refresh();
      await queryClient.invalidateQueries({ queryKey: key });
      return;
    }
    const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt;
    queryClient.setQueryData<ERPLivestockData>(key, old => (old ? { ...old, ...res.data } : old), updatedAt ? { updatedAt } : undefined);
  };

  // Already scoped to this user's farm on the server (src/lib/data-scope.ts).
  const fullData = rawDbData;

  // "Working on": an office account can look at one farm at a time. Every page and form
  // then works on that farm only, as a farm's own staff see it. It is a view choice, not
  // a permission, and is remembered on this browser. Farms and Settings keep seeing everything.
  const farmNames = useMemo(() => (fullData.settings?.farms ?? []).map(f => f.name), [fullData.settings?.farms]);
  const canChooseFarm = !currentUser.farmLocation && farmNames.length > 1;
  const [focus, chooseFarm] = useStoredValue(focusKey(currentUser.id), '');
  const focusFarm = canChooseFarm ? validFocus(focus, farmNames) : '';
  const dbData = useMemo(() => (focusFarm ? scopeDataToFarm(fullData, focusFarm, { includeFeed: true }) : fullData), [fullData, focusFarm]);
  // The same person, tied to the chosen farm, for the pages that hide their own farm filters for farm staff.
  const pageUser = useMemo(() => (focusFarm ? { ...currentUser, farmLocation: focusFarm } : currentUser), [currentUser, focusFarm]);
  // Who may ask for a higher cattle limit (same rule as farm-limit.service request()); admins set limits themselves.
  const canAskMoreCattle = hasPermission(currentUser, 'stock_create') || hasPermission(currentUser, 'farms_manage');
  // Who records next actions for long-stay cattle (same permission as the batch sale review).
  const canReviewLongStay = hasPermission(currentUser, 'batch_review');

  // Mutations
  const addCowMutation = useMutation({
    mutationFn: async (newCow: Omit<Parameters<typeof addStockItemAction>[0], 'status'> & { status?: string }) => {
      const res = await addStockItemAction({ ...newCow, status: newCow.status ?? 'Active' });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking']);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    }
  });

  // Stable, so the upload screen's "was this receipt registered before?" check does not re-run on every render.
  const checkReceiptDuplicate = useCallback(async (input: Pick<RegisterInput, 'invoiceNo' | 'seller' | 'date' | 'rows'>) => {
    const res = await checkReceiptDuplicateAction(input);
    if (!res.success) throw new Error(res.error);
    return res.data;
  }, []);

  const registerReceiptMutation = useMutation({
    mutationFn: async ({ input, options }: { input: RegisterInput; options: { file?: ReceiptFile | null; confirmedDifferent?: boolean } }) => {
      const res = await registerReceiptAction(input, options);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking']);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['ops-programs'] });
    }
  });

  const addWeightMutation = useMutation({
    mutationFn: async ({ cowId, weight, healthStatus, date }: { cowId: string; weight: number; healthStatus: string; date?: string }) => {
      const res = await addWeightRecordAction(cowId, weight, healthStatus, date);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking']);
    }
  });

  const recordSaleMutation = useMutation({
    mutationFn: async ({ cowId, unitPrice, saleType, date, buyer }: { cowId: string; unitPrice: number; saleType: 'Weight' | 'Lumpsum'; date?: string; buyer?: string }) => {
      const res = await recordSaleAction(cowId, unitPrice, saleType, date, buyer);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['stock', 'salesTracking']);
    }
  });

  const recordBuybackMutation = useMutation({
    mutationFn: async ({ batchId, pricePerKg, date }: { batchId: string; pricePerKg: number; date: string }) => {
      const res = await recordBatchSaleAction(batchId, pricePerKg, 'Weight', date, BUYBACK_BUYER);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['stock', 'salesTracking', 'batches']);
    }
  });

  const createBatchMutation = useMutation({
    mutationFn: async (batch: Parameters<typeof createBatchAction>[0]) => {
      const res = await createBatchAction(batch);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['batches']);
    }
  });

  const assignCowsMutation = useMutation({
    mutationFn: async ({ batchId, cowIds }: { batchId: string; cowIds: string[] }) => {
      const res = await assignCowsToBatchAction(batchId, cowIds);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['batches']);
    }
  });

  const addHealthLogMutation = useMutation({
    mutationFn: async (log: Parameters<typeof addHealthLogAction>[0]) => {
      const res = await addHealthLogAction(log);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['healthLogs', 'stock']);
    }
  });

  const removeCowMutation = useMutation({
    mutationFn: async ({ batchId, cowId }: { batchId: string; cowId: string }) => {
      const res = await removeCowFromBatchAction(batchId, cowId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['batches']);
    }
  });

  const updateBatchMutation = useMutation({
    mutationFn: async ({ batchId, updates }: { batchId: string; updates: Parameters<typeof updateBatchAction>[1] }) => {
      const res = await updateBatchAction(batchId, updates);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['batches']);
    }
  });

  const recordBatchWeightsMutation = useMutation({
    mutationFn: async (records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]) => {
      const res = await recordBatchWeightsAction(records);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking']);
    }
  });

  const reviewBatchSaleMutation = useMutation({
    mutationFn: async ({ batchId, input }: { batchId: string; input: SaleReviewInput }) => {
      const res = await reviewBatchSaleAction(batchId, input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['batches']);
    }
  });

  const recordFollowUpMutation = useMutation({
    mutationFn: async ({ cowId, input }: { cowId: string; input: FollowUpInput }) => {
      const res = await recordFollowUpAction(cowId, input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['cattleFollowUps']);
    }
  });

  const finishFollowUpMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await finishFollowUpAction(id);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      refreshParts(['cattleFollowUps']);
    }
  });

  const deleteStockItemMutation = useMutation({
    mutationFn: async (cowId: string) => {
      const res = await deleteStockItemAction(cowId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking', 'salesTracking', 'healthLogs', 'batches', 'cattleFollowUps']);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    }
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await deleteBatchAction(batchId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['batches']);
    }
  });

  const deleteHealthLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await deleteHealthLogAction(logId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['healthLogs', 'stock']);
    }
  });

  const updateHealthLogMutation = useMutation({
    mutationFn: async ({ logId, updates }: { logId: string; updates: Parameters<typeof updateHealthLogAction>[1] }) => {
      const res = await updateHealthLogAction(logId, updates);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['healthLogs', 'stock']);
    }
  });

  const deleteWeightRecordMutation = useMutation({
    mutationFn: async ({ cowId, trackingDate }: { cowId: string; trackingDate: string }) => {
      const res = await deleteWeightRecordAction(cowId, trackingDate);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking']);
    }
  });

  const updateWeightRecordMutation = useMutation({
    mutationFn: async ({ cowId, trackingDate, currentWeight, healthStatus }: { cowId: string; trackingDate: string; currentWeight: number; healthStatus: string }) => {
      const res = await updateWeightRecordAction(cowId, trackingDate, currentWeight, healthStatus);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['stock', 'weightTracking']);
    }
  });

  const deleteSalesRecordMutation = useMutation({
    mutationFn: async (cowId: string) => {
      const res = await deleteSalesRecordAction(cowId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['stock', 'salesTracking']);
    }
  });

  const updateSalesRecordMutation = useMutation({
    mutationFn: async ({ cowId, updates }: { cowId: string; updates: Parameters<typeof updateSalesRecordAction>[1] }) => {
      const res = await updateSalesRecordAction(cowId, updates);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['stock', 'salesTracking']);
    }
  });

  const saveFeedProductMutation = useMutation({
    mutationFn: async (product: FeedProductItem) => {
      const res = await saveFeedProductAction(product);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['feedProducts']);
    }
  });

  const deleteFeedProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await deleteFeedProductAction(productId);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      refreshParts(['feedProducts', 'feedTransactions']);
    }
  });

  const saveProposalPlanMutation = useMutation({
    mutationFn: async ({ slot, name, params }: { slot: number; name: string; params: ProposalPlanParams }) => {
      const res = await saveProposalPlanAction(slot, name, params);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['proposalPlans']);
    }
  });

  const deleteProposalPlanMutation = useMutation({
    mutationFn: async (slot: number) => {
      const res = await deleteProposalPlanAction(slot);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['proposalPlans']);
    }
  });

  const addFeedTransactionMutation = useMutation({
    mutationFn: async (tx: FeedStockTransaction) => {
      const res = await addFeedTransactionAction(tx);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['feedTransactions']);
    }
  });

  const moveBatchFarmMutation = useMutation({
    mutationFn: async ({ batchId, farm, moveCattle }: { batchId: string; farm: string; moveCattle: boolean }) => {
      const res = await moveBatchFarmAction(batchId, farm, moveCattle);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { refreshParts(['batches', 'stock']); }
  });

  const moveCowMutation = useMutation({
    mutationFn: async ({ cowId, fromBatchId, toBatchId }: { cowId: string; fromBatchId: string; toBatchId: string }) => {
      const res = await moveCowToBatchAction(cowId, fromBatchId, toBatchId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { refreshParts(['batches']); }
  });

  const recordDailyFeedMutation = useMutation({
    mutationFn: async (input: DailyFeedInput) => {
      const res = await recordDailyFeedAction(input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      refreshParts(['feedTransactions']);
    }
  });

  const addCostMutation = useMutation({
    mutationFn: async (input: FarmCostInput) => {
      const res = await addFarmCostAction(input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { refreshParts(['farmCosts']); }
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteFarmCostAction(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { refreshParts(['farmCosts']); }
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

  // A tab this person may not open falls back to Today. Adjusted while rendering (as
  // useOnChange does), not in an effect that sets state after the render.
  if (activeTab !== 'today' && isTabBlocked(activeTab, currentUser)) setActiveTab('today');

  return (
    <SidebarLayout
      activeTab={activeTab}
      setActiveTab={changeTab}
      recordActions={recordActions}
      healthAlertsCount={healthAlertsCount}
      vaccineAlertsCount={vaccineAlertsCount}
      currentUser={currentUser}
      onLogout={handleLogout}
      onOpenAccount={() => setAccountOpen(true)}
      workingOn={canChooseFarm ? <WorkingOnSwitcher farms={farmNames} value={focusFarm} onChange={chooseFarm} /> : undefined}
    >
      <IdleSignOut expiresAt={session.expiresAt} idleMinutes={session.idleMinutes} onSignOut={signOutOnServer} />
      {/* Dynamic Tab Rendering */}
      {activeTab === 'today' && (
        <TodayTab
          data={dbData}
          currentUser={pageUser}
          recordActions={recordActions}
          onNavigate={changeTab}
          onOpenSaleReview={openSaleReview}
          onOpenLongStay={openLongStay}
          onRecordFeed={hasPermission(currentUser, 'feed_record') ? (farm, day) => setDailyFeed({ farm, day }) : undefined}
          onAskMore={canAskMoreCattle ? setAskLimitFarm : undefined}
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
          followUps={dbData.cattleFollowUps}
          longStayMonthsSetting={dbData.settings?.longStayMonths}
          onRecordFollowUp={canReviewLongStay ? (cowId, months, current) => setFollowUpFor({ cowId, months, current }) : undefined}
          onFinishFollowUp={canReviewLongStay ? async id => { await finishFollowUpMutation.mutateAsync(id); } : undefined}
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
          onUploadReceipt={RECEIPT_IMPORT_ENABLED && canSetLimits(currentUser) ? () => setReceiptOpen(true) : undefined}
          currentUser={pageUser}
          farms={dbData.settings?.farms ?? []}
          followUps={dbData.cattleFollowUps}
          longStayMonthsSetting={dbData.settings?.longStayMonths}
          startLongStay={cattleLongStay}
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
          onOpenActionPlans={() => changeTab('action-plans')}
          onNavigateToTab={changeTab}
          onOpenSaleReview={openSaleReview}
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
          onOpenPrograms={() => { setPlansTab('programs'); setActiveTab('action-plans'); }}
        />
      )}

      {activeTab === 'action-plans' && canSeeActionPlans(currentUser) && (
        <ActionPlansPage
          currentUser={currentUser}
          farms={focusFarm ? [focusFarm] : farmNames}
          batches={dbData.batches}
          stock={dbData.stock}
          sales={dbData.salesTracking}
          plans={dbData.proposalPlans ?? []}
          farmItems={dbData.settings.farms || []}
          initialTab={plansTab}
          onOpenPlanning={canUsePlanning(currentUser) ? () => setActiveTab('proposal-plan') : undefined}
          onAddCattleForTask={hasPermission(currentUser, 'stock_create') ? t => setAddForTask({ farm: t.farm, origin: 'Purchase', pricePerKg: t.pricePerKg, taskLine: t.title }) : undefined}
          onBuyBackForTask={hasPermission(currentUser, 'sales_record') ? setBuybackTarget : undefined}
        />
      )}
      {activeTab === 'settings' && (
        <SettingsPage
          settings={dbData.settings}
          currentUser={currentUser}
          onOpenFarms={hasPermission(currentUser, 'farms_manage') ? () => setActiveTab('farms') : undefined}
        />
      )}

      {activeTab === 'billing' && canSeeBilling(currentUser) && <BillingPage />}
      {activeTab === 'website' && canOpenWebsitePage(currentUser) && <WebsitePage />}

      {activeTab === 'farms' && (
        <FarmsPage
          settings={dbData.settings}
          currentUser={currentUser}
          stock={fullData.stock}
          batches={fullData.batches}
          onRecordFeed={hasPermission(currentUser, 'feed_record') ? farm => setDailyFeed({ farm }) : undefined}
          limitRequests={fullData.farmLimitRequests}
          limitChanges={fullData.farmLimitChanges}
          onAskMore={canAskMoreCattle ? setAskLimitFarm : undefined}
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
        isOpen={(isQuickEntryOpen && quickEntryTab === 'add') || !!addForTask}
        onClose={() => { setIsQuickEntryOpen(false); setAddForTask(null); }}
        prefill={addForTask ?? undefined}
        common={dbData.settings}
        existingCattle={activeCows}
        currentUser={currentUser}
        defaultFarm={focusFarm || undefined}
        onSave={async cow => {
          await addCowMutation.mutateAsync(cow);
        }}
        registeredCattle={fullData.stock}
        limitRequests={fullData.farmLimitRequests}
        onAskMore={canAskMoreCattle ? setAskLimitFarm : undefined}
      />
      {accountOpen && <MyAccountDialog open onClose={() => setAccountOpen(false)} user={currentUser} />}
      {receiptOpen && <ReceiptImportFlow
        isOpen
        onClose={() => setReceiptOpen(false)}
        common={dbData.settings}
        existingCattle={fullData.stock}
        registeredCattle={fullData.stock}
        defaultFarm={focusFarm || undefined}
        onRead={async file => {
          const res = await readReceiptAction(file);
          if (!res.success) throw new Error(res.error);
          return res.data;
        }}
        onCheckDuplicate={checkReceiptDuplicate}
        onRegister={async (input, options) => { await registerReceiptMutation.mutateAsync({ input, options }); }}
      />}
      <FollowUpFlow
        isOpen={!!followUpFor}
        onClose={() => setFollowUpFor(null)}
        cowId={followUpFor?.cowId ?? ''}
        months={followUpFor?.months}
        current={followUpFor?.current}
        onSave={async (cowId, input) => { await recordFollowUpMutation.mutateAsync({ cowId, input }); }}
      />
      {(() => {
        const farm = (fullData.settings?.farms ?? []).find(f => f.name === askLimitFarm);
        const ls = farm ? limitState(farm, fullData.stock) : { limit: 0, used: 0 };
        return (
          <LimitRequestFlow
            isOpen={!!askLimitFarm}
            onClose={() => setAskLimitFarm(null)}
            farm={askLimitFarm ?? ''}
            limit={ls.limit}
            used={ls.used}
          />
        );
      })()}
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
      <BuybackFlow
        isOpen={!!buybackTarget}
        onClose={() => setBuybackTarget(null)}
        target={buybackTarget}
        onThenAdd={next => { setBuybackTarget(null); setAddForTask({ farm: next.farm, origin: 'Purchase', pricePerKg: next.pricePerKg, taskLine: next.title }); }}
        batches={fullData.batches}
        stock={fullData.stock}
        onBuyBack={async (batchId, pricePerKg, date) => { await recordBuybackMutation.mutateAsync({ batchId, pricePerKg, date }); }}
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
