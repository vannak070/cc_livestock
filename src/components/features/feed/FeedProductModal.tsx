'use client';

import React, { useState, useEffect } from 'react';
import { FeedProductItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Edit2 } from 'lucide-react';

interface FeedProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: FeedProductItem) => Promise<void>;
  initialProduct?: FeedProductItem | null;
  categories?: string[];
  onManageCategories?: () => void;
}

export const FeedProductModal: React.FC<FeedProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialProduct = null,
  categories = ['Concentrate', 'Silage', 'Roughage', 'Supplement', 'Medicine', 'Other'],
  onManageCategories
}) => {
  const isEditMode = !!initialProduct;

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Concentrate');
  const [unit, setUnit] = useState('bag');
  const [weightPerUnit, setWeightPerUnit] = useState('30');
  const [costType, setCostType] = useState<'per_bag' | 'per_kg'>('per_bag');
  const [costPerBag, setCostPerBag] = useState('60000');
  const [unitCost, setUnitCost] = useState('2000');
  const [minThresholdBags, setMinThresholdBags] = useState('50');
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialProduct) {
        setId(initialProduct.id);
        setName(initialProduct.name);
        setCategory(initialProduct.category || 'Concentrate');
        setUnit(initialProduct.unit || 'bag');
        const wtUnit = initialProduct.weightPerUnit ?? 30;
        setWeightPerUnit(String(wtUnit));

        const cType = initialProduct.costType || 'per_bag';
        setCostType(cType);

        const uCost = initialProduct.unitCost ?? 2000;
        const cBag = initialProduct.costPerBag ?? (uCost * wtUnit);

        setUnitCost(String(uCost));
        setCostPerBag(String(cBag));

        setMinThresholdBags(String(initialProduct.minThresholdBags ?? 50));
        setDescription(initialProduct.description || '');
        setSupplier(initialProduct.supplier || '');
        setStatus(initialProduct.status || 'Active');
      } else {
        const randomCode = Math.floor(100 + Math.random() * 900);
        setId(`PROD-F${randomCode}`);
        setName('');
        setCategory('Concentrate');
        setUnit('bag');
        setWeightPerUnit('30');
        setCostType('per_bag');
        setCostPerBag('60000');
        setUnitCost('2000');
        setMinThresholdBags('50');
        setDescription('');
        setSupplier('');
        setStatus('Active');
      }
    }
  }, [isOpen, initialProduct]);

  // Handle auto calculation when costPerBag or unitCost or weightPerUnit changes
  const handleCostPerBagChange = (val: string) => {
    setCostPerBag(val);
    const bagCostVal = parseFloat(val) || 0;
    const wt = parseFloat(weightPerUnit) || 30;
    if (wt > 0) {
      setUnitCost(String(parseFloat((bagCostVal / wt).toFixed(4))));
    }
  };

  const handleUnitCostChange = (val: string) => {
    setUnitCost(val);
    const uCostVal = parseFloat(val) || 0;
    const wt = parseFloat(weightPerUnit) || 30;
    setCostPerBag(String(parseFloat((uCostVal * wt).toFixed(2))));
  };

  const handleWeightPerUnitChange = (val: string) => {
    setWeightPerUnit(val);
    const wt = parseFloat(val) || 30;
    if (costType === 'per_bag') {
      const bagCostVal = parseFloat(costPerBag) || 0;
      if (wt > 0) setUnitCost(String(parseFloat((bagCostVal / wt).toFixed(4))));
    } else {
      const uCostVal = parseFloat(unitCost) || 0;
      setCostPerBag(String(parseFloat((uCostVal * wt).toFixed(2))));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const wtUnit = parseFloat(weightPerUnit) || 30;
      const bagsThreshold = parseFloat(minThresholdBags) || 50;
      const uCost = parseFloat(unitCost) || 0;
      const cBag = parseFloat(costPerBag) || (uCost * wtUnit);

      await onSubmit({
        id: id.trim() || `PROD-F${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        category,
        unit,
        weightPerUnit: wtUnit,
        unitCost: uCost,
        costType,
        costPerBag: cBag,
        minThresholdBags: bagsThreshold,
        minThresholdKg: bagsThreshold * wtUnit,
        description: description.trim(),
        supplier: supplier.trim(),
        status
      });

      onClose();
    } catch (error) {
      console.error('Failed to save feed product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pb-4 border-b border-slate-100">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {isEditMode ? (
              <>
                <Edit2 className="h-5 w-5 text-emerald-600" />
                Edit Feed Product Master
              </>
            ) : (
              <>
                <Package className="h-5 w-5 text-emerald-600" />
                Add New Feed Product
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Define feed product specifications, unit weight, cost, and low stock warning threshold (Default: 50 bags = 1,500 kg).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="prod_id" className="text-xs font-bold text-slate-700">Product Code</Label>
              <Input
                id="prod_id"
                value={id}
                onChange={e => setId(e.target.value)}
                placeholder="e.g. PROD-F01"
                required
                disabled={isEditMode}
                className="font-mono text-xs disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod_name" className="text-xs font-bold text-slate-700">Product Name</Label>
              <Input
                id="prod_name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. DSR-16 Concentrate Feed"
                required
                className="text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="prod_cat" className="text-xs font-bold text-slate-700">Category</Label>
                {onManageCategories && (
                  <button
                    type="button"
                    onClick={onManageCategories}
                    className="text-xs text-emerald-600 hover:underline font-bold cursor-pointer"
                  >
                    + Edit Categories
                  </button>
                )}
              </div>
              <select
                id="prod_cat"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod_unit" className="text-xs font-bold text-slate-700">Stock Unit</Label>
              <select
                id="prod_unit"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="bag">bag (បាវ - 30kg)</option>
                <option value="kg">kg (គីឡូក្រាម)</option>
                <option value="ton">ton (តោន)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod_wt_unit" className="text-xs font-bold text-slate-700">Weight per Bag (kg)</Label>
              <Input
                type="number"
                id="prod_wt_unit"
                value={weightPerUnit}
                onChange={e => handleWeightPerUnitChange(e.target.value)}
                placeholder="30"
                required
                className="text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* Pricing & Cost Structure Selection */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 ">Unit Cost Pricing Mode</Label>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCostType('per_bag')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${costType === 'per_bag' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Cost per Bag (៛ / បាវ)
                </button>
                <button
                  type="button"
                  onClick={() => setCostType('per_kg')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${costType === 'per_kg' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Cost per kg (៛ / គីឡូ)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="prod_cost_bag" className="text-xs font-bold text-slate-700">
                  Cost per Bag (៛ / bag) {costType === 'per_bag' && <span className="text-emerald-600 font-bold">(Primary)</span>}
                </Label>
                <Input
                  type="number"
                  id="prod_cost_bag"
                  value={costPerBag}
                  onChange={e => handleCostPerBagChange(e.target.value)}
                  placeholder="60000"
                  required
                  className={`text-xs font-mono font-bold ${costType === 'per_bag' ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20' : 'bg-slate-100'}`}
                />
                <p className="text-xs text-slate-500 font-semibold">
                  = ៛ {parseFloat(costPerBag || '0').toLocaleString()} per 30kg bag
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="prod_unit_cost" className="text-xs font-bold text-slate-700">
                  Cost per kg (៛ / kg) {costType === 'per_kg' && <span className="text-emerald-600 font-bold">(Primary)</span>}
                </Label>
                <Input
                  type="number"
                  id="prod_unit_cost"
                  value={unitCost}
                  onChange={e => handleUnitCostChange(e.target.value)}
                  placeholder="2000"
                  required
                  className={`text-xs font-mono font-bold ${costType === 'per_kg' ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20' : 'bg-slate-100'}`}
                />
                <p className="text-xs text-slate-500 font-semibold">
                  = ៛ {parseFloat(unitCost || '0').toLocaleString()} per kg
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-1">
              <Label htmlFor="prod_min_threshold" className="text-xs font-bold text-slate-700">Low Stock Warning (Bags)</Label>
              <Input
                type="number"
                id="prod_min_threshold"
                value={minThresholdBags}
                onChange={e => setMinThresholdBags(e.target.value)}
                placeholder="50"
                required
                className="text-xs font-mono font-bold border-amber-300 bg-amber-50/30"
              />
              <p className="text-xs text-amber-700 font-semibold">
                ⚠️ Warns when stock $\le$ {parseFloat(minThresholdBags || '50') * parseFloat(weightPerUnit || '30')} kg ({minThresholdBags} bags)
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod_status" className="text-xs font-bold text-slate-700">Status</Label>
              <select
                id="prod_status"
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="prod_supplier" className="text-xs font-bold text-slate-700">Supplier Name</Label>
              <Input
                id="prod_supplier"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="e.g. CP Feeds Ltd"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod_desc" className="text-xs font-bold text-slate-700">Description / Notes</Label>
              <Input
                id="prod_desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Specification or ration notes..."
                className="text-xs"
              />
            </div>
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
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs py-2 px-5 font-bold shadow-md"
            >
              {isSubmitting ? 'Saving...' : 'Save Feed Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
