'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, Pencil, Plus, Scale, Syringe, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { BatchItem, FeedProductItem, FeedingProgramConfig, UserRoleItem } from '@/lib/types';
import type { StockItem, WeightRecord } from '@/lib/xlsx-parser';
import { getErrorMessage, hasPermission } from '@/lib/utils';
import { batchCattle, batchSummary, feedLines } from '@/lib/batch-stats';
import { growth, weighPoints } from '@/lib/cattle-stats';
import { exportToExcel } from '@/lib/excel-export';
import IngredientFlow, { type IngredientChoice } from './IngredientFlow';

interface BatchDetailPageProps {
  batch: BatchItem;
  stock: StockItem[];
  weightTracking: WeightRecord[];
  feedProducts: FeedProductItem[];
  currentUser?: UserRoleItem;
  onBack: () => void;
  onWeigh: () => void;
  onAddCattle: () => void;
  onTreat: (cowIds: string[]) => void;
  onEdit: () => void;
  onUpdateBatch: (batchId: string, updates: Partial<BatchItem>) => Promise<void>;
  onRemoveCow: (batchId: string, cowId: string) => Promise<void>;
  onDelete?: (batchId: string) => Promise<void>;
}

type Tab = 'cattle' | 'feeding' | 'growth';
const TABS: { key: Tab; label: string }[] = [
  { key: 'cattle', label: 'Cattle' },
  { key: 'feeding', label: 'Feeding' },
  { key: 'growth', label: 'Growth' },
];

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const r1 = (n: number) => Math.round(n * 10) / 10;
const kgText = (n: number) => `${r1(n)} kg`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${r1(n)}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

function sellText(daysToTarget: number | null): { text: string; late: boolean } | null {
  if (daysToTarget === null) return null;
  if (daysToTarget > 0) return { text: `Sell in ${daysToTarget} ${daysToTarget === 1 ? 'day' : 'days'}`, late: false };
  if (daysToTarget === 0) return { text: 'Planned to sell today', late: false };
  return { text: `${-daysToTarget} ${-daysToTarget === 1 ? 'day' : 'days'} past the sell date`, late: true };
}

