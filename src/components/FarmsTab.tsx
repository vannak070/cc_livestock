'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building, 
  User, 
  MapPin, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  BarChart2, 
  Compass, 
  Check,
  AlertCircle,
  Key,
  Mail,
  Lock
} from 'lucide-react';
import { updateSettingsAction, updateStockLocationAction } from '@/app/actions';
import { MasterSetup, FarmItem, UserRoleItem, DEFAULT_ROLE_PERMISSIONS, StockItem, BatchItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ConfirmModal } from './ui/confirm-modal';
import { useLanguage } from '@/context/LanguageContext';

interface FarmsTabProps {
  settings: MasterSetup;
  currentUser: UserRoleItem | null;
  stock: StockItem[];
  batches: BatchItem[];
}

export default function FarmsTab({ settings, currentUser, stock, batches }: FarmsTabProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddingFarm, setIsAddingFarm] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmItem | null>(null);

  // Form States
  const [farmName, setFarmName] = useState('');
  const [farmAddress, setFarmAddress] = useState('');
  const [farmCapacity, setFarmCapacity] = useState<number>(100);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [farmNotes, setFarmNotes] = useState('');

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

  const farms = settings.farms || [];

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: MasterSetup) => {
      const res = await updateSettingsAction(updatedSettings);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    }
  });

  const openCreateFarmModal = () => {
    setEditingFarm(null);
    setFarmName('');
    setFarmAddress('');
    setFarmCapacity(100);
    setOwnerName('');
    setOwnerEmail('');
    setOwnerPassword('');
    setFarmNotes('');
    setIsAddingFarm(true);
  };

  const openEditFarmModal = (farm: FarmItem) => {
    setEditingFarm(farm);
    setFarmName(farm.name);
    setFarmAddress(farm.address || '');
    setFarmCapacity(farm.capacity || 100);
    
    // Find the owner user of this farm location
    const ownerUser = settings.users.find(u => u.farmLocation === farm.name && u.role === 'Farm Owner');
    setOwnerName(ownerUser ? ownerUser.name : farm.ownerName || '');
    setOwnerEmail(ownerUser ? ownerUser.email : farm.ownerEmail || '');
    setOwnerPassword(''); // never prefill — the API no longer returns stored passwords
    
    setFarmNotes(farm.notes || '');
    setIsAddingFarm(true);
  };

  const handleSaveFarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) return;

    let updatedFarms = [...farms];
    let updatedLocations = [...(settings.locations || [])];
    let updatedUsers = [...(settings.users || [])];

    const newName = farmName.trim();
    const email = ownerEmail.trim().toLowerCase();

    if (editingFarm) {
      const oldName = editingFarm.name;

      updatedFarms = updatedFarms.map(f => f.id === editingFarm.id ? {
        ...f,
        name: newName,
        address: farmAddress.trim(),
        capacity: farmCapacity,
        ownerName: ownerName.trim(),
        ownerEmail: email,
        notes: farmNotes.trim()
      } : f);

      // Sync Location names list
      updatedLocations = updatedLocations.map(loc => loc === oldName ? newName : loc);
      if (!updatedLocations.includes(newName)) {
        updatedLocations.push(newName);
      }

      // Sync User location scopes and update owner user credentials
      const existingOwnerIdx = updatedUsers.findIndex(u => u.farmLocation === oldName && u.role === 'Farm Owner');
      
      if (existingOwnerIdx !== -1) {
        const typedPassword = ownerPassword.trim();
        updatedUsers[existingOwnerIdx] = {
          ...updatedUsers[existingOwnerIdx],
          name: ownerName.trim(),
          email: email,
          // Omit when nothing typed — backend keeps the existing password
          // hash instead of resetting it.
          ...(typedPassword ? { password: typedPassword } : {}),
          farmLocation: newName,
          permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner']
        };
      } else {
        const newOwnerUser: UserRoleItem = {
          id: `USR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          name: ownerName.trim(),
          email: email,
          role: 'Farm Owner',
          status: 'Active',
          password: ownerPassword.trim(), // if blank, backend assigns a temp password and logs it server-side
          farmLocation: newName,
          permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner']
        };
        updatedUsers.push(newOwnerUser);
      }

      // Sync location scope for other users on this farm (Staff, Vets)
      updatedUsers = updatedUsers.map(u => {
        if (u.farmLocation === oldName) {
          return { ...u, farmLocation: newName };
        }
        return u;
      });

    } else {
      const newFarm: FarmItem = {
        id: `FARM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: newName,
        address: farmAddress.trim(),
        capacity: farmCapacity,
        ownerName: ownerName.trim(),
        ownerEmail: email,
        notes: farmNotes.trim()
      };

      updatedFarms.push(newFarm);

      // Add Location name
      if (!updatedLocations.includes(newName)) {
        updatedLocations.push(newName);
      }

      // Create owner user login account
      const newOwnerUser: UserRoleItem = {
        id: `USR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: ownerName.trim(),
        email: email,
        role: 'Farm Owner',
        status: 'Active',
        password: ownerPassword.trim(),
        farmLocation: newName,
        permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner']
      };
      updatedUsers.push(newOwnerUser);
    }

    const updatedSettings: MasterSetup = {
      ...settings,
      farms: updatedFarms,
      locations: updatedLocations,
      users: updatedUsers
    };

    if (editingFarm && editingFarm.name !== newName) {
      updateStockLocationAction(editingFarm.name, newName);
    }

    updateSettingsMutation.mutate(updatedSettings);
    setIsAddingFarm(false);
  };

  const handleDeleteFarm = (farmId: string) => {
    const target = farms.find(f => f.id === farmId);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Farm Branch?',
      description: `Are you sure you want to delete the farm "${target.name}"? Active cows and staff assigned to this farm will have their location scopes unassigned. The owner login account will be removed.`,
      type: 'danger',
      confirmText: 'Delete Farm',
      onConfirm: () => {
        const updatedFarms = farms.filter(f => f.id !== farmId);
        const updatedLocations = (settings.locations || []).filter(loc => loc !== target.name);
        
        // Remove owner user account and set location scope to undefined for others
        const updatedUsers = (settings.users || [])
          .filter(u => !(u.farmLocation === target.name && u.role === 'Farm Owner'))
          .map(u => {
            if (u.farmLocation === target.name) {
              return { ...u, farmLocation: undefined };
            }
            return u;
          });

        const updatedSettings: MasterSetup = {
          ...settings,
          farms: updatedFarms,
          locations: updatedLocations,
          users: updatedUsers
        };

        updateSettingsMutation.mutate(updatedSettings);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building className="h-6 w-6 text-emerald-600" />
            {t('farms.title')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('farms.subtitle')}
          </p>
        </div>
        <button
          onClick={openCreateFarmModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98] self-start sm:self-center"
        >
          <Plus className="h-4 w-4" />
          {t('farms.addFarm')}
        </button>
      </div>

      {/* Farms List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {farms.map(farm => {
          // Calculate herd stats
          const farmCows = stock.filter(c => c.location === farm.name && c.status.toLowerCase() === 'active');
          const cowCount = farmCows.length;
          const capacity = farm.capacity || 100;
          const occupancyRate = Math.min(Math.round((cowCount / capacity) * 100), 100);

          // Find Owner and Staff details
          const owner = settings.users.find(u => u.farmLocation === farm.name && u.role === 'Farm Owner');
          const staffCount = settings.users.filter(u => u.farmLocation === farm.name && u.role !== 'Farm Owner').length;
          
          // Calculate active feeding batches
          const activeBatches = batches.filter(b => b.status === 'Active' && farmCows.some(c => b.cowIds.includes(c.id))).length;

          return (
            <div 
              key={farm.id} 
              className="bg-white border border-slate-200 rounded-2xl shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden relative"
            >
              {/* Header Accent */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-teal-500" />

              <div className="p-6 space-y-5 flex-1">
                {/* Title & Actions */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">{farm.name}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">ID: {farm.id}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditFarmModal(farm)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFarm(farm.id)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Cattle Occupancy</span>
                    <span className="text-slate-800">{cowCount} / {capacity} Head ({occupancyRate}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
 occupancyRate > 90 ? 'bg-rose-500' : occupancyRate > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>

                {/* Staff & Herd Badges */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                    <p className="text-xs font-bold text-slate-400 ">Cattle Count</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{cowCount}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                    <p className="text-xs font-bold text-slate-400 ">Staff Size</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{staffCount}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                    <p className="text-xs font-bold text-slate-400 ">Feed Batches</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{activeBatches}</p>
                  </div>
                </div>

                {/* Owner Account and Login */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 font-medium">Farm Owner:</span>
                    <span className="text-slate-800 font-bold">{owner ? owner.name : farm.ownerName || 'Not Created (គ្មានកំណត់)'}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                      <Mail className="h-3 w-3 text-emerald-600" />
                      <span>Email:</span>
                      <span className="text-slate-800 select-all">{owner ? owner.email : farm.ownerEmail || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                      <Key className="h-3 w-3 text-emerald-600" />
                      <span>Password:</span>
                      <span className="text-slate-400 italic font-normal">{owner ? 'Set via Edit Farm' : 'Not created'}</span>
                    </div>
                  </div>
                </div>

                {/* Location metadata */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  {farm.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-650 font-medium leading-relaxed">{farm.address}</span>
                    </div>
                  )}
                  {farm.notes && (
                    <div className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <AlertCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-slate-500 leading-normal font-medium">{farm.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Farm Branch Dialog Modal */}
      <Dialog open={isAddingFarm} onOpenChange={setIsAddingFarm}>
        <DialogContent className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left pb-4 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-600 animate-pulse" />
              {editingFarm ? `Edit Farm: ${editingFarm.name}` : 'Create New Farm Branch'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Configure parameters, capacities, address and owner login credentials for this location.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFarm} className="space-y-4 pt-4 text-left">
            {/* Core Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-slate-400">Farm Branch Name (ទីតាំងក្រោល)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ក្រោល C, ព្រៃវែង"
                  value={farmName}
                  onChange={e => setFarmName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-slate-400">Capacity (Cows Limit)</label>
                <input
                  type="number"
                  required
                  min={10}
                  max={1000}
                  placeholder="100"
                  value={farmCapacity}
                  onChange={e => setFarmCapacity(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Farm Owner Login Creation Details */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <Lock className="h-4 w-4 text-emerald-600" />
                Configure Farm Owner Login Account
              </h4>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Owner Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bona SNR Owner"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Login Corporate Email (Username)</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. owner@snrfarm.com"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Login Password</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. pass123"
                  value={ownerPassword}
                  onChange={e => setOwnerPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-655"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Farm Address / Geo Location</label>
              <input
                type="text"
                placeholder="District, Province, Country..."
                value={farmAddress}
                onChange={e => setFarmAddress(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Operational Notes</label>
              <textarea
                placeholder="Enter specialized diet requirements, hardware setups, or remarks..."
                value={farmNotes}
                onChange={e => setFarmNotes(e.target.value)}
                rows={3}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setIsAddingFarm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-6 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {editingFarm ? '💾 Update Farm & Login' : '💾 Save Farm & Login'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
