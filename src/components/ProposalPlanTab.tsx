'use client';

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  RotateCcw,
  TrendingUp,
  Beef,
  Package,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Wheat,
  BarChart3,
  CheckCircle2,
  Sliders,
  Coins,
  Scale,
  RefreshCw,
  Info,
  Landmark,
  Building2,
  DollarSign,
  PieChart,
  Percent
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { format2DecimalsWithCommas } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { ProposalPlanParams } from '@/types';

// Default Benchmark Proposal Assumptions (100% Dynamic Simulation Engine)
const DEFAULT_PLAN = {
  targetStockLevel: 400,             // Target Stock Level (Head)
  numberOfBatches: 10,
  cattlePerBatch: 40,
  
  // Weight & Growth Assumptions (Interactive per KG parameters)
  initialWeightKg: 300,              // Initial entry weight
  dailyWeightGainKg: 1.25,           // Daily ADG gain (kg/day)
  fatteningPeriodDays: 120,          // Fattening period duration (days)
  
  // Buying & Selling Price per KG (in KHR ៛)
  purchasePricePerKgKhr: 11000,      // Purchase price (KHR / kg) -> 11,000 KHR/kg
  sellingPricePerKgKhr: 12500,       // Selling price (KHR / kg) -> 12,500 KHR/kg

  // Bank Interest Assumption (% per year)
  bankInterestRateAnnual: 8.0,       // Annual bank interest rate (%)

  // Grass Feed Assumptions
  grassKgPerHeadDay: 30,             // Grass feed intake (kg/head/day)
  grassCostPerKgKhr: 200,            // Grass price (KHR/kg)

  // Concentrate Feed Assumptions
  concentrateKgPerHeadDay: 7,        // Cattle concentrate feed intake (kg/head/day)
  concentrateCostPerKgKhr: 1200      // Cattle concentrate price (KHR/kg)
};

// Helper functions for thousand separator comma formatting in input fields
const formatNumberWithCommas = (val: number | string): string => {
  if (val === undefined || val === null || val === '') return '';
  const cleanStr = val.toString().replace(/,/g, '');
  const num = Number(cleanStr);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US');
};

const parseNumberFromCommas = (str: string): number => {
  const clean = str.replace(/,/g, '');
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
};

interface ProposalPlanTabProps {
  // The last-saved plan, if any (fetched from the DB) — pre-fills the
  // simulation instead of always starting from the hardcoded benchmark.
  initialPlan?: ProposalPlanParams;
  // Persists the current simulation inputs so the mobile app's read-only
  // Proposal summary can show real, saved figures instead of nothing.
  onSavePlan?: (params: ProposalPlanParams) => Promise<void>;
}

