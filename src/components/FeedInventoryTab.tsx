'use client';

import React, { useState, useMemo } from 'react';
import { 
  ERPLivestockData, 
  FeedProductItem, 
  FeedStockTransaction, 
  FeedBalanceItem, 
  FarmItem, UserRoleItem } from '@/lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { 
  Package, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowRightLeft, 
  AlertTriangle, 
  Search, 
  Layers, 
  DollarSign, 
  Scale, 
  FileText,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit3,
  Settings,
  Download
} from 'lucide-react';
import { FeedProductModal } from './features/feed/FeedProductModal';
import { FeedTransactionModal } from './features/feed/FeedTransactionModal';
import { FeedCategoryModal } from './features/feed/FeedCategoryModal';
import { ConfirmModal } from './ui/confirm-modal';
import { hasPermission, format2Decimals, format2DecimalsWithCommas } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import FarmFilterBar from './FarmFilterBar';
import { TablePagination } from './common/TablePagination';
import { exportToExcel } from '@/lib/excel-export';
import { DateRangeFilterBar } from './common/DateRangeFilterBar';
import { useOnChange } from '@/hooks/useOnChange';

interface FeedInventoryTabProps {
  data: ERPLivestockData;
  onSaveProduct: (product: FeedProductItem) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onAddTransaction: (tx: FeedStockTransaction) => Promise<void>;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

export default function FeedInventoryTab({
  data,
  onSaveProduct,
  onDeleteProduct,
  onAddTransaction,
  currentUser,
  farms = []
}: FeedInventoryTabProps) {
  const { t } = useLanguage();
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [subView, setSubView] = useState<'balances' | 'products' | 'transactions'>('balances');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'STOCK_IN' | 'STOCK_OUT'>('ALL');
  const [batchFilter, setBatchFilter] = useState('');
  const [balanceViewMode, setBalanceViewMode] = useState<'consolidated' | 'specific_batch'>('specific_batch');

  // Pagination States for SubViews
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(10);

  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(10);

  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(10);

  // Date Range Filter State for Movement Ledger
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset page when filters change
  useOnChange(
    JSON.stringify([searchQuery, categoryFilter, txTypeFilter, batchFilter, selectedFarm, balanceViewMode, balancePageSize, productPageSize, txPageSize, startDate, endDate]),
    () => { setBalancePage(1); setProductPage(1); setTxPage(1); }
  );

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FeedProductItem | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [txType, setTxType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: 'warning'
  });

  const products = data.feedProducts || [];
  const transactions = data.feedTransactions || [];

  const userFarm = currentUser?.farmLocation;
  const effectiveFarm = userFarm || selectedFarm;

  // Calculate Daily Feed Ration usage for active fattening batches
  const batchRationUsage = useMemo(() => {
    const activeBatches = (data.batches || []).filter(b => b.status === 'Active');
    
    let totalDailyRationKg = 0;
    let activeHeadcount = 0;

    activeBatches.forEach(b => {
      if (effectiveFarm && b.farmLocation && b.farmLocation !== effectiveFarm) return;
      
      const cattleCount = b.cowIds ? b.cowIds.length : 0;
      activeHeadcount += cattleCount;

      if (b.feedingProgram && b.feedingProgram.status === 'Active') {
        const dsrIngredient = b.feedingProgram.ingredients?.find(i => 
          i.name.toLowerCase().includes('dsr-16') || i.name.toLowerCase().includes('concentrate')
        ) || b.feedingProgram.ingredients?.[0];

        if (dsrIngredient) {
          const portionKg = dsrIngredient.portionPerHead || 0;
          totalDailyRationKg += (cattleCount * portionKg);
        }
      }
    });

    const totalDailyRationBags = totalDailyRationKg / 30;

    return {
      activeHeadcount,
      activeBatchesCount: activeBatches.length,
      totalDailyRationKg,
      totalDailyRationBags
    };
  }, [data.batches, effectiveFarm]);

  // Helper to extract clean farm location name
  const resolveRealFarmName = (farmStr?: string): string | null => {
    if (!farmStr) return null;
    if (farmStr.startsWith('Daily Feed') || farmStr === 'Supplier' || farmStr === 'Central Warehouse') return null;
    return farmStr;
  };

