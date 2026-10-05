'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BatchItem, FarmItem, UserRoleItem } from '@/lib/types';
import type { StockItem } from '@/lib/xlsx-parser';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, today } from '../flow/FlowShell';
import CattlePicker from './CattlePicker';

interface BatchFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The batch being edited; leave empty to start a new one. */
  batch?: BatchItem | null;
  /** Active cattle that are in no active batch, for the new batch to take. */
  freeCattle: StockItem[];
  farms: FarmItem[];
  currentUser?: UserRoleItem;
  onCreate: (batch: Omit<BatchItem, 'cowIds'>, cowIds: string[]) => Promise<void>;
  onUpdate: (batchId: string, updates: Partial<BatchItem>) => Promise<void>;
  /** Moves an edited batch to another farm, with or without its cattle. */
  onMoveFarm?: (batchId: string, farm: string, moveCattle: boolean) => Promise<void>;
  /** Cattle still on the farm in the batch being edited. */
  batchHead?: number;
  /** Called with the new batch's id when the person chooses to open it. */
  onOpen?: (batchId: string) => void;
}

type Step = 'name' | 'where' | 'when' | 'cattle' | 'done';

// Ids are made on demand, not during render.
const newBatchId = () => `FAT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

export default function BatchFlow(props: BatchFlowProps) {
  // Remount on every open so each start or edit begins from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <BatchBody {...props} />}
    </Dialog>
  );
}

function BatchBody({ onClose, batch, freeCattle, farms, currentUser, onCreate, onUpdate, onOpen, onMoveFarm, batchHead = 0 }: BatchFlowProps) {
  const edit = !!batch;
  const lockedFarm = currentUser?.farmLocation && !['Super Admin', 'Admin', 'Company'].includes(currentUser.role) ? currentUser.farmLocation : null;
  const farmNames = useMemo(() => farms.map(f => f.name), [farms]);

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(batch?.name ?? '');
  // An office account working on one farm starts new batches on it (the page passes them as tied to that farm).
  const focusFarm = currentUser?.farmLocation && !lockedFarm ? currentUser.farmLocation : undefined;
  const [farm, setFarm] = useState(batch?.farmLocation ?? lockedFarm ?? (focusFarm && farmNames.includes(focusFarm) ? focusFarm : farmNames.length === 1 ? farmNames[0] : ''));
  // Stored dates can carry a time (2026-06-10T00:00:00Z); a date box only shows YYYY-MM-DD.
  const [start, setStart] = useState(batch?.startDate ? batch.startDate.slice(0, 10) : today());
  const [target, setTarget] = useState(batch?.sellingTargetDate ? batch.sellingTargetDate.slice(0, 10) : '');
  const [price, setPrice] = useState(batch?.expectedSellingPrice ? String(batch.expectedSellingPrice) : '');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  // Moving an existing batch to another farm normally takes its cattle along.
  const [moveCattle, setMoveCattle] = useState(true);
  const farmChanged = !!batch && !!farm && farm !== (batch.farmLocation ?? '');

  const showFarmStep = !lockedFarm && farmNames.length > 0;
  const steps: Step[] = [
    'name',
    ...(showFarmStep ? ['where' as Step] : []),
    'when',
    ...(edit ? [] : ['cattle' as Step]),
  ];
  const at = steps.indexOf(step);
  const last = steps[steps.length - 1];

  // Only animals on the chosen farm can join a farm's batch.
  const pool = useMemo(() => (farm ? freeCattle.filter(c => c.location === farm) : freeCattle), [freeCattle, farm]);

  const next = () => {
    if (step === 'name' && !name.trim()) { setError('Type a name for the batch.'); return; }
    if (step === 'where' && !farm) { setError('Choose which farm the batch is on.'); return; }
    if (step === 'when') {
      if (!start) { setError('Choose the start date.'); return; }
      if (target && target < start) { setError('The sell date cannot be before the start date.'); return; }
    }
    if (step === last) { save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };

  const save = async () => {
    if (!edit && picked.length === 0) { setError('Choose at least one animal.'); return; }
    setSaving(true);
    setError('');
    try {
      const priceNum = Number(price);
      const common = {
        name: name.trim(),
        startDate: start,
        farmLocation: farm || lockedFarm || undefined,
        sellingTargetDate: target || undefined,
        expectedSellingPrice: priceNum > 0 ? priceNum : undefined,
      };
      if (batch) {
        if (farmChanged && onMoveFarm) {
          // The farm (and the cattle, when chosen) change together on the server.
          await onMoveFarm(batch.id, farm, moveCattle && batchHead > 0);
          const { farmLocation: _farm, ...rest } = common;
          void _farm;
          await onUpdate(batch.id, rest);
        } else {
          await onUpdate(batch.id, common);
        }
        onClose();
      } else {
        const id = newBatchId();
        await onCreate({
          id,
          type: 'Fattening Program',
          status: 'Active',
          ...common,
          // Feeding starts empty on purpose: the farm sets up what the batch eats, then records it daily.
          feedingProgram: { ingredients: [], frequency: 'Twice Daily', startDate: start, status: 'Active' },
        }, picked);
        setCreatedId(id);
        setStep('done');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const heading: Record<Step, { title: string; sub: string }> = {
    name: { title: edit ? 'Edit batch' : 'Start a batch', sub: 'A batch is a group of cattle fed together.' },
    where: { title: 'Which farm?', sub: 'Only animals on this farm can join.' },
    when: { title: 'Dates and price', sub: 'The sell date and price are optional.' },
    cattle: { title: 'Which cattle?', sub: 'Animals already in a batch are not listed.' },
    done: { title: 'Batch started', sub: 'Next, set up what it eats.' },
  };

  const summary = step === 'cattle' ? [name.trim(), farm].filter(Boolean).join(' · ') : step === 'when' || step === 'where' ? name.trim() : '';

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={summary}
      error={error}
      onSubmit={step === 'done' ? undefined : next}
      footer={step === 'done' ? null : (
        <FlowFooter
          onBack={at === 0 ? undefined : back}
          label={step === last ? (saving ? 'Saving…' : edit ? 'Save' : picked.length ? `Start batch (${picked.length})` : 'Start batch') : 'Next'}
          busy={saving}
        />
      )}
    >
      {step === 'name' && (
        <Question label="Name of the batch" hint="For example Fattening October 2026.">
          <Input aria-label="Name of the batch" autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
        </Question>
      )}

      {step === 'where' && (
        <>
          <PickList options={farmNames} value={farm} onChange={v => { setFarm(v); setPicked([]); setError(''); }} />
          {farmChanged && batchHead > 0 && (
            <Question label={`Move its ${batchHead} ${batchHead === 1 ? 'animal' : 'cattle'} to ${farm} too?`} hint={moveCattle ? 'Recommended: the batch and its cattle stay on the same farm.' : `The cattle stay on ${batch?.farmLocation || 'their farm'} while the batch is on ${farm}.`}>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={moveCattle} onClick={() => setMoveCattle(true)}>Yes, move them</Choice>
                <Choice selected={!moveCattle} onClick={() => setMoveCattle(false)}>No</Choice>
              </div>
            </Question>
          )}
        </>
      )}

      {step === 'when' && (
        <>
          <Question label="Start date"><Input aria-label="Start date" type="date" value={start} onChange={e => { setStart(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <Question label="Plan to sell by (optional)"><Input aria-label="Sell date" type="date" value={target} min={start} onChange={e => { setTarget(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <Question label="Hoped-for price for each kg (៛, optional)">
            <Input aria-label="Price for each kg" type="number" step="any" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} className={`h-14 text-lg ${NUM}`} />
          </Question>
        </>
      )}

      {step === 'cattle' && <CattlePicker cattle={pool} selected={picked} onChange={ids => { setPicked(ids); setError(''); }} emptyText="Every animal on this farm is already in a batch." />}

      {step === 'done' && (
        <FlowDone
          message={<><span className="font-semibold">{name.trim()}</span> started with <span className="font-semibold">{picked.length} {picked.length === 1 ? 'animal' : 'animals'}</span></>}
          again="Open the batch"
          onAgain={() => { onOpen?.(createdId); onClose(); }}
          onClose={onClose}
        />
      )}
    </FlowShell>
  );
}
