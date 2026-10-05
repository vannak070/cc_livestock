'use client';

import React, { useState } from 'react';
import { ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import { SalesRecord } from '@/lib/xlsx-parser';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DollarSign, FileText, ArrowUpRight, ShoppingBag, Edit3, Trash2, Download } from 'lucide-react';
import { ConfirmModal } from './ui/confirm-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { hasPermission, format2Decimals, format2DecimalsWithCommas, getErrorMessage } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import FarmFilterBar from './FarmFilterBar';
import { TablePagination } from './common/TablePagination';
import { exportToExcel } from '@/lib/excel-export';
import { DateRangeFilterBar } from './common/DateRangeFilterBar';
import { useOnChange } from '@/hooks/useOnChange';

interface FinanceTabProps {
  data: ERPLivestockData;
  onDeleteSalesRecord?: (cowId: string) => Promise<void>;
  onUpdateSalesRecord?: (cowId: string, updates: Partial<SalesRecord>) => Promise<void>;
  onRecordSaleClick?: () => void;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

export default function FinanceTab({ 
  data, 
  onDeleteSalesRecord,
  onUpdateSalesRecord,
  onRecordSaleClick,
  currentUser,
  farms = []
}: FinanceTabProps) {
  const { t } = useLanguage();
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  // Confirm Modal State
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

  
  const [editingSalesRecord, setEditingSalesRecord] = useState<{
    cowId: string;
    salesDate: string;
    saleType: 'Scale' | 'Lumpsum';
    buyer: string;
    weight: number;
    unitPrice: number;
  } | null>(null);

  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);

  // Date & Category & Amount Range Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset page when farm or filters change
  useOnChange(JSON.stringify([selectedFarm, startDate, endDate, salesPageSize]), () => setSalesPage(1));

