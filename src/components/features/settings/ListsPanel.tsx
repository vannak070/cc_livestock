'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Input } from '@/components/ui/input';
import type { MasterSetup } from '@/types/settings.types';
import { getErrorMessage } from '@/lib/utils';

type ListKey = 'breeds' | 'sexes' | 'healthStatuses' | 'vaccineTypes' | 'diseaseTypes' | 'feedTypes' | 'batchTypes' | 'weightUnits' | 'buyTypes' | 'purchaseTypes' | 'paymentMethods' | 'revenueTypes';

const GROUPS: { title: string; lists: { key: ListKey; label: string; hint: string; careful?: boolean }[] }[] = [
  { title: 'Cattle', lists: [
    { key: 'breeds', label: 'Breeds', hint: 'The breeds you can choose when adding cattle.' },
    { key: 'sexes', label: 'Male and female', hint: 'The sex choices for cattle.', careful: true },
    { key: 'healthStatuses', label: 'Health states', hint: 'How an animal can be marked, for example Good or Poor.', careful: true },
    { key: 'weightUnits', label: 'Weight units', hint: 'The units weights are shown in.' },
  ] },
  { title: 'Health and feed', lists: [
    { key: 'vaccineTypes', label: 'Vaccines and dewormers', hint: 'The vaccines you can pick when treating. The Health page counts them.' },
    { key: 'diseaseTypes', label: 'Diseases', hint: 'Common illnesses and symptoms.' },
    { key: 'feedTypes', label: 'Kinds of feed', hint: 'Used to group feeds. Also changed from the Feed page.' },
    { key: 'batchTypes', label: 'Batch purposes', hint: 'What a group of cattle is for.' },
  ] },
  { title: 'Buying and selling', lists: [
    { key: 'buyTypes', label: 'How the price was set', hint: 'For example by weight or one price.', careful: true },
    { key: 'purchaseTypes', label: 'Where cattle came from', hint: 'For example Bought or Born in farm.', careful: true },
    { key: 'paymentMethods', label: 'Payment methods', hint: 'How you pay for cattle.' },
    { key: 'revenueTypes', label: 'Kinds of income', hint: 'For recording income.' },
  ] },
];

interface ListsPanelProps {
  settings: MasterSetup;
  onSettings: (next: MasterSetup) => Promise<void>;
}

export default function ListsPanel({ settings, onSettings }: ListsPanelProps) {
  const [open, setOpen] = useState<ListKey | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);

  const meta = GROUPS.flatMap(g => g.lists).find(l => l.key === open);
  const items = open ? ((settings[open] as string[] | undefined) ?? []) : [];

  const add = async () => {
    const value = text.trim();
    if (!open || !value) return;
    if (items.some(i => i.toLowerCase() === value.toLowerCase())) { setError(`"${value}" is already in the list.`); return; }
    setError('');
    try {
      await onSettings({ ...settings, [open]: [...items, value] });
      setText('');
    } catch (e) {
      setError(getErrorMessage(e, 'Could not add it.'));
    }
  };

  const askRemove = (item: string) => {
    if (!open) return;
    setConfirm({
      title: `Remove "${item}"?`,
      description: meta?.careful
        ? 'The app uses some of these words to decide alerts and totals. Removing one can change what you see. Records that already use it keep it.'
        : 'It will no longer be offered as a choice. Records that already use it keep it.',
      type: 'danger',
      confirmText: 'Remove',
      onConfirm: async () => {
        try { await onSettings({ ...settings, [open]: items.filter(i => i !== item) }); } catch (e) { setConfirm({ title: 'Could not remove', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' }); }
      },
    });
  };

  if (open && meta) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setOpen(null); setText(''); setError(''); }} className="-ml-3">← All lists</Button>
        <div>
          <h3 className="text-2xl font-semibold text-ink">{meta.label}</h3>
          <p className="text-base text-ink-muted">{meta.hint}</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); add(); }} className="flex gap-2">
          <Input aria-label={`Add to ${meta.label}`} value={text} onChange={e => { setText(e.target.value); setError(''); }} placeholder="Type a new one" className="h-14 text-lg" />
          <Button type="submit" size="lg" aria-label="Add"><Plus /></Button>
        </form>
        {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
        {items.length === 0 ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Nothing in this list yet.</p> : (
          <ul className="space-y-2">
            {items.map(item => (
              <li key={item} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
                <span className="break-words text-lg text-ink">{item}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove ${item}`} onClick={() => askRemove(item)}><Trash2 className="text-rose-700" /></Button>
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
      <p className="text-base text-ink-muted">The choices people pick from in forms. Farm names are managed on the Farms page.</p>
      {GROUPS.map(g => (
        <section key={g.title}>
          <h3 className="mb-2 text-lg font-semibold text-ink">{g.title}</h3>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {g.lists.map(l => (
              <li key={l.key}>
                <button type="button" onClick={() => setOpen(l.key)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-left hover:border-emerald-600">
                  <span>
                    <span className="block text-lg font-semibold text-ink">{l.label}</span>
                    <span className="block text-base text-ink-muted">{l.hint}</span>
                  </span>
                  <span className="shrink-0 text-base font-medium text-ink-muted">{((settings[l.key] as string[] | undefined) ?? []).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
