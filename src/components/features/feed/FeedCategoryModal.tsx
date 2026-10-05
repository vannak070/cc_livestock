'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSettingsAction } from '@/app/actions';
import type { MasterSetup } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

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
  const [kinds, setKinds] = useState<string[]>(settings?.feedTypes || DEFAULT_KINDS);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (kinds.some(k => k.toLowerCase() === n.toLowerCase())) { setError(`"${n}" is already in the list.`); return; }
    setKinds([...kinds, n]);
    setName('');
    setError('');
  };

  const remove = (k: string) => {
    if (kinds.length <= 1) { setError('Keep at least one kind of feed.'); return; }
    setKinds(kinds.filter(x => x !== k));
    setError('');
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateSettingsAction({ ...settings, feedTypes: kinds });
      if (res.success) { onSettingsUpdated?.(); onClose(); } else setError(res.error || 'Could not save the list.');
    } catch (e) {
      setError(getErrorMessage(e, 'Could not save the list.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader className="text-left">
        <DialogTitle className="text-2xl font-semibold text-ink">Kinds of feed</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">Used to group your feeds, for example Silage or Medicine.</DialogDescription>
      </DialogHeader>
      <form onSubmit={e => { e.preventDefault(); add(); }} className="flex gap-2">
        <Input aria-label="New kind of feed" value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Add a kind, for example Mineral block" className="h-14 text-lg" />
        <Button type="submit" size="lg" aria-label="Add kind"><Plus /></Button>
      </form>
      <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
        {kinds.map(k => (
          <li key={k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
            <span className="break-words text-lg font-medium text-ink">{k}</span>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${k}`} onClick={() => remove(k)}><Trash2 className="text-rose-700" /></Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
        <Button type="button" size="lg" className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </DialogContent>
  );
}
