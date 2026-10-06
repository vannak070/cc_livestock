'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CcTradeRow, LoanMonth, bankSchedule, ccTrades } from '@/lib/farm-loan';
import type { FarmLoanTerms, PlanFeedLine } from '@/lib/types';
import * as xlsx from 'xlsx';
import { feedNeeds } from '@/lib/feed-lines';
import { exportToExcel } from '@/lib/excel-export';
import { useText } from '@/hooks/useText';
import { monthLabel as shownMonth } from '@/lib/khmer-date';

/**
 * The tables a fattening plan's bank loan shows, used by the fattening
 * plans: payments to the bank month by month (all paid by the farm), and the
 * cattle and feed traded with CC Livestock, as separate payments.
 */

type Payments = ReturnType<typeof bankSchedule>;
type Trades = ReturnType<typeof ccTrades>;

export const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** English month names, for the Excel files (which stay in English). */
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const fileSafe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_');

/** The loan's terms as label / value rows, for the top of the bank plan. */
function termRows(name: string, terms: FarmLoanTerms, payments: Payments): [string, string | number][] {
  const payout = payments.rows[0]?.drawKhr ?? 0;
  return [
    ['Plan', name],
    ['Bank', terms.bank || 'Not set'],
    ['Month 1 of the loan', monthLabel(terms.startMonth)],
    ['Paid out (month 1 of each loan year)', payout],
    ['Interest', `${terms.annualRatePct}% a year, paid every month on what is owed`],
    ['Paid back', terms.repayments.map(r => `${r.pct}% in month ${r.month}`).join(', ')],
    ['Renews each year', terms.autoRenew ? 'Yes' : 'No'],
    ['Credit limit', terms.creditLimitKhr > 0 ? terms.creditLimitKhr : 'No limit set'],
    ['Interest over the plan', payments.total.interestKhr],
    ['Paid to the bank over the plan', payments.total.totalKhr],
    ['Who pays the bank', 'The farm (CC Livestock does not repay the bank)'],
  ];
}

/** Excel for the bank: the loan terms on one sheet, every month's payment on the next. */
export function exportBankPlan(name: string, terms: FarmLoanTerms, payments: Payments) {
  const header = ['Month', 'Owed at start (៛)', 'Borrowed (៛)', 'Interest (៛)', 'Paid back (៛)', 'Farm pays the bank (៛)', 'Owed at end (៛)', 'Farm cash after (៛)'];
  const rows: (string | number)[][] = [
    header,
    ...payments.rows.map(r => [`${monthLabel(r.month)} (year ${r.year}, month ${r.monthInYear})`, r.openingKhr, r.drawKhr, r.interestKhr, r.principalKhr, r.totalKhr, r.closingKhr, r.cashAfterKhr]),
    [],
    ...payments.years.map(y => [`Year ${y.year} total`, '', y.drawKhr, y.interestKhr, y.principalKhr, y.totalKhr, '', '']),
    ['Whole plan', '', payments.total.drawKhr, payments.total.interestKhr, payments.total.principalKhr, payments.total.totalKhr, '', ''],
  ];
  const termsSheet = xlsx.utils.aoa_to_sheet([['Bank loan', ''], ...termRows(name, terms, payments)]);
  termsSheet['!cols'] = [{ wch: 38 }, { wch: 60 }];
  const paymentSheet = xlsx.utils.aoa_to_sheet(rows);
  paymentSheet['!cols'] = header.map((h, i) => ({ wch: i === 0 ? 30 : Math.max(16, h.length + 2) }));
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, termsSheet, 'Loan terms');
  xlsx.utils.book_append_sheet(book, paymentSheet, 'Bank payments');
  xlsx.writeFile(book, `CC_Livestock_Bank_Payment_Plan_${fileSafe(name)}_${terms.startMonth}.xlsx`);
}

