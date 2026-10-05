'use client';

import React, { useState, useMemo } from 'react';
import { ERPLivestockData, FarmItem, UserRoleItem, BatchItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, Scale, ShoppingBag, PieChart as PieChartIcon, Heart, ShieldAlert, Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import FarmFilterBar from './FarmFilterBar';

interface AnalyticsTabProps {
  data: ERPLivestockData;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6'];

export default function AnalyticsTab({ data, currentUser, farms = [] }: AnalyticsTabProps) {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<'overview' | 'demographics' | 'batches' | 'health' | 'financial' | 'prediction'>('overview');
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  // Revenue & Profit Prediction Engine States
  const [predictionBatchId, setPredictionBatchId] = useState<string>('all');
  const [targetHarvestDate, setTargetHarvestDate] = useState<string>(() => {
    const future = new Date();
    future.setDate(future.getDate() + 60);
    return future.toISOString().split('T')[0];
  });
  const [expectedSellingPricePerKg, setExpectedSellingPricePerKg] = useState<string>('18000');
  const [customAdgOverride, setCustomAdgOverride] = useState<string>('');

  // Farm-scoped data — all memos below use this instead of raw `data`
  const farmScopedData = useMemo(() => {
    if (!selectedFarm) return data;
    const scopedStock = data.stock.filter(s => s.location === selectedFarm);
    const scopedIds = scopedStock.map(s => s.id);
    return {
      ...data,
      stock: scopedStock,
      batches: data.batches.filter(b => b.farmLocation === selectedFarm || b.cowIds.some(id => scopedIds.includes(id))),
      weightTracking: data.weightTracking.filter(w => scopedIds.includes(w.cowId)),
      healthLogs: data.healthLogs.filter(h => scopedIds.includes(h.cowId)),
      salesTracking: data.salesTracking.filter(s => scopedIds.includes(s.cowId))
    };
  }, [data, selectedFarm]);

  // Compute default expected selling price based on selected batch or highest price among all batches
  const defaultSellingPrice = useMemo(() => {
    const batches = farmScopedData.batches || [];
    const validPrices = batches
      .map(b => Number(b.expectedSellingPrice))
      .filter(p => !isNaN(p) && p > 0);

    const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : 18000;

    if (predictionBatchId !== 'all') {
      const selected = batches.find(b => b.id === predictionBatchId);
      if (selected && selected.expectedSellingPrice && Number(selected.expectedSellingPrice) > 0) {
        return Number(selected.expectedSellingPrice);
      }
    }

    return highestPrice;
  }, [farmScopedData.batches, predictionBatchId]);

  // Sync expectedSellingPricePerKg whenever defaultSellingPrice changes (user can still freely override it)
  React.useEffect(() => {
    setExpectedSellingPricePerKg(String(defaultSellingPrice));
  }, [defaultSellingPrice]);

  // Compute default target harvest date: the selected batch's own Selling
  // Target Date (set at batch creation) when it has one, else the existing
  // "60 days from today" fallback — same precedence pattern as
  // defaultSellingPrice above.
  const defaultTargetHarvestDate = useMemo(() => {
    const fallback = () => {
      const future = new Date();
      future.setDate(future.getDate() + 60);
      return future.toISOString().split('T')[0];
    };
    if (predictionBatchId !== 'all') {
      const selected = (farmScopedData.batches || []).find(b => b.id === predictionBatchId);
      if (selected?.sellingTargetDate) return selected.sellingTargetDate;
    }
    return fallback();
  }, [farmScopedData.batches, predictionBatchId]);

  // Sync targetHarvestDate whenever defaultTargetHarvestDate changes (user can still freely override it)
  React.useEffect(() => {
    setTargetHarvestDate(defaultTargetHarvestDate);
  }, [defaultTargetHarvestDate]);

  // Count cattle per farm for the filter bar
  const countByFarm = useMemo(() => {
    const map: Record<string, number> = {};
    data.stock.forEach(s => { if (s.location) map[s.location] = (map[s.location] || 0) + 1; });
    return map;
  }, [data.stock]);

  // Active cattle list
  const activeCows = useMemo(() => {
    return farmScopedData.stock.filter(c => c.status.toLowerCase() === 'active');
  }, [farmScopedData.stock]);

  // Predictive Calculations Memo
  const predictionData = useMemo(() => {
    let cohortCows = activeCows;
    let selectedBatch: BatchItem | undefined;

    if (predictionBatchId !== 'all') {
      const found = data.batches.find(b => b.id === predictionBatchId);
      selectedBatch = found;
      if (found) {
        cohortCows = activeCows.filter(c => found.cowIds?.includes(c.id));
      }
    }

    const headcount = cohortCows.length;
    const currentTotalWeight = cohortCows.reduce((sum, c) => sum + c.weight, 0);
    const currentAvgWeight = headcount > 0 ? currentTotalWeight / headcount : 0;
    const initialAssetCost = cohortCows.reduce((sum, c) => sum + (c.totalPrice || (c.weight * c.unitPrice) || 0), 0);

    // ADG Calculation
    let calculatedAdg = 1.10;
    if (customAdgOverride && !isNaN(parseFloat(customAdgOverride))) {
      calculatedAdg = parseFloat(customAdgOverride);
    } else if (selectedBatch) {
      const batchStart = new Date(selectedBatch.startDate);
      const today = new Date();
      const daysElapsed = Math.max(1, Math.ceil((today.getTime() - batchStart.getTime()) / (1000 * 60 * 60 * 24)));

      let totalGains = 0;
      let cowsRecorded = 0;
      cohortCows.forEach(cow => {
        const cowRecords = data.weightTracking.filter(w => w.cowId === cow.id);
        if (cowRecords.length > 0) {
          const sorted = [...cowRecords].sort((a, b) => new Date(a.trackingDate || '').getTime() - new Date(b.trackingDate || '').getTime());
          const initW = sorted[0].oldWeight || sorted[0].currentWeight;
          const gain = cow.weight - initW;
          totalGains += gain;
          cowsRecorded++;
        }
      });

      if (cowsRecorded > 0 && daysElapsed > 0) {
        calculatedAdg = Math.max(0.5, (totalGains / cowsRecorded) / daysElapsed);
      }
    }

    // Daily Feed Ration Cost per Head (៛ / head / day)
    let dailyFeedCostPerHead = 14000;
    if (selectedBatch && selectedBatch.feedingProgram?.ingredients) {
      dailyFeedCostPerHead = selectedBatch.feedingProgram.ingredients.reduce((sum, ing) => {
        return sum + ((ing.portionPerHead || 0) * (ing.unitCost || 0));
      }, 0);
    }

    // Days Remaining to Target Harvest Date
    const today = new Date();
    const targetDateObj = new Date(targetHarvestDate);
    const diffMs = targetDateObj.getTime() - today.getTime();
    const daysToHarvest = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // Predictive Output Metrics
    const pricePerKg = parseFloat(expectedSellingPricePerKg) || 18000;
    const predictedGainPerHead = daysToHarvest * calculatedAdg;
    const predictedFinalAvgWeight = currentAvgWeight + predictedGainPerHead;
    const predictedTotalBiomassKg = currentTotalWeight + (headcount * predictedGainPerHead);
    const predictedGrossRevenue = predictedTotalBiomassKg * pricePerKg;

    const projectedFeedExpenses = headcount * daysToHarvest * dailyFeedCostPerHead;
    const totalProjectedCost = initialAssetCost + projectedFeedExpenses;
    const projectedNetProfit = predictedGrossRevenue - totalProjectedCost;
    const projectedRoi = totalProjectedCost > 0 ? (projectedNetProfit / totalProjectedCost) * 100 : 0;

    // Projection Trajectory Points
    const trajectoryPoints = [];
    const stepInterval = Math.max(1, Math.floor(daysToHarvest / 5));

    for (let i = 0; i <= 5; i++) {
      const stepDays = Math.min(daysToHarvest, i * stepInterval);
      const stepDate = new Date(today);
      stepDate.setDate(stepDate.getDate() + stepDays);
      const stepAvgWt = currentAvgWeight + (stepDays * calculatedAdg);
      const stepTotalKg = headcount * stepAvgWt;
      const stepRev = stepTotalKg * pricePerKg;
      const stepFeedCost = headcount * stepDays * dailyFeedCostPerHead;
      const stepProfit = stepRev - (initialAssetCost + stepFeedCost);

      trajectoryPoints.push({
        dayLabel: i === 0 ? 'Today' : `+${stepDays}d`,
        dateStr: stepDate.toISOString().split('T')[0],
        'Avg Weight (kg)': Math.round(stepAvgWt),
        'Total Biomass (kg)': Math.round(stepTotalKg),
        'Projected Revenue (៛)': Math.round(stepRev),
        'Projected Net Profit (៛)': Math.round(stepProfit)
      });
    }

    // Cattle Predictive Ledger
    const cowLedger = cohortCows.map(cow => {
      const predFinalWeight = cow.weight + predictedGainPerHead;
      const predValue = predFinalWeight * pricePerKg;
      return {
        cowId: cow.id,
        breed: cow.breed,
        currentWeight: cow.weight,
        predictedGain: predictedGainPerHead,
        predictedFinalWeight: predFinalWeight,
        predictedValue: predValue
      };
    });

    return {
      headcount,
      currentAvgWeight,
      currentTotalWeight,
      calculatedAdg,
      dailyFeedCostPerHead,
      daysToHarvest,
      pricePerKg,
      predictedGainPerHead,
      predictedFinalAvgWeight,
      predictedTotalBiomassKg,
      predictedGrossRevenue,
      projectedFeedExpenses,
      initialAssetCost,
      totalProjectedCost,
      projectedNetProfit,
      projectedRoi,
      trajectoryPoints,
      cowLedger
    };
  }, [activeCows, data.batches, data.weightTracking, predictionBatchId, targetHarvestDate, expectedSellingPricePerKg, customAdgOverride]);

  // Executive BI KPI Summary Metrics
  const biKpis = useMemo(() => {
    const totalActiveHead = activeCows.length;
    const totalAssetValuation = activeCows.reduce((sum, c) => sum + (c.totalPrice || (c.weight * c.unitPrice) || 0), 0);
    const totalSalesRevenue = farmScopedData.salesTracking.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
    const totalAcquisitionCost = farmScopedData.stock.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
    const netProfit = totalSalesRevenue - totalAcquisitionCost;

    const deadCount = farmScopedData.stock.filter(c => c.healthStatus.toLowerCase() === 'dead' || c.status.toLowerCase() === 'dead').length;
    const mortalityRate = farmScopedData.stock.length > 0 ? ((deadCount / farmScopedData.stock.length) * 100).toFixed(1) : '0';

    return {
      totalActiveHead,
      totalAssetValuation,
      totalSalesRevenue,
      totalAcquisitionCost,
      netProfit,
      deadCount,
      mortalityRate
    };
  }, [activeCows, farmScopedData.stock, farmScopedData.salesTracking]);

  // Breed Weight & Valuation Performance
  const breedPerformance = useMemo(() => {
    const map: Record<string, { totalWeight: number; count: number; maxWeight: number; totalValuation: number }> = {};
    activeCows.forEach(cow => {
      if (!map[cow.breed]) {
        map[cow.breed] = { totalWeight: 0, count: 0, maxWeight: 0, totalValuation: 0 };
      }
      map[cow.breed].totalWeight += cow.weight;
      map[cow.breed].count += 1;
      map[cow.breed].totalValuation += (cow.totalPrice || (cow.weight * cow.unitPrice) || 0);
      if (cow.weight > map[cow.breed].maxWeight) {
        map[cow.breed].maxWeight = cow.weight;
      }
    });

    return Object.entries(map).map(([breed, stats]) => ({
      name: breed,
      'Avg Weight (kg)': Math.round(stats.totalWeight / stats.count),
      'Max Weight (kg)': stats.maxWeight,
      count: stats.count,
      totalValuation: stats.totalValuation
    }));
  }, [activeCows]);

  // Demographic Pie Chart Data
  const breedComposition = useMemo(() => {
    const map: Record<string, number> = {};
    activeCows.forEach(cow => {
      map[cow.breed] = (map[cow.breed] || 0) + 1;
    });
    return Object.entries(map).map(([breed, count]) => ({
      name: breed,
      value: count,
      percentage: activeCows.length > 0 ? Math.round((count / activeCows.length) * 100) : 0
    }));
  }, [activeCows]);

  const genderComposition = useMemo(() => {
    const map: Record<string, number> = {};
    activeCows.forEach(cow => {
      const sex = cow.sex || 'Unknown';
      map[sex] = (map[sex] || 0) + 1;
    });
    return Object.entries(map).map(([sex, count]) => ({
      name: sex,
      value: count,
      percentage: activeCows.length > 0 ? Math.round((count / activeCows.length) * 100) : 0
    }));
  }, [activeCows]);

  const acquisitionComposition = useMemo(() => {
    const map: Record<string, number> = {};
    activeCows.forEach(cow => {
      const type = cow.purchaseType || cow.buyType || 'Purchase';
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).map(([type, count]) => ({
      name: type,
      value: count,
      percentage: activeCows.length > 0 ? Math.round((count / activeCows.length) * 100) : 0
    }));
  }, [activeCows]);

  // Health Status Composition
  const healthComposition = useMemo(() => {
    const map: Record<string, number> = {};
    activeCows.forEach(cow => {
      map[cow.healthStatus] = (map[cow.healthStatus] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({
      name: status,
      value: count,
      percentage: activeCows.length > 0 ? Math.round((count / activeCows.length) * 100) : 0
    }));
  }, [activeCows]);

  // Fattening Herd & ADG Growth Calculation
  const batchAnalytics = useMemo(() => {
    return data.batches.map(batch => {
      const cowsInBatch = data.stock.filter(c => batch.cowIds.includes(c.id));
      const activeCowsInBatch = cowsInBatch.filter(c => c.status.toLowerCase() === 'active');
      const avgWeight = activeCowsInBatch.length > 0
        ? Math.round(activeCowsInBatch.reduce((sum, c) => sum + c.weight, 0) / activeCowsInBatch.length)
        : 0;

      // ADG calculation across weight records
      let totalAdgSum = 0;
      let adgCount = 0;

      activeCowsInBatch.forEach(cow => {
        const records = data.weightTracking
          .filter(w => w.cowId === cow.id && w.trackingDate)
          .sort((a, b) => new Date(a.trackingDate!).getTime() - new Date(b.trackingDate!).getTime());
        if (records.length >= 2) {
          const earliest = records[0];
          const latest = records[records.length - 1];
          const daysDiff = Math.max(1, Math.round((new Date(latest.trackingDate!).getTime() - new Date(earliest.trackingDate!).getTime()) / (1000 * 60 * 60 * 24)));
          const weightDiff = latest.currentWeight - earliest.currentWeight;
          if (daysDiff > 0 && weightDiff > 0) {
            totalAdgSum += weightDiff / daysDiff;
            adgCount++;
          }
        }
      });

      const avgAdgKg = adgCount > 0 ? parseFloat((totalAdgSum / adgCount).toFixed(2)) : 0.85; // default benchmark if single weight

      // Daily ration cost per head from feeding program
      let dailyFeedCostPerHead = 0;
      if (batch.feedingProgram && batch.feedingProgram.ingredients) {
        dailyFeedCostPerHead = batch.feedingProgram.ingredients.reduce((sum, ing) => sum + (ing.portionPerHead * ing.unitCost), 0);
      } else {
        dailyFeedCostPerHead = (3.5 * 2000) + (15 * 350) + (2 * 150); // standard default formula ~ 12,550 KHR
      }

      return {
        name: batch.name,
        code: batch.id,
        type: batch.type,
        count: cowsInBatch.length,
        'Avg Weight (kg)': avgWeight,
        'ADG (kg/day)': avgAdgKg,
        dailyFeedCostPerHead,
        status: batch.status
      };
    });
  }, [data.batches, data.stock, data.weightTracking]);

  // Monthly Financial P&L
  const financialMonthly = useMemo(() => {
    const monthlyMap: Record<string, { revenue: number }> = {};

    data.salesTracking.forEach(sale => {
      const month = sale.salesDate ? sale.salesDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0 };
      monthlyMap[month].revenue += sale.totalPrice;
    });

    return Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, values]) => {
        const [year, m] = month.split('-');
        const dateObj = new Date(parseInt(year), parseInt(m) - 1);
        const name = dateObj.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        return {
          monthStr: month,
          name,
          'Total Revenue (៛)': values.revenue
        };
      });
  }, [data.salesTracking]);

  return (
    <div className="space-y-6 text-left">
      {/* Navigation sub-tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setSubTab('overview')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'overview'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <PieChartIcon className="h-4 w-4" />
          {t('analytics.overview')}
        </button>
        <button
          onClick={() => setSubTab('demographics')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'demographics'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          {t('analytics.demographics')}
        </button>
        <button
          onClick={() => setSubTab('batches')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'batches'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Scale className="h-4 w-4" />
          {t('analytics.batchPerformance')}
        </button>
        <button
          onClick={() => setSubTab('health')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'health'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Heart className="h-4 w-4" />
          {t('analytics.healthAnalytics')}
        </button>
        <button
          onClick={() => setSubTab('financial')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'financial'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          {t('analytics.financialPerformance')}
        </button>
        <button
          onClick={() => setSubTab('prediction')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'prediction'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          🎯 Revenue Prediction
        </button>
      </div>

      {/* Farm Filter Bar */}
      <FarmFilterBar
        farms={farms}
        selectedFarm={selectedFarm}
        onFarmChange={setSelectedFarm}
        countByFarm={countByFarm}
        totalCount={data.stock.length}
        label="cattle"
        currentUser={currentUser}
      />

      {/* 1. Executive BI Overview */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Active Herd</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black text-slate-800">{biKpis.totalActiveHead} <span className="text-xs font-bold text-emerald-600">Head</span></p>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Herd Asset Valuation</p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-emerald-600">៛ {biKpis.totalAssetValuation.toLocaleString()}</p>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Award className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Net Profit / Loss</p>
              <div className="flex items-center justify-between">
                <p className={`text-xl font-black ${biKpis.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ៛ {biKpis.netProfit.toLocaleString()}
                </p>
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mortality Rate (%)</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black text-slate-800">{biKpis.mortalityRate}% <span className="text-xs text-slate-400 font-normal">({biKpis.deadCount} Dead)</span></p>
                <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Monthly P&L Financial Area Chart */}
          <Card className="bg-white border border-slate-100 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Monthly Sales Revenue
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">Track gross sales revenue month over month</CardDescription>
            </CardHeader>
            <CardContent className="h-[340px]">
              {financialMonthly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financialMonthly} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      formatter={val => val ? `៛ ${Number(val).toLocaleString()}` : '៛ 0'}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="Total Revenue (៛)" stroke="#10B981" fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">No financial records recorded.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. Herd Demographics & Stock */}
      {subTab === 'demographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Breed Weight Performance */}
            <div className="lg:col-span-2">
              <Card className="bg-white border border-slate-100 shadow-xs">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-slate-800">Breed Weight Performance (តម្លៃមធ្យមធៀបទម្ងន់អតិបរមា)</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Comparing weight metrics across active breeds</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {breedPerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breedPerformance} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        <Bar dataKey="Avg Weight (kg)" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Max Weight (kg)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">No breed data available.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Breed Composition Pie Chart */}
            <div className="lg:col-span-1">
              <Card className="bg-white border border-slate-100 shadow-xs h-full flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-slate-800">Breed Composition (ចំណែកពូជគោសរុប)</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Percentage share of each breed in active herd</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
                  {breedComposition.length > 0 ? (
                    <div className="w-full h-full flex flex-col justify-between">
                      <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={breedComposition}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {breedComposition.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              formatter={(value, name, props) => [`${value} cows (${props.payload.percentage}%)`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 max-h-[100px] overflow-y-auto pr-1">
                        {breedComposition.map((bc, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-slate-650 truncate" title={bc.name}>{bc.name} ({bc.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs font-semibold py-8">No breed composition data.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gender Ratio & Acquisition Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white border border-slate-100 shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-800">Gender Ratio Breakdown (ភេទ)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {genderComposition.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-xs font-bold text-slate-800">{g.name}</span>
                    <span className="text-xs font-black text-emerald-600">{g.value} Head ({g.percentage}%)</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-100 shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-800">Acquisition Methods (របៀបទិញ/ចូល)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {acquisitionComposition.map((ac, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-xs font-bold text-slate-800">{ac.name}</span>
                    <span className="text-xs font-black text-slate-900">{ac.value} Head ({ac.percentage}%)</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. Fattening & ADG Growth */}
      {subTab === 'batches' && (
        <div className="space-y-6">
          <Card className="bg-white border border-slate-100 shadow-xs">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-600" />
                Fattening Herd ADG Performance & Feed Efficiency
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">Average daily gain (ADG kg/day) and daily ration cost per head across active batches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pl-3">Batch Info</th>
                      <th className="pb-3">Program Type</th>
                      <th className="pb-3 text-center">Headcount</th>
                      <th className="pb-3">Avg Weight</th>
                      <th className="pb-3">ADG (kg/day)</th>
                      <th className="pb-3">Daily Feed Cost / Head</th>
                      <th className="pb-3 text-right pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchAnalytics.map((ba, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="py-4 pl-3">
                          <p className="font-bold text-slate-800">{ba.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{ba.code}</p>
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px]">
                            {ba.type}
                          </span>
                        </td>
                        <td className="py-4 text-center font-bold text-slate-800">{ba.count} Head</td>
                        <td className="py-4 font-bold text-slate-800">{ba['Avg Weight (kg)']} kg</td>
                        <td className="py-4 font-extrabold text-emerald-600">
                          {ba['ADG (kg/day)']} kg/day
                        </td>
                        <td className="py-4 font-bold text-slate-800">
                          ៛ {ba.dailyFeedCostPerHead.toLocaleString()} / head / day
                        </td>
                        <td className="py-4 text-right pr-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            ba.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {ba.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Health & Vet Analytics */}
      {subTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border border-slate-100 shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-800">Active Herd Health Condition Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {healthComposition.map((hc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold">
                    <span>{hc.name} Condition</span>
                    <span className="text-slate-900">{hc.value} Head ({hc.percentage}%)</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-100 shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-800">Health Log History ({data.healthLogs?.length || 0} Records)</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[300px] overflow-y-auto space-y-2 text-xs">
                {data.healthLogs && data.healthLogs.length > 0 ? (
                  data.healthLogs.map((log, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">Cow ID: {log.cowId} • {log.name}</p>
                        <p className="text-[10px] text-slate-400">{log.type} ({log.date ? new Date(log.date).toLocaleDateString() : 'N/A'})</p>
                      </div>
                      <span className="text-xs font-extrabold text-emerald-600">៛ {(log.cost || 0).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 font-semibold py-8 text-center">No medical health logs recorded.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 5. Financials & Sales BI */}
      {subTab === 'financial' && (() => {
        const salesList = farmScopedData.salesTracking;
        const totalSalesRevenue = salesList.reduce((acc, s) => acc + (s.totalPrice || 0), 0);
        const totalSalesCount = salesList.length;
        const totalSalesWeight = salesList.reduce((acc, s) => acc + (s.weight || 0), 0);
        const avgSaleWeight = totalSalesCount > 0 ? (totalSalesWeight / totalSalesCount).toFixed(1) : '0';

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Historical Cattle Sales Ledger */}
              <div className="lg:col-span-3">
                <Card className="bg-white border border-slate-100 shadow-xs h-full flex flex-col justify-between">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-extrabold text-slate-800">
                            Historical Cattle Sales Ledger
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-400">
                            Realized gross revenue from cattle sales transactions ({totalSalesCount} Completed)
                          </CardDescription>
                        </div>
                      </div>
                    </div>

                    {/* Sales KPI Mini Summary Header Bar */}
                    <div className="grid grid-cols-3 gap-3 pt-3">
                      <div className="bg-emerald-50/60 border border-emerald-100 p-2.5 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">Total Revenue</span>
                        <span className="text-sm font-black text-emerald-700 font-mono">៛ {totalSalesRevenue.toLocaleString()}</span>
                      </div>
                      <div className="bg-blue-50/60 border border-blue-100 p-2.5 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">Avg Sale Weight</span>
                        <span className="text-sm font-black text-blue-700 font-mono">{avgSaleWeight} kg</span>
                      </div>
                      <div className="bg-purple-50/60 border border-purple-100 p-2.5 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">Cattle Sold</span>
                        <span className="text-sm font-black text-purple-700 font-mono">{totalSalesCount} Head</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 p-4">
                    {salesList.length > 0 ? (
                      <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                        {salesList.map((s, idx) => (
                          <div key={idx} className="p-3 bg-slate-50/80 border border-slate-100 rounded-xl flex items-center justify-between text-xs hover:bg-slate-100/60 transition-colors">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 font-mono">Cow ID: {s.cowId}</span>
                                {s.breed && <span className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">{s.breed}</span>}
                                {s.saleType && (
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                                    s.saleType === 'Scale' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {s.saleType}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium">
                                📅 {s.salesDate ? new Date(s.salesDate).toLocaleDateString() : 'N/A'} • ⚖️ {s.weight} kg @ ៛ {s.unitPrice.toLocaleString()}/kg • 👤 {s.buyer || 'Direct Buyer'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-600 font-mono block">៛ {s.totalPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* High-End Illustrative Empty State */
                      <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="h-16 w-16 rounded-3xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                          <ShoppingBag className="h-8 w-8 stroke-[1.75]" />
                        </div>
                        <div className="space-y-1 max-w-sm">
                          <h5 className="text-sm font-extrabold text-slate-800">No Cattle Sales Recorded</h5>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            There are currently no completed cattle sales transactions logged for this farm location.
                          </p>
                        </div>
                        <div className="pt-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
                            💡 Sales recorded under Operation Ledger will automatically display here
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SubTab 6: Revenue & Profitability Prediction Engine */}
      {subTab === 'prediction' && (
        <div className="space-y-6">
          {/* Predictive Controls Bar */}
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-emerald-600 animate-pulse" />
                  Batch Revenue & Profitability Prediction Engine
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Predict future harvest weights, gross sales revenue, feed expenses, net profit, and ROI based on ADG growth, daily feed rations, and market price.
                </p>
              </div>

              {/* Date Preset Horizon Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-fit">
                {[30, 60, 90, 120].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      const future = new Date();
                      future.setDate(future.getDate() + days);
                      setTargetHarvestDate(future.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                  >
                    +{days} Days
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Batch Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Select Batch cohort</label>
                <select
                  value={predictionBatchId}
                  onChange={e => setPredictionBatchId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">🐄 All Fattening Herds ({activeCows.length} Head)</option>
                  {(data.batches || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.cowIds?.length || 0} Head)</option>
                  ))}
                </select>
              </div>

              {/* Target Harvest Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Harvest / Sale Date</label>
                <input
                  type="date"
                  value={targetHarvestDate}
                  onChange={e => setTargetHarvestDate(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Expected Selling Price Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Expected Selling Price (៛ / kg)</label>
                <input
                  type="number"
                  value={expectedSellingPricePerKg}
                  onChange={e => setExpectedSellingPricePerKg(e.target.value)}
                  placeholder="18000"
                  className="w-full h-9 rounded-xl border border-emerald-300 bg-emerald-50/20 px-3 text-xs font-mono font-bold text-emerald-900 focus:outline-none ring-2 ring-emerald-500/10"
                />
              </div>

              {/* ADG Growth Rate Override */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  ADG (kg/head/day) <span className="text-slate-400 font-normal">(Auto: {predictionData.calculatedAdg.toFixed(2)})</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={customAdgOverride}
                  onChange={e => setCustomAdgOverride(e.target.value)}
                  placeholder={`Auto: ${predictionData.calculatedAdg.toFixed(2)}`}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Predictive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-sm space-y-1">
              <p className="text-[9.5px] font-black uppercase tracking-wider opacity-80">Predicted Gross Revenue</p>
              <p className="text-2xl font-black font-mono">៛ {Math.round(predictionData.predictedGrossRevenue).toLocaleString()}</p>
              <p className="text-[10.5px] text-emerald-100 font-semibold pt-1 border-t border-emerald-500/60">
                {predictionData.headcount} Head @ ៛ {predictionData.pricePerKg.toLocaleString()}/kg
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-1">
              <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Projected Feed Expenses</p>
              <p className="text-2xl font-black font-mono text-rose-600">៛ {Math.round(predictionData.projectedFeedExpenses).toLocaleString()}</p>
              <p className="text-[10.5px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                {predictionData.daysToHarvest} days @ ៛ {predictionData.dailyFeedCostPerHead.toLocaleString()}/head/day
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-1">
              <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Projected Net Profit</p>
              <p className={`text-2xl font-black font-mono ${predictionData.projectedNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                ៛ {Math.round(predictionData.projectedNetProfit).toLocaleString()}
              </p>
              <p className="text-[10.5px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                After Feed & Initial Asset Costs
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-1">
              <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Projected ROI (%)</p>
              <p className="text-2xl font-black font-mono text-blue-700">
                {predictionData.projectedRoi.toFixed(1)}%
              </p>
              <p className="text-[10.5px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                Return on Total Investment
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-1">
              <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Predicted Final Avg Weight</p>
              <p className="text-2xl font-black font-mono text-slate-900">
                {predictionData.predictedFinalAvgWeight.toFixed(1)}{' '}
                <span className="text-xs text-slate-400 font-bold">kg/head</span>
              </p>
              <p className="text-[10.5px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
                +{predictionData.predictedGainPerHead.toFixed(1)} kg gain ({predictionData.daysToHarvest}d)
              </p>
            </div>
          </div>

          {/* Growth & Financial Projection Chart */}
          <Card className="bg-white border border-slate-100 shadow-xs p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base font-black text-slate-900 flex items-center justify-between">
                <span>📈 Projected Biomass & Net Profit Trajectory ({predictionData.daysToHarvest} Days Horizon)</span>
                <span className="text-xs font-bold text-slate-400">Target Date: {targetHarvestDate}</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Predicted total herd biomass and net profit growth curve leading up to target sale date.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictionData.trajectoryPoints}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorBiomass" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="dayLabel" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#10B981" fontSize={11} tickLine={false} tickFormatter={val => `៛${(val / 1000000).toFixed(1)}M`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" fontSize={11} tickLine={false} tickFormatter={val => `${(val / 1000).toFixed(1)}t`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none' }}
                    formatter={(value, name) => [
                      typeof value === 'number' ? (String(name).includes('៛') ? `៛ ${value.toLocaleString()}` : `${value.toLocaleString()} kg`) : value,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area yAxisId="left" type="monotone" dataKey="Projected Net Profit (៛)" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                  <Area yAxisId="right" type="monotone" dataKey="Total Biomass (kg)" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorBiomass)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cattle Predictive Ledger Table */}
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">Individual Cattle Harvest Prediction Ledger ({predictionData.headcount} Head)</h4>
                <p className="text-xs text-slate-400">Predicted final harvest weight and market value for each enrolled cow at target harvest date.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[9.5px] uppercase tracking-wider">
                    <th className="py-3.5 px-5">Cow ID</th>
                    <th className="py-3.5 px-5">Breed</th>
                    <th className="py-3.5 px-5">Current Weight</th>
                    <th className="py-3.5 px-5">Predicted Gain (+{predictionData.daysToHarvest}d)</th>
                    <th className="py-3.5 px-5">Predicted Final Weight</th>
                    <th className="py-3.5 px-5 text-right">Predicted Market Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {predictionData.cowLedger.map(cow => (
                    <tr key={cow.cowId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5 font-black text-slate-900">{cow.cowId}</td>
                      <td className="py-3.5 px-5 text-slate-500">{cow.breed}</td>
                      <td className="py-3.5 px-5 font-mono">{cow.currentWeight.toFixed(1)} kg</td>
                      <td className="py-3.5 px-5 font-mono text-emerald-600 font-bold">+{cow.predictedGain.toFixed(1)} kg</td>
                      <td className="py-3.5 px-5 font-mono font-black text-slate-900 text-sm">{cow.predictedFinalWeight.toFixed(1)} kg</td>
                      <td className="py-3.5 px-5 text-right font-mono font-black text-emerald-700">
                        ៛ {Math.round(cow.predictedValue).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {predictionData.cowLedger.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                        No active cattle found for prediction.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
