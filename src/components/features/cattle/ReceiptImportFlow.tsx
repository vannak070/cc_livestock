'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, FileUp, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MasterSetup, StockItem } from '@/lib/types';
import { limitBlock, limitUsed } from '@/lib/farm-limit';
import { loadXlsx } from '@/lib/load-xlsx';
import { checkReceipt, draftFromSheet, tagFor, type DuplicateCheck, type ReceiptDraft, type ReceiptFile, type ReceiptRow, type RegisterInput, type RowProblem, type TotalCheck } from '@/lib/receipt-import';
import { useText, useValueText } from '@/hooks/useText';
import { shrinkImage } from '@/lib/image-resize';
import { farmToday } from '@/lib/daily-feed';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  common: MasterSetup;
  /** Every animal on the system (any status): a tag already used cannot be used again. */
  existingCattle: Pick<StockItem, 'id'>[];
  /** Every registered animal, for the farm's cattle limit. */
  registeredCattle: Pick<StockItem, 'location'>[];
  defaultFarm?: string;
  /** Sends the file to be read (server). Throws the reason when it cannot be read. */
  onRead: (file: { mediaType: string; base64: string }) => Promise<ReceiptDraft>;
  /** Was this receipt registered before? (server; the register call checks again) */
  onCheckDuplicate: (input: Pick<RegisterInput, 'invoiceNo' | 'seller' | 'date' | 'rows'>) => Promise<DuplicateCheck>;
  /** Registers the checked list and keeps the original file (server). Throws the reason when it cannot be saved. */
  onRegister: (input: RegisterInput, options: { file: ReceiptFile | null; confirmedDifferent: boolean }) => Promise<void>;
}

type Step = 'pick' | 'reading' | 'check' | 'done';

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_SIDE = 2000;
// The farm's calendar day (Cambodia time), not UTC: before 7 am UTC would still be yesterday.
const today = () => farmToday();
const SELECT = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';
const CELL = 'h-11 w-full min-w-0 rounded-lg border-2 border-slate-200 bg-white px-2 text-base text-ink focus:border-emerald-600 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none';
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

/** The browser often gives Excel/CSV files no type; name it from the extension so the server accepts the file. */
const sheetType = (file: File): string => file.type
  || (/\.csv$/i.test(file.name) ? 'text/csv' : /\.xls$/i.test(file.name) ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

const base64Of = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(new Error('read'));
  r.readAsDataURL(blob);
});

/** A phone photo is often 5–10 MB; the receipt stays readable at 2000 px, so shrink it before sending. */
async function photoBase64(file: File): Promise<{ mediaType: string; base64: string }> {
  return { mediaType: 'image/jpeg', base64: await base64Of(await shrinkImage(file, MAX_SIDE, 0.88)) };
}

export default function ReceiptImportFlow(props: Props) {
  // Remount on every open so each receipt starts clean.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <Body {...props} />}
    </Dialog>
  );
}

