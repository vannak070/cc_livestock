'use client';

import React, { useMemo } from 'react';
import { addDays, farmToday } from '@/lib/daily-feed';
import { shownDay } from '@/lib/khmer-date';
import { locationOf, slotBoard, slotLabel } from '@/lib/ops-slots';
import type { ERPLivestockData, FarmItem } from '@/lib/types';
import { useText } from '@/hooks/useText';
import OperationsStatus from '../OperationsStatus';
import type { ReportData } from './useReportData';

/** The action plan: how the monthly swaps stand (OperationsStatus) and which farms swap in the next 7 days, by 3-day slot. */
export default function OperationsSection({ data, farms, farm, r, onOpenActionPlans }: { data: ERPLivestockData; farms: FarmItem[]; farm: string; r: ReportData; onOpenActionPlans?: () => void }) {
  const { tx, language } = useText('reportsPage');
  const today = farmToday();
  const week = useMemo(() => {
    const until = addDays(today, 7);
    const address = new Map(farms.map(f => [f.name, f.address]));
    return slotBoard(r.programs.filter(p => !farm || p.farm === farm), address, today)
      .flatMap(b => b.farms.map(f => ({ ...f, slot: b.slot })))
      .filter(f => f.nextSwap <= until)
      .sort((a, b) => a.nextSwap.localeCompare(b.nextSwap) || a.farm.localeCompare(b.farm));
  }, [r.programs, farms, farm, today]);

  return (
    <>
      <section aria-label={tx('opsWeekTitle')} className="rounded-xl ring-1 ring-slate-200">
        <h3 className="border-b border-slate-100 px-4 py-3 text-lg font-semibold text-ink">{tx('opsWeekTitle')}</h3>
        {week.length === 0 ? <p className="px-4 py-4 text-base text-ink-muted">{tx('opsWeekNone')}</p> : (
          <ul className="divide-y divide-slate-100">
            {week.map(f => (
              <li key={f.farm} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="min-w-0 text-base"><b className="font-semibold text-ink">{f.farm}</b> <span className="text-ink-muted">· {locationOf(farms.find(x => x.name === f.farm)?.address) || tx('opsWeekNoLocation')}</span></span>
                <span className="text-base text-ink">{shownDay(f.nextSwap, language)} <span className="text-sm text-ink-muted">· {tx('opsWeekSlot', { days: slotLabel(f.slot) })}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <OperationsStatus data={data} farm={farm} onOpenActionPlans={onOpenActionPlans} />
    </>
  );
}
