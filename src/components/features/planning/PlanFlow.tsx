'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FeedProductItem, ProposalPlanParams } from '@/types';
import { DEFAULT_PLAN, calculatePlan, parsePlanParams } from '@/lib/proposal-plan';
import { planFeedLines } from '@/lib/feed-lines';
import { DEFAULT_ASSUMPTIONS, parseLoanAssumptions, simulateLoan } from '@/lib/farm-loan';
import { defaultPlanLoan, parsePlanLoan, planLoanInputs } from '@/lib/plan-loan';
import { BuyPlanPicker, NumberField, RepaymentPicker, fatteningHint, fromBuyDraft, fromRepayDraft, toBuyDraft, toRepayDraft, LoanAmountPicker, type LendKind } from './LoanParts';
import FeedLinesEditor, { feedDraftProblem, fromDrafts, toDrafts, type FeedLineDraft } from './FeedLinesEditor';
import { Choice, FlowFooter, FlowShell, NUM, Question } from '../flow/FlowShell';

interface PlanFlowProps {
  isOpen: boolean;
  onClose: () => void;
  slot: number;
  name: string;
  params: ProposalPlanParams;
  /** The feed list, to pick each feed from. */
  products: FeedProductItem[];
  onSave: (name: string, params: ProposalPlanParams) => Promise<void>;
}

type Step = 'name' | 'herd' | 'animal' | 'feed' | 'bank' | 'repay' | 'check';
const STEPS: Step[] = ['name', 'herd', 'animal', 'feed', 'bank', 'repay', 'check'];
type Key = Exclude<keyof ProposalPlanParams, 'feedLines' | 'loan'>;

/** The numbers each step asks for, what to call them, and which must be above 0. */
const FIELDS: Record<Exclude<Step, 'name' | 'check' | 'repay'>, { key: Key; label: string; unit: string; hint?: string; whole?: boolean; above0?: boolean }[]> = {
  herd: [
    { key: 'targetStockLevel', label: 'Cattle to keep on the farm', unit: 'head', whole: true, above0: true },
    { key: 'fatteningPeriodDays', label: 'Days fattening each animal', unit: 'days', whole: true, above0: true },
    { key: 'numberOfBatches', label: 'Batches in the plan', unit: 'batches', whole: true },
    { key: 'cattlePerBatch', label: 'Cattle in each batch', unit: 'head', whole: true, hint: 'Worked out from the cattle to keep and the batches. You can change it.' },
  ],
  animal: [
    { key: 'initialWeightKg', label: 'Weight when bought', unit: 'kg', above0: true },
    { key: 'dailyWeightGainKg', label: 'Gain each day', unit: 'kg' },
    { key: 'purchasePricePerKgKhr', label: 'Buy price for each kg', unit: '៛' },
    { key: 'sellingPricePerKgKhr', label: 'Sell price for each kg', unit: '៛' },
  ],
  feed: [],
  bank: [
    { key: 'bankInterestRateAnnual', label: 'Bank interest', unit: '% a year', hint: 'Agreed with the bank, so it can change. Usually 8% a year.' },
  ],
};

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const toText = (p: ProposalPlanParams) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'feedLines' && k !== 'loan').map(([k, v]) => [k, String(v)])) as Record<Key, string>;

export default function PlanFlow(props: PlanFlowProps) {
  // Remount on every open so each change starts from what is saved.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <PlanBody {...props} />}
    </Dialog>
  );
}