export default function ProposalPlanTab({ initialPlan, onSavePlan }: ProposalPlanTabProps = {}) {
  const { t, language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<
    'dashboard' | 'projection' | 'purchasing_selling' | 'batches' | 'feed_plan' | 'financials'
  >('dashboard');

  // Interactive Simulation State — pre-filled from the last saved plan
  // when one exists, else the hardcoded benchmark.
  const [params, setParams] = useState({ ...DEFAULT_PLAN, ...(initialPlan || {}) });
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planSavedAt, setPlanSavedAt] = useState<string | null>(null);

  // Period Selector for Feed Calculator
  const [selectedFeedPeriodDays, setSelectedFeedPeriodDays] = useState<number>(30);
  const [selectedFeedHeadCount, setSelectedFeedHeadCount] = useState<number>(params.targetStockLevel);

  // Save the current simulation inputs as the shared "current plan" —
  // this is what the mobile app's read-only Proposal summary reads.
  const handleSavePlan = async () => {
    if (!onSavePlan) return;
    setIsSavingPlan(true);
    try {
      await onSavePlan(params);
      setPlanSavedAt(new Date().toLocaleTimeString());
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Reset to default plan benchmark
  const handleResetDefaults = () => {
    if (window.confirm('តើអ្នកពិតជាចង់កំណត់ទិន្នន័យផែនការគំរូឡើងវិញ (Reset Default Plan) ឬទេ?')) {
      setParams({ ...DEFAULT_PLAN });
      setSelectedFeedPeriodDays(30);
      setSelectedFeedHeadCount(DEFAULT_PLAN.targetStockLevel);
    }
  };

  // ─── 100% Dynamic Calculation Engine (Corrected 30-Day Monthly Feed Multiplier) ───
  const calculations = useMemo(() => {
    const {
      targetStockLevel,
      numberOfBatches,
      cattlePerBatch,
      initialWeightKg,
      dailyWeightGainKg,
      fatteningPeriodDays,
      purchasePricePerKgKhr,
      sellingPricePerKgKhr,
      bankInterestRateAnnual,
      grassKgPerHeadDay,
      grassCostPerKgKhr,
      concentrateKgPerHeadDay,
      concentrateCostPerKgKhr
    } = params;

    const totalCattle = targetStockLevel || 400;

    // Fattening Period in Months
    const fatteningMonths = Math.max(1, Math.round(fatteningPeriodDays / 30));

    // Dynamic Monthly Batch Purchase/Sales Quantity
    const monthlyBatchQty = Math.max(1, Math.round(totalCattle / fatteningMonths));
    const monthlySalesTarget = monthlyBatchQty;
    const monthlyReplacementPurchase = monthlyBatchQty;

    // Weight Calculations
    const totalWeightGainKgPerHead = dailyWeightGainKg * fatteningPeriodDays;
    const finalWeightKgPerHead = initialWeightKg + totalWeightGainKgPerHead;

    // Per Head Derived Prices (Weight kg x Price/kg)
    const purchasePricePerHeadKhr = initialWeightKg * purchasePricePerKgKhr;
    const sellingPricePerHeadKhr = finalWeightKgPerHead * sellingPricePerKgKhr;

    // Grass Feed (Target Stock Herd) -> CORRECTED MONTHLY MULTIPLIER (x 30 Days)
    const dailyGrassKgTotal = totalCattle * grassKgPerHeadDay;
    const dailyGrassCostKhr = dailyGrassKgTotal * grassCostPerKgKhr;
    const monthlyGrassKgTotal = dailyGrassKgTotal * 30;
    const monthlyGrassCostKhr = monthlyGrassKgTotal * grassCostPerKgKhr; // Corrected: 400 * 30kg * 200 * 30d = 72M/mo

    // Concentrate Feed (Target Stock Herd) -> CORRECTED MONTHLY MULTIPLIER (x 30 Days)
    const dailyConcentrateKgTotal = totalCattle * concentrateKgPerHeadDay;
    const dailyConcentrateCostKhr = dailyConcentrateKgTotal * concentrateCostPerKgKhr;
    const monthlyConcentrateKgTotal = dailyConcentrateKgTotal * 30;
    const monthlyConcentrateCostKhr = monthlyConcentrateKgTotal * concentrateCostPerKgKhr; // Corrected: 400 * 7kg * 1200 * 30d = 100.8M/mo

    // Combined Feed (Target Stock Herd)
    const dailyTotalFeedCostKhr = dailyGrassCostKhr + dailyConcentrateCostKhr;
    const monthlyTotalFeedCostKhr = monthlyGrassCostKhr + monthlyConcentrateCostKhr;

    // Per Cattle Fattening Period Feed Cost (fatteningPeriodDays)
    const perHeadPeriodGrassCostKhr = grassKgPerHeadDay * fatteningPeriodDays * grassCostPerKgKhr;
    const perHeadPeriodConcentrateCostKhr = concentrateKgPerHeadDay * fatteningPeriodDays * concentrateCostPerKgKhr;
    const perHeadPeriodTotalFeedCostKhr = perHeadPeriodGrassCostKhr + perHeadPeriodConcentrateCostKhr;

    // Per Batch (Target Stock / fatteningMonths Head x Fattening Period)
    const perBatchPeriodGrassCostKhr = perHeadPeriodGrassCostKhr * cattlePerBatch;
    const perBatchPeriodConcentrateCostKhr = perHeadPeriodConcentrateCostKhr * cattlePerBatch;
    const perBatchPeriodTotalFeedCostKhr = perHeadPeriodTotalFeedCostKhr * cattlePerBatch;

    // Initial Capital Requirement (Purchasing Target Stock)
    const initialCattlePurchaseKhr = totalCattle * purchasePricePerHeadKhr;

    // Bank Interest Calculations
    const monthlyInterestRateFraction = (bankInterestRateAnnual / 100) / 12;
    const monthlyBankInterestKhr = initialCattlePurchaseKhr * monthlyInterestRateFraction;

    // Monthly Replacement Purchase Cost (replenishment post-sale)
    const monthlyReplacementPurchaseKhr = monthlyReplacementPurchase * purchasePricePerHeadKhr;

    // Monthly Sales Revenue (starting Month `fatteningMonths`)
    const monthlySalesRevenueKhr = monthlySalesTarget * sellingPricePerHeadKhr;

    // Total Monthly Costs (Replenishment Cattle + Feed + Bank Interest)
    const totalMonthlyCostKhr = monthlyReplacementPurchaseKhr + monthlyTotalFeedCostKhr + monthlyBankInterestKhr;

    // Gross & Net Monthly Profits (Steady State M4+)
    const monthlyGrossProfitKhr = monthlySalesRevenueKhr - totalMonthlyCostKhr;

    // ─── Annual Financial & Costing Calculations (1 Year / 12 Months Steady State) ───
    const annualCattlePurchasesKhr = monthlyReplacementPurchaseKhr * 12;
    const annualGrassCostKhr = monthlyGrassCostKhr * 12;
    const annualConcentrateCostKhr = monthlyConcentrateCostKhr * 12;
    const annualTotalFeedCostKhr = monthlyTotalFeedCostKhr * 12;
    const annualBankInterestKhr = monthlyBankInterestKhr * 12;

    const annualTotalFarmCostKhr = annualCattlePurchasesKhr + annualTotalFeedCostKhr + annualBankInterestKhr;
    const annualSalesRevenueKhr = monthlySalesRevenueKhr * 12;
    const annualNetProfitKhr = annualSalesRevenueKhr - annualTotalFarmCostKhr;

    // ─── Annual Net Profit Margin (%) & Annual ROI (%) per Year ───
    const annualNetMarginPercent = annualSalesRevenueKhr > 0 ? (annualNetProfitKhr / annualSalesRevenueKhr) * 100 : 0;
    const annualRoiPercent = initialCattlePurchaseKhr > 0 ? (annualNetProfitKhr / initialCattlePurchaseKhr) * 100 : 0;

    // Per Cattle Revenue & Margin Analysis
    const revenuePerCattleKhr = sellingPricePerHeadKhr;
    const bankInterestPerCattleKhr = purchasePricePerHeadKhr * (monthlyInterestRateFraction * fatteningMonths);
    const totalCostPerCattleKhr = purchasePricePerHeadKhr + perHeadPeriodTotalFeedCostKhr + bankInterestPerCattleKhr;
    const profitPerCattleKhr = revenuePerCattleKhr - totalCostPerCattleKhr;
    const profitMarginPercent = revenuePerCattleKhr > 0 ? (profitPerCattleKhr / revenuePerCattleKhr) * 100 : 0;

    // Per Batch Profitability
    const batchRevenueKhr = cattlePerBatch * sellingPricePerHeadKhr;
    const batchTotalCostKhr = (cattlePerBatch * purchasePricePerHeadKhr) + perBatchPeriodTotalFeedCostKhr + (cattlePerBatch * bankInterestPerCattleKhr);
    const batchNetProfitKhr = batchRevenueKhr - batchTotalCostKhr;

    // 12-Month Projection Flow Data
    const monthlyProjections = Array.from({ length: 12 }, (_, index) => {
      const monthNum = index + 1;

      let openingStock = 0;
      let purchaseQty = 0;
      let salesQty = 0;
      let closingStock = 0;

      if (monthNum < fatteningMonths) {
        openingStock = (monthNum - 1) * monthlyBatchQty;
        purchaseQty = monthlyBatchQty;
        salesQty = 0;
        closingStock = monthNum * monthlyBatchQty;
      } else if (monthNum === fatteningMonths) {
        openingStock = (monthNum - 1) * monthlyBatchQty;
        purchaseQty = monthlyBatchQty;
        salesQty = monthlyBatchQty;
        closingStock = totalCattle;
      } else {
        openingStock = totalCattle;
        purchaseQty = monthlyBatchQty;
        salesQty = monthlyBatchQty;
        closingStock = totalCattle;
      }

      // Active herd size in farm for feed & bank interest calculation
      const activeHerdSize = closingStock;
      
      const purchaseCostKhr = purchaseQty * purchasePricePerHeadKhr;
      const grassCostKhr = activeHerdSize * grassKgPerHeadDay * grassCostPerKgKhr * 30;
      const concentrateCostKhr = activeHerdSize * concentrateKgPerHeadDay * concentrateCostPerKgKhr * 30;
      const feedCostKhr = grassCostKhr + concentrateCostKhr;
      const bankInterestMonthKhr = (activeHerdSize * purchasePricePerHeadKhr) * monthlyInterestRateFraction;
      
      const holdingCostKhr = feedCostKhr;
      const totalCostKhr = purchaseCostKhr + holdingCostKhr + bankInterestMonthKhr;
      const revenueKhr = salesQty * sellingPricePerHeadKhr;
      const netProfitKhr = revenueKhr - totalCostKhr;

      return {
        month: `Month ${monthNum}`,
        monthKh: `ខែទី ${monthNum}`,
        openingStock,
        purchaseQty,
        salesQty,
        closingStock,
        purchaseCostKhr,
        feedCostKhr,
        holdingCostKhr,
        bankInterestMonthKhr,
        revenueKhr,
        totalCostKhr,
        netProfitKhr
      };
    });

    // 10 Batches Schedule Breakdown
    const batchPlans = Array.from({ length: numberOfBatches }, (_, i) => {
      const batchNo = i + 1;
      const purchaseMonth = Math.floor(i * 1.0) + 1;
      const saleMonth = purchaseMonth + fatteningMonths;

      return {
        id: `BATCH-PROP-${batchNo.toString().padStart(2, '0')}`,
        name: `Batch ${batchNo.toString().padStart(2, '0')}`,
        nameKh: `ក្រុមទី ${batchNo} (${cattlePerBatch} ក្បាល)`,
        cattleCount: cattlePerBatch,
        purchaseMonth: `Month ${purchaseMonth}`,
        fatteningDays: fatteningPeriodDays,
        saleMonth: `Month ${saleMonth}`,
        grassReqKg: perBatchPeriodGrassCostKhr / (grassCostPerKgKhr || 1),
        concentrateReqKg: perBatchPeriodConcentrateCostKhr / (concentrateCostPerKgKhr || 1),
        cattleCostKhr: cattlePerBatch * purchasePricePerHeadKhr,
        totalFeedCostKhr: perBatchPeriodTotalFeedCostKhr,
        bankInterestCostKhr: cattlePerBatch * bankInterestPerCattleKhr,
        totalCostKhr: batchTotalCostKhr,
        totalRevenueKhr: batchRevenueKhr,
        netProfitKhr: batchNetProfitKhr,
        profitMargin: profitMarginPercent
      };
    });

    return {
      totalCattle,
      monthlyBatchQty,
      fatteningMonths,
      totalWeightGainKgPerHead,
      finalWeightKgPerHead,
      purchasePricePerHeadKhr,
      sellingPricePerHeadKhr,
      dailyGrassKgTotal,
      dailyGrassCostKhr,
      monthlyGrassKgTotal,
      monthlyGrassCostKhr,
      dailyConcentrateKgTotal,
      dailyConcentrateCostKhr,
      monthlyConcentrateKgTotal,
      monthlyConcentrateCostKhr,
      dailyTotalFeedCostKhr,
      monthlyTotalFeedCostKhr,
      perHeadPeriodTotalFeedCostKhr,
      perBatchPeriodTotalFeedCostKhr,
      initialCattlePurchaseKhr,
      monthlyBankInterestKhr,
      bankInterestPerCattleKhr,
      monthlyReplacementPurchaseKhr,
      monthlySalesRevenueKhr,
      totalMonthlyCostKhr,
      monthlyGrossProfitKhr,
      annualCattlePurchasesKhr,
      annualGrassCostKhr,
      annualConcentrateCostKhr,
      annualTotalFeedCostKhr,
      annualBankInterestKhr,
      annualTotalFarmCostKhr,
      annualSalesRevenueKhr,
      annualNetProfitKhr,
      annualNetMarginPercent,
      annualRoiPercent,
      revenuePerCattleKhr,
      totalCostPerCattleKhr,
      profitPerCattleKhr,
      profitMarginPercent,
      batchRevenueKhr,
      batchTotalCostKhr,
      batchNetProfitKhr,
      monthlyProjections,
      batchPlans
    };
  }, [params]);

  // Dedicated Period Custom Feed Calculator Result (in KHR)
  const periodFeedCalc = useMemo(() => {
    const head = selectedFeedHeadCount;
    const days = selectedFeedPeriodDays;
    const grassKg = head * params.grassKgPerHeadDay * days;
    const grassCostKhr = grassKg * params.grassCostPerKgKhr;

    const concentrateKg = head * params.concentrateKgPerHeadDay * days;
    const concentrateCostKhr = concentrateKg * params.concentrateCostPerKgKhr;

    const totalCostKhr = grassCostKhr + concentrateCostKhr;

    return {
      head,
      days,
      grassKg,
      grassCostKhr,
      concentrateKg,
      concentrateCostKhr,
      totalCostKhr
    };
  }, [selectedFeedHeadCount, selectedFeedPeriodDays, params]);

  // Format currency helpers (Strictly KHR ៛)
  const fmtKhr = (val: number) => `៛ ${format2DecimalsWithCommas(val)}`;

  return (
    <div className="space-y-6">

      {/* ─── Top Header & Banner ─── */}
      <div className="bg-gradient-to-r from-[#0C1F1A] via-[#13332B] to-[#002D26] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-800/40">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 text-emerald-400" />
                {language === 'km' ? 'ម៉ាស៊ីនគណនាសាកល្បង (Dynamic Interactive Engine)' : 'Dynamic Interactive Engine'}
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                {language === 'km' ? `រក្សាស្តុកគោ ${formatNumberWithCommas(params.targetStockLevel)} ក្បាលថេរ (ចាប់ពី M${calculations.fatteningMonths})` : `Target Stock: ${formatNumberWithCommas(params.targetStockLevel)} Head (From M${calculations.fatteningMonths})`}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Scale className="h-7 w-7 text-emerald-400" />
              {language === 'km' ? 'ឧបករណ៍ផែនការអាជីវកម្មបំប៉ន (Fattening Proposal Tool)' : 'Fattening Proposal Tool (Dynamic Target Stock & Bank Interest)'}
            </h1>
            <p className="text-xs text-slate-300 font-medium mt-1 max-w-3xl leading-relaxed">
              {language === 'km'
                ? `ទិញ +${calculations.monthlyBatchQty} ក្បាល/ខែ រហូតដល់ ${formatNumberWithCommas(params.targetStockLevel)} ក្បាល។ គណនាចំណូល លក់គោជំនួស ស្មៅ ចំណីសមាស ការប្រាក់ធនាគារ (${params.bankInterestRateAnnual}%/ឆ្នាំ) និង អត្រាចំណេញប្រចាំឆ្នាំ (${calculations.annualNetMarginPercent.toFixed(1)}%/ឆ្នាំ)។`
                : `Purchases +${calculations.monthlyBatchQty} cattle monthly up to ${formatNumberWithCommas(params.targetStockLevel)} head. Computes sales, feed, bank interest, and annual margin (%/year).`}
            </p>
            {planSavedAt && (
              <p className="text-[10px] text-emerald-300 font-bold mt-1.5">
                {language === 'km' ? `រក្សាទុកនៅ ${planSavedAt}` : `Saved to mobile app at ${planSavedAt}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onSavePlan && (
              <button
                onClick={handleSavePlan}
                disabled={isSavingPlan}
                className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-emerald-400/40 transition-all flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-60"
                title="Save this plan — the mobile app's Proposal summary reads whatever was last saved here"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isSavingPlan ? (language === 'km' ? 'កំពុងរក្សាទុក...' : 'Saving...') : (language === 'km' ? 'រក្សាទុកគម្រោង (Save Plan)' : 'Save Plan')}</span>
              </button>
            )}
            <button
              onClick={handleResetDefaults}
              className="bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all flex items-center gap-2 shadow-lg cursor-pointer"
              title="Reset all assumptions back to default benchmark values"
            >
              <RotateCcw className="h-4 w-4 text-amber-400" />
              <span>{language === 'km' ? 'កំណត់ឡើងវិញ (Reset Plan)' : 'Reset Default Plan'}</span>
            </button>
          </div>
        </div>

        {/* Core Benchmark Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'km' ? 'គោលដៅស្តុកគោ' : 'Target Stock'}</p>
            <p className="text-base font-black text-emerald-300 mt-0.5">{formatNumberWithCommas(params.targetStockLevel)} <span className="text-[10px] text-slate-300 font-semibold">{t('common.head')}</span></p>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'km' ? 'ការប្រាក់ធនាគារ' : 'Bank Interest'}</p>
            <p className="text-base font-black text-amber-300 mt-0.5">{params.bankInterestRateAnnual}% <span className="text-[10px] text-slate-300 font-semibold">/ ឆ្នាំ</span></p>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'km' ? 'អត្រាចំណេញ/ឆ្នាំ' : 'Annual Margin %'}</p>
            <p className="text-base font-black text-emerald-400 mt-0.5">{calculations.annualNetMarginPercent.toFixed(1)}% <span className="text-[10px] text-slate-300 font-semibold">/ ឆ្នាំ</span></p>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'km' ? 'ទិញចូលប្រចាំខែ' : 'Monthly Purchases'}</p>
            <p className="text-base font-black text-blue-300 mt-0.5">+{calculations.monthlyBatchQty} <span className="text-[10px] text-slate-300 font-semibold">ក្បាល/ខែ</span></p>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'km' ? 'តម្លៃទិញ ៛/kg' : 'Buying Price / KG'}</p>
            <p className="text-base font-black text-emerald-400 mt-0.5">@{formatNumberWithCommas(params.purchasePricePerKgKhr)} <span className="text-[10px] text-slate-300 font-semibold">៛/kg</span></p>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === 'km' ? 'តម្លៃលក់ ៛/kg' : 'Selling Price / KG'}</p>
            <p className="text-base font-black text-purple-300 mt-0.5">@{formatNumberWithCommas(params.sellingPricePerKgKhr)} <span className="text-[10px] text-slate-300 font-semibold">៛/kg</span></p>
          </div>
        </div>
      </div>

      {/* ─── Sub-Tab Navigation ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'dashboard', label: language === 'km' ? '📊 ផ្ទាំងសង្ខេប & ក្រាហ្វ' : '📊 Dashboard & Overview' },
          { id: 'projection', label: language === 'km' ? `🐂 ពិពណ៌នាស្តុក (១២ខែ ដំណាក់កាល M1–M${calculations.fatteningMonths})` : `🐂 12-Month Projection (M1–M${calculations.fatteningMonths})` },
          { id: 'purchasing_selling', label: language === 'km' ? '🛒 ផែនការទិញ-លក់តាម KG' : '🛒 Purchase & Sales Plan (Per KG)' },
          { id: 'batches', label: language === 'km' ? '📦 ផែនការបាច់ (១-១០)' : '📦 10 Batches Structure' },
          { id: 'feed_plan', label: language === 'km' ? '🌾 ផែនការចំណី & គណនា' : '🌾 Feed Plan & Calculator' },
          { id: 'financials', label: language === 'km' ? '💰 ផែនការហិរញ្ញវត្ថុ & ការប្រាក់ (៛)' : '💰 Financial P&L & Interest (KHR)' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: EXECUTIVE DASHBOARD & KPI OVERVIEW ─── */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Main KPI Cards Grid (5 Columns with Annual Margin %) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {language === 'km' ? 'គោលដៅស្តុកគោ (Target Stock)' : 'Target Stock Level'}
                </span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Beef className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                {formatNumberWithCommas(params.targetStockLevel)} <span className="text-xs text-emerald-600 font-bold">{t('common.head')}</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ទិញ +{calculations.monthlyBatchQty}ក្បាល/ខែ
              </p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {language === 'km' ? 'ការប្រាក់ធនាគារប្រចាំខែ' : 'Monthly Bank Interest'}
                </span>
                <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Landmark className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-lg font-black text-amber-700 mt-2">
                {fmtKhr(calculations.monthlyBankInterestKhr)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                @{params.bankInterestRateAnnual}% / ឆ្នាំ (ទុន: {fmtKhr(calculations.initialCattlePurchaseKhr)})
              </p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {language === 'km' ? `ចំណាយប្រតិបត្តិការ/ឆ្នាំ` : 'Annual Operating Cost'}
                </span>
                <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-lg font-black text-rose-700 mt-2">
                {fmtKhr(calculations.annualTotalFarmCostKhr)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                / ឆ្នាំ (ទិញគោ + ចំណី + ការប្រាក់)
              </p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {language === 'km' ? `ចំណេញសុទ្ធប្រចាំឆ្នាំ` : 'Annual Net Profit'}
                </span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Coins className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-lg font-black text-emerald-700 mt-2">
                {fmtKhr(calculations.annualNetProfitKhr)}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                / ឆ្នាំ (ចំណូល - ចំណាយសរុប)
              </p>
            </div>

            {/* KPI CARD: Annual Net Profit Margin (%) */}
            <div className="bg-white p-4.5 rounded-2xl border border-emerald-300 shadow-md relative overflow-hidden bg-gradient-to-br from-emerald-50/60 to-teal-50/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider">
                  {language === 'km' ? `អត្រាចំណេញប្រចាំឆ្នាំ (%)` : `Annual Profit Margin (%)`}
                </span>
                <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Percent className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-emerald-700 mt-2">
                {calculations.annualNetMarginPercent.toFixed(1)}% <span className="text-xs text-emerald-800 font-bold">/ ឆ្នាំ</span>
              </h3>
              <p className="text-[10px] text-emerald-800 mt-1 font-bold">
                Margin (%) = (ចំណេញសុទ្ធ ÷ ចំណូលសរុប) × 100
              </p>
            </div>

          </div>

          {/* ─── 2-BLOCK INTERACTIVE PARAMETERS FORM ─── */}
          <div className="space-y-6">

            {/* BLOCK 1: Herd Target, Fattening Cycle, Pricing & Bank Interest */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
                    ១
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">
                      {language === 'km' ? '១. ស្តុកគោ, ជុំបំប៉ន, ទម្ងន់, តម្លៃទិញ-លក់ & ការប្រាក់ធនាគារ' : 'Block 1: Herd Target, Fattening Cycle, Pricing & Bank Interest'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'km' ? 'កំណត់គោលដៅស្តុក ទម្ងន់ ជុំបំប៉ន តម្លៃទិញ-លក់ និង ការប្រាក់ធនាគារ' : 'Target stock level, fattening duration, weights, prices & interest %'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {language === 'km' ? '៧ យ៉ាង' : '7 Parameters'}
                </span>
              </div>

              {/* Row 1: Target Stock, Bank Interest, Fattening Days, Entry Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80">
                  <label className="block font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                    <Beef className="h-4 w-4 text-emerald-600" />
                    {language === 'km' ? 'គោលដៅស្តុកគោ (Target Stock Head):' : 'Target Stock Level (Head):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.targetStockLevel)}
                    onChange={(e) => setParams({ ...params, targetStockLevel: parseNumberFromCommas(e.target.value) || 0 })}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-emerald-700 font-bold mt-1">
                    = ទិញ/លក់ +{calculations.monthlyBatchQty} ក្បាល/ខែ
                  </p>
                </div>

                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
                  <label className="block font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-amber-600" />
                    {language === 'km' ? 'ការប្រាក់ធនាគារ (% / ឆ្នាំ):' : 'Bank Interest Rate (% / year):'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.bankInterestRateAnnual}
                    onChange={(e) => setParams({ ...params, bankInterestRateAnnual: Number(e.target.value) || 0 })}
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <p className="text-[10px] text-amber-700 font-bold mt-1">
                    = {fmtKhr(calculations.monthlyBankInterestKhr)} / ខែ
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'ជុំបំប៉ន (ថ្ងៃ/ខែ):' : 'Fattening Period (Days):'}
                  </label>
                  <input
                    type="number"
                    value={params.fatteningPeriodDays}
                    onChange={(e) => setParams({ ...params, fatteningPeriodDays: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    = {calculations.fatteningMonths} ខែ (លក់នៅ M{calculations.fatteningMonths})
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'ទម្ងន់ទិញចូល (Initial kg):' : 'Initial Weight (kg):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.initialWeightKg)}
                    onChange={(e) => setParams({ ...params, initialWeightKg: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

              </div>

              {/* Row 2: Purchase Price, Daily Gain, Selling Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-3 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'តម្លៃទិញចូល (៛/kg):' : 'Purchase Price (KHR/kg):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.purchasePricePerKgKhr)}
                    onChange={(e) => setParams({ ...params, purchasePricePerKgKhr: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-blue-600 font-bold mt-1">
                    = {fmtKhr(calculations.purchasePricePerHeadKhr)} / ក្បាល
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'កំណើន ADG (kg/ថ្ងៃ):' : 'Daily ADG Gain (kg/day):'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={params.dailyWeightGainKg}
                    onChange={(e) => setParams({ ...params, dailyWeightGainKg: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-emerald-700 font-bold mt-1">
                    ទម្ងន់ចុងក្រោយ = {calculations.finalWeightKgPerHead} kg
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'តម្លៃលក់ចេញ (៛/kg):' : 'Selling Price (KHR/kg):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.sellingPricePerKgKhr)}
                    onChange={(e) => setParams({ ...params, sellingPricePerKgKhr: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">
                    = {fmtKhr(calculations.sellingPricePerHeadKhr)} / ក្បាល
                  </p>
                </div>
              </div>
            </div>

            {/* BLOCK 2: Feed Intake Rations & Feed Costs */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-green-100 text-green-800 flex items-center justify-center font-black text-sm">
                    ២
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">
                      {language === 'km' ? '២. ផែនការបរិមាណចំណីស្មៅ-ចំណីសមាស & តម្លៃចំណី' : 'Block 2: Grass & Concentrate Feed Intake & Costs'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'km' ? 'បរិមាណចំណីស្មៅ និង ចំណីសមាសដែលញ៉ាំក្នុង១ថ្ងៃ/ក្បាល ព្រមទាំងតម្លៃចំណីក្នុង១គីឡូ' : 'Daily grass & concentrate feed intake per head and cost per kg'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                  {language === 'km' ? '៤ យ៉ាង' : '4 Parameters'}
                </span>
              </div>

              {/* Feed Intake & Feed Cost Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'ស្មៅបរិភោគ/ថ្ងៃ (kg/ក្បាល/ថ្ងៃ):' : 'Grass Feed Intake (kg/head/day):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.grassKgPerHeadDay)}
                    onChange={(e) => setParams({ ...params, grassKgPerHeadDay: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-green-700 font-bold mt-1">
                    = {format2DecimalsWithCommas(calculations.dailyGrassKgTotal)} kg/ថ្ងៃ ({params.targetStockLevel}ក្បាល)
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'តម្លៃស្មៅ (៛/kg):' : 'Grass Cost (KHR/kg):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.grassCostPerKgKhr)}
                    onChange={(e) => setParams({ ...params, grassCostPerKgKhr: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <p className="text-[10px] text-green-700 font-bold mt-1">
                    = {fmtKhr(params.grassKgPerHeadDay * params.grassCostPerKgKhr)} / ក្បាល / ថ្ងៃ
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'ចំណីសមាសបរិភោគ/ថ្ងៃ (kg/ក្បាល/ថ្ងៃ):' : 'Cattle Feed Intake (kg/head/day):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.concentrateKgPerHeadDay)}
                    onChange={(e) => setParams({ ...params, concentrateKgPerHeadDay: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <p className="text-[10px] text-purple-700 font-bold mt-1">
                    = {format2DecimalsWithCommas(calculations.dailyConcentrateKgTotal)} kg/ថ្ងៃ ({params.targetStockLevel}ក្បាល)
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'km' ? 'តម្លៃចំណីសមាស (៛/kg):' : 'Cattle Feed Cost (KHR/kg):'}
                  </label>
                  <input
                    type="text"
                    value={formatNumberWithCommas(params.concentrateCostPerKgKhr)}
                    onChange={(e) => setParams({ ...params, concentrateCostPerKgKhr: parseNumberFromCommas(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <p className="text-[10px] text-purple-700 font-bold mt-1">
                    = {fmtKhr(params.concentrateKgPerHeadDay * params.concentrateCostPerKgKhr)} / ក្បាល / ថ្ងៃ
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Visual Charts Grid (in KHR) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 12-Month Financial Flow Chart */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {language === 'km' ? 'ក្រាហ្វចំណូល និង ចំណាយប្រចាំខែជាប្រាក់រៀល (១២ ខែ)' : '12-Month Projected Revenue vs Expense (KHR)'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {language === 'km' ? `ទិញគោ M1–M${calculations.fatteningMonths} (+${calculations.monthlyBatchQty}ក្បាល/ខែ) → ចាប់ផ្តើមលក់ និង ចំណេញពីខែទី${calculations.fatteningMonths}` : `Monthly breakdown of purchases (M1–M${calculations.fatteningMonths}), sales (M${calculations.fatteningMonths}+), and net profit`}
                  </p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calculations.monthlyProjections}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `៛${(v / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      formatter={val => [`៛ ${format2DecimalsWithCommas(Number(val) || 0)}`, '']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="revenueKhr" name="Sales Revenue (៛)" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalCostKhr" name="Total Cost (៛)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="netProfitKhr" name="Net Profit (៛)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Stock Level Trend */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {language === 'km' ? `ក្រាហ្វស្តុកគោ (Ramp-up M1–M${calculations.fatteningMonths} to ${params.targetStockLevel} Head)` : `Monthly Cattle Inventory Trend (Ramp-up M1–M${calculations.fatteningMonths})`}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {language === 'km' ? `ទិញចូល +${calculations.monthlyBatchQty}ក្បាល/ខែ រហូតដល់ ${params.targetStockLevel}ក្បាល ហើយរក្សាថេរតាមរយៈការទិញជំនួស` : `Building up to ${params.targetStockLevel} head, then maintaining target stock`}
                  </p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={calculations.monthlyProjections}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis domain={[0, Math.round(params.targetStockLevel * 1.2)]} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="closingStock" name="Closing Stock (Head)" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="salesQty" name="Monthly Sales (Head)" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="purchaseQty" name="Monthly Purchase (Head)" stroke="#3B82F6" strokeWidth={2} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── TAB 2: CATTLE STOCK & MONTHLY PROJECTION ─── */}
      {activeSubTab === 'projection' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  {language === 'km' ? `តារាងប៉ាន់ប្រមាណស្តុកគោ ១២ ខែ (ទិញ +${calculations.monthlyBatchQty}ក្បាល/ខែ ក្នុង M1–M${calculations.fatteningMonths})` : `12-Month Cattle Stock Projection Table (Purchases M1–M${calculations.fatteningMonths})`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'km'
                    ? `ទិញ +${calculations.monthlyBatchQty}ក្បាល/ខែ (M1–M${calculations.fatteningMonths}) រហូតដល់គ្រប់ ${params.targetStockLevel}ក្បាល។ លក់គោ និង ទិញជំនួស ${calculations.monthlyBatchQty}ក្បាល/ខែ រួមបញ្ចូលការប្រាក់ធនាគារ (${params.bankInterestRateAnnual}%/ឆ្នាំ)។`
                    : `Purchases: +${calculations.monthlyBatchQty}/mo (Months 1–${calculations.fatteningMonths}). Sales begin in Month ${calculations.fatteningMonths} with bank interest (${params.bankInterestRateAnnual}%/yr) included.`}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-800">
                  {language === 'km' ? `គោលដៅស្តុក៖ ${params.targetStockLevel} ក្បាល (M${calculations.fatteningMonths}+)` : `Target Stock: ${params.targetStockLevel} Head (M${calculations.fatteningMonths}+)`}
                </span>
              </div>
            </div>

            {/* 12-Month Table with Bank Interest Breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 rounded-l-xl">{language === 'km' ? 'ខែ' : 'Month'}</th>
                    <th className="py-3 px-3 text-right">{language === 'km' ? 'ដើមគ្រា' : 'Opening'}</th>
                    <th className="py-3 px-3 text-right">{language === 'km' ? 'ទិញ' : 'Purchases'}</th>
                    <th className="py-3 px-3 text-right">{language === 'km' ? 'លក់' : 'Sales'}</th>
                    <th className="py-3 px-3 text-right">{language === 'km' ? 'ចុងគ្រា' : 'Closing'}</th>
                    <th className="py-3 px-3 text-right text-blue-300">{language === 'km' ? 'ទិញគោ (៛)' : 'Cattle Buy (៛)'}</th>
                    <th className="py-3 px-3 text-right text-amber-300">{language === 'km' ? 'ចំណាយចំណី (៛)' : 'Feed Cost (៛)'}</th>
                    <th className="py-3 px-3 text-right text-purple-300">{language === 'km' ? `ការប្រាក់ (${params.bankInterestRateAnnual}%)` : 'Bank Interest (៛)'}</th>
                    <th className="py-3 px-3 text-right text-rose-300">{language === 'km' ? 'ចំណាយសរុប (៛)' : 'Total Cost (៛)'}</th>
                    <th className="py-3 px-3 text-right text-emerald-300">{language === 'km' ? 'ចំណូលលក់ (៛)' : 'Revenue (៛)'}</th>
                    <th className="py-3 px-3 text-right rounded-r-xl">{language === 'km' ? 'ចំណេញ/ខាត (៛)' : 'Net Profit (៛)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {calculations.monthlyProjections.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-black text-slate-900 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full inline-block ${row.salesQty > 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        {language === 'km' ? row.monthKh : row.month}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{formatNumberWithCommas(row.openingStock)} head</td>
                      <td className="py-3 px-3 text-right text-blue-600 font-bold">
                        +{formatNumberWithCommas(row.purchaseQty)} head
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-600">
                        {row.salesQty > 0 ? `-${formatNumberWithCommas(row.salesQty)} head` : '0 head'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-700 bg-emerald-50/40">{formatNumberWithCommas(row.closingStock)} head</td>
                      <td className="py-3 px-3 text-right font-semibold text-blue-700">{fmtKhr(row.purchaseCostKhr)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-amber-700">{fmtKhr(row.holdingCostKhr)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-purple-700">{fmtKhr(row.bankInterestMonthKhr)}</td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600 bg-rose-50/30">{fmtKhr(row.totalCostKhr)}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">{fmtKhr(row.revenueKhr)}</td>
                      <td className={`py-3 px-3 text-right font-black ${row.netProfitKhr >= 0 ? 'text-emerald-700 bg-emerald-100/30' : 'text-slate-500 bg-slate-100/40'}`}>
                        {fmtKhr(row.netProfitKhr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 text-xs border-t-2 border-slate-300">
                    <td className="py-3.5 px-3">{language === 'km' ? 'សរុប ១២ ខែ (Annual Summary)' : 'Annual Total'}</td>
                    <td className="py-3.5 px-3 text-right">0 → {calculations.monthlyProjections[11].closingStock} head</td>
                    <td className="py-3.5 px-3 text-right text-blue-700">
                      +{formatNumberWithCommas(calculations.monthlyProjections.reduce((sum, r) => sum + r.purchaseQty, 0))} head
                    </td>
                    <td className="py-3.5 px-3 text-right text-amber-700">
                      -{formatNumberWithCommas(calculations.monthlyProjections.reduce((sum, r) => sum + r.salesQty, 0))} head
                    </td>
                    <td className="py-3.5 px-3 text-right text-emerald-800 font-black">{calculations.monthlyProjections[11].closingStock} head</td>
                    <td className="py-3.5 px-3 text-right text-blue-800 font-bold">
                      {fmtKhr(calculations.monthlyProjections.reduce((sum, r) => sum + r.purchaseCostKhr, 0))}
                    </td>
                    <td className="py-3.5 px-3 text-right text-amber-800 font-bold">
                      {fmtKhr(calculations.monthlyProjections.reduce((sum, r) => sum + r.holdingCostKhr, 0))}
                    </td>
                    <td className="py-3.5 px-3 text-right text-purple-800 font-bold">
                      {fmtKhr(calculations.monthlyProjections.reduce((sum, r) => sum + r.bankInterestMonthKhr, 0))}
                    </td>
                    <td className="py-3.5 px-3 text-right text-rose-700 font-black">
                      {fmtKhr(calculations.monthlyProjections.reduce((sum, r) => sum + r.totalCostKhr, 0))}
                    </td>
                    <td className="py-3.5 px-3 text-right text-emerald-700 font-black">
                      {fmtKhr(calculations.monthlyProjections.reduce((sum, r) => sum + r.revenueKhr, 0))}
                    </td>
                    <td className="py-3.5 px-3 text-right text-emerald-800 text-xs font-black bg-emerald-100/50">
                      {fmtKhr(calculations.monthlyProjections.reduce((sum, r) => sum + r.netProfitKhr, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ─── TAB 3: PURCHASING & SELLING PLAN ─── */}
      {activeSubTab === 'purchasing_selling' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Purchasing Plan Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Beef className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {language === 'km' ? '១. ផែនការទិញគោតាម គីឡូ (Purchasing Plan per KG)' : '1. Cattle Purchasing Plan (Per KG)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'km' ? `ទិញ +${calculations.monthlyBatchQty}ក្បាល/ខែ (M1–M${calculations.fatteningMonths}) និង ទិញជំនួស +${calculations.monthlyBatchQty}ក្បាល/ខែ (M${calculations.fatteningMonths}+) (@${params.initialWeightKg}kg, @${formatNumberWithCommas(params.purchasePricePerKgKhr)}៛/kg)` : `Monthly purchases of ${calculations.monthlyBatchQty} cattle @ ${params.initialWeightKg}kg entry weight`}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'ទម្ងន់ទិញចូលដើមគ្រា (Entry Weight):' : 'Initial Entry Weight:'}</span>
                  <span className="font-black text-slate-900 text-sm">{params.initialWeightKg} kg / ក្បាល</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'តម្លៃទិញចូលក្នុង១គីឡូ (Buying Price/KG):' : 'Buying Price / KG:'}</span>
                  <span className="font-black text-blue-600 text-sm">@{formatNumberWithCommas(params.purchasePricePerKgKhr)} ៛/kg</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'តម្លៃទិញចូលគណនាក្នុង១ក្បាល:' : 'Calculated Cost / Head:'}</span>
                  <span className="font-black text-slate-900 text-sm">{fmtKhr(calculations.purchasePricePerHeadKhr)}</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? `ថវិកាទិញប្រចាំខែ (${calculations.monthlyBatchQty}ក្បាល):` : `Monthly Purchase Cost (${calculations.monthlyBatchQty} Head):`}</span>
                  <span className="font-black text-blue-700 text-sm">{fmtKhr(calculations.monthlyReplacementPurchaseKhr)}</span>
                </div>

                <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-200 flex justify-between items-center font-bold">
                  <span className="text-blue-900">{language === 'km' ? 'ទុនទិញគោសរុបប្រចាំឆ្នាំ (១២ ខែ):' : 'Annual Cattle Purchase Budget:'}</span>
                  <span className="text-blue-700 text-sm">{fmtKhr(calculations.annualCattlePurchasesKhr)}</span>
                </div>
              </div>
            </div>

            {/* Selling Plan Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {language === 'km' ? '២. ផែនការលក់គោតាម គីឡូ (Selling Plan per KG)' : '2. Cattle Sales Plan (Per KG)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'km' ? `លក់ចេញ -${calculations.monthlyBatchQty}ក្បាល/ខែ (ចាប់ពី M${calculations.fatteningMonths}) (@${calculations.finalWeightKgPerHead}kg, @${formatNumberWithCommas(params.sellingPricePerKgKhr)}៛/kg)` : `Monthly sales target @ ${calculations.finalWeightKgPerHead}kg final weight (Starts M${calculations.fatteningMonths})`}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'ទម្ងន់លក់ចេញចុងក្រោយ (Final Sale Weight):' : 'Final Fattened Weight:'}</span>
                  <span className="font-black text-emerald-700 text-sm">{calculations.finalWeightKgPerHead} kg / ក្បាល</span>
                </div>

                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'តម្លៃលក់ចេញក្នុង១គីឡូ (Selling Price/KG):' : 'Selling Price / KG:'}</span>
                  <span className="font-black text-emerald-700 text-sm">@{formatNumberWithCommas(params.sellingPricePerKgKhr)} ៛/kg</span>
                </div>

                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'តម្លៃលក់ចេញគណនាក្នុង១ក្បាល:' : 'Calculated Revenue / Head:'}</span>
                  <span className="font-black text-emerald-700 text-sm">{fmtKhr(calculations.sellingPricePerHeadKhr)}</span>
                </div>

                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? `ចំណូលលក់ប្រចាំខែ (${calculations.monthlyBatchQty}ក្បាល ពី M${calculations.fatteningMonths}):` : `Monthly Revenue (${calculations.monthlyBatchQty} Head, from M${calculations.fatteningMonths}):`}</span>
                  <span className="font-black text-emerald-800 text-sm">{fmtKhr(calculations.monthlySalesRevenueKhr)}</span>
                </div>

                <div className="bg-emerald-100/60 p-3.5 rounded-2xl border border-emerald-300 flex justify-between items-center font-bold">
                  <span className="text-emerald-900">{language === 'km' ? 'ចំណូលលក់សរុបប្រចាំឆ្នាំ (១២ ខែ):' : 'Annual Sales Revenue Target:'}</span>
                  <span className="text-emerald-800 text-sm">{fmtKhr(calculations.annualSalesRevenueKhr)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── TAB 4: BATCH STRUCTURE PLAN ─── */}
      {activeSubTab === 'batches' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Layers className="h-5 w-5 text-emerald-600" />
                  {language === 'km' ? 'រចនាសម្ព័ន្ធផែនការបាច់ទាំង ១០ ក្រុម (Batch 1–10 Structure Plan)' : '10 Batches Operational Structure Plan'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'km'
                    ? `គ្រប់គ្រង ${params.cattlePerBatch}ក្បាល/ក្រុម ជាមួយនឹងកាលវិភាគបំប៉ន ${params.fatteningPeriodDays} ថ្ងៃ (${calculations.fatteningMonths} ខែ) និង ប៉ាន់ប្រមាណចំណេញក្នុង១ក្រុម`
                    : `Structure for 10 batches (${params.cattlePerBatch} head each, ${params.fatteningPeriodDays}-day fattening period, staged purchase & sale dates)`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {calculations.batchPlans.map((batch) => (
                <div key={batch.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                    <span className="font-black text-slate-900 text-xs">{batch.name}</span>
                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full">
                      {batch.cattleCount} head
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-bold">{batch.fatteningDays} days ({calculations.fatteningMonths} mo)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bank Interest:</span>
                      <span className="font-bold text-amber-700">{fmtKhr(batch.bankInterestCostKhr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Cost:</span>
                      <span className="font-bold text-rose-600">{fmtKhr(batch.totalCostKhr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Revenue:</span>
                      <span className="font-bold text-emerald-600">{fmtKhr(batch.totalRevenueKhr)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Net Profit:</span>
                    <span className="font-black text-emerald-700">{fmtKhr(batch.netProfitKhr)}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ─── TAB 5: FEED PLAN & RATION CALCULATOR ─── */}
      {activeSubTab === 'feed_plan' && (
        <div className="space-y-6">
          
          {/* Detailed Grass & Concentrate Calculators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Grass Feed Plan */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                    <Wheat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {language === 'km' ? '១. ផែនការចំណីស្មៅ (Grass Feed Plan)' : '1. Grass Feed Calculation'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {params.grassKgPerHeadDay} kg / ក្បាល / ថ្ងៃ (@{formatNumberWithCommas(params.grassCostPerKgKhr)} ៛/kg)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? `តម្រូវការស្មៅ/ថ្ងៃ (${params.targetStockLevel}ក្បាល):` : 'Daily Grass Requirement:'}</span>
                  <span className="font-black text-slate-900 text-sm">{format2DecimalsWithCommas(calculations.dailyGrassKgTotal)} kg</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'ចំណាយស្មៅសរុប/ថ្ងៃ:' : 'Daily Grass Cost:'}</span>
                  <span className="font-black text-green-600 text-sm">{fmtKhr(calculations.dailyGrassCostKhr)}</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'តម្រូវការស្មៅ/ខែ (៣០ថ្ងៃ):' : 'Monthly Grass Requirement:'}</span>
                  <span className="font-black text-slate-900 text-sm">{format2DecimalsWithCommas(calculations.monthlyGrassKgTotal)} kg</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'ចំណាយស្មៅសរុប/ខែ (៣០ថ្ងៃ):' : 'Monthly Grass Cost (30 Days):'}</span>
                  <span className="font-black text-green-700 text-sm">{fmtKhr(calculations.monthlyGrassCostKhr)}</span>
                </div>

                <div className="bg-green-50 p-3.5 rounded-2xl border border-green-200 flex justify-between items-center font-bold">
                  <span className="text-green-900">{language === 'km' ? 'ចំណាយស្មៅសរុប/ឆ្នាំ (១២ខែ):' : 'Annual Grass Cost (12 Mo):'}</span>
                  <span className="text-green-800 text-sm">{fmtKhr(calculations.annualGrassCostKhr)}</span>
                </div>
              </div>
            </div>

            {/* 2. Cattle Concentrate Feed Plan */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {language === 'km' ? '២. ផែនការចំណីសមាស (Concentrate Feed Plan)' : '2. Concentrate Feed Calculation'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {params.concentrateKgPerHeadDay} kg / ក្បាល / ថ្ងៃ (@{formatNumberWithCommas(params.concentrateCostPerKgKhr)} ៛/kg)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? `តម្រូវការចំណីសមាស/ថ្ងៃ (${params.targetStockLevel}ក្បាល):` : 'Daily Concentrate Req:'}</span>
                  <span className="font-black text-slate-900 text-sm">{format2DecimalsWithCommas(calculations.dailyConcentrateKgTotal)} kg</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'ចំណាយចំណីសមាសសរុប/ថ្ងៃ:' : 'Daily Concentrate Cost:'}</span>
                  <span className="font-black text-purple-600 text-sm">{fmtKhr(calculations.dailyConcentrateCostKhr)}</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'តម្រូវការចំណីសមាស/ខែ (៣០ថ្ងៃ):' : 'Monthly Concentrate Req:'}</span>
                  <span className="font-black text-slate-900 text-sm">{format2DecimalsWithCommas(calculations.monthlyConcentrateKgTotal)} kg</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex justify-between items-center">
                  <span className="font-bold text-slate-700">{language === 'km' ? 'ចំណាយចំណីសមាសសរុប/ខែ (៣០ថ្ងៃ):' : 'Monthly Concentrate Cost (30 Days):'}</span>
                  <span className="font-black text-purple-700 text-sm">{fmtKhr(calculations.monthlyConcentrateCostKhr)}</span>
                </div>

                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 flex justify-between items-center font-bold">
                  <span className="text-purple-900">{language === 'km' ? 'ចំណាយចំណីសមាសសរុប/ឆ្នាំ (១២ខែ):' : 'Annual Concentrate Cost (12 Mo):'}</span>
                  <span className="text-purple-800 text-sm">{fmtKhr(calculations.annualConcentrateCostKhr)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Interactive Multi-Period Feed Calculator Box */}
          <div className="bg-white p-6 rounded-3xl border border-emerald-200 shadow-md space-y-4 bg-gradient-to-br from-emerald-50/30 to-teal-50/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  {language === 'km' ? 'ឧបករណ៍គណនាចំណីតាមរយៈពេល (Multi-Period Feed Calculator)' : 'Interactive Feed Demand Calculator'}
                </h3>
              </div>
              <span className="text-xs text-emerald-700 font-bold">
                {language === 'km' ? 'គណនាតាមចំនួនថ្ងៃ និង ចំនួនក្បាលដែលជ្រើសរើស' : 'Calculate feed requirements for custom days & cattle counts'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'km' ? 'ជ្រើសរើសចំនួនក្បាលគោ (Number of Cattle):' : 'Select Cattle Head Count:'}
                </label>
                <input
                  type="text"
                  value={formatNumberWithCommas(selectedFeedHeadCount)}
                  onChange={(e) => setSelectedFeedHeadCount(parseNumberFromCommas(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'km' ? 'ជ្រើសរើសចំនួនថ្ងៃ (Number of Days):' : 'Select Period Duration (Days):'}
                </label>
                <div className="flex gap-2">
                  {[
                    { label: '1d (ថ្ងៃ)', days: 1 },
                    { label: '7d (សប្តាហ៍)', days: 7 },
                    { label: '30d (ខែ)', days: 30 },
                    { label: `${params.fatteningPeriodDays}d (ជុំបំប៉ន)`, days: params.fatteningPeriodDays },
                    { label: '365d (ឆ្នាំ)', days: 365 }
                  ].map((btn) => (
                    <button
                      key={btn.days}
                      onClick={() => setSelectedFeedPeriodDays(btn.days)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        selectedFeedPeriodDays === btn.days
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{language === 'km' ? 'តម្រូវការស្មៅ' : 'Grass Demand'}</p>
                <p className="text-lg font-black text-green-700 mt-1">{format2DecimalsWithCommas(periodFeedCalc.grassKg)} kg</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{fmtKhr(periodFeedCalc.grassCostKhr)}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{language === 'km' ? 'តម្រូវការចំណីសមាស' : 'Concentrate Demand'}</p>
                <p className="text-lg font-black text-purple-700 mt-1">{format2DecimalsWithCommas(periodFeedCalc.concentrateKg)} kg</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{fmtKhr(periodFeedCalc.concentrateCostKhr)}</p>
              </div>

              <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md">
                <p className="text-[10px] font-bold text-emerald-200 uppercase">{language === 'km' ? 'ចំណាយចំណីសរុប (៛)' : 'Total Combined Feed Cost (KHR)'}</p>
                <p className="text-xl font-black text-white mt-1">{fmtKhr(periodFeedCalc.totalCostKhr)}</p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ─── TAB 6: FINANCIAL PLANNING & PROFITABILITY (WITH BANK INTEREST & ANNUAL MARGIN %) ─── */}
      {activeSubTab === 'financials' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-600" />
                {language === 'km' ? 'របាយការណ៍ហិរញ្ញវត្ថុ, ការប្រាក់ធនាគារ & អត្រាចំណេញប្រចាំឆ្នាំ (%)' : 'Projected Financial Statement & Annual Margin Economics (%)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'km'
                  ? `ការវិភាគលម្អិតនៃចំណូល និង ចំណាយប្រចាំខែ និង ប្រចាំឆ្នាំ (១២ ខែ) រួមបញ្ចូលការប្រាក់ធនាគារ (${params.bankInterestRateAnnual}%/ឆ្នាំ) និង អត្រាចំណេញប្រចាំឆ្នាំ (${calculations.annualNetMarginPercent.toFixed(1)}%/ឆ្នាំ)`
                  : 'Comprehensive monthly and annual financial economics, feed, bank interest, net profit, and annual margin % in KHR'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              
              {/* Left Column: Monthly Financial P&L Statement in KHR */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-black text-slate-900 text-sm border-b border-slate-200 pb-2">
                  {language === 'km' ? `១. របាយការណ៍ប្រចាំខែថេរ (Monthly Steady-State P&L, M${calculations.fatteningMonths}+)` : `Monthly Steady-State P&L (M${calculations.fatteningMonths}+)`}
                </h4>

                <div className="flex justify-between py-1.5 border-b border-slate-200/60 font-semibold">
                  <span className="text-slate-600">ចំណូលលក់ (${calculations.monthlyBatchQty}ក្បាល × {calculations.finalWeightKgPerHead}kg × @{formatNumberWithCommas(params.sellingPricePerKgKhr)}៛):</span>
                  <span className="font-black text-emerald-600 text-sm">{fmtKhr(calculations.monthlySalesRevenueKhr)}</span>
                </div>

                <div className="flex justify-between py-1.5 text-slate-600">
                  <span>(-) ចំណាយទិញគោជំនួស (${calculations.monthlyBatchQty}ក្បាល × {params.initialWeightKg}kg × @{formatNumberWithCommas(params.purchasePricePerKgKhr)}៛):</span>
                  <span className="font-bold text-rose-600">-{fmtKhr(calculations.monthlyReplacementPurchaseKhr)}</span>
                </div>

                <div className="flex justify-between py-1.5 text-slate-600">
                  <span>(-) ចំណាយស្មៅប្រចាំខែ (${params.targetStockLevel}ក្បាល × {params.grassKgPerHeadDay}kg × @{formatNumberWithCommas(params.grassCostPerKgKhr)}៛ × 30ថ្ងៃ):</span>
                  <span className="font-bold text-rose-600">-{fmtKhr(calculations.monthlyGrassCostKhr)}</span>
                </div>

                <div className="flex justify-between py-1.5 text-slate-600">
                  <span>(-) ចំណាយចំណីសមាសប្រចាំខែ (${params.targetStockLevel}ក្បាល × {params.concentrateKgPerHeadDay}kg × @{formatNumberWithCommas(params.concentrateCostPerKgKhr)}៛ × 30ថ្ងៃ):</span>
                  <span className="font-bold text-rose-600">-{fmtKhr(calculations.monthlyConcentrateCostKhr)}</span>
                </div>

                <div className="flex justify-between py-1.5 text-amber-900 bg-amber-100/50 px-2 rounded-lg font-bold">
                  <span>(-) ការប្រាក់ធនាគារ (ទុន {fmtKhr(calculations.initialCattlePurchaseKhr)} @ {params.bankInterestRateAnnual}%/ឆ្នាំ):</span>
                  <span className="font-black text-amber-700">-{fmtKhr(calculations.monthlyBankInterestKhr)}</span>
                </div>

                <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm pt-3">
                  <span className="text-slate-900">{language === 'km' ? `ចំណេញសុទ្ធប្រចាំខែថេរ (Net Profit M${calculations.fatteningMonths}+):` : `Monthly Net Profit After Interest (M${calculations.fatteningMonths}+):`}</span>
                  <span className="text-emerald-700">{fmtKhr(calculations.monthlyGrossProfitKhr)}</span>
                </div>
              </div>

              {/* Right Column: Annual Financial Statement (១ ឆ្នាំ / 12 Months) with Annual Margin % */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg space-y-3">
                <h4 className="font-black text-emerald-300 text-sm border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>{language === 'km' ? '២. របាយការណ៍សរុបប្រចាំឆ្នាំ (Annual P&L Summary - 1 Year)' : 'Annual P&L Summary (12 Months)'}</span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">12 Months</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-300">ចំណូលលក់សរុបប្រចាំឆ្នាំ (Annual Revenue):</span>
                    <span className="font-black text-emerald-400">{fmtKhr(calculations.annualSalesRevenueKhr)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-300">(-) ចំណាយទិញគោជំនួសសរុបប្រចាំឆ្នាំ:</span>
                    <span className="font-bold text-rose-400">-{fmtKhr(calculations.annualCattlePurchasesKhr)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-300">(-) ចំណាយស្មៅសរុបប្រចាំឆ្នាំ (១២ ខែ × ៣០ ថ្ងៃ):</span>
                    <span className="font-bold text-rose-400">-{fmtKhr(calculations.annualGrassCostKhr)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-300">(-) ចំណាយចំណីសមាសសរុបប្រចាំឆ្នាំ (១២ ខែ × ៣០ ថ្ងៃ):</span>
                    <span className="font-bold text-rose-400">-{fmtKhr(calculations.annualConcentrateCostKhr)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800 text-amber-300 font-medium">
                    <span>(-) ការប្រាក់ធនាគារសរុបប្រចាំឆ្នាំ ({params.bankInterestRateAnnual}%/ឆ្នាំ):</span>
                    <span className="font-bold text-amber-300">-{fmtKhr(calculations.annualBankInterestKhr)}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-t border-slate-700 text-rose-300 font-black">
                    <span>{language === 'km' ? 'ចំណាយសរុបប្រចាំឆ្នាំ (Total Operating Cost):' : 'Total Annual Cost:'}</span>
                    <span>-{fmtKhr(calculations.annualTotalFarmCostKhr)}</span>
                  </div>

                  <div className="flex justify-between py-2 border-t-2 border-emerald-500 font-black text-base pt-2">
                    <span className="text-white">{language === 'km' ? 'ចំណេញសុទ្ធប្រចាំឆ្នាំ (Annual Net Profit):' : 'Annual Net Profit:'}</span>
                    <span className="text-emerald-400">{fmtKhr(calculations.annualNetProfitKhr)}</span>
                  </div>

                  {/* Highlights: Annual Net Margin % & Annual ROI % */}
                  <div className="bg-emerald-950/90 p-3 rounded-xl border border-emerald-700/80 space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-emerald-200">{language === 'km' ? 'អត្រាចំណេញសុទ្ធប្រចាំឆ្នាំ (Annual Net Profit Margin %):' : 'Annual Net Profit Margin (%):'}</span>
                      <span className="font-black text-emerald-300 text-sm">{calculations.annualNetMarginPercent.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-teal-200">{language === 'km' ? 'អត្រាផលត្រឡប់លើទុនទិញគោ (Annual ROI %):' : 'Annual Return on Cattle Capital (ROI %):'}</span>
                      <span className="font-black text-teal-300 text-sm">{calculations.annualRoiPercent.toFixed(1)}%</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
