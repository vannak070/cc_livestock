'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getWebsiteVisitorsAction } from '@/app/website-actions';
import type { WebsiteVisitors } from '@/lib/types';
import { useText } from '@/hooks/useText';
import { errorText, ok } from './parts';

const RANGES = [7, 30, 90] as const;
const PRESS_KEYS: (keyof WebsiteVisitors['presses'])[] = ['join', 'call', 'telegram', 'price', 'notify'];

/** Page views and button presses on the public website (no cookies or addresses are stored). */
export function VisitorsTab() {
  const { tx } = useText('websitePage');
  const [days, setDays] = useState<number>(30);
  const query = useQuery({ queryKey: ['website', 'visitors', days], queryFn: async () => ok(await getWebsiteVisitorsAction(days)) });

  return (
    <div className="space-y-5">
      <p className="text-base text-ink-muted">{tx('visitorsIntro')}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={tx('pageViews')}>
        {RANGES.map(n => (
          <Button key={n} size="sm" variant={days === n ? 'default' : 'outline'} aria-pressed={days === n} onClick={() => setDays(n)}>{tx('lastDays', { n })}</Button>
        ))}
      </div>
      {query.isLoading && <p role="status" className="text-lg text-ink-muted">{tx('loading')}</p>}
      {query.isError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-base text-rose-800">{errorText(query.error, tx('loadFailed'))}</p>}
      {query.data && <VisitorNumbers v={query.data} />}
    </div>
  );
}

function VisitorNumbers({ v }: { v: WebsiteVisitors }) {
  const { tx } = useText('websitePage');
  if (v.views === 0 && PRESS_KEYS.every(k => v.presses[k] === 0)) return <p className="rounded-2xl bg-slate-50 p-6 text-lg text-ink-muted">{tx('noVisits')}</p>;
  const max = Math.max(1, ...v.byDay.map(d => d.views));
  const pageName = (path: string) => (path === '/' || path === '' ? tx('home') : path);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p><span className="text-3xl font-semibold tabular-nums text-ink">{v.views.toLocaleString('en-US')}</span> <span className="text-base text-ink-muted">{tx('pageViews')}</span></p>
        {v.phoneShare !== null && <p className="text-base text-ink-muted">{tx('onPhones', { pct: v.phoneShare })}</p>}
      </div>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">{tx('perDay')}</h3>
        <div className="flex h-36 items-end gap-0.5" role="img" aria-label={tx('perDay')}>
          {v.byDay.map(d => (
            <div key={d.day} className="group relative flex h-full min-w-0 flex-1 items-end" title={tx('dayViews', { day: d.day, n: d.views })}>
              <div className="w-full rounded-t bg-emerald-600 group-hover:bg-emerald-800" style={{ height: d.views ? `${Math.max(3, (d.views / max) * 100)}%` : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm tabular-nums text-ink-muted">
          <span>{v.byDay[0]?.day}</span>
          <span>{v.byDay[v.byDay.length - 1]?.day}</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-ink">{tx('presses')}</h3>
          <dl className="divide-y divide-slate-100">
            {PRESS_KEYS.map(k => (
              <div key={k} className="flex justify-between gap-3 py-2 text-base">
                <dt className="text-ink">{tx(`press_${k}`)}</dt>
                <dd className="font-semibold tabular-nums text-ink">{v.presses[k].toLocaleString('en-US')}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-ink">{tx('topPages')}</h3>
          <ol className="divide-y divide-slate-100">
            {v.topPages.map(p => (
              <li key={p.path} className="flex justify-between gap-3 py-2 text-base">
                <span className="min-w-0 break-all text-ink">{pageName(p.path)}</span>
                <span className="font-semibold tabular-nums text-ink">{p.views.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-ink">{tx('cameFrom')}</h3>
        {v.referrers.length === 0 ? <p className="text-base text-ink-muted">{tx('noReferrers')}</p> : (
          <ol className="divide-y divide-slate-100">
            {v.referrers.map(r => (
              <li key={r.host} className="flex justify-between gap-3 py-2 text-base">
                <span className="min-w-0 break-all text-ink">{r.host}</span>
                <span className="font-semibold tabular-nums text-ink">{r.views.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
