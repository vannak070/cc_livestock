'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveWebsiteListingAction } from '@/app/website-actions';
import type { Availability } from '@/lib/types';
import { weightClassEdges, weightRangeLabel } from '@/lib/website';
import type { BatchRow } from '@/services/website';
import { useText } from '@/hooks/useText';
import { errorText, Field, FormDialog, inputClass, ok, Pill } from './parts';

/**
 * Cattle available, by farm. A batch is offered on the website by default: its
 * sell schedule decides "now" or "soon". Here the office can hide a batch, or
 * set its timing by hand. The public sees only the farm, a rounded count, a
 * weight range and "now" or "soon" (never breed, sex, photos or one animal).
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
          const f = row.facts;
          // On the website right now: not hidden by the office, its farm is published, and it is on the sell schedule.
          const on = row.offered && !row.listBlock && !!f.availability;
          const edges = f.weightClass ? weightClassEdges(f.weightClass) : null;
          return (
            <li key={row.batch.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-semibold text-ink">{row.batch.name}</p>
                  <p className="text-sm text-ink-muted">{row.batch.farmLocation}</p>
                  <p className="text-base text-ink">{tx('publicLine', { weight: edges ? weightRangeLabel(edges.from, edges.to) : '—', count: f.headCount ?? '—' })}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {on ? <Pill tone="green">{tx('onWebsite')}</Pill> : <Pill tone="slate">{tx('notOnWebsite')}</Pill>}
                    {f.availability === 'now' && <Pill tone="green">{tx('availNow')}</Pill>}
                    {f.availability === 'soon' && <Pill tone="amber">{tx('availSoon')}</Pill>}
                    {!f.availability && <Pill tone="slate">{tx('availLater')}</Pill>}
                  </div>
                  {!row.offered && <p className="text-sm text-amber-900">{tx('hiddenByOffice')}</p>}
                  {row.offered && row.listBlock && <p className="text-sm text-amber-900">{row.listBlock}</p>}
                  {row.offered && !row.listBlock && !f.availability && <p className="text-sm text-amber-900">{tx('hiddenUntilSoon')}</p>}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
                  <Button size="sm" variant="outline" onClick={() => setEditing(row)}>{tx('editListing')}</Button>
                  {row.offered
                    ? <Button size="sm" variant="secondary" disabled={busy === row.batch.id} onClick={() => toggle(row, false)}>{tx('takeOff')}</Button>
                    : <Button size="sm" disabled={busy === row.batch.id} onClick={() => toggle(row, true)}>{tx('putOn')}</Button>}
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
  const [avail, setAvail] = useState<Availability | ''>(l?.overrideAvailability ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Keep the batch as it is (offered unless the office hid it); only the timing changes.
      await ok(await saveWebsiteListingAction(row.batch.id, { publicBreed: l?.publicBreed ?? '', publicSex: l?.publicSex ?? '', overrideAvailability: avail || null, photoId: l?.photoId ?? null }, row.offered));
      onSaved();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
      setSaving(false);
    }
  };

  return (
    <FormDialog open onClose={onClose} title={tx('listingTitle', { name: row.batch.name })} description={tx('listingHelp')} saving={saving} error={error} saveLabel={saving ? tx('saving') : tx('save')} cancelLabel={tx('cancel')} onSave={save}>
      <Field label={tx('shownWhen')} hint={tx('whenHint')}>
        <select className={inputClass} value={avail} onChange={e => setAvail(e.target.value as Availability | '')}>
          <option value="">{tx('automatic')}</option>
          <option value="now">{tx('availNow')}</option>
          <option value="soon">{tx('availSoon')}</option>
        </select>
      </Field>
    </FormDialog>
  );
}