  // Compute real-time stock balances per product and per farm location
  const balances: FeedBalanceItem[] = useMemo(() => {
    const balanceMap: Record<string, { bags: number; kg: number }> = {};
    const defaultFarmName = farms[0]?.name || (data.batches || [])[0]?.farmLocation || 'SNR Farm';

    transactions.forEach(tx => {
      const prod = products.find(p => p.id === tx.productId);
      const wtPerUnit = prod?.weightPerUnit || 30;

      // Handle Stock In
      if (tx.type === 'STOCK_IN') {
        const target = resolveRealFarmName(tx.targetFarm) || resolveRealFarmName(tx.sourceFarm) || defaultFarmName;
        const key = `${tx.productId}___${target}`;
        if (!balanceMap[key]) balanceMap[key] = { bags: 0, kg: 0 };
        balanceMap[key].bags += tx.quantityBags || 0;
        balanceMap[key].kg += tx.quantityKg || (tx.quantityBags * wtPerUnit);
      }

      // Handle Stock Out
      if (tx.type === 'STOCK_OUT') {
        const source = resolveRealFarmName(tx.sourceFarm) || resolveRealFarmName(tx.targetFarm) || defaultFarmName;
        const key = `${tx.productId}___${source}`;
        if (!balanceMap[key]) balanceMap[key] = { bags: 0, kg: 0 };
        balanceMap[key].bags -= tx.quantityBags || 0;
        balanceMap[key].kg -= tx.quantityKg || (tx.quantityBags * wtPerUnit);
      }
    });

    const result: FeedBalanceItem[] = [];

    // Collect all real farm names
    const realFarmNames = Array.from(new Set([
      ...farms.map(f => f.name),
      ...(data.batches || []).map(b => b.farmLocation).filter(Boolean) as string[],
      ...transactions.map(t => resolveRealFarmName(t.sourceFarm)).filter(Boolean) as string[],
      ...transactions.map(t => resolveRealFarmName(t.targetFarm)).filter(Boolean) as string[]
    ])).filter(Boolean);

    if (realFarmNames.length === 0) realFarmNames.push(defaultFarmName);

    products.forEach(prod => {
      // If farm is filtered, compute for that farm; otherwise aggregate across real farm locations
      const targetFarms = effectiveFarm ? [effectiveFarm] : realFarmNames;

      targetFarms.forEach(farmName => {
        const key = `${prod.id}___${farmName}`;
        const b = balanceMap[key] || { bags: 0, kg: 0 };

        // Active batches assigned under this farm
        const activeBatchesForFarm = (data.batches || [])
          .filter(b => b.status === 'Active' && (!b.farmLocation || b.farmLocation === farmName));

        // Minimum threshold check (50 bags / 1,500 kg default)
        const thresholdBags = prod.minThresholdBags || 50;
        const thresholdKg = prod.minThresholdKg || (thresholdBags * (prod.weightPerUnit || 30));
        const isLow = b.bags <= thresholdBags || b.kg <= thresholdKg;

        const baseItem = {
          productId: prod.id,
          productName: prod.name,
          farmLocation: farmName,
          balanceBags: Math.max(0, b.bags),
          balanceKg: Math.max(0, b.kg),
          unitCost: prod.unitCost,
          totalValuation: Math.max(0, b.kg) * prod.unitCost,
          isLowStock: isLow,
          minThresholdBags: thresholdBags,
          minThresholdKg: thresholdKg
        };

        if (balanceViewMode === 'consolidated') {
          // CONSOLIDATED MODE: Single summary row per farm location, combining active batches
          if (!effectiveFarm || farmName === effectiveFarm || b.bags > 0 || activeBatchesForFarm.length > 0) {
            result.push({
              ...baseItem,
              id: `${prod.id}___${farmName}___consolidated`,
              activeBatchName: undefined,
              activeBatches: activeBatchesForFarm.map(b => b.name)
            });
          }
        } else {
          // SPECIFIC BATCH MODE: Separate rows for each active batch
          if (activeBatchesForFarm.length > 0) {
            activeBatchesForFarm.forEach(bItem => {
              result.push({
                ...baseItem,
                id: `${prod.id}___${farmName}___${bItem.id}`,
                activeBatchName: bItem.name,
                activeBatches: [bItem.name]
              });
            });
          } else {
            if (!effectiveFarm || farmName === effectiveFarm || b.bags > 0) {
              result.push({
                ...baseItem,
                id: `${prod.id}___${farmName}___nobatch`,
                activeBatchName: undefined,
                activeBatches: []
              });
            }
          }
        }
      });
    });

    return result;
  }, [products, transactions, effectiveFarm, farms, data.batches, balanceViewMode]);

