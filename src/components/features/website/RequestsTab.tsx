'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createFarmFromApplicationAction, getWebsiteRequestsAction, updateWebsiteApplicationAction, updateWebsiteInquiryAction } from '@/app/website-actions';
import type { ApplicationStatus, InquiryStatus, WebsiteApplication, WebsiteInquiry } from '@/lib/types';
import { nextApplicationStatuses, nextInquiryStatuses, NOTE_MAX } from '@/lib/website';
import { useText } from '@/hooks/useText';
import { areaClass, errorText, inputClass, ok, Pill, PhotoThumb, type Tone } from './parts';

const TONE: Record<string, Tone> = { new: 'amber', contacted: 'blue', accepted: 'green', declined: 'slate', closed: 'slate' };
const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');

/** Applications to join and price inquiries sent from the website. */
export function RequestsTab({ farms, canCreateFarms, listingNames, onChanged }: { farms: { farmId: string; farmName: string }[]; canCreateFarms: boolean; listingNames: Record<string, string>; onChanged: () => void }) {
  const { tx } = useText('websitePage');
  const queryClient = useQueryClient();
  const [show, setShow] = useState<'applications' | 'inquiries'>('applications');
  const query = useQuery({ queryKey: ['website', 'requests'], queryFn: async () => ok(await getWebsiteRequestsAction()), refetchOnMount: 'always' });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['website', 'requests'] }); onChanged(); };

  if (query.isLoading) return <p role="status" className="text-lg text-ink-muted">{tx('loading')}</p>;
  if (query.isError || !query.data) return <p role="alert" className="rounded-xl bg-rose-50 p-4 text-base text-rose-800">{errorText(query.error, tx('loadFailed'))}</p>;

  const { applications, inquiries } = query.data;
  const openA = applications.filter(a => a.status === 'new').length;
  const openI = inquiries.filter(i => i.status === 'new').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={tx('requestsTitle')}>
        <Button role="tab" aria-selected={show === 'applications'} variant={show === 'applications' ? 'default' : 'outline'} size="sm" onClick={() => setShow('applications')}>{tx('applicationsTab', { n: openA })}</Button>
        <Button role="tab" aria-selected={show === 'inquiries'} variant={show === 'inquiries' ? 'default' : 'outline'} size="sm" onClick={() => setShow('inquiries')}>{tx('inquiriesTab', { n: openI })}</Button>
      </div>
      <p className="text-base text-ink-muted">{tx('requestsIntro')}</p>
      {show === 'applications' && (applications.length === 0
        ? <p className="rounded-2xl bg-slate-50 p-6 text-lg text-ink-muted">{tx('noApplications')}</p>
        : <ul className="space-y-3">{applications.map(a => <li key={a.id}><ApplicationCard a={a} farms={farms} canCreateFarms={canCreateFarms} onSaved={refresh} /></li>)}</ul>)}
      {show === 'inquiries' && (inquiries.length === 0
        ? <p className="rounded-2xl bg-slate-50 p-6 text-lg text-ink-muted">{tx('noInquiries')}</p>
        : <ul className="space-y-3">{inquiries.map(i => <li key={i.id}><InquiryCard i={i} listingName={i.listingRef ? listingNames[i.listingRef] : undefined} onSaved={refresh} /></li>)}</ul>)}
    </div>
  );
}

function useSave(save: () => Promise<unknown>, onSaved: () => void) {
  const { tx } = useText('websitePage');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setSaving(true);
    setError('');
    try { await save(); onSaved(); } catch (err) { setError(errorText(err, tx('saveFailed'))); } finally { setSaving(false); }
  };
  return { saving, error, run };
}

