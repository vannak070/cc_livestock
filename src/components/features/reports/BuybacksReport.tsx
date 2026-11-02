'use client';

import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buybackSchedule } from '@/lib/action-plans';
import { farmToday } from '@/lib/daily-feed';
import { getErrorMessage } from '@/lib/utils';
import { useActionPlansView } from '@/hooks/useActionPlansView';
import { useOpsPrograms } from '@/hooks/useOpsPrograms';
import { planPricesByFarm } from '@/lib/ops-view';
import { useText } from '@/hooks/useText';
import type { ERPLivestockData } from '@/lib/types';
import BuybacksDue from '../action-plans/BuybacksDue';

interface Props {
  data: ERPLivestockData;
  currentUser: Parameters<typeof BuybacksDue>[0]['currentUser'];
  /** The farm chosen in Reports, or '' for all. */
  farm: string;
  /** Opens the Action plans page, where the work and the contract prices are handled. */
  onOpenActionPlans?: () => void;
}

/** Finished cattle due for collection, soonest first (read only; writing is on Action plans). */
export default function BuybacksReport({ data, currentUser, farm, onOpenActionPlans }: Props) {
  const { tx } = useText('actionPlans');
  const query = useActionPlansView(undefined);
  const view = query.data;
  const programs = useOpsPrograms().data?.programs;
  // Price per kg: the batch's contract, else the price set on the batch, else the farm's plan price.
  const schedule = useMemo(
    () => buybackSchedule(data.batches, data.stock, view?.contracts ?? [], farmToday(), planPricesByFarm(programs ?? [])).filter(r => !farm || r.farm === farm),
    [data.batches, data.stock, view?.contracts, farm, programs]
  );

  if (query.isLoading) return <p className="text-lg text-ink-muted" role="status">{tx('loading')}</p>;
  if (query.isError || !view) {
    return (
      <div className="space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{getErrorMessage(query.error, tx('loadFailed'))}</p>
        <Button onClick={() => query.refetch()}>{tx('retry')}</Button>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="rb-due">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="rb-due" className="text-xl font-semibold text-ink">{tx('reportDueTitle')}</h3>
          <p className="text-base text-ink-muted">{tx('reportDueHint')}</p>
        </div>
        {onOpenActionPlans && <Button variant="outline" onClick={onOpenActionPlans}><ClipboardList /> {tx('openActionPlans')}</Button>}
      </div>
      <BuybacksDue currentUser={currentUser} rows={schedule} contracts={view.contracts} onSaved={() => undefined} readOnly />
    </section>
  );
}