export function exportTrades(name: string, startMonth: string, trades: Trades) {
  exportToExcel<Record<string, unknown>>({
    filename: `CC_Livestock_Cattle_Trades_${fileSafe(name)}_${startMonth}.xlsx`,
    sheetName: 'Trades with CC Livestock',
    data: [
      ...trades.rows.map(r => ({ ...r, label: `${monthLabel(r.month)} (year ${r.year}, month ${r.monthInYear})` })),
      ...trades.years.map(y => ({ ...y, label: `Year ${y.year} total` })),
    ],
    columns: [
      { header: 'Month', key: 'label' },
      { header: 'Cattle sold to CC Livestock', key: 'headSold' },
      { header: 'CC Livestock pays the farm (៛)', key: 'saleKhr' },
      { header: 'New cattle from CC Livestock', key: 'headBought' },
      { header: 'Farm pays CC Livestock for cattle (៛)', key: 'purchaseKhr' },
      { header: 'Farm pays CC Livestock for feed (៛)', key: 'feedKhr' },
    ],
  });
}

/** Payments to the bank, every month of the plan: the big payments first, then each month, with the year and plan totals. */
export function BankPaymentsTable({ payments, terms, intro, onDownload }: { payments: Payments; terms: Pick<FarmLoanTerms, 'repayments'>; intro: string; onDownload: () => void }) {
  const { tx, language } = useText('planning');
  const month = (ym: string) => shownMonth(ym, language);
  const big = payments.rows.filter(r => r.drawKhr > 0 || r.principalKhr > 0);
  const interestOnly = payments.rows.filter(r => r.principalKhr === 0 && r.interestKhr > 0).map(r => r.interestKhr);
  const share = (monthInYear: number) => terms.repayments.find(x => x.month === monthInYear)?.pct;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-base text-ink-muted">{intro}</p>
        <Button variant="outline" onClick={onDownload}><Download /> {tx('downloadExcel')}</Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">{tx('bigPayments')}</h3>
        {interestOnly.length > 0 && (
          <p className="mb-2 text-base text-ink-muted">
            {tx('interestOnly', { amount: Math.min(...interestOnly) !== Math.max(...interestOnly) ? tx('interestRange', { from: riel(Math.min(...interestOnly)), to: riel(Math.max(...interestOnly)) }) : riel(Math.min(...interestOnly)) })}
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {big.map(r => {
            const short = r.principalKhr > 0 && r.cashAfterKhr < 0;
            const pct = share(r.monthInYear);
            return (
              <li key={r.index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <span className="text-base text-ink">
                  <span className="font-semibold">{month(r.month)}</span>
                  <span className="text-ink-muted"> · {tx('yearMonth', { y: r.year, m: r.monthInYear })}</span>
                  <span className="block text-sm text-ink-muted">
                    {[r.drawKhr > 0 ? tx('bankPaysOut', { amount: riel(r.drawKhr) }) : null, r.principalKhr > 0 ? tx('farmPaysBack', { share: pct ? tx('sharePct', { n: pct }) : '', amount: riel(r.principalKhr), interest: riel(r.interestKhr) }) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-right">
                  {r.principalKhr > 0 ? (
                    <>
                      <span className="text-base font-semibold text-ink">{riel(r.totalKhr)}</span>
                      <span className={`ml-3 rounded-full px-2.5 py-0.5 text-sm font-medium ${short ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{short ? tx('short', { amount: riel(-r.cashAfterKhr) }) : tx('covered')}</span>
                    </>
                  ) : <span className="text-base font-semibold text-emerald-800">+{riel(r.drawKhr)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-ink-muted">{tx('coveredNote')}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[60rem] text-right text-base">
          <thead className="bg-slate-50 text-sm text-ink-muted">
            <tr>
              <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">{tx('colMonth')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colOwedStart')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colBorrowed')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colInterest')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colPaidBack')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colFarmPays')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colOwedEnd')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colCashAfter')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.rows.map(r => (
              <tr key={r.index} className={`border-t ${r.monthInYear === 1 && r.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'} ${r.principalKhr > 0 ? 'bg-amber-50' : ''}`}>
                <th scope="row" className={`sticky left-0 px-3 py-2 text-left font-medium text-ink ${r.principalKhr > 0 ? 'bg-amber-50' : 'bg-white'}`}>
                  {month(r.month)}
                  <span className="block text-sm font-normal text-ink-muted">{tx('yShort', { y: r.year, m: r.monthInYear })}</span>
                </th>
                <td className="px-3 py-2 text-ink">{riel(r.openingKhr)}</td>
                <td className="px-3 py-2 text-ink">{r.drawKhr ? riel(r.drawKhr) : '—'}</td>
                <td className="px-3 py-2 text-ink">{r.interestKhr ? riel(r.interestKhr) : '—'}</td>
                <td className="px-3 py-2 font-medium text-ink">{r.principalKhr ? riel(r.principalKhr) : '—'}</td>
                <td className="px-3 py-2 font-semibold text-ink">{r.totalKhr ? riel(r.totalKhr) : '—'}</td>
                <td className="px-3 py-2 text-ink">{riel(r.closingKhr)}</td>
                <td className={`px-3 py-2 font-medium ${r.cashAfterKhr < 0 ? 'bg-rose-50 text-rose-700' : 'text-emerald-800'}`}>{riel(r.cashAfterKhr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 text-ink">
            {payments.years.map(y => (
              <tr key={y.year} className="border-t border-slate-200">
                <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold">{tx('yearN', { n: y.year })}</th>
                <td className="px-3 py-2" />
                <td className="px-3 py-2">{riel(y.drawKhr)}</td>
                <td className="px-3 py-2">{riel(y.interestKhr)}</td>
                <td className="px-3 py-2">{riel(y.principalKhr)}</td>
                <td className="px-3 py-2 font-semibold">{riel(y.totalKhr)}</td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
            ))}
            {payments.years.length > 1 && (
              <tr className="border-t-2 border-slate-300">
                <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold">{tx('wholePlan')}</th>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 font-semibold">{riel(payments.total.drawKhr)}</td>
                <td className="px-3 py-2 font-semibold">{riel(payments.total.interestKhr)}</td>
                <td className="px-3 py-2 font-semibold">{riel(payments.total.principalKhr)}</td>
                <td className="px-3 py-2 font-semibold">{riel(payments.total.totalKhr)}</td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function TradeCells({ r }: { r: Pick<CcTradeRow, 'headSold' | 'saleKhr' | 'headBought' | 'purchaseKhr' | 'feedKhr'> & { sameDayHead?: number } }) {
  const { tx } = useText('planning');
  const sameDay = r.sameDayHead ?? 0;
  return (
    <>
      <td className="px-3 py-2 text-ink">{r.headSold ? <>{riel(r.saleKhr)}<span className="block text-sm text-ink-muted">{tx('headN', { n: r.headSold.toLocaleString() })}</span></> : '—'}</td>
      <td className="px-3 py-2 text-ink">{r.headBought ? <>{riel(r.purchaseKhr)}<span className="block text-sm text-ink-muted">{tx('headN', { n: r.headBought.toLocaleString() })}{sameDay > 0 ? (sameDay === r.headBought ? tx('sameDayAll') : tx('sameDaySome', { n: sameDay.toLocaleString() })) : ''}</span></> : '—'}</td>
      <td className="px-3 py-2 text-ink">{r.feedKhr ? riel(r.feedKhr) : '—'}</td>
    </>
  );
}

/** The cattle and feed traded with CC Livestock: what it pays the farm for cattle, and what the farm pays it for new cattle and feed. */
export function CcTradesTable({ trades, onDownload }: { trades: Trades; onDownload: () => void }) {
  const { tx, language } = useText('planning');
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-base text-ink-muted">{tx('tradesIntro')}</p>
        <Button variant="outline" onClick={onDownload}><Download /> {tx('downloadExcel')}</Button>
      </div>
      {trades.rows.length === 0 ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('noTrades')}</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[42rem] text-right text-base">
            <thead className="bg-slate-50 text-sm text-ink-muted">
              <tr>
                <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">{tx('colMonth')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tx('colSold')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tx('colNewCattle')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{tx('colFeed')}</th>
              </tr>
            </thead>
            <tbody>
              {trades.rows.map(r => (
                <tr key={r.index} className={`border-t ${r.monthInYear === 1 && r.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'}`}>
                  <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-ink">
                    {shownMonth(r.month, language)}
                    <span className="block text-sm font-normal text-ink-muted">{tx('yShort', { y: r.year, m: r.monthInYear })}{r.swap ? tx('sellRestock') : ''}</span>
                  </th>
                  <TradeCells r={r} />
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              {trades.years.map(y => (
                <tr key={y.year} className="border-t border-slate-200 font-semibold">
                  <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left">{tx('yearN', { n: y.year })}</th>
                  <TradeCells r={y} />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

const kgLabel = (kg: number) => (kg >= 1000 ? `${(Math.round(kg / 100) / 10).toLocaleString()} t` : `${Math.round(kg).toLocaleString()} kg`);

/**
 * The feed a plan needs, worked out from its herd month by month: each feed's
 * kg and cost for each year, then for each month, to know what to order from
 * CC Livestock. Nothing to type.
 */
export function FeedNeedsTable({ lines, months, onDownload }: {
  lines: PlanFeedLine[];
  months: Pick<LoanMonth, 'index' | 'month' | 'year' | 'monthInYear' | 'headDays'>[];
  onDownload?: () => void;
}) {
  const { tx, language } = useText('planning');
  const perMonth = months.map(m => ({ m, head: Math.round(m.headDays / 30), needs: feedNeeds(lines, m.headDays) }));
  const years = [...new Set(months.map(m => m.year))].map(year => {
    const headDays = months.filter(m => m.year === year).reduce((s, m) => s + m.headDays, 0);
    return { year, needs: feedNeeds(lines, headDays) };
  });
  const total = (needs: { costKhr: number }[]) => needs.reduce((s, n) => s + n.costKhr, 0);
  if (lines.length === 0) return <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{tx('noFeed')}</p>;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-base text-ink-muted">{tx('feedIntro')}</p>
        {onDownload && <Button variant="outline" onClick={onDownload}><Download /> {tx('downloadExcel')}</Button>}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {years.map(y => (
          <li key={y.year} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-lg font-semibold text-ink">{tx('yearN', { n: y.year })}</p>
            <dl className="mt-1">
              {y.needs.map(n => (
                <div key={n.name} className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <dt className="text-base text-ink-muted">{n.name}</dt>
                  <dd className="text-right text-base font-medium text-ink">{kgLabel(n.kg)} · {riel(n.costKhr)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="text-lg font-medium text-ink">{tx('allFeed')}</dt>
                <dd className="text-lg font-semibold text-emerald-800">{riel(total(y.needs))}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[40rem] text-right text-base">
          <thead className="bg-slate-50 text-sm text-ink-muted">
            <tr>
              <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">{tx('colMonth')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{tx('colCattle')}</th>
              {lines.map(l => <th key={l.name} scope="col" className="px-3 py-2 font-medium">{l.name}</th>)}
              <th scope="col" className="px-3 py-2 font-medium">{tx('allFeed')}</th>
            </tr>
          </thead>
          <tbody>
            {perMonth.map(({ m, head, needs }) => (
              <tr key={m.index} className={`border-t ${m.monthInYear === 1 && m.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'}`}>
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-ink">
                  {shownMonth(m.month, language)}
                  <span className="block text-sm font-normal text-ink-muted">{tx('yShort', { y: m.year, m: m.monthInYear })}</span>
                </th>
                <td className="px-3 py-2 text-ink">{head.toLocaleString()}</td>
                {needs.map(n => <td key={n.name} className="px-3 py-2 text-ink">{kgLabel(n.kg)}<span className="block text-sm text-ink-muted">{riel(n.costKhr)}</span></td>)}
                <td className="px-3 py-2 font-semibold text-ink">{riel(total(needs))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function exportFeedNeeds(name: string, startMonth: string, lines: PlanFeedLine[], months: Pick<LoanMonth, 'month' | 'year' | 'monthInYear' | 'headDays'>[]) {
  const rows = months.map(m => {
    const needs = feedNeeds(lines, m.headDays);
    return {
      label: `${monthLabel(m.month)} (year ${m.year}, month ${m.monthInYear})`,
      head: Math.round(m.headDays / 30),
      ...Object.fromEntries(needs.flatMap((n, i) => [[`kg${i}`, n.kg], [`khr${i}`, n.costKhr]])),
      total: needs.reduce((s, n) => s + n.costKhr, 0),
    };
  });
  exportToExcel<Record<string, unknown>>({
    filename: `CC_Livestock_Feed_Needs_${fileSafe(name)}_${startMonth}.xlsx`,
    sheetName: 'Feed the plan needs',
    data: rows,
    columns: [
      { header: 'Month', key: 'label' },
      { header: 'Cattle', key: 'head' },
      ...lines.flatMap((l, i) => [{ header: `${l.name} (kg)`, key: `kg${i}` }, { header: `${l.name} (៛)`, key: `khr${i}` }]),
      { header: 'All feed (៛)', key: 'total' },
    ],
  });
}
