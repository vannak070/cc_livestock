'use client';

import React, { useState } from 'react';
import { Database } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ERPLivestockData, FarmItem, FarmLoanAssumptions, FarmLoanTerms } from '@/lib/types';
import { farmActuals, parseLoanAssumptions, parseLoanTerms, simulateLoan } from '@/lib/farm-loan';
import { Choice, FlowFooter, FlowShell, Question } from '../flow/FlowShell';
import { BuyPlanPicker, NumberField, RepaymentPicker, fatteningHint, fromBuyDraft, fromRepayDraft, toBuyDraft, toRepayDraft, LoanAmountPicker, type LendKind } from './LoanParts';
import FeedLinesEditor, { feedDraftProblem, fromDrafts, toDrafts, type FeedLineDraft } from './FeedLinesEditor';

interface FarmLoanFlowProps {
  isOpen: boolean;
  onClose: () => void;
  farm: FarmItem;
  /** What the plan holds now (saved values, or the standard ones for a new loan). */
  terms: FarmLoanTerms;
  assumptions: FarmLoanAssumptions;
  notes: string;
  /** Whether the farm already has a saved loan plan (an older one may hold one feed total). */
  saved?: boolean;
  /** The farm's records, for "Use the farm's records". */
  data: ERPLivestockData;
  onSave: (terms: FarmLoanTerms, assumptions: FarmLoanAssumptions, notes: string) => Promise<void>;
}

type Step = 'bank' | 'repay' | 'cattle' | 'feed' | 'money' | 'check';
const STEPS: Step[] = ['bank', 'repay', 'cattle', 'feed', 'money', 'check'];
// The single numbers; feed by kind is kept as its own list.
type AKey = Exclude<keyof FarmLoanAssumptions, 'feedLines' | 'buyPlan' | 'firstBuyPct' | 'secondBuyMonth' | 'lastBuyMonth'>;
const NOT_NUMBERS = ['feedLines', 'buyPlan', 'firstBuyPct', 'secondBuyMonth', 'lastBuyMonth'];

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;

export default function FarmLoanFlow(props: FarmLoanFlowProps) {
  // Remount on every open so each change starts from what is saved.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <FarmLoanBody {...props} />}
    </Dialog>
  );
}


