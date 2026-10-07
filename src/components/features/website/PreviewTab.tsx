'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWebsitePreviewAction, publishWebsiteNowAction } from '@/app/website-actions';
import { useText } from '@/hooks/useText';
import { errorText, ok, Pill, PhotoThumb } from './parts';

/**
 * Exactly what the public website will show, built by the same rules the
 * sync job uses (src/lib/website/snapshot.ts). Nothing here is private.
 */
export function PreviewTab({ lastPublishedAt }: { lastPublishedAt: string | null }) {
  const { tx, language } = useText('websitePage');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['website', 'preview'], queryFn: async () => ok(await getWebsitePreviewAction()), refetchOnMount: 'always' });
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const publishNow = async () => {
    setPublishing(true);
    setPublishMsg('');
    try {
      await ok(await publishWebsiteNowAction());
      setPublishMsg(tx('publishedOk'));
      queryClient.invalidateQueries({ queryKey: ['website'] });
    } catch (err) {
      setPublishMsg(errorText(err, tx('publishFailed')));
    } finally {
      setPublishing(false);
    }
  };

  if (query.isLoading) return <p role="status" className="text-lg text-ink-muted">{tx('loading')}</p>;
  if (query.isError || !query.data) return <p role="alert" className="rounded-xl bg-rose-50 p-4 text-base text-rose-800">{errorText(query.error, tx('loadFailed'))}</p>;
  const s = query.data;
  const km = language === 'km';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-base">{tx('previewSafe')}</p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>{tx('refresh')}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="min-w-0 flex-1 text-base text-ink">{lastPublishedAt ? tx('liveSince', { time: lastPublishedAt.slice(0, 16).replace('T', ' ') }) : tx('neverPublished')}</p>
        <Button size="sm" disabled={publishing} onClick={publishNow}>{publishing ? tx('publishing') : tx('publishNow')}</Button>
        {publishMsg && <p role="status" className="w-full text-sm text-ink-muted">{publishMsg}</p>}
      </div>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">{tx('previewNumbers')}</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {[[s.summary.memberFarms, tx('memberFarms')], [String(s.summary.provinces), tx('provinces')], [s.summary.cattleRaised, tx('cattleRaised')], [s.summary.feedRecordedTodayPct === null ? '—' : `${s.summary.feedRecordedTodayPct}%`, tx('feedToday')]].map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-2xl font-bold text-emerald-800">{v}</p><p className="text-sm text-ink-muted">{l}</p></div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">{tx('previewFarms', { n: s.farms.length })}</h3>
        {s.farms.length === 0 ? <p className="text-base text-ink-muted">{tx('previewNoFarms')}</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {s.farms.map(f => (
              <li key={f.slug} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                {f.photoIds[0] && <PhotoThumb id={f.photoIds[0]} alt={f.publicName} />}
                <div className="min-w-0 space-y-1">
                  <p className="text-lg font-semibold text-ink">{f.publicName}</p>
                  <p className="text-base text-ink">{km ? f.provinceKm : f.province} · {f.district}</p>
                  <p className="text-sm text-ink-muted">{[f.breeds.join(', '), f.sizeRange, f.memberSince ? tx('since', { year: f.memberSince }) : ''].filter(Boolean).join(' · ')}</p>
                  <div className="flex flex-wrap gap-1.5">{f.badges.map(b => <Pill key={b} tone="green">{tx(`badge_${b}`)}</Pill>)}</div>
                  <p className="text-xs text-ink-muted">{tx('pinShown', { lat: f.lat, lng: f.lng })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">{tx('previewCattle', { n: s.cattle.length })}</h3>
        {s.cattle.length === 0 ? <p className="text-base text-ink-muted">{tx('previewNoCattle')}</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {s.cattle.map(l => (
              <li key={l.listingId} className="space-y-1 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-lg font-semibold text-ink">{[l.breed, l.sex].filter(Boolean).join(' · ')}</p>
                <p className="text-base text-ink">{l.weightClass} · {l.headCount} · {km ? l.provinceKm : l.province}</p>
                <Pill tone={l.availability === 'now' ? 'green' : 'amber'}>{l.availability === 'now' ? tx('availNow') : tx('availSoon')}</Pill>
                <p className="text-sm text-ink-muted">{tx('askPrice')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">{tx('previewNews', { n: s.news.length })}</h3>
        {s.news.length === 0 ? <p className="text-base text-ink-muted">{tx('noNews')}</p> : (
          <ul className="space-y-2">{s.news.map(n => <li key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-base text-ink">{km ? n.titleKm : n.titleEn || n.titleKm}</li>)}</ul>
        )}
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-base font-medium text-ink">{tx('previewData')}</summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-ink">{JSON.stringify(s, null, 2)}</pre>
      </details>
    </div>
  );
}
