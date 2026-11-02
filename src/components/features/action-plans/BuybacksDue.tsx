'use client';

import React, { useState } from 'react';
import { FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveBatchContractAction } from '@/app/actions';
import { DUE_BUCKETS, canWritePlans, contractProblem, type BatchContract, type BuybackRow, type DueBucket } from '@/lib/action-plans';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import type { UserRoleItem } from '@/lib/types';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

const BUCKET_STYLE: Record<DueBucket, string> = {
  overdue: 'border-rose-300 bg-rose-50 text-rose-900',
  d7: 'border-amber-300 bg-amber-50 text-amber-900',
  d30: 'border-amber-200 bg-white text-ink',
  d60: 'border-slate-200 bg-white text-ink',
  later: 'border-slate-200 bg-white text-ink',
  noDate: 'border-slate-200 bg-slate-50 text-ink-muted',
};

interface Props {
  currentUser: UserRoleItem;
  rows: BuybackRow[];
  contracts: BatchContract[];
  onSaved: () => void;
  /** Reports shows the list without the contract buttons (they are on Action plans). */
  readOnly?: boolean;
}

/** Every batch with cattle due for buy-back, soonest first, with its contract. */
export default function BuybacksDue({ currentUser, rows, contracts, onSaved, readOnly = false }: Props) {
  const { tx, language } = useText('actionPlans');
  const [editing, setEditing] = useState<string | null>(null);
  const writer = !readOnly && canWritePlans(currentUser);

  if (rows.length === 0) return <p className="rounded-2xl bg-slate-50 p-5 text-base text-ink-muted">{tx('noBuybacksAll')}</p>;

  const within30 = rows.filter(r => r.bucket === 'overdue' || r.bucket === 'd7' || r.bucket === 'd30');
  const value30 = within30.reduce((s, r) => s + (r.value ?? 0), 0);
  const days = (r: BuybackRow) => r.daysLeft === undefined ? '—' : r.daysLeft < 0 ? tx('overdueDays', { n: -r.daysLeft }) : r.daysLeft === 0 ? tx('dueToday') : tx('daysLeft', { n: r.daysLeft });

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {DUE_BUCKETS.map(b => {
          const inB = rows.filter(r => r.bucket === b);
          return (
            <div key={b} className={`rounded-2xl border-2 p-3 ${BUCKET_STYLE[b]}`}>
              <dt className="text-sm font-medium">{tx(`b_${b}`)}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{inB.length}</dd>
              <dd className="text-sm">{tx('tileHead', { n: inB.reduce((s, r) => s + r.head, 0) })}</dd>
            </div>
          );
        })}
      </dl>
      {value30 > 0 && <p className="text-base text-ink">{tx('sumValue', { value: riel(value30) })}</p>}

      <ul className="space-y-3">
        {rows.map(r => {
          const contract = contracts.find(c => c.batchId === r.batchId);
          return (
            <li key={r.batchId} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold text-ink">{r.batchName}</h3>
                  <p className="text-base text-ink-muted">{r.farm} · {r.contractNo ? `${tx('colContract')} ${r.contractNo}` : tx('noContract')}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${BUCKET_STYLE[r.bucket]}`}>{tx(`b_${r.bucket}`)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-base sm:grid-cols-5">
                <div><dt className="text-sm text-ink-muted">{tx('colDueDate')}</dt><dd className="text-ink">{shownDay(r.dueDate, language)}<span className="block text-sm text-ink-muted">{days(r)}</span></dd></div>
                <div><dt className="text-sm text-ink-muted">{tx('colHead')}</dt><dd className="tabular-nums text-ink">{r.head}</dd></div>
                <div><dt className="text-sm text-ink-muted">{tx('colKg')}</dt><dd className="tabular-nums text-ink">{r.estKg.toLocaleString()}</dd></div>
                <div><dt className="text-sm text-ink-muted">{tx('colPrice')}</dt><dd className="tabular-nums text-ink">{r.pricePerKg ? riel(r.pricePerKg) : '—'}{r.priceSource === 'batch' && <span className="block text-sm text-ink-muted" title={tx('fromBatchHint')}>{tx('fromBatch')}</span>}{r.priceSource === 'plan' && <span className="block text-sm text-ink-muted" title={tx('fromPlanHint')}>{tx('fromPlan')}</span>}</dd></div>
                <div><dt className="text-sm text-ink-muted">{tx('colValue')}</dt><dd className="font-semibold tabular-nums text-ink">{r.value ? riel(r.value) : '—'}</dd></div>
              </dl>
              {writer && editing !== r.batchId && <Button variant="outline" size="sm" onClick={() => setEditing(r.batchId)}><FileSignature /> {tx('editContract')}</Button>}
              {writer && editing === r.batchId && (
                <ContractForm row={r} contract={contract} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-muted">{tx('estimateHint')}</p>
    </div>
  );
}

function ContractForm({ row, contract, onClose, onSaved }: { row: BuybackRow; contract?: BatchContract; onClose: () => void; onSaved: () => void }) {
  const { tx } = useText('actionPlans');
  const [no, setNo] = useState(contract?.contractNo ?? '');
  const [price, setPrice] = useState(contract?.buybackPricePerKg ? String(contract.buybackPricePerKg) : '');
  const [delivered, setDelivered] = useState(contract?.deliveredOn ?? '');
  const [notes, setNotes] = useState(contract?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const input = { contractNo: no.trim(), buybackPricePerKg: price.trim() ? Number(price.replace(/,/g, '')) : undefined, deliveredOn: delivered || undefined, notes: notes.trim() };
    const problem = contractProblem(input);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      const res = await saveBatchContractAction(row.batchId, input);
      if (!res.success) { setError(res.error); return; }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const id = (k: string) => `ct-${row.batchId}-${k}`;
  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4">
      <h4 className="text-base font-semibold text-ink">{tx('contractTitle', { batch: row.batchName })}</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><label htmlFor={id('no')} className="text-sm font-medium text-ink">{tx('contractNo')}</label><Input id={id('no')} className="min-h-11 text-base" value={no} maxLength={50} onChange={e => setNo(e.target.value)} /></div>
        <div className="space-y-1"><label htmlFor={id('price')} className="text-sm font-medium text-ink">{tx('contractPrice')}</label><Input id={id('price')} inputMode="numeric" className="min-h-11 text-base" value={price} onChange={e => setPrice(e.target.value)} /><p className="text-sm text-ink-muted">{tx('contractPriceHint')}</p></div>
        <div className="space-y-1"><label htmlFor={id('del')} className="text-sm font-medium text-ink">{tx('contractDelivered')}</label><Input id={id('del')} type="date" className="min-h-11 text-base" value={delivered} onChange={e => setDelivered(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><label htmlFor={id('notes')} className="text-sm font-medium text-ink">{tx('contractNotes')}</label><Input id={id('notes')} className="min-h-11 text-base" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} /></div>
      <p className="text-sm text-ink-muted">{tx('contractDueNote')}</p>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={save}>{busy ? tx('saving') : tx('saveContract')}</Button>
        <Button variant="ghost" onClick={onClose}>{tx('cancel')}</Button>
      </div>
    </div>
  );
}