function FarmLoanBody({ onClose, farm, terms: t0, assumptions: a0, notes: n0, saved = false, data, onSave }: FarmLoanFlowProps) {
  const [step, setStep] = useState<Step>('bank');
  const [bank, setBank] = useState(t0.bank);
  const [startMonth, setStartMonth] = useState(t0.startMonth);
  const [rate, setRate] = useState(String(t0.annualRatePct));
  const [financed, setFinanced] = useState(String(t0.financedPct));
  // The bank pays the loan out once, in month 1: an agreed amount, or enough to buy the herd.
  const [lend, setLend] = useState<LendKind>(t0.loanAmountKhr && t0.loanAmountKhr > 0 ? 'fixed' : t0.loanCovers === 'all' ? 'all' : 'cattle');
  const fixedAmount = lend === 'fixed';
  const [amount, setAmount] = useState(t0.loanAmountKhr ? String(t0.loanAmountKhr) : '');
  const [limit, setLimit] = useState(String(t0.creditLimitKhr));
  const [autoRenew, setAutoRenew] = useState(t0.autoRenew);
  const [repay, setRepay] = useState(() => toRepayDraft(t0.repayments));
  const [a, setA] = useState<Record<AKey, string>>(() => Object.fromEntries(Object.entries(a0).filter(([k]) => !NOT_NUMBERS.includes(k)).map(([k, v]) => [k, String(v)])) as Record<AKey, string>);
  const [buy, setBuy] = useState(() => toBuyDraft(a0));
  const buyPlan = buy.plan;
  // Feed by kind: the saved lines, else what the farm's records show, else one empty line to fill in.
  const [feedRows, setFeedRows] = useState<FeedLineDraft[]>(() => {
    if (a0.feedLines?.length) return toDrafts(a0.feedLines);
    const recorded = farmActuals(farm, data).feedLines;
    return recorded?.length ? toDrafts(recorded) : toDrafts([{ name: '', kgPerHeadDay: NaN, pricePerKgKhr: NaN }]).map(r => ({ ...r, kg: '', price: '' }));
  });
  const [feedNote] = useState(() => (saved && !a0.feedLines?.length && a0.feedCostPerHeadDayKhr > 0
    ? `This plan had one feed total of ${Math.round(a0.feedCostPerHeadDayKhr).toLocaleString()} ៛ a day per cow. Split it by feed below.`
    : ''));
  const [from, setFrom] = useState<Partial<Record<AKey, string>>>({});
  const [notes, setNotes] = useState(n0);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (k: AKey) => (v: string) => { setA(x => ({ ...x, [k]: v })); setFrom(f => ({ ...f, [k]: undefined })); setError(''); };
  const rawTerms = () => ({
    bank,
    startMonth,
    // A blank box is missing, not 0%.
    annualRatePct: rate.trim() === '' ? NaN : Number(rate),
    financedPct: fixedAmount ? Number(financed) || 100 : financed.trim() === '' ? NaN : Number(financed),
    loanAmountKhr: fixedAmount ? (amount.trim() === '' ? NaN : Number(amount)) : 0,
    loanCovers: lend === 'all' ? 'all' : 'cattle',
    creditLimitKhr: Number(limit || 0),
    autoRenew,
    repayments: fromRepayDraft(repay),
  });
  const numbers = () => ({
    ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === '' ? NaN : Number(v)])),
    ...fromBuyDraft(buy),
  });
  // The feed cost a day is the sum of the feed lines (the server works it out the same way).
  const rawAssumptions = (withFeed = true) => {
    const lines = fromDrafts(feedRows);
    const perDay = lines.reduce((s, l) => s + (Number.isFinite(l.kgPerHeadDay * l.pricePerKgKhr) ? l.kgPerHeadDay * l.pricePerKgKhr : 0), 0);
    return withFeed ? { ...numbers(), feedCostPerHeadDayKhr: Math.round(perDay), feedLines: lines } : { ...numbers(), feedCostPerHeadDayKhr: 0 };
  };

  const terms = parseLoanTerms(rawTerms());
  const assumptions = parseLoanAssumptions(rawAssumptions());
  const plan = typeof terms === 'string' || typeof assumptions === 'string' ? null : simulateLoan(terms, assumptions);

  const useRecords = () => {
    const found = farmActuals(farm, data);
    const n = Object.keys(found.values).length;
    if (n === 0) { setInfo(`${farm.name} has no records to start from yet.`); return; }
    setA(x => ({ ...x, ...Object.fromEntries(Object.entries(found.values).map(([k, v]) => [k, String(v)])) }));
    setFrom(found.basis);
    if (found.feedLines?.length) setFeedRows(toDrafts(found.feedLines));
    setInfo(`Filled ${n} numbers${found.feedLines?.length ? ` and ${found.feedLines.length} feeds` : ''} from ${farm.name}'s records. Check them.`);
  };

  // Each step checks only its own fields, using the same rules as the server.
  const problem = (s: Step): string | null => {
    if (s === 'bank' && fixedAmount && !(Number(amount) > 0)) return 'Type the loan amount the bank agreed.';
    if (s === 'bank' || s === 'repay') return typeof terms === 'string' ? terms : null;
    if (s === 'cattle') { const x = parseLoanAssumptions(rawAssumptions(false)); return typeof x === 'string' ? x : null; }
    if (s === 'feed') return feedDraftProblem(feedRows);
    if (s === 'money') return typeof assumptions === 'string' ? assumptions : null;
    return null;
  };

  const at = STEPS.indexOf(step);
  const next = async () => {
    const p = problem(step);
    if (p) { setError(p); return; }
    setError('');
    if (step !== 'check') { setStep(STEPS[at + 1]); return; }
    if (typeof terms === 'string' || typeof assumptions === 'string') return;
    setSaving(true);
    try {
      await onSave(terms, assumptions, notes.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the loan.');
    } finally {
      setSaving(false);
    }
  };
  const back = () => { setError(''); setStep(STEPS[at - 1]); };

  const heading: Record<Step, { title: string; sub: string }> = {
    bank: { title: 'The bank', sub: `Who lends to ${farm.name}, and on what terms.` },
    repay: { title: 'Paying back', sub: 'When the farm pays the loan back each year. Interest is paid every month.' },
    cattle: { title: 'The cattle', sub: 'The farm buys its cattle from CC Livestock and sells them back to CC Livestock.' },
    feed: { title: 'Feed each day, per cow', sub: 'Each feed one cow eats a day, and what a kg costs. The farm pays feed itself.' },
    money: { title: 'The farm’s money', sub: 'The farm pays feed and interest from its own money and its sales.' },
    check: { title: 'Check and save', sub: 'This is what the plan gives. Nothing changes your real herd.' },
  };

  const y1 = plan?.years[0];
  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={step === 'bank' ? farm.name : [farm.name, bank.trim() || 'bank not named', `${rate || '?'}% a year`].join(' · ')}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : back} label={step === 'check' ? (saving ? 'Saving…' : 'Save the plan') : 'Next'} busy={saving} />}
    >
      {step === 'bank' && (
        <>
          <Question label="Bank (optional)"><Input aria-label="Bank" value={bank} maxLength={100} onChange={e => { setBank(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <Question label="Month 1 of the loan"><Input aria-label="Month 1 of the loan" type="month" value={startMonth} onChange={e => { setStartMonth(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
          <NumberField label="Interest" unit="% a year" value={rate} onChange={v => { setRate(v); setError(''); }} hint="Agreed with the bank, so it can change. Usually 8% a year." />
          <LoanAmountPicker kind={lend} onKind={k => { setLend(k); setError(''); }} amount={amount} onAmount={v => { setAmount(v); setError(''); }} financed={financed} onFinanced={v => { setFinanced(v); setError(''); }} payout={plan ? plan.months[0]?.drawKhr ?? 0 : undefined} />
          <NumberField label="Credit limit" unit="៛" value={limit} onChange={v => { setLimit(v); setError(''); }} hint="The most the farm may owe at any time. 0 means no limit." />
          <Question label="Does the loan start again each year?">
            <div className="grid grid-cols-2 gap-3">
              <Choice selected={autoRenew} onClick={() => setAutoRenew(true)}>Yes, renew in year 2</Choice>
              <Choice selected={!autoRenew} onClick={() => setAutoRenew(false)}>No, one year only</Choice>
            </div>
          </Question>
        </>
      )}

      {step === 'repay' && <RepaymentPicker value={repay} onChange={d => { setRepay(d); setError(''); }} />}

      {step === 'cattle' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={useRecords}><Database /> Use {farm.name}&apos;s records</Button>
            {info && <span className="text-base text-emerald-800">{info}</span>}
          </div>
          <NumberField label="Cattle to keep on the farm" unit="head" step="1" value={a.herdTarget} onChange={setField('herdTarget')} from={from.herdTarget} />
          <BuyPlanPicker value={buy} onChange={d => { setBuy(d); setError(''); }} />
          <NumberField label="Weight when bought" unit="kg" value={a.initialWeightKg} onChange={setField('initialWeightKg')} from={from.initialWeightKg} />
          <NumberField label="Buy price for each kg" unit="៛" value={a.buyPricePerKgKhr} onChange={setField('buyPricePerKgKhr')} from={from.buyPricePerKgKhr} hint="The price the farm pays CC Livestock for its cattle." />
          <NumberField label="Days fattening each animal" unit="days" step="1" value={a.fatteningDays} onChange={setField('fatteningDays')} from={from.fatteningDays}
            hint={fatteningHint(buyPlan)} />
          <NumberField label="Gain each day" unit="kg" value={a.dailyGainKg} onChange={setField('dailyGainKg')} from={from.dailyGainKg} />
          <NumberField label="Sell price for each kg" unit="៛" value={a.sellPricePerKgKhr} onChange={setField('sellPricePerKgKhr')} from={from.sellPricePerKgKhr} hint="The price CC Livestock pays the farm for its cattle." />
        </>
      )}

      {step === 'feed' && (
        <>
          {feedNote && <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">{feedNote}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => { const f = farmActuals(farm, data); if (f.feedLines?.length) { setFeedRows(toDrafts(f.feedLines)); setInfo(`From ${f.feedBasis}.`); } else setInfo(`${farm.name} has no feed records yet.`); setError(''); }}><Database /> Use {farm.name}&apos;s feed records</Button>
            {info && <span className="text-base text-emerald-800">{info}</span>}
          </div>
          <FeedLinesEditor rows={feedRows} onChange={r => { setFeedRows(r); setError(''); }} products={data.feedProducts ?? []} />
        </>
      )}

      {step === 'money' && (
        <>
          <NumberField label="The farm’s own money at the start" unit="៛" value={a.openingCashKhr} onChange={setField('openingCashKhr')} />
          <Question label="Notes (optional)"><Input aria-label="Notes" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'check' && plan && y1 && (
        <ul className="space-y-2 text-lg text-ink">
          <li className="rounded-xl bg-slate-50 p-4">The bank pays out <span className="font-semibold">{riel(y1.drawnKhr)}</span> once, in month 1{lend === 'all' ? ', for cattle, a year of feed and interest' : lend === 'cattle' ? ', for the cattle' : ''}.</li>
          <li className="rounded-xl bg-slate-50 p-4">The farm pays the bank <span className="font-semibold">{riel(y1.interestKhr + y1.principalKhr)}</span> in year 1 ({riel(y1.interestKhr)} interest). CC Livestock does not repay the bank.</li>
          <li className="rounded-xl bg-slate-50 p-4">Buys {plan.months.filter(m => m.year === 1).reduce((s, m) => s + m.headBought, 0).toLocaleString()} cattle ({riel(y1.purchasesKhr)}) and {riel(y1.feedKhr)} of feed from CC Livestock, and sells <span className="font-semibold">{plan.months.filter(m => m.year === 1).reduce((s, m) => s + m.headSold, 0).toLocaleString()} cattle</span> back for {riel(y1.salesKhr)}.</li>
          <li className={`rounded-xl p-4 ${plan.moneyNeededKhr > 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>
            {plan.moneyNeededKhr > 0 ? <>Needs <span className="font-semibold">{riel(plan.moneyNeededKhr)}</span> of its own money on top.</> : 'Can pay every month from its sales.'}
          </li>
          <li className={`rounded-xl p-4 ${y1.profitKhr < 0 ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>Profit in year 1: <span className="font-semibold">{riel(y1.profitKhr)}</span></li>
        </ul>
      )}
    </FlowShell>
  );
}
