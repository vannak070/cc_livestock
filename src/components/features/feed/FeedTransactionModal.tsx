'use client';

import React, { useState, useEffect } from 'react';
import { FeedProductItem, FeedStockTransaction, FeedTransactionType, UserRoleItem } from '@/lib/types';
import { FarmItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import { format2DecimalsWithCommas } from '@/lib/utils';

interface FeedTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tx: FeedStockTransaction) => Promise<void>;
  products: FeedProductItem[];
  farms: FarmItem[];
  defaultType?: FeedTransactionType;
  currentUser?: UserRoleItem;
}

export const FeedTransactionModal: React.FC<FeedTransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  products,
  farms,
  defaultType = 'STOCK_IN',
  currentUser
}) => {
  const [type, setType] = useState<FeedTransactionType>(defaultType);
  const [productId, setProductId] = useState('');
  const [quantityBags, setQuantityBags] = useState('50');
  const defaultFarmName = currentUser?.farmLocation || (farms.length > 0 ? farms[0].name : '');
  const [sourceFarm, setSourceFarm] = useState(defaultFarmName);
  const [targetFarm, setTargetFarm] = useState(defaultFarmName);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      if (products.length > 0) {
        setProductId(products[0].id);
      }
      const initialFarm = currentUser?.farmLocation || (farms.length > 0 ? farms[0].name : '');
      setSourceFarm(initialFarm);
      setTargetFarm(initialFarm);
      setReferenceNo(`TX-${Date.now().toString().slice(-6)}`);
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, defaultType, products, currentUser, farms]);

  const selectedProduct = products.find(p => p.id === productId) || products[0];

  const bagsCount = parseFloat(quantityBags) || 0;
  const weightPerUnit = selectedProduct?.weightPerUnit || 30;
  const totalKg = bagsCount * weightPerUnit;
  const unitCost = selectedProduct?.unitCost || 0;
  const totalCost = totalKg * unitCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || bagsCount <= 0) return;

    setIsSubmitting(true);
    try {
      const tx: FeedStockTransaction = {
        id: `TX-FEED-${Date.now()}`,
        date,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type,
        quantityBags: bagsCount,
        quantityKg: totalKg,
        unitCost,
        totalCost,
        sourceFarm: type === 'STOCK_IN' ? 'Supplier' : sourceFarm,
        targetFarm: type === 'STOCK_OUT' ? 'Daily Feeding Ration' : targetFarm,
        referenceNo: referenceNo.trim() || `TX-${Date.now().toString().slice(-6)}`,
        recordedBy: currentUser?.name || 'Admin User',
        notes: notes.trim()
      };

      await onSubmit(tx);
      onClose();
    } catch (error) {
      console.error('Failed to submit feed transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pb-4 border-b border-slate-100">
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
            Feed Stock In (Procurement / Inbound Delivery)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Log inbound feed purchases into Farm Stock. Daily stock out is automatically calculated based on active feed rations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-left">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tx_product" className="text-xs font-bold text-slate-700">Select Feed Product</Label>
              <select
                id="tx_product"
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                required
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.unit} - ៛ {p.unitCost.toLocaleString()}/kg)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tx_date" className="text-xs font-bold text-slate-700">Transaction Date</Label>
              <Input
                type="date"
                id="tx_date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tx_bags" className="text-xs font-bold text-slate-700">Quantity (Bags)</Label>
              <Input
                type="number"
                id="tx_bags"
                value={quantityBags}
                onChange={e => setQuantityBags(e.target.value)}
                placeholder="50"
                required
                min={1}
                className="text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Biomass (kg)</Label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-md flex items-center text-xs font-mono font-black text-slate-800">
                {totalKg.toLocaleString()} kg ({weightPerUnit} kg/bag)
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Valuation</Label>
              <div className="h-9 px-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center text-xs font-mono font-black text-emerald-700">
                ៛ {format2DecimalsWithCommas(totalCost)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {type === 'STOCK_IN' && (
              <div className="space-y-1">
                <Label htmlFor="tx_target" className="text-xs font-bold text-slate-700">Target Farm Warehouse</Label>
                <select
                  id="tx_target"
                  value={targetFarm}
                  onChange={e => setTargetFarm(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  {farms.map(f => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {type === 'STOCK_OUT' && (
              <div className="space-y-1">
                <Label htmlFor="tx_source_out" className="text-xs font-bold text-slate-700">Deduct From Farm Warehouse</Label>
                <select
                  id="tx_source_out"
                  value={targetFarm}
                  onChange={e => setTargetFarm(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  {farms.map(f => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="tx_ref" className="text-xs font-bold text-slate-700">Invoice / Reference #</Label>
              <Input
                id="tx_ref"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                placeholder="e.g. INV-9042"
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tx_notes" className="text-xs font-bold text-slate-700">Notes / Rationale</Label>
            <Input
              id="tx_notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Bi-weekly feed delivery for fattening program..."
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="rounded-xl text-xs py-2 px-4 font-bold border-slate-200 text-slate-650 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || bagsCount <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs py-2 px-5 font-bold shadow-md"
            >
              {isSubmitting ? 'Recording...' : `Record ${type.replace('_', ' ')}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
