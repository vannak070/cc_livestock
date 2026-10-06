'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmLoanAssumptions } from '@/lib/types';
import { DEFAULT_REPAYMENTS } from '@/lib/farm-loan';
import { Choice, NUM, Question } from '../flow/FlowShell';

/**
 * Pieces for the fattening plan dialog's bank loan and herd steps: one
 * number with its unit, how the cattle are bought, and the repayment months.
 */

export type BuyPlan = NonNullable<FarmLoanAssumptions['buyPlan']>;

export const BUY_PLANS: { key: BuyPlan; title: string; hint: string }[] = [
  { key: 'monthly', title: 'Trade every month (keeps the herd full)', hint: 'Stock up a share a month from CC Livestock. Then every month the cattle that are ready are sold to CC Livestock, and CC Livestock sells the farm new cattle the same day for fattening. The herd carries on into the next loan year.' },
  { key: 'rounds', title: 'Swap the whole herd when fattening ends', hint: 'Buy the herd from CC Livestock in month 1. Each time fattening ends, sell it all to CC Livestock and take a new herd the same day. The last herd is sold in month 12.' },
  { key: 'once', title: 'All at once, in month 1', hint: 'Buy the whole herd from CC Livestock in month 1 and keep it until month 12, when CC Livestock buys it.' },
  { key: 'split', title: 'Two purchases', hint: 'Part of the herd from CC Livestock in month 1, the rest in a later month. All sold to CC Livestock in month 12.' },
];

export const BUY_PLAN_LABEL: Record<BuyPlan, string> = Object.fromEntries(BUY_PLANS.map(p => [p.key, p.title])) as Record<BuyPlan, string>;

/** One sentence on how the farm trades its cattle with CC Livestock in a loan year. */
export function buyingSentence(a: Pick<FarmLoanAssumptions, 'buyPlan' | 'herdTarget' | 'firstBuyPct' | 'secondBuyMonth'>, boughtY1: number, who = 'The farm'): string {
  const n = boughtY1.toLocaleString();
  switch (a.buyPlan ?? 'monthly') {
    case 'once': return `${who} buys all ${n} cattle from CC Livestock in month 1 and sells them to CC Livestock in month 12.`;
    case 'rounds': return `${who} keeps ${a.herdTarget.toLocaleString()} cattle all year: each time fattening ends it sells them to CC Livestock and takes a new herd from CC Livestock the same day (${n} bought in the year).`;
    case 'split': return `${who} buys ${a.firstBuyPct}% of the herd from CC Livestock in month 1 and the rest in month ${a.secondBuyMonth}, and sells them all to CC Livestock in month 12 (${n} in the year).`;
    default: return `${who} keeps ${a.herdTarget.toLocaleString()} cattle: every month the cattle that are ready are sold to CC Livestock and CC Livestock sells it new cattle the same day (${n} bought in the year).`;
  }
}

/** The hint under "Days fattening" for a buying plan. */
export function fatteningHint(plan: BuyPlan): string | undefined {
  if (plan === 'once' || plan === 'split') return 'Not used here: the cattle stay until month 12 and keep gaining.';
  if (plan === 'rounds') return 'Each herd is swapped with CC Livestock after this many days; the last one stays until month 12.';
  return 'Cattle are sold to CC Livestock once they have fattened this long, and replaced the same day.';
}

/** One number with its unit beside it, and an optional hint below. */
export function NumberField({ label, unit, value, onChange, hint, from, step = 'any' }: { label: string; unit: string; value: string; onChange: (v: string) => void; hint?: string; from?: string; step?: string }) {
  return (
    <Question label={label} hint={from ? `From ${from}` : hint}>
      <div className="flex items-center gap-2">
        <Input aria-label={label} type="number" step={step} inputMode="decimal" min="0" value={value} onChange={e => onChange(e.target.value)} className={`h-14 text-xl font-semibold ${NUM}`} />
        <span className="w-20 shrink-0 text-lg text-ink-muted">{unit}</span>
      </div>
    </Question>
  );
}

/** The buying plan as typed: the choice, and for two purchases the share and month. */
export interface BuyDraft { plan: BuyPlan; firstPct: string; secondMonth: string; lastBuyMonth: string }

export const toBuyDraft = (a: Partial<Pick<FarmLoanAssumptions, 'buyPlan' | 'firstBuyPct' | 'secondBuyMonth' | 'lastBuyMonth'>>, fallback: BuyPlan = 'monthly'): BuyDraft => ({
  plan: a.buyPlan ?? fallback,
  firstPct: String(a.firstBuyPct ?? 50),
  secondMonth: String(a.secondBuyMonth ?? 4),
  lastBuyMonth: String(a.lastBuyMonth ?? 9), // kept for older plans; the monthly trade buys all year
});

const numOrNaN = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** The buying plan as numbers; blank boxes become NaN so the checks catch them. */
export const fromBuyDraft = (d: BuyDraft) => ({
  buyPlan: d.plan,
  lastBuyMonth: numOrNaN(d.lastBuyMonth),
  ...(d.plan === 'split' ? { firstBuyPct: numOrNaN(d.firstPct), secondBuyMonth: numOrNaN(d.secondMonth) } : {}),
});

