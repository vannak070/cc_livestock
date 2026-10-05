'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { updateSettingsAction, updateStockLocationAction } from '@/app/actions';
import type { BatchItem, FarmItem, MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { deleteFarm, farmOwner, saveFarm, type FarmInput } from '@/lib/farm-settings';
import { getErrorMessage } from '@/lib/utils';
import FarmFlow from './FarmFlow';

interface FarmsPageProps {
  settings: MasterSetup;
  currentUser: UserRoleItem | null;
  stock: StockItem[];
  batches: BatchItem[];
}

// Ids are made on demand, not during render.
const newId = () => Math.random().toString(36).slice(2, 11).toUpperCase();

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function FarmsPage({ settings, stock, batches }: FarmsPageProps) {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<null | { farm: FarmItem | null }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  const farms = settings.farms || [];

  const updateSettings = useMutation({
    mutationFn: async (next: MasterSetup) => {
      const res = await updateSettingsAction(next);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); },
  });

  const save = async (input: FarmInput) => {
    const editing = flow?.farm ?? null;
    const { settings: next, renamedFrom } = saveFarm(settings, input, editing, newId);
    // Cattle and batches follow a renamed farm first; if that fails nothing else changes.
    if (renamedFrom) {
      const moved = await updateStockLocationAction(renamedFrom, input.name.trim());
      if (!moved.success) throw new Error(moved.error || 'Could not move the cattle to the new name.');
    }
    await updateSettings.mutateAsync(next);
  };

  const askDelete = (farm: FarmItem) => {
    const cattle = stock.filter(c => c.location === farm.name && c.status.toLowerCase() === 'active').length;
    const people = settings.users.filter(u => u.farmLocation === farm.name && u.role !== 'Farm Owner').length;
    setConfirm({
      title: 'Delete this farm?',
      description: `${farm.name} will be removed, and so will its owner's login. ${cattle} active ${cattle === 1 ? 'animal stays' : 'animals stay'} on record but ${cattle === 1 ? 'has' : 'have'} no farm, and ${people} other ${people === 1 ? 'person loses' : 'people lose'} their farm. This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete farm',
      onConfirm: async () => {
        try {
          await updateSettings.mutateAsync(deleteFarm(settings, farm.id));
        } catch (e) {
          setConfirm({ title: 'Could not delete', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' });
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Farms</h2>
          <p className="text-base text-ink-muted">Each farm, its owner and how full it is.</p>
        </div>
        <Button size="lg" onClick={() => setFlow({ farm: null })}><Plus /> Add a farm</Button>
      </div>

      {farms.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-lg text-ink-muted">No farms yet.</p>
          <Button size="lg" onClick={() => setFlow({ farm: null })}><Plus /> Add a farm</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {farms.map(farm => {
            const cows = stock.filter(c => c.location === farm.name && c.status.toLowerCase() === 'active');
            const capacity = farm.capacity || 100;
            const fill = Math.min(100, Math.round((cows.length / capacity) * 100));
            const owner = farmOwner(settings, farm.name);
            const staff = settings.users.filter(u => u.farmLocation === farm.name && u.role !== 'Farm Owner').length;
            const farmBatches = batches.filter(b => b.status === 'Active' && (b.farmLocation === farm.name || cows.some(c => b.cowIds.includes(c.id)))).length;
            const state = fill > 90 ? { bar: 'bg-rose-600', text: 'Almost full' } : fill > 75 ? { bar: 'bg-amber-500', text: 'Getting full' } : { bar: 'bg-emerald-600', text: '' };
            return (
              <li key={farm.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-2xl font-semibold text-ink">{farm.name}</h3>
                    {farm.address && <p className="mt-1 flex items-start gap-1.5 text-base text-ink-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span className="break-words">{farm.address}</span></p>}
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${farm.name}`} onClick={() => setFlow({ farm })}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${farm.name}`} onClick={() => askDelete(farm)}><Trash2 className="text-rose-700" /></Button>
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-lg font-semibold text-ink">{cows.length} of {capacity} cattle</p>
                    {state.text && <p className={`text-base font-medium ${fill > 90 ? 'text-rose-700' : 'text-amber-800'}`}>{state.text}</p>}
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-label={`${farm.name} is ${fill}% full`}>
                    <div className={`h-full rounded-full ${state.bar}`} style={{ width: `${fill}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Staff" value={staff} />
                  <Stat label="Batches" value={farmBatches} />
                </div>

                <div className="border-t border-slate-100 pt-3 text-base">
                  <p className="text-ink-muted">Owner</p>
                  <p className="font-semibold text-ink">{owner?.name || farm.ownerName || 'No owner login yet'}</p>
                  {(owner?.email || farm.ownerEmail) && <p className="break-all text-ink-muted">{owner?.email || farm.ownerEmail}</p>}
                </div>
                {farm.notes && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{farm.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <FarmFlow isOpen={!!flow} onClose={() => setFlow(null)} farm={flow?.farm ?? null} settings={settings} onSave={save} />

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
