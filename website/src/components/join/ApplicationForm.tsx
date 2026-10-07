'use client';

import Link from 'next/link';
import { useState } from 'react';
import { checkApplication } from '@/lib/forms/validate';
import type { Dict } from '@/lib/i18n';
import { PROVINCES } from '@/lib/places';
import { JoinPhotos, type JoinPhoto } from './JoinPhotos';

/** "Join as a member farm". The consent box must be ticked to apply. */
export function ApplicationForm({ t, lang, membersHref }: { t: Pick<Dict, 'join' | 'common'>; lang: 'km' | 'en'; membersHref: string }) {
  const [form, setForm] = useState({ name: '', phone: '', province: '', district: '', landM2: '', cattleNow: '', hasPens: '' as '' | 'yes' | 'no', consent: false, website: '' });
  const [photos, setPhotos] = useState<JoinPhoto[]>([]);
  const [bad, setBad] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm(f => ({ ...f, [k]: e.target.value })); setBad(''); };

  const send = async () => {
    const raw = { ...form, hasPens: form.hasPens === 'yes' ? true : form.hasPens === 'no' ? false : null, language: lang };
    const checked = checkApplication(raw);
    if (!checked.ok) { setBad(checked.field); return; }
    setState('sending');
    try {
      const payload = { ...raw, photos: photos.map(p => ({ mime: p.mime, large: p.large, small: p.small, width: p.width, height: p.height })) };
      const res = await fetch('/public/v1/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) { setState('sent'); return; }
      if (body.field) { setBad(body.field); setState('idle'); return; }
      setState('error');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="thanks" role="status">
        <b>{t.join.thanksTitle}</b>
        <p>{t.join.thanksBody}</p>
        <Link href={membersHref} className="btn btn-line" style={{ alignSelf: 'flex-start' }}>{t.join.seeMembers}</Link>
      </div>
    );
  }

  const err = (field: string, text = t.common.required) => (bad === field ? <span className="form-error">{text}</span> : null);
  return (
    <form className="stack" style={{ gap: 14 }} noValidate onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="field">{t.join.name}<input className="input" value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={bad === 'name'} />{err('name')}</label>
      <label className="field">{t.join.phone}<input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" aria-invalid={bad === 'phone'} />{err('phone')}</label>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <label className="field">{t.join.province}
          <select className="select" value={form.province} onChange={set('province')} aria-invalid={bad === 'province'}>
            <option value="">…</option>
            {PROVINCES.map(p => <option key={p.key} value={p.key}>{lang === 'km' ? p.km : p.key}</option>)}
          </select>
          {err('province')}
        </label>
        <label className="field">{t.join.district}<input className="input" value={form.district} onChange={set('district')} /></label>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <label className="field">{t.join.land}<input className="input" value={form.landM2} onChange={set('landM2')} inputMode="numeric" aria-invalid={bad === 'landM2'} />{err('landM2')}</label>
        <label className="field">{t.join.cattleNow}<input className="input" value={form.cattleNow} onChange={set('cattleNow')} inputMode="numeric" aria-invalid={bad === 'cattleNow'} />{err('cattleNow')}</label>
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="field" style={{ paddingBottom: 6 }}>{t.join.pens}</legend>
        <div className="row" style={{ gap: 18 }}>
          {(['yes', 'no'] as const).map(v => (
            <label key={v} className="row" style={{ gap: 8, minHeight: 44, cursor: 'pointer' }}>
              <input type="radio" name="pens" checked={form.hasPens === v} onChange={() => setForm(f => ({ ...f, hasPens: v }))} style={{ width: 20, height: 20, accentColor: 'var(--green-700)' }} />
              {v === 'yes' ? t.join.yes : t.join.notYet}
            </label>
          ))}
        </div>
      </fieldset>
      <JoinPhotos photos={photos} onChange={p => { setPhotos(p); setBad(''); }} t={t.join} />
      {err('photos', t.join.photoFailed)}
      <label className="check">
        <input type="checkbox" checked={form.consent} onChange={e => { setForm(f => ({ ...f, consent: e.target.checked })); setBad(''); }} aria-invalid={bad === 'consent'} />
        <span>{t.join.consent}</span>
      </label>
      {err('consent', t.join.consentNeeded)}
      <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
      {state === 'error' && <p className="form-error" role="alert">{t.common.tryAgain}</p>}
      <button type="submit" className="btn btn-red" disabled={state === 'sending'}>{state === 'sending' ? t.common.sending : t.join.send}</button>
    </form>
  );
}
