'use client';

import React, { useState } from 'react';
import { ERPLivestockData, HealthLogItem, FarmItem, UserRoleItem } from '@/lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { ShieldCheck, Heart, User, Calendar, Activity, DollarSign, Edit2, Trash2, Download } from 'lucide-react';
import { ConfirmModal } from './ui/confirm-modal';
import { hasPermission, format2DecimalsWithCommas } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import FarmFilterBar from './FarmFilterBar';
import { TablePagination } from './common/TablePagination';
import { exportToExcel } from '@/lib/excel-export';
import { DateRangeFilterBar } from './common/DateRangeFilterBar';
import { useOnChange } from '@/hooks/useOnChange';

interface HealthTabProps {
  data: ERPLivestockData;
  onAddHealthLog: (log: Omit<HealthLogItem, 'id'>) => Promise<void>;
  onDeleteHealthLog?: (logId: string) => Promise<void>;
  onUpdateHealthLog?: (logId: string, updates: Partial<HealthLogItem>) => Promise<void>;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

export default function HealthTab({ data, onAddHealthLog, onDeleteHealthLog, onUpdateHealthLog, currentUser, farms = [] }: HealthTabProps) {
  const { t } = useLanguage();
  const [isLogging, setIsLogging] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  // Date Range Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useOnChange(JSON.stringify([selectedCohortId, selectedFarm, startDate, endDate, pageSize]), () => setCurrentPage(1));

  const userFarmLocation = currentUser?.farmLocation;
  const activeFarm = selectedFarm || userFarmLocation;

  // Count health logs per farm
  const countByFarm = React.useMemo(() => {
    const stockById: Record<string, string> = {};
    data.stock.forEach(s => { if (s.location) stockById[s.id] = s.location; });
    const map: Record<string, number> = {};
    data.healthLogs.forEach(log => {
      const loc = stockById[log.cowId];
      if (loc) map[loc] = (map[loc] || 0) + 1;
    });
    return map;
  }, [data.stock, data.healthLogs]);

  // Filter health logs by selected farm and date range
  const farmFilteredHealthLogs = React.useMemo(() => {
    let list = data.healthLogs;
    if (activeFarm) {
      const matchesFarm = (loc?: string) => {
        if (!loc) return false;
        const l = loc.trim().toLowerCase();
        const f = activeFarm.trim().toLowerCase();
        if (l === f) return true;
        if ((f === 'រទាំង' || f.includes('snr')) && (l === 'រទាំង' || l.includes('snr'))) return true;
        return false;
      };

      const stockIds = data.stock.filter(s => matchesFarm(s.location)).map(s => s.id);
      list = list.filter(log => stockIds.includes(log.cowId));
    }

    if (startDate || endDate) {
      list = list.filter(log => {
        if (!log.date) return true;
        const d = log.date.split('T')[0];
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    return list;
  }, [data.healthLogs, data.stock, selectedFarm, userFarmLocation, startDate, endDate]);

  // Active cows scoped strictly to current farm for farm owners
  const activeCows = React.useMemo(() => {
    return data.stock.filter(c => {
      const isAct = c.status.toLowerCase() === 'active';
      if (!activeFarm) return isAct;
      const l = c.location?.trim().toLowerCase() || '';
      const f = activeFarm.trim().toLowerCase();
      const match = l === f || ((f === 'រទាំង' || f.includes('snr')) && (l === 'រទាំង' || l.includes('snr')));
      return isAct && match;
    });
  }, [data.stock, selectedFarm, userFarmLocation]);

  // Form states
  const [cowId, setCowId] = useState('');
  const [type, setType] = useState<'Vaccination' | 'Treatment' | 'Disease' | 'Deworming'>('Vaccination');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [administeredBy, setAdministeredBy] = useState('Dr. Sopheak (Vet)');
  const [cost, setCost] = useState(12000); // default cost in Riel
  const [notes, setNotes] = useState('');

  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Confirm Modal state
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

  const cohorts = data.batches || [];
  const getCowCohort = (cowId: string) => {
    return cohorts.find(b => b.cowIds.includes(cowId));
  };

  const filteredHealthLogs = farmFilteredHealthLogs.filter(log => {
    if (selectedCohortId === 'all') return true;
    return getCowCohort(log.cowId)?.id === selectedCohortId;
  });

  const handleSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cowId || !name) return;

    const costAmount = Number(cost) || 0;

    if (editingLogId && onUpdateHealthLog) {
      await onUpdateHealthLog(editingLogId, {
        cowId,
        type,
        name,
        date,
        administeredBy,
        cost: costAmount,
        notes
      });
      setEditingLogId(null);
    } else {
      await onAddHealthLog({
        cowId,
        type,
        name,
        date,
        administeredBy,
        cost: costAmount,
        notes
      });

      if (costAmount > 0) {
        setConfirmModal({
          isOpen: true,
          title: '✅ បានកត់ត្រា (Recorded)',
          description: `បានកត់ត្រាសុខភាព "${name}" សម្រាប់គោ ${cowId} ដោយជោគជ័យ។ ថវិកាព្យាបាល ៛ ${costAmount.toLocaleString()} ត្រូវបានកត់ទុកក្នុងកំណត់ត្រាសុខភាព។`,
          type: 'success',
          confirmText: 'យល់ព្រម (OK)'
        });
      }
    }

    setIsLogging(false);
    setCowId('');
    setName('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('health.title')}</h3>
          <p className="text-xs text-slate-400 font-medium">{t('health.subtitle')}</p>
        </div>
        {hasPermission(currentUser, 'health_record') && (
          <Button 
            onClick={() => {
              if (isLogging) {
                setEditingLogId(null);
                setCowId('');
                setName('');
                setNotes('');
              }
              setIsLogging(!isLogging);
            }} 
            className="bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs py-2 shadow"
          >
            {isLogging ? t('common.close') : `+ ${t('health.addLog')}`}
          </Button>
        )}
      </div>

      {/* Health KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Total Medical Events</p>
              <h4 className="text-xl font-black text-slate-900 mt-1">{farmFilteredHealthLogs.length}</h4>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Herd Health Status</p>
              <h4 className={`text-base font-black mt-1 ${activeCows.filter(c => ['poor', 'sick', 'critical'].includes(c.healthStatus?.toLowerCase() || '')).length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {activeCows.filter(c => ['poor', 'sick', 'critical'].includes(c.healthStatus?.toLowerCase() || '')).length > 0 
                  ? `⚠️ ${activeCows.filter(c => ['poor', 'sick', 'critical'].includes(c.healthStatus?.toLowerCase() || '')).length} Sick Alert`
                  : '✓ All Herd Stable'
                }
              </h4>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${activeCows.filter(c => ['poor', 'sick', 'critical'].includes(c.healthStatus?.toLowerCase() || '')).length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Heart className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">Total Medical Expense</p>
              <h4 className="text-xl font-black text-slate-900 mt-1">
                ៛ {farmFilteredHealthLogs.reduce((sum, l) => sum + (l.cost || 0), 0).toLocaleString()}
              </h4>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Farm Filter Bar */}
      <FarmFilterBar
        farms={farms}
        selectedFarm={selectedFarm}
        onFarmChange={setSelectedFarm}
        countByFarm={countByFarm}
        totalCount={data.healthLogs.length}
        label="health records"
        currentUser={currentUser}
      />

      {isLogging ? (
        /* Medical Log Form Panel */
        <Card className="max-w-md bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-bold text-slate-800">
              {editingLogId ? 'Edit Health Record' : 'Log New Health Event'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <form onSubmit={handleSub} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="h_cow" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Select Cow ID</Label>
                  <select
                    id="h_cow"
                    value={cowId}
                    onChange={e => setCowId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 focus:outline-none"
                    required
                  >
                    <option value="">-- Select cow --</option>
                    {activeCows.map(c => (
                      <option key={c.id} value={c.id}>{c.id} ({c.breed})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h_type" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Event Type</Label>
                  <select
                    id="h_type"
                    value={type}
                    onChange={e => setType(e.target.value as HealthLogItem['type'])}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 focus:outline-none"
                  >
                    <option value="Vaccination">Vaccination</option>
                    <option value="Treatment">Medical Treatment</option>
                    <option value="Disease">Disease Diagnostic</option>
                    <option value="Deworming">Deworming Program</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="h_name" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Vaccine / Disease / Treatment Name</Label>
                <select
                  id="h_name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 focus:outline-none"
                  required
                >
                  <option value="">-- Choose option --</option>
                  {type === 'Vaccination' && data.settings.vaccineTypes.map(v => <option key={v} value={v}>{v}</option>)}
                  {type === 'Deworming' && <option value="Broad Spectrum Dewormer">Broad Spectrum Dewormer</option>}
                  {type === 'Disease' && <option value="Foot and Mouth Disease">Foot and Mouth Disease</option>}
                  {type === 'Treatment' && <option value="Antibiotics Injection">Antibiotics Injection</option>}
                  <option value="Other Diagnostics">Other (Custom Diagnostics)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="h_date" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Log Date</Label>
                  <Input id="h_date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h_cost" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Treatment Cost (៛)</Label>
                  <Input id="h_cost" type="number" value={cost} onChange={e => setCost(Number(e.target.value))} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="h_admin" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Administered By</Label>
                <Input id="h_admin" value={administeredBy} onChange={e => setAdministeredBy(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="h_notes" className="text-xs font-bold uppercase text-slate-450 tracking-wider">Veterinarian Notes</Label>
                <textarea
                  id="h_notes"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  placeholder="Notes..."
                />
              </div>

              <div className="flex gap-2">
                {editingLogId && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setEditingLogId(null);
                      setCowId('');
                      setName('');
                      setNotes('');
                      setIsLogging(false);
                    }} 
                    className="w-1/2 rounded-xl font-bold py-2.5"
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" className={`bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold py-2.5 shadow text-white ${editingLogId ? 'w-1/2' : 'w-full'}`}>
                  {editingLogId ? 'Save Changes' : 'Save Health Record'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Health Logs Table Ledger */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Veterinary Treatment Ledger</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedCohortId}
                onChange={e => setSelectedCohortId(e.target.value)}
                className="h-8 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Filter: All Groups (ទាំងអស់)</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </select>
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
                    filename: `CC_Livestock_Health_Medical_Logs_${new Date().toISOString().split('T')[0]}.xlsx`,
                    sheetName: 'Health Medical Logs',
                    data: filteredHealthLogs,
                    columns: [
                      { header: 'Log ID', key: 'id' },
                      { header: 'Cow ID', key: 'cowId' },
                      { header: 'Event Type', key: 'type' },
                      { header: 'Vaccine / Diagnostic Name', key: 'name' },
                      { header: 'Tracking Date', key: 'date', formatter: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
                      { header: 'Administered By', key: 'administeredBy' },
                      { header: 'Cost (៛)', key: 'cost', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` },
                      { header: 'Medical Notes', key: 'notes', formatter: (val) => val || '-' }
                    ]
                  });
                }}
                className="h-8 text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[#003B33] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Cow ID</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Vaccine / Diagnostic</th>
                  <th className="py-3.5 px-4">Tracking Date</th>
                  <th className="py-3.5 px-4">Administered By</th>
                  <th className="py-3.5 px-4">Cost</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                {filteredHealthLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize).length > 0 ? (
                  filteredHealthLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((log) => {
                    const cohort = getCowCohort(log.cowId);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-left">
                          <div className="flex items-center gap-1.5">
                            <span>{log.cowId}</span>
                            {cohort && (
                              <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded" title={cohort.name}>
                                {cohort.id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-lg font-bold border text-[10px] uppercase ${
                            log.type === 'Vaccination'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : log.type === 'Disease'
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : 'bg-blue-50 text-blue-600 border-blue-100'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold">{log.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{new Date(log.date).toLocaleDateString()}</td>
                        <td className="py-3.5 px-4 text-slate-600">{log.administeredBy}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-800 font-semibold">៛ {log.cost.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={log.notes}>{log.notes || '-'}</td>
                        <td className="py-3.5 px-4 text-right pr-4">
                          <div className="flex justify-end items-center gap-2">
                            {hasPermission(currentUser, 'health_record') && (
                              <button
                                onClick={() => {
                                  setCowId(log.cowId);
                                  setType(log.type);
                                  setName(log.name);
                                  setDate(log.date.split('T')[0]);
                                  setAdministeredBy(log.administeredBy);
                                  setCost(log.cost);
                                  setNotes(log.notes || '');
                                  setEditingLogId(log.id);
                                  setIsLogging(true);
                                }}
                                className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-55 transition-colors cursor-pointer"
                                title="Edit Health Log"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            {onDeleteHealthLog && hasPermission(currentUser, 'health_delete') && (
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Delete Medical Event',
                                    description: 'Are you sure you want to permanently delete this health log record? This action cannot be undone.',
                                    type: 'danger',
                                    confirmText: 'Delete Record',
                                    onConfirm: async () => {
                                      await onDeleteHealthLog(log.id);
                                    }
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-rose-55 transition-colors cursor-pointer"
                                title="Delete Health Log"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-semibold">
                      {userFarmLocation ? (
                        <div className="py-4 space-y-1.5">
                          <p className="text-sm font-bold text-slate-700">📍 គ្មានទិន្នន័យសុខភាពគោសម្រាប់ {userFarmLocation} (No Medical Records)</p>
                          <p className="text-xs text-slate-400">កសិដ្ឋាននេះពុំទាន់មានកំណត់ត្រាសុខភាព ឬវ៉ាក់សាំងនៅឡើយទេ។</p>
                        </div>
                      ) : (
                        'No veterinary logs recorded. Add one using the button above.'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredHealthLogs.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="logs"
          />
        </div>
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
