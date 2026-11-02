'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/excel-export';
import { farmToday } from '@/lib/daily-feed';
import { monthLabel } from '@/lib/khmer-date';
import { shiftMonth } from '@/lib/ops-calendar';
import { companyLedger, farmLedger, type FarmLedger } from '@/lib/trade-ledger';
import type { Task } from '@/lib/ops-program';
import type { FarmProgram } from '@/repositories/ops-program.repository';
import type { SalesRecord, StockItem } from '@/lib/xlsx-parser';
import { useText } from '@/hooks/useText';
import { Fold } from '../reports/parts';

interface Props {
  programs: FarmProgram[];
  tasks: Task[];
  stock: StockItem[];
  sales: SalesRecord[];
}

const riel = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('en-US')}\u00a0៛`;

/**
 * The money record of trading with CC Livestock (src/lib/trade-ledger.ts): per farm and for the company, month by month.
 * Nothing is paid here; the money moves outside the system and the accountant works from this record.
 */
export default function OpsMoney({ programs, tasks, stock, sales }: Props) {
  const { tx, language } = useText('opsTasks');
  const today = farmToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [openFarm, setOpenFarm] = useState<string | null>(null);

  const ledgers = useMemo<FarmLedger[]>(
    () => programs.filter(p => p.status !== 'Closed').map(p => farmLedger({ ...p }, tasks, stock, sales, today)).sort((a, b) => a.farm.localeCompare(b.farm)),
    [programs, tasks, stock, sales, today]
  );
  const company = useMemo(() => companyLedger(ledgers), [ledgers]);
  const row = (l: FarmLedger) => l.rows.find(r => r.month === month);
  const all = company.find(c => c.month === month);

  const netText = (n: number) => (n === 0 ? '—' : n > 0 ? tx('netPays', { amount: riel(n) }) : tx('netReceives', { amount: riel(n) }));
  const tone = (n: number) => (n > 0 ? 'text-emerald-800' : n < 0 ? 'text-rose-800' : 'text-ink-muted');

  const exportFarm = (l: FarmLedger) => exportToExcel({
    filename: `CC_Livestock_Money_${l.farm.replace(/\s+/g, '_')}_${today}.xlsx`,
    sheetName: 'Money with CC Livestock',
    title: `Money with CC Livestock: ${l.farm}`,
    farm: l.farm,
    period: `${l.rows[0]?.month ?? ''} to ${l.rows.at(-1)?.month ?? ''}`,
    data: l.rows,
    columns: [
      { header: 'Month', key: 'month' },
      { header: 'Cattle bought from CC Livestock (head)', key: 'headBought' },
      { header: 'Bought, planned (៛)', key: 'boughtPlanned' },
      { header: 'Bought, recorded (៛)', key: 'boughtRecorded' },
      { header: 'Cattle collected (head)', key: 'headSold' },
      { header: 'Collected, planned (៛)', key: 'soldPlanned' },
      { header: 'Collected, recorded (៛)', key: 'soldRecorded' },
      { header: 'Net (៛): + CC Livestock pays the farm, − the farm pays', key: 'net' },
      { header: 'Net from', key: 'netRecorded', formatter: v => (v ? 'records' : 'plan') },
      { header: 'Bank interest (៛)', key: 'interest' },
      { header: 'Bank principal (៛)', key: 'principal' },
      { header: 'Owed to the bank at month end (៛)', key: 'balance' },
    ],
  });

  if (ledgers.length === 0) return <p className="rounded-xl bg-slate-50 p-5 text-base text-ink-muted">{tx('moneyNone')}</p>;

  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <h3 className="text-xl font-semibold text-ink">{tx('moneyTitle')}</h3>
        <p className="text-base text-ink-muted">{tx('moneyHint')}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
          <Button variant="ghost" size="icon" aria-label={tx('moneyPrev')} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
          <p className="min-w-36 px-2 text-center text-lg font-semibold text-ink">{monthLabel(month, language)}</p>
          <Button variant="ghost" size="icon" aria-label={tx('moneyNext')} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
        </div>
        {month !== today.slice(0, 7) && <Button variant="outline" onClick={() => setMonth(today.slice(0, 7))}>{tx('moneyThisMonth')}</Button>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={tx('moneyTotals')}>
        <Tile label={tx('colBought')} value={riel(all?.bought ?? 0)} />
        <Tile label={tx('colSold')} value={riel(all?.sold ?? 0)} />
        <Tile label={tx('colNet')} value={(all?.net ?? 0) === 0 ? '—' : (all?.net ?? 0) > 0 ? tx('netPaysAll', { amount: riel(all?.net ?? 0) }) : tx('netReceivesAll', { amount: riel(all?.net ?? 0) })} color={(all?.net ?? 0) > 0 ? '#138E46' : (all?.net ?? 0) < 0 ? '#B32C33' : undefined} />
        <Tile label={tx('colBank')} value={riel((all?.interest ?? 0) + (all?.principal ?? 0))} sub={tx('bankSub', { interest: riel(all?.interest ?? 0), principal: riel(all?.principal ?? 0) })} />
      </section>

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-left text-base">
          <thead className="bg-slate-50 text-ink-muted">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-3 font-medium">{tx('colFarm')}</th>
              <th className="px-3 py-3 text-right font-medium">{tx('colBought')}</th>
              <th className="px-3 py-3 text-right font-medium">{tx('colSold')}</th>
              <th className="px-3 py-3 text-right font-medium">{tx('colNet')}</th>
              <th className="px-3 py-3 text-right font-medium">{tx('colInterest')}</th>
              <th className="px-3 py-3 text-right font-medium">{tx('colPrincipal')}</th>
            </tr>
          </thead>
          <tbody>
            {ledgers.map(l => {
              const r = row(l);
              return (
                <tr key={l.farm} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white px-3 py-2"><button type="button" className="min-h-11 text-left font-medium text-emerald-800 underline-offset-2 hover:underline" onClick={() => setOpenFarm(openFarm === l.farm ? null : l.farm)}>{l.farm}</button></td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r ? riel(r.netRecorded ? r.boughtRecorded : r.boughtPlanned) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r ? riel(r.netRecorded ? r.soldRecorded : r.soldPlanned) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r ? tone(r.net) : ''}`}>{r ? netText(r.net) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r ? riel(r.interest) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r && r.principal > 0 ? riel(r.principal) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">{tx('moneyNote')}</p>

      {openFarm && (() => {
        const l = ledgers.find(x => x.farm === openFarm);
        if (!l) return null;
        return (
          <Fold title={tx('statementTitle', { farm: l.farm })} headline={tx('statementHeadline', { net: netText(l.totals.net) })} defaultOpen>
            <div className="flex justify-end"><Button variant="outline" onClick={() => exportFarm(l)}><Download /> {tx('moneyExcel')}</Button></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-base">
                <thead className="text-ink-muted">
                  <tr>
                    <th className="px-2 py-2 font-medium">{tx('colMonth')}</th>
                    <th className="px-2 py-2 text-right font-medium">{tx('colBought')}</th>
                    <th className="px-2 py-2 text-right font-medium">{tx('colSold')}</th>
                    <th className="px-2 py-2 text-right font-medium">{tx('colNet')}</th>
                    <th className="px-2 py-2 text-right font-medium">{tx('colInterest')}</th>
                    <th className="px-2 py-2 text-right font-medium">{tx('colPrincipal')}</th>
                    <th className="px-2 py-2 text-right font-medium">{tx('colOwed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {l.rows.map(r => (
                    <tr key={r.month} className={`border-t border-slate-100 ${r.month === month ? 'bg-emerald-50' : ''}`}>
                      <td className="px-2 py-2 text-ink">{monthLabel(r.month, language)} <span className="text-sm text-ink-muted">({tx(r.netRecorded ? 'fromRecords' : 'fromPlan')})</span></td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(r.netRecorded ? r.boughtRecorded : r.boughtPlanned)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(r.netRecorded ? r.soldRecorded : r.soldPlanned)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${tone(r.net)}`}>{netText(r.net)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(r.interest)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink">{r.principal > 0 ? riel(r.principal) : '—'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{riel(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-2 py-2 text-ink">{tx('moneyYear')}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(l.totals.bought)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(l.totals.sold)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${tone(l.totals.net)}`}>{netText(l.totals.net)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(l.totals.interest)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{riel(l.totals.principal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Fold>
        );
      })()}
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-snug text-ink" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}
