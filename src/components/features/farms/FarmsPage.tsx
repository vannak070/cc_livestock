'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Crown, MapPin, Pencil, Plus, Trash2, UserPlus, Users, Wheat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { createUserAction, deleteFarmAction, saveFarmAction, setFarmOwnerAction } from '@/app/actions';
import type { BatchItem, FarmItem, MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { farmOwners, farmPeople, type FarmInput } from '@/lib/farm-settings';
import type { PersonInput } from '@/lib/user-admin';
import { getErrorMessage } from '@/lib/utils';
import PersonFlow from '../settings/PersonFlow';
import PeoplePanel from '../settings/PeoplePanel';
import FarmFlow from './FarmFlow';

interface FarmsPageProps {
  settings: MasterSetup;
  currentUser: UserRoleItem | null;
  stock: StockItem[];
  batches: BatchItem[];
  /** Opens the day's feed record for a farm (the office recording for the farm); only for people who may record feed. */
  onRecordFeed?: (farmName: string) => void;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

async function ok<T>(res: { success: true; data: T } | { success: false; error: string }): Promise<T> {
  if (!res.success) throw new Error(res.error);
  return res.data;
}

type Add = { farm: FarmItem; kind: 'owner' | 'staff' };

export default function FarmsPage({ settings, currentUser, stock, batches, onRecordFeed }: FarmsPageProps) {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<null | { farm: FarmItem | null }>(null);
  // The farm whose people page is open; looked up by id so a rename shows straight away.
  const [peopleOfId, setPeopleOfId] = useState<string | null>(null);
  const [add, setAdd] = useState<Add | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'info' | 'warning'; confirmText: string; onConfirm?: () => void }>(null);

  const farms = settings.farms || [];
  const peopleOf = farms.find(f => f.id === peopleOfId) ?? null;
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); };
  const fail = (e: unknown) => setConfirm({ title: 'That did not work', description: getErrorMessage(e, 'The change could not be saved.'), type: 'info', confirmText: 'OK' });

  // One request for one farm: a rename moves its cattle, batches, feed movements and people together on the server.
  const save = async (input: FarmInput): Promise<FarmItem> => {
    const farm = await ok(await saveFarmAction(input, flow?.farm?.id ?? null));
    refresh();
    return farm;
  };

  const askDelete = (farm: FarmItem) => {
    const cattle = stock.filter(c => c.location === farm.name && c.status.toLowerCase() === 'active').length;
    const batchCount = batches.filter(b => b.status === 'Active' && b.farmLocation === farm.name).length;
    const people = farmPeople(settings, farm.name).length;
    const parts = [
      cattle > 0 ? `${cattle} active ${cattle === 1 ? 'animal' : 'animals'}` : '',
      batchCount > 0 ? `${batchCount} active ${batchCount === 1 ? 'batch' : 'batches'}` : '',
      people > 0 ? `${people} ${people === 1 ? 'person' : 'people'}` : '',
    ].filter(Boolean);
    if (parts.length > 0) {
      setConfirm({ title: `${farm.name} cannot be deleted yet`, description: `It still has ${parts.join(', ')}. Move, sell or remove them first, then delete the farm.`, type: 'info', confirmText: 'OK' });
      return;
    }
    setConfirm({
      title: 'Delete this farm?',
      description: `${farm.name} will be removed. It has no active cattle, batches or people. This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete farm',
      onConfirm: async () => { try { await ok(await deleteFarmAction(farm.id)); refresh(); } catch (e) { fail(e); } },
    });
  };

  const askMakeOwner = (farm: FarmItem, userId: string, name: string) => {
    const owners = farmOwners(settings, farm.name).filter(o => o.id !== userId);
    setConfirm({
      title: `Make ${name} the owner of ${farm.name}?`,
      description: `${name} gets the Farm Owner access for ${farm.name}.${owners.length ? ` ${owners.map(o => o.name).join(' and ')} becomes Farm Staff of the same farm.` : ''} A farm has one owner.`,
      type: 'warning',
      confirmText: 'Make owner',
      onConfirm: async () => { try { await ok(await setFarmOwnerAction(farm.id, userId)); refresh(); } catch (e) { fail(e); } },
    });
  };

  const createPerson = async (input: PersonInput): Promise<string | undefined> => {
    const created = await ok(await createUserAction(input));
    refresh();
    return created.tempPassword;
  };

  const peopleOwners = peopleOf ? farmOwners(settings, peopleOf.name) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {peopleOf && currentUser ? (
        <>
          <Button variant="ghost" onClick={() => setPeopleOfId(null)}><ArrowLeft /> All farms</Button>
          <div>
            <h2 className="break-words text-2xl font-semibold text-ink">People on {peopleOf.name}</h2>
            <p className="text-base text-ink-muted">The owner runs the farm; staff and vets record the daily work. A farm has one owner.</p>
          </div>
          {peopleOwners.length === 0 && peopleOf.companyRun && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
              <p className="text-base text-ink">Run by the company, so no farm owner is needed. You can still add one.</p>
              <Button variant="outline" onClick={() => setAdd({ farm: peopleOf, kind: 'owner' })}><UserPlus /> Add an owner</Button>
            </div>
          )}
          {peopleOwners.length === 0 && !peopleOf.companyRun && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4">
              <p className="text-base text-amber-900">This farm has no owner yet.</p>
              <Button onClick={() => setAdd({ farm: peopleOf, kind: 'owner' })}><UserPlus /> Add the owner</Button>
            </div>
          )}
          {peopleOwners.length > 1 && (
            <p className="rounded-2xl bg-amber-50 p-4 text-base text-amber-900">This farm has {peopleOwners.length} owners. Tap &quot;Make owner&quot; on the right person to leave just one.</p>
          )}
          <PeoplePanel
            settings={settings}
            actor={currentUser}
            farm={peopleOf.name}
            companyRun={peopleOf.companyRun}
            onChanged={refresh}
            extraActions={u => (u.role !== 'Farm Owner' || peopleOwners.length > 1) && ['Farm Staff', 'Veterinarian', 'Farm Owner'].includes(u.role) && u.status === 'Active'
              ? <Button variant="outline" size="sm" onClick={() => askMakeOwner(peopleOf, u.id, u.name)}><Crown /> Make owner</Button>
              : null}
          />
        </>
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Farms</h2>
          <p className="text-base text-ink-muted">Each farm, who runs it and how full it is.</p>
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
            const owners = farmOwners(settings, farm.name);
            const people = farmPeople(settings, farm.name);
            const farmBatches = batches.filter(b => b.status === 'Active' && (b.farmLocation === farm.name || cows.some(c => b.cowIds.includes(c.id)))).length;
            const state = fill > 90 ? { bar: 'bg-rose-600', text: 'Almost full' } : fill > 75 ? { bar: 'bg-amber-500', text: 'Getting full' } : { bar: 'bg-emerald-600', text: '' };
            return (
              <li key={farm.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-2xl font-semibold text-ink">{farm.name}</h3>
                    {farm.companyRun && <span className="mt-1 inline-block rounded-full bg-sky-100 px-3 py-0.5 text-sm font-medium text-sky-900">Run by the company</span>}
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
                  <Stat label="People" value={people.length} />
                  <Stat label="Batches" value={farmBatches} />
                </div>

                <div className="border-t border-slate-100 pt-3 text-base">
                  <p className="text-ink-muted">Owner</p>
                  {owners.length === 0 ? (
                    farm.companyRun
                      ? <p className="font-semibold text-ink">Run by the company</p>
                      : <p className="font-semibold text-amber-800">No owner yet</p>
                  ) : (
                    <>
                      <p className="font-semibold text-ink">{owners[0].name}</p>
                      <p className="break-all text-ink-muted">{owners[0].email}</p>
                      {owners.length > 1 && <p className="mt-1 text-amber-800">{owners.length} owners are set. A farm has one: open People and tap Make owner on the right person.</p>}
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPeopleOfId(farm.id)}><Users /> People ({people.length})</Button>
                    {onRecordFeed && farmBatches > 0 && <Button variant="outline" size="sm" onClick={() => onRecordFeed(farm.name)}><Wheat /> Record feed</Button>}
                    {owners.length === 0 && !farm.companyRun && <Button size="sm" onClick={() => setAdd({ farm, kind: 'owner' })}><UserPlus /> Add the owner</Button>}
                  </div>
                </div>
                {farm.notes && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{farm.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      </>
      )}

      <FarmFlow isOpen={!!flow} onClose={() => setFlow(null)} farm={flow?.farm ?? null} settings={settings} onSave={save} onAddOwner={farm => setAdd({ farm, kind: 'owner' })} />

      {currentUser && add && (
        <PersonFlow
          isOpen
          onClose={() => setAdd(null)}
          settings={settings}
          actor={currentUser}
          presetFarm={add.farm.name}
          onlyRoles={add.kind === 'owner' ? ['Farm Owner'] : ['Farm Staff', 'Veterinarian']}
          onSave={createPerson}
        />
      )}

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
