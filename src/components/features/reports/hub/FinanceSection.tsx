'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthLabel } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { Fold, Tile } from '../parts';
import type { ReportData } from './useReportData';

const riel = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('en-US')} ៛`;
const million = (v: number) => (v === 0 ? '0' : `${Math.round(v / 1_000_000)}M`);

/**
 * The ARDB financing and cash position groups of the control dashboard, from the farms' money statements: what the plan says
 * each farm owes the bank, and the cash record of trading with CC Livestock. A record only; the accountant moves the money.
 */
export default function FinanceSection({ r, own = false }: { r: ReportData; own?: boolean }) {
  const { tx, language } = useText('reportsPage');
  const ops = useText('opsTasks');
  const { finance } = r;
  if (!finance || r.ledgers.length === 0) return <p className="rounded-xl bg-slate-50 p-5 text-base text-ink-muted">{tx('finNone')}</p>;
  const { loan, cash } = finance;
  const now = cash.thisMonth;
  const net = now?.net ?? 0;

  return (
    <>
      <div>
        <h3 className="mb-2 text-lg font-semibold text-ink">{tx('finLoanTitle')}</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={tx('finDrawn')} value={riel(loan.drawn)} sub={tx(own ? 'finDrawnSubOwn' : 'finDrawnSub')} />
          <Tile label={tx('finOutstanding')} value={riel(loan.outstanding)} sub={tx('finOutstandingSub')} />
          <Tile label={tx('finInterestMonth')} value={riel(loan.interestMonthly)} sub={tx('finInterestToDate', { amount: riel(loan.interestToDate) })} />
          <Tile label={tx('finPrincipalNext')} value={riel(loan.principalNext90)} sub={tx('finPrincipalLeft', { amount: riel(loan.principalRemaining) })} tone={loan.principalNext90 > 0 ? 'warn' : undefined} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-semibold text-ink">{tx('finCashTitle')}</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={ops.tx('colBought')} value={riel(now?.bought ?? 0)} sub={tx('finThisMonth', { month: monthLabel(r.month, language) })} />
          <Tile label={ops.tx('colSold')} value={riel(now?.sold ?? 0)} />
          <Tile label={ops.tx('colNet')} value={net === 0 ? '—' : riel(net)} sub={net === 0 ? undefined : net > 0 ? ops.tx(own ? 'netPaysAllOwn' : 'netPaysAll', { amount: '' }).trim() : ops.tx(own ? 'netReceivesAllOwn' : 'netReceivesAll', { amount: '' }).trim()} tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined} />
          <Tile label={ops.tx(own ? 'colBankOwn' : 'colBank')} value={riel((now?.interest ?? 0) + (now?.principal ?? 0))} sub={ops.tx('bankSub', { interest: riel(now?.interest ?? 0), principal: riel(now?.principal ?? 0) })} />
        </div>
      </div>

      <figure className="rounded-xl p-4 ring-1 ring-slate-200">
        <figcaption className="mb-2 text-lg font-semibold text-ink">{tx('finChart')}</figcaption>
        <div className="h-60" role="img" aria-label={tx('finChart')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cash.months.map(m => ({ name: monthLabel(m.month, language), bought: m.bought, sold: m.sold }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={million} tick={{ fontSize: 12 }} width={60} />
              <Tooltip formatter={(v) => riel(Number(v))} />
              <Legend />
              <Bar dataKey="bought" name={ops.tx('colBought')} fill="#B32C33" radius={[4, 4, 0, 0]} barSize={14} isAnimationActive={false} />
              <Bar dataKey="sold" name={ops.tx('colSold')} fill="#138E46" radius={[4, 4, 0, 0]} barSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <Fold title={tx('finByFarm')} headline={tx('finByFarmHeadline', { n: loan.farms.length })} defaultOpen>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-base">
            <thead className="text-ink-muted"><tr>
              <th className="px-2 py-2 font-medium">{ops.tx('colFarm')}</th>
              <th className="px-2 py-2 text-right font-medium">{tx('finDrawn')}</th>
              <th className="px-2 py-2 text-right font-medium">{tx('finOutstanding')}</th>
              <th className="px-2 py-2 text-right font-medium">{ops.tx('colInterest')}</th>
              <th className="px-2 py-2 text-right font-medium">{tx('finInterestDue')}</th>
              <th className="px-2 py-2 font-medium">{tx('finRepays')}</th>
            </tr></thead>
            <tbody>
              {loan.farms.map(f => (
                <tr key={f.farm} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium text-ink">{f.farm}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{f.drawn ? riel(f.drawn) : '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{f.outstanding ? riel(f.outstanding) : '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{riel(f.interestMonthly)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{f.interestToDate ? riel(f.interestToDate) : '—'}</td>
                  <td className="px-2 py-2">{f.principalMonth ? monthLabel(f.principalMonth, language) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Fold>

      <Fold title={tx('finMonths')} headline={tx('finMonthsHeadline')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-base">
            <thead className="text-ink-muted"><tr>
              <th className="px-2 py-2 font-medium">{ops.tx('colMonth')}</th>
              <th className="px-2 py-2 text-right font-medium">{ops.tx('colBought')}</th><th className="px-2 py-2 text-right font-medium">{ops.tx('colSold')}</th>
              <th className="px-2 py-2 text-right font-medium">{ops.tx('colNet')}</th><th className="px-2 py-2 text-right font-medium">{tx('finBankPay')}</th>
            </tr></thead>
            <tbody>
              {cash.months.map(m => (
                <tr key={m.month} className={`border-t border-slate-100 ${m.month === finance.month ? 'bg-emerald-50' : ''}`}>
                  <td className="px-2 py-2 text-ink">{monthLabel(m.month, language)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{riel(m.bought)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{riel(m.sold)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${m.net > 0 ? 'text-emerald-800' : m.net < 0 ? 'text-rose-800' : ''}`}>{m.net === 0 ? '—' : `${m.net > 0 ? '+' : '−'}${riel(m.net)}`}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{riel(m.interest + m.principal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Fold>
      <p className="text-sm text-ink-muted">{tx('finNote')}</p>
    </>
  );
}