export default function BatchDetailPage({ batch, stock, weightTracking, feedProducts, currentUser, onBack, onWeigh, onAddCattle, onTreat, onEdit, onUpdateBatch, onRemoveCow, onDelete }: BatchDetailPageProps) {
  const [tab, setTab] = useState<Tab>('cattle');
  const [ingredientDialog, setIngredientDialog] = useState<null | { existing: IngredientChoice | null }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'warning'; confirmText: string; onConfirm?: () => void }>(null);

  const isActive = batch.status === 'Active';
  const canEdit = hasPermission(currentUser, 'batch_edit');
  const canWeigh = isActive && canEdit && hasPermission(currentUser, 'weight_record');
  const canTreat = isActive && hasPermission(currentUser, 'health_record');
  const canAdd = isActive && canEdit;
  const canDelete = !!onDelete && hasPermission(currentUser, 'batch_delete');

  const cattle = useMemo(() => batchCattle(batch, stock), [batch, stock]);
  const summary = useMemo(() => batchSummary(batch, stock, weightTracking, feedProducts), [batch, stock, weightTracking, feedProducts]);
  const lines = useMemo(() => feedLines(batch.feedingProgram, feedProducts), [batch.feedingProgram, feedProducts]);
  const sell = sellText(summary.daysToTarget);

  const rows = useMemo(() => {
    const byCow = new Map<string, WeightRecord[]>();
    for (const r of weightTracking) {
      const list = byCow.get(r.cowId);
      if (list) list.push(r); else byCow.set(r.cowId, [r]);
    }
    return cattle.map(c => ({ cow: c, g: growth(c, weighPoints(c.id, byCow.get(c.id) ?? [], c.purchaseDate)) }));
  }, [cattle, weightTracking]);
  const ranked = useMemo(() => [...rows].filter(r => r.g.perDay !== null).sort((a, b) => (b.g.perDay ?? 0) - (a.g.perDay ?? 0)), [rows]);

  const program: FeedingProgramConfig = batch.feedingProgram ?? { ingredients: [], frequency: 'Twice Daily', startDate: batch.startDate, status: 'Active' };
  const feedingOn = program.status === 'Active';

  const saveProgram = (next: Partial<FeedingProgramConfig>) => onUpdateBatch(batch.id, { feedingProgram: { ...program, ...next } });
  const fail = (e: unknown, fallback: string) => setConfirm({ title: 'Something went wrong', description: getErrorMessage(e, fallback), type: 'danger', confirmText: 'OK' });

  const saveIngredient = async (ing: IngredientChoice) => {
    const existing = ingredientDialog?.existing;
    const list = existing
      ? program.ingredients.map(i => (i.name === existing.name ? ing : i))
      : [...program.ingredients, ing];
    await saveProgram({ ingredients: list });
  };

  const askRemoveIngredient = (name: string) => setConfirm({
    title: 'Stop feeding this?',
    description: `${name} will be taken out of this batch's daily feeding. Past feed use is not changed.`,
    type: 'warning',
    confirmText: 'Remove',
    onConfirm: async () => { try { await saveProgram({ ingredients: program.ingredients.filter(i => i.name !== name) }); } catch (e) { fail(e, 'Could not remove it.'); } },
  });

  const askRemoveCow = (cowId: string) => setConfirm({
    title: 'Take out of the batch?',
    description: `${cowId} will leave ${batch.name} and stop being fed with it. Its records stay.`,
    type: 'warning',
    confirmText: 'Take out',
    onConfirm: async () => { try { await onRemoveCow(batch.id, cowId); } catch (e) { fail(e, 'Could not remove it.'); } },
  });

  const askToggleBatch = () => setConfirm({
    title: isActive ? 'Close this batch?' : 'Open this batch again?',
    description: isActive ? 'A closed batch is no longer fed by the daily feed job, and its cattle become free to join another batch.' : 'The batch will be fed again, so its cattle must not be in another batch.',
    type: 'warning',
    confirmText: isActive ? 'Close it' : 'Open it',
    onConfirm: async () => { try { await onUpdateBatch(batch.id, { status: isActive ? 'Closed' : 'Active' }); } catch (e) { fail(e, 'Could not change the batch.'); } },
  });

  const askDelete = () => setConfirm({
    title: 'Delete this batch?',
    description: `This removes ${batch.name}. The cattle stay on the farm. It cannot be undone.`,
    type: 'danger',
    confirmText: 'Delete',
    onConfirm: async () => { try { await onDelete?.(batch.id); onBack(); } catch (e) { fail(e, 'Could not delete the batch.'); } },
  });

  const exportGrowth = () => exportToExcel({
    filename: `CC_Livestock_Batch_Growth_${batch.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Batch Growth',
    data: rows,
    columns: [
      { header: 'Cow ID', key: 'cow.id' },
      { header: 'Breed', key: 'cow.breed' },
      { header: 'Start Weight (kg)', key: 'g.startWeight', formatter: (v) => r1(v) },
      { header: 'Current Weight (kg)', key: 'g.currentWeight', formatter: (v) => r1(v) },
      { header: 'Gain (kg)', key: 'g.gain', formatter: (v) => signed(v) },
      { header: 'Daily gain (kg/day)', key: 'g.perDay', formatter: (v) => (v === null ? '' : v) },
    ],
  });

  const feedingStatusText = !batch.feedingProgram || program.ingredients.length === 0 ? 'No feed set up' : feedingOn ? 'Feeding is on' : 'Feeding is paused';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Button variant="ghost" onClick={onBack} className="-ml-3"><ArrowLeft /> All batches</Button>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-3xl font-semibold text-ink">{batch.name}</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-ink'}`}>{isActive ? 'Active' : 'Closed'}</span>
        </div>
        <p className="mt-1 text-lg text-ink-muted">{[batch.farmLocation, `Started ${batch.startDate?.slice(0, 10)}`, summary.daysIn !== null ? `${summary.daysIn} days` : null].filter(Boolean).join(' · ')}</p>
        {(sell || batch.expectedSellingPrice) && (
          <p className={`mt-1 text-lg font-medium ${sell?.late ? 'text-amber-800' : 'text-ink'}`}>
            {[sell?.text, batch.expectedSellingPrice ? `hoped-for ${riel(batch.expectedSellingPrice)} a kg` : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </section>

      {(canWeigh || canTreat || canAdd) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Actions">
          {canWeigh && <Button size="lg" onClick={onWeigh} disabled={cattle.length === 0}><Scale /> Weigh group</Button>}
          {canTreat && <Button size="lg" variant="outline" onClick={() => onTreat(cattle.map(c => c.id))} disabled={cattle.length === 0}><Syringe /> Treat group</Button>}
          {canAdd && <Button size="lg" variant="outline" onClick={onAddCattle}><UserPlus /> Add cattle</Button>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Tile label="Cattle" value={String(summary.head)} sub="in the batch" />
        <Tile label="Average weight" value={summary.head ? kgText(summary.avgWeight) : '—'} />
        <Tile label="Daily gain" value={summary.perDay !== null ? `${summary.perDay} kg` : '—'} sub={summary.perDay !== null ? 'each day' : 'Needs 2 weigh-ins'} />
        <Tile label="Feed cost" value={summary.feedCostPerDay > 0 ? riel(summary.feedCostPerDay) : '—'} sub="each day" />
      </section>

      <div role="tablist" aria-label="Batch details" className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`min-h-12 flex-1 whitespace-nowrap border-b-4 px-2 text-base font-medium sm:px-4 sm:text-lg ${tab === t.key ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cattle' && (
        cattle.length === 0 ? (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-6 text-center">
            <p className="text-lg text-ink-muted">No cattle in this batch yet.</p>
            {canAdd && <Button onClick={onAddCattle}><Plus /> Add cattle</Button>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map(({ cow, g }) => (
              <li key={cow.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-ink">{cow.id}</p>
                  <p className="text-base text-ink-muted">{[cow.sex, cow.breed].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{kgText(g.currentWeight)}{g.gain !== 0 && <span className={`ml-2 text-base font-medium ${g.gain < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{signed(g.gain)} kg</span>}</p>
                </div>
                {canAdd && <Button variant="ghost" size="icon" aria-label={`Take ${cow.id} out of the batch`} onClick={() => askRemoveCow(cow.id)}><X /></Button>}
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'feeding' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className={`text-lg font-semibold ${feedingStatusText === 'Feeding is on' ? 'text-emerald-800' : 'text-ink'}`}>{feedingStatusText}</p>
              <p className="text-base text-ink-muted">{feedingOn ? 'Stock is taken off each day for the cattle in this batch.' : 'No stock is taken off while it is paused.'}</p>
            </div>
            {isActive && canEdit && program.ingredients.length > 0 && (
              <Button variant="outline" onClick={async () => { try { await saveProgram({ status: feedingOn ? 'Paused' : 'Active' }); } catch (e) { fail(e, 'Could not change feeding.'); } }}>{feedingOn ? 'Pause feeding' : 'Start feeding'}</Button>
            )}
          </div>

          {lines.length > 0 ? (
            <ul className="space-y-3">
              {lines.map(l => (
                <li key={l.name} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-ink">{l.name}</p>
                    <p className="text-base text-ink">{r1(l.kgPerHead)} kg for each animal each day</p>
                    <p className="text-base text-ink-muted">{riel(l.costPerHead)} each · {riel(l.costPerHead * summary.head)} for the group</p>
                    {!l.inCatalogue && <p className="mt-1 text-base font-medium text-amber-800">Not in your feed list, so its stock is not counted. Tap the pencil and choose the feed it should be.</p>}
                  </div>
                  {isActive && canEdit && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label={`Change ${l.name}`} onClick={() => setIngredientDialog({ existing: { name: l.name, portionPerHead: l.kgPerHead, unitCost: l.unitCost } })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${l.name}`} onClick={() => askRemoveIngredient(l.name)}><Trash2 className="text-rose-700" /></Button>
                    </div>
                  )}
                </li>
              ))}
              <li className="rounded-2xl bg-slate-50 p-4 text-lg text-ink">
                One animal eats <span className="font-semibold">{r1(lines.reduce((s, l) => s + l.kgPerHead, 0))} kg</span> a day, costing <span className="font-semibold">{riel(lines.reduce((s, l) => s + l.costPerHead, 0))}</span>.
              </li>
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Nothing is set up yet. Add the feeds this batch eats.</p>
          )}
          {isActive && canEdit && <Button onClick={() => setIngredientDialog({ existing: null })}><Plus /> Add a feed</Button>}
        </div>
      )}

      {tab === 'growth' && (
        ranked.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Growth appears once animals have been weighed. Use Weigh group.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile label="Growing fastest" value={ranked[0].cow.id} sub={`${ranked[0].g.perDay} kg a day`} />
              <Tile label="Gaining least" value={ranked[ranked.length - 1].cow.id} sub={`${ranked[ranked.length - 1].g.perDay} kg a day`} />
            </div>
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {ranked.map(({ cow, g }, i) => (
                <li key={cow.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                  <div>
                    <p className="text-lg font-semibold text-ink">{i + 1}. {cow.id}</p>
                    <p className="text-base text-ink-muted">{kgText(g.startWeight)} to {kgText(g.currentWeight)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${(g.perDay ?? 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{g.perDay} kg a day</p>
                    <p className="text-base text-ink-muted">{signed(g.gain)} kg in {g.days} days</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={exportGrowth}><Download /> Download Excel</Button>
          </div>
        )
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
          <Button variant="outline" onClick={onEdit}><Pencil /> Edit details</Button>
          <Button variant="outline" onClick={askToggleBatch}>{isActive ? 'Close batch' : 'Open batch again'}</Button>
          {canDelete && <Button variant="destructive" onClick={askDelete}><Trash2 /> Delete batch</Button>}
        </div>
      )}

      <IngredientFlow
        isOpen={!!ingredientDialog}
        onClose={() => setIngredientDialog(null)}
        products={feedProducts}
        usedNames={program.ingredients.map(i => i.name)}
        existing={ingredientDialog?.existing ?? null}
        existingInCatalogue={ingredientDialog?.existing ? lines.find(l => l.name === ingredientDialog.existing!.name)?.inCatalogue ?? true : true}
        headCount={summary.head}
        onSave={saveIngredient}
      />

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
