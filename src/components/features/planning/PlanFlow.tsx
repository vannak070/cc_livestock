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
import { useText } from '@/hooks/useText';

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

/** The numbers each step asks for, and which must be above 0. Labels are planning.f_<key> (or labelKey); units planning.u_<unit> unless a plain symbol. */
type Field = { key: Key; unit: string; labelKey?: string; hintKey?: string; whole?: boolean; above0?: boolean };
const FIELDS: Record<Exclude<Step, 'name' | 'check' | 'repay'>, Field[]> = {
  herd: [
    { key: 'targetStockLevel', labelKey: 'f_targetStockLevelLong', unit: 'u_head', whole: true, above0: true },
    { key: 'fatteningPeriodDays', unit: 'u_days', whole: true, above0: true },
    { key: 'numberOfBatches', unit: 'u_batches', whole: true },
    { key: 'cattlePerBatch', unit: 'u_head', whole: true, hintKey: 'f_cattlePerBatchHint' },
  ],
  animal: [
    { key: 'initialWeightKg', unit: 'kg', above0: true },
    { key: 'dailyWeightGainKg', unit: 'kg' },
    { key: 'purchasePricePerKgKhr', unit: '៛' },
    { key: 'sellingPricePerKgKhr', unit: '៛' },
  ],
  feed: [],
  bank: [
    { key: 'bankInterestRateAnnual', unit: 'u_pctYear', hintKey: 'f_bankInterestHint' },
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
  const { tx } = useText('planning');
  const flow = useText('flow');
  const label = (field: Field) => tx(field.labelKey ?? `f_${field.key}`);
  const unit = (u: string) => (u.startsWith('u_') ? tx(u) : u);
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
  const feedProblem = feedDraftProblem(feedRows, tx);
  const params = parsePlanParams({ ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)])), feedLines: fromDrafts(feedRows), loan: rawLoan() });
  const r = params ? calculatePlan(params) : null;
  const loanPlan = params ? (() => { const x = planLoanInputs(params); return simulateLoan(x.terms, x.assumptions); })() : null;
  const num = (k: Key) => Number(f[k]);

  // Each step checks only its own numbers.
  const problem = (s: Step): string | null => {
    if (s === 'name') return name.trim() ? null : tx('eName');
    if (s === 'check') return params ? null : tx('eMissing');
    if (s === 'feed') return feedProblem;
    if (s === 'herd') {
      const b = parseLoanAssumptions({ ...DEFAULT_ASSUMPTIONS, ...fromBuyDraft(buy) });
      if (typeof b === 'string') return b;
    }
    if (s === 'bank' && fixedAmount && !(Number(amount) > 0)) return tx('eAgreed');
    if (s === 'bank' && (openingCash.trim() === '' || !(Number(openingCash) >= 0))) return tx('eOwnMoney');
    if (s === 'repay') { const l = parsePlanLoan(rawLoan(), Number(f.bankInterestRateAnnual) || 0); return typeof l === 'string' ? l : null; }
    for (const field of FIELDS[s]) {
      const raw = f[field.key].trim();
      const v = Number(raw);
      if (raw === '' || !Number.isFinite(v) || v < 0) return tx('eType', { field: label(field).toLowerCase() });
      if (field.above0 && v <= 0) return tx('eAbove0', { field: label(field) });
      if (field.whole && !Number.isInteger(v)) return tx('eWhole', { field: label(field) });
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
      setError(e instanceof Error ? e.message : tx('eSave'));
    } finally {
      setSaving(false);
    }
  };
  const back = () => { setError(''); setStep(STEPS[at - 1]); };

  const mismatch = num('numberOfBatches') * num('cattlePerBatch') !== num('targetStockLevel');
  const heading: Record<Step, { title: string; sub: string }> = {
    name: { title: tx('dTitleName'), sub: tx('dSubName') },
    herd: { title: tx('dTitleHerd'), sub: tx('dSubHerd') },
    animal: { title: tx('dTitleAnimal'), sub: tx('dSubAnimal') },
    feed: { title: tx('dTitleFeed'), sub: tx('dSubFeed') },
    bank: { title: tx('dTitleBank'), sub: tx('dSubBank') },
    repay: { title: tx('dTitleRepay'), sub: tx('dSubRepay') },
    check: { title: tx('dTitleCheck'), sub: tx('dSubCheck') },
  };

  const numberField = (field: Field, hint?: string) => (
        <Question key={field.key} label={label(field)} hint={hint ?? (field.hintKey ? tx(field.hintKey) : undefined)}>
          <div className="flex items-center gap-2">
            <Input aria-label={label(field)} type="number" step={field.whole ? '1' : 'any'} min="0" inputMode="decimal" value={f[field.key]} onChange={e => set(field.key)(e.target.value)} className={`h-14 text-xl font-semibold ${NUM}`} />
            <span className="w-20 shrink-0 text-lg text-ink-muted">{unit(field.unit)}</span>
          </div>
        </Question>
  );

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={step === 'name' ? '' : name.trim() || tx('planN', { n: slot })}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : back} label={step === 'check' ? (saving ? flow.tx('saving') : tx('dSave')) : flow.tx('next')} busy={saving} />}
    >
      {step === 'name' && (
        <>
          <Question label={tx('dName')} hint={tx('dNameHint')}>
            <Input aria-label={tx('dName')} autoFocus value={name} maxLength={60} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-base text-ink">{tx('dStartAgain')}</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => { setF(toText(DEFAULT_PLAN)); setFeedRows(toDrafts(planFeedLines(DEFAULT_PLAN))); setReset(true); setError(''); }}><RotateCcw /> {tx('dUseStandard')}</Button>
            {reset && <p className="mt-2 text-base text-emerald-800">{tx('dStandardDone')}</p>}
          </div>
        </>
      )}

      {step === 'herd' && FIELDS.herd.slice(0, 1).map(field => numberField(field))}
      {step === 'herd' && <BuyPlanPicker value={buy} onChange={touch(setBuy)} />}
      {step === 'herd' && FIELDS.herd.slice(1).map(field => numberField(field, field.key === 'fatteningPeriodDays' ? fatteningHint(buy.plan, tx) : undefined))}
      {step === 'animal' && FIELDS.animal.map(field => numberField(field))}

      {step === 'herd' && mismatch && Number.isFinite(num('targetStockLevel')) && (
        <div className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">
          <p>{tx('dMismatch', { b: num('numberOfBatches'), c: num('cattlePerBatch'), total: (num('numberOfBatches') * num('cattlePerBatch')).toLocaleString(), keep: num('targetStockLevel').toLocaleString() })}</p>
          {num('numberOfBatches') > 0 && (
            <Button type="button" variant="outline" className="mt-2" onClick={() => setF(x => ({ ...x, cattlePerBatch: String(Math.max(1, Math.round(num('targetStockLevel') / num('numberOfBatches')))) }))}>{tx('dMakeBatch', { n: Math.max(1, Math.round(num('targetStockLevel') / num('numberOfBatches'))) })}</Button>
          )}
        </div>
      )}
      {step === 'animal' && r && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{tx('dSoldAt', { kg: Math.round(r.finalWeightKgPerHead), buy: riel(r.purchasePricePerHeadKhr), sell: riel(r.sellingPricePerHeadKhr) })}</p>}
      {step === 'feed' && (
        <>
          <FeedLinesEditor rows={feedRows} onChange={x => { setFeedRows(x); setError(''); }} products={products} />
          {r && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{tx('dFeedWhole', { days: f.fatteningPeriodDays, amount: riel(r.perHeadFeedCostKhr) })}</p>}
        </>
      )}

      {step === 'bank' && (
        <>
          <Question label={tx('dBank')}><Input aria-label={tx('dBankAria')} value={bank} maxLength={100} onChange={e => touch(setBank)(e.target.value)} className="h-14 text-lg" /></Question>
          <Question label={tx('dMonth1')}><Input aria-label={tx('dMonth1')} type="month" value={startMonth} onChange={e => touch(setStartMonth)(e.target.value)} className="h-14 text-lg" /></Question>
          {FIELDS.bank.map(field => numberField(field))}
          <LoanAmountPicker kind={lend} onKind={k => { setLend(k); setError(''); }} amount={amount} onAmount={v => { setAmount(v); setError(''); }} financed={financed} onFinanced={v => { setFinanced(v); setError(''); }} payout={loanPlan ? loanPlan.months[0]?.drawKhr ?? 0 : undefined} />
          <NumberField label={tx('dLimit')} unit="៛" value={limit} onChange={touch(setLimit)} hint={tx('dLimitHint')} />
          <Question label={tx('dRenew')}>
            <div className="grid grid-cols-2 gap-3">
              <Choice selected={autoRenew} onClick={() => setAutoRenew(true)}>{tx('dRenewYes')}</Choice>
              <Choice selected={!autoRenew} onClick={() => setAutoRenew(false)}>{tx('dRenewNo')}</Choice>
            </div>
          </Question>
          <NumberField label={tx('dOwnMoney')} unit="៛" value={openingCash} onChange={touch(setOpeningCash)} />
        </>
      )}

      {step === 'repay' && <RepaymentPicker value={repay} onChange={touch(setRepay)} />}

      {step === 'check' && r && (
        <ul className="space-y-2 text-lg text-ink">
          <li className={`rounded-xl p-4 ${r.annualProfitKhr < 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>{tx('cProfitYear', { amount: riel(r.annualProfitKhr) })}</li>
          <li className="rounded-xl bg-slate-50 p-4">{tx('cProfitAnimal', { amount: riel(r.profitPerHeadKhr), pct: Math.round(r.marginPerHeadPercent * 10) / 10 })}</li>
          <li className="rounded-xl bg-slate-50 p-4">{tx('cStart', { amount: riel(r.initialCattlePurchaseKhr), n: r.totalCattle.toLocaleString() })}</li>
          <li className="rounded-xl bg-slate-50 p-4">{tx('cReturn', { pct: Math.round(r.annualRoiPercent * 10) / 10 })}</li>
          {loanPlan && loanPlan.years[0] && (
            <>
              <li className="rounded-xl bg-slate-50 p-4">{tx('cPayout', { amount: riel(loanPlan.years[0].drawnKhr), paid: riel(loanPlan.years[0].interestKhr + loanPlan.years[0].principalKhr), interest: riel(loanPlan.years[0].interestKhr) })}</li>
              <li className={`rounded-xl p-4 ${loanPlan.moneyNeededKhr > 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>{loanPlan.moneyNeededKhr > 0 ? tx('cNeeds', { amount: riel(loanPlan.moneyNeededKhr) }) : tx('cCanPay')}</li>
            </>
          )}
        </ul>
      )}
    </FlowShell>
  );
}
