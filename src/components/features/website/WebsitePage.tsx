'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getWebsiteOverviewAction } from '@/app/website-actions';
import { useText } from '@/hooks/useText';
import { CattleTab } from './CattleTab';
import { FarmsTab } from './FarmsTab';
import { NewsTab } from './NewsTab';
import { PreviewTab } from './PreviewTab';
import { RequestsTab } from './RequestsTab';
import { errorText, ok } from './parts';

type Tab = 'farms' | 'cattle' | 'requests' | 'news' | 'preview';

const utc = (iso: string) => iso.slice(0, 16).replace('T', ' ');

/**
 * The office side of the public CamCow website (docs/website/README.md):
 * which member farms and cattle show, the farmers' consent, news, the
 * applications and price inquiries sent from the site, and a preview of
 * exactly what the public sees. Super Admin and Admin manage everything;
 * people with `website_requests` see the Requests tab only.
 */
export default function WebsitePage() {
  const { tx } = useText('websitePage');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['website', 'overview'], queryFn: async () => ok(await getWebsiteOverviewAction()), refetchOnMount: 'always' });
  const [tab, setTab] = useState<Tab | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['website'] });

  if (query.isLoading) return <p role="status" className="mx-auto max-w-5xl text-lg text-ink-muted">{tx('loading')}</p>;
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{errorText(query.error, tx('loadFailed'))}</p>
        <Button onClick={() => query.refetch()}>{tx('retry')}</Button>
      </div>
    );
  }

  const o = query.data;
  const newCount = o.newRequests.applications + o.newRequests.inquiries;
  const tabs: { key: Tab; label: string }[] = [
    ...(o.canPublish ? [{ key: 'farms' as const, label: tx('tabFarms') }, { key: 'cattle' as const, label: tx('tabCattle') }] : []),
    ...(o.canHandleRequests ? [{ key: 'requests' as const, label: newCount ? tx('tabRequestsNew', { n: newCount }) : tx('tabRequests') }] : []),
    ...(o.canPublish ? [{ key: 'news' as const, label: tx('tabNews') }, { key: 'preview' as const, label: tx('tabPreview') }] : []),
  ];
  const active = tab && tabs.some(t => t.key === tab) ? tab : tabs[0]?.key;
  const listingNames = Object.fromEntries(o.batches.map(b => [b.listingId, `${b.batch.name} (${b.batch.farmLocation ?? ''})`]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-semibold text-ink">{tx('title')}</h2>
        <p className="text-base text-ink-muted">{tx('subtitle')}</p>
      </div>
      {o.publishHealth && (o.publishHealth.state === 'failing' || o.publishHealth.state === 'stale') && (
        <div role="alert" className="space-y-1 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
          {o.publishHealth.state === 'failing' ? (
            <>
              <p className="font-semibold">{o.publishHealth.lastOkAt ? tx('healthFailing', { since: utc(o.publishHealth.since), last: utc(o.publishHealth.lastOkAt) }) : tx('healthFailingNever', { since: utc(o.publishHealth.since) })}</p>
              <p className="break-words text-sm">{tx('healthReason', { error: o.publishHealth.error })}</p>
            </>
          ) : <p className="font-semibold">{tx('healthStale', { last: utc(o.publishHealth.lastOkAt) })}</p>}
          <p className="text-sm">{tx('healthTry')}</p>
        </div>
      )}
      <div role="tablist" aria-label={tx('title')} className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 rounded-xl px-4 text-base font-semibold transition-colors ${active === t.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-ink hover:bg-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {active === 'farms' && <FarmsTab farms={o.farms} onChanged={refresh} />}
        {active === 'cattle' && <CattleTab batches={o.batches} onChanged={refresh} />}
        {active === 'requests' && <RequestsTab farms={o.farmNames} canCreateFarms={o.canCreateFarms} listingNames={listingNames} onChanged={refresh} />}
        {active === 'news' && <NewsTab news={o.news} onChanged={refresh} />}
        {active === 'preview' && <PreviewTab lastPublishedAt={o.lastPublishedAt} />}
      </div>
    </div>
  );
}
