'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import type { BatchItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import { FlowDone, FlowFooter, FlowShell } from '../flow/FlowShell';
import CattlePicker from './CattlePicker';

interface AddToBatchFlowProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchItem;
  /** Active cattle that are in no active batch. */
  freeCattle: StockItem[];
  onAssign: (batchId: string, cowIds: string[]) => Promise<void>;
}

export default function AddToBatchFlow(props: AddToBatchFlowProps) {
  // Remount on every open so each addition starts with nothing chosen.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <AddBody {...props} />}
    </Dialog>
  );
}

function AddBody({ onClose, batch, freeCattle, onAssign }: AddToBatchFlowProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<number | null>(null);

  // Only animals on the batch's own farm can join it.
  const pool = batch.farmLocation ? freeCattle.filter(c => c.location === batch.farmLocation) : freeCattle;

  const save = async () => {
    if (picked.length === 0) { setError('Tap at least one animal.'); return; }
    setSaving(true);
    setError('');
    try {
      await onAssign(batch.id, picked);
      setAdded(picked.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add them. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const done = added !== null;
  return (
    <FlowShell
      steps={[]}
      step={done ? 'done' : 'pick'}
      title={done ? 'Added' : 'Add cattle'}
      subtitle={done ? undefined : `To ${batch.name}. Animals already in a batch are not listed.`}
      error={error}
      onSubmit={done ? undefined : save}
      footer={done ? null : <FlowFooter label={saving ? 'Saving…' : picked.length ? `Add ${picked.length}` : 'Add'} busy={saving} />}
    >
      {done ? (
        <FlowDone
          message={<><span className="font-semibold">{added} {added === 1 ? 'animal' : 'animals'}</span> added to {batch.name}</>}
          again="Add more"
          onAgain={() => { setAdded(null); setPicked([]); }}
          onClose={onClose}
        />
      ) : (
        <CattlePicker cattle={pool} selected={picked} onChange={ids => { setPicked(ids); setError(''); }} emptyText="No free animals. Everyone is already in a batch." />
      )}
    </FlowShell>
  );
}
