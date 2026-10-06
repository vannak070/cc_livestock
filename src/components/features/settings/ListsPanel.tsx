'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Input } from '@/components/ui/input';
import type { MasterSetup } from '@/types/settings.types';
import { getErrorMessage } from '@/lib/utils';
import { MAX_CATEGORY_LENGTH, costCategoriesFrom } from '@/lib/farm-costs';
import { SALE_REVIEW_MAX_DAYS, SALE_REVIEW_MIN_DAYS, saleWindowDays, saleWindowProblem } from '@/lib/sale-review';
import { useText } from '@/hooks/useText';

type ListKey = 'breeds' | 'sexes' | 'healthStatuses' | 'vaccineTypes' | 'diseaseTypes' | 'feedTypes' | 'batchTypes' | 'weightUnits' | 'buyTypes' | 'purchaseTypes' | 'paymentMethods' | 'revenueTypes' | 'costCategories';

// Labels and hints are looked up in the Settings texts: l_<key> and h_<key>.
const GROUPS: { title: string; lists: { key: ListKey; careful?: boolean }[] }[] = [
  { title: 'gCattle', lists: [{ key: 'breeds' }, { key: 'sexes', careful: true }, { key: 'healthStatuses', careful: true }, { key: 'weightUnits' }] },
  { title: 'gHealthFeed', lists: [{ key: 'vaccineTypes' }, { key: 'diseaseTypes' }, { key: 'feedTypes' }, { key: 'batchTypes' }] },
  { title: 'gBuySell', lists: [{ key: 'buyTypes', careful: true }, { key: 'purchaseTypes', careful: true }, { key: 'paymentMethods' }, { key: 'revenueTypes' }, { key: 'costCategories' }] },
];

// Lists that must never be empty; the form refuses to remove the last item.
const KEEP_ONE: ListKey[] = ['costCategories'];

function listOf(settings: MasterSetup, key: ListKey): string[] {
  if (key === 'costCategories') return costCategoriesFrom(settings);
  return (settings[key] as string[] | undefined) ?? [];
}

interface ListsPanelProps {
  settings: MasterSetup;
  onSettings: (patch: Partial<MasterSetup>) => Promise<void>;
}

export default function ListsPanel({ settings, onSettings }: ListsPanelProps) {
  const { tx } = useText('settingsPage');
  const [open, setOpen] = useState<ListKey | null>(null);
  const [days, setDays] = useState(String(saleWindowDays(settings)));
  const [daysError, setDaysError] = useState('');
  const [daysSaved, setDaysSaved] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  const meta = GROUPS.flatMap(g => g.lists).find(l => l.key === open);
  const items = open ? listOf(settings, open) : [];

  const add = async () => {
    const value = text.trim();
    if (!open || !value) return;
    if (items.some(i => i.toLowerCase() === value.toLowerCase())) { setError(tx('inList', { value })); return; }
    if (open === 'costCategories' && value.length > MAX_CATEGORY_LENGTH) { setError(tx('tooLong', { n: MAX_CATEGORY_LENGTH })); return; }
    setError('');
    try {
      await onSettings({ [open]: [...items, value] });
      setText('');
    } catch (e) {
      setError(getErrorMessage(e, tx('couldNotAdd')));
    }
  };

  const saveDays = async () => {
    const n = Number(days);
    const problem = saleWindowProblem(n);
    if (days.trim() === '' || problem) { setDaysError(problem ?? tx('typeDays')); setDaysSaved(false); return; }
    setDaysError('');
    try {
      await onSettings({ saleReviewDays: n });
      setDaysSaved(true);
    } catch (e) {
      setDaysSaved(false);
      setDaysError(getErrorMessage(e, tx('couldNotSaveIt')));
    }
  };

  const askRemove = (item: string) => {
    if (!open) return;
    if (KEEP_ONE.includes(open) && items.length <= 1) {
      setConfirm({ title: tx('keepOne'), description: tx('keepOneDesc'), type: 'danger', confirmText: tx('ok') });
      return;
    }
    setConfirm({
      title: tx('removeItem', { item }),
      description: meta?.careful ? tx('removeCareful') : tx('removePlain'),
      type: 'danger',
      confirmText: tx('remove'),
      onConfirm: async () => {
        try { await onSettings({ [open]: items.filter(i => i !== item) }); } catch (e) { setConfirm({ title: tx('couldNotRemove'), description: getErrorMessage(e, tx('somethingWrong')), type: 'danger', confirmText: tx('ok') }); }
      },
    });
  };

  if (open && meta) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setOpen(null); setText(''); setError(''); }} className="-ml-3">{tx('allLists')}</Button>
        <div>
          <h3 className="text-2xl font-semibold text-ink">{tx(`l_${meta.key}`)}</h3>
          <p className="text-base text-ink-muted">{tx(`h_${meta.key}`)}</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); add(); }} className="flex gap-2">
          <Input aria-label={tx('addTo', { list: tx(`l_${meta.key}`) })} value={text} onChange={e => { setText(e.target.value); setError(''); }} placeholder={tx('typeNew')} className="h-14 text-lg" />
          <Button type="submit" size="lg" aria-label={tx('add')}><Plus /></Button>
        </form>
        {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
        {items.length === 0 ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('emptyList')}</p> : (
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
                <span className="break-words text-lg text-ink">{item}</span>
                <Button variant="ghost" size="icon" aria-label={tx('removeAria', { name: item })} onClick={() => askRemove(item)}><Trash2 className="text-rose-700" /></Button>
              </li>
            ))}
          </ul>
        )}
        {confirm && <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-base text-ink-muted">{tx('listsIntro')}</p>
      <section className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{tx('sellReminder')}</h3>
          <p className="text-base text-ink-muted">{tx('sellReminderHint')}</p>
        </div>
        <form noValidate onSubmit={e => { e.preventDefault(); saveDays(); }} className="flex flex-wrap items-center gap-2">
          <Input aria-label={tx('daysBeforeAria')} type="number" inputMode="numeric" min={SALE_REVIEW_MIN_DAYS} max={SALE_REVIEW_MAX_DAYS} value={days} onChange={e => { setDays(e.target.value); setDaysSaved(false); setDaysError(''); }} className="h-14 w-28 text-center text-xl font-semibold" />
          <span className="text-lg text-ink">{tx('daysBefore')}</span>
          <Button type="submit" size="lg" className="ml-auto">{tx('save')}</Button>
        </form>
        {daysError && <p role="alert" className="text-base font-medium text-rose-700">{daysError}</p>}
        {daysSaved && <p role="status" className="text-base font-medium text-emerald-700">{tx('daysSaved', { n: saleWindowDays({ saleReviewDays: Number(days) }) })}</p>}
      </section>
      {GROUPS.map(g => (
        <section key={g.title}>
          <h3 className="mb-2 text-lg font-semibold text-ink">{tx(g.title)}</h3>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {g.lists.map(l => (
              <li key={l.key}>
                <button type="button" onClick={() => setOpen(l.key)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left hover:border-emerald-600">
                  <span>
                    <span className="block text-lg font-semibold text-ink">{tx(`l_${l.key}`)}</span>
                    <span className="block text-base text-ink-muted">{tx(`h_${l.key}`)}</span>
                  </span>
                  <span className="shrink-0 text-base font-medium text-ink-muted">{listOf(settings, l.key).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
