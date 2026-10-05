'use client';

import React from 'react';
import { ERPLivestockData } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Activity, ShieldAlert, Calendar, DollarSign, Scale, Beef, TrendingUp, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import type { ActiveTabType } from './layout/SidebarLayout';

interface DashboardHomeProps {
  data: ERPLivestockData;
  onNavigateToTab: (tab: ActiveTabType) => void;
}

export default function DashboardHome({ data, onNavigateToTab }: DashboardHomeProps) {
  const activeCows = data.stock.filter(c => c.status.toLowerCase() === 'active');
  const soldCows = data.stock.filter(c => c.status.toLowerCase() === 'sold');
  const healthyCount = activeCows.filter(c => c.healthStatus.toLowerCase() === 'good').length;
  const sickCows = activeCows.filter(c => c.healthStatus.toLowerCase() === 'poor' || c.healthStatus.toLowerCase() === 'fair');

  // Active fattening batches
  const activeBatches = data.batches.filter(b => b.status === 'Active');

  // Selling Prep Alerts — active batches whose Selling Target Date (set at
  // batch creation, auto-calculated as Start Date + 90 days) is within the
  // next 10 days, so admins get advance notice to prepare for the sale.
  // Overdue targets (negative days remaining) are included too, flagged
  // distinctly, since a missed target date needs attention just as much.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sellingPrepAlerts = activeBatches
    .filter(b => !!b.sellingTargetDate)
    .map(b => {
      const target = new Date(b.sellingTargetDate as string);
      const daysRemaining = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...b, daysRemaining };
    })
    .filter(b => b.daysRemaining <= 10)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  // Total revenue from fattening sales
  const totalRevenue = data.salesTracking.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
  const totalAcquisitionCost = data.stock.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
  const netProfit = totalRevenue - totalAcquisitionCost;

  // Average weight gain across active cattle
  const recentWeights = data.weightTracking.slice(-30);
  const avgGain = recentWeights.length > 0
    ? recentWeights.reduce((sum, w) => sum + (w.gainLoss || 0), 0) / recentWeights.length
    : 0;

  // Weight growth chart — group by date bucket
  const growthByDate: Record<string, number[]> = {};
  data.weightTracking.slice(-30).forEach(w => {
    const day = w.trackingDate ? new Date(w.trackingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
    if (!growthByDate[day]) growthByDate[day] = [];
    growthByDate[day].push(w.gainLoss || 0);
  });
  const growthChartData = Object.entries(growthByDate).slice(-10).map(([date, gains]) => ({
    date,
    avgGain: parseFloat((gains.reduce((s, g) => s + g, 0) / gains.length).toFixed(2))
  }));

  // Sales revenue per month (last 5 months)
  const revenueByMonth: Record<string, number> = {};
  data.salesTracking.forEach(s => {
    const month = s.salesDate ? new Date(s.salesDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : 'N/A';
    revenueByMonth[month] = (revenueByMonth[month] || 0) + (s.totalPrice || 0);
  });
  const revenueChartData = Object.entries(revenueByMonth).slice(-6).map(([month, revenue]) => ({
    month,
    revenue: Math.round(revenue / 1000)
  }));

  // Recent intake / acquisition
  const recentCows = [...data.stock]
    .sort((a, b) => new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime())
    .slice(0, 5);

  // Recent sales
  const recentSales = [...data.salesTracking]
    .sort((a, b) => new Date(b.salesDate || 0).getTime() - new Date(a.salesDate || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">

      {/* KPI Summary Grid (3 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">

        {/* Active Fattening Herd */}
        <Card className="bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigateToTab('cow-inventory')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Beef className="h-3.5 w-3.5 text-emerald-600" /> Active Fattening Herd
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900 mt-1">{activeCows.length} Head</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-600 font-bold">Total Intake: {data.stock.length} • Sold: {soldCows.length}</p>
          </CardContent>
        </Card>

        {/* Active Batches */}
        <Card className="bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigateToTab('batch-management')}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-teal-600" /> Fattening Batches
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900 mt-1">{activeBatches.length} Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-teal-600 font-bold">Total batches: {data.batches.length}</p>
          </CardContent>
        </Card>

        {/* Medical Alerts */}
        <Card
          className={`border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${sickCows.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}
          onClick={() => sickCows.length > 0 && onNavigateToTab('health-tracking')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Health Alerts
            </CardDescription>
            <CardTitle className={`text-2xl font-bold mt-1 ${sickCows.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {sickCows.length} Sick
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sickCows.length > 0 ? (
              <button onClick={() => onNavigateToTab('health-tracking')} className="text-xs text-rose-500 hover:underline font-bold animate-pulse flex items-center gap-1">
                View Alerts <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <p className="text-xs text-slate-400 font-bold">Herd healthy. No active alerts.</p>
            )}
          </CardContent>
        </Card>

        {/* Selling Prep Alerts */}
        <Card
          className={`border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${sellingPrepAlerts.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}
          onClick={() => sellingPrepAlerts.length > 0 && onNavigateToTab('batch-management')}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-500" /> Selling Prep Alerts
            </CardDescription>
            <CardTitle className={`text-2xl font-bold mt-1 ${sellingPrepAlerts.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {sellingPrepAlerts.length} Batch{sellingPrepAlerts.length === 1 ? '' : 'es'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellingPrepAlerts.length > 0 ? (
              <button onClick={() => onNavigateToTab('batch-management')} className="text-xs text-amber-600 hover:underline font-bold animate-pulse flex items-center gap-1">
                Prepare Now <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <p className="text-xs text-slate-400 font-bold">No batches nearing target date.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selling Prep Alerts — Detail List */}
      {sellingPrepAlerts.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-100 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              Selling Prep Alerts — Target Date Within 10 Days
            </h4>
            <button onClick={() => onNavigateToTab('batch-management')} className="text-xs text-amber-700 hover:underline font-bold flex items-center gap-1">
              Go to Batches <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-amber-100">
            {sellingPrepAlerts.map(b => (
              <div key={b.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {b.name} <span className="text-slate-400 font-mono font-normal">({b.id})</span>
                  </p>
                  <p className="text-xs text-slate-500 font-semibold">{b.farmLocation || 'Unassigned'} • {b.cowIds?.length || 0} head</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${b.daysRemaining < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {b.daysRemaining < 0 ? `Overdue ${Math.abs(b.daysRemaining)}d` : b.daysRemaining === 0 ? 'Due today' : `${b.daysRemaining}d left`}
                  </p>
                  <p className="text-xs text-slate-400">{b.sellingTargetDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue & Profit Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold opacity-70">Total Sales Revenue</p>
          <p className="text-2xl font-bold mt-1">៛ {totalRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-60 mt-1">From {soldCows.length} fattened cattle sold</p>
        </div>
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-slate-400">Cattle Acquisition Cost</p>
          <p className="text-2xl font-bold mt-1 text-rose-500">៛ {totalAcquisitionCost.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Purchase cost of all cattle</p>
        </div>
        <div className={`p-5 rounded-2xl shadow-sm border ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <p className="text-xs font-bold text-slate-400">Net Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {netProfit >= 0 ? '+' : ''}៛ {netProfit.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">Sales revenue minus acquisition cost</p>
        </div>
      </div>

      {/* Monthly Sales Revenue Chart */}
      <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Monthly Sales Revenue (Thousands ៛)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">Revenue generated from fattened cattle sold per month</p>
        </div>
        <div className="h-[240px]">
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '10px', fontSize: '11px' }}
                  itemStyle={{ color: '#059669', fontWeight: 'bold' }}
                  formatter={v => [`${v}K ៛`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} name="Revenue (K ៛)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
              No sales data available yet.
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Recent Intake & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Recently Acquired Cattle */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-800 ">Recently Acquired Cattle</h4>
            <button onClick={() => onNavigateToTab('cow-inventory')} className="text-xs text-emerald-600 hover:underline font-bold flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentCows.length > 0 ? recentCows.map((c, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100">
                    {c.id.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{c.id}</p>
                    <p className="text-xs text-slate-400 font-semibold">{c.breed} • {c.sex} • {c.weight ?? '—'} kg</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-800">៛ {c.totalPrice.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{c.purchaseDate ? new Date(c.purchaseDate).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-slate-400 text-center py-8 font-semibold">No cattle acquired yet.</p>
            )}
          </div>
        </div>

        {/* Right: Recent Fattening Sales */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-800 ">Recent Fattening Sales</h4>
            <button onClick={() => onNavigateToTab('sales-finance')} className="text-xs text-emerald-600 hover:underline font-bold flex items-center gap-1">
              View Ledger <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentSales.length > 0 ? recentSales.map((s, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs border border-amber-100">
                    {s.cowId.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{s.cowId}</p>
                    <p className="text-xs text-slate-400 font-semibold">{s.breed} • {s.weight} kg sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600">+៛ {s.totalPrice.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{s.salesDate ? new Date(s.salesDate).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-slate-400 text-center py-8 font-semibold">No sales finalized yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
