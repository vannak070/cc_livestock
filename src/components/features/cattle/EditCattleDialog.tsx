'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LISTBOX_FIELD, ListboxSelect } from '@/components/ui/listbox-select';
import type { StockItem } from '@/lib/types';
import { cattleEditProblem, type CattleDetails } from '@/lib/cattle-edit';
import { farmToday } from '@/lib/daily-feed';
import { useText, useValueText } from '@/hooks/useText';

/**
 * A Super Admin corrects an animal's details (src/lib/cattle-edit.ts). The tag, farm, weight, health and status are
 * not here: they have their own steps so the history stays right. The server checks everything again.
 */
export default function EditCattleDialog({ cow, breeds, paymentMethods, showMoney, onSave, onClose }: {
  cow: StockItem;
  breeds: string[];
  paymentMethods: string[];
  /** Price fields only for people who see money. */
  showMoney: boolean;
  onSave: (details: Partial<CattleDetails>) => Promise<void>;
  onClose: () => void;
}) {
  const { tx } = useText('cattlePage');
  const val = useValueText();
  const na = (s: string | undefined) => (s && s !== 'N/A' ? s : '');
  const [d, setD] = useState<CattleDetails>({
    breed: cow.breed ?? '', sex: cow.sex ?? '', age: na(cow.age), ownerName: cow.ownerName ?? '', phone: na(cow.phone),
    purchaseDate: cow.purchaseDate ? cow.purchaseDate.slice(0, 10) : '', paymentMethod: na(cow.paymentMethod),
    unitPrice: cow.unitPrice ?? 0, totalPrice: cow.totalPrice ?? 0, remark: cow.remark ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<CattleDetails>) => { setD(x => ({ ...x, ...patch })); setError(''); };

  // Keeps a value that is not in the settings lists (an older record) so opening the form never changes it.
  const withCurrent = (list: string[], current: string) => (current && !list.includes(current) ? [current, ...list] : list);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const details: Partial<CattleDetails> = { ...d, age: d.age || 'N/A', phone: d.phone || 'N/A', paymentMethod: d.paymentMethod || 'N/A', purchaseDate: d.purchaseDate || null };
    if (!showMoney) { delete details.unitPrice; delete details.totalPrice; }
    const problem = cattleEditProblem(details, farmToday());
    if (problem) { setError(tx(`edit_${problem}`)); return; }
    setBusy(true);
    try {
      await onSave(details);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : tx('editFailed'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, control: React.ReactNode, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-base font-medium text-ink">{label}</span>
      {control}
      {hint && <span className="mt-1 block text-sm text-ink-muted">{hint}</span>}
    </label>
  );
  const text = (key: 'age' | 'ownerName' | 'phone', inputMode?: 'tel') => (
    <Input value={d[key]} inputMode={inputMode} onChange={e => set({ [key]: e.target.value })} className="h-12 text-lg" />
  );
  const money = (key: 'unitPrice' | 'totalPrice') => (
    <Input type="number" min={0} step="any" inputMode="numeric" value={d[key] || ''} onChange={e => set({ [key]: Number(e.target.value) })} className="h-12 text-lg" />
  );

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[90vh]">
        <DialogHeader className="shrink-0 space-y-1 px-6 pb-3 pt-6 text-left sm:text-left">
          <DialogTitle className="text-2xl font-semibold text-ink">{tx('editTitle', { id: cow.id })}</DialogTitle>
          <DialogDescription className="text-base text-ink-muted">{tx('editSub')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field(tx('editBreed'), <ListboxSelect buttonClassName={LISTBOX_FIELD} label={tx('editBreed')} value={d.breed} onChange={v => set({ breed: v })} options={withCurrent(breeds, d.breed).map(b => ({ value: b, label: b }))} />)}
              {field(tx('editSex'), <ListboxSelect buttonClassName={LISTBOX_FIELD} label={tx('editSex')} value={d.sex} onChange={v => set({ sex: v })} options={[{ value: 'Male', label: val('Male') }, { value: 'Female', label: val('Female') }]} />)}
              {field(tx('editAge'), text('age'))}
              {field(tx('arrived'), <Input type="date" value={d.purchaseDate ?? ''} max={farmToday()} onChange={e => set({ purchaseDate: e.target.value })} className="h-12 text-lg" />)}
              {field(tx('sellerOrOwner'), text('ownerName'))}
              {field(tx('sellerPhone'), text('phone', 'tel'))}
              {field(tx('paidBy'), <ListboxSelect buttonClassName={LISTBOX_FIELD} label={tx('paidBy')} value={d.paymentMethod ?? ''} onChange={v => set({ paymentMethod: v })} options={[{ value: '', label: '—' }, ...withCurrent(paymentMethods, d.paymentMethod ?? '').map(p => ({ value: p, label: p }))]} />)}
              {showMoney && field(tx('editPricePerKg'), money('unitPrice'))}
              {showMoney && field(tx('editTotalPaid'), money('totalPrice'), tx('editTotalHint'))}
              <div className="sm:col-span-2">
                {field(tx('note'), <textarea value={d.remark} maxLength={500} rows={3} onChange={e => set({ remark: e.target.value })} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-lg text-ink focus:border-emerald-600 focus:outline-none" />)}
              </div>
            </div>
          </div>
          <div className="shrink-0 space-y-3 border-t border-slate-100 px-6 pb-6 pt-4">
            {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" size="lg" onClick={onClose}>{tx('editCancel')}</Button>
              <Button type="submit" size="lg" className="flex-1" disabled={busy}>{busy ? tx('editSaving') : tx('editSave')}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