  const farmFilteredSales = React.useMemo(() => {
    let list = data.salesTracking;
    if (selectedFarm) {
      const stockIds = data.stock.filter(s => s.location === selectedFarm).map(s => s.id);
      list = list.filter(s => stockIds.includes(s.cowId));
    }
    if (startDate || endDate) {
      list = list.filter(s => {
        if (!s.salesDate) return true;
        const d = s.salesDate.split('T')[0];
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }
    return list;
  }, [data.salesTracking, data.stock, selectedFarm, startDate, endDate]);

  const farmFilteredStock = React.useMemo(() => {
    if (!selectedFarm) return data.stock;
    return data.stock.filter(s => s.location === selectedFarm);
  }, [data.stock, selectedFarm]);

  const countByFarm = React.useMemo(() => {
    const locById = new Map(data.stock.map(c => [c.id, c.location]));
    const map: Record<string, number> = {};
    data.salesTracking.forEach(sale => {
      const loc = locById.get(sale.cowId);
      if (loc) map[loc] = (map[loc] || 0) + 1;
    });
    return map;
  }, [data.salesTracking, data.stock]);

  // Financial aggregates (farm-scoped when filter active)
  const totalSales = farmFilteredSales.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalPurchases = farmFilteredStock.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const netEarnings = totalSales - totalPurchases;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('finance.title')}</h3>
          <p className="text-xs text-slate-400 font-medium">{t('finance.subtitle')}</p>
        </div>
        {onRecordSaleClick && hasPermission(currentUser, 'sales_record') && (
          <Button
            onClick={onRecordSaleClick}
            className="bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs py-2 shadow flex items-center gap-1.5 cursor-pointer"
          >
            ➕ {t('finance.recordSale')}
          </Button>
        )}
      </div>

      {/* Farm Filter Bar */}
      <FarmFilterBar
        farms={farms}
        selectedFarm={selectedFarm}
        onFarmChange={setSelectedFarm}
        countByFarm={countByFarm}
        totalCount={data.salesTracking.length}
        label="sales"
        currentUser={currentUser}
      />

      {/* Mini Stats Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-sm ">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Sales Revenue</p>
            <h4 className="text-lg font-black text-emerald-600 mt-1">៛ {format2DecimalsWithCommas(totalSales)}</h4>
          </div>
          <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowUpRight className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cattle Acquisition Cost</p>
            <h4 className="text-lg font-black text-slate-800 mt-1">៛ {format2DecimalsWithCommas(totalPurchases)}</h4>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center">
            <FileText className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className={`border p-4 rounded-xl flex items-center justify-between shadow-sm ${
          netEarnings >= 0 ? 'bg-emerald-50/40 border-emerald-100' : 'bg-rose-50/40 border-rose-100'
        }`}>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net P&L Margin</p>
            <h4 className={`text-lg font-black mt-1 ${netEarnings >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ៛ {format2DecimalsWithCommas(netEarnings)}
            </h4>
          </div>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
            netEarnings >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            <DollarSign className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

        {/* Revenue of Sales Ledger */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 font-mono">Gross Sales Revenue Ledger</h4>
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
                      filename: `CC_Livestock_Sales_Revenue_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`,
                      sheetName: 'Sales Revenue Ledger',
                      data: farmFilteredSales,
                      columns: [
                        { header: 'Cattle ID', key: 'cowId' },
                        { header: 'Sex', key: 'cowId', formatter: (_, row) => data.stock.find(s => s.id === row.cowId)?.sex || 'N/A' },
                        { header: 'Sales Date', key: 'salesDate', formatter: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
                        { header: 'Breed', key: 'breed' },
                        { header: 'Sales Type', key: 'saleType', formatter: (val, row) => val || (row.weight <= 2 || row.totalPrice === row.unitPrice ? 'Lumpsum' : 'Scale') },
                        { header: 'Buyer', key: 'buyer', formatter: (val) => val || 'Local Market' },
                        { header: 'Sale Weight (kg)', key: 'weight' },
                        { header: 'Unit Price (៛/kg)', key: 'unitPrice', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` },
                        { header: 'Gross Income (៛)', key: 'totalPrice', formatter: (val) => `៛ ${format2DecimalsWithCommas(val)}` }
                      ]
                    });
                  }}
                  className="h-8 text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-2xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export Excel
                </Button>
                {onRecordSaleClick && (
                  <Button
                    onClick={onRecordSaleClick}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs py-1.5 px-4 shadow-sm cursor-pointer h-8"
                  >
                    ➕ កត់ត្រាការលក់ (Record Sales)
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/20 text-[#003B33] font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Cattle ID</th>
                    <th className="py-3.5 px-4">Sex</th>
                    <th className="py-3.5 px-4">Sales Date</th>
                    <th className="py-3.5 px-4">Breed</th>
                    <th className="py-3.5 px-4">Sales Type</th>
                    <th className="py-3.5 px-4">Sale To</th>
                    <th className="py-3.5 px-4 text-right">Sale Weight</th>
                    <th className="py-3.5 px-4 text-right">Unit Price (៛)</th>
                    <th className="py-3.5 px-4 text-right">Gross Income (៛)</th>
                    <th className="py-3.5 px-4 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
                  {farmFilteredSales.length > 0 ? (
                    [...farmFilteredSales]
                      .sort((a, b) => new Date(b.salesDate || '').getTime() - new Date(a.salesDate || '').getTime())
                      .slice((salesPage - 1) * salesPageSize, salesPage * salesPageSize)
                      .map((sale, idx) => {
                        const deducedSaleType = sale.saleType || (sale.weight <= 2 || sale.totalPrice === sale.unitPrice ? 'Lumpsum' : 'Scale');
                        const deducedBuyer = sale.buyer || 'Local Market';
                        const matchedCow = data.stock.find(s => s.id === sale.cowId);
                        const cowSex = matchedCow?.sex || 'N/A';
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-800">{sale.cowId}</td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                cowSex.toLowerCase().startsWith('m') || cowSex === 'Male'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : cowSex.toLowerCase().startsWith('f') || cowSex === 'Female'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {cowSex.toLowerCase().startsWith('m') || cowSex === 'Male' ? '♂ Male' : cowSex.toLowerCase().startsWith('f') || cowSex === 'Female' ? '♀ Female' : cowSex}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">
                              {sale.salesDate ? new Date(sale.salesDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-550">{sale.breed}</td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                deducedSaleType.toLowerCase().startsWith('scale') || deducedSaleType.toLowerCase().startsWith('weight')
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {deducedSaleType}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-600">{deducedBuyer}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">{sale.weight} kg</td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-500">៛ {sale.unitPrice.toLocaleString()}</td>
                            <td className="py-3.5 px-4 font-mono text-emerald-600 font-extrabold text-right">៛ {sale.totalPrice.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right pr-6">
                              <div className="flex items-center justify-end gap-2.5">
                                {hasPermission(currentUser, 'sales_record') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSalesRecord({
                                        cowId: sale.cowId,
                                        salesDate: sale.salesDate ? sale.salesDate.split('T')[0] : '',
                                        saleType: deducedSaleType === 'Scale' || deducedSaleType === 'Weight' ? 'Scale' : 'Lumpsum',
                                        buyer: deducedBuyer,
                                        weight: sale.weight,
                                        unitPrice: sale.unitPrice
                                      });
                                    }}
                                    className="text-slate-400 hover:text-emerald-600 transition-colors p-1 cursor-pointer"
                                    title="Edit Sales Record"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {onDeleteSalesRecord && hasPermission(currentUser, 'sales_delete') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: 'Delete Sales Record',
                                        description: `Are you sure you want to permanently delete the sales record for Cattle ID "${sale.cowId}"? This will revert its status back to "Active" and add it back to inventory.`,
                                        type: 'danger',
                                        confirmText: 'Delete Record',
                                        onConfirm: async () => {
                                          try {
                                            await onDeleteSalesRecord(sale.cowId);
                                            setConfirmModal({
                                              isOpen: true,
                                              title: 'Record Deleted',
                                              description: 'Sales record has been successfully deleted. Cattle is now active again.',
                                              type: 'success',
                                              confirmText: 'OK'
                                            });
                                          } catch (err) {
                                            setConfirmModal({
                                              isOpen: true,
                                              title: 'Deletion Failed',
                                              description: getErrorMessage(err, 'Unknown error occurred while deleting sales record.'),
                                              type: 'danger',
                                              confirmText: 'Dismiss'
                                            });
                                          }
                                        }
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                    title="Delete Sales Record"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-semibold">
                        No sales revenue records registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={salesPage}
              totalItems={farmFilteredSales.length}
              pageSize={salesPageSize}
              onPageChange={setSalesPage}
              onPageSizeChange={setSalesPageSize}
              itemLabel="sales"
            />
          </div>
        </div>
      {editingSalesRecord && (
        <Dialog open={!!editingSalesRecord} onOpenChange={(open) => !open && setEditingSalesRecord(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white border border-slate-100 text-slate-800 rounded-2xl shadow-xl p-6">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-bold text-slate-800">Edit Sales Record</DialogTitle>
              <DialogDescription className="text-xs text-slate-405 font-mono mt-0.5">
                Cattle ID: {editingSalesRecord.cowId}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (onUpdateSalesRecord) {
                try {
                  await onUpdateSalesRecord(editingSalesRecord.cowId, {
                    salesDate: editingSalesRecord.salesDate,
                    saleType: editingSalesRecord.saleType,
                    buyer: editingSalesRecord.buyer,
                    weight: editingSalesRecord.weight,
                    unitPrice: editingSalesRecord.unitPrice
                  });
                  setConfirmModal({
                    isOpen: true,
                    title: 'Sales Record Updated',
                    description: 'Sales details have been successfully updated in database.',
                    type: 'success',
                    confirmText: 'OK'
                  });
                } catch (err) {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Update Failed',
                    description: getErrorMessage(err, 'Unknown error occurred while updating sales record.'),
                    type: 'danger',
                    confirmText: 'Dismiss'
                  });
                }
              }
              setEditingSalesRecord(null);
            }} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="es_date" className="text-xs font-bold uppercase text-slate-455 tracking-wider">Sales Date</Label>
                  <Input
                    id="es_date"
                    type="date"
                    required
                    value={editingSalesRecord.salesDate}
                    onChange={e => setEditingSalesRecord(prev => prev ? { ...prev, salesDate: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="es_type" className="text-xs font-bold uppercase text-slate-455 tracking-wider">Sale Type</Label>
                  <select
                    id="es_type"
                    value={editingSalesRecord.saleType}
                    onChange={e => setEditingSalesRecord(prev => prev ? { ...prev, saleType: e.target.value as 'Scale' | 'Lumpsum' } : null)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 focus:outline-none"
                  >
                    <option value="Scale">Scale (per kg)</option>
                    <option value="Lumpsum">Lumpsum (fixed)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="es_buyer" className="text-xs font-bold uppercase text-slate-455 tracking-wider">Buyer Name</Label>
                <Input
                  id="es_buyer"
                  type="text"
                  required
                  value={editingSalesRecord.buyer}
                  onChange={e => setEditingSalesRecord(prev => prev ? { ...prev, buyer: e.target.value } : null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="es_weight" className="text-xs font-bold uppercase text-slate-455 tracking-wider">Weight (kg)</Label>
                  <Input
                    id="es_weight"
                    type="number"
                    required
                    value={editingSalesRecord.weight}
                    onChange={e => setEditingSalesRecord(prev => prev ? { ...prev, weight: Number(e.target.value) } : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="es_price" className="text-xs font-bold uppercase text-slate-455 tracking-wider">
                    {editingSalesRecord.saleType === 'Scale' ? 'Unit Price (៛/kg)' : 'Lumpsum Price (៛)'}
                  </Label>
                  <Input
                    id="es_price"
                    type="number"
                    required
                    value={editingSalesRecord.unitPrice}
                    onChange={e => setEditingSalesRecord(prev => prev ? { ...prev, unitPrice: Number(e.target.value) } : null)}
                  />
                </div>
              </div>

              {/* Total gross income preview */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Gross Income</span>
                <span className="font-mono text-emerald-600 font-extrabold text-sm">
                  ៛ {(editingSalesRecord.saleType === 'Scale' ? editingSalesRecord.weight * editingSalesRecord.unitPrice : editingSalesRecord.unitPrice).toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingSalesRecord(null)} className="rounded-xl font-bold py-2">Cancel</Button>
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