function Body({ onClose, common, existingCattle, registeredCattle, defaultFarm, onRead, onCheckDuplicate, onRegister }: Props) {
  const { tx } = useText('receiptImport');
  const val = useValueText();
  const farmNames = useMemo(() => (common.farms || []).map(f => f.name), [common.farms]);
  const breeds = common.breeds ?? [];
  const health = common.healthStatuses?.[0] ?? 'Good';

  const [step, setStep] = useState<Step>('pick');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [seller, setSeller] = useState('');
  const [date, setDate] = useState(today());
  const [farm, setFarm] = useState(defaultFarm && farmNames.includes(defaultFarm) ? defaultFarm : farmNames.length === 1 ? farmNames[0] : '');
  const [prefix, setPrefix] = useState('CC-');
  const [breed, setBreed] = useState('');
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [printed, setPrinted] = useState({ head: 0, kg: 0, total: 0 });
  const [doneCount, setDoneCount] = useState(0);
  // The original file, kept with the receipt record; and whether this receipt was registered before.
  const [receiptFile, setReceiptFile] = useState<ReceiptFile | null>(null);
  const [dup, setDup] = useState<DuplicateCheck | null>(null);
  const [confirmDifferent, setConfirmDifferent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const check = useMemo(() => checkReceipt({
    rows, prefix, existingTags: existingCattle.map(c => c.id),
    printedHead: printed.head, printedKg: printed.kg, printedTotal: printed.total, today: today(),
  }), [rows, prefix, existingCattle, printed]);

  // The farm's cattle limit for the whole list; the server checks it again when saving.
  const limitText = (() => {
    const item = (common.farms || []).find(f => f.name === farm);
    const b = limitBlock(item, limitUsed(farm, registeredCattle), rows.length);
    if (!b) return '';
    return b.reason === 'not-set' ? tx('limitNone', { farm: b.farm }) : tx('limitFull', { farm: b.farm, room: Math.max(0, b.limit - b.used), n: rows.length });
  })();
  // Asks the server a moment after the number, seller, date or list changes (the register call checks again).
  useEffect(() => {
    if (step !== 'check') return;
    let gone = false;
    const timer = setTimeout(() => {
      onCheckDuplicate({ invoiceNo, seller, date, rows })
        .then(found => { if (!gone) { setDup(found); if (!found.similar) setConfirmDifferent(false); } })
        .catch(() => { if (!gone) setDup(null); });
    }, 400);
    return () => { gone = true; clearTimeout(timer); };
  }, [step, invoiceNo, seller, date, rows, onCheckDuplicate]);

  const dupBlocked = !!dup?.same || (!!dup?.similar && !confirmDifferent);
  const canRegister = !check.blocked && !!farm && !!date && !limitText && !dupBlocked && !busy;

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    const isPdf = file.type === 'application/pdf';
    const isSheet = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!isPdf && !isSheet && !file.type.startsWith('image/')) { setError(tx('wrongType')); return; }
    setStep('reading');
    try {
      // An Excel or CSV sheet is read here in the browser (no AI, nothing is sent anywhere).
      if (isSheet) {
        if (file.size > MAX_BYTES) { setError(tx('tooBig')); setStep('pick'); return; }
        setReceiptFile({ name: file.name, type: sheetType(file), base64: await base64Of(file) });
        const X = await loadXlsx();
        const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const draft = draftFromSheet(X.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false }));
        setInvoiceNo(draft.invoiceNo); setSeller(draft.seller); setDate(today());
        setRows(draft.rows.map(r => { const hit = breeds.find(b => b.toLowerCase() === (r.breed ?? '').trim().toLowerCase()); return { ...r, breed: hit }; }));
        setPrinted({ head: 0, kg: draft.printedKg, total: draft.printedTotal });
        setStep('check');
        return;
      }
      let payload: { mediaType: string; base64: string };
      if (isPdf) {
        if (file.size > MAX_BYTES) { setError(tx('tooBig')); setStep('pick'); return; }
        payload = { mediaType: 'application/pdf', base64: await base64Of(file) };
      } else {
        try { payload = await photoBase64(file); } catch { setError(tx('wrongType')); setStep('pick'); return; }
      }
      // Kept as sent: the PDF itself, or the photo shrunk to 2000 px (still readable).
      setReceiptFile({ name: isPdf ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg', type: payload.mediaType, base64: payload.base64 });
      const draft = await onRead(payload);
      setInvoiceNo(draft.invoiceNo);
      setSeller(draft.seller);
      setDate(draft.date || today());
      setRows(draft.rows);
      setPrinted({ head: draft.printedHead, kg: draft.printedKg, total: draft.printedTotal });
      setStep('check');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : tx('readFailed'));
      setStep('pick');
    }
  };

  const change = (i: number, patch: Partial<ReceiptRow>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const register = async () => {
    setBusy(true);
    setError('');
    try {
      await onRegister({ farm, date, seller, invoiceNo, prefix, breed, health, rows }, { file: receiptFile, confirmedDifferent: confirmDifferent });
      setDoneCount(rows.length);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : tx('readFailed'));
    } finally {
      setBusy(false);
    }
  };

  const problemText = (p: RowProblem, r: ReceiptRow) => (p === 'lineTotal'
    ? tx('p_lineTotal', { printed: Math.round(r.lineTotal).toLocaleString(), worked: Math.round(r.weightKg * r.pricePerKg).toLocaleString() })
    : tx(`p_${p}`));

  // counted is shown even when nothing was printed to compare it with (t is null: "Not on the receipt").
  const totalLine = (label: string, t: TotalCheck | null, counted: number, show: (n: number) => string) => (
    <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-ink">{show(counted)}</dd>
      <p className={`mt-1 flex items-start gap-1 text-sm ${!t ? 'text-ink-muted' : t.ok ? 'text-emerald-800' : 'font-medium text-amber-800'}`}>
        {t && (t.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />)}
        <span>{!t ? tx('tNotPrinted') : t.ok ? tx('tMatch') : tx('tDiffer', { printed: show(t.printed), counted: show(t.counted) })}</span>
      </p>
    </div>
  );

  return (
    <DialogContent className="flex max-w-4xl flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[90vh]">
      <DialogHeader className="shrink-0 space-y-1 px-6 pb-3 pt-6 text-left sm:text-left">
        <DialogTitle className="text-2xl font-semibold text-ink">{step === 'check' ? tx('checkTitle') : step === 'done' ? tx('doneTitle') : tx('title')}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">{step === 'pick' ? tx('pickSub') : step === 'check' ? tx('checkSub') : step === 'reading' ? tx('readingHint') : ''}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-2">
        {step === 'pick' && (
          <div className="space-y-4">
            <input ref={fileInput} type="file" accept="application/pdf,image/*,.xlsx,.xls,.csv" className="sr-only" aria-label={tx('choosePdfOrPhoto')} onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={tx('takePhoto')} onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" size="lg" className="h-20 text-lg" onClick={() => fileInput.current?.click()}><FileUp /> {tx('choosePdfOrPhoto')}</Button>
              <Button type="button" size="lg" variant="outline" className="h-20 text-lg" onClick={() => cameraInput.current?.click()}><Camera /> {tx('takePhoto')}</Button>
            </div>
            <p className="text-base text-ink-muted">{tx('fileTypes')}</p>
            <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{tx('privacy')}</p>
          </div>
        )}

        {step === 'reading' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center" role="status">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-700" aria-hidden />
            <p className="text-xl text-ink">{tx('reading')}</p>
          </div>
        )}

        {step === 'check' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('receiptNo')}</span><Input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="h-12 text-lg" /></label>
              <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('seller')}</span><Input value={seller} onChange={e => setSeller(e.target.value)} className="h-12 text-lg" /></label>
              <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('dateArrived')}</span><Input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-12 text-lg" /><span className="mt-1 block text-sm text-ink-muted">{tx('dateAllHint')}</span></label>
              <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('farm')}</span>
                <select value={farm} onChange={e => setFarm(e.target.value)} className={SELECT}>
                  <option value="">{tx('chooseFarm')}</option>
                  {farmNames.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('tagPrefix')}</span><Input value={prefix} onChange={e => setPrefix(e.target.value)} className="h-12 text-lg" /><span className="mt-1 block text-sm text-ink-muted">{tx('tagPrefixHint')}</span></label>
              {breeds.length > 0 && (
                <label className="block"><span className="mb-1 block text-base font-medium text-ink">{tx('breed')}</span>
                  <select value={breed} onChange={e => setBreed(e.target.value)} className={SELECT}>
                    <option value="">{tx('noBreed')}</option>
                    {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              )}
            </div>

            <section aria-label={tx('totalsTitle')}>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {totalLine(tx('tHead'), check.head, rows.length, n => String(n))}
                {totalLine(tx('tKg'), check.kg, rows.reduce((s, r) => s + r.weightKg, 0), n => `${Math.round(n * 10) / 10} kg`)}
                {totalLine(tx('tAmount'), check.amount, rows.reduce((s, r) => s + r.lineTotal, 0), riel)}
              </dl>
            </section>
            {!check.head && !check.kg && !check.amount ? null : check.needsLook
              ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-base font-medium text-amber-900">{tx('looksOff')}</p>
              : <p role="status" className="rounded-xl bg-emerald-50 p-3 text-base font-medium text-emerald-900">{tx('allGood')}</p>}

            {dup?.same && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-base font-medium text-rose-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <span>{tx('dupSame', { no: dup.same.invoiceNo, seller: dup.same.seller || tx('dupThisSeller'), date: dup.same.receiptDate, n: dup.same.head, farm: dup.same.farm })}</span>
              </p>
            )}
            {!dup?.same && dup?.similar && (
              <div role="alert" className="space-y-2 rounded-xl bg-amber-50 p-3 text-base text-amber-900">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <span>{tx('dupSimilar', { seller: dup.similar.seller || tx('dupThisSeller'), date: dup.similar.receiptDate, n: dup.similar.head, farm: dup.similar.farm })}</span>
                </p>
                <label className="flex min-h-11 items-center gap-3 pl-7 font-medium">
                  <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={confirmDifferent} onChange={e => setConfirmDifferent(e.target.checked)} />
                  {tx('dupConfirm')}
                </label>
              </div>
            )}

            {rows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{tx('noRows')}</p> : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[60rem] text-left">
                  <thead className="bg-slate-50 text-sm text-ink-muted">
                    <tr>
                      <th className="px-2 py-2 font-medium">{tx('colNo')}</th>
                      <th className="px-2 py-2 font-medium">{tx('colTag')}</th>
                      {breeds.length > 0 && <th className="px-2 py-2 font-medium">{tx('colBreed')}</th>}
                      <th className="px-2 py-2 font-medium">{tx('colDate')}</th>
                      <th className="px-2 py-2 font-medium">{tx('colSex')}</th>
                      <th className="px-2 py-2 font-medium">{tx('colKg')}</th>
                      <th className="px-2 py-2 font-medium">{tx('colPrice')}</th>
                      <th className="px-2 py-2 text-right font-medium">{tx('colAmount')}</th>
                      <th className="w-10 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const problems = check.rows[i] ?? [];
                      const bad = problems.some(p => p !== 'lineTotal');
                      return (
                        <React.Fragment key={i}>
                          <tr className={`border-t border-slate-100 align-top ${bad ? 'bg-rose-50' : problems.length ? 'bg-amber-50' : ''}`}>
                            <td className="px-2 py-2 text-base tabular-nums text-ink-muted">{i + 1}</td>
                            <td className="px-2 py-2">
                              <Input aria-label={`${tx('colTag')} ${i + 1}`} value={r.printed} onChange={e => change(i, { printed: e.target.value })} className="h-11 min-w-[6rem] text-base" />
                              <span className="mt-0.5 block text-xs text-ink-muted">{tagFor(prefix, r.printed)}</span>
                            </td>
                            {breeds.length > 0 && (
                              <td className="px-2 py-2">
                                <select aria-label={`${tx('colBreed')} ${i + 1}`} value={r.breed ?? breed} onChange={e => change(i, { breed: e.target.value })} className={`${CELL} min-w-[8rem]`}>
                                  <option value="">{tx('chooseBreed')}</option>
                                  {breeds.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                              </td>
                            )}
                            <td className="px-2 py-2">
                              {/* Each animal starts on the receipt date; change it when one arrived on another day. */}
                              <input aria-label={`${tx('colDate')} ${i + 1}`} type="date" value={r.date ?? date} max={today()} onChange={e => change(i, { date: e.target.value === date ? undefined : e.target.value })} className={`${CELL} min-w-[9.5rem]`} />
                            </td>
                            <td className="px-2 py-2">
                              <select aria-label={`${tx('colSex')} ${i + 1}`} value={r.sex} onChange={e => change(i, { sex: e.target.value as ReceiptRow['sex'] })} className={`${CELL} min-w-[6.5rem]`}>
                                <option value="">{tx('chooseSex')}</option>
                                <option value="Male">{val('Male')}</option>
                                <option value="Female">{val('Female')}</option>
                              </select>
                            </td>
                            <td className="px-2 py-2"><input aria-label={`${tx('colKg')} ${i + 1}`} type="number" step="any" inputMode="decimal" value={r.weightKg || ''} onChange={e => change(i, { weightKg: Number(e.target.value) })} className={CELL} /></td>
                            <td className="px-2 py-2"><input aria-label={`${tx('colPrice')} ${i + 1}`} type="number" step="any" inputMode="numeric" value={r.pricePerKg || ''} onChange={e => change(i, { pricePerKg: Number(e.target.value) })} className={CELL} /></td>
                            <td className="px-2 py-3 text-right text-base font-medium tabular-nums text-ink">{riel(r.weightKg * r.pricePerKg)}</td>
                            <td className="px-1 py-1.5"><Button type="button" variant="ghost" aria-label={tx('removeRow', { n: i + 1 })} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Trash2 className="text-rose-700" /></Button></td>
                          </tr>
                          {problems.length > 0 && (
                            <tr className={bad ? 'bg-rose-50' : 'bg-amber-50'}>
                              <td />
                              <td colSpan={breeds.length > 0 ? 8 : 7} className={`px-2 pb-2 text-sm font-medium ${bad ? 'text-rose-800' : 'text-amber-900'}`}>{problems.map(p => problemText(p, r)).join(' · ')}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-base text-ink-muted">{tx('billNote')}</p>
          </>
        )}

        {step === 'done' && (
          <div className="space-y-5 py-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-11 w-11" aria-hidden /></div>
            <p className="text-2xl text-ink">{tx('doneMsg', { n: doneCount, farm })}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-slate-100 px-6 pb-6 pt-4">
        {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
        {step === 'check' && limitText && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-base font-medium text-amber-900">{limitText}</p>}
        {step === 'check' && (
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={() => { setError(''); setStep('pick'); }}>{tx('otherFile')}</Button>
            <Button type="button" size="lg" className="flex-1" disabled={!canRegister} onClick={() => void register()}>{busy ? tx('registering') : tx('register', { n: rows.length })}</Button>
          </div>
        )}
        {step === 'pick' && <Button type="button" variant="secondary" size="lg" onClick={onClose}>{tx('cancel')}</Button>}
        {step === 'done' && <Button type="button" size="lg" className="w-full" onClick={onClose}>{tx('done')}</Button>}
      </div>
    </DialogContent>
  );
}
