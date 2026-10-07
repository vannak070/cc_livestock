'use client';

import React, { useState } from 'react';
import { Globe, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  recordWebsiteConsentAction, saveWebsiteProfileAction, setWebsiteProfilePublishedAction, withdrawWebsiteConsentAction,
} from '@/app/website-actions';
import { CONSENT_METHODS, MAX_PROFILE_PHOTOS, PROVINCES, provinceOf, type ConsentInput } from '@/lib/website';
import type { ConsentMethod } from '@/lib/types';
import type { FarmRow } from '@/services/website';
import { useText } from '@/hooks/useText';
import { Check, errorText, Field, FormDialog, inputClass, areaClass, ok, Pill, PhotoThumb } from './parts';
import { PhotoPicker } from './PhotoPicker';

const today = () => new Date().toISOString().slice(0, 10);

/** Member farms: each farm's public profile, the farmer's consent, and On / Off the website. */
export function FarmsTab({ farms, onChanged }: { farms: FarmRow[]; onChanged: () => void }) {
  const { tx, language } = useText('websitePage');
  const [editing, setEditing] = useState<FarmRow | null>(null);
  const [consentFor, setConsentFor] = useState<FarmRow | null>(null);
  const [withdrawFor, setWithdrawFor] = useState<FarmRow | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const publish = async (row: FarmRow, on: boolean) => {
    setBusy(row.farmId);
    setError('');
    try {
      await ok(await setWebsiteProfilePublishedAction(row.farmId, on));
      onChanged();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
    } finally {
      setBusy('');
    }
  };

  if (farms.length === 0) return <p className="rounded-2xl bg-slate-50 p-6 text-lg text-ink-muted">{tx('noFarms')}</p>;

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-muted">{tx('farmsIntro')}</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
      <ul className="space-y-3">
        {farms.map(row => {
          const p = row.profile;
          const province = p && provinceOf(p.province);
          const onSite = !!(p?.published && row.consent);
          return (
            <li key={row.farmId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-4">
                {p?.photoIds[0] ? <PhotoThumb id={p.photoIds[0]} alt={p.publicName} /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100"><Globe className="h-6 w-6 text-ink-muted" aria-hidden /></div>}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-semibold text-ink">{p?.publicName || row.farmName}</p>
                  <p className="text-sm text-ink-muted">{tx('inApp', { name: row.farmName })}</p>
                  {province && <p className="flex items-center gap-1 text-base text-ink"><MapPin className="h-4 w-4" aria-hidden />{language === 'km' ? province.km : province.key} · {p!.district}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {onSite ? <Pill tone="green">{tx('onWebsite')}</Pill> : <Pill tone="slate">{tx('notOnWebsite')}</Pill>}
                    {row.consent ? <Pill tone="blue">{tx('consentOn', { date: row.consent.givenOn })}</Pill> : <Pill tone="amber">{tx('noConsent')}</Pill>}
                  </div>
                  {!onSite && row.publishBlock && <p className="text-sm text-amber-900">{row.publishBlock}</p>}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
                  <Button size="sm" variant="outline" onClick={() => setEditing(row)}>{p ? tx('editProfile') : tx('setUpProfile')}</Button>
                  {row.consent
                    ? <Button size="sm" variant="ghost" onClick={() => setWithdrawFor(row)}>{tx('withdrawConsent')}</Button>
                    : <Button size="sm" variant="outline" onClick={() => setConsentFor(row)}><ShieldCheck aria-hidden />{tx('recordConsent')}</Button>}
                  {onSite
                    ? <Button size="sm" variant="secondary" disabled={busy === row.farmId} onClick={() => publish(row, false)}>{tx('takeOff')}</Button>
                    : <Button size="sm" disabled={busy === row.farmId || !!row.publishBlock} onClick={() => publish(row, true)}>{tx('putOn')}</Button>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && <ProfileDialog row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
      {consentFor && <ConsentDialog row={consentFor} onClose={() => setConsentFor(null)} onSaved={() => { setConsentFor(null); onChanged(); }} />}
      <ConfirmModal
        isOpen={!!withdrawFor}
        onClose={() => setWithdrawFor(null)}
        onConfirm={async () => {
          if (!withdrawFor) return;
          try { await ok(await withdrawWebsiteConsentAction(withdrawFor.farmId)); onChanged(); } catch (err) { setError(errorText(err, tx('saveFailed'))); }
          setWithdrawFor(null);
        }}
        title={tx('withdrawTitle')}
        description={tx('withdrawBody', { name: withdrawFor?.profile?.publicName || withdrawFor?.farmName || '' })}
        confirmText={tx('withdrawConfirm')}
        cancelText={tx('cancel')}
        type="danger"
      />
    </div>
  );
}

function ProfileDialog({ row, onClose, onSaved }: { row: FarmRow; onClose: () => void; onSaved: () => void }) {
  const { tx, language } = useText('websitePage');
  const p = row.profile;
  const [name, setName] = useState(p?.publicName ?? row.farmName);
  const [province, setProvince] = useState(p?.province ?? '');
  const [district, setDistrict] = useState(p?.district ?? '');
  const [lat, setLat] = useState(p?.mapLat !== undefined ? String(p.mapLat) : '');
  const [lng, setLng] = useState(p?.mapLng !== undefined ? String(p.mapLng) : '');
  const [storyKm, setStoryKm] = useState(p?.storyKm ?? '');
  const [storyEn, setStoryEn] = useState(p?.storyEn ?? '');
  const [since, setSince] = useState(p?.memberSince ? String(p.memberSince) : '');
  const [photos, setPhotos] = useState<string[]>(p?.photoIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await ok(await saveWebsiteProfileAction(row.farmId, {
        publicName: name, province, district, mapLat: lat.trim() ? Number(lat) : null, mapLng: lng.trim() ? Number(lng) : null,
        storyKm, storyEn, memberSince: since.trim() ? Number(since) : null, photoIds: photos,
      }));
      onSaved();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
      setSaving(false);
    }
  };

  return (
    <FormDialog open onClose={onClose} title={tx('profileTitle', { name: row.farmName })} description={tx('profileHelp')} saving={saving} error={error} saveLabel={saving ? tx('saving') : tx('save')} cancelLabel={tx('cancel')} onSave={save}>
      <Field label={tx('publicName')} hint={tx('publicNameHint')}><input className={inputClass} value={name} maxLength={60} onChange={e => setName(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx('province')}>
          <select className={inputClass} value={province} onChange={e => setProvince(e.target.value)}>
            <option value="">{tx('choose')}</option>
            {PROVINCES.map(pr => <option key={pr.key} value={pr.key}>{language === 'km' ? `${pr.km} (${pr.key})` : pr.key}</option>)}
          </select>
        </Field>
        <Field label={tx('district')}><input className={inputClass} value={district} maxLength={60} onChange={e => setDistrict(e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx('mapLat')} hint={tx('mapHint')}><input className={inputClass} inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} placeholder="11.48" /></Field>
        <Field label={tx('mapLng')}><input className={inputClass} inputMode="decimal" value={lng} onChange={e => setLng(e.target.value)} placeholder="104.95" /></Field>
      </div>
      <Field label={tx('memberSince')}><input className={inputClass} inputMode="numeric" value={since} maxLength={4} onChange={e => setSince(e.target.value)} placeholder="2025" /></Field>
      <Field label={tx('storyKm')} hint={tx('storyHint')}><textarea className={areaClass} value={storyKm} maxLength={600} onChange={e => setStoryKm(e.target.value)} /></Field>
      <Field label={tx('storyEn')}><textarea className={areaClass} value={storyEn} maxLength={600} onChange={e => setStoryEn(e.target.value)} /></Field>
      <div className="space-y-2">
        <p className="text-base font-medium text-ink">{tx('photos')}</p>
        <PhotoPicker ids={photos} onChange={setPhotos} max={MAX_PROFILE_PHOTOS} />
      </div>
    </FormDialog>
  );
}

function ConsentDialog({ row, onClose, onSaved }: { row: FarmRow; onClose: () => void; onSaved: () => void }) {
  const { tx } = useText('websitePage');
  const [input, setInput] = useState<ConsentInput>({ givenByName: '', givenOn: today(), method: 'paper', mayShowName: true, mayShowPhotos: true, mayShowExactLocation: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<ConsentInput>) => setInput(v => ({ ...v, ...patch }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await ok(await recordWebsiteConsentAction(row.farmId, input));
      onSaved();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
      setSaving(false);
    }
  };

  return (
    <FormDialog open onClose={onClose} title={tx('consentTitle', { name: row.farmName })} description={tx('consentHelp')} saving={saving} error={error} saveLabel={saving ? tx('saving') : tx('saveConsent')} cancelLabel={tx('cancel')} onSave={save}>
      <Field label={tx('consentWho')}><input className={inputClass} value={input.givenByName} maxLength={80} onChange={e => set({ givenByName: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx('consentDate')}><input type="date" className={inputClass} value={input.givenOn} max={today()} onChange={e => set({ givenOn: e.target.value })} /></Field>
        <Field label={tx('consentHow')}>
          <select className={inputClass} value={input.method} onChange={e => set({ method: e.target.value as ConsentMethod })}>
            {CONSENT_METHODS.map(m => <option key={m} value={m}>{tx(`method_${m}`)}</option>)}
          </select>
        </Field>
      </div>
      <fieldset className="space-y-1 rounded-xl bg-slate-50 p-3">
        <legend className="px-1 text-base font-medium text-ink">{tx('consentMay')}</legend>
        <Check checked={input.mayShowName} onChange={v => set({ mayShowName: v })}>{tx('mayName')}</Check>
        <Check checked={input.mayShowPhotos} onChange={v => set({ mayShowPhotos: v })}>{tx('mayPhotos')}</Check>
        <Check checked={input.mayShowExactLocation} onChange={v => set({ mayShowExactLocation: v })}>{tx('mayExact')}</Check>
      </fieldset>
    </FormDialog>
  );
}
