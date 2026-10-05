'use client';

import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BatchItem, ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import { hasPermission } from '@/lib/utils';
import { batchCattle, batchSummary, unassignedCattle } from '@/lib/batch-stats';
import BatchFlow from './BatchFlow';
import AddToBatchFlow from './AddToBatchFlow';
import WeighGroupFlow, { type GroupWeight } from './WeighGroupFlow';
import BatchDetailPage from './BatchDetailPage';
import SaleReviewPanel from './SaleReviewPanel';
import SaleReviewFlow from './SaleReviewFlow';
import { saleReviewCounts, saleReviewRows, saleWindowDays, type SaleReviewInput, type SaleReviewRow } from '@/lib/sale-review';
import { FarmSelect } from '@/components/ui/listbox-select';

interface BatchesPageProps {
  data: ERPLivestockData;
  onCreateBatch: (batch: Omit<BatchItem, 'cowIds'>) => Promise<void>;
  onAssignCows: (batchId: string, cowIds: string[]) => Promise<void>;
  onRemoveCow: (batchId: string, cowId: string) => Promise<void>;
  onUpdateBatch: (batchId: string, updates: Partial<BatchItem>) => Promise<void>;
  onRecordBatchWeights: (records: GroupWeight[]) => Promise<void>;
  onDeleteBatch?: (batchId: string) => Promise<void>;
  /** Opens the Treat dialog with these animals already chosen. */
  onTreatGroup: (cowIds: string[]) => void;
  onMoveBatchFarm?: (batchId: string, farm: string, moveCattle: boolean) => Promise<void>;
  onMoveCow?: (cowId: string, fromBatchId: string, toBatchId: string) => Promise<void>;
  /** Saves management's decision on a batch near its selling date. */
  onReviewBatch?: (batchId: string, input: SaleReviewInput) => Promise<void>;
  /** Which view to start on, for example when an alert links to the sale review. */
  initialShow?: Show;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
}

export type Show = 'Active' | 'Closed' | 'All' | 'Review';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

