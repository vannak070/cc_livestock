'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import type { BatchItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import { FlowDone, FlowFooter, FlowShell } from '../flow/FlowShell';
import CattlePicker from './CattlePicker';
import { useText } from '@/hooks/useText';

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
  const { tx, txn } = useText('batchesPage');
  const flow = useText('flow');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<number | null>(null);

  // Only animals on the batch's own farm can join it.
  const pool = batch.farmLocation ? freeCattle.filter(c => c.location === batch.farmLocation) : freeCattle;

  const save = async () => {
    if (picked.length === 0) { setError(tx('eTapOne')); return; }
    setSaving(true);
    setError('');
    try {
      await onAssign(batch.id, picked);
      setAdded(picked.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('eAdd'));
    } finally {
      setSaving(false);
    }
  };

  const done = added !== null;
  return (
    <FlowShell
      steps={[]}
      step={done ? 'done' : 'pick'}
      title={done ? tx('aTitleDone') : tx('aTitle')}
      subtitle={done ? undefined : tx('aSub', { batch: batch.name })}
      error={error}
      onSubmit={done ? undefined : save}
      footer={done ? null : <FlowFooter label={saving ? flow.tx('saving') : picked.length ? tx('aAddN', { n: picked.length }) : tx('aAdd')} busy={saving} />}
    >
      {done ? (
        <FlowDone
          message={tx('aAdded', { n: txn(added ?? 0, 'animalOne', 'animalMany'), batch: batch.name })}
          again={tx('aAgain')}
          onAgain={() => { setAdded(null); setPicked([]); }}
          onClose={onClose}
        />
      ) : (
        <CattlePicker cattle={pool} selected={picked} onChange={ids => { setPicked(ids); setError(''); }}  emptyText={tx('aNoFree')} />
      )}
    </FlowShell>
  );
}
