'use client';

import { useMemo, useState } from 'react';
import { Photo } from '@/components/shared/Photo';
import type { Dict } from '@/lib/i18n';
import type { PublicListing } from '@/lib/snapshot/types';
import { InquiryForm } from './InquiryForm';

/** Cattle available: filters, cards, and the price form beside them. */
export function CattleExplorer({ cattle, farmNames, t, lang, initialAbout }: {
  cattle: PublicListing[];
  farmNames: Record<string, string>;
  t: Pick<Dict, 'cattle' | 'inquiry' | 'common' | 'values'>;
  lang: 'km' | 'en';
  initialAbout: string;
}) {
  const [f, setF] = useState({ breed: '', sex: '', weight: '', province: '', when: '' });
  const [about, setAbout] = useState(cattle.some(c => c.listingId === initialAbout) ? initialAbout : '');
  const opts = (k: keyof PublicListing) => [...new Set(cattle.map(c => String(c[k])))].filter(Boolean).sort();
  const shown = useMemo(() => cattle.filter(c =>
    (!f.breed || c.breed === f.breed) && (!f.sex || c.sex === f.sex) && (!f.weight || c.weightClass === f.weight) && (!f.province || c.province === f.province) && (!f.when || c.availability === f.when)
  ), [cattle, f]);
  const label = (c: PublicListing) => [c.breed, t.values.sex[c.sex] ?? c.sex, t.values.weight[c.weightClass] ?? c.weightClass, lang === 'km' ? c.provinceKm : c.province].filter(Boolean).join(' · ');
  const pick = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));
  const filter = (k: keyof typeof f, name: string, values: [string, string][]) => (
    <label className="field">{name}
      <select className="select" value={f[k]} onChange={pick(k)}>
        <option value="">{t.cattle.all}</option>
        {values.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className="split">
      <div className="main stack" style={{ gap: 20 }}>
        {cattle.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {filter('breed', t.cattle.breed, opts('breed').map(v => [v, v]))}
            {filter('sex', t.cattle.sex, opts('sex').map(v => [v, t.values.sex[v] ?? v]))}
            {filter('weight', t.cattle.weight, opts('weightClass').map(v => [v, t.values.weight[v] ?? v]))}
            {filter('province', t.cattle.province, [...new Map(cattle.map(c => [c.province, lang === 'km' ? c.provinceKm : c.province])).entries()])}
            {filter('when', t.cattle.when, [['now', t.common.availNow], ['soon', t.common.availSoon]])}
          </div>
        )}
        {cattle.length === 0 && <p className="empty">{t.cattle.none}</p>}
        {cattle.length > 0 && shown.length === 0 && <p className="empty">{t.cattle.noMatch}</p>}
        <div className="grid">
          {shown.map(c => (
            <article key={c.listingId} className="card lift stack" style={{ gap: 10, boxShadow: about === c.listingId ? '0 0 0 3px var(--green)' : undefined }}>
              <Photo id={c.photoId} alt={c.breed} height={160} size="large" />
              <h2 style={{ fontSize: 19 }}>{[c.breed, t.values.sex[c.sex] ?? c.sex].filter(Boolean).join(' · ')}</h2>
              <p style={{ color: 'var(--ink-2)' }}>{t.values.weight[c.weightClass] ?? c.weightClass} · {t.values.count[c.headCount] ?? c.headCount}</p>
              <p className="small muted">{lang === 'km' ? c.provinceKm : c.province}{farmNames[c.farmSlug] ? ` · ${t.cattle.from.replace('{farm}', farmNames[c.farmSlug])}` : ''}</p>
              <p className="small muted">{t.cattle.vetChecked}</p>
              <span className={`pill ${c.availability === 'now' ? 'pill-now' : 'pill-soon'}`} style={{ alignSelf: 'flex-start' }}>{c.availability === 'now' ? t.common.availNow : t.common.availSoon}</span>
              <a href="#inquiry" className="btn btn-red" onClick={() => setAbout(c.listingId)}>{t.common.askPrice}</a>
            </article>
          ))}
        </div>
        {cattle.length > 0 && <p className="small muted">{t.cattle.roundedNote}</p>}
      </div>
      <aside className="side" id="inquiry">
        <div className="card form-card stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 22 }}>{cattle.length ? t.inquiry.title : t.inquiry.notifyTitle}</h2>
          {cattle.length === 0 && <p style={{ color: 'var(--ink-2)', margin: 0 }}>{t.inquiry.notifyIntro}</p>}
          <InquiryForm t={t} lang={lang} kind={cattle.length ? 'price' : 'notify'} listings={cattle.map(c => ({ id: c.listingId, label: label(c) }))} about={about} onAboutChange={setAbout} />
        </div>
      </aside>
    </div>
  );
}