function ApplicationCard({ a, farms, canCreateFarms, onSaved }: { a: WebsiteApplication; farms: { farmId: string; farmName: string }[]; canCreateFarms: boolean; onSaved: () => void }) {
  const { tx } = useText('websitePage');
  const [status, setStatus] = useState<ApplicationStatus>(a.status);
  const [notes, setNotes] = useState(a.notes);
  const [farmId, setFarmId] = useState(a.farmId ?? '');
  const [justCreated, setJustCreated] = useState('');
  const { saving, error, run } = useSave(async () => ok(await updateWebsiteApplicationAction(a.id, status, notes, status === 'accepted' && farmId ? farmId : undefined)), onSaved);
  const options = [a.status, ...nextApplicationStatuses(a.status)];
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold text-ink">{a.name}</p>
        <Pill tone={TONE[a.status]}>{tx(`status_${a.status}`)}</Pill>
      </div>
      <a href={`tel:${a.phone}`} className="inline-flex min-h-11 items-center gap-2 text-base font-medium text-emerald-700 underline"><Phone className="h-4 w-4" aria-hidden />{a.phone}</a>
      <dl className="grid gap-x-6 gap-y-1 text-base text-ink sm:grid-cols-2">
        <div><dt className="inline text-ink-muted">{tx('where')}: </dt><dd className="inline">{[a.district, a.province].filter(Boolean).join(', ') || '—'}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('cattleNow')}: </dt><dd className="inline">{a.cattleNow ?? '—'}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('land')}: </dt><dd className="inline">{a.landM2 ? `${a.landM2.toLocaleString()} m²` : '—'}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('pens')}: </dt><dd className="inline">{a.hasPens === undefined ? '—' : a.hasPens ? tx('yes') : tx('notYet')}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('sent')}: </dt><dd className="inline">{when(a.createdAt)}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('consentBox')}: </dt><dd className="inline">{a.consentChecked ? tx('yes') : tx('no')}</dd></div>
      </dl>
      {a.photoIds.length > 0 && <div className="flex flex-wrap gap-2">{a.photoIds.map(id => <PhotoThumb key={id} id={id} alt={tx('photoAlt')} className="h-20 w-20" />)}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="block text-sm font-medium text-ink">{tx('status')}</span>
          <select className={inputClass} value={status} onChange={e => setStatus(e.target.value as ApplicationStatus)}>{options.map(s => <option key={s} value={s}>{tx(`status_${s}`)}</option>)}</select>
        </label>
        {status === 'accepted' && !a.farmId && farms.length > 0 && (
          <label className="space-y-1"><span className="block text-sm font-medium text-ink">{tx('linkFarm')}</span>
            <select className={inputClass} value={farmId} onChange={e => setFarmId(e.target.value)}>
              <option value="">{tx('linkLater')}</option>
              {farms.map(f => <option key={f.farmId} value={f.farmId}>{f.farmName}</option>)}
            </select>
          </label>
        )}
      </div>
      {justCreated
        ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-base text-emerald-900">{tx('farmCreated', { name: justCreated })}</p>
        : a.farmId && <p className="rounded-xl bg-emerald-50 p-3 text-base text-emerald-900">{tx('linkedTo', { name: farms.find(f => f.farmId === a.farmId)?.farmName ?? a.farmId })}</p>}
      {!a.farmId && !justCreated && canCreateFarms && a.status !== 'declined' && (
        a.status === 'new'
          ? <p className="text-sm text-ink-muted">{tx('createFarmFirst')}</p>
          : <CreateFarmBox a={a} onCreated={name => { setJustCreated(name); setStatus('accepted'); onSaved(); }} />
      )}
      <label className="block space-y-1"><span className="block text-sm font-medium text-ink">{tx('notes')}</span>
        <textarea className={areaClass} value={notes} maxLength={NOTE_MAX} onChange={e => setNotes(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-base text-rose-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={saving} onClick={run}>{saving ? tx('saving') : tx('save')}</Button>
        {a.handledBy && <span className="text-sm text-ink-muted">{tx('handledBy', { name: a.handledBy })}</span>}
      </div>
    </div>
  );
}

/** Makes the applicant's farm in CC Livestock and links it (contacted or accepted applications only). */
function CreateFarmBox({ a, onCreated }: { a: WebsiteApplication; onCreated: (farmName: string) => void }) {
  const { tx } = useText('websitePage');
  const queryClient = useQueryClient();
  const [name, setName] = useState(`${a.name} Farm`.slice(0, 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setSaving(true);
    setError('');
    try {
      const farm = await ok(await createFarmFromApplicationAction(a.id, name));
      queryClient.invalidateQueries({ queryKey: ['livestock'] }); // the new farm shows on Farms
      onCreated(farm.farmName);
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <p className="text-base font-semibold text-ink">{tx('createFarmTitle')}</p>
      <p className="text-sm text-ink-muted">{tx('createFarmHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 space-y-1"><span className="block text-sm font-medium text-ink">{tx('createFarmName')}</span>
          <input className={inputClass} value={name} maxLength={60} onChange={e => setName(e.target.value)} />
        </label>
        <Button size="sm" disabled={saving || name.trim().length < 2} onClick={run}>{saving ? tx('creatingFarm') : tx('createFarm')}</Button>
      </div>
      {error && <p role="alert" className="text-base text-rose-800">{error}</p>}
    </div>
  );
}

function InquiryCard({ i, listingName, onSaved }: { i: WebsiteInquiry; listingName?: string; onSaved: () => void }) {
  const { tx } = useText('websitePage');
  const [status, setStatus] = useState<InquiryStatus>(i.status);
  const [notes, setNotes] = useState(i.notes);
  const { saving, error, run } = useSave(async () => ok(await updateWebsiteInquiryAction(i.id, status, notes)), onSaved);
  const options = [i.status, ...nextInquiryStatuses(i.status)];
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold text-ink">{i.name}</p>
        <div className="flex flex-wrap gap-2">
          {i.kind === 'notify' && <Pill tone="blue">{tx('waitingForCattle')}</Pill>}
          <Pill tone={TONE[i.status]}>{tx(`status_${i.status}`)}</Pill>
        </div>
      </div>
      {i.kind === 'notify' && <p className="text-sm text-ink-muted">{tx('waitingHint')}</p>}
      <a href={`tel:${i.phone}`} className="inline-flex min-h-11 items-center gap-2 text-base font-medium text-emerald-700 underline"><Phone className="h-4 w-4" aria-hidden />{i.phone}</a>
      <dl className="grid gap-x-6 gap-y-1 text-base text-ink sm:grid-cols-2">
        <div><dt className="inline text-ink-muted">{tx('buyerType')}: </dt><dd className="inline">{i.buyerType || '—'}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('howMany')}: </dt><dd className="inline">{i.quantity ?? '—'}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('weightClass')}: </dt><dd className="inline">{i.weightClass || '—'}</dd></div>
        <div><dt className="inline text-ink-muted">{tx('sent')}: </dt><dd className="inline">{when(i.createdAt)}</dd></div>
        {i.listingRef && <div><dt className="inline text-ink-muted">{tx('listing')}: </dt><dd className="inline">{listingName ?? i.listingRef}</dd></div>}
      </dl>
      {i.message && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{i.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="block text-sm font-medium text-ink">{tx('status')}</span>
          <select className={inputClass} value={status} onChange={e => setStatus(e.target.value as InquiryStatus)}>{options.map(s => <option key={s} value={s}>{tx(`status_${s}`)}</option>)}</select>
        </label>
      </div>
      <label className="block space-y-1"><span className="block text-sm font-medium text-ink">{tx('notes')}</span>
        <textarea className={areaClass} value={notes} maxLength={NOTE_MAX} onChange={e => setNotes(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-base text-rose-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={saving} onClick={run}>{saving ? tx('saving') : tx('save')}</Button>
        {i.handledBy && <span className="text-sm text-ink-muted">{tx('handledBy', { name: i.handledBy })}</span>}
      </div>
    </div>
  );
}
