'use client';

import React, { useMemo, useState } from 'react';
import { Receipt, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { FarmCostItem, FarmItem, UserRoleItem } from '@/lib/types';
import { getErrorMessage, hasPermission } from '@/lib/utils';
import { addDays, farmToday } from '@/lib/daily-feed';
import { farmMatcher } from '@/lib/farm-scope';
import { useCostText } from './useCostText';
import { FarmSelect } from '@/components/ui/listbox-select';

interface CostsPageProps {
  costs: FarmCostItem[];
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
  onRecordCost: () => void;
  onDeleteCost: (id: string) => Promise<void>;
}

type Period = 'this' | 'last' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'this', label: 'thisMonth' },
  { key: 'last', label: 'lastMonth' },
  { key: 'all', label: 'all' },
];

const PAGE = 30;
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

export default function CostsPage({ costs, currentUser, farms = [], onRecordCost, onDeleteCost }: CostsPageProps) {
  const { text, category: label, monthName } = useCostText();
  const [period, setPeriod] = useState<Period>('this');
  const [farm, setFarm] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  const canRecord = hasPermission(currentUser, 'costs_record');
  const canDelete = hasPermission(currentUser, 'costs_delete');
  const showFarmFilter = !currentUser?.farmLocation && farms.length > 1;

  const today = farmToday();
  const thisMonth = today.slice(0, 7);
  const lastMonth = addDays(`${thisMonth}-01`, -1).slice(0, 7);

  const shown = useMemo(() => {
    const inFarm = farm ? farmMatcher(farm) : () => true;
    return costs.filter(c => inFarm(c.farmLocation) && (period === 'all' || c.date.slice(0, 7) === (period === 'this' ? thisMonth : lastMonth)));
  }, [costs, farm, period, thisMonth, lastMonth]);

  const total = shown.reduce((s, c) => s + c.amount, 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of shown) m.set(c.category, (m.get(c.category) ?? 0) + c.amount);
    return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [shown]);
  const max = Math.max(1, ...byCategory.map(c => c.amount));

  const periodText = period === 'this' ? monthName(thisMonth) : period === 'last' ? monthName(lastMonth) : text('allTime');

  const askDelete = (c: FarmCostItem) => setConfirm({
    title: text('deleteTitle'),
    description: text('deleteBody', { category: label(c.category), amount: riel(c.amount), date: c.date, farm: c.farmLocation }),
    type: 'danger',
    confirmText: text('deleteConfirm'),
    onConfirm: async () => {
      try {
        await onDeleteCost(c.id);
      } catch (e) {
        setConfirm({ title: text('deleteFailed'), description: getErrorMessage(e, text('somethingWrong')), type: 'danger', confirmText: text('ok') });
      }
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{text('title')}</h2>
          <p className="text-base text-ink-muted">{text('intro')}</p>
        </div>
        {canRecord && <Button size="lg" onClick={onRecordCost}><Receipt /> {text('record')}</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={text('period')} className="flex rounded-xl bg-slate-100 p-1">
          {PERIODS.map(p => (
            <button key={p.key} role="tab" type="button" aria-selected={period === p.key} onClick={() => { setPeriod(p.key); setVisible(PAGE); }}
              className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-base font-medium sm:px-5 ${period === p.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              {text(p.label)}
            </button>
          ))}
        </div>
        {showFarmFilter && (
          <FarmSelect farms={farms.map(f => f.name)} value={farm} onChange={f => { setFarm(f); setVisible(PAGE); }} label={text('farm')} allLabel={text('allFarms')} size="compact" />
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-ink-muted">{text('totalFor', { period: periodText })}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{riel(total)}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{text(shown.length === 1 ? 'countOne' : 'countMany', { n: shown.length })}</p>
        </div>
        {byCategory.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-semibold text-ink">{text('wentOn')}</h3>
            <ul className="space-y-3">
              {byCategory.map(c => (
                <li key={c.category}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base text-ink">{label(c.category)}</span>
                    <span className="shrink-0 text-base font-medium text-ink">{riel(c.amount)}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className="h-full rounded-full bg-emerald-700" style={{ width: `${(c.amount / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {shown.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-lg text-ink-muted">{costs.length === 0 ? text('noneYet') : text('noneFor', { period: periodText })}</p>
          {canRecord && costs.length === 0 && <Button size="lg" onClick={onRecordCost}><Receipt /> {text('record')}</Button>}
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {shown.slice(0, visible).map(c => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-ink">{label(c.category)}</p>
                  <p className="text-base text-ink-muted">{[c.date, !currentUser?.farmLocation ? c.farmLocation : null, c.recordedBy ? text('by', { name: c.recordedBy }) : null].filter(Boolean).join(' · ')}</p>
                  {c.note && <p className="mt-1 break-words text-base text-ink">{c.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <p className="text-lg font-semibold text-ink">{riel(c.amount)}</p>
                  {canDelete && (
                    <button type="button" onClick={() => askDelete(c)} aria-label={text('deleteAria', { category: label(c.category), amount: riel(c.amount), date: c.date })}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-rose-50 hover:text-rose-700">
                      <Trash2 className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {shown.length > visible && (
            <div className="text-center">
              <Button variant="outline" size="lg" onClick={() => setVisible(v => v + PAGE)}>{text('showMore', { n: shown.length - visible })}</Button>
            </div>
          )}
        </>
      )}

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
