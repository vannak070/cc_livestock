'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveWebsiteListingAction } from '@/app/website-actions';
import type { Availability } from '@/lib/types';
import type { BatchRow } from '@/services/website';
import { useText } from '@/hooks/useText';
import { errorText, Field, FormDialog, inputClass, ok, Pill } from './parts';
import { PhotoPicker } from './PhotoPicker';

/**
 * Cattle available: which active batches show on the website. The public sees
 * only breed, sex, weight class, a rounded count and "now" or "soon".
 */
export function CattleTab({ batches, onChanged }: { batches: BatchRow[]; onChanged: () => void }) {
  const { tx } = useText('websitePage');
  const [editing, setEditing] = useState<BatchRow | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const toggle = async (row: BatchRow, on: boolean) => {
    setBusy(row.batch.id);
    setError('');
    try {
      const l = row.listing;
      await ok(await saveWebsiteListingAction(row.batch.id, { publicBreed: l?.publicBreed ?? '', publicSex: l?.publicSex ?? '', overrideAvailability: l?.overrideAvailability ?? null, photoId: l?.photoId ?? null }, on));
      onChanged();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
    } finally {
      setBusy('');
    }
  };

  if (batches.length === 0) return <p className="rounded-2xl bg-slate-50 p-6 text-lg text-ink-muted">{tx('noBatches')}</p>;

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-muted">{tx('cattleIntro')}</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
      <ul className="space-y-3">
        {batches.map(row => {
          const on = !!row.listing?.published;
          const f = row.facts;
          return (
            <li key={row.batch.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-semibold text-ink">{row.batch.name}</p>
                  <p className="text-sm text-ink-muted">{row.batch.farmLocation}</p>
                  <p className="text-base text-ink">{tx('publicLine', { breed: f.breed || '—', sex: f.sex || '—', weight: f.weightClass ?? '—', count: f.headCount ?? '—' })}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {on ? <Pill tone="green">{tx('onWebsite')}</Pill> : <Pill tone="slate">{tx('notOnWebsite')}</Pill>}
                    {f.availability === 'now' && <Pill tone="green">{tx('availNow')}</Pill>}
                    {f.availability === 'soon' && <Pill tone="amber">{tx('availSoon')}</Pill>}
                    {!f.availability && <Pill tone="slate">{tx('availLater')}</Pill>}
                  </div>
                  {row.listBlock && <p className="text-sm text-amber-900">{row.listBlock}</p>}
                  {on && !f.availability && <p className="text-sm text-amber-900">{tx('hiddenUntilSoon')}</p>}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
                  <Button size="sm" variant="outline" onClick={() => setEditing(row)}>{tx('editListing')}</Button>
                  {on
                    ? <Button size="sm" variant="secondary" disabled={busy === row.batch.id} onClick={() => toggle(row, false)}>{tx('takeOff')}</Button>
                    : <Button size="sm" disabled={busy === row.batch.id || !!row.listBlock} onClick={() => toggle(row, true)}>{tx('putOn')}</Button>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && <ListingDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

function ListingDialog({ row, onClose, onSaved }: { row: BatchRow; onClose: () => void; onSaved: () => void }) {
  const { tx } = useText('websitePage');
  const l = row.listing;
  const [breed, setBreed] = useState(l?.publicBreed ?? '');
  const [sex, setSex] = useState(l?.publicSex ?? '');
  const [avail, setAvail] = useState<Availability | ''>(l?.overrideAvailability ?? '');
  const [photos, setPhotos] = useState<string[]>(l?.photoId ? [l.photoId] : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await ok(await saveWebsiteListingAction(row.batch.id, { publicBreed: breed, publicSex: sex, overrideAvailability: avail || null, photoId: photos[0] ?? null }, !!l?.published));
      onSaved();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
      setSaving(false);
    }
  };

  return (
    <FormDialog open onClose={onClose} title={tx('listingTitle', { name: row.batch.name })} description={tx('listingHelp')} saving={saving} error={error} saveLabel={saving ? tx('saving') : tx('save')} cancelLabel={tx('cancel')} onSave={save}>
      <Field label={tx('shownBreed')} hint={tx('autoHint', { value: row.facts.breed || '—' })}><input className={inputClass} value={breed} maxLength={60} onChange={e => setBreed(e.target.value)} /></Field>
      <Field label={tx('shownSex')} hint={tx('autoHint', { value: row.facts.sex || '—' })}>
        <select className={inputClass} value={sex} onChange={e => setSex(e.target.value)}>
          <option value="">{tx('automatic')}</option>
          <option value="Male">{tx('sexMale')}</option>
          <option value="Female">{tx('sexFemale')}</option>
          <option value="Male and female">{tx('sexBoth')}</option>
        </select>
      </Field>
      <Field label={tx('shownWhen')} hint={tx('whenHint')}>
        <select className={inputClass} value={avail} onChange={e => setAvail(e.target.value as Availability | '')}>
          <option value="">{tx('automatic')}</option>
          <option value="now">{tx('availNow')}</option>
          <option value="soon">{tx('availSoon')}</option>
        </select>
      </Field>
      <div className="space-y-2">
        <p className="text-base font-medium text-ink">{tx('listingPhoto')}</p>
        <PhotoPicker ids={photos} onChange={setPhotos} max={1} />
      </div>
    </FormDialog>
  );
}
