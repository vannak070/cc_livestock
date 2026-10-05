'use client';

import React, { useState } from 'react';
import { ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Scale, TrendingUp, ClipboardList, Calendar, AlertTriangle, CheckCircle, Clock, Edit2, Trash2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { ConfirmModal } from './ui/confirm-modal';
import { hasPermission } from '@/lib/utils';
import FarmFilterBar from './FarmFilterBar';
import { exportToExcel } from '@/lib/excel-export';
import { DateRangeFilterBar } from './common/DateRangeFilterBar';
import type { WeightRecord } from '@/lib/xlsx-parser';

interface WeightTabProps {
  data: ERPLivestockData;
  onOpenLogWeight: (cowId?: string) => void;
  onDeleteWeightRecord?: (cowId: string, trackingDate: string) => Promise<void>;
  onUpdateWeightRecord?: (cowId: string, trackingDate: string, currentWeight: number, healthStatus: string) => Promise<void>;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

export default function WeightTab({ data, onOpenLogWeight, onDeleteWeightRecord, onUpdateWeightRecord, currentUser, farms = [] }: WeightTabProps) {
  const [scheduleType, setScheduleType] = useState<'biweekly' | 'monthly'>('biweekly');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  const [editingWeightRecord, setEditingWeightRecord] = useState<{ cowId: string; trackingDate: string; currentWeight: number; healthStatus: string } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm?: () => void;
    type: 'danger' | 'warning' | 'success' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: 'warning'
  });

  const intervalDays = scheduleType === 'biweekly' ? 14 : 30;

  // Count weight records per farm
  const countByFarm = React.useMemo(() => {
    const stockById: Record<string, string> = {};
    data.stock.forEach(s => { if (s.location) stockById[s.id] = s.location; });
    const map: Record<string, number> = {};
    data.weightTracking.forEach(log => {
      const loc = stockById[log.cowId];
      if (loc) map[loc] = (map[loc] || 0) + 1;
    });
    return map;
  }, [data.stock, data.weightTracking]);

  // Active cohorts list
  const cohorts = data.batches || [];
  const getCowCohort = (cowId: string) => {
    return cohorts.find(b => b.cowIds.includes(cowId));
  };

  // Date Range Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sort weight tracking logs chronologically (newest first)
  const farmFilteredWeightLogs = React.useMemo(() => {
    let list = data.weightTracking;
    if (selectedFarm) {
      const stockIds = data.stock.filter(s => s.location === selectedFarm).map(s => s.id);
      list = list.filter(log => stockIds.includes(log.cowId));
    }
    if (startDate || endDate) {
      list = list.filter(log => {
        if (!log.trackingDate) return true;
        const d = log.trackingDate.split('T')[0];
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }
    return list;
  }, [data.weightTracking, data.stock, selectedFarm, startDate, endDate]);

  const recentLogs = [...farmFilteredWeightLogs].sort((a, b) => {
    const timeA = a.trackingDate ? new Date(a.trackingDate).getTime() : 0;
    const timeB = b.trackingDate ? new Date(b.trackingDate).getTime() : 0;
    return timeB - timeA;
  });

  const filteredRecentLogs = recentLogs.filter(log => {
    if (selectedCohortId === 'all') return true;
    return getCowCohort(log.cowId)?.id === selectedCohortId;
  });

  // Calculate highest weight gains (leaderboard of gainLoss)
  const growthLeaderboard = [...data.weightTracking]
    .filter(w => w.gainLoss > 0)
    .filter(w => {
      if (selectedCohortId === 'all') return true;
      return getCowCohort(w.cowId)?.id === selectedCohortId;
    })
    .sort((a, b) => b.gainLoss - a.gainLoss)
    // unique by cowId
    .reduce<WeightRecord[]>((acc, curr) => {
      if (!acc.find(item => item.cowId === curr.cowId)) {
        acc.push(curr);
      }
      return acc;
    }, [])
    .slice(0, 5);

  // Compute weigh-in schedules for all active cows
  const activeCows = data.stock.filter(c => c.status.toLowerCase() === 'active');
  const filteredActiveCows = selectedCohortId === 'all'
    ? activeCows
    : activeCows.filter(c => getCowCohort(c.id)?.id === selectedCohortId);
  
  const weighInSchedules = filteredActiveCows.map(cow => {
    // Find the latest weight log for this cow
    const logs = data.weightTracking
      .filter(w => w.cowId === cow.id && w.trackingDate)
      .sort((a, b) => new Date(b.trackingDate!).getTime() - new Date(a.trackingDate!).getTime());

    const lastWeighDate = logs.length > 0 && logs[0].trackingDate ? new Date(logs[0].trackingDate) : null;
    let daysElapsed = 999; // Assume overdue if no logs
    
    if (lastWeighDate) {
      const diffTime = Math.abs(new Date().getTime() - lastWeighDate.getTime());
      daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    let status: 'weighed' | 'duesoon' | 'overdue' = 'overdue';
    if (daysElapsed < intervalDays - 2) {
      status = 'weighed';
    } else if (daysElapsed >= intervalDays - 2 && daysElapsed <= intervalDays) {
      status = 'duesoon';
    }

    return {
      cowId: cow.id,
      breed: cow.breed,
      currentWeight: cow.weight,
      lastWeighDate,
      daysElapsed,
      status
    };
  }).sort((a, b) => b.daysElapsed - a.daysElapsed); // Overdue first

  const overdueCount = weighInSchedules.filter(s => s.status === 'overdue').length;
  const duesoonCount = weighInSchedules.filter(s => s.status === 'duesoon').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Weight & Development Center</h3>
          <p className="text-xs text-slate-400 font-medium">Schedule checks, evaluate average daily weight gains, and check scale metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cohort Selector Dropdown */}
          <select
            value={selectedCohortId}
            onChange={e => setSelectedCohortId(e.target.value)}
            className="flex h-9 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="all">Filter: All Cattle (ទាំងអស់)</option>
            {cohorts.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>

          {/* Interval Selector Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setScheduleType('biweekly')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${scheduleType === 'biweekly' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Bi-weekly (14d)
            </button>
            <button
              onClick={() => setScheduleType('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${scheduleType === 'monthly' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Monthly (30d)
            </button>
          </div>
          {hasPermission(currentUser, 'weight_record') && (
            <Button onClick={() => onOpenLogWeight()} className="bg-emerald-600 hover:bg-emerald-500 gap-2 rounded-xl text-xs font-bold py-2.5 shadow-md shadow-emerald-500/10">
              <Scale className="h-4 w-4" /> Log Weight Record
            </Button>
          )}
        </div>
      </div>

      {/* Farm Filter Bar */}
      <FarmFilterBar
        farms={farms}
        selectedFarm={selectedFarm}
        onFarmChange={setSelectedFarm}
        countByFarm={countByFarm}
        totalCount={data.weightTracking.length}
        label="weight records"
        currentUser={currentUser}
      />

      {/* Mini Alert metrics banner */}
      {(overdueCount > 0 || duesoonCount > 0) && (
        <div className="bg-amber-50/70 border border-amber-200/60 p-3.5 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            <span>
              Scale Schedule Alerts: <span className="text-amber-700 font-black">{overdueCount} cattle overdue</span> and <span className="text-slate-800 font-black">{duesoonCount} cattle due soon</span> for weighing.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Overdue Weigh-ins List */}
        <div className="lg:col-span-1 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4 max-h-[500px] flex flex-col">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-800">Weigh-in Schedule</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cattle check-in status (Target: {intervalDays}d)</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {weighInSchedules.map((schedule) => {
              const cohort = getCowCohort(schedule.cowId);
              return (
                <div key={schedule.cowId} className="p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl transition-all flex items-center justify-between text-xs text-left">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-slate-800">Tag: {schedule.cowId}</p>
                      {cohort && (
                        <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded" title={cohort.name}>
                          {cohort.id}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-450 font-medium">{schedule.breed} • Last weighed: {schedule.lastWeighDate ? schedule.lastWeighDate.toLocaleDateString() : 'Never'}</p>
                  </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    schedule.status === 'weighed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    schedule.status === 'duesoon' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {schedule.status === 'weighed' ? 'Up to Date' : schedule.status === 'duesoon' ? 'Due Soon' : `${schedule.daysElapsed}d Overdue`}
                  </span>
                  {(schedule.status === 'overdue' || schedule.status === 'duesoon') && (
                    <button
                      onClick={() => onOpenLogWeight(schedule.cowId)}
                      className="text-[9px] font-black uppercase text-emerald-600 hover:underline"
                    >
                      Scale &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Middle Column: Growth Leaderboard */}
        <div className="lg:col-span-1 bg-white border border-slate-100 p-6 rounded-2xl space-y-4 shadow-sm h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-600" />
            <div>
              <h4 className="text-base font-bold text-slate-800">Growth Leaderboard</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top developmental gains</p>
            </div>
          </div>

          <div className="space-y-3">
            {growthLeaderboard.length > 0 ? (
              growthLeaderboard.map((w, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-400 font-mono">#{idx + 1}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Cow ID: {w.cowId}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{w.breed}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-600">+{(w.gainLoss * 100).toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{w.currentWeight} kg</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-400 py-6 font-semibold">No weight gains recorded yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Recent logs feed */}
        <div className="lg:col-span-1 bg-white border border-slate-100 p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-emerald-600" />
              <div>
                <h4 className="text-base font-bold text-slate-800">Recent Growth Logs</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chronological developmental logs</p>
              </div>
            </div>
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
                  filename: `CC_Livestock_Weight_Tracking_History_${new Date().toISOString().split('T')[0]}.xlsx`,
                  sheetName: 'Weight Tracking History',
                  data: filteredRecentLogs,
                  columns: [
                    { header: 'Cow ID', key: 'cowId' },
                    { header: 'Breed', key: 'breed' },
                    { header: 'Tracking Date', key: 'trackingDate', formatter: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
                    { header: 'Previous Weight (kg)', key: 'oldWeight' },
                    { header: 'Current Weight (kg)', key: 'currentWeight' },
                    { header: 'Weight Change (%)', key: 'gainLoss', formatter: (val) => `${val > 0 ? '+' : ''}${(val * 100).toFixed(1)}%` },
                    { header: 'Health Status', key: 'status' }
                  ]
                });
              }}
              className="h-7 text-xs gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              <Download className="h-3 w-3" /> Export Excel
            </Button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[360px] divide-y divide-slate-100 pr-1">
            {filteredRecentLogs.length > 0 ? (
              filteredRecentLogs.map((log, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors px-1 rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Cow ID: {log.cowId}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">({log.breed})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Date: {log.trackingDate ? new Date(log.trackingDate).toLocaleDateString() : 'N/A'} • Status: {log.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-sm">{log.currentWeight} kg</p>
                      <p className="text-[10px] text-slate-400 font-mono font-semibold">Old: {log.oldWeight} kg</p>
                    </div>
                    <div className="w-16 text-right">
                      {log.gainLoss !== 0 ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          log.gainLoss > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {log.gainLoss > 0 ? '+' : ''}{(log.gainLoss * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-400">
                          0.0%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasPermission(currentUser, 'weight_record') && (
                        <button
                          onClick={() => {
                            setEditingWeightRecord({
                              cowId: log.cowId,
                              trackingDate: log.trackingDate || '',
                              currentWeight: log.currentWeight,
                              healthStatus: log.healthStatus
                            });
                          }}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Edit Weight Record"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDeleteWeightRecord && hasPermission(currentUser, 'weight_delete') && (
                        <button
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Delete Weight Record',
                              description: `Are you sure you want to permanently delete the weight log for Cow "${log.cowId}" on ${log.trackingDate ? new Date(log.trackingDate).toLocaleDateString() : 'N/A'}? The cow's current weight in active inventory will revert to the previous entry.`,
                              type: 'danger',
                              confirmText: 'Delete Record',
                              onConfirm: async () => {
                                await onDeleteWeightRecord(log.cowId, log.trackingDate || '');
                              }
                            });
                          }}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Delete Weight Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-400 py-8 font-semibold">No growth records captured.</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Weight Dialog */}
      {editingWeightRecord && (
        <Dialog open={!!editingWeightRecord} onOpenChange={(open) => !open && setEditingWeightRecord(null)}>
          <DialogContent className="max-w-md bg-white border border-slate-100 text-slate-800 rounded-2xl shadow-xl p-6">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-bold text-slate-800">Edit Weight Record</DialogTitle>
              <DialogDescription className="text-xs text-slate-405 font-mono mt-0.5">
                Cow ID: {editingWeightRecord.cowId} • Date: {new Date(editingWeightRecord.trackingDate).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (onUpdateWeightRecord) {
                await onUpdateWeightRecord(
                  editingWeightRecord.cowId,
                  editingWeightRecord.trackingDate,
                  editingWeightRecord.currentWeight,
                  editingWeightRecord.healthStatus
                );
              }
              setEditingWeightRecord(null);
            }} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="ew_weight" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Current Weight (kg)</Label>
                <Input
                  id="ew_weight"
                  type="number"
                  required
                  value={editingWeightRecord.currentWeight}
                  onChange={e => setEditingWeightRecord(prev => prev ? { ...prev, currentWeight: Number(e.target.value) } : null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ew_health" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Health Status</Label>
                <select
                  id="ew_health"
                  value={editingWeightRecord.healthStatus}
                  onChange={e => setEditingWeightRecord(prev => prev ? { ...prev, healthStatus: e.target.value } : null)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 focus:outline-none"
                >
                  {data.settings.healthStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingWeightRecord(null)} className="rounded-xl font-bold py-2">Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold py-2 text-white">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {confirmModal.isOpen && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          description={confirmModal.description}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
        />
      )}
    </div>
  );
}
