'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Crown, MapPin, Pencil, Plus, Trash2, UserPlus, Users, Wheat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { createUserAction, deleteFarmAction, saveFarmAction, setFarmOwnerAction } from '@/app/actions';
import type { BatchItem, FarmItem, FarmLimitChange, FarmLimitRequest, MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { canSetLimits, limitState, limitUsed } from '@/lib/farm-limit';
import { shownDay } from '@/lib/khmer-date';
import { farmOwners, farmPeople, type FarmInput } from '@/lib/farm-settings';
import type { PersonInput } from '@/lib/user-admin';
import { getErrorMessage } from '@/lib/utils';
import PersonFlow from '../settings/PersonFlow';
import PeoplePanel from '../settings/PeoplePanel';
import FarmFlow from './FarmFlow';
import { LimitDecisionFlow } from './FarmLimitFlows';
import { useText } from '@/hooks/useText';

interface FarmsPageProps {
  settings: MasterSetup;
  currentUser: UserRoleItem | null;
  stock: StockItem[];
  batches: BatchItem[];
  /** Opens the day's feed record for a farm (the office recording for the farm); only for people who may record feed. */
  onRecordFeed?: (farmName: string) => void;
  /** Requests for a higher cattle limit and the record of limit changes. */
  limitRequests?: FarmLimitRequest[];
  limitChanges?: FarmLimitChange[];
  /** Opens "Ask for more cattle" for a farm; only for people who may ask. */
  onAskMore?: (farmName: string) => void;
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

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

export default function FarmsPage({ settings, currentUser, stock, batches, onRecordFeed, limitRequests = [], limitChanges = [], onAskMore }: FarmsPageProps) {
  const { tx, txn, language } = useText('farmsPage');
  const lim = useText('farmLimits');
  const isLimitAdmin = canSetLimits(currentUser);
  const [deciding, setDeciding] = useState<FarmLimitRequest | null>(null);
  const pending = limitRequests.filter(r => r.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pendingFor = (farm: string) => pending.find(r => norm(r.farmLocation) === norm(farm));
  const lastChangeFor = (farm: string) => limitChanges.filter(c => norm(c.farmLocation) === norm(farm)).sort((a, b) => b.changedAt.localeCompare(a.changedAt))[0];
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<null | { farm: FarmItem | null }>(null);
  // The farm whose people page is open; looked up by id so a rename shows straight away.
  const [peopleOfId, setPeopleOfId] = useState<string | null>(null);
  const [add, setAdd] = useState<Add | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'info' | 'warning'; confirmText: string; onConfirm?: () => void }>(null);

  const farms = settings.farms || [];
  const peopleOf = farms.find(f => f.id === peopleOfId) ?? null;
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); };
  const fail = (e: unknown) => setConfirm({ title: tx('failTitle'), description: getErrorMessage(e, tx('failDesc')), type: 'info', confirmText: tx('ok') });

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
      cattle > 0 ? txn(cattle, 'activeAnimalOne', 'activeAnimalMany') : '',
      batchCount > 0 ? txn(batchCount, 'activeBatchOne', 'activeBatchMany') : '',
      people > 0 ? txn(people, 'personOne', 'personMany') : '',
    ].filter(Boolean);
    if (parts.length > 0) {
      setConfirm({ title: tx('cantDelete', { name: farm.name }), description: tx('cantDeleteDesc', { list: parts.join(', ') }), type: 'info', confirmText: tx('ok') });
      return;
    }
    setConfirm({
      title: tx('deleteTitle'),
      description: tx('deleteDesc', { name: farm.name }),
      type: 'danger',
      confirmText: tx('deleteConfirm'),
      onConfirm: async () => { try { await ok(await deleteFarmAction(farm.id)); refresh(); } catch (e) { fail(e); } },
    });
  };

  const askMakeOwner = (farm: FarmItem, userId: string, name: string) => {
    const owners = farmOwners(settings, farm.name).filter(o => o.id !== userId);
    setConfirm({
      title: tx('ownerTitle', { name, farm: farm.name }),
      description: tx('ownerDesc', { name, farm: farm.name }) + (owners.length ? tx('ownerDescOthers', { others: owners.map(o => o.name).join(tx('and')) }) : '') + tx('ownerDescEnd'),
      type: 'warning',
      confirmText: tx('makeOwner'),
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
          <Button variant="ghost" onClick={() => setPeopleOfId(null)}><ArrowLeft /> {tx('allFarms')}</Button>
          <div>
            <h2 className="break-words text-2xl font-semibold text-ink">{tx('peopleOn', { name: peopleOf.name })}</h2>
            <p className="text-base text-ink-muted">{tx('peopleIntro')}</p>
          </div>
          {peopleOwners.length === 0 && peopleOf.companyRun && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
              <p className="text-base text-ink">{tx('companyNoOwner')}</p>
              <Button variant="outline" onClick={() => setAdd({ farm: peopleOf, kind: 'owner' })}><UserPlus /> {tx('addAnOwner')}</Button>
            </div>
          )}
          {peopleOwners.length === 0 && !peopleOf.companyRun && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4">
              <p className="text-base text-amber-900">{tx('noOwner')}</p>
              <Button onClick={() => setAdd({ farm: peopleOf, kind: 'owner' })}><UserPlus /> {tx('addTheOwner')}</Button>
            </div>
          )}
          {peopleOwners.length > 1 && (
            <p className="rounded-2xl bg-amber-50 p-4 text-base text-amber-900">{tx('manyOwnersHere', { n: peopleOwners.length })}</p>
          )}
          <PeoplePanel
            settings={settings}
            actor={currentUser}
            farm={peopleOf.name}
            companyRun={peopleOf.companyRun}
            onChanged={refresh}
            extraActions={u => (u.role !== 'Farm Owner' || peopleOwners.length > 1) && ['Farm Staff', 'Veterinarian', 'Farm Owner'].includes(u.role) && u.status === 'Active'
              ? <Button variant="outline" size="sm" onClick={() => askMakeOwner(peopleOf, u.id, u.name)}><Crown /> {tx('makeOwner')}</Button>
              : null}
          />
        </>
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{tx('title')}</h2>
          <p className="text-base text-ink-muted">{tx('intro')}</p>
        </div>
        <Button size="lg" onClick={() => setFlow({ farm: null })}><Plus /> {tx('addFarm')}</Button>
      </div>

      {isLimitAdmin && pending.length > 0 && (
        <section aria-labelledby="limit-requests" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 id="limit-requests" className="text-lg font-semibold text-amber-900">{lim.tx('requestsTitle')}</h3>
          <ul className="space-y-2">
            {pending.map(r => {
              const farm = farms.find(f => norm(f.name) === norm(r.farmLocation));
              const ls = farm ? limitState(farm, stock) : { limit: 0, used: limitUsed(r.farmLocation, stock), left: 0 };
              return (
                <li key={r.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-semibold text-ink">{lim.tx('requestLine', { farm: r.farmLocation, n: r.extra, limit: ls.limit, used: ls.used })}</p>
                    <p className="text-sm text-ink-muted">{lim.tx('requestBy', { who: r.requestedBy, day: shownDay(r.createdAt, language) })}</p>
                    {r.reason && <p className="mt-1 break-words text-sm text-ink">{lim.tx('decideReason', { reason: r.reason })}</p>}
                  </div>
                  <Button onClick={() => setDeciding(r)}>{lim.tx('answer')}</Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {farms.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-lg text-ink-muted">{tx('noFarms')}</p>
          <Button size="lg" onClick={() => setFlow({ farm: null })}><Plus /> {tx('addFarm')}</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {farms.map(farm => {
            const cows = stock.filter(c => c.location === farm.name && c.status.toLowerCase() === 'active');
            const owners = farmOwners(settings, farm.name);
            const people = farmPeople(settings, farm.name);
            const farmBatches = batches.filter(b => b.status === 'Active' && (b.farmLocation === farm.name || cows.some(c => b.cowIds.includes(c.id)))).length;
            // The cattle limit: every animal ever registered on the farm counts (sold ones too).
            const ls = limitState(farm, stock);
            const pct = ls.limit > 0 ? Math.min(100, Math.round((ls.used / ls.limit) * 100)) : 0;
            const limitStatus = ls.limit === 0 ? null
              : ls.left === 0 ? { bar: 'bg-rose-600', text: lim.tx('limitUsed'), tone: 'text-rose-700' }
                : pct >= 90 ? { bar: 'bg-amber-500', text: lim.tx('almostUsed'), tone: 'text-amber-800' }
                  : pct >= 80 ? { bar: 'bg-amber-400', text: lim.tx('nearLevel') + ' · ' + lim.tx('leftN', { n: ls.left }), tone: 'text-amber-800' }
                    : { bar: 'bg-emerald-600', text: lim.tx('leftN', { n: ls.left }), tone: 'text-ink-muted' };
            const waiting = pendingFor(farm.name);
            const last = lastChangeFor(farm.name);
            return (
              <li key={farm.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-2xl font-semibold text-ink">{farm.name}</h3>
                    {farm.companyRun && <span className="mt-1 inline-block rounded-full bg-sky-100 px-3 py-0.5 text-sm font-medium text-sky-900">{tx('companyRun')}</span>}
                    {farm.address && <p className="mt-1 flex items-start gap-1.5 text-base text-ink-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span className="break-words">{farm.address}</span></p>}
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={tx('editAria', { name: farm.name })} onClick={() => setFlow({ farm })}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label={tx('deleteAria', { name: farm.name })} onClick={() => askDelete(farm)}><Trash2 className="text-rose-700" /></Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {ls.limit === 0 ? (
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-base font-semibold text-amber-900">{lim.tx('noLimit')}</p>
                      <p className="text-sm text-amber-900">{lim.tx('noLimitHint')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-lg font-semibold text-ink">{lim.tx('usedOf', { used: ls.used, limit: ls.limit })}</p>
                        {limitStatus && <p className={`text-base font-medium ${limitStatus.tone}`}>{limitStatus.text}</p>}
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={lim.tx('usedAria', { farm: farm.name, pct })}>
                        <div className={`h-full rounded-full ${limitStatus?.bar ?? 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  )}
                  <p className="text-sm text-ink-muted">{lim.tx('onFarmNow', { n: cows.length })}</p>
                  {waiting && (
                    <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-base text-sky-900">
                      <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {lim.tx('waiting', { n: waiting.extra })}
                    </p>
                  )}
                  {last && (
                    <p className="text-sm text-ink-muted">{lim.tx('lastChange', { from: last.oldLimit, to: last.newLimit, who: last.changedBy, day: shownDay(last.changedAt, language) })}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {isLimitAdmin && waiting && <Button size="sm" onClick={() => setDeciding(waiting)}>{lim.tx('answer')}</Button>}
                    {isLimitAdmin && !waiting && ls.limit === 0 && <Button size="sm" onClick={() => setFlow({ farm })}>{lim.tx('setLimit')}</Button>}
                    {!isLimitAdmin && !waiting && onAskMore && (ls.limit === 0 || pct >= 80) && <Button variant="outline" size="sm" onClick={() => onAskMore(farm.name)}>{lim.tx('askMore')}</Button>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Stat label={tx('people')} value={people.length} />
                  <Stat label={tx('batches')} value={farmBatches} />
                </div>

                <div className="border-t border-slate-100 pt-3 text-base">
                  <p className="text-ink-muted">{tx('owner')}</p>
                  {owners.length === 0 ? (
                    farm.companyRun
                      ? <p className="font-semibold text-ink">{tx('companyRun')}</p>
                      : <p className="font-semibold text-amber-800">{tx('noOwnerYet')}</p>
                  ) : (
                    <>
                      <p className="font-semibold text-ink">{owners[0].name}</p>
                      <p className="break-all text-ink-muted">{owners[0].email}</p>
                      {owners.length > 1 && <p className="mt-1 text-amber-800">{tx('manyOwners', { n: owners.length })}</p>}
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPeopleOfId(farm.id)}><Users /> {tx('peopleN', { n: people.length })}</Button>
                    {onRecordFeed && farmBatches > 0 && <Button variant="outline" size="sm" onClick={() => onRecordFeed(farm.name)}><Wheat /> {tx('recordFeed')}</Button>}
                    {owners.length === 0 && !farm.companyRun && <Button size="sm" onClick={() => setAdd({ farm, kind: 'owner' })}><UserPlus /> {tx('addTheOwner')}</Button>}
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

      <FarmFlow
        isOpen={!!flow}
        onClose={() => setFlow(null)}
        farm={flow?.farm ?? null}
        settings={settings}
        onSave={save}
        onAddOwner={farm => setAdd({ farm, kind: 'owner' })}
        canSetLimit={isLimitAdmin}
        used={flow?.farm ? limitUsed(flow.farm.name, stock) : 0}
      />

      {isLimitAdmin && (() => {
        const farm = deciding ? farms.find(f => norm(f.name) === norm(deciding.farmLocation)) : undefined;
        const ls = deciding ? (farm ? limitState(farm, stock) : { limit: 0, used: limitUsed(deciding.farmLocation, stock) }) : { limit: 0, used: 0 };
        return <LimitDecisionFlow isOpen={!!deciding} onClose={() => setDeciding(null)} request={deciding} limit={ls.limit} used={ls.used} />;
      })()}

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
