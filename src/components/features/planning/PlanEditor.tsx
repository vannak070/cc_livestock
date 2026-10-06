'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FeedProductItem, ProposalPlanParams, ProposalPlanRecord } from '@/types';
import { DEFAULT_PLAN, calculatePlan } from '@/lib/proposal-plan';
import { bankSchedule, ccTrades, simulateLoan } from '@/lib/farm-loan';
import { planLoanInputs } from '@/lib/plan-loan';
import { BUY_PLAN_LABEL, buyingSentence } from './LoanParts';
import { BankPaymentsTable, CcTradesTable, FeedNeedsTable, exportBankPlan, exportFeedNeeds, exportTrades, monthLabel } from './LoanTables';
import PlanFlow from './PlanFlow';

interface PlanEditorProps {
  /** Which of the ten plans this is, 1 to 10. */
  slot: number;
  /** The saved plan in this slot; empty for a new one, which starts from the standard plan. */
  plan?: ProposalPlanRecord;
  /** Starting numbers for a new plan, for example copied from another. */
  startFrom?: ProposalPlanParams;
  onBack: () => void;
  onSave: (name: string, params: ProposalPlanParams) => Promise<void>;
  /** The feed list, to pick each feed from. */
  products?: FeedProductItem[];
}

type Tab = 'overview' | 'bank' | 'months' | 'batches' | 'feed' | 'numbers';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'bank', label: 'Bank loan' },
  { key: 'months', label: 'Months' },
  { key: 'batches', label: 'Batches' },
  { key: 'feed', label: 'Feed needs' },
  { key: 'numbers', label: 'The numbers' },
];

type Key = Exclude<keyof ProposalPlanParams, 'feedLines' | 'loan'>;
const GROUPS: { title: string; fields: { key: Key; label: string; unit: string; step?: string }[] }[] = [
  { title: 'The herd', fields: [
    { key: 'targetStockLevel', label: 'Cattle to keep', unit: 'head' },
    { key: 'fatteningPeriodDays', label: 'Days fattening each animal', unit: 'days' },
    { key: 'numberOfBatches', label: 'Batches in the plan', unit: 'batches' },
    { key: 'cattlePerBatch', label: 'Cattle in each batch', unit: 'head' },
  ] },
  { title: 'Each animal', fields: [
    { key: 'initialWeightKg', label: 'Weight when bought', unit: 'kg' },
    { key: 'dailyWeightGainKg', label: 'Gain each day', unit: 'kg', step: '0.05' },
  ] },
  { title: 'Prices', fields: [
    { key: 'purchasePricePerKgKhr', label: 'Buy price for each kg', unit: '៛' },
    { key: 'sellingPricePerKgKhr', label: 'Sell price for each kg', unit: '៛' },
  ] },
  { title: 'Money', fields: [
    { key: 'bankInterestRateAnnual', label: 'Bank interest', unit: '% a year', step: '0.1' },
  ] },
];

// Chart colours were checked with the colour validator (colour-blind safe): Sales is leaf green, Costs is blue.
const SALES = '#0E7A38';
const COSTS = '#2B6CB0';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const signedRiel = (n: number) => `${n < 0 ? '−' : ''}${riel(Math.abs(n))}`;
const mil = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : `${Math.round(v / 1000)}k`);

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  const style = tone === 'bad' ? 'border-rose-300 bg-rose-50' : tone === 'good' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${style}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

function Rows({ rows, total }: { rows: [string, string][]; total?: [string, string, boolean?] }) {
  return (
    <dl className="rounded-2xl border border-slate-200 bg-white px-5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-3 last:border-0"><dt className="text-base text-ink-muted">{k}</dt><dd className="text-base font-medium text-ink">{v}</dd></div>
      ))}
      {total && (
        <div className="flex justify-between gap-4 border-t border-slate-200 py-3"><dt className="text-lg font-medium text-ink">{total[0]}</dt><dd className={`text-lg font-semibold ${total[2] ? 'text-rose-700' : 'text-emerald-800'}`}>{total[1]}</dd></div>
      )}
    </dl>
  );
}

