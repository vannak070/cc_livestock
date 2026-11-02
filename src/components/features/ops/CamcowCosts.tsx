'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addCamcowCostAction, deleteCamcowCostAction } from '@/app/actions';
import { COST_KINDS, costProblem, summarizeCosts, type CostKind, type StockCost } from '@/lib/camcow-costs';
import type { Holding } from '@/lib/camcow-stock';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { Tile } from '../reports/parts';

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const MAX_ROWS = 50;

interface Props {
  holdings: Holding[];
  costs: StockCost[];
  today: string;
  writer: boolean;
  onChanged: (text: string) => void;
}

/** What it costs to keep the cattle at the stock site. Each cost is shared between the animals in stock that day. */
export default function CamcowCosts({ holdings, costs, today, writer, onChanged }: Props) {
  const { tx, language } = useText('camcowStock');
  const month = today.slice(0, 7);
  const sum = useMemo(() => summarizeCosts(costs, holdings, month, month), [costs, holdings, month]);
  const all = useMemo(() => summarizeCosts(costs, holdings), [costs, holdings]);
  const [adding, setAdding] = useState(false);
  const [sure, setSure] = useState<string | null>(null);
  const [error, setError] = useState('');

  const remove = async (id: string) => {
    setError('');
    const res = await deleteCamcowCostAction(id);
    setSure(null);
    if (!res.success) { setError(res.error); return; }
    onChanged(tx('costRemoved'));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-xl font-semibold text-ink">{tx('costsTitle')}</h3>
          <p className="text-base text-ink-muted">{tx('costsHint')}</p>
        </div>
        {writer && <Button className="min-h-11" onClick={() => setAdding(true)}>{tx('addCost')}</Button>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={tx('costsTitle')}>
        <Tile label={tx('tCostMonth')} value={riel(sum.total)} />
        <Tile label={tx('tPerHeadDay')} value={sum.perHeadPerDay ? riel(sum.perHeadPerDay) : '—'} sub={tx('tPerHeadDaySub')} />
        <Tile label={tx('tCostAll')} value={riel(all.total)} />
        <Tile label={tx('tNotShared')} value={riel(all.notShared)} sub={tx('tNotSharedSub')} tone={all.notShared > 0 ? 'warn' : undefined} />
      </section>

      {sum.total > 0 && (
        <p className="text-base text-ink-muted">{tx('byKindLine')}: {COST_KINDS.filter(k => sum.byKind[k] > 0).map(k => `${tx(`ck_${k}`)} ${riel(sum.byKind[k])}`).join(' · ')}</p>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}

      <section className="rounded-xl bg-white ring-1 ring-slate-200" aria-label={tx('costsTitle')}>
        {costs.length === 0 ? <p className="px-4 py-5 text-base text-ink-muted">{tx('costsEmpty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-3 py-2 font-medium">{tx('colDate')}</th><th className="px-3 py-2 font-medium">{tx('colFor')}</th>
                <th className="px-3 py-2 text-right font-medium">{tx('colAmount')}</th><th className="px-3 py-2 font-medium">{tx('colNote')}</th>{writer && <th className="w-24" />}
              </tr></thead>
              <tbody>
                {costs.slice(0, MAX_ROWS).map(c => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{shownDay(c.date, language)}</td>
                    <td className="px-3 py-2">{tx(`ck_${c.kind}`)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{riel(c.amount)}</td>
                    <td className="px-3 py-2 text-ink-muted">{c.note}</td>
                    {writer && (
                      <td className="px-3 py-2 text-right">
                        {sure === c.id
                          ? <button type="button" className="text-sm font-medium text-rose-700 underline" onClick={() => remove(c.id)}>{tx('removeCostSure')}</button>
                          : <button type="button" className="text-sm text-ink-muted underline hover:text-rose-700" onClick={() => setSure(c.id)}>{tx('removeCost')}</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {costs.length > MAX_ROWS && <p className="px-3 py-2 text-sm text-ink-muted">{tx('more', { n: MAX_ROWS, total: costs.length })}</p>}
          </div>
        )}
      </section>

      {adding && <CostDialog today={today} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged(tx('costSaved')); }} />}
    </div>
  );
}

function CostDialog({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: () => void }) {
  const { tx } = useText('camcowStock');
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<CostKind>('feed');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const input = { date, kind, amount: Number(amount.replace(/[,\s]/g, '')), note };
    const problem = costProblem(input, today);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    const res = await addCamcowCostAction(input);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onSaved();
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tx('addCost')}</DialogTitle><DialogDescription>{tx('costDialogHint')}</DialogDescription></DialogHeader>
        <label className="text-sm text-ink-muted">{tx('lCostDay')}<Input type="date" max={today} className="mt-1 min-h-12 text-base" value={date} onChange={e => { setDate(e.target.value); setError(''); }} /></label>
        <label className="text-sm text-ink-muted">{tx('lCostFor')}
          <select className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-ink" value={kind} onChange={e => setKind(e.target.value as CostKind)}>
            {COST_KINDS.map(k => <option key={k} value={k}>{tx(`ck_${k}`)}</option>)}
          </select>
        </label>
        <label className="text-sm text-ink-muted">{tx('lCostAmount')}<Input inputMode="numeric" className="mt-1 min-h-12 text-base" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} autoFocus /></label>
        <label className="text-sm text-ink-muted">{tx('lCostNote')}<Input className="mt-1 min-h-12 text-base" value={note} maxLength={300} onChange={e => setNote(e.target.value)} /></label>
        {error && <p role="alert" className="text-base text-rose-700">{error}</p>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{tx('cancel')}</Button><Button disabled={busy} onClick={submit}>{tx('costSave')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