function PlanBody({ onClose, slot, name: n0, params: p0, products, onSave }: PlanFlowProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(n0);
  const [f, setF] = useState<Record<Key, string>>(() => toText(p0));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reset, setReset] = useState(false);
  // Feed by kind; older plans start from their grass and concentrate.
  const [feedRows, setFeedRows] = useState<FeedLineDraft[]>(() => toDrafts(planFeedLines(p0)));
  // The bank loan: standard terms for a plan that has none yet.
  const loan0 = p0.loan ?? defaultPlanLoan();
  const [bank, setBank] = useState(loan0.bank);
  const [startMonth, setStartMonth] = useState(loan0.startMonth);
  const [lend, setLend] = useState<LendKind>(loan0.loanAmountKhr ? 'fixed' : loan0.loanCovers === 'all' ? 'all' : 'cattle');
  const fixedAmount = lend === 'fixed';
  const [amount, setAmount] = useState(loan0.loanAmountKhr ? String(loan0.loanAmountKhr) : '');
  const [financed, setFinanced] = useState(String(loan0.financedPct));
  const [limit, setLimit] = useState(String(loan0.creditLimitKhr));
  const [autoRenew, setAutoRenew] = useState(loan0.autoRenew);
  const [openingCash, setOpeningCash] = useState(String(loan0.openingCashKhr));
  const [buy, setBuy] = useState(() => toBuyDraft(loan0));
  const [repay, setRepay] = useState(() => toRepayDraft(loan0.repayments));

  const set = (k: Key) => (v: string) => {
    setF(x => {
      const next = { ...x, [k]: v };
      // Cattle in each batch follows the cattle to keep and the number of batches.
      if (k === 'targetStockLevel' || k === 'numberOfBatches') {
        const total = Number(next.targetStockLevel);
        const batches = Number(next.numberOfBatches);
        if (next.targetStockLevel.trim() !== '' && next.numberOfBatches.trim() !== '' && total > 0 && batches > 0 && Number.isInteger(batches)) {
          next.cattlePerBatch = String(Math.max(1, Math.round(total / batches)));
        }
      }
      return next;
    });
    setError('');
  };
  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setError(''); };
  const rawLoan = () => ({
    bank,
    startMonth,
    financedPct: fixedAmount ? Number(financed) || 100 : financed.trim() === '' ? NaN : Number(financed),
    loanAmountKhr: fixedAmount ? (amount.trim() === '' ? NaN : Number(amount)) : 0,
    loanCovers: lend === 'all' ? 'all' : 'cattle',
    creditLimitKhr: Number(limit || 0),
    autoRenew,
    repayments: fromRepayDraft(repay),
    openingCashKhr: openingCash.trim() === '' ? NaN : Number(openingCash),
    ...fromBuyDraft(buy),
  });
  const params = parsePlanParams({ ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)])), feedLines: fromDrafts(feedRows), loan: rawLoan() });
  const r = params ? calculatePlan(params) : null;
  const loanPlan = params ? (() => { const x = planLoanInputs(params); return simulateLoan(x.terms, x.assumptions); })() : null;
  const num = (k: Key) => Number(f[k]);

  // Each step checks only its own numbers.
  const problem = (s: Step): string | null => {
    if (s === 'name') return name.trim() ? null : 'Give the plan a name.';
    if (s === 'check') return params ? null : 'Some numbers are missing. Go back and fill them in.';
    if (s === 'feed') return feedDraftProblem(feedRows);
    if (s === 'herd') {
      const b = parseLoanAssumptions({ ...DEFAULT_ASSUMPTIONS, ...fromBuyDraft(buy) });
      if (typeof b === 'string') return b;
    }
    if (s === 'bank' && fixedAmount && !(Number(amount) > 0)) return 'Type the loan amount the bank agreed.';
    if (s === 'bank' && (openingCash.trim() === '' || !(Number(openingCash) >= 0))) return 'Type the money the farm has at the start (0 or more).';
    if (s === 'repay') { const l = parsePlanLoan(rawLoan(), Number(f.bankInterestRateAnnual) || 0); return typeof l === 'string' ? l : null; }
    for (const field of FIELDS[s]) {
      const raw = f[field.key].trim();
      const v = Number(raw);
      if (raw === '' || !Number.isFinite(v) || v < 0) return `Type ${field.label.toLowerCase()} (0 or more).`;
      if (field.above0 && v <= 0) return `${field.label} must be more than 0.`;
      if (field.whole && !Number.isInteger(v)) return `${field.label} must be a whole number.`;
    }
    return null;
  };

  const at = STEPS.indexOf(step);
  const next = async () => {
    const p = problem(step);
    if (p) { setError(p); return; }
    setError('');
    if (step !== 'check') { setStep(STEPS[at + 1]); return; }
    if (!params) return;
    setSaving(true);
    try {
      await onSave(name.trim(), params);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  };
  const back = () => { setError(''); setStep(STEPS[at - 1]); };

  const mismatch = num('numberOfBatches') * num('cattlePerBatch') !== num('targetStockLevel');
  const heading: Record<Step, { title: string; sub: string }> = {
    name: { title: 'The plan', sub: 'A fattening plan to try. It does not change your real herd.' },
    herd: { title: 'The herd', sub: 'How many cattle, how they are traded with CC Livestock, and for how long.' },
    animal: { title: 'Each animal and prices', sub: 'What one animal weighs, gains and sells for.' },
    feed: { title: 'Feed each day, per cow', sub: 'Each feed one cow eats a day and what a kg costs (an estimate for your own feed).' },
    bank: { title: 'The bank loan', sub: 'The bank pays the loan out once, in month 1, and the farm buys its cattle from CC Livestock with it.' },
    repay: { title: 'Paying the bank back', sub: 'When the loan is paid back each year. Interest is paid every month.' },
    check: { title: 'Check and save', sub: 'This is what the plan gives.' },
  };

  const numberField = (field: (typeof FIELDS)['herd'][number]) => (

        <Question key={field.key} label={field.label} hint={field.hint}>
          <div className="flex items-center gap-2">
            <Input aria-label={field.label} type="number" step={field.whole ? '1' : 'any'} min="0" inputMode="decimal" value={f[field.key]} onChange={e => set(field.key)(e.target.value)} className={`h-14 text-xl font-semibold ${NUM}`} />
            <span className="w-20 shrink-0 text-lg text-ink-muted">{field.unit}</span>
          </div>
        </Question>
  );

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={step === 'name' ? '' : name.trim() || `Plan ${slot}`}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : back} label={step === 'check' ? (saving ? 'Saving…' : 'Save the plan') : 'Next'} busy={saving} />}
    >
      {step === 'name' && (
        <>
          <Question label="Name of the plan" hint="For example 400 cattle, 120 days.">
            <Input aria-label="Name of the plan" autoFocus value={name} maxLength={60} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-base text-ink">Start again from the standard plan (400 cattle, 120 days, 1.25 kg a day)?</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => { setF(toText(DEFAULT_PLAN)); setFeedRows(toDrafts(planFeedLines(DEFAULT_PLAN))); setReset(true); setError(''); }}><RotateCcw /> Use the standard numbers</Button>
            {reset && <p className="mt-2 text-base text-emerald-800">The standard numbers are filled in. Nothing is saved until the last step.</p>}
          </div>
        </>
      )}

      {step === 'herd' && FIELDS.herd.slice(0, 1).map(field => numberField(field))}
      {step === 'herd' && <BuyPlanPicker value={buy} onChange={touch(setBuy)} />}
      {step === 'herd' && FIELDS.herd.slice(1).map(field => numberField(field.key === 'fatteningPeriodDays' ? { ...field, hint: fatteningHint(buy.plan) } : field))}
      {step === 'animal' && FIELDS.animal.map(field => numberField(field))}

      {step === 'herd' && mismatch && Number.isFinite(num('targetStockLevel')) && (
        <div className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">
          <p>{num('numberOfBatches')} batches of {num('cattlePerBatch')} is {(num('numberOfBatches') * num('cattlePerBatch')).toLocaleString()} cattle, but you keep {num('targetStockLevel').toLocaleString()}.</p>
          {num('numberOfBatches') > 0 && (
            <Button type="button" variant="outline" className="mt-2" onClick={() => setF(x => ({ ...x, cattlePerBatch: String(Math.max(1, Math.round(num('targetStockLevel') / num('numberOfBatches')))) }))}>Make each batch {Math.max(1, Math.round(num('targetStockLevel') / num('numberOfBatches')))} head</Button>
          )}
        </div>
      )}
      {step === 'animal' && r && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">Sold at {Math.round(r.finalWeightKgPerHead)} kg. Buy {riel(r.purchasePricePerHeadKhr)}, sell {riel(r.sellingPricePerHeadKhr)} for each animal.</p>}
      {step === 'feed' && (
        <>
          <FeedLinesEditor rows={feedRows} onChange={x => { setFeedRows(x); setError(''); }} products={products} />
          {r && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">Feed for one animal for the whole {f.fatteningPeriodDays} days: <span className="font-semibold">{riel(r.perHeadFeedCostKhr)}</span></p>}
        </>
      )}

      {step === 'bank' && (
        <>
          <Question label="Bank (optional)"><Input aria-label="Bank" value={bank} maxLength={100} onChange={e => touch(setBank)(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label="Month 1 of the loan"><Input aria-label="Month 1 of the loan" type="month" value={startMonth} onChange={e => touch(setStartMonth)(e.target.value)} className="h-14 text-lg" /></Question>
          {FIELDS.bank.map(field => numberField(field))}
          <LoanAmountPicker kind={lend} onKind={k => { setLend(k); setError(''); }} amount={amount} onAmount={v => { setAmount(v); setError(''); }} financed={financed} onFinanced={v => { setFinanced(v); setError(''); }} payout={loanPlan ? loanPlan.months[0]?.drawKhr ?? 0 : undefined} />
          <NumberField label="Credit limit" unit="៛" value={limit} onChange={touch(setLimit)} hint="The most the farm may owe at any time. 0 means no limit." />
          <Question label="Does the loan start again each year?">
            <div className="grid grid-cols-2 gap-3">
              <Choice selected={autoRenew} onClick={() => setAutoRenew(true)}>Yes, renew in year 2</Choice>
              <Choice selected={!autoRenew} onClick={() => setAutoRenew(false)}>No, one year only</Choice>
            </div>
          </Question>
          <NumberField label="The farm’s own money at the start" unit="៛" value={openingCash} onChange={touch(setOpeningCash)} />
        </>
      )}

      {step === 'repay' && <RepaymentPicker value={repay} onChange={touch(setRepay)} />}

      {step === 'check' && r && (
        <ul className="space-y-2 text-lg text-ink">
          <li className={`rounded-xl p-4 ${r.annualProfitKhr < 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>Profit each year once the herd is full: <span className="font-semibold">{riel(r.annualProfitKhr)}</span></li>
          <li className="rounded-xl bg-slate-50 p-4">Profit on each animal: <span className="font-semibold">{riel(r.profitPerHeadKhr)}</span> ({Math.round(r.marginPerHeadPercent * 10) / 10}% of its sale price)</li>
          <li className="rounded-xl bg-slate-50 p-4">Money to start: <span className="font-semibold">{riel(r.initialCattlePurchaseKhr)}</span> to buy {r.totalCattle.toLocaleString()} cattle</li>
          <li className="rounded-xl bg-slate-50 p-4">Return each year: <span className="font-semibold">{Math.round(r.annualRoiPercent * 10) / 10}%</span></li>
          {loanPlan && loanPlan.years[0] && (
            <>
              <li className="rounded-xl bg-slate-50 p-4">The bank pays out <span className="font-semibold">{riel(loanPlan.years[0].drawnKhr)}</span> once, in month 1; the farm pays it {riel(loanPlan.years[0].interestKhr + loanPlan.years[0].principalKhr)} in year 1 ({riel(loanPlan.years[0].interestKhr)} interest).</li>
              <li className={`rounded-xl p-4 ${loanPlan.moneyNeededKhr > 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>{loanPlan.moneyNeededKhr > 0 ? <>With the loan, the farm needs <span className="font-semibold">{riel(loanPlan.moneyNeededKhr)}</span> of its own money on top.</> : 'With the loan, the farm can pay every month from its sales.'}</li>
            </>
          )}
        </ul>
      )}
    </FlowShell>
  );
}
