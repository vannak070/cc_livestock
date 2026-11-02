'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmLoanAssumptions } from '@/lib/types';
import { DEFAULT_REPAYMENTS } from '@/lib/farm-loan';
import { Choice, NUM, Question } from '../flow/FlowShell';
import { useText, type Tx } from '@/hooks/useText';

/**
 * Pieces for the fattening plan dialog's bank loan and herd steps: one
 * number with its unit, how the cattle are bought, and the repayment months.
 */

/** One sentence on how the farm trades its cattle with CC Livestock in a loan year (the monthly trade, the only way cattle are bought). */
export function buyingSentence(a: Pick<FarmLoanAssumptions, 'herdTarget'>, boughtY1: number, tx: Tx): string {
  return tx('s_monthly', { herd: a.herdTarget.toLocaleString(), n: boughtY1.toLocaleString() });
}

/** One number with its unit beside it, and an optional hint below. */
export function NumberField({ label, unit, value, onChange, hint, from, step = 'any' }: { label: string; unit: string; value: string; onChange: (v: string) => void; hint?: string; from?: string; step?: string }) {
  const { tx } = useText('planning');
  return (
    <Question label={label} hint={from ? tx('fromX', { x: from }) : hint}>
      <div className="flex items-center gap-2">
        <Input aria-label={label} type="number" step={step} inputMode="decimal" min="0" value={value} onChange={e => onChange(e.target.value)} className={`h-14 text-xl font-semibold ${NUM}`} />
        <span className="w-20 shrink-0 text-lg text-ink-muted">{unit}</span>
      </div>
    </Question>
  );
}

/** The only way cattle are bought: the monthly trade. Shown as a fixed explanation, not a choice. */
export function MonthlyTradeNote() {
  const { tx } = useText('planning');
  return (
    <Question label={tx('howBought')}>
      <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3">
        <span className="block text-lg font-semibold text-ink">{tx('b_monthly')}</span>
        <span className="block text-base text-ink-muted">{tx('bh_monthly')}</span>
      </div>
    </Question>
  );
}

/** The repayment months as typed. */
export interface RepayDraft { custom: boolean; rows: { month: string; pct: string }[] }

const isStandard = (rs: { month: string; pct: string }[]) =>
  rs.length === DEFAULT_REPAYMENTS.length && DEFAULT_REPAYMENTS.every((d, i) => Number(rs[i]?.month) === d.month && Number(rs[i]?.pct) === d.pct);

export const toRepayDraft = (rs: { month: number; pct: number }[]): RepayDraft => {
  const rows = rs.map(r => ({ month: String(r.month), pct: String(r.pct) }));
  return { custom: !isStandard(rows), rows };
};

export const fromRepayDraft = (d: RepayDraft) =>
  (d.custom ? d.rows : DEFAULT_REPAYMENTS.map(r => ({ month: String(r.month), pct: String(r.pct) }))).map(r => ({ month: Number(r.month), pct: Number(r.pct) }));

/** When the loan is paid back each year: the usual 20/30/50%, or months and shares typed in. */
export function RepaymentPicker({ value, onChange }: { value: RepayDraft; onChange: (d: RepayDraft) => void }) {
  const { tx } = useText('planning');
  const total = value.rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const setRow = (i: number, patch: Partial<{ month: string; pct: string }>) => onChange({ ...value, rows: value.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        <Choice selected={!value.custom} onClick={() => onChange({ ...value, custom: false })}>{tx('usualRepay')}</Choice>
        <Choice selected={value.custom} onClick={() => onChange({ ...value, custom: true })}>{tx('otherRepay')}</Choice>
      </div>
      <p className="text-base text-ink-muted">{tx('repayNote')}</p>
      {value.custom && (
        <div className="space-y-2">
          <p className="text-base text-ink-muted">{tx('repayShare')}</p>
          <ul className="space-y-2">
            {value.rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="shrink-0 text-lg text-ink">{tx('monthWord')}</span>
                <Input aria-label={tx('repayMonthAria', { n: i + 1 })} type="number" min="1" max="12" value={r.month} onChange={e => setRow(i, { month: e.target.value })} className={`h-14 w-20 text-xl ${NUM}`} />
                <Input aria-label={tx('repayShareAria', { n: i + 1 })} type="number" step="any" min="0" max="100" value={r.pct} onChange={e => setRow(i, { pct: e.target.value })} className={`h-14 w-24 text-xl ${NUM}`} />
                <span className="text-lg text-ink-muted">%</span>
                <Button type="button" variant="ghost" size="icon" aria-label={tx('removeRepayAria', { n: i + 1 })} onClick={() => onChange({ ...value, rows: value.rows.filter((_, j) => j !== i) })}><Trash2 className="text-rose-700" /></Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => onChange({ ...value, rows: [...value.rows, { month: '', pct: '' }] })} disabled={value.rows.length >= 12}><Plus /> {tx('addMonth')}</Button>
            <span className={`text-lg font-medium ${total === 100 ? 'text-emerald-800' : 'text-amber-800'}`}>{tx('totalPct', { n: total })}</span>
          </div>
          {total !== 100 && <p className="text-base text-amber-900">{tx('below100')}</p>}
        </div>
      )}
    </>
  );
}

/** What the bank lends: a worked-out fund (the cattle only; cattle plus the feed and interest of the months before the first sale; or cattle with a year of feed and interest), or an agreed amount. */
export type LendKind = 'cattle' | 'start' | 'all' | 'fixed';

export function LoanAmountPicker({ kind, onKind, amount, onAmount, financed, onFinanced, payout }: {
  kind: LendKind; onKind: (k: LendKind) => void;
  amount: string; onAmount: (v: string) => void;
  financed: string; onFinanced: (v: string) => void;
  /** The payout with the numbers now, to show beside a worked-out fund. */
  payout?: number;
}) {
  const { tx } = useText('planning');
  return (
    <>
      <Question label={tx('howMuch')} hint={tx('howMuchHint')}>
        <div className="grid grid-cols-1 gap-3">
          <Choice selected={kind === 'start'} onClick={() => onKind('start')}>{tx('lendStart')}</Choice>
          <Choice selected={kind === 'all'} onClick={() => onKind('all')}>{tx('lendAll')}</Choice>
          <Choice selected={kind === 'cattle'} onClick={() => onKind('cattle')}>{tx('lendCattle')}</Choice>
          <Choice selected={kind === 'fixed'} onClick={() => onKind('fixed')}>{tx('lendFixed')}</Choice>
        </div>
      </Question>
      {kind === 'fixed'
        ? <NumberField label={tx('loanAmount')} unit="៛" value={amount} onChange={onAmount} hint={tx('loanAmountHint')} />
        : (
          <>
            <NumberField label={tx('shareCovers')} unit="%" value={financed} onChange={onFinanced}
              hint={kind === 'all' ? tx('shareAllHint') : kind === 'start' ? tx('shareStartHint') : tx('shareCattleHint')} />
            {payout !== undefined && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{tx('payoutNow', { amount: `${Math.round(payout).toLocaleString()} ៛` })}</p>}
          </>
        )}
    </>
  );
}
