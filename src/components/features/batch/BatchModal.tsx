import React, { useState, useEffect, useMemo } from 'react';
import { BatchItem, StockItem } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layers, CheckCircle2, UserPlus, Edit2 } from 'lucide-react';

import { FarmItem, UserRoleItem } from '@/lib/types';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (batch: Omit<BatchItem, 'cowIds'>, initialCowIds: string[]) => Promise<void>;
  unassignedCows: StockItem[];
  batchTypes?: string[];
  initialBatch?: BatchItem | null;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

// Standard fattening cycle length used to auto-calculate the Selling Target
// Date from the batch's Start Date — the field is never hand-picked, it
// always tracks Start Date + 90 days (see the batch.service.ts fallback for
// the same rule enforced server-side).
const SELLING_CYCLE_DAYS = 90;

function addDaysToDateStr(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Small uppercase divider label used to group the form into clear sections.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
      {children}
    </p>
  );
}

export const BatchModal: React.FC<BatchModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  unassignedCows,
  batchTypes = ['Fattening Program', 'Quanrantin & Vet Card', 'Selling Pool', 'Breeding Program'],
  initialBatch = null,
  currentUser,
  farms = []
}) => {
  const isEditMode = !!initialBatch;

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Fattening Program');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Active' | 'Closed'>('Active');
  const [farmLocation, setFarmLocation] = useState(currentUser?.farmLocation || '');
  const [notes, setNotes] = useState('');
  const [expectedSellingPrice, setExpectedSellingPrice] = useState<string>('');
  const [selectedCowIds, setSelectedCowIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selling Target Date is never entered by hand — it's always Start Date +
  // 90 days, recalculated live as Start Date changes.
  const sellingTargetDate = useMemo(() => addDaysToDateStr(startDate, SELLING_CYCLE_DAYS), [startDate]);

  // Unassigned Cows Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [breedFilter, setBreedFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');

  const filteredUnassignedCows = unassignedCows.filter(cow => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || cow.id.toLowerCase().includes(q) || cow.breed.toLowerCase().includes(q);
    const matchesBreed = !breedFilter || cow.breed === breedFilter;
    const matchesSex = !sexFilter || (cow.sex && cow.sex.toLowerCase().trim() === sexFilter.toLowerCase().trim());
    return matchesSearch && matchesBreed && matchesSex;
  });

  useEffect(() => {
    if (isOpen) {
      if (initialBatch) {
        setId(initialBatch.id);
        setName(initialBatch.name);
        setType(initialBatch.type || 'Fattening Program');
        setStartDate(initialBatch.startDate ? initialBatch.startDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        setStatus(initialBatch.status || 'Active');
        setFarmLocation(initialBatch.farmLocation || currentUser?.farmLocation || (farms.length > 0 ? farms[0].name : ''));
        setNotes(initialBatch.notes || '');
        setExpectedSellingPrice(initialBatch.expectedSellingPrice ? String(initialBatch.expectedSellingPrice) : '');
        setSelectedCowIds([]);
      } else {
        const randomSuffix = Math.floor(100 + Math.random() * 900);
        setId(`CCB-${new Date().getFullYear()}-${randomSuffix}`);
        setName('ហ្វូងបំប៉នថ្មី (New Fattening Herd)');
        setType('Fattening Program');
        setStartDate(new Date().toISOString().split('T')[0]);
        setStatus('Active');
        setFarmLocation(currentUser?.farmLocation || (farms.length > 0 ? farms[0].name : ''));
        setNotes('');
        setExpectedSellingPrice('');
        setSelectedCowIds([]);
      }
    }
  }, [isOpen, initialBatch, currentUser, farms]);

  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    if (!name.trim()) return;

    if (!isEditMode && selectedCowIds.length < 3) {
      setValidationError('កម្មវិធីបំប៉នតម្រូវឱ្យជ្រើសរើសគោយ៉ាងហោចណាស់ ៣ ក្បាលឡើងទៅ។ (Creating a batch requires selecting at least 3 cows.)');
      return;
    }

    setIsSubmitting(true);
    try {
      const defaultFeeding = {
        ingredients: [
          { name: "ចំណីសំរេច (DSR-16)", portionPerHead: 3.5, unitCost: 2000 },
          { name: "ស្មៅ ឬ ពោត ផ្អាប់", portionPerHead: 15.0, unitCost: 350 },
          { name: "ចំបើង", portionPerHead: 2.0, unitCost: 150 }
        ],
        frequency: 'Twice Daily',
        startDate: startDate,
        status: 'Active' as const,
        notes: 'Default fattening ration.'
      };

      const finalId = id.trim() || `CCB-${Date.now().toString(36).toUpperCase()}`;
      await onSubmit({
        id: finalId,
        name: name.trim(),
        type,
        startDate,
        status,
        notes,
        farmLocation: farmLocation || initialBatch?.farmLocation || currentUser?.farmLocation || undefined,
        feedingProgram: initialBatch?.feedingProgram || (type === 'Fattening Program' ? defaultFeeding : undefined),
        expectedSellingPrice: expectedSellingPrice ? Number(expectedSellingPrice) : undefined,
        sellingTargetDate: sellingTargetDate || undefined
      }, selectedCowIds);

      onClose();
    } catch (error) {
      console.error('Failed to save batch:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCowSelect = (cowId: string) => {
    setSelectedCowIds(prev =>
      prev.includes(cowId) ? prev.filter(c => c !== cowId) : [...prev, cowId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pb-4 border-b border-slate-100">
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            {isEditMode ? (
              <>
                <Edit2 className="h-5 w-5 text-emerald-600" />
                Edit Batch Details
              </>
            ) : (
              <>
                <Layers className="h-5 w-5 text-emerald-600" />
                Create New Batch
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isEditMode
              ? `Edit batch details and farm location for ${initialBatch.id}`
              : 'Specify batch details, farm location, start date, and enroll cattle immediately.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4 text-left">
          {validationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
              <span>⚠️ {validationError}</span>
            </div>
          )}

          {/* Section 1: Identity */}
          <div className="space-y-3">
            <SectionLabel>Batch Identity</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="batch_id" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Batch Code</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(Auto-generated)</span>
                </Label>
                <Input
                  id="batch_id"
                  value={id}
                  readOnly
                  disabled
                  placeholder="e.g. CCB-2026-891"
                  className="font-mono text-xs font-bold bg-slate-100/90 text-slate-600 border-slate-200 cursor-not-allowed select-none"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch_name" className="text-xs font-bold text-slate-700">Batch Name</Label>
                <Input
                  id="batch_name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Fattening Batch A"
                  required
                  className="text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Schedule & Location */}
          <div className="space-y-3">
            <SectionLabel>Schedule &amp; Location</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor="batch_farm" className="text-xs font-bold text-slate-700">Farm Location</Label>
                <select
                  id="batch_farm"
                  value={farmLocation}
                  onChange={e => setFarmLocation(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Select Farm --</option>
                  {farms.map(f => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch_type" className="text-xs font-bold text-slate-700">Program Type</Label>
                <select
                  id="batch_type"
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  {batchTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch_start_date" className="text-xs font-bold text-slate-700">Start Date</Label>
                <Input
                  type="date"
                  id="batch_start_date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  className="text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch_status" className="text-xs font-bold text-slate-700">Status</Label>
                <select
                  id="batch_status"
                  value={status}
                  onChange={e => setStatus(e.target.value as 'Active' | 'Closed')}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Selling Target */}
          <div className="space-y-3">
            <SectionLabel>Selling Target</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="batch_price" className="text-xs font-bold text-slate-700">Expected Selling Price (៛) / តម្លៃលក់រំពឹងទុក</Label>
                <Input
                  type="number"
                  id="batch_price"
                  value={expectedSellingPrice}
                  onChange={e => setExpectedSellingPrice(e.target.value)}
                  placeholder="ឧទាហរណ៍៖ 18,000"
                  className="text-xs font-bold font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="batch_target_date" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Selling Target Date</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(Auto: Start + 90d)</span>
                </Label>
                <Input
                  id="batch_target_date"
                  value={sellingTargetDate}
                  readOnly
                  disabled
                  className="font-mono text-xs font-bold bg-slate-100/90 text-slate-600 border-slate-200 cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-3">
            <SectionLabel>Notes</SectionLabel>
            <Input
              id="batch_notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ព័ត៌មានបន្ថែមអំពីក្រុមគោនេះ..."
              className="text-xs"
            />
          </div>

          {/* Section 5: Initial Cows Selection (Only in Create Mode) */}
          {!isEditMode && (
            <div className="space-y-3 pt-1">
              <SectionLabel>Initial Cattle Selection</SectionLabel>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  ជ្រើសរើសគោបញ្ចូលក្រុមដំបូង ({selectedCowIds.length} Selected)
                  {selectedCowIds.length < 3 ? (
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                      ⚠️ Min 3 cows required
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      ✓ Ready ({selectedCowIds.length} cows)
                    </span>
                  )}
                </Label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {unassignedCows.length} Available Cows
                </span>
              </div>

              {/* Search & Breed & Sex Filter Bar */}
              <div className="grid grid-cols-3 gap-2 pb-1">
                <Input
                  placeholder="Search ID / breed..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-7 text-xs"
                />
                <select
                  value={breedFilter}
                  onChange={e => setBreedFilter(e.target.value)}
                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="">🐄 All Breeds</option>
                  {Array.from(new Set(unassignedCows.map(c => c.breed).filter(Boolean))).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <select
                  value={sexFilter}
                  onChange={e => setSexFilter(e.target.value)}
                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="">🚻 All Sexes</option>
                  <option value="M">Male (M / ឈ្មោល)</option>
                  <option value="F">Female (F / ញី)</option>
                </select>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 p-2 rounded-xl bg-slate-50/50">
                {filteredUnassignedCows.length > 0 ? (
                  filteredUnassignedCows.map(cow => {
                    const isChecked = selectedCowIds.includes(cow.id);
                    return (
                      <div
                        key={cow.id}
                        onClick={() => toggleCowSelect(cow.id)}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className="font-black text-slate-800">{cow.id}</span>
                          <span className="ml-2 text-slate-500">{cow.breed} • {cow.weight} kg • {cow.sex}</span>
                        </div>
                        {isChecked && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-center text-slate-400 py-6 font-medium">
                    {unassignedCows.length === 0 ? 'គ្មានគោទំនេរដាច់ដោយឡែកក្នុងស្តុកឡើយ។' : 'មិនមានគោត្រូវនឹងការតម្រងឡើយ (No cows match filter).'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-bold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl px-6"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? '💾 រក្សាទុក (Save Changes)' : '💾 បង្កើតក្រុម (Create Batch)'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
