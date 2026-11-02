'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { saveCamcowBuyerAction } from '@/app/actions';
import { BUYER_KINDS, buyerAccounts, buyerProblem, summarizeBuyers, type Buyer, type BuyerAccount, type BuyerKind } from '@/lib/camcow-buyers';
import type { Holding } from '@/lib/camcow-stock';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { Tile } from '../reports/parts';

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const mil = (n: number) => `${(n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M ៛`;

interface Props {
  holdings: Holding[];
  buyers: Buyer[];
  writer: boolean;
  onChanged: (text?: string) => void;
  /** Opens the cattle list with only these animals. */
  onSeeCattle: (cowIds: string[], label: string) => void;
}

/** The buyers of CamCow stock: what each bought, with the sales behind it. Paid or unpaid is not tracked. */
export default function CamcowBuyers({ holdings, buyers, writer, onChanged, onSeeCattle }: Props) {
  const { tx, language } = useText('camcowStock');
  const accounts = useMemo(() => buyerAccounts(holdings, buyers), [holdings, buyers]);
  const sum = useMemo(() => summarizeBuyers(accounts), [accounts]);
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { buyer?: Buyer }>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-xl font-semibold text-ink">{tx('buyersTitle')}</h3>
          <p className="text-base text-ink-muted">{tx('buyersHint')}</p>
        </div>
        {writer && <Button className="min-h-11" onClick={() => setDialog({})}>{tx('addBuyer')}</Button>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={tx('buyersTitle')}>
        <Tile label={tx('tBuyers')} value={String(sum.buyers)} sub={tx('tBuyersSub', { n: sum.active })} />
        <Tile label={tx('tHeadSold')} value={String(sum.head)} />
        <Tile label={tx('tSoldAll')} value={mil(sum.sold)} />
        <Tile label={tx('tMarginAll')} value={sum.head ? mil(sum.margin) : '—'} tone={sum.head ? (sum.margin >= 0 ? 'good' : 'bad') : undefined} />
      </section>

      <section className="rounded-xl bg-white ring-1 ring-slate-200" aria-label={tx('buyersTitle')}>
        {accounts.length === 0 ? <p className="px-4 py-5 text-base text-ink-muted">{tx('buyersEmpty')}</p> : (
          <ul className="divide-y divide-slate-100">
            {accounts.map(a => {
              const isOpen = open === a.buyer.id;
              return (
                <li key={a.buyer.id}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.buyer.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50">
                    {isOpen ? <ChevronDown className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden /> : <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />}
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block truncate text-base font-semibold text-ink">{a.buyer.name}{!a.buyer.active && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-muted">{tx('inactive')}</span>}</span>
                      <span className="block text-sm text-ink-muted">{tx(`kind_${a.buyer.kind}`)}{a.lastSaleOn ? ` · ${tx('colLastSale')} ${shownDay(a.lastSaleOn, language)}` : ''}</span>
                    </span>
                    <span className="text-sm tabular-nums text-ink-muted">{tx('headShort', { n: a.head })}{a.perKg ? ` · ${tx('perKgShort', { n: riel(a.perKg) })}` : ''}</span>
                    <span className="min-w-28 text-right text-base font-semibold tabular-nums text-ink">{riel(a.sold)}</span>
                  </button>
                  {isOpen && <BuyerDetail a={a} writer={writer} language={language} onEdit={() => setDialog({ buyer: a.buyer })} onSeeCattle={onSeeCattle} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog && <BuyerDialog buyer={dialog.buyer} others={buyers.filter(b => b.id !== dialog.buyer?.id).map(b => b.name)} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); onChanged(tx('buyerSaved')); }} />}
    </div>
  );
}

function BuyerDetail({ a, writer, language, onEdit, onSeeCattle }: { a: BuyerAccount; writer: boolean; language: 'en' | 'km'; onEdit: () => void; onSeeCattle: (cowIds: string[], label: string) => void }) {
  const { tx } = useText('camcowStock');
  return (
    <div className="space-y-3 bg-slate-50/60 px-4 pb-4 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{a.buyer.phone || a.buyer.location ? tx('contact', { phone: a.buyer.phone || '—', place: a.buyer.location || '—' }) : ''}{a.buyer.note ? ` · ${a.buyer.note}` : ''}</p>
        {writer && <Button variant="outline" size="sm" className="min-h-10" onClick={onEdit}>{tx('editBuyer')}</Button>}
      </div>
      <h5 className="text-base font-semibold text-ink">{tx('salesOf')}</h5>
      {a.sales.length === 0 ? <p className="text-sm text-ink-muted">{tx('noSales')}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-ink-muted"><tr><th className="py-1 font-medium">{tx('colSoldOn')}</th><th className="py-1 text-right font-medium">{tx('colHead')}</th><th className="py-1 text-right font-medium">{tx('colKg')}</th><th className="py-1 text-right font-medium">{tx('colSale')}</th><th className="py-1 text-right font-medium">{tx('colMargin')}</th><th /></tr></thead>
            <tbody>
              {a.sales.map(s => (
                <tr key={s.key} className="border-t border-slate-200">
                  <td className="py-1.5 whitespace-nowrap">{shownDay(s.soldOn, language)}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.head}</td>
                  <td className="py-1.5 text-right tabular-nums">{Math.round(s.kg).toLocaleString('en-US')} kg</td>
                  <td className="py-1.5 text-right tabular-nums">{riel(s.total)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${s.margin < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>{riel(s.margin)}</td>
                  <td className="py-1.5 pl-3 text-right"><button type="button" className="text-sm text-emerald-800 underline" onClick={() => onSeeCattle(s.cowIds, `${a.buyer.name} · ${shownDay(s.soldOn, language)}`)}>{tx('seeCattle')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Adds a buyer or changes one. Also used by the sell dialog ("+ New buyer"), which wants the new buyer's id back. */
export function BuyerDialog({ buyer, others, onClose, onSaved }: { buyer?: Buyer; others: string[]; onClose: () => void; onSaved: (saved: Buyer) => void }) {
  const { tx } = useText('camcowStock');
  const [name, setName] = useState(buyer?.name ?? '');
  const [kind, setKind] = useState<BuyerKind>(buyer?.kind ?? 'trader');
  const [phone, setPhone] = useState(buyer?.phone ?? '');
  const [location, setLocation] = useState(buyer?.location ?? '');
  const [note, setNote] = useState(buyer?.note ?? '');
  const [active, setActive] = useState(buyer?.active ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const input = { ...(buyer ? { id: buyer.id } : {}), name, kind, phone, location, note, active };
    const problem = buyerProblem(input, others);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    const res = await saveCamcowBuyerAction(input);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onSaved(res.data);
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>{buyer ? tx('buyerTitleEdit', { name: buyer.name }) : tx('buyerTitleNew')}</DialogTitle><DialogDescription className="sr-only">{tx('buyersHint')}</DialogDescription></DialogHeader>
        <label className="text-sm text-ink-muted">{tx('lName')}<Input className="mt-1 min-h-12 text-base" value={name} maxLength={100} onChange={e => { setName(e.target.value); setError(''); }} autoFocus /></label>
        <label className="text-sm text-ink-muted">{tx('lKind')}
          <select className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-ink" value={kind} onChange={e => setKind(e.target.value as BuyerKind)}>
            {BUYER_KINDS.map(k => <option key={k} value={k}>{tx(`kind_${k}`)}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-muted">{tx('lPhone')}<Input inputMode="tel" className="mt-1 min-h-12 text-base" value={phone} maxLength={50} onChange={e => setPhone(e.target.value)} /></label>
          <label className="text-sm text-ink-muted">{tx('lPlace')}<Input className="mt-1 min-h-12 text-base" value={location} maxLength={150} onChange={e => setLocation(e.target.value)} /></label>
        </div>
        <label className="text-sm text-ink-muted">{tx('lBuyerNote')}<Input className="mt-1 min-h-12 text-base" value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
        {buyer && <label className="flex items-center gap-3 text-base text-ink"><input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={active} onChange={e => setActive(e.target.checked)} />{tx('lActive')}</label>}
        {error && <p role="alert" className="text-base text-rose-700">{error}</p>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>{tx('cancel')}</Button><Button disabled={busy} onClick={submit}>{tx('buyerSave')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
