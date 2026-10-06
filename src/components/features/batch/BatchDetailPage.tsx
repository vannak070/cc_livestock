'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Download, Pencil, Plus, Scale, Syringe, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BatchItem, FeedProductItem, FeedingProgramConfig, UserRoleItem } from '@/lib/types';
import type { StockItem, WeightRecord } from '@/lib/xlsx-parser';
import { getErrorMessage, hasPermission } from '@/lib/utils';
import { batchCattle, batchSummary, feedLines } from '@/lib/batch-stats';
import { growth, weighPoints } from '@/lib/cattle-stats';
import { exportToExcel } from '@/lib/excel-export';
import IngredientFlow, { type IngredientChoice } from './IngredientFlow';
import { kgPerUnit } from '@/lib/daily-feed';
import { useText, useValueText, type Tx } from '@/hooks/useText';
import { shownDay } from '@/lib/khmer-date';
import { useFeedUnits } from '../feed/DailyFeedFlow';

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
  /** The other active batches, to move an animal into. */
  otherBatches?: BatchItem[];
  onMoveCow?: (cowId: string, toBatchId: string) => Promise<void>;
}

type Tab = 'cattle' | 'feeding' | 'growth';
const TABS: { key: Tab; label: string }[] = [
  { key: 'cattle', label: 'tabCattle' },
  { key: 'feeding', label: 'tabFeeding' },
  { key: 'growth', label: 'tabGrowth' },
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

function sellText(daysToTarget: number | null, tx: Tx): { text: string; late: boolean } | null {
  if (daysToTarget === null) return null;
  if (daysToTarget > 0) return { text: tx(daysToTarget === 1 ? 'sellInOne' : 'sellInMany', { n: daysToTarget }), late: false };
  if (daysToTarget === 0) return { text: tx('plannedToday'), late: false };
  return { text: tx(daysToTarget === -1 ? 'pastOne' : 'pastMany', { n: -daysToTarget }), late: true };
}

export default function BatchDetailPage({ batch, stock, weightTracking, feedProducts, currentUser, onBack, onWeigh, onAddCattle, onTreat, onEdit, onUpdateBatch, onRemoveCow, onDelete, otherBatches = [], onMoveCow }: BatchDetailPageProps) {
  const { tx, language } = useText('batchesPage');
  const val = useValueText();
  const units = useFeedUnits();
  const [tab, setTab] = useState<Tab>('cattle');
  const [ingredientDialog, setIngredientDialog] = useState<null | { existing: IngredientChoice | null }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'warning'; confirmText: string; onConfirm?: () => void }>(null);
  const [moving, setMoving] = useState<StockItem | null>(null);

  const isActive = batch.status === 'Active';
  const canEdit = hasPermission(currentUser, 'batch_edit');
  const canWeigh = isActive && canEdit && hasPermission(currentUser, 'weight_record');
  const canTreat = isActive && hasPermission(currentUser, 'health_record');
  const canAdd = isActive && canEdit;
  const canDelete = !!onDelete && hasPermission(currentUser, 'batch_delete');

  const cattle = useMemo(() => batchCattle(batch, stock), [batch, stock]);
  const summary = useMemo(() => batchSummary(batch, stock, weightTracking, feedProducts), [batch, stock, weightTracking, feedProducts]);
  const lines = useMemo(() => feedLines(batch.feedingProgram, feedProducts), [batch.feedingProgram, feedProducts]);
  const sell = sellText(summary.daysToTarget, tx);

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
  const fail = (e: unknown, fallback: string) => setConfirm({ title: tx('wrong'), description: getErrorMessage(e, fallback), type: 'danger', confirmText: tx('ok') });

  const saveIngredient = async (ing: IngredientChoice) => {
    const existing = ingredientDialog?.existing;
    const list = existing
      ? program.ingredients.map(i => (i.name === existing.name ? ing : i))
      : [...program.ingredients, ing];
    await saveProgram({ ingredients: list });
  };

  const askRemoveIngredient = (name: string) => setConfirm({
    title: tx('stopTitle'),
    description: tx('stopDesc', { name }),
    type: 'warning',
    confirmText: tx('remove'),
    onConfirm: async () => { try { await saveProgram({ ingredients: program.ingredients.filter(i => i.name !== name) }); } catch (e) { fail(e, tx('couldNotRemove')); } },
  });

  // An animal can move only into an active batch on its own farm.
  const targetsFor = (cow: StockItem) => otherBatches.filter(b => b.id !== batch.id && b.status === 'Active' && (!b.farmLocation || b.farmLocation === cow.location));
  const moveTo = (cow: StockItem, to: BatchItem) => {
    setMoving(null);
    setConfirm({
      title: tx('moveConfirmTitle', { tag: cow.id, to: to.name }),
      description: tx('moveConfirmDesc', { from: batch.name, to: to.name }),
      type: 'warning',
      confirmText: tx('move'),
      onConfirm: async () => { try { await onMoveCow!(cow.id, to.id); } catch (e) { fail(e, tx('couldNotMove')); } },
    });
  };

  const askRemoveCow = (cowId: string) => setConfirm({
    title: tx('takeOutConfirmTitle'),
    description: tx('takeOutConfirmDesc', { tag: cowId, batch: batch.name }),
    type: 'warning',
    confirmText: tx('takeOut'),
    onConfirm: async () => { try { await onRemoveCow(batch.id, cowId); } catch (e) { fail(e, tx('couldNotRemove')); } },
  });

  const askToggleBatch = () => setConfirm({
    title: isActive ? tx('closeTitle') : tx('openTitle'),
    description: isActive ? tx('closeDesc') : tx('openDesc'),
    type: 'warning',
    confirmText: isActive ? tx('closeIt') : tx('openIt'),
    onConfirm: async () => { try { await onUpdateBatch(batch.id, { status: isActive ? 'Closed' : 'Active' }); } catch (e) { fail(e, tx('couldNotChange')); } },
  });

  const askDelete = () => setConfirm({
    title: tx('deleteTitle'),
    description: tx('deleteDesc', { name: batch.name }),
    type: 'danger',
    confirmText: tx('delete'),
    onConfirm: async () => { try { await onDelete?.(batch.id); onBack(); } catch (e) { fail(e, tx('couldNotDelete')); } },
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

  const feedingState = !batch.feedingProgram || program.ingredients.length === 0 ? 'none' : feedingOn ? 'on' : 'paused';
  const feedingStatusText = feedingState === 'none' ? tx('noFeed') : feedingState === 'on' ? tx('feedingOn') : tx('feedingPaused');

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Button variant="ghost" onClick={onBack} className="-ml-3"><ArrowLeft /> {tx('allBatches')}</Button>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-3xl font-semibold text-ink [overflow-wrap:anywhere]">{batch.name}</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-ink'}`}>{isActive ? tx('active') : tx('closed')}</span>
        </div>
        <p className="mt-1 text-lg text-ink-muted">{[batch.farmLocation, tx('started', { day: shownDay(batch.startDate, language) }), summary.daysIn !== null ? tx('daysN', { n: summary.daysIn }) : null].filter(Boolean).join(' · ')}</p>
        {(sell || batch.expectedSellingPrice) && (
          <p className={`mt-1 text-lg font-medium ${sell?.late ? 'text-amber-800' : 'text-ink'}`}>
            {[sell?.text, batch.expectedSellingPrice ? tx('hopedFor', { amount: riel(batch.expectedSellingPrice) }) : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </section>

      {(canWeigh || canTreat || canAdd) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={tx('actions')}>
          {canWeigh && <Button size="lg" onClick={onWeigh} disabled={cattle.length === 0}><Scale /> {tx('weighGroup')}</Button>}
          {canTreat && <Button size="lg" variant="outline" onClick={() => onTreat(cattle.map(c => c.id))} disabled={cattle.length === 0}><Syringe /> {tx('treatGroup')}</Button>}
          {canAdd && <Button size="lg" variant="outline" onClick={onAddCattle}><UserPlus /> {tx('addCattle')}</Button>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Tile label={tx('cattle')} value={String(summary.head)} sub={tx('inBatch')} />
        <Tile label={tx('avgWeight')} value={summary.head ? kgText(summary.avgWeight) : '—'} />
        <Tile label={tx('dailyGain')} value={summary.perDay !== null ? `${summary.perDay} kg` : '—'} sub={summary.perDay !== null ? tx('eachDay') : tx('needs2')} />
        <Tile label={tx('feedCost')} value={summary.feedCostPerDay > 0 ? riel(summary.feedCostPerDay) : '—'} sub={tx('eachDay')} />
      </section>

      <div role="tablist" aria-label={tx('detailsAria')} className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`min-h-12 flex-1 whitespace-nowrap border-b-4 px-2 text-base font-medium sm:px-4 sm:text-lg ${tab === t.key ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {tx(t.label)}
          </button>
        ))}
      </div>

      {tab === 'cattle' && (
        cattle.length === 0 ? (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-6 text-center">
            <p className="text-lg text-ink-muted">{tx('noCattle')}</p>
            {canAdd && <Button onClick={onAddCattle}><Plus /> {tx('addCattle')}</Button>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map(({ cow, g }) => (
              <li key={cow.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-ink">{cow.id}</p>
                  <p className="text-base text-ink-muted">{[val(cow.sex), cow.breed].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{kgText(g.currentWeight)}{g.gain !== 0 && <span className={`ml-2 text-base font-medium ${g.gain < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{signed(g.gain)} kg</span>}</p>
                </div>
                {canAdd && (
                  <div className="flex shrink-0">
                    {onMoveCow && targetsFor(cow).length > 0 && <Button variant="ghost" size="icon" aria-label={tx('moveAria', { tag: cow.id })} title={tx('moveTitle')} onClick={() => setMoving(cow)}><ArrowRightLeft /></Button>}
                    <Button variant="ghost" size="icon" aria-label={tx('takeOutAria', { tag: cow.id })} title={tx('takeOutTitle')} onClick={() => askRemoveCow(cow.id)}><X /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'feeding' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className={`text-lg font-semibold ${feedingState === 'on' ? 'text-emerald-800' : 'text-ink'}`}>{feedingStatusText}</p>
              <p className="text-base text-ink-muted">{feedingOn ? tx('feedingOnHint') : tx('feedingPausedHint')}</p>
            </div>
            {isActive && canEdit && program.ingredients.length > 0 && (
              <Button variant="outline" onClick={async () => { try { await saveProgram({ status: feedingOn ? 'Paused' : 'Active' }); } catch (e) { fail(e, tx('couldNotChangeFeeding')); } }}>{feedingOn ? tx('pause') : tx('startFeeding')}</Button>
            )}
          </div>

          {lines.length > 0 ? (
            <ul className="space-y-3">
              {lines.map(l => (
                <li key={l.name} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-ink">{l.name}</p>
                    <p className="text-base text-ink">
                      {l.product && summary.head > 0 ? tx('aDayForBatch', { amount: units.amount(l.product, (l.kgPerHead * summary.head) / kgPerUnit(l.product)) }) : null}
                      {tx('kgEach', { kg: r1(l.kgPerHead) })}
                    </p>
                    <p className="text-base text-ink-muted">{tx('costLine', { each: riel(l.costPerHead), group: riel(l.costPerHead * summary.head) })}</p>
                    {!l.inCatalogue && <p className="mt-1 text-base font-medium text-amber-800">{tx('notInList')}</p>}
                  </div>
                  {isActive && canEdit && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label={tx('changeAria', { name: l.name })} onClick={() => setIngredientDialog({ existing: { name: l.name, productId: l.productId, portionPerHead: l.kgPerHead, unitCost: l.unitCost } })}><Pencil /></Button>
                      <Button variant="ghost" size="icon" aria-label={tx('removeAria', { name: l.name })} onClick={() => askRemoveIngredient(l.name)}><Trash2 className="text-rose-700" /></Button>
                    </div>
                  )}
                </li>
              ))}
              <li className="rounded-2xl bg-slate-50 p-4 text-lg text-ink">
                {tx('oneEats', { kg: r1(lines.reduce((s, l) => s + l.kgPerHead, 0)), amount: riel(lines.reduce((s, l) => s + l.costPerHead, 0)) })}
              </li>
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('nothingSetUp')}</p>
          )}
          {isActive && canEdit && <Button onClick={() => setIngredientDialog({ existing: null })}><Plus /> {tx('addFeed')}</Button>}
        </div>
      )}

      {tab === 'growth' && (
        ranked.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('growthEmpty')}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile label={tx('fastest')} value={ranked[0].cow.id} sub={tx('kgADay', { kg: ranked[0].g.perDay ?? 0 })} />
              <Tile label={tx('least')} value={ranked[ranked.length - 1].cow.id} sub={tx('kgADay', { kg: ranked[ranked.length - 1].g.perDay ?? 0 })} />
            </div>
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {ranked.map(({ cow, g }, i) => (
                <li key={cow.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                  <div>
                    <p className="text-lg font-semibold text-ink">{i + 1}. {cow.id}</p>
                    <p className="text-base text-ink-muted">{tx('fromTo', { from: kgText(g.startWeight), to: kgText(g.currentWeight) })}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${(g.perDay ?? 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{tx('kgADay', { kg: g.perDay ?? 0 })}</p>
                    <p className="text-base text-ink-muted">{tx('gainIn', { gain: signed(g.gain), days: g.days })}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={exportGrowth}><Download /> {tx('downloadExcel')}</Button>
          </div>
        )
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
          <Button variant="outline" onClick={onEdit}><Pencil /> {tx('editDetails')}</Button>
          <Button variant="outline" onClick={askToggleBatch}>{isActive ? tx('closeBatch') : tx('openAgain')}</Button>
          {canDelete && <Button variant="destructive" onClick={askDelete}><Trash2 /> {tx('deleteBatch')}</Button>}
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

      {moving && (
        <Dialog open onOpenChange={open => { if (!open) setMoving(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold text-ink">{tx('moveDialog', { tag: moving.id })}</DialogTitle>
              <DialogDescription className="text-base text-ink-muted">{tx('moveDialogDesc', { farm: moving.location || tx('itsFarm') })}</DialogDescription>
            </DialogHeader>
            <ul className="space-y-2">
              {targetsFor(moving).map(b => (
                <li key={b.id}>
                  <button type="button" onClick={() => moveTo(moving, b)} className="flex min-h-14 w-full flex-col items-start rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left hover:border-emerald-600">
                    <span className="text-lg font-semibold text-ink">{b.name}</span>
                    <span className="text-base text-ink-muted">{tx('cattleN', { n: batchCattle(b, stock).length })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