export default function BatchesPage({ data, onCreateBatch, onAssignCows, onRemoveCow, onUpdateBatch, onRecordBatchWeights, onDeleteBatch, onTreatGroup, onMoveBatchFarm, onMoveCow, onReviewBatch, initialShow, currentUser, farms = [] }: BatchesPageProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [show, setShow] = useState<Show>(initialShow ?? 'Active');
  const [reviewing, setReviewing] = useState<SaleReviewRow | null>(null);
  const [farm, setFarm] = useState('');
  const [flow, setFlow] = useState<null | { kind: 'start' } | { kind: 'edit'; batchId: string } | { kind: 'add'; batchId: string } | { kind: 'weigh'; batchId: string }>(null);

  const canCreate = hasPermission(currentUser, 'batch_create');
  const userFarm = currentUser?.farmLocation;
  const effectiveFarm = userFarm || farm;
  const showFarmFilter = !userFarm && farms.length > 0;
  const products = useMemo(() => data.feedProducts || [], [data.feedProducts]);

  // A batch belongs to a farm directly, or through where its cattle are.
  const visible = useMemo(() => {
    if (!effectiveFarm) return data.batches;
    return data.batches.filter(b => b.farmLocation === effectiveFarm || data.stock.some(s => s.location === effectiveFarm && b.cowIds?.includes(s.id)));
  }, [data.batches, data.stock, effectiveFarm]);

  const free = useMemo(() => unassignedCattle(data.stock, data.batches), [data.stock, data.batches]);
  const windowDays = saleWindowDays(data.settings);
  const reviewRows = useMemo(() => saleReviewRows(visible, data.stock, data.weightTracking, products, new Date(), windowDays), [visible, data.stock, data.weightTracking, products, windowDays]);
  const canReview = !!onReviewBatch && hasPermission(currentUser, 'batch_review');
  const counts = { Active: visible.filter(b => b.status === 'Active').length, Closed: visible.filter(b => b.status !== 'Active').length, All: visible.length, Review: saleReviewCounts(reviewRows).toReview };
  const list = visible
    .filter(b => show === 'Review' || show === 'All' || (show === 'Active' ? b.status === 'Active' : b.status !== 'Active'))
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

  const opened = openId ? data.batches.find(b => b.id === openId) : undefined;
  const flowBatch = flow && flow.kind !== 'start' ? data.batches.find(b => b.id === flow.batchId) : undefined;

  const dialogs = (
    <>
      <BatchFlow
        isOpen={flow?.kind === 'start' || flow?.kind === 'edit'}
        onClose={() => setFlow(null)}
        batch={flow?.kind === 'edit' ? flowBatch : null}
        freeCattle={free}
        farms={farms}
        currentUser={currentUser}
        onCreate={async (batch, cowIds) => {
          await onCreateBatch(batch);
          if (cowIds.length > 0) await onAssignCows(batch.id, cowIds);
        }}
        onUpdate={onUpdateBatch}
        onMoveFarm={onMoveBatchFarm}
        batchHead={flow?.kind === 'edit' && flowBatch ? batchCattle(flowBatch, data.stock).length : 0}
        onOpen={id => setOpenId(id)}
      />
      {flowBatch && (
        <>
          <AddToBatchFlow isOpen={flow?.kind === 'add'} onClose={() => setFlow(null)} batch={flowBatch} freeCattle={free} onAssign={onAssignCows} />
          <WeighGroupFlow isOpen={flow?.kind === 'weigh'} onClose={() => setFlow(null)} batch={flowBatch} cattle={batchCattle(flowBatch, data.stock)} onSave={onRecordBatchWeights} />
        </>
      )}
    </>
  );

  if (opened) {
    return (
      <>
        <BatchDetailPage
          batch={opened}
          stock={data.stock}
          weightTracking={data.weightTracking}
          feedProducts={products}
          currentUser={currentUser}
          onBack={() => setOpenId(null)}
          onWeigh={() => setFlow({ kind: 'weigh', batchId: opened.id })}
          onAddCattle={() => setFlow({ kind: 'add', batchId: opened.id })}
          onTreat={onTreatGroup}
          onEdit={() => setFlow({ kind: 'edit', batchId: opened.id })}
          onUpdateBatch={onUpdateBatch}
          onRemoveCow={onRemoveCow}
          onDelete={onDeleteBatch}
          otherBatches={data.batches}
          onMoveCow={onMoveCow ? (cowId, toBatchId) => onMoveCow(cowId, opened.id, toBatchId) : undefined}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Batches</h2>
          <p className="text-base text-ink-muted">Groups of cattle that are fed together.</p>
        </div>
        {canCreate && <Button size="lg" onClick={() => setFlow({ kind: 'start' })}><Plus /> Start a batch</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="flex rounded-xl bg-slate-100 p-1">
          {(['Active', 'Closed', 'All', 'Review'] as Show[]).map(s => (
            <button key={s} role="tab" type="button" aria-selected={show === s} onClick={() => setShow(s)}
              className={`min-h-11 rounded-lg px-4 text-base font-medium ${show === s ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              {s === 'Review' ? 'Sale review' : s} ({counts[s]})
            </button>
          ))}
        </div>
        {showFarmFilter && (
          <FarmSelect farms={farms.map(f => f.name)} value={farm} onChange={setFarm} size="compact" align="right" className="ml-auto" />
        )}
      </div>

      {show === 'Review' ? (
        <SaleReviewPanel rows={reviewRows} windowDays={windowDays} canReview={canReview} onReview={setReviewing} onOpen={id => setOpenId(id)} />
      ) : list.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-lg text-ink-muted">{visible.length === 0 ? 'No batches yet. A batch groups the cattle you feed together.' : 'No batches here.'}</p>
          {canCreate && visible.length === 0 && <Button size="lg" onClick={() => setFlow({ kind: 'start' })}><Plus /> Start a batch</Button>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map(b => {
            const s = batchSummary(b, data.stock, data.weightTracking, products);
            const feed = !b.feedingProgram || b.feedingProgram.ingredients.length === 0 ? 'No feed set up' : b.feedingProgram.status === 'Active' ? 'Feeding on' : 'Feeding paused';
            const late = s.daysToTarget !== null && s.daysToTarget < 0;
            return (
              <li key={b.id}>
                <button type="button" onClick={() => setOpenId(b.id)} className="flex h-full w-full flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-2xl font-semibold text-ink">{b.name}</p>
                      <p className="text-base text-ink-muted">{[b.farmLocation, s.daysIn !== null ? `${s.daysIn} days in` : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${b.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-ink'}`}>{b.status === 'Active' ? 'Active' : 'Closed'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    <div><p className="text-sm text-ink-muted">Cattle</p><p className="text-xl font-semibold text-ink">{s.head}</p></div>
                    <div><p className="text-sm text-ink-muted">Average</p><p className="text-xl font-semibold text-ink">{s.head ? `${Math.round(s.avgWeight)} kg` : '—'}</p></div>
                    <div><p className="text-sm text-ink-muted">Daily gain</p><p className="text-xl font-semibold text-ink">{s.perDay !== null ? `${s.perDay} kg` : '—'}</p></div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    {b.status === 'Active' && <span className={`rounded-full px-3 py-1 text-sm font-medium ${feed === 'Feeding on' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{feed}</span>}
                    {b.status === 'Active' && s.daysToTarget !== null && (
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${late ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-ink'}`}>
                        {late ? `${-s.daysToTarget} days past sell date` : s.daysToTarget === 0 ? 'Sell today' : `Sell in ${s.daysToTarget} days`}
                      </span>
                    )}
                    {s.feedCostPerDay > 0 && <span className="text-sm text-ink-muted">{riel(s.feedCostPerDay)} feed a day</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onReviewBatch && <SaleReviewFlow isOpen={!!reviewing} onClose={() => setReviewing(null)} row={reviewing} windowDays={windowDays} onSave={onReviewBatch} />}
      {dialogs}
    </div>
  );
}
