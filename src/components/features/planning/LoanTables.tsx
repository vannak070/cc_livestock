'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CcTradeRow, LoanMonth, bankSchedule, ccTrades } from '@/lib/farm-loan';
import type { PlanFeedLine } from '@/lib/types';
import { feedNeeds } from '@/lib/feed-lines';
import { exportToExcel } from '@/lib/excel-export';

/**
 * The two tables a loan plan shows, used by the farm loan and the fattening
 * plans: payments to the bank month by month (all paid by the farm), and the
 * cattle and feed traded with CC Livestock, as separate payments.
 */

type Payments = ReturnType<typeof bankSchedule>;
type Trades = ReturnType<typeof ccTrades>;

export const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const fileSafe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_');

export function exportBankPlan(name: string, startMonth: string, payments: Payments) {
  exportToExcel({
    filename: `CC_Livestock_Bank_Payment_Plan_${fileSafe(name)}_${startMonth}.xlsx`,
    sheetName: 'Bank payments',
    data: [
      ...payments.rows.map(r => ({ ...r, label: `${monthLabel(r.month)} (year ${r.year}, month ${r.monthInYear})` })),
      ...payments.years.map(y => ({ label: `Year ${y.year} total`, openingKhr: '', drawKhr: y.drawKhr, interestKhr: y.interestKhr, principalKhr: y.principalKhr, totalKhr: y.totalKhr, closingKhr: '' })),
    ],
    columns: [
      { header: 'Month', key: 'label' },
      { header: 'Owed at start (៛)', key: 'openingKhr' },
      { header: 'Drawn (៛)', key: 'drawKhr' },
      { header: 'Interest (៛)', key: 'interestKhr' },
      { header: 'Principal (៛)', key: 'principalKhr' },
      { header: 'Farm pays the bank (៛)', key: 'totalKhr' },
      { header: 'Owed at end (៛)', key: 'closingKhr' },
    ],
  });
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

/** Payments to the bank, every month of the plan, with the year totals. */
export function BankPaymentsTable({ payments, intro, onDownload }: { payments: Payments; intro: string; onDownload: () => void }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-base text-ink-muted">{intro}</p>
        <Button variant="outline" onClick={onDownload}><Download /> Download Excel</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[52rem] text-right text-base">
          <thead className="bg-slate-50 text-sm text-ink-muted">
            <tr>
              <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Month</th>
              <th scope="col" className="px-3 py-2 font-medium">Owed at start</th>
              <th scope="col" className="px-3 py-2 font-medium">Borrowed</th>
              <th scope="col" className="px-3 py-2 font-medium">Interest</th>
              <th scope="col" className="px-3 py-2 font-medium">Paid back</th>
              <th scope="col" className="px-3 py-2 font-medium">Farm pays the bank</th>
              <th scope="col" className="px-3 py-2 font-medium">Owed at end</th>
            </tr>
          </thead>
          <tbody>
            {payments.rows.map(r => (
              <tr key={r.index} className={`border-t ${r.monthInYear === 1 && r.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'} ${r.principalKhr > 0 ? 'bg-amber-50' : ''}`}>
                <th scope="row" className={`sticky left-0 px-3 py-2 text-left font-medium text-ink ${r.principalKhr > 0 ? 'bg-amber-50' : 'bg-white'}`}>
                  {monthLabel(r.month)}
                  <span className="block text-sm font-normal text-ink-muted">Y{r.year} · M{r.monthInYear}</span>
                </th>
                <td className="px-3 py-2 text-ink">{riel(r.openingKhr)}</td>
                <td className="px-3 py-2 text-ink">{r.drawKhr ? riel(r.drawKhr) : '—'}</td>
                <td className="px-3 py-2 text-ink">{r.interestKhr ? riel(r.interestKhr) : '—'}</td>
                <td className="px-3 py-2 font-medium text-ink">{r.principalKhr ? riel(r.principalKhr) : '—'}</td>
                <td className="px-3 py-2 font-semibold text-ink">{r.totalKhr ? riel(r.totalKhr) : '—'}</td>
                <td className="px-3 py-2 text-ink">{riel(r.closingKhr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 text-ink">
            {payments.years.map(y => (
              <tr key={y.year} className="border-t border-slate-200">
                <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold">Year {y.year}</th>
                <td className="px-3 py-2" />
                <td className="px-3 py-2">{riel(y.drawKhr)}</td>
                <td className="px-3 py-2">{riel(y.interestKhr)}</td>
                <td className="px-3 py-2">{riel(y.principalKhr)}</td>
                <td className="px-3 py-2 font-semibold">{riel(y.totalKhr)}</td>
                <td className="px-3 py-2" />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function TradeCells({ r }: { r: Pick<CcTradeRow, 'headSold' | 'saleKhr' | 'headBought' | 'purchaseKhr' | 'feedKhr'> & { sameDayHead?: number } }) {
  const sameDay = r.sameDayHead ?? 0;
  return (
    <>
      <td className="px-3 py-2 text-ink">{r.headSold ? <>{riel(r.saleKhr)}<span className="block text-sm text-ink-muted">{r.headSold.toLocaleString()} head</span></> : '—'}</td>
      <td className="px-3 py-2 text-ink">{r.headBought ? <>{riel(r.purchaseKhr)}<span className="block text-sm text-ink-muted">{r.headBought.toLocaleString()} head{sameDay > 0 ? (sameDay === r.headBought ? ', the same day as the sale' : `, ${sameDay.toLocaleString()} the same day as the sale`) : ''}</span></> : '—'}</td>
      <td className="px-3 py-2 text-ink">{r.feedKhr ? riel(r.feedKhr) : '—'}</td>
    </>
  );
}

/** The cattle and feed traded with CC Livestock: what it pays the farm for cattle, and what the farm pays it for new cattle and feed. */
export function CcTradesTable({ trades, farmName, onDownload }: { trades: Trades; farmName: string; onDownload: () => void }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-base text-ink-muted">
          {farmName.charAt(0).toUpperCase() + farmName.slice(1)} buys its cattle and feed from CC Livestock and sells its cattle back to CC Livestock. These are separate payments: CC Livestock pays {farmName} the full price of the cattle it buys, and {farmName} pays CC Livestock for new cattle and feed. CC Livestock does not pay the bank; {farmName} pays the bank itself.
        </p>
        <Button variant="outline" onClick={onDownload}><Download /> Download Excel</Button>
      </div>
      {trades.rows.length === 0 ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">No cattle are traded in this plan.</p> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[42rem] text-right text-base">
            <thead className="bg-slate-50 text-sm text-ink-muted">
              <tr>
                <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Month</th>
                <th scope="col" className="px-3 py-2 font-medium">Sold: CC Livestock pays the farm</th>
                <th scope="col" className="px-3 py-2 font-medium">New cattle: farm pays CC Livestock</th>
                <th scope="col" className="px-3 py-2 font-medium">Feed: farm pays CC Livestock</th>
              </tr>
            </thead>
            <tbody>
              {trades.rows.map(r => (
                <tr key={r.index} className={`border-t ${r.monthInYear === 1 && r.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'}`}>
                  <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-ink">
                    {monthLabel(r.month)}
                    <span className="block text-sm font-normal text-ink-muted">Y{r.year} · M{r.monthInYear}{r.swap ? ' · sell and restock' : ''}</span>
                  </th>
                  <TradeCells r={r} />
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              {trades.years.map(y => (
                <tr key={y.year} className="border-t border-slate-200 font-semibold">
                  <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left">Year {y.year}</th>
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
  const perMonth = months.map(m => ({ m, head: Math.round(m.headDays / 30), needs: feedNeeds(lines, m.headDays) }));
  const years = [...new Set(months.map(m => m.year))].map(year => {
    const headDays = months.filter(m => m.year === year).reduce((s, m) => s + m.headDays, 0);
    return { year, needs: feedNeeds(lines, headDays) };
  });
  const total = (needs: { costKhr: number }[]) => needs.reduce((s, n) => s + n.costKhr, 0);
  if (lines.length === 0) return <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">This plan has no feed yet. Change the plan to add each feed per cow a day.</p>;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-base text-ink-muted">Worked out from the plan: the cattle on the farm each month × what each cow eats a day × 30 days. This is the feed to order from CC Livestock.</p>
        {onDownload && <Button variant="outline" onClick={onDownload}><Download /> Download Excel</Button>}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {years.map(y => (
          <li key={y.year} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-lg font-semibold text-ink">Year {y.year}</p>
            <dl className="mt-1">
              {y.needs.map(n => (
                <div key={n.name} className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <dt className="text-base text-ink-muted">{n.name}</dt>
                  <dd className="text-right text-base font-medium text-ink">{kgLabel(n.kg)} · {riel(n.costKhr)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <dt className="text-lg font-medium text-ink">All feed</dt>
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
              <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Month</th>
              <th scope="col" className="px-3 py-2 font-medium">Cattle</th>
              {lines.map(l => <th key={l.name} scope="col" className="px-3 py-2 font-medium">{l.name}</th>)}
              <th scope="col" className="px-3 py-2 font-medium">All feed</th>
            </tr>
          </thead>
          <tbody>
            {perMonth.map(({ m, head, needs }) => (
              <tr key={m.index} className={`border-t ${m.monthInYear === 1 && m.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'}`}>
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-ink">
                  {monthLabel(m.month)}
                  <span className="block text-sm font-normal text-ink-muted">Y{m.year} · M{m.monthInYear}</span>
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