  // Count stock balances per farm for FarmFilterBar
  const countByFarm = useMemo(() => {
    const map: Record<string, number> = {};
    balances.forEach(b => {
      if (b.farmLocation && b.balanceBags > 0) {
        map[b.farmLocation] = (map[b.farmLocation] || 0) + 1;
      }
    });
    return map;
  }, [balances]);

  // Filtered lists
  const filteredBalances = balances.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      b.productName.toLowerCase().includes(q) || 
      b.farmLocation.toLowerCase().includes(q) ||
      (b.activeBatchName && b.activeBatchName.toLowerCase().includes(q));
    const matchesCategory = !categoryFilter || products.find(p => p.id === b.productId)?.category === categoryFilter;

    let matchesBatch = true;
    if (batchFilter) {
      const bq = batchFilter.toLowerCase().trim();
      const batchName = b.activeBatchName ? b.activeBatchName.toLowerCase() : '';
      const batchesList = b.activeBatches ? b.activeBatches.map(x => x.toLowerCase()) : [];
      matchesBatch = batchName.includes(bq) || batchesList.some(x => x.includes(bq));
    }

    return matchesSearch && matchesCategory && matchesBatch;
  });

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredTransactions = transactions.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      t.productName.toLowerCase().includes(q) || 
      (t.sourceFarm && t.sourceFarm.toLowerCase().includes(q)) || 
      (t.targetFarm && t.targetFarm.toLowerCase().includes(q)) ||
      (t.referenceNo && t.referenceNo.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q));

    const matchesFarm = !effectiveFarm || t.sourceFarm === effectiveFarm || t.targetFarm === effectiveFarm;
    const matchesTxType = txTypeFilter === 'ALL' || t.type === txTypeFilter;
    const matchesCategory = !categoryFilter || products.find(p => p.id === t.productId)?.category === categoryFilter;

    let matchesBatch = true;
    if (batchFilter) {
      const bq = batchFilter.toLowerCase().trim();
      const tNotes = t.notes ? t.notes.toLowerCase() : '';
      matchesBatch = tNotes.includes(bq);
    }

    let matchesDate = true;
    if (t.date) {
      const txDate = t.date.split('T')[0];
      if (startDate && txDate < startDate) matchesDate = false;
      if (endDate && txDate > endDate) matchesDate = false;
    }

    return matchesSearch && matchesFarm && matchesTxType && matchesBatch && matchesCategory && matchesDate;
  });

  // Paginated Slices
  const paginatedBalances = useMemo(() => {
    const start = (balancePage - 1) * balancePageSize;
    return filteredBalances.slice(start, start + balancePageSize);
  }, [filteredBalances, balancePage, balancePageSize]);

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * productPageSize;
    return filteredProducts.slice(start, start + productPageSize);
  }, [filteredProducts, productPage, productPageSize]);

  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPageSize;
    return filteredTransactions.slice(start, start + txPageSize);
  }, [filteredTransactions, txPage, txPageSize]);

  // Low stock alerts list
  const lowStockAlerts = balances.filter(b => b.isLowStock && b.balanceBags <= b.minThresholdBags);

  // Summary Metrics
  const totalOnsiteBags = balances.reduce((sum, b) => sum + b.balanceBags, 0);
  const totalOnsiteKg = balances.reduce((sum, b) => sum + b.balanceKg, 0);
  const totalValuation = balances.reduce((sum, b) => sum + b.totalValuation, 0);

  const openTxModal = (type: 'STOCK_IN' | 'STOCK_OUT') => {
    setTxType(type);
    setIsTransactionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* STEP 1: SELECT FARM FIRST */}
      <FarmFilterBar
        farms={farms}
        selectedFarm={selectedFarm}
        onFarmChange={setSelectedFarm}
        countByFarm={countByFarm}
        totalCount={balances.length}
        label="feed items"
        currentUser={currentUser}
      />

      {/* Header & Main Controls */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-emerald-600 animate-pulse" />
              DSR-16 Concentrate Feed Stock Management
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              DSR-16 feed procurement (Stock In), daily feed consumption (Stock Out), and low-stock warning alerts (50 bags / 1,500 kg threshold).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasPermission(currentUser, 'feed_manage') && (
              <Button
                onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold py-2 px-3.5 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> + Add Product
              </Button>
            )}

            {hasPermission(currentUser, 'feed_manage') && (
              <Button
                onClick={() => openTxModal('STOCK_IN')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold py-2 px-3.5 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowDownLeft className="h-4 w-4" /> 📥 Stock In (Procurement)
              </Button>
            )}
          </div>
        </div>

        {/* Automated Daily Stock Out Banner */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                ⚡ Automated Daily Feed Stock Out Active ({batchRationUsage.activeHeadcount} Active Cattle)
              </h4>
              <p className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                Stock out is calculated automatically each day based on active Daily Feed Ration specs: <strong className="text-emerald-950 font-black">{format2DecimalsWithCommas(batchRationUsage.totalDailyRationKg)} kg/day</strong> ({format2DecimalsWithCommas(batchRationUsage.totalDailyRationBags)} bags/day) across {batchRationUsage.activeBatchesCount} active fattening programs. Manual stock out is disabled.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-emerald-200 shadow-2xs">
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-slate-400">Stock Coverage</p>
              <p className="text-xs font-black text-emerald-800">
                {batchRationUsage.totalDailyRationKg > 0 
                  ? `~${Math.floor(totalOnsiteKg / batchRationUsage.totalDailyRationKg)} Days Remaining` 
                  : 'Sufficient Feed'}
              </p>
            </div>
          </div>
        </div>

        {/* Low Stock Warning Banner */}
        {lowStockAlerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-left shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 animate-bounce">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                  ⚠️ Low Stock Warning Triggered ({lowStockAlerts.length} Items Below Threshold)
                </h4>
                <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                  Stock levels for {lowStockAlerts.map(a => `${a.productName} (${a.balanceBags} bags)`).join(', ')} have dropped below 50 bags (1,500 kg threshold).
                </p>
              </div>
            </div>
            {hasPermission(currentUser, 'feed_manage') && (
              <Button
                onClick={() => openTxModal('STOCK_IN')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5 px-3.5 rounded-xl flex-shrink-0 cursor-pointer"
              >
                + Replenish Stock
              </Button>
            )}
          </div>
        )}

        {/* KPI Dashboard Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-left pt-2">
          <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl shadow-2xs">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Stock On-Hand (Bags)</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalOnsiteBags.toLocaleString()}{' '}
              <span className="text-xs font-bold text-slate-500">bags</span>
            </p>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl shadow-2xs">
            <p className="text-[9px] font-black uppercase text-blue-700 tracking-wider">Total Feed Biomass (kg)</p>
            <p className="text-2xl font-black text-blue-900 mt-1">
              {format2DecimalsWithCommas(totalOnsiteKg)}{' '}
              <span className="text-xs font-bold text-blue-600">kg</span>
            </p>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl shadow-2xs">
            <p className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Feed Stock Valuation</p>
            <p className="text-2xl font-black text-emerald-900 mt-1">
              ៛ {format2DecimalsWithCommas(totalValuation)}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border shadow-2xs ${
            lowStockAlerts.length > 0 ? 'bg-rose-50/70 border-rose-200 text-rose-900' : 'bg-slate-50/80 border-slate-200/60'
          }`}>
            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">Low Stock Alerts</p>
            <p className="text-2xl font-black mt-1">
              {lowStockAlerts.length}{' '}
              <span className="text-xs font-bold">Products</span>
            </p>
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs & Responsive Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex overflow-x-auto bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-full lg:w-auto scrollbar-none">
          <button
            onClick={() => setSubView('balances')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'balances' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚖️ Stock Balance ({filteredBalances.length})
          </button>
          <button
            onClick={() => setSubView('products')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'products' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📦 Product Master ({products.length})
          </button>
          <button
            onClick={() => setSubView('transactions')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              subView === 'transactions' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 Movement Ledger ({filteredTransactions.length})
          </button>
        </div>

        {/* Responsive Search & Category & Type & Batch Filter Bar */}
        <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50/80 p-2 rounded-2xl border border-slate-200/70 shadow-2xs">
          {/* Search Input */}
          <div className="relative w-full sm:w-52 shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search product / ref..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs font-semibold rounded-xl bg-white border border-slate-200"
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
            {/* Feed Category / Type filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-9 w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">🌾 All Categories</option>
              {(data.settings?.feedTypes || ['Concentrate', 'Silage', 'Roughage', 'Supplement', 'Medicine']).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Movement Type Filter (for Movement Ledger) */}
            {subView === 'transactions' && (
              <select
                value={txTypeFilter}
                onChange={e => setTxTypeFilter(e.target.value as 'ALL' | 'STOCK_IN' | 'STOCK_OUT')}
                className="h-9 w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">🔄 All Types</option>
                <option value="STOCK_IN">📥 Stock In</option>
                <option value="STOCK_OUT">📤 Stock Out</option>
              </select>
            )}

            {/* Batch Filter (for Movement Ledger & Balances) */}
            {(subView === 'transactions' || subView === 'balances') && (
              <select
                value={batchFilter}
                onChange={e => setBatchFilter(e.target.value)}
                className="h-9 w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="">🎯 All Batches</option>
                {(data.batches || []).map(b => (
                  <option key={b.id} value={b.name}>{b.id} - {b.name}</option>
                ))}
              </select>
            )}

            {/* Action Buttons: Reset & Settings */}
            <div className="flex items-center gap-1.5 justify-end col-span-2 sm:col-span-1">
              {(searchQuery || categoryFilter || txTypeFilter !== 'ALL' || batchFilter || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('');
                    setTxTypeFilter('ALL');
                    setBatchFilter('');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                  title="Reset All Filters"
                >
                  ✕ Reset
                </button>
              )}

              {hasPermission(currentUser, 'feed_manage') && (
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                  title="Manage Feed Categories"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SubView 1: Real-time Stock Balance Table */}
      {subView === 'balances' && (
        <div className="space-y-3">
          {/* Display Mode Toggle Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/70 p-2.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider pl-1">
                Stock Allocation Display Mode:
              </span>
            </div>
            <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
              <button
                type="button"
                onClick={() => setBalanceViewMode('consolidated')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  balanceViewMode === 'consolidated'
                    ? 'bg-white text-emerald-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                🏢 Consolidate by Farm
              </button>
              <button
                type="button"
                onClick={() => setBalanceViewMode('specific_batch')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  balanceViewMode === 'specific_batch'
                    ? 'bg-white text-emerald-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                🎯 Specific Batch Breakdown
              </button>
            </div>
            <Button
              type="button"
              onClick={() => {
                exportToExcel({
                  filename: `CC_Livestock_Feed_Stock_Balances_${new Date().toISOString().split('T')[0]}.xlsx`,
                  sheetName: 'Feed Stock Balances',
                  data: filteredBalances,
                  columns: [
                    { header: 'Product ID', key: 'productId' },
                    { header: 'Feed Product Name', key: 'productName' },
                    { header: 'Warehouse / Farm Location', key: 'farmLocation' },
                    { header: 'Active Batches under Farm', key: 'activeBatches', formatter: (val, row) => row.activeBatchName || (val ? val.join(', ') : 'N/A') },
                    { header: 'Stock On-Hand (Bags)', key: 'balanceBags' },
                    { header: 'Total Biomass (kg)', key: 'balanceKg', formatter: (val) => format2DecimalsWithCommas(val) },
                    { header: 'Unit Cost (៛/kg)', key: 'unitCost', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` },
                    { header: 'Total Valuation (៛)', key: 'totalValuation', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` },
                    { header: 'Stock Status', key: 'isLowStock', formatter: (val) => val ? 'Low Stock Warning' : 'In Stock' }
                  ]
                });
              }}
              className="h-8 text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-2xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Button>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[9.5px] uppercase tracking-wider">
                    <th className="py-3.5 px-5">Feed Product</th>
                    <th className="py-3.5 px-5">Warehouse / Farm</th>
                    <th className="py-3.5 px-5">{balanceViewMode === 'specific_batch' ? 'Active Batch' : 'Active Batches under Farm'}</th>
                    <th className="py-3.5 px-5">Stock On-Hand (Bags)</th>
                    <th className="py-3.5 px-5">Total Biomass (kg)</th>
                    <th className="py-3.5 px-5">Unit Cost</th>
                    <th className="py-3.5 px-5">Total Valuation</th>
                    <th className="py-3.5 px-5">Stock Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedBalances.length > 0 ? (
                    paginatedBalances.map((item, idx) => (
                      <tr key={item.id || `${item.productId}-${item.farmLocation}-${idx}`} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-5 font-black text-slate-900">{item.productName}</td>
                        <td className="py-3.5 px-5 font-bold text-slate-800">
                          <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-xs font-extrabold text-slate-700">
                            🏢 {item.farmLocation}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-bold">
                          {balanceViewMode === 'specific_batch' ? (
                            item.activeBatchName ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-2xs">
                                📦 {item.activeBatchName}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">—</span>
                            )
                          ) : (
                            item.activeBatches && item.activeBatches.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.activeBatches.map((bName, bIdx) => (
                                  <span key={bIdx} className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                                    📦 {bName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">—</span>
                            )
                          )}
                        </td>
                      <td className="py-3.5 px-5 font-mono font-black text-slate-900 text-sm">
                        {item.balanceBags.toLocaleString()} <span className="text-xs text-slate-400 font-bold">bags</span>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                        {format2DecimalsWithCommas(item.balanceKg)} <span className="text-xs text-slate-400 font-bold">kg</span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-600">
                        ៛ {format2DecimalsWithCommas(item.unitCost)} / kg
                      </td>
                      <td className="py-3.5 px-5 font-mono font-black text-emerald-700">
                        ៛ {format2DecimalsWithCommas(item.totalValuation)}
                      </td>
                      <td className="py-3.5 px-5">
                        {item.isLowStock ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase flex items-center gap-1 w-max animate-pulse">
                            ⚠️ Low Stock ($\le$ 50 bags)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase flex items-center gap-1 w-max">
                            ● In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-1">
                        {hasPermission(currentUser, 'feed_manage') ? (
                          <Button
                            onClick={() => openTxModal('STOCK_IN')}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold py-1 px-2.5 border border-emerald-200/60 cursor-pointer"
                          >
                            + Add Stock
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Read Only</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                      No feed stock balances found. Click &quot;+ Add Product&quot; or &quot;Stock In&quot; to populate feed inventory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={balancePage}
            totalItems={filteredBalances.length}
            pageSize={balancePageSize}
            onPageChange={setBalancePage}
            onPageSizeChange={setBalancePageSize}
            itemLabel="items"
          />
        </div>
        </div>
      )}

      {/* SubView 2: Product Master Catalog Table */}
      {subView === 'products' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-slate-50 border border-slate-200/70 p-2.5 rounded-2xl">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 pl-1">
              📦 Feed Product Master Catalog
            </span>
            <Button
              type="button"
              onClick={() => {
                exportToExcel({
                  filename: `CC_Livestock_Feed_Master_Catalog_${new Date().toISOString().split('T')[0]}.xlsx`,
                  sheetName: 'Feed Master Catalog',
                  data: filteredProducts,
                  columns: [
                    { header: 'Product Code/ID', key: 'id' },
                    { header: 'Product Name', key: 'name' },
                    { header: 'Category', key: 'category' },
                    { header: 'Unit', key: 'unit' },
                    { header: 'Weight Per Unit (kg)', key: 'weightPerUnit' },
                    { header: 'Cost Per Bag (៛)', key: 'costPerBag', formatter: (val, row) => `៛ ${format2DecimalsWithCommas(val || row.unitCost * row.weightPerUnit)}` },
                    { header: 'Unit Cost (៛/kg)', key: 'unitCost', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` },
                    { header: 'Min Warning Threshold (Bags)', key: 'minThresholdBags' },
                    { header: 'Supplier', key: 'supplier' }
                  ]
                });
              }}
              className="h-8 text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-2xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Button>
          </div>
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[9.5px] uppercase tracking-wider">
                  <th className="py-3.5 px-5">Code</th>
                  <th className="py-3.5 px-5">Product Name</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5">Unit / Weight</th>
                  <th className="py-3.5 px-5">Unit Cost</th>
                  <th className="py-3.5 px-5">Low Warning Threshold</th>
                  <th className="py-3.5 px-5">Supplier</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map(prod => (
                    <tr key={prod.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">{prod.id}</td>
                      <td className="py-3.5 px-5 font-black text-slate-900">{prod.name}</td>
                      <td className="py-3.5 px-5 font-bold text-slate-600">{prod.category}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-700">
                        {prod.unit} ({prod.weightPerUnit} kg/unit)
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-900">
                        <span className="font-black text-emerald-800">៛ {format2DecimalsWithCommas(prod.costPerBag || (prod.unitCost * prod.weightPerUnit))}</span> / bag
                        <div className="text-[10px] font-bold text-slate-400">
                          (៛ {format2DecimalsWithCommas(prod.unitCost)} / kg)
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-amber-700">
                        {prod.minThresholdBags || 50} bags ({format2DecimalsWithCommas(prod.minThresholdKg || 1500)} kg)
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">{prod.supplier || 'N/A'}</td>
                      <td className="py-3.5 px-5 text-right space-x-1">
                        {hasPermission(currentUser, 'feed_manage') && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setEditingProduct(prod); setIsProductModalOpen(true); }}
                              className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded-lg text-[10px] font-bold cursor-pointer border border-slate-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'Delete Feed Product?',
                                  description: `Are you sure you want to remove ${prod.name} from product master?`,
                                  type: 'danger',
                                  onConfirm: () => onDeleteProduct(prod.id)
                                });
                              }}
                              className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold cursor-pointer border border-rose-200"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                      No products registered. Click &quot;+ Add Product&quot; to define feed master items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={productPage}
            totalItems={filteredProducts.length}
            pageSize={productPageSize}
            onPageChange={setProductPage}
            onPageSizeChange={setProductPageSize}
            itemLabel="products"
          />
        </div>
        </div>
      )}

      {/* SubView 3: Transaction Movement Ledger & Reports */}
      {subView === 'transactions' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/70 p-2.5 rounded-2xl">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 pl-1">
              🚚 Feed Stock Movement Ledger
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangeFilterBar
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onResetDates={() => { setStartDate(''); setEndDate(''); }}
              />
              <Button
                type="button"
                onClick={() => {
                  exportToExcel({
                    filename: `CC_Livestock_Feed_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`,
                    sheetName: 'Stock Movement Ledger',
                    data: filteredTransactions,
                    columns: [
                      { header: 'Ref # / Tx ID', key: 'referenceNo', formatter: (val, row) => val || row.id },
                      { header: 'Date', key: 'date', formatter: (val) => val ? val.split('T')[0] : 'N/A' },
                      { header: 'Type', key: 'type' },
                      { header: 'Product Name', key: 'productName' },
                      { header: 'Quantity (Bags)', key: 'quantityBags' },
                      { header: 'Quantity (kg)', key: 'quantityKg', formatter: (val) => format2DecimalsWithCommas(val) },
                      { header: 'Source / Target Farm', key: 'targetFarm', formatter: (val, row) => val || row.sourceFarm || 'Farm Warehouse' },
                      { header: 'Total Cost (៛)', key: 'totalCost', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` }
                    ]
                  });
                }}
                className="h-8 text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[9.5px] uppercase tracking-wider">
                  <th className="py-3.5 px-5">Ref #</th>
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5">Type</th>
                  <th className="py-3.5 px-5">Product Name</th>
                  <th className="py-3.5 px-5">Quantity (Bags / kg)</th>
                  <th className="py-3.5 px-5">Source ➔ Target Farm</th>
                  <th className="py-3.5 px-5 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">{tx.referenceNo || tx.id}</td>
                      <td className="py-3.5 px-5 text-slate-500">{tx.date ? tx.date.split('T')[0] : 'N/A'}</td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          tx.type === 'STOCK_IN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">{tx.productName}</td>
                      <td className="py-3.5 px-5 font-mono">
                        <span className="font-black text-slate-900">{tx.quantityBags} bags</span>{' '}
                        <span className="text-slate-400 text-xs">({format2DecimalsWithCommas(tx.quantityKg)} kg)</span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-medium">
                        <span className="font-bold text-slate-900">{tx.targetFarm || 'Farm Warehouse'}</span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-black text-slate-900">
                        ៛ {format2DecimalsWithCommas(tx.totalCost)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      No stock transactions logged yet. Use &quot;Stock In&quot; or &quot;Stock Out&quot; buttons to create entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={txPage}
            totalItems={filteredTransactions.length}
            pageSize={txPageSize}
            onPageChange={setTxPage}
            onPageSizeChange={setTxPageSize}
            itemLabel="transactions"
          />
        </div>
        </div>
      )}

      {/* Product Master Modal */}
      <FeedProductModal
        isOpen={isProductModalOpen}
        onClose={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
        onSubmit={onSaveProduct}
        initialProduct={editingProduct}
        categories={data.settings?.feedTypes}
        onManageCategories={() => setIsCategoryModalOpen(true)}
      />

      {/* Feed Category Manager Modal */}
      <FeedCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        settings={data.settings}
      />

      {/* Transaction Modal */}
      <FeedTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSubmit={onAddTransaction}
        products={products}
        farms={farms}
        defaultType={txType}
        currentUser={currentUser}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