/** "How are the cattle bought?": the four ways, and the extra boxes the chosen one needs. */
export function BuyPlanPicker({ value, onChange }: { value: BuyDraft; onChange: (d: BuyDraft) => void }) {
  const set = (patch: Partial<BuyDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <Question label="How are the cattle bought?" hint="The farm buys its cattle from CC Livestock and sells them back to CC Livestock.">
        <div className="grid grid-cols-1 gap-2">
          {BUY_PLANS.map(p => (
            <button key={p.key} type="button" aria-pressed={value.plan === p.key} onClick={() => set({ plan: p.key })}
              className={`rounded-xl border-2 px-4 py-3 text-left ${value.plan === p.key ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-600'}`}>
              <span className="block text-lg font-semibold text-ink">{p.title}</span>
              <span className="block text-base text-ink-muted">{p.hint}</span>
            </button>
          ))}
        </div>
      </Question>
      {value.plan === 'split' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Bought in month 1" unit="% of herd" value={value.firstPct} onChange={v => set({ firstPct: v })} />
          <NumberField label="Month of the second purchase" unit="month" step="1" value={value.secondMonth} onChange={v => set({ secondMonth: v })} hint="From 2 to 12." />
        </div>
      )}
    </>
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
  const total = value.rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const setRow = (i: number, patch: Partial<{ month: string; pct: string }>) => onChange({ ...value, rows: value.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        <Choice selected={!value.custom} onClick={() => onChange({ ...value, custom: false })}>The usual: 20% in month 8, 30% in month 11, 50% in month 12</Choice>
        <Choice selected={value.custom} onClick={() => onChange({ ...value, custom: true })}>Different months or shares</Choice>
      </div>
      <p className="text-base text-ink-muted">The farm pays the interest every month and the loan back in these months. Only the farm pays the bank; CC Livestock does not.</p>
      {value.custom && (
        <div className="space-y-2">
          <p className="text-base text-ink-muted">Share of everything borrowed that year, paid in that month of the loan year.</p>
          <ul className="space-y-2">
            {value.rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="shrink-0 text-lg text-ink">Month</span>
                <Input aria-label={`Repayment ${i + 1}: month`} type="number" min="1" max="12" value={r.month} onChange={e => setRow(i, { month: e.target.value })} className={`h-14 w-20 text-xl ${NUM}`} />
                <Input aria-label={`Repayment ${i + 1}: share`} type="number" step="any" min="0" max="100" value={r.pct} onChange={e => setRow(i, { pct: e.target.value })} className={`h-14 w-24 text-xl ${NUM}`} />
                <span className="text-lg text-ink-muted">%</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove repayment ${i + 1}`} onClick={() => onChange({ ...value, rows: value.rows.filter((_, j) => j !== i) })}><Trash2 className="text-rose-700" /></Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => onChange({ ...value, rows: [...value.rows, { month: '', pct: '' }] })} disabled={value.rows.length >= 12}><Plus /> Add a month</Button>
            <span className={`text-lg font-medium ${total === 100 ? 'text-emerald-800' : 'text-amber-800'}`}>Total {total}%</span>
          </div>
          {total !== 100 && <p className="text-base text-amber-900">Below 100% leaves money owed at the end of the year.</p>}
        </div>
      )}
    </>
  );
}

/** What the bank lends: a worked-out fund (the cattle only, or cattle with a year of feed and interest), or an agreed amount. */
export type LendKind = 'cattle' | 'all' | 'fixed';

export function LoanAmountPicker({ kind, onKind, amount, onAmount, financed, onFinanced, payout }: {
  kind: LendKind; onKind: (k: LendKind) => void;
  amount: string; onAmount: (v: string) => void;
  financed: string; onFinanced: (v: string) => void;
  /** The payout with the numbers now, to show beside a worked-out fund. */
  payout?: number;
}) {
  return (
    <>
      <Question label="How much does the bank lend?" hint="One fund, paid out once in month 1 of each loan year. The farm buys its cattle from CC Livestock with it.">
        <div className="grid grid-cols-1 gap-3">
          <Choice selected={kind === 'all'} onClick={() => onKind('all')}>Cattle, feed and interest for the year</Choice>
          <Choice selected={kind === 'cattle'} onClick={() => onKind('cattle')}>Enough to buy the herd (cattle only)</Choice>
          <Choice selected={kind === 'fixed'} onClick={() => onKind('fixed')}>An agreed amount</Choice>
        </div>
      </Question>
      {kind === 'fixed'
        ? <NumberField label="Loan amount" unit="៛" value={amount} onChange={onAmount} hint="Paid out once, in month 1 of each loan year." />
        : (
          <>
            <NumberField label="Share it covers" unit="%" value={financed} onChange={onFinanced}
              hint={kind === 'all'
                ? 'Of the cattle bought until the first sale to CC Livestock, a year of feed, and a year of interest on the loan. After the first sale, new cattle are paid from the sales.'
                : 'Of the cattle bought until the first sale to CC Livestock. After that, new cattle are paid from the sales; feed and interest from the farm’s money.'} />
            {payout !== undefined && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">With the numbers now, the bank pays out <span className="font-semibold">{Math.round(payout).toLocaleString()} ៛</span> in month 1. It changes if you change the cattle or feed.</p>}
          </>
        )}
    </>
  );
}
