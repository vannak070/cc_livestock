'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, FarmItem, FarmLoanAssumptions, FarmLoanRecord, FarmLoanTerms } from '@/lib/types';
import { DEFAULT_ASSUMPTIONS, bankSchedule, ccTrades, defaultTerms, fatteningMonthsFor, simulateLoan } from '@/lib/farm-loan';
import { farmToday } from '@/lib/daily-feed';
import { feedNeeds, feedPerHeadDay } from '@/lib/feed-lines';
import { getErrorMessage } from '@/lib/utils';
import FarmLoanFlow from './FarmLoanFlow';
import { BUY_PLAN_LABEL, buyingSentence } from './LoanParts';
import { BankPaymentsTable, CcTradesTable, exportBankPlan, exportTrades, monthLabel, riel } from './LoanTables';

interface FarmLoanEditorProps {
  farm: FarmItem;
  loan?: FarmLoanRecord;
  data: ERPLivestockData;
  /** Back to the list of farms; not given when a Farm Owner sees only their own loan. */
  onBack?: () => void;
  /** Read only (a Farm Owner looking at their farm's loan): no change or remove buttons. */
  readOnly?: boolean;
  onSave: (terms: FarmLoanTerms, assumptions: FarmLoanAssumptions, notes: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

type Tab = 'payments' | 'trades' | 'months' | 'numbers';

const mil = (n: number) => (n === 0 ? '0' : `${n < 0 ? '−' : ''}${(Math.round(Math.abs(n) / 100_000) / 10).toLocaleString()}M`);

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-base text-ink-muted">{label}</dt>
      <dd className="text-right text-base font-medium text-ink">{value}</dd>
    </div>
  );
}

/**
 * One farm's loan plan, read first: what it borrows, what it pays the bank and
 * when, and whether it can pay. Changing the plan is a guided dialog
 * (FarmLoanFlow); a Farm Owner sees their own farm's plan read only.
 */
/** What the one payout pays for. */
function fundSentence(terms: FarmLoanTerms, y: { drawnKhr: number; startCattleKhr: number; feedKhr: number; interestKhr: number }): string {
  if (terms.loanAmountKhr) return `The farm uses this fund to buy its cattle from CC Livestock (${riel(y.startCattleKhr)} before the first sale), and for feed and interest.`;
  if (terms.loanCovers === 'all') return `The fund covers the cattle bought before the first sale (${riel(y.startCattleKhr)}), a year of feed (${riel(y.feedKhr)}) and a year of interest (${riel(y.interestKhr)}). After the first sale, new cattle are paid from the sales.`;
  return `The fund covers the cattle bought before the first sale (${riel(y.startCattleKhr)}). Feed and interest are paid from the farm's own money and its sales.`;
}