/**
 * One fattening plan, read first: what it earns and how. Changing it is a
 * guided dialog (PlanFlow); the tabs below show the details.
 */
export default function PlanEditor({ slot, plan, startFrom, onBack, onSave, products = [] }: PlanEditorProps) {
  const [tab, setTab] = useState<Tab>('overview');
  // A new plan (not saved yet) opens the dialog straight away.
  const [editing, setEditing] = useState(!plan);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const params = useMemo<ProposalPlanParams>(() => ({ ...DEFAULT_PLAN, ...(plan?.params ?? startFrom ?? {}) }), [plan, startFrom]);
  const name = plan?.name ?? `Plan ${slot}`;
  const r = useMemo(() => calculatePlan(params), [params]);
  // The plan's bank loan, run like a farm loan: payments to the bank and trades with CC Livestock.
  const loan = useMemo(() => {
    const x = planLoanInputs(params);
    const sim = simulateLoan(x.terms, x.assumptions);
    return { ...x, sim, payments: bankSchedule(sim), trades: ccTrades(sim) };
  }, [params]);
  const [loanView, setLoanView] = useState<'payments' | 'trades'>('payments');

  const save = async (n: string, p: ProposalPlanParams) => {
    await onSave(n, p);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const mismatch = params.numberOfBatches * params.cattlePerBatch !== params.targetStockLevel;
  const chart = r.months.map(m => ({ label: `M${m.month}`, Sales: m.revenueKhr, Costs: m.totalCostKhr }));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <Button variant="ghost" onClick={onBack} className="-ml-3"><ArrowLeft /> All plans</Button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base text-ink-muted">Plan {slot}{plan ? '' : ' (not saved yet, standard numbers)'}</p>
          <h2 className="break-words text-2xl font-semibold text-ink">{name}</h2>
          {plan && <p className="text-sm text-ink-muted">Saved {plan.updatedAt.slice(0, 10)}{plan.updatedBy ? ` by ${plan.updatedBy}` : ''}</p>}
        </div>
        <Button size="lg" onClick={() => setEditing(true)}><Pencil /> {plan ? 'Change the plan' : 'Set up the plan'}</Button>
      </div>
      {savedAt && <p role="status" className="text-base font-medium text-emerald-800">Plan saved at {savedAt}.</p>}

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-lg text-ink">
        <h3 className="text-lg font-semibold">In short</h3>
        <p>Keep <span className="font-semibold">{r.totalCattle.toLocaleString()} cattle</span>, each fattened {params.fatteningPeriodDays} days ({r.fatteningMonths} months) from {params.initialWeightKg} kg to {Math.round(r.finalWeightKgPerHead)} kg. About {r.monthlyBatchQty.toLocaleString()} are bought and sold each month.</p>
        <p>Each animal costs {riel(r.costPerHeadKhr)} (cattle, feed and interest) and sells for {riel(r.sellingPricePerHeadKhr)}: <span className={`font-semibold ${r.profitPerHeadKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{r.profitPerHeadKhr < 0 ? 'a loss of ' : 'a profit of '}{riel(Math.abs(r.profitPerHeadKhr))}</span>.</p>
        <p>{buyingSentence(loan.assumptions, loan.sim.months.filter(m => m.year === 1).reduce((s, m) => s + m.headBought, 0), 'The farm')} The bank pays out <span className="font-semibold">{riel(loan.sim.years[0]?.drawnKhr ?? 0)}</span> in {monthLabel(loan.terms.startMonth)}{loan.terms.loanCovers === 'all' && !loan.terms.loanAmountKhr ? ' for cattle, a year of feed and interest' : ''}; in year 1 the farm pays it {riel(loan.payments.years[0]?.totalKhr ?? 0)} itself (CC Livestock does not repay the bank).</p>
        <p>Once the herd is full the farm makes <span className={`font-semibold ${r.annualProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{signedRiel(r.annualProfitKhr)} a year</span> on {riel(r.initialCattlePurchaseKhr)} to start ({Math.round(r.annualRoiPercent * 10) / 10}% a year).</p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label="Profit each year" value={signedRiel(r.annualProfitKhr)} sub="once the herd is full" tone={r.annualProfitKhr < 0 ? 'bad' : 'good'} />
        <Tile label="Profit each animal" value={signedRiel(r.profitPerHeadKhr)} sub={`${Math.round(r.marginPerHeadPercent * 10) / 10}% of the sale price`} tone={r.profitPerHeadKhr < 0 ? 'bad' : undefined} />
        <Tile label="Money to start" value={riel(r.initialCattlePurchaseKhr)} sub={`to buy ${r.totalCattle.toLocaleString()} cattle`} />
        <Tile label="Return each year" value={`${Math.round(r.annualRoiPercent * 10) / 10}%`} sub="profit over the money to start" tone={r.annualRoiPercent < 0 ? 'bad' : undefined} />
      </section>
      {mismatch && <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">{params.numberOfBatches} batches of {params.cattlePerBatch} is {(params.numberOfBatches * params.cattlePerBatch).toLocaleString()} cattle, but the plan keeps {params.targetStockLevel.toLocaleString()}. The Batches tab uses the batch numbers; everything else uses the herd size.</p>}

      <div role="tablist" aria-label="Plan results" className="flex overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-fit">
        {TABS.map(t => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-base font-medium sm:px-5 ${tab === t.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-ink">One animal</h3>
            <Rows
              rows={[
                ['Sells for', riel(r.sellingPricePerHeadKhr)],
                ['Bought for', riel(r.purchasePricePerHeadKhr)],
                ...r.feed.map(f => [f.name, riel(f.perHeadKhr)] as [string, string]),
                ['Bank interest', riel(r.interestPerHeadKhr)],
                ['Total cost', riel(r.costPerHeadKhr)],
              ]}
              total={['Profit', signedRiel(r.profitPerHeadKhr), r.profitPerHeadKhr < 0]}
            />
          </section>
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-ink">One year, herd full</h3>
            <Rows
              rows={[
                ['Sales', riel(r.annualSalesRevenueKhr)],
                ['Cattle bought', riel(r.annualCattlePurchasesKhr)],
                ...r.feed.map(f => [f.name, riel(f.annualKhr)] as [string, string]),
                ['Bank interest', riel(r.annualBankInterestKhr)],
                ['Total cost', riel(r.annualTotalCostKhr)],
              ]}
              total={['Profit', signedRiel(r.annualProfitKhr), r.annualProfitKhr < 0]}
            />
            <p className="text-base text-ink-muted">About {r.monthlyBatchQty.toLocaleString()} animals are bought and sold each month, and each stays {params.fatteningPeriodDays} days.</p>
          </section>
        </div>
      )}

      {tab === 'bank' && (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Tile label="Loan, paid out once" value={riel(loan.sim.years[0]?.drawnKhr ?? 0)} sub={`${monthLabel(loan.terms.startMonth)} · ${loan.terms.annualRatePct}% a year`} />
            <Tile label="Paid to the bank, year 1" value={riel(loan.payments.years[0]?.totalKhr ?? 0)} sub={`interest ${riel(loan.payments.years[0]?.interestKhr ?? 0)}`} />
            <Tile label="Feed from CC Livestock, year 1" value={riel(loan.sim.years[0]?.feedKhr ?? 0)} sub={`cattle ${riel(loan.sim.years[0]?.purchasesKhr ?? 0)}`} />
            <Tile label="Own money needed" value={loan.sim.moneyNeededKhr > 0 ? riel(loan.sim.moneyNeededKhr) : 'None'} tone={loan.sim.moneyNeededKhr > 0 ? 'bad' : 'good'} />
          </section>
          <p className="text-base text-ink-muted">
            {BUY_PLAN_LABEL[loan.assumptions.buyPlan ?? 'monthly']}. Repaid {loan.terms.repayments.map(x => `${x.pct}% in month ${x.month}`).join(', ')}{loan.terms.autoRenew ? '; renews in year 2' : ''}.{params.loan ? '' : ' Standard terms: change the plan to set the bank loan.'}
            {' '}This uses the loan and buying plan month by month, so its profit can differ from the steady-state numbers on the Overview.
          </p>
          <div role="tablist" aria-label="Bank loan details" className="flex rounded-xl bg-slate-100 p-1 sm:w-fit">
            {([['payments', 'Payments to the bank'], ['trades', 'Trades with CC Livestock']] as const).map(([k, label]) => (
              <button key={k} role="tab" type="button" aria-selected={loanView === k} onClick={() => setLoanView(k)}
                className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-4 text-base font-medium ${loanView === k ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
          {loanView === 'payments'
            ? <BankPaymentsTable payments={loan.payments} terms={loan.terms} intro="The loan is paid out once, in month 1 of each loan year, as one fund. The farm pays interest every month and pays the loan back in the repayment months (highlighted). Only the farm pays the bank." onDownload={() => exportBankPlan(name, loan.terms, loan.payments)} />
            : <CcTradesTable trades={loan.trades} farmName="the farm" onDownload={() => exportTrades(name, loan.terms.startMonth, loan.trades)} />}
        </div>
      )}

      {tab === 'months' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <h3 className="mb-2 text-lg font-semibold text-ink">Sales and costs, first 12 months</h3>
            <div className="h-72" role="img" aria-label="Sales and costs for each of the first 12 months; the same numbers are listed below">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                  <YAxis width={56} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={mil} />
                  <Tooltip formatter={(v, name) => [riel(Number(v)), String(name)]} />
                  <Legend wrapperStyle={{ fontSize: 14 }} />
                  <Bar dataKey="Sales" fill={SALES} radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={false} />
                  <Bar dataKey="Costs" fill={COSTS} radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {r.months.map(m => (
              <li key={m.month} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-lg font-semibold text-ink">Month {m.month}</p>
                  <p className={`text-lg font-semibold ${m.netProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{m.netProfitKhr < 0 ? 'Loss' : 'Profit'} {riel(Math.abs(m.netProfitKhr))}</p>
                </div>
                <p className="text-base text-ink-muted">{m.closingStock} on the farm · {m.purchaseQty} bought · {m.salesQty} sold</p>
                <p className="mt-1 text-base text-ink">Sales {riel(m.revenueKhr)} · Costs {riel(m.totalCostKhr)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'batches' && (
        r.batches.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">Set the number of batches under The plan.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {r.batches.map(b => (
              <li key={b.no} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xl font-semibold text-ink">Batch {b.no}</p>
                  <p className={`text-lg font-semibold ${b.netProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{b.netProfitKhr < 0 ? 'Loss' : 'Profit'} {riel(Math.abs(b.netProfitKhr))}</p>
                </div>
                <p className="text-base text-ink-muted">{b.cattleCount} cattle · bought month {b.purchaseMonth} · sold month {b.saleMonth}</p>
                <p className="mt-1 text-base text-ink">Costs {riel(b.totalCostKhr)} · Sales {riel(b.revenueKhr)}</p>
                <p className="text-base text-ink-muted">Needs {b.feedKg.map(f => `${f.kg.toLocaleString()} kg ${f.name}`).join(', ')}</p>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'feed' && (
        <FeedNeedsTable
          lines={loan.assumptions.feedLines ?? []}
          months={loan.sim.months}
          onDownload={() => exportFeedNeeds(name, loan.terms.startMonth, loan.assumptions.feedLines ?? [], loan.sim.months)}
        />
      )}

      {tab === 'numbers' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-ink">Feed, each animal a day</h3>
            <Rows
              rows={r.feed.map(f => [f.name, `${f.kgPerHeadDay.toLocaleString()} kg × ${riel(f.pricePerKgKhr)} = ${riel(f.kgPerHeadDay * f.pricePerKgKhr)}`] as [string, string])}
              total={['Feed a day', riel(r.dailyFeedPerHeadKhr)]}
            />
          </section>
          {GROUPS.map(g => (
            <section key={g.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-ink">{g.title}</h3>
              <Rows rows={g.fields.map(f => [f.label, `${params[f.key].toLocaleString()} ${f.unit}`] as [string, string])} />
            </section>
          ))}
        </div>
      )}

      <PlanFlow isOpen={editing} onClose={() => setEditing(false)} slot={slot} name={name} params={params} products={products} onSave={save} />
    </div>
  );
}
