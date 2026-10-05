'use client';

import React, { useState, useEffect } from 'react';
import { ERPLivestockData, BatchItem, HealthLogItem, FarmItem, UserRoleItem } from '@/lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Users, UserMinus, UserPlus, Calendar, Info, Layers, Trash2, ShieldAlert, TrendingUp, Plus, FileText, CheckCircle2, Heart, Scale, Sparkles, Search, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ConfirmModal } from './ui/confirm-modal';
import { BatchModal } from './features/batch/BatchModal';
import { hasPermission, format2Decimals, format2DecimalsWithCommas, getErrorMessage } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import FarmFilterBar from './FarmFilterBar';
import { TablePagination } from './common/TablePagination';
import { exportToExcel } from '@/lib/excel-export';
import { DateRangeFilterBar } from './common/DateRangeFilterBar';

interface BatchTabProps {
  data: ERPLivestockData;
  onCreateBatch: (batch: Omit<BatchItem, 'cowIds'>) => Promise<void>;
  onAssignCows: (batchId: string, cowIds: string[]) => Promise<void>;
  onRemoveCow: (batchId: string, cowId: string) => Promise<void>;
  onUpdateBatch: (batchId: string, updates: Partial<BatchItem>) => Promise<void>;
  onRecordBatchWeights?: (records: { cowId: string; currentWeight: number; healthStatus: string; trackingDate?: string }[]) => Promise<void>;
  onRecordBatchHealthLog?: (batchId: string, log: Omit<HealthLogItem, 'id' | 'cowId'>) => Promise<void>;
  onDeleteBatch?: (batchId: string) => Promise<void>;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

export default function BatchTab({
  data,
  onCreateBatch,
  onAssignCows,
  onRemoveCow,
  onUpdateBatch,
  onRecordBatchWeights,
  onDeleteBatch,
  currentUser,
  farms = []
}: BatchTabProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [isAllBatchesOpen, setIsAllBatchesOpen] = useState(false);

  // Scope batches by farm selection or assigned user farm
  const userFarm = currentUser?.farmLocation;
  const effectiveFarm = userFarm || selectedFarm;

  const visibleBatches = React.useMemo(() => {
    if (effectiveFarm) {
      return data.batches.filter(b => 
        b.farmLocation === effectiveFarm || 
        data.stock.some(s => s.location === effectiveFarm && b.cowIds?.includes(s.id))
      );
    }
    return data.batches;
  }, [data.batches, data.stock, effectiveFarm]);

  // Count batches per farm for FarmFilterBar
  const countByFarm = React.useMemo(() => {
    const map: Record<string, number> = {};
    data.batches.forEach(b => {
      if (b.farmLocation) {
        map[b.farmLocation] = (map[b.farmLocation] || 0) + 1;
      } else {
        // If farmLocation isn't directly on batch, check member cow locations
        const memberCow = data.stock.find(s => b.cowIds?.includes(s.id) && s.location);
        if (memberCow?.location) {
          map[memberCow.location] = (map[memberCow.location] || 0) + 1;
        }
      }
    });
    return map;
  }, [data.batches, data.stock]);

  // Active or selected batch lookup
  const activeBatches = visibleBatches.filter(b => b.status === 'Active');
  const defaultBatch = visibleBatches.find(b => b.id === selectedBatchId)
    || visibleBatches.find(b => b.status === 'Active' && (b.type === 'Fattening Program' || b.type.includes('Fattening')))
    || activeBatches[0]
    || visibleBatches[0];

  // Auto-sync selected batch when farm changes
  useEffect(() => {
    if (visibleBatches.length > 0) {
      if (!visibleBatches.some(b => b.id === selectedBatchId)) {
        setSelectedBatchId(visibleBatches[0].id);
      }
    } else {
      setSelectedBatchId('');
    }
  }, [selectedFarm, visibleBatches]);

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

  const { t } = useLanguage();
  // Local tab views inside default batch
  const [subView, setSubView] = useState<'members' | 'feed' | 'report'>('members');
  const [isScalingOpen, setIsScalingOpen] = useState(false);
  
  // ADG Growth Report Date Range Filter State
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  // Dynamic Feeding Program Form States
  const DEFAULT_INGREDIENTS = [
    { id: '1', name: 'DSR-16 Concentrate Feed', portionPerHead: '3.5', unitCost: '2000' },
    { id: '2', name: 'Corn / Grass Silage', portionPerHead: '15.0', unitCost: '350' },
    { id: '3', name: 'Rice Straw Roughage', portionPerHead: '2.0', unitCost: '150' },
  ];
  const [feedIngredients, setFeedIngredients] = useState<Array<{ id: string; productId?: string; name: string; portionPerHead: string; unitCost: string }>>(DEFAULT_INGREDIENTS);
  const [feedProgFrequency, setFeedProgFrequency] = useState('Twice Daily');
  const [feedProgStartDate, setFeedProgStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [feedProgEndDate, setFeedProgEndDate] = useState('');
  const [feedProgStatus, setFeedProgStatus] = useState<'Active' | 'Paused' | 'Completed'>('Active');
  const [feedProgNote, setFeedProgNote] = useState('');
  const [isSavingFeedProg, setIsSavingFeedProg] = useState(false);
  // Pagination States for Batch Tables
  const [herdMemberPage, setHerdMemberPage] = useState(1);
  const [herdMemberPageSize, setHerdMemberPageSize] = useState(10);

  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);

  // Weight scaling form states
  const [scaleInputs, setScaleInputs] = useState<Record<string, { weight: number; healthStatus: string }>>({});
  const [scalingDate, setScalingDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingWeights, setIsSubmittingWeights] = useState(false);
  const [scaleSearchQuery, setScaleSearchQuery] = useState('');

  // Sampling States
  const [isSamplingMode, setIsSamplingMode] = useState(false);
  const [sampleBestId, setSampleBestId] = useState('');
  const [sampleMediumId, setSampleMediumId] = useState('');
  const [sampleLowId, setSampleLowId] = useState('');
  const [sampleBestWeight, setSampleBestWeight] = useState('');
  const [sampleMediumWeight, setSampleMediumWeight] = useState('');
  const [sampleLowWeight, setSampleLowWeight] = useState('');

  // Search/Filters for unallocated cows
  const [searchUnassigned, setSearchUnassigned] = useState('');
  const [breedFilter, setBreedFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [selectedCowIds, setSelectedCowIds] = useState<string[]>([]);
  const [isInitializingHerd, setIsInitializingHerd] = useState(false);

  // Quick-start launcher form state
  const [launchName, setLaunchName] = useState('Fattening Program ' + new Date().getFullYear());
  const [launchBatchId, setLaunchBatchId] = useState(() => `FAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [launchFarm, setLaunchFarm] = useState(currentUser?.farmLocation || '');
  const [launchStartDate, setLaunchStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [launchError, setLaunchError] = useState('');
  const [launchCowIds, setLaunchCowIds] = useState<string[]>([]);
  const [launchCowSearch, setLaunchCowSearch] = useState('');

  // Auto-sync launchFarm & filterFarm if currentUser has farmLocation
  useEffect(() => {
    if (currentUser?.farmLocation) {
      setLaunchFarm(currentUser.farmLocation);
      setFilterFarm(currentUser.farmLocation);
    }
  }, [currentUser]);

  // Helper to find matching feed product from Cattle Feed Stock catalog set by admin
  const findMatchingFeedProduct = (name: string, productId?: string) => {
    const products = data.feedProducts || [];
    if (productId) {
      const match = products.find(p => p.id === productId);
      if (match) return match;
    }
    if (!name) return null;
    const nameLower = name.toLowerCase().trim();
    return products.find(p =>
      p.id.toLowerCase() === nameLower ||
      p.name.toLowerCase() === nameLower ||
      p.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(p.name.toLowerCase())
    ) || null;
  };

  // Sync feed program states when defaultBatch or data.feedProducts changes
  useEffect(() => {
    if (defaultBatch?.feedingProgram) {
      const prog = defaultBatch.feedingProgram;
      if (prog.ingredients && prog.ingredients.length > 0) {
        setFeedIngredients(
          prog.ingredients.map((ing, idx) => {
            const matched = findMatchingFeedProduct(ing.name);
            return {
              id: String(idx + 1) + '-' + Date.now(),
              productId: matched?.id || '',
              name: ing.name,
              portionPerHead: String(ing.portionPerHead ?? 0),
              unitCost: matched ? String(matched.unitCost) : String(ing.unitCost ?? 0)
            };
          })
        );
      } else {
        setFeedIngredients(DEFAULT_INGREDIENTS);
      }
      setFeedProgFrequency(prog.frequency || 'Twice Daily');
      setFeedProgStartDate(prog.startDate || new Date().toISOString().split('T')[0]);
      setFeedProgEndDate(prog.endDate || '');
      setFeedProgStatus(prog.status || 'Active');
      setFeedProgNote(prog.notes || '');
    } else {
      setFeedIngredients(DEFAULT_INGREDIENTS);
    }
  }, [defaultBatch, data.feedProducts]);

  // Sync scaling inputs when dialog opens
  const openScalingDialog = () => {
    if (!defaultBatch) return;
    const cohortCows = activeCows.filter(c => defaultBatch.cowIds.includes(c.id));
    const inputs: Record<string, { weight: number; healthStatus: string }> = {};
    cohortCows.forEach(c => {
      inputs[c.id] = { weight: c.weight, healthStatus: c.healthStatus };
    });
    setScaleInputs(inputs);
    setScalingDate(new Date().toISOString().split('T')[0]);
    setIsScalingOpen(true);
  };

  // Find cows that are NOT in any active batch
  const allAssignedCowIds = data.batches
    .filter(b => b.status === 'Active')
    .flatMap(b => b.cowIds);

  const activeCows = effectiveFarm
    ? data.stock.filter(c => c.status.toLowerCase() === 'active' && c.location === effectiveFarm)
    : data.stock.filter(c => c.status.toLowerCase() === 'active');

  const unassignedCows = activeCows.filter(c => !allAssignedCowIds.includes(c.id));

  const filteredUnassignedCows = unassignedCows.filter(cow => {
    const query = searchUnassigned.toLowerCase().trim();
    const matchesSearch = !query ||
      cow.id.toLowerCase().includes(query) ||
      cow.breed.toLowerCase().includes(query) ||
      cow.location.toLowerCase().includes(query);
    const matchesBreed = !breedFilter || cow.breed === breedFilter;
    const matchesSex = !sexFilter || (cow.sex && cow.sex.toLowerCase().trim() === sexFilter.toLowerCase().trim());
    const matchesFarm = !filterFarm || cow.location === filterFarm;
    return matchesSearch && matchesBreed && matchesSex && matchesFarm;
  });

  const handleSelectAllFiltered = () => {
    const ids = filteredUnassignedCows.map(c => c.id);
    setSelectedCowIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAll = () => {
    setSelectedCowIds([]);
  };

  // Initialize Fattening Herd Default Batch
  const handleInitializeHerd = async () => {
    setIsInitializingHerd(true);
    try {
      const defaultFeeding = {
        ingredients: [
          { name: "DSR-16 Concentrate Feed", portionPerHead: 3.5, unitCost: 2000 },
          { name: "Corn / Grass Silage", portionPerHead: 15.0, unitCost: 350 },
          { name: "Rice Straw Roughage", portionPerHead: 2.0, unitCost: 150 }
        ],
        frequency: 'Twice Daily',
        startDate: new Date().toISOString().split('T')[0],
        status: 'Active' as const,
        notes: 'Default recommended fattening program diet.'
      };

      const newBatchId = `FAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      await onCreateBatch({
        id: newBatchId,
        name: 'Fattening Herd',
        type: 'Fattening Program',
        startDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        notes: 'Unified Active Fattening Program Herd.',
        farmLocation: currentUser?.farmLocation || undefined,
        feedingProgram: defaultFeeding
      });

      setSelectedBatchId(newBatchId);

      setConfirmModal({
        isOpen: true,
        title: 'កម្មវិធីបំប៉នត្រូវបានចាប់ផ្តើម',
        description: 'កម្មវិធីបំប៉នសរុបត្រូវបានបង្កើតឡើងដោយជោគជ័យ។ ឥឡូវលោកអ្នកអាចបន្ថែមគោបំប៉ន និងកំណត់ចំណីអាហារបានហើយ!',
        type: 'success',
        confirmText: 'Okay'
      });
    } catch (err) {
      setConfirmModal({
        isOpen: true,
        title: 'Error Starting Program',
        description: getErrorMessage(err, 'Failed to start default fattening herd.'),
        type: 'danger',
        confirmText: 'Dismiss'
      });
    } finally {
      setIsInitializingHerd(false);
    }
  };

  const handleSaveBatch = async (batchData: Omit<BatchItem, 'cowIds'>, initialCowIds: string[]) => {
    try {
      if (editingBatch) {
        await onUpdateBatch(batchData.id, batchData);
        setConfirmModal({
          isOpen: true,
          title: 'កែប្រែបានជោគជ័យ',
          description: `ព័ត៌មានក្រុម "${batchData.name}" ត្រូវបានកែប្រែ។`,
          type: 'success',
          confirmText: 'Okay'
        });
      } else {
        await onCreateBatch(batchData);
        if (initialCowIds.length > 0) {
          await onAssignCows(batchData.id, initialCowIds);
        }
        setSelectedBatchId(batchData.id);
        setConfirmModal({
          isOpen: true,
          title: 'បង្កើតក្រុមថ្មីបានជោគជ័យ',
          description: `ក្រុម "${batchData.name}" (${batchData.id}) ត្រូវបានបង្កើតឡើង។`,
          type: 'success',
          confirmText: 'Okay'
        });
      }
      setEditingBatch(null);
      setIsCreateBatchModalOpen(false);
    } catch (err) {
      setConfirmModal({
        isOpen: true,
        title: 'Batch Action Error',
        description: getErrorMessage(err, 'Failed to save batch.'),
        type: 'danger',
        confirmText: 'Dismiss'
      });
    }
  };

  // Quick-start launcher: launches a fattening program with full details
  const handleLaunchProgram = async () => {
    setLaunchError('');
    if (!launchName.trim()) { setLaunchError('Program name is required.'); return; }
    if (!launchBatchId.trim()) { setLaunchError('Batch code is required.'); return; }
    if (launchCowIds.length < 3) {
      setLaunchError('កម្មវិធីបំប៉នតម្រូវឱ្យជ្រើសរើសគោយ៉ាងហោចណាស់ ៣ ក្បាលឡើងទៅ។ (A fattening batch requires at least 3 cows.)');
      return;
    }
    setIsInitializingHerd(true);
    try {
      const defaultFeeding = {
        ingredients: [
          { name: "DSR-16 Concentrate Feed", portionPerHead: 3.5, unitCost: 2000 },
          { name: "Corn / Grass Silage", portionPerHead: 15.0, unitCost: 350 },
          { name: "Rice Straw Roughage", portionPerHead: 2.0, unitCost: 150 }
        ],
        frequency: 'Twice Daily',
        startDate: launchStartDate,
        status: 'Active' as const,
        notes: 'Default recommended fattening program diet.'
      };
      await onCreateBatch({
        id: launchBatchId.trim(),
        name: launchName.trim(),
        type: 'Fattening Program',
        startDate: launchStartDate,
        status: 'Active',
        notes: `Fattening program started on ${new Date(launchStartDate).toLocaleDateString()}.`,
        farmLocation: launchFarm || currentUser?.farmLocation || undefined,
        feedingProgram: defaultFeeding
      });
      if (launchCowIds.length > 0) {
        await onAssignCows(launchBatchId.trim(), launchCowIds);
      }
      const createdId = launchBatchId.trim();
      setSelectedBatchId(createdId);
      setConfirmModal({
        isOpen: true,
        title: '🚀 Fattening Program Started!',
        description: `"${launchName}" has been launched successfully${launchCowIds.length > 0 ? ` with ${launchCowIds.length} cattle enrolled` : ''}. You can now manage feed rations, record weights, and track ADG.`,
        type: 'success',
        confirmText: "Let's Go!",
        onConfirm: () => {
          setSelectedBatchId(createdId);
          setLaunchName('Fattening Program ' + new Date().getFullYear());
          setLaunchBatchId(`FAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
          setLaunchCowIds([]);
        }
      });
    } catch (err) {
      setLaunchError(getErrorMessage(err, 'Failed to start fattening program. Please try again.'));
    } finally {
      setIsInitializingHerd(false);
    }
  };

  const handleDeleteBatch = (batchId: string) => {
    if (!onDeleteBatch) return;
    const targetBatch = data.batches.find(b => b.id === batchId);
    setConfirmModal({
      isOpen: true,
      title: t('batches.deleteConfirmTitle'),
      description: t('batches.deleteConfirmDesc'),
      type: 'danger',
      confirmText: t('common.delete'),
      onConfirm: async () => {
        try {
          await onDeleteBatch(batchId);
          setSelectedBatchId('');
          setConfirmModal({
            isOpen: true,
            title: 'លុបបានជោគជ័យ',
            description: `ក្រុម "${batchId}" ត្រូវបានលុបចេញពីប្រព័ន្ធ។`,
            type: 'success',
            confirmText: 'Okay'
          });
        } catch (err) {
          alert(getErrorMessage(err, 'Failed to delete batch.'));
        }
      }
    });
  };

  // Submit allocation of unassigned cows
  const handleAllocateCows = async () => {
    if (!defaultBatch || selectedCowIds.length === 0) return;
    try {
      await onAssignCows(defaultBatch.id, selectedCowIds);
      setSelectedCowIds([]);
      setConfirmModal({
        isOpen: true,
        title: 'គោត្រូវបានដាក់ចូលបំប៉ន',
        description: `គោចំនួន ${selectedCowIds.length} ក្បាល ត្រូវបានបញ្ចូលទៅក្នុងកម្មវិធីបំប៉នរួចរាល់។`,
        type: 'success',
        confirmText: 'Okay'
      });
    } catch (err) {
      setConfirmModal({
        isOpen: true,
        title: 'Allocation Error',
        description: getErrorMessage(err, 'Failed to allocate cows.'),
        type: 'danger',
        confirmText: 'Dismiss'
      });
    }
  };

  // Remove a single cow from the program
  const handleRemoveCowFromProgram = async (cowId: string) => {
    if (!defaultBatch) return;
    setConfirmModal({
      isOpen: true,
      title: 'ដកគោចេញពីកម្មវិធីបំប៉ន?',
      description: `តើលោកអ្នកប្រាកដជាចង់ដកគោលេខសម្គាល់ ${cowId} ចេញពីកម្មវិធីបំប៉នដែរឬទេ?`,
      type: 'warning',
      confirmText: 'ដកចេញ',
      onConfirm: async () => {
        try {
          await onRemoveCow(defaultBatch.id, cowId);
        } catch (err) {
          alert(getErrorMessage(err, 'Failed to remove cow.'));
        }
      }
    });
  };

  // Ingredient management handlers
  const handleAddIngredient = () => {
    setFeedIngredients(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', portionPerHead: '1.0', unitCost: '500' }
    ]);
  };

  const handleRemoveIngredient = (id: string) => {
    setFeedIngredients(prev => prev.filter(item => item.id !== id));
  };

  const handleIngredientChange = (id: string, field: 'productId' | 'name' | 'portionPerHead' | 'unitCost', value: string) => {
    setFeedIngredients(prev => prev.map(item => {
      if (item.id !== id) return item;

      if (field === 'productId') {
        if (value === 'custom') {
          return { ...item, productId: '', name: '', unitCost: item.unitCost };
        }
        const matched = (data.feedProducts || []).find(p => p.id === value);
        if (matched) {
          return {
            ...item,
            productId: matched.id,
            name: matched.name,
            unitCost: String(matched.unitCost)
          };
        }
        return { ...item, productId: value };
      }

      if (field === 'name') {
        const matched = findMatchingFeedProduct(value);
        if (matched) {
          return {
            ...item,
            name: value,
            productId: matched.id,
            unitCost: String(matched.unitCost)
          };
        }
        return { ...item, name: value };
      }

      return { ...item, [field]: value };
    }));
  };

  // Submit feeding program updates
  const handleSaveFeeding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defaultBatch) return;
    setIsSavingFeedProg(true);
    try {
      const validIngredients = feedIngredients
        .filter(item => item.name.trim().length > 0)
        .map(item => {
          const matched = findMatchingFeedProduct(item.name, item.productId);
          const finalUnitCost = matched ? matched.unitCost : (Number(item.unitCost) || 0);
          return {
            name: item.name.trim(),
            portionPerHead: Number(item.portionPerHead) || 0,
            unitCost: finalUnitCost
          };
        });

      const feedingConfig = {
        ingredients: validIngredients,
        frequency: feedProgFrequency,
        startDate: feedProgStartDate,
        endDate: feedProgEndDate || undefined,
        status: feedProgStatus,
        notes: feedProgNote
      };

      await onUpdateBatch(defaultBatch.id, {
        feedingProgram: feedingConfig
      });

      setConfirmModal({
        isOpen: true,
        title: 'Feeding Program Updated',
        description: 'របបអាហារប្រចាំថ្ងៃសម្រាប់គោបំប៉ន ត្រូវបានកែប្រែដោយជោគជ័យ។',
        type: 'success',
        confirmText: 'Okay'
      });
    } catch (err) {
      setConfirmModal({
        isOpen: true,
        title: 'Error Saving Ration',
        description: getErrorMessage(err, 'Failed to update feeding program.'),
        type: 'danger',
        confirmText: 'Dismiss'
      });
    } finally {
      setIsSavingFeedProg(false);
    }
  };

  // Compute metrics for fattening herd
  const fatteningCowsInHerd = defaultBatch
    ? activeCows.filter(c => defaultBatch.cowIds.includes(c.id))
    : [];
  const totalBiomass = fatteningCowsInHerd.reduce((sum, c) => sum + c.weight, 0);
  const avgBiomass = fatteningCowsInHerd.length > 0 ? Math.round(totalBiomass / fatteningCowsInHerd.length) : 0;

  // Calculate daily feed cost per head dynamically from admin catalog
  const dailyFeedCostPerHead = feedIngredients.reduce((sum, item) => {
    const matched = findMatchingFeedProduct(item.name, item.productId);
    const portion = Number(item.portionPerHead) || 0;
    const cost = matched ? matched.unitCost : (Number(item.unitCost) || 0);
    return sum + (portion * cost);
  }, 0);
  const totalHerdDailyFeedCost = dailyFeedCostPerHead * fatteningCowsInHerd.length;

  return (
    <div className="space-y-6">
      {/* Onboarding Welcome Panel if defaultBatch doesn't exist */}
      {!defaultBatch ? (
        /* ─── Premium Quick-Start Launcher ─── */
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero Banner */}
          <div className="bg-gradient-to-br from-[#002D26] to-[#004D3A] rounded-2xl p-6 text-white flex items-start gap-5">
            <div className="h-14 w-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold tracking-tight">Start a Fattening Program</h3>
              <p className="text-sm text-emerald-200/80 mt-1 leading-relaxed">
                Set up your fattening batch, enroll cattle, and activate the feeding schedule — all in one step.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {['🧠 AI Feed Ration', '⚡ Auto ADG Tracking', '📊 Daily Cost Reports'].map(f => (
                  <span key={f} className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden">
            {/* Section: Program Details */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-400 mb-3">─── Program Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Program Name *</label>
                  <input
                    type="text"
                    value={launchName}
                    onChange={e => setLaunchName(e.target.value)}
                    placeholder="e.g. Fattening Program 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Batch Code *</label>
                  <input
                    type="text"
                    value={launchBatchId}
                    onChange={e => setLaunchBatchId(e.target.value)}
                    placeholder="e.g. FAT-2026-001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    value={launchStartDate}
                    onChange={e => setLaunchStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section: Enroll Cattle */}
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-400">─── Enroll Cattle (Optional)</p>
                <div className="flex items-center gap-3">
                  {launchCowIds.length > 0 && (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">{launchCowIds.length} selected</span>
                  )}
                  {launchCowIds.length > 0 && (
                    <button onClick={() => setLaunchCowIds([])} className="text-xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer">✕ Clear</button>
                  )}
                </div>
              </div>

              {/* Filter row for enrolling cattle */}
              <div className={`grid grid-cols-1 ${!currentUser?.farmLocation ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2 mb-3`}>
                {/* Farm / Branch selector — only for Admin / Super Admin (Farm Owners don't need to choose) */}
                {!currentUser?.farmLocation && (
                  <select
                    value={launchFarm}
                    onChange={e => { setLaunchFarm(e.target.value); setLaunchCowIds([]); }}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer transition-all"
                  >
                    <option value="">🏚️ All Farms & Branches</option>
                    {(data.settings?.farms ?? []).map(f => (
                      <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ID or breed..."
                    value={launchCowSearch}
                    onChange={e => setLaunchCowSearch(e.target.value)}
                    className="w-full pl-8 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Breed filter */}
                <select
                  value={launchCowSearch.startsWith('breed:') ? launchCowSearch.replace('breed:', '') : ''}
                  onChange={e => setLaunchCowSearch(e.target.value ? `breed:${e.target.value}` : '')}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer transition-all"
                >
                  <option value="">🐄 All Breeds</option>
                  {(data.settings?.breeds ?? []).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Cattle list */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {(() => {
                  const breedVal = launchCowSearch.startsWith('breed:') ? launchCowSearch.replace('breed:', '') : '';
                  const textVal = launchCowSearch.startsWith('breed:') ? '' : launchCowSearch.toLowerCase();
                  const filtered = activeCows
                    .filter(c => !launchFarm || c.location === launchFarm)
                    .filter(c => !breedVal || c.breed === breedVal)
                    .filter(c => !textVal || c.id.toLowerCase().includes(textVal) || c.breed.toLowerCase().includes(textVal));
                  if (filtered.length === 0) {
                    return <p className="text-center text-xs text-slate-400 py-4">No cattle match your filters.</p>;
                  }
                  return (
                    <>
                      <div className="flex items-center justify-between px-1 pb-1">
                        <button
                          type="button"
                          onClick={() => setLaunchCowIds(prev => Array.from(new Set([...prev, ...filtered.map(c => c.id)])))}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          + Select All ({filtered.length})
                        </button>
                      </div>
                      {filtered.map(cow => {
                        const checked = launchCowIds.includes(cow.id);
                        return (
                          <div
                            key={cow.id}
                            onClick={() => setLaunchCowIds(prev => checked ? prev.filter(i => i !== cow.id) : [...prev, cow.id])}
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
 checked
 ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div>
                              <span className="font-bold text-slate-800">{cow.id}</span>
                              <span className="ml-2 text-slate-400">{cow.breed} • {cow.weight} kg</span>
                              <span className="ml-2 text-xs text-slate-400 font-medium">{cow.location}</span>
                            </div>
                            {checked && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">You can also add cattle after the program is created.</p>
            </div>

            {/* Footer: Error + Launch Button */}
            <div className="px-6 py-4 bg-slate-50/40">
              {launchError && (
                <div className="mb-3 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                  <ShieldAlert className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-rose-700">{launchError}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-slate-400 font-medium">
                  {launchCowIds.length > 0 ? `🐄 ${launchCowIds.length} cattle will be enrolled immediately.` : 'No cattle enrolled yet — you can add them later.'}
                </p>
                <Button
                  onClick={handleLaunchProgram}
                  disabled={isInitializingHerd || !launchName.trim() || !launchBatchId.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInitializingHerd ? (
                    <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Starting...</>
                  ) : (
                    <><TrendingUp className="h-4 w-4" /> Launch Fattening Program</>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Or: Create a Custom Batch */}
          {hasPermission(currentUser, 'batch_create') && (
            <div className="flex items-center gap-3 text-slate-400">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-bold ">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}
          {hasPermission(currentUser, 'batch_create') && (
            <button
              onClick={() => { setEditingBatch(null); setIsCreateBatchModalOpen(true); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-400 text-slate-400 hover:text-emerald-600 text-sm font-bold transition-all cursor-pointer group"
            >
              <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
              Create Custom Batch (Quarantine, Selling Pool, Breeding...)
            </button>
          )}
        </div>
      ) : (
        /* Main Dashboard Panel */
        <>
          {/* STEP 1: SELECT FARM FIRST */}
          <FarmFilterBar
            farms={farms}
            selectedFarm={selectedFarm}
            onFarmChange={setSelectedFarm}
            countByFarm={countByFarm}
            totalCount={data.batches.length}
            label="batches"
            currentUser={currentUser}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-600 animate-pulse" />
                {t('batches.title')}
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                {t('batches.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {visibleBatches.length > 0 && (
                <select
                  value={defaultBatch?.id || ''}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-xs focus:outline-none cursor-pointer"
                >
                  {visibleBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.id}) - {b.status}
                    </option>
                  ))}
                </select>
              )}

              {hasPermission(currentUser, 'batch_create') && (
                <Button
                  onClick={() => {
                    setEditingBatch(null);
                    setIsCreateBatchModalOpen(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs py-2 px-3 shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> {t('batches.newBatch')}
                </Button>
              )}

              <Button
                onClick={() => setIsAllBatchesOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs py-2 px-3 shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Layers className="h-4 w-4 text-emerald-600" /> 📋 All Batches ({visibleBatches.length})
              </Button>

              {hasPermission(currentUser, 'weight_record') && (
                <Button
                  onClick={openScalingDialog}
                  className="bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs py-2 px-4 shadow-md flex items-center gap-1.5 cursor-pointer transition-all hover:translate-y-[-1px]"
                >
                  <Scale className="h-4 w-4" /> ⚖️ {t('weight.recordWeights')}
                </Button>
              )}
            </div>
          </div>

          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 text-left">
            <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-xs">
              <p className="text-xs font-bold text-slate-400 ">Cattle In Fattening</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {fatteningCowsInHerd.length}{' '}
                <span className="text-xs font-bold text-emerald-600">Head</span>
              </p>
            </div>
            <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-xs">
              <p className="text-xs font-bold text-slate-400 ">Total Herd Biomass</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {format2DecimalsWithCommas(totalBiomass)}{' '}
                <span className="text-xs font-bold text-blue-600">kg</span>
              </p>
            </div>
            <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-xs">
              <p className="text-xs font-bold text-slate-400 ">Avg Weight per Head</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {format2Decimals(avgBiomass)}{' '}
                <span className="text-xs font-bold text-slate-500">kg</span>
              </p>
            </div>
            <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-xs">
              <p className="text-xs font-bold text-slate-400 ">Expected Selling Price</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {defaultBatch?.expectedSellingPrice ? `៛ ${format2DecimalsWithCommas(defaultBatch.expectedSellingPrice)} / kg` : 'Not Set'}
              </p>
            </div>
            <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-xs">
              <p className="text-xs font-bold text-slate-400 ">Selling Target Date</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {defaultBatch?.sellingTargetDate || 'Not Set'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50/20 to-teal-50/25 border border-emerald-100/50 p-4.5 rounded-2xl shadow-xs animate-pulse">
              <p className="text-xs font-bold text-emerald-700 ">Daily Feed Cost (Total)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                ៛ {format2DecimalsWithCommas(totalHerdDailyFeedCost)}{' '}
                <span className="text-xs font-bold opacity-85">/ day</span>
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold w-fit">
            <button
              onClick={() => setSubView('members')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
 subView === 'members'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🧑‍🌾 {t('batches.herdAllocation')}
            </button>
            <button
              onClick={() => setSubView('feed')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
 subView === 'feed'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🌾 {t('batches.dailyFeedRation')}
            </button>
            <button
              onClick={() => setSubView('report')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
 subView === 'report'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📊 {t('batches.adgReports')}
            </button>
          </div>

          {/* Sub View Contents */}
          {subView === 'members' && (
            <div className={`grid grid-cols-1 ${hasPermission(currentUser, 'batch_edit') ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
              {/* Herd List (2 cols) */}
              <div className={hasPermission(currentUser, 'batch_edit') ? 'lg:col-span-2 space-y-4' : 'space-y-4'}>
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 text-left">
                    បញ្ជីឈ្មោះគោបំប៉នបច្ចុប្បន្ន (FATTENING HERD MEMBERS)
                  </h4>
                  <Button
                    type="button"
                    onClick={() => {
                      exportToExcel({
                        filename: `CC_Livestock_Batch_${(defaultBatch?.name || 'Fattening').replace(/\s+/g, '_')}_Members_${new Date().toISOString().split('T')[0]}.xlsx`,
                        sheetName: 'Fattening Herd Members',
                        data: fatteningCowsInHerd,
                        columns: [
                          { header: 'Cow ID', key: 'id' },
                          { header: 'Breed', key: 'breed' },
                          { header: 'Current Weight (kg)', key: 'weight' },
                          { header: 'Health Status', key: 'healthStatus' },
                          { header: 'Batch Name', key: 'id', formatter: () => defaultBatch?.name || 'Fattening Batch' }
                        ]
                      });
                    }}
                    className="h-7 text-xs gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    <Download className="h-3 w-3" /> Export Excel
                  </Button>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-xs ">
                          <th className="py-3 px-4">Cow ID</th>
                          <th className="py-3 px-4">Breed (ពូជ)</th>
                          <th className="py-3 px-4">Current Weight</th>
                          <th className="py-3 px-4">Health Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fatteningCowsInHerd.slice((herdMemberPage - 1) * herdMemberPageSize, herdMemberPage * herdMemberPageSize).length > 0 ? (
                          fatteningCowsInHerd.slice((herdMemberPage - 1) * herdMemberPageSize, herdMemberPage * herdMemberPageSize).map(cow => (
                            <tr key={cow.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-800">{cow.id}</td>
                              <td className="py-3.5 px-4 text-slate-750">{cow.breed}</td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {cow.weight} <span className="text-slate-400 text-xs">kg</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
 cow.healthStatus === 'Good'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    : cow.healthStatus === 'Poor'
                                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                  {cow.healthStatus}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {hasPermission(currentUser, 'batch_edit') ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCowFromProgram(cow.id)}
                                    className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50/50 transition-colors cursor-pointer"
                                    title="Remove from Fattening Program"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 font-bold">Locked</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                              គ្មានគោនៅក្នុងកម្មវិធីបំប៉នបច្ចុប្បន្នទេ។ សូមបន្ថែមគោពីបញ្ជីខាងស្តាំ!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    currentPage={herdMemberPage}
                    totalItems={fatteningCowsInHerd.length}
                    pageSize={herdMemberPageSize}
                    onPageChange={setHerdMemberPage}
                    onPageSizeChange={setHerdMemberPageSize}
                    itemLabel="cows"
                  />
                </div>
              </div>

              {/* Allocation List (1 col) */}
              {hasPermission(currentUser, 'batch_edit') && (
                <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-4 max-h-[600px] flex flex-col">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">
                        {t('batches.addCattleToBatch')}
                      </h4>
                      <span className="text-xs font-bold text-emerald-650 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        {selectedCowIds.length} Selected
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Select unassigned active stock cows to put on fattening</p>
                  </div>

                  <div className={`grid grid-cols-1 ${!currentUser?.farmLocation ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2`}>
                    {/* Farm / Branch filter — only for Admin / Super Admin */}
                    {!currentUser?.farmLocation && (
                      <select
                        value={filterFarm}
                        onChange={e => { setFilterFarm(e.target.value); setSelectedCowIds([]); }}
                        className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="">🏚️ All Farms</option>
                        {(data.settings?.farms ?? []).map(f => (
                          <option key={f.id} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    )}
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search ID / breed..."
                        value={searchUnassigned}
                        onChange={e => setSearchUnassigned(e.target.value)}
                        className="h-8 text-xs pl-8 placeholder:text-slate-400"
                      />
                    </div>
                    {/* Breed filter */}
                    <select
                      value={breedFilter}
                      onChange={e => setBreedFilter(e.target.value)}
                      className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">🐄 All Breeds</option>
                      {(data.settings.breeds || []).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    {/* Sex filter */}
                    <select
                      value={sexFilter}
                      onChange={e => setSexFilter(e.target.value)}
                      className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">🚻 All Sexes</option>
                      <option value="M">Male (M / ឈ្មោល)</option>
                      <option value="F">Female (F / ញី)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold px-1">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      disabled={filteredUnassignedCows.length === 0}
                      className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40 cursor-pointer"
                    >
                      + Select All ({filteredUnassignedCows.length})
                    </button>
                    {selectedCowIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 p-2 rounded-xl bg-slate-50/40">
                    {filteredUnassignedCows.length > 0 ? (
                      filteredUnassignedCows.map(cow => {
                        const isSelected = selectedCowIds.includes(cow.id);
                        return (
                          <div
                            key={cow.id}
                            onClick={() => {
                              setSelectedCowIds(prev =>
                                prev.includes(cow.id) ? prev.filter(id => id !== cow.id) : [...prev, cow.id]
                              );
                            }}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
 isSelected
 ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-left">
                              <span className="font-bold text-slate-800">{cow.id}</span>
                              <p className="text-xs text-slate-400 mt-0.5">{cow.breed} • {cow.weight} kg</p>
                            </div>
                            {isSelected ? (
                              <UserMinus className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <UserPlus className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-center text-slate-400 py-10 font-bold">
                        {unassignedCows.length === 0 ? 'All cows allocated.' : 'No stock cows match filter.'}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={handleAllocateCows}
                    disabled={selectedCowIds.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl font-bold py-2 shadow disabled:opacity-50 cursor-pointer"
                  >
                    🚀 ដាក់ចូលបំប៉ន ({selectedCowIds.length} ក្បាល)
                  </Button>
                </div>
              )}
            </div>
          )}

          {subView === 'feed' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Feeding Program Configuration Form (2 cols) */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-xs text-left">
                <div className="border-b border-slate-200 pb-3 mb-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    របបអាហារបំប៉នប្រចាំថ្ងៃ (Daily Feeding Ration Config)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Set portion sizes and unit costs for daily concentrates and roughages fed per cow.
                  </p>
                </div>

                <form onSubmit={handleSaveFeeding} className="space-y-4">
                  {/* Dynamic Ingredients List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-400 ">
                        Feed Ingredients List ({feedIngredients.length} Items)
                      </Label>
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> + បន្ថែមមុខចំណី (Add Ingredient)
                      </button>
                    </div>

                    {feedIngredients.map((item, idx) => {
                      const matchedProd = findMatchingFeedProduct(item.name, item.productId);
                      const effectiveCost = matchedProd ? matchedProd.unitCost : (Number(item.unitCost) || 0);
                      const itemPortion = Number(item.portionPerHead) || 0;
                      const itemDailyCost = itemPortion * effectiveCost;
                      const catalogProducts = data.feedProducts || [];

                      return (
                        <div key={item.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>

                              {/* Catalog Selector Dropdown */}
                              <select
                                value={matchedProd?.id || (item.name ? 'custom' : '')}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === 'custom') {
                                    handleIngredientChange(item.id, 'productId', 'custom');
                                    handleIngredientChange(item.id, 'name', '');
                                  } else {
                                    const p = catalogProducts.find(prod => prod.id === val);
                                    if (p) {
                                      handleIngredientChange(item.id, 'productId', p.id);
                                      handleIngredientChange(item.id, 'name', p.name);
                                      handleIngredientChange(item.id, 'unitCost', String(p.unitCost));
                                    }
                                  }
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                              >
                                <option value="">-- Select Feed Product from Admin Catalog --</option>
                                {catalogProducts.map(p => (
                                  <option key={p.id} value={p.id}>
                                    🌾 {p.name} ({p.category}) — ៛ {format2DecimalsWithCommas(p.unitCost)} / kg
                                  </option>
                                ))}
                                <option value="custom">✍️ Custom / Non-Catalog Ingredient Name...</option>
                              </select>
                            </div>

                            {feedIngredients.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredient(item.id)}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                                title="Remove ingredient"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Custom Name Input if 'custom' option selected or non-catalog */}
                          {(!matchedProd && (item.name === '' || item.productId === 'custom' || !catalogProducts.some(p => p.name === item.name))) && (
                            <div className="pt-1">
                              <input
                                type="text"
                                value={item.name}
                                onChange={e => handleIngredientChange(item.id, 'name', e.target.value)}
                                placeholder="Enter custom feed name (e.g. ចំបើង, ស្មៅสด)..."
                                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-3 pt-1">
                            <div>
                              <Label className="text-xs font-bold text-slate-400">Portion (kg/head/day)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={item.portionPerHead}
                                onChange={e => handleIngredientChange(item.id, 'portionPerHead', e.target.value)}
                                className="h-8 text-xs font-semibold mt-0.5"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-slate-400">Unit Cost (៛ / kg)</Label>
                                {matchedProd && (
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded ">
                                    ✓ Admin Catalog
                                  </span>
                                )}
                              </div>
                              <Input
                                type="number"
                                value={matchedProd ? matchedProd.unitCost : item.unitCost}
                                readOnly={!!matchedProd}
                                onChange={e => handleIngredientChange(item.id, 'unitCost', e.target.value)}
                                className={`h-8 text-xs font-semibold mt-0.5 ${matchedProd ? 'bg-slate-100/90 text-slate-700 font-mono font-bold cursor-not-allowed border-slate-200' : ''}`}
                                placeholder="Cost/kg"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-bold text-slate-400">Daily Cost / Head</Label>
                              <div className="h-8 flex items-center px-2.5 bg-white border border-slate-200 rounded-md font-mono text-xs font-bold text-emerald-700 mt-0.5">
                                ៛ {format2DecimalsWithCommas(itemDailyCost)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <Label htmlFor="f_frequency" className="text-xs font-bold text-slate-400 ">Feeding Frequency</Label>
                      <select
                        id="f_frequency"
                        value={feedProgFrequency}
                        onChange={e => setFeedProgFrequency(e.target.value)}
                        className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs text-slate-800 focus:outline-none cursor-pointer font-bold"
                      >
                        <option value="Once Daily">Once Daily (ម្ដងក្នុងមួយថ្ងៃ)</option>
                        <option value="Twice Daily">Twice Daily (ពីរដងក្នុងមួយថ្ងៃ)</option>
                        <option value="Three Times Daily">Three Times Daily (បីដងក្នុងមួយថ្ងៃ)</option>
                        <option value="Ad-Libitum">Ad-Libitum (ដាក់អោយស៊ីសេរី)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="f_start" className="text-xs font-bold text-slate-400 ">Ration Start Date</Label>
                      <Input
                        type="date"
                        id="f_start"
                        value={feedProgStartDate}
                        onChange={e => setFeedProgStartDate(e.target.value)}
                        required
                        className="h-9 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button
                      type="submit"
                      disabled={isSavingFeedProg}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs py-2 px-6 font-bold shadow-md cursor-pointer transition-transform active:scale-95"
                    >
                      {isSavingFeedProg ? 'Saving...' : '💾 រក្សាទុករបបអាហារ (Save Ration)'}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Feed Cost Summary Sidebar (1 col) */}
              <div className="space-y-4">
                <Card className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs text-left">
                  <h5 className="text-xs font-bold text-slate-400 border-b border-slate-50 pb-2 mb-3">
                    គណនាថ្លៃចំណី (Feed Cost Analysis)
                  </h5>
                  <div className="space-y-3.5 text-xs text-slate-650">
                    {feedIngredients.map((item) => {
                      const itemPortion = Number(item.portionPerHead) || 0;
                      const itemCost = Number(item.unitCost) || 0;
                      const costPerHead = itemPortion * itemCost;
                      return (
                        <div key={item.id} className="flex justify-between border-b border-slate-50 pb-1.5">
                          <span className="truncate pr-2 font-semibold text-slate-700">{item.name || 'Unnamed Feed'}</span>
                          <span className="font-mono font-bold text-slate-800 flex-shrink-0">៛ {format2DecimalsWithCommas(costPerHead)} / head</span>
                        </div>
                      );
                    })}

                    <div className="flex justify-between font-bold text-slate-800 text-sm bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                      <span className="text-emerald-800 font-bold">Total / Head / Day</span>
                      <span className="text-emerald-800 font-bold">៛ {format2DecimalsWithCommas(dailyFeedCostPerHead)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 text-sm bg-teal-50/50 p-2.5 rounded-xl border border-teal-100/50">
                      <span className="text-teal-800 font-bold">Herd Daily Cost ({fatteningCowsInHerd.length} head)</span>
                      <span className="text-teal-800 font-bold">៛ {format2DecimalsWithCommas(totalHerdDailyFeedCost)}</span>
                    </div>

                    {/* DSR-16 Feed Stock & Ration Link Card */}
                    {(() => {
                      const dsrTx = data.feedTransactions || [];
                      const dsrIn = dsrTx.filter(t => t.type === 'STOCK_IN').reduce((sum, t) => sum + (t.quantityBags || 0), 0);
                      const dsrOut = dsrTx.filter(t => t.type === 'STOCK_OUT').reduce((sum, t) => sum + (t.quantityBags || 0), 0);
                      const dsrOnHandBags = Math.max(0, dsrIn - dsrOut);

                      const dsrIng = feedIngredients.find(i => i.name.toLowerCase().includes('dsr-16') || i.name.toLowerCase().includes('concentrate'));
                      const dsrPortion = Number(dsrIng?.portionPerHead || 3.5);
                      const dailyHerdDsrKg = fatteningCowsInHerd.length * dsrPortion;
                      const dailyHerdDsrBags = dailyHerdDsrKg / 30;
                      const daysRemaining = dailyHerdDsrBags > 0 ? Math.floor(dsrOnHandBags / dailyHerdDsrBags) : 999;

                      return (
                        <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
 dsrOnHandBags <= 50 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <div className="flex items-center justify-between font-bold">
                            <span>📦 Live DSR-16 Feed Stock</span>
                            <span className="font-mono text-emerald-700">{format2DecimalsWithCommas(dsrOnHandBags)} bags ({format2DecimalsWithCommas(dsrOnHandBags * 30)} kg)</span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                            <span>Daily Herd Ration Rate:</span>
                            <span className="font-mono font-bold text-slate-700">{format2DecimalsWithCommas(dailyHerdDsrKg)} kg/day ({format2DecimalsWithCommas(dailyHerdDsrBags)} bags/d)</span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-slate-200/60">
                            <span>Feed Stock Coverage:</span>
                            <span className={`font-mono ${daysRemaining <= 7 ? 'text-rose-600 animate-pulse font-bold' : 'text-emerald-700'}`}>
                              {daysRemaining < 900 ? `~${daysRemaining} Days Remaining` : 'Stock Available'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {subView === 'report' && (
            (() => {
              const batchStart = new Date(defaultBatch.startDate);
              const today = new Date();
              const diffTime = Math.abs(today.getTime() - batchStart.getTime());
              const daysInBatch = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

              const rawReportData = fatteningCowsInHerd.map(cow => {
                const cowRecords = data.weightTracking.filter(r => r.cowId === cow.id);
                const sortedRecords = [...cowRecords].sort((a, b) => new Date(a.trackingDate || '').getTime() - new Date(b.trackingDate || '').getTime());
                const latestRecordDate = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].trackingDate : null;

                // Check if any weight record has been logged for this cow in this batch
                const hasWeightLogs = sortedRecords.length > 0;

                const initialWeight = hasWeightLogs
                  ? (sortedRecords[0].oldWeight || sortedRecords[0].currentWeight)
                  : cow.weight;

                const currentWeight = cow.weight;
                const gain = hasWeightLogs ? (currentWeight - initialWeight) : 0;
                const adg = hasWeightLogs && daysInBatch > 0 ? (gain / daysInBatch) : 0;

                return {
                  cow,
                  initialWeight,
                  currentWeight,
                  gain,
                  adg,
                  hasWeightLogs,
                  daysInBatch,
                  latestRecordDate
                };
              });

              const reportData = rawReportData.filter(item => {
                if (!reportStartDate && !reportEndDate) return true;
                const d = item.latestRecordDate ? item.latestRecordDate.split('T')[0] : (item.cow.purchaseDate ? item.cow.purchaseDate.split('T')[0] : null);
                if (!d) return true;
                if (reportStartDate && d < reportStartDate) return false;
                if (reportEndDate && d > reportEndDate) return false;
                return true;
              });

              const hasAnyWeightLogs = reportData.some(r => r.hasWeightLogs);

              const averageADG = hasAnyWeightLogs && reportData.length > 0
                ? reportData.reduce((sum, r) => sum + r.adg, 0) / reportData.length
                : 0;

              const sortedReportByADG = [...reportData.filter(r => r.hasWeightLogs)].sort((a, b) => b.adg - a.adg);
              const topPerformer = sortedReportByADG.length > 0 ? sortedReportByADG[0] : null;
              const underPerformer = sortedReportByADG.length > 0 ? sortedReportByADG[sortedReportByADG.length - 1] : null;

              return (
                <div className="space-y-4 mt-4">
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-slate-800 ">របាយការណ៍លូតលាស់សរុប (HERD PERFORMANCE REPORT)</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Average Daily Gain (ADG) calculated relative to herd program start date ({defaultBatch.startDate?.split('T')[0]}).</p>
                  </div>

                  {/* Summary Widgets */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl shadow-xs">
                      <p className="text-xs font-bold text-emerald-700 ">Herd Average ADG</p>
                      <p className="text-xl font-bold text-emerald-800 mt-1">{averageADG.toFixed(2)} <span className="text-xs font-bold">kg / day</span></p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl shadow-xs">
                      <p className="text-xs font-bold text-blue-700 ">Top Performer (លូតលាស់ល្អបំផុត)</p>
                      {topPerformer ? (
                        <p className="text-xl font-bold text-blue-800 mt-1">{topPerformer.cow.id} <span className="text-xs font-bold text-blue-650">({topPerformer.adg.toFixed(2)} kg/d)</span></p>
                      ) : (
                        <p className="text-xs font-bold text-blue-600 mt-2.5">Pending Weight Check</p>
                      )}
                    </div>

                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl shadow-xs">
                      <p className="text-xs font-bold text-rose-700 ">Under Performer (លូតលាស់ខ្សោយបំផុត)</p>
                      {underPerformer ? (
                        <p className="text-xl font-bold text-rose-800 mt-1">{underPerformer.cow.id} <span className="text-xs font-bold text-rose-650">({underPerformer.adg.toFixed(2)} kg/d)</span></p>
                      ) : (
                        <p className="text-xs font-bold text-rose-600 mt-2.5">Pending Weight Check</p>
                      )}
                    </div>
                  </div>

                  {/* Report Table */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200/70 p-2.5 rounded-2xl">
                    <span className="text-xs font-bold text-slate-700 pl-1">
                      📊 ADG Growth Performance Report
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DateRangeFilterBar
                        startDate={reportStartDate}
                        endDate={reportEndDate}
                        onStartDateChange={setReportStartDate}
                        onEndDateChange={setReportEndDate}
                        onResetDates={() => { setReportStartDate(''); setReportEndDate(''); }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          exportToExcel({
                            filename: `CC_Livestock_ADG_Growth_Report_${(defaultBatch?.name || 'Fattening').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
                            sheetName: 'ADG Growth Performance',
                            data: reportData,
                            columns: [
                              { header: 'Cow ID', key: 'cow.id' },
                              { header: 'Breed', key: 'cow.breed' },
                              { header: 'Initial Weight (kg)', key: 'initialWeight', formatter: (val) => format2Decimals(val) },
                              { header: 'Current Weight (kg)', key: 'currentWeight', formatter: (val) => format2Decimals(val) },
                              { header: 'Net Gain (kg)', key: 'gain', formatter: (val) => val >= 0 ? `+${format2Decimals(val)}` : format2Decimals(val) },
                              { header: 'ADG (kg/day)', key: 'adg', formatter: (val) => format2Decimals(val) },
                              { header: 'Performance Status', key: 'adg', formatter: (val) => val >= 1.0 ? 'Top Performer (Optimal)' : val >= 0.5 ? 'Normal Growth' : 'Under Performer (Low)' }
                            ]
                          });
                        }}
                        className="h-8 text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" /> Export Excel
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-xs ">
                            <th className="py-3 px-4">Cow ID</th>
                            <th className="py-3 px-4">Breed</th>
                            <th className="py-3 px-4">Initial Weight</th>
                            <th className="py-3 px-4">Current Weight</th>
                            <th className="py-3 px-4">Net Gain</th>
                            <th className="py-3 px-4">ADG (Average Daily Gain)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize).length > 0 ? (
                            reportData.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize).map(({ cow, initialWeight, currentWeight, gain, adg }) => (
                              <tr key={cow.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-800">{cow.id}</td>
                                <td className="py-3 px-4 text-slate-500">{cow.breed}</td>
                                <td className="py-3 px-4 font-mono font-bold text-slate-650">{format2Decimals(initialWeight)} kg</td>
                                <td className="py-3 px-4 font-mono font-bold text-slate-800">{format2Decimals(currentWeight)} kg</td>
                                <td className="py-3 px-4">
                                  <span className={`font-mono font-bold text-xs ${gain >= 0 ? 'text-emerald-650' : 'text-rose-500'}`}>
                                    {gain >= 0 ? `+${format2Decimals(gain)}` : format2Decimals(gain)} kg
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono">
                                  <span className={`px-2 py-0.5 rounded-md font-bold ${
 adg >= 1.0
 ? 'bg-emerald-50 text-emerald-600'
                                      : adg >= 0.5
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {format2Decimals(adg)} kg/day
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                                No report data available. Add cows to the program to begin tracking!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      currentPage={reportPage}
                      totalItems={reportData.length}
                      pageSize={reportPageSize}
                      onPageChange={setReportPage}
                      onPageSizeChange={setReportPageSize}
                      itemLabel="cows"
                    />
                  </div>
                </div>
              );
            })()
          )}
        </>
      )}

      {/* Scaling Weight Dialog */}
      {defaultBatch && (
        <Dialog open={isScalingOpen} onOpenChange={setIsScalingOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800">⚖️ កត់ទម្ងន់គោបំប៉ន (Herd Weight Logging)</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Record new weights for the fattening herd using all-cow or random sampling mode.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 ">Cohort Batch Scaling</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Record current weights and update health conditions using all-scale or random sampling estimation.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="scale_date" className="text-xs font-bold text-slate-400 ">Date</Label>
                    <Input
                      type="date"
                      id="scale_date"
                      className="h-8 py-1 px-2 text-xs w-32 border border-slate-200 rounded-lg text-slate-800"
                      value={scalingDate}
                      onChange={e => setScalingDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Scaling Mode Selector Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-fit">
                <button
                  type="button"
                  onClick={() => setIsSamplingMode(false)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${!isSamplingMode ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Weigh All Cows (គត់គីឡូទាំងអស់)
                </button>
                <button
                  type="button"
                  onClick={() => setIsSamplingMode(true)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${isSamplingMode ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Sampling Estimation (ស្ទង់ទម្ងន់គំរូ 3)
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!onRecordBatchWeights) return;
                  setIsSubmittingWeights(true);
                  try {
                    let records = [];
                    const cohortCows = activeCows.filter(c => defaultBatch.cowIds.includes(c.id));

                    if (isSamplingMode) {
                      const bestCow = cohortCows.find(c => c.id === sampleBestId);
                      const mediumCow = cohortCows.find(c => c.id === sampleMediumId);
                      const lowCow = cohortCows.find(c => c.id === sampleLowId);

                      if (!bestCow || !mediumCow || !lowCow || !sampleBestWeight || !sampleMediumWeight || !sampleLowWeight) {
                        throw new Error('សូមជ្រើសរើសគោគំរូទាំង៣ និងបញ្ចូលទម្ងន់ឱ្យបានត្រឹមត្រូវ។ (Please select all 3 sample cows and enter their weights.)');
                      }

                      const bestGain = Number(sampleBestWeight) - bestCow.weight;
                      const mediumGain = Number(sampleMediumWeight) - mediumCow.weight;
                      const lowGain = Number(sampleLowWeight) - lowCow.weight;
                      const avgGain = (bestGain + mediumGain + lowGain) / 3;

                      records = cohortCows.map(cow => {
                        let finalWeight = cow.weight;
                        if (cow.id === sampleBestId) {
                          finalWeight = Number(sampleBestWeight);
                        } else if (cow.id === sampleMediumId) {
                          finalWeight = Number(sampleMediumWeight);
                        } else if (cow.id === sampleLowId) {
                          finalWeight = Number(sampleLowWeight);
                        } else {
                          finalWeight = Math.round((cow.weight + avgGain) * 10) / 10;
                        }
                        return {
                          cowId: cow.id,
                          currentWeight: finalWeight,
                          healthStatus: cow.healthStatus,
                          trackingDate: scalingDate
                        };
                      });
                    } else {
                      records = Object.entries(scaleInputs).map(([cowId, input]) => ({
                        cowId,
                        currentWeight: Number(input.weight),
                        healthStatus: input.healthStatus,
                        trackingDate: scalingDate
                      }));
                    }

                    await onRecordBatchWeights(records);
                    setIsScalingOpen(false);
                    setConfirmModal({
                      isOpen: true,
                      title: 'Weights Recorded',
                      description: isSamplingMode
                        ? 'Sample weights logged successfully and average gains applied to all other herd members.'
                        : 'All cattle weight records for the fattening herd have been successfully logged.',
                      type: 'success',
                      confirmText: 'View Report',
                      onConfirm: () => setSubView('report')
                    });
                  } catch (err) {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Error Logging Weights',
                      description: getErrorMessage(err, 'Unknown error occurred while saving weights.'),
                      type: 'danger',
                      confirmText: 'Dismiss'
                    });
                  } finally {
                    setIsSubmittingWeights(false);
                  }
                }}
                className="space-y-4"
              >
                {isSamplingMode ? (
                  <div className="space-y-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-800">ស្ទង់ទម្ងន់គំរូ 3 (Log 3 Representative Sample Weights)</span>
                      <p className="text-xs text-slate-400 mt-0.5">Select one high-performing, one average, and one under-performing cow from the cohort.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* High Sample */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2.5">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full ">1. Best Grower (ល្អបំផុត)</span>
                        <div className="space-y-1">
                          <Label htmlFor="sample_best" className="text-xs font-bold text-slate-400">Cow ID</Label>
                          <select
                            id="sample_best"
                            value={sampleBestId}
                            onChange={e => {
                              setSampleBestId(e.target.value);
                              const cow = activeCows.find(c => c.id === e.target.value);
                              if (cow) setSampleBestWeight(String(cow.weight));
                            }}
                            className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 cursor-pointer font-bold"
                            required
                          >
                            <option value="">-- Select cow --</option>
                            {activeCows.filter(c => defaultBatch.cowIds.includes(c.id) && c.id !== sampleMediumId && c.id !== sampleLowId).map(c => (
                              <option key={c.id} value={c.id}>{c.id} ({c.breed} - {c.weight} kg)</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="sample_best_w" className="text-xs font-bold text-slate-400">New Weight (kg)</Label>
                          <Input
                            type="number"
                            id="sample_best_w"
                            value={sampleBestWeight}
                            onChange={e => setSampleBestWeight(e.target.value)}
                            className="h-8 text-xs font-mono font-bold text-slate-800"
                            placeholder="New Wt"
                            required
                          />
                        </div>
                      </div>

                      {/* Medium Sample */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2.5">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full ">2. Medium Grower (មធ្យម)</span>
                        <div className="space-y-1">
                          <Label htmlFor="sample_med" className="text-xs font-bold text-slate-400">Cow ID</Label>
                          <select
                            id="sample_med"
                            value={sampleMediumId}
                            onChange={e => {
                              setSampleMediumId(e.target.value);
                              const cow = activeCows.find(c => c.id === e.target.value);
                              if (cow) setSampleMediumWeight(String(cow.weight));
                            }}
                            className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 cursor-pointer font-bold"
                            required
                          >
                            <option value="">-- Select cow --</option>
                            {activeCows.filter(c => defaultBatch.cowIds.includes(c.id) && c.id !== sampleBestId && c.id !== sampleLowId).map(c => (
                              <option key={c.id} value={c.id}>{c.id} ({c.breed} - {c.weight} kg)</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="sample_med_w" className="text-xs font-bold text-slate-400">New Weight (kg)</Label>
                          <Input
                            type="number"
                            id="sample_med_w"
                            value={sampleMediumWeight}
                            onChange={e => setSampleMediumWeight(e.target.value)}
                            className="h-8 text-xs font-mono font-bold text-slate-800"
                            placeholder="New Wt"
                            required
                          />
                        </div>
                      </div>

                      {/* Low Sample */}
                      <div className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2.5">
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full ">3. Low Grower (ខ្សោយបំផុត)</span>
                        <div className="space-y-1">
                          <Label htmlFor="sample_low" className="text-xs font-bold text-slate-400">Cow ID</Label>
                          <select
                            id="sample_low"
                            value={sampleLowId}
                            onChange={e => {
                              setSampleLowId(e.target.value);
                              const cow = activeCows.find(c => c.id === e.target.value);
                              if (cow) setSampleLowWeight(String(cow.weight));
                            }}
                            className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 cursor-pointer font-bold"
                            required
                          >
                            <option value="">-- Select cow --</option>
                            {activeCows.filter(c => defaultBatch.cowIds.includes(c.id) && c.id !== sampleBestId && c.id !== sampleMediumId).map(c => (
                              <option key={c.id} value={c.id}>{c.id} ({c.breed} - {c.weight} kg)</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="sample_low_w" className="text-xs font-bold text-slate-400">New Weight (kg)</Label>
                          <Input
                            type="number"
                            id="sample_low_w"
                            value={sampleLowWeight}
                            onChange={e => setSampleLowWeight(e.target.value)}
                            className="h-8 text-xs font-mono font-bold text-slate-800"
                            placeholder="New Wt"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Preview Panel */}
                    {(() => {
                      const cohortCows = activeCows.filter(c => defaultBatch.cowIds.includes(c.id));
                      const bestCow = cohortCows.find(c => c.id === sampleBestId);
                      const mediumCow = cohortCows.find(c => c.id === sampleMediumId);
                      const lowCow = cohortCows.find(c => c.id === sampleLowId);

                      if (bestCow && mediumCow && lowCow && sampleBestWeight && sampleMediumWeight && sampleLowWeight) {
                        const bestGain = Number(sampleBestWeight) - bestCow.weight;
                        const mediumGain = Number(sampleMediumWeight) - mediumCow.weight;
                        const lowGain = Number(sampleLowWeight) - lowCow.weight;
                        const avgGain = (bestGain + mediumGain + lowGain) / 3;

                        return (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 space-y-2 text-xs text-left">
                            <p className="font-bold text-[#003B33] flex items-center gap-1.5">
                              📊 Results & Estimation Math (ការគណនាស្វ័យប្រវត្ត)
                            </p>
                            <div className="grid grid-cols-4 gap-2 text-center py-1">
                              <div className="bg-white border border-slate-100 p-2 rounded-lg">
                                <p className="text-xs text-slate-400 font-bold ">Best Gain</p>
                                <p className="font-mono font-bold text-emerald-600">+{bestGain.toFixed(1)} kg</p>
                              </div>
                              <div className="bg-white border border-slate-100 p-2 rounded-lg">
                                <p className="text-xs text-slate-400 font-bold ">Medium Gain</p>
                                <p className="font-mono font-bold text-blue-600">+{mediumGain.toFixed(1)} kg</p>
                              </div>
                              <div className="bg-white border border-slate-100 p-2 rounded-lg">
                                <p className="text-xs text-slate-400 font-bold ">Low Gain</p>
                                <p className="font-mono font-bold text-rose-600">+{lowGain.toFixed(1)} kg</p>
                              </div>
                              <div className="bg-emerald-600 text-white p-2 rounded-lg">
                                <p className="text-xs opacity-80 font-bold ">Avg Gain</p>
                                <p className="font-mono font-bold">+{avgGain.toFixed(1)} kg</p>
                              </div>
                            </div>
                            <p className="text-xs text-emerald-800 font-medium">
                              💡 <strong>Assumption Applied</strong>: The system will automatically add <strong>+{avgGain.toFixed(1)} kg</strong> to the last recorded weight of all remaining {cohortCows.length - 3} cows in this cohort.
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  /* Weigh All mode */
                  <div className="space-y-3">
                    {/* Search / Filter Cow Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Filter by Cow ID / Code (e.g. CC-013)..."
                          value={scaleSearchQuery}
                          onChange={e => setScaleSearchQuery(e.target.value)}
                          className="h-8 pl-9 text-xs font-semibold rounded-lg bg-white border border-slate-200"
                        />
                      </div>
                      <div className="text-xs font-bold text-slate-500 whitespace-nowrap px-1">
                        Showing <span className="font-mono text-emerald-600 font-bold">{
                          activeCows.filter(c => defaultBatch.cowIds.includes(c.id) && (
                            !scaleSearchQuery ||
                            c.id.toLowerCase().includes(scaleSearchQuery.toLowerCase().trim()) ||
                            c.breed.toLowerCase().includes(scaleSearchQuery.toLowerCase().trim()) ||
                            c.no.includes(scaleSearchQuery.trim())
                          )).length
                        }</span> / {activeCows.filter(c => defaultBatch.cowIds.includes(c.id)).length} cows
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                      {activeCows
                        .filter(c => defaultBatch.cowIds.includes(c.id))
                        .filter(c =>
                          !scaleSearchQuery ||
                          c.id.toLowerCase().includes(scaleSearchQuery.toLowerCase().trim()) ||
                          c.breed.toLowerCase().includes(scaleSearchQuery.toLowerCase().trim()) ||
                          c.no.includes(scaleSearchQuery.trim())
                        )
                        .map(cow => {
                          const currentVal = scaleInputs[cow.id] || { weight: cow.weight, healthStatus: cow.healthStatus };
                          return (
                            <div key={cow.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2.5 hover:border-emerald-200 transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                  {cow.id} ({cow.breed})
                                </span>
                                <span className="text-xs text-slate-400 font-bold">ទម្ងន់ចាស់: <span className="font-mono text-slate-700 font-bold">{cow.weight} kg</span></span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor={`w_${cow.id}`} className="text-xs font-bold text-slate-400">ទម្ងន់ថ្មី (New Wt)</Label>
                                  <Input
                                    type="number"
                                    id={`w_${cow.id}`}
                                    required
                                    min={1}
                                    max={1500}
                                    step="0.1"
                                    className="h-8 text-xs font-semibold font-mono text-slate-800 mt-0.5"
                                    value={currentVal.weight}
                                    onChange={e => setScaleInputs(prev => ({
                                      ...prev,
                                      [cow.id]: { ...prev[cow.id], weight: parseFloat(e.target.value) || 0 }
                                    }))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`h_${cow.id}`} className="text-xs font-bold text-slate-400">សុខភាព (Health)</Label>
                                  <select
                                    id={`h_${cow.id}`}
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 mt-0.5 cursor-pointer font-bold"
                                    value={currentVal.healthStatus}
                                    onChange={e => setScaleInputs(prev => ({
                                      ...prev,
                                      [cow.id]: { ...prev[cow.id], healthStatus: e.target.value }
                                    }))}
                                  >
                                    <option value="Good">👍 Good</option>
                                    <option value="Fair">😐 Fair</option>
                                    <option value="Poor">⚠️ Poor</option>
                                    <option value="Dead">💀 Dead</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {activeCows.filter(c => defaultBatch.cowIds.includes(c.id)).length === 0 && (
                        <p className="col-span-2 py-8 text-center text-slate-400 font-semibold text-xs bg-slate-50 border border-slate-100 rounded-xl">
                          No cows allocated in the fattening program.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    onClick={() => setIsScalingOpen(false)}
                    variant="outline"
                    className="rounded-xl text-xs py-1.5 px-4 font-bold border-slate-200 text-slate-650 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingWeights || activeCows.filter(c => defaultBatch.cowIds.includes(c.id)).length === 0}
                    className="bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl text-xs py-1.5 px-4 font-bold shadow-md"
                  >
                    {isSubmittingWeights ? 'Saving Weights...' : 'រក្សាទុកទម្ងន់ (Save Weights)'}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create / Edit Custom Batch Modal */}
      <BatchModal
        isOpen={isCreateBatchModalOpen}
        onClose={() => {
          setIsCreateBatchModalOpen(false);
          setEditingBatch(null);
        }}
        onSubmit={handleSaveBatch}
        unassignedCows={unassignedCows}
        batchTypes={data.settings?.batchTypes}
        initialBatch={editingBatch}
        currentUser={currentUser}
        farms={farms}
      />

      {/* All Batches Table Modal (Read & Manage All Batches) */}
      <Dialog open={isAllBatchesOpen} onOpenChange={setIsAllBatchesOpen}>
        <DialogContent className="max-w-4xl bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                All Batches Ledger ({visibleBatches.length})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Manage and select cohort batches across assigned farm operations.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto pt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-xs ">
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Batch Name</th>
                  <th className="py-3 px-4">Program Type</th>
                  <th className="py-3 px-4">Headcount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBatches.length > 0 ? (
                  visibleBatches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{b.name}</td>
                      <td className="py-3 px-4 text-slate-600">{b.type}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{b.cowIds?.length || 0} Head</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
 b.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{b.sellingTargetDate || '—'}</td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchId(b.id);
                            setIsAllBatchesOpen(false);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBatch(b);
                            setIsCreateBatchModalOpen(true);
                            setIsAllBatchesOpen(false);
                          }}
                          className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        {onDeleteBatch && (
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteBatch(b.id);
                              setIsAllBatchesOpen(false);
                            }}
                            className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                      គ្មានក្រុមក្នុងប្រព័ន្ធទេ។
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText || 'Confirm'}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
