'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { monthLabel } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { StatusBanner, Tile } from '../parts';
import type { ReportData } from './useReportData';

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const num = (n: number) => n.toLocaleString('en-US');

/** The status of the month in one sentence, the key figures, and the top things to act on. Section buttons jump to the detail. */
export default function SummarySection({ r, onJump }: { r: ReportData; onJump: (section: string) => void }) {
  const cd = useText('controlDashboard');
  const pdf = useText('reportPdf');
  const ops = useText('opsTasks');
  const { language } = useText('reportsPage');
  const { dash, pack, finance } = r;
  if (!dash) return null;
  const inv = dash.inventory;
  const lateTasks = dash.plan?.byStatus.late ?? 0;
  const level = (key: string) => dash.alerts.find(a => a.key === key)?.value ?? 0;
  const attention = [
    { key: 'overdue', n: inv.overdue, text: cd.tx('attOverdue', { n: num(inv.overdue) }), tone: 'bad' as const, to: 'management', go: cd.tx('scrSeeBuybacks') },
    { key: 'tasks', n: level('tasks'), text: cd.tx('attTasks', { n: num(level('tasks')) }), tone: 'bad' as const, to: 'work', go: cd.tx('scrPlanOpen') },
    { key: 'due7', n: inv.due7, text: cd.tx('attDue7', { n: num(inv.due7) }), tone: 'warn' as const, to: 'management', go: cd.tx('scrSeeBuybacks') },
    { key: 'missing', n: inv.missing, text: cd.tx('attMissing', { n: num(inv.missing) }), tone: 'warn' as const, to: '', go: '' },
    { key: 'integrity', n: level('integrity'), text: cd.tx('attIntegrity', { n: num(level('integrity')) }), tone: 'warn' as const, to: '', go: '' },
  ].filter(a => a.n > 0);
  const state: 'act' | 'watch' | 'ok' = inv.overdue > 0 || lateTasks > 0 ? 'act' : inv.due7 > 0 ? 'watch' : 'ok';
  const stateColor = { act: '#B32C33', watch: '#D9822B', ok: '#138E46' }[state];
  const profit = pack?.overview.profit ?? null;
  const net = finance?.cash.thisMonth?.net ?? 0;

  return (
    <>
      <StatusBanner level={state}>
        <p className="text-lg text-ink">
          {cd.tx('scrStatusLine', { month: monthLabel(r.month, language) })}{' '}
          <b className="font-semibold" style={{ color: stateColor }}>{cd.tx(state === 'act' ? 'scrStatusAct' : state === 'watch' ? 'scrStatusWatch' : 'scrStatusOk')}</b>
          {attention.length > 0 && <span> — {attention.slice(0, 2).map(a => a.text).join(' · ')}</span>}
        </p>
      </StatusBanner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label={pdf.tx('oCattle')} value={num(pack?.overview.head ?? 0)} sub={`${pdf.tx('oSold')}: ${num(pack?.overview.sold ?? 0)}`} />
        <Tile label={profit !== null && profit < 0 ? pdf.tx('oLoss') : pdf.tx('oProfit')} value={profit === null ? '—' : riel(Math.abs(profit))} sub={`${pdf.tx('oSales')}: ${riel(pack?.overview.salesAmount ?? 0)}`} tone={profit === null ? undefined : profit < 0 ? 'bad' : 'good'} />
        <Tile label={cd.tx('iOverdue')} value={num(inv.overdue)} sub={`${cd.tx('iDue7')}: ${num(inv.due7)}`} tone={inv.overdue > 0 ? 'bad' : 'good'} />
        <Tile label={cd.tx('scrPlanDone')} value={dash.plan ? `${dash.plan.completionPct}%` : '—'} sub={dash.plan ? `${cd.tx('scrPlanLate')}: ${num(lateTasks)}` : undefined} tone={lateTasks > 0 ? 'warn' : undefined} />
        <Tile label={ops.tx('colNet')} value={net === 0 ? '—' : riel(Math.abs(net))} sub={net === 0 ? undefined : net > 0 ? ops.tx('netPaysAll', { amount: '' }).trim() : ops.tx('netReceivesAll', { amount: '' }).trim()} tone={net > 0 ? 'good' : net < 0 ? 'bad' : undefined} />
      </div>

      <section aria-label={cd.tx('scrTopActions')} className="rounded-xl ring-1 ring-slate-200">
        <h3 className="border-b border-slate-100 px-4 py-3 text-lg font-semibold text-ink">{cd.tx('scrTopActions')}</h3>
        {attention.length === 0 ? <p className="px-4 py-4 text-base text-ink-muted">{cd.tx('scrAllClear')}</p> : (
          <ol className="divide-y divide-slate-100">
            {attention.slice(0, 4).map((a, i) => (
              <li key={a.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0 text-base text-ink"><b className="mr-2 font-semibold" style={{ color: a.tone === 'bad' ? '#B32C33' : '#B4690E' }}>{i + 1}</b>{a.text}</span>
                {a.to && <Button variant="ghost" size="sm" onClick={() => onJump(a.to)}>{a.go}</Button>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
