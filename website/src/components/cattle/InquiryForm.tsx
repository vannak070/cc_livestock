'use client';

import { useState } from 'react';
import { BUYER_TYPES, checkInquiry, WEIGHT_CLASSES } from '@/lib/forms/validate';
import type { Dict } from '@/lib/i18n';

export interface ListingOption { id: string; label: string }

/** "Ask for a price": goes to the CamCow office (and its Telegram group). Never shows a price. */
export function InquiryForm({ t, lang, listings, about, onAboutChange }: {
  t: Pick<Dict, 'inquiry' | 'common' | 'values'>;
  lang: 'km' | 'en';
  listings: ListingOption[];
  about: string;
  onAboutChange: (id: string) => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', buyerType: 'trader', quantity: '', weightClass: '', message: '', website: '' });
  const [bad, setBad] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm(f => ({ ...f, [k]: e.target.value })); setBad(''); };

  const send = async () => {
    const raw = { ...form, listingId: about, language: lang };
    const checked = checkInquiry(raw);
    if (!checked.ok) { setBad(checked.field); return; }
    setState('sending');
    try {
      const res = await fetch('/public/v1/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(raw) });
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
        <b>{t.inquiry.thanksTitle}</b>
        <p>{t.inquiry.thanksBody}</p>
        <button type="button" className="btn btn-line" style={{ alignSelf: 'flex-start' }} onClick={() => { setForm(f => ({ ...f, quantity: '', message: '' })); setState('idle'); }}>{t.inquiry.again}</button>
      </div>
    );
  }

  const err = (field: string) => (bad === field ? <span className="form-error">{t.common.required}</span> : null);
  return (
    <form className="stack" style={{ gap: 12 }} noValidate onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="field">{t.inquiry.name}<input className="input" value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={bad === 'name'} />{err('name')}</label>
      <label className="field">{t.inquiry.phone}<input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" aria-invalid={bad === 'phone'} />{err('phone')}</label>
      <label className="field">{t.inquiry.buyerType}
        <select className="select" value={form.buyerType} onChange={set('buyerType')}>{BUYER_TYPES.map((v, i) => <option key={v} value={v}>{t.inquiry.buyerTypes[i]}</option>)}</select>
      </label>
      {listings.length > 0 && (
        <label className="field">{t.inquiry.about}
          <select className="select" value={about} onChange={e => onAboutChange(e.target.value)}>
            <option value="">{t.inquiry.any}</option>
            {listings.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label className="field">{t.inquiry.howMany}<input className="input" value={form.quantity} onChange={set('quantity')} inputMode="numeric" aria-invalid={bad === 'quantity'} />{err('quantity')}</label>
        <label className="field">{t.inquiry.weightClass}
          <select className="select" value={form.weightClass} onChange={set('weightClass')}>
            <option value="">{t.inquiry.any}</option>
            {WEIGHT_CLASSES.map(w => <option key={w} value={w}>{t.values.weight[w] ?? w}</option>)}
          </select>
        </label>
      </div>
      <label className="field">{t.inquiry.message}<textarea className="textarea" value={form.message} onChange={set('message')} maxLength={1000} /></label>
      <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
      {state === 'error' && <p className="form-error" role="alert">{t.common.tryAgain}</p>}
      <button type="submit" className="btn btn-red" disabled={state === 'sending'}>{state === 'sending' ? t.common.sending : t.inquiry.send}</button>
      <p className="small muted">{t.inquiry.privacy}</p>
    </form>
  );
}
