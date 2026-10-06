'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSettingsAction } from '@/app/actions';
import type { MasterSetup } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';
import { useText } from '@/hooks/useText';

interface FeedCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: MasterSetup;
  onSettingsUpdated?: () => void;
}

const DEFAULT_KINDS = ['Concentrate Feed', 'Silage', 'Fresh Grass', 'Hay Mix', 'Supplement', 'Medicine'];

export const FeedCategoryModal: React.FC<FeedCategoryModalProps> = (props) => (
  // Remount on every open so the list starts from what is saved.
  <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
    {props.isOpen && <KindsBody {...props} />}
  </Dialog>
);

function KindsBody({ onClose, settings, onSettingsUpdated }: FeedCategoryModalProps) {
  const { tx } = useText('feedFlows');
  const flow = useText('flow').tx;
  const [kinds, setKinds] = useState<string[]>(settings?.feedTypes || DEFAULT_KINDS);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (kinds.some(k => k.toLowerCase() === n.toLowerCase())) { setError(tx('errDup', { name: n })); return; }
    setKinds([...kinds, n]);
    setName('');
    setError('');
  };

  const remove = (k: string) => {
    if (kinds.length <= 1) { setError(tx('errKeepOne')); return; }
    setKinds(kinds.filter(x => x !== k));
    setError('');
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateSettingsAction({ feedTypes: kinds });
      if (res.success) { onSettingsUpdated?.(); onClose(); } else setError(res.error || tx('errSaveList'));
    } catch (e) {
      setError(getErrorMessage(e, tx('errSaveList')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader className="text-left">
        <DialogTitle className="text-2xl font-semibold text-ink">{tx('kindsTitle')}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">{tx('kindsSub')}</DialogDescription>
      </DialogHeader>
      <form onSubmit={e => { e.preventDefault(); add(); }} className="flex gap-2">
        <Input aria-label={tx('newKindAria')} value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder={tx('newKindPlaceholder')} className="h-14 text-lg" />
        <Button type="submit" size="lg" aria-label={tx('addKindAria')}><Plus /></Button>
      </form>
      <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
        {kinds.map(k => (
          <li key={k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
            <span className="break-words text-lg font-medium text-ink">{k}</span>
            <Button type="button" variant="ghost" size="icon" aria-label={tx('removeKind', { kind: k })} onClick={() => remove(k)}><Trash2 className="text-rose-700" /></Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" size="lg" onClick={onClose}>{tx('cancel')}</Button>
        <Button type="button" size="lg" className="flex-1" onClick={save} disabled={saving}>{saving ? flow('saving') : flow('save')}</Button>
      </div>
    </DialogContent>
  );
}