export default function FarmLoanEditor({ farm, loan, data, onBack, readOnly = false, onSave, onDelete }: FarmLoanEditorProps) {
  const terms = useMemo(() => loan?.terms ?? defaultTerms(), [loan]);
  const assumptions = useMemo(() => loan?.assumptions ?? { ...DEFAULT_ASSUMPTIONS, herdTarget: farm.capacity || DEFAULT_ASSUMPTIONS.herdTarget }, [loan, farm.capacity]);
  const plan = useMemo(() => simulateLoan(terms, assumptions), [terms, assumptions]);
  const payments = useMemo(() => bankSchedule(plan), [plan]);
  const trades = useMemo(() => ccTrades(plan), [plan]);
  const [tab, setTab] = useState<Tab>('payments');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const bankName = terms.bank || 'the bank';
  const y1 = plan.years[0];
  const y2 = plan.years[1];
  const y1Pay = payments.years[0];
  const thisMonth = farmToday().slice(0, 7);
  // The bigger payments (principal months), from this month on; all of them for a plan that has not started.
  const bigPayments = payments.rows.filter(r => r.principalKhr > 0);
  const upcoming = bigPayments.filter(r => r.month >= thisMonth);
  const shown = (upcoming.length ? upcoming : bigPayments).slice(0, 3);
  const interestOnly = payments.rows.filter(r => r.principalKhr === 0 && r.interestKhr > 0).map(r => r.interestKhr);
  const m12 = plan.months.find(m => m.monthInYear === 12);
  const boughtY1 = plan.months.filter(m => m.year === 1).reduce((s, m) => s + m.headBought, 0);
  // Feed by kind (older plans have only one feed total).
  const feedLines = assumptions.feedLines ?? [];
  const perCow = feedPerHeadDay(feedLines);
  const tonnes = (kg: number) => (kg >= 1000 ? `${(Math.round(kg / 100) / 10).toLocaleString()} t` : `${kg.toLocaleString()} kg`);

  const save = async (t: FarmLoanTerms, a: FarmLoanAssumptions, n: string) => {
    await onSave(t, a, n);
    setStatus({ ok: true, text: `Loan plan saved at ${new Date().toLocaleTimeString()}.` });
  };

  const tabs: [Tab, string][] = [['payments', 'Payments to the bank'], ['trades', 'Trades with CC Livestock'], ['months', 'Month by month'], ['numbers', 'The numbers']];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {onBack && <Button variant="ghost" onClick={onBack} className="-ml-3"><ArrowLeft /> All farm loans</Button>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base text-ink-muted">{readOnly ? 'Your farm’s loan plan' : loan ? 'Loan plan' : 'Loan plan (not saved yet, standard numbers)'}</p>
          <h2 className="text-2xl font-semibold text-ink">{farm.name}</h2>
          {loan && <p className="text-sm text-ink-muted">Saved {loan.updatedAt.slice(0, 10)}{loan.updatedBy ? ` by ${loan.updatedBy}` : ''}</p>}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {loan && <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 className="text-rose-700" /> Remove</Button>}
            <Button size="lg" onClick={() => setEditing(true)}><Pencil /> {loan ? 'Change the plan' : 'Set up the loan'}</Button>
          </div>
        )}
      </div>
      {status && <p role={status.ok ? 'status' : 'alert'} className={`text-base font-medium ${status.ok ? 'text-emerald-800' : 'text-rose-700'}`}>{status.text}</p>}
      {readOnly && !loan && <p className="rounded-2xl bg-slate-50 p-4 text-base text-ink">CC Livestock has not set up a loan plan for your farm yet. This shows the standard numbers as an example.</p>}

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-lg text-ink">
        <h3 className="text-lg font-semibold">In short</h3>
        <p>{bankName.charAt(0).toUpperCase() + bankName.slice(1)} pays {farm.name} <span className="font-semibold">{riel(y1?.drawnKhr ?? 0)}</span> once, in {monthLabel(terms.startMonth)}, at {terms.annualRatePct}% a year. {buyingSentence(assumptions, boughtY1)}</p>
        {y1 && <p>{fundSentence(terms, y1)}</p>}
        <p>{farm.name} pays the bank itself: <span className="font-semibold">{riel(y1Pay?.totalKhr ?? 0)}</span> in year 1, {riel(y1Pay?.interestKhr ?? 0)} interest over the year (paid every month) and {riel(y1Pay?.principalKhr ?? 0)} back in the repayment months. CC Livestock does not repay the bank.</p>
        {m12 && m12.buybackKhr > 0 && m12.headEnd === 0 && <p>In {monthLabel(m12.month)} CC Livestock buys the last {m12.headSold.toLocaleString()} cattle for {riel(m12.buybackKhr)}.</p>}
        <p>Each cow eats {feedLines.length ? <>{feedLines.map(l => `${l.kgPerHeadDay} kg ${l.name}`).join(', ')}: </> : null}<span className="font-semibold">{riel(assumptions.feedCostPerHeadDayKhr)}</span> of feed a day, bought from CC Livestock.</p>
        <p className={plan.moneyNeededKhr > 0 ? 'font-medium text-rose-700' : 'font-medium text-emerald-800'}>
          {plan.moneyNeededKhr > 0
            ? `The farm needs ${riel(plan.moneyNeededKhr)} of its own money on top (lowest in ${plan.lowestCashMonth ? monthLabel(plan.lowestCashMonth) : 'the plan'}).`
            : 'The farm can pay every month from its sales.'}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label="Own money needed" value={plan.moneyNeededKhr > 0 ? riel(plan.moneyNeededKhr) : 'None'} tone={plan.moneyNeededKhr > 0 ? 'bad' : 'good'} />
        <Tile label="Paid to the bank, year 1" value={riel(y1Pay?.totalKhr ?? 0)} sub={`interest ${riel(y1Pay?.interestKhr ?? 0)}`} />
        <Tile label="Profit, year 1" value={riel(y1?.profitKhr ?? 0)} sub="sales less the cattle sold, feed and interest" tone={(y1?.profitKhr ?? 0) < 0 ? 'bad' : 'good'} />
        {y2
          ? <Tile label="Profit, year 2" value={riel(y2.profitKhr)} sub="the loan renews" tone={y2.profitKhr < 0 ? 'bad' : 'good'} />
          : <Tile label="Year 2" value="No renewal" sub="one year only" />}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">{upcoming.length ? 'Next big payments' : 'Big payments'}</h3>
        {shown.length === 0 ? <p className="text-base text-ink-muted">No repayments in this plan.</p> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {shown.map(r => {
              const short = (plan.months[r.index - 1]?.cashKhr ?? 0) < 0;
              return (
                <li key={r.index} className={`rounded-xl border-2 p-3 ${short ? 'border-rose-300' : 'border-slate-200'}`}>
                  <p className="text-base text-ink-muted">{monthLabel(r.month)} · year {r.year}, month {r.monthInYear}</p>
                  <p className="text-2xl font-semibold text-ink">{riel(r.totalKhr)}</p>
                  <p className="text-sm text-ink-muted">{riel(r.principalKhr)} back + {riel(r.interestKhr)} interest</p>
                  <p className="mt-1 text-base text-ink">Paid by the farm</p>
                  <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-medium ${short ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{short ? 'Farm will be short' : 'Covered'}</span>
                </li>
              );
            })}
          </ul>
        )}
        {interestOnly.length > 0 && <p className="text-base text-ink-muted">Other months: interest only, between {riel(Math.min(...interestOnly))} and {riel(Math.max(...interestOnly))}.</p>}
        {plan.endBalanceKhr > 0 && <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">The repayments do not add up to 100%, so {riel(plan.endBalanceKhr)} is still owed at the end.</p>}
      </section>

      <div role="tablist" aria-label="Loan details" className="flex flex-wrap rounded-xl bg-slate-100 p-1 sm:w-fit">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-4 text-base font-medium ${tab === k ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'payments' && (
        <BankPaymentsTable
          payments={payments}
          intro={`The loan is paid out once, in month 1 of each loan year, as one fund. ${farm.name} pays ${bankName} interest every month and pays the loan back in the repayment months (highlighted). Only ${farm.name} pays the bank.`}
          onDownload={() => exportBankPlan(farm.name, terms.startMonth, payments)}
        />
      )}

      {tab === 'trades' && <CcTradesTable trades={trades} farmName={farm.name} onDownload={() => exportTrades(farm.name, terms.startMonth, trades)} />}

      {tab === 'months' && (
        <section className="space-y-2">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[56rem] text-right text-base">
              <thead className="bg-slate-50 text-sm text-ink-muted">
                <tr>
                  <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Month</th>
                  <th scope="col" className="px-3 py-2 font-medium">Cattle</th>
                  <th scope="col" className="px-3 py-2 font-medium">Borrowed</th>
                  <th scope="col" className="px-3 py-2 font-medium">Cattle bought</th>
                  <th scope="col" className="px-3 py-2 font-medium">Feed</th>
                  <th scope="col" className="px-3 py-2 font-medium">Sales</th>
                  <th scope="col" className="px-3 py-2 font-medium">Interest</th>
                  <th scope="col" className="px-3 py-2 font-medium">Paid back</th>
                  <th scope="col" className="px-3 py-2 font-medium">Owed</th>
                  <th scope="col" className="px-3 py-2 font-medium">Farm cash</th>
                </tr>
              </thead>
              <tbody>
                {plan.months.map(m => (
                  <tr key={m.index} className={`border-t ${m.monthInYear === 1 && m.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'}`}>
                    <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-ink">
                      {monthLabel(m.month)}
                      <span className="block text-sm font-normal text-ink-muted">Y{m.year} · M{m.monthInYear}</span>
                    </th>
                    <td className="px-3 py-2 text-ink">{Math.round(m.headDays / 30)}<span className="block text-sm text-ink-muted">{m.headBought ? `+${m.headBought}` : ''}{m.headBought && m.headSold ? ' ' : ''}{m.headSold ? `−${m.headSold}` : ''}</span></td>
                    <td className="px-3 py-2 text-ink">{m.drawKhr ? mil(m.drawKhr) : '—'}</td>
                    <td className="px-3 py-2 text-ink">{m.purchaseKhr ? mil(m.purchaseKhr) : '—'}</td>
                    <td className="px-3 py-2 text-ink">{m.feedKhr ? mil(m.feedKhr) : '—'}</td>
                    <td className="px-3 py-2 text-ink">{m.salesKhr ? mil(m.salesKhr) : '—'}</td>
                    <td className="px-3 py-2 text-ink">{m.interestKhr ? mil(m.interestKhr) : '—'}</td>
                    <td className="px-3 py-2 font-medium text-ink">{m.principalKhr ? mil(m.principalKhr) : '—'}</td>
                    <td className="px-3 py-2 text-ink">{mil(m.balanceKhr)}</td>
                    <td className={`px-3 py-2 font-semibold ${m.cashKhr < 0 ? 'bg-rose-50 text-rose-700' : 'text-emerald-800'}`}>{mil(m.cashKhr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-muted">Amounts in millions of riel (M). Cattle are sold to CC Livestock at the end of the month their fattening ends, and the cattle that replace them are taken from CC Livestock the same day (on the farm from the next month). With the monthly trade the herd carries on into the next year; everything left is sold at the end of the plan. The renewed loan is paid out on renewal day, with the last repayment, and shows in month 1. Farm cash below 0 is money the farm must find elsewhere.</p>
        </section>
      )}

      {tab === 'numbers' && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-1 text-lg font-semibold text-ink">The loan</h3>
            <dl>
              <Row label="Bank" value={terms.bank || 'Not named'} />
              <Row label="Month 1 of the loan" value={monthLabel(terms.startMonth)} />
              <Row label="Interest" value={`${terms.annualRatePct}% a year (agreed with the bank)`} />
              <Row label="Loan, paid out once in month 1" value={terms.loanAmountKhr ? `${riel(terms.loanAmountKhr)} (agreed amount)` : `${riel(y1?.drawnKhr ?? 0)} (${terms.financedPct}% of ${terms.loanCovers === 'all' ? 'the cattle, a year of feed and interest' : 'the herd’s cattle'})`} />
              <Row label="Credit limit" value={terms.creditLimitKhr > 0 ? riel(terms.creditLimitKhr) : 'No limit'} />
              <Row label="Paying back" value={terms.repayments.map(r => `${r.pct}% in month ${r.month}`).join(', ')} />
              <Row label="Renews in year 2" value={terms.autoRenew ? 'Yes' : 'No'} />
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-1 text-lg font-semibold text-ink">The cattle and the farm</h3>
            <dl>
              <Row label="Cattle to keep" value={`${assumptions.herdTarget} head`} />
              <Row label="Bought at" value={`${assumptions.initialWeightKg} kg × ${riel(assumptions.buyPricePerKgKhr)} = ${riel(plan.buyPerHeadKhr)} each`} />
              <Row label="Fattening" value={`${assumptions.fatteningDays} days (${fatteningMonthsFor(assumptions.fatteningDays)} months), ${assumptions.dailyGainKg} kg a day`} />
              <Row label="Sold at" value={`${riel(assumptions.sellPricePerKgKhr)} a kg = ${riel(plan.sellPerHeadKhr)} each`} />
              {feedLines.length > 0
                ? feedLines.map(l => <Row key={l.name} label={`${l.name}, per cow a day`} value={`${l.kgPerHeadDay} kg × ${riel(l.pricePerKgKhr)} = ${riel(l.kgPerHeadDay * l.pricePerKgKhr)}`} />)
                : null}
              <Row label="Feed per cow a day (paid by the farm)" value={feedLines.length ? `${perCow.kg} kg · ${riel(perCow.costKhr)}` : riel(assumptions.feedCostPerHeadDayKhr)} />
              <Row label="How cattle are bought" value={BUY_PLAN_LABEL[assumptions.buyPlan ?? 'monthly'] + (assumptions.buyPlan === 'split' ? `: ${assumptions.firstBuyPct}% in month 1, the rest in month ${assumptions.secondBuyMonth}` : '')} />
              <Row label="Farm’s own money at the start" value={riel(assumptions.openingCashKhr)} />
              {loan?.notes && <Row label="Notes" value={loan.notes} />}
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
            <h3 className="mb-1 text-lg font-semibold text-ink">Feed the plan needs</h3>
            {feedLines.length === 0 ? (
              <p className="text-base text-ink-muted">This plan has one feed total. Change the plan and split it by feed to see how much of each to buy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-right text-base">
                  <thead className="text-sm text-ink-muted">
                    <tr>
                      <th scope="col" className="py-2 text-left font-medium">Feed</th>
                      {plan.years.map(y => <th key={y.year} scope="col" className="px-3 py-2 font-medium">Year {y.year}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {feedLines.map((l, i) => (
                      <tr key={l.name} className="border-t border-slate-100">
                        <th scope="row" className="py-2 text-left font-medium text-ink">{l.name}</th>
                        {plan.years.map(y => {
                          const need = feedNeeds(feedLines, y.headDays)[i];
                          return <td key={y.year} className="px-3 py-2 text-ink">{tonnes(need.kg)}<span className="block text-sm text-ink-muted">{riel(need.costKhr)}</span></td>;
                        })}
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 font-semibold">
                      <th scope="row" className="py-2 text-left text-ink">All feed</th>
                      {plan.years.map(y => <td key={y.year} className="px-3 py-2 text-ink">{riel(y.feedKhr)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {!readOnly && (
        <FarmLoanFlow
          isOpen={editing}
          onClose={() => setEditing(false)}
          farm={farm}
          terms={terms}
          assumptions={assumptions}
          notes={loan?.notes ?? ''}
          saved={!!loan}
          data={data}
          onSave={save}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try { await onDelete(); } catch (e) { setStatus({ ok: false, text: getErrorMessage(e, 'Could not remove the loan.') }); }
          }}
          title="Remove this loan plan?"
          description={`${farm.name}’s loan plan will be removed for everyone. This cannot be undone.`}
          type="danger"
          confirmText="Remove"
        />
      )}
    </div>
  );
}
