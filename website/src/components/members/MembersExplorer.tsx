'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Photo } from '@/components/shared/Photo';
import type { PublicFarm } from '@/lib/snapshot/types';
import { MembersMap } from './MembersMap';

export interface MembersText {
  province: string;
  allProvinces: string;
  onlyAvailable: string;
  breed: string;
  allBreeds: string;
  onlyNew: string;
  count: string;
  countOne: string;
  pinNote: string;
  noMatch: string;
  memberSince: string;
  cattleAvailable: string;
}

/**
 * Farmer Members: province chips, breed, "has cattle available" and "new
 * members" filters, the map and the list, all filtered together. Choosing a
 * farm in one highlights it in the other. "New" = member since `newSince`
 * (last year or this year), the only join date the public snapshot has.
 */
export function MembersExplorer({ farms, lang, t, profileHref, sizeText, badgeText, newSince }: {
  farms: PublicFarm[];
  lang: 'km' | 'en';
  newSince: number;
  t: MembersText;
  profileHref: Record<string, string>;
  sizeText: Record<string, string>;
  badgeText: Record<string, string>;
}) {
  const [province, setProvince] = useState('');
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [breed, setBreed] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const provinces = useMemo(() => [...new Map(farms.map(f => [f.province, lang === 'km' ? f.provinceKm : f.province])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [farms, lang]);
  const breeds = useMemo(() => [...new Set(farms.flatMap(f => f.breeds))].sort((a, b) => a.localeCompare(b)), [farms]);
  const anyNew = farms.some(f => (f.memberSince ?? 0) >= newSince);
  const shown = useMemo(() => farms.filter(f =>
    (!province || f.province === province) && (!onlyAvail || f.hasCattleAvailable) && (!breed || f.breeds.includes(breed)) && (!onlyNew || (f.memberSince ?? 0) >= newSince)
  ), [farms, province, onlyAvail, breed, onlyNew, newSince]);
  const check = { width: 20, height: 20, accentColor: 'var(--green-700)' };
  const countText = shown.length === 1 ? t.countOne : t.count.replace('{n}', String(shown.length));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="chips" role="group" aria-label={t.province}>
        <button type="button" className="chip" aria-pressed={!province} onClick={() => { setProvince(''); setPicked(null); }}>{t.allProvinces}</button>
        {provinces.map(([key, label]) => (
          <button key={key} type="button" className="chip" aria-pressed={province === key} onClick={() => { setProvince(key); setPicked(null); }}>{label}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {breeds.length > 1 && (
          <label className="row" style={{ gap: 8 }}>
            <span>{t.breed}</span>
            <select className="select" value={breed} onChange={e => { setBreed(e.target.value); setPicked(null); }} style={{ width: 'auto', minWidth: 160 }}>
              <option value="">{t.allBreeds}</option>
              {breeds.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        )}
        <label className="row" style={{ gap: 8, minHeight: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyAvail} onChange={e => setOnlyAvail(e.target.checked)} style={check} />
          {t.onlyAvailable}
        </label>
        {anyNew && (
          <label className="row" style={{ gap: 8, minHeight: 44, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyNew} onChange={e => { setOnlyNew(e.target.checked); setPicked(null); }} style={check} />
            {t.onlyNew.replace('{year}', String(newSince))}
          </label>
        )}
      </div>
      <div className="split">
        <div className="main">
          <MembersMap farms={shown} selected={picked} onSelect={setPicked} note={t.pinNote} height={520} />
        </div>
        <div className="side stack" style={{ gap: 12 }}>
          <span className="muted small" aria-live="polite">{countText}</span>
          {shown.length === 0 && <p className="empty">{t.noMatch}</p>}
          <ul className="stack" style={{ gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
            {shown.map(f => {
              const on = picked === f.slug;
              return (
                <li key={f.slug}>
                  <Link
                    href={profileHref[f.slug]}
                    onMouseEnter={() => setPicked(f.slug)}
                    onFocus={() => setPicked(f.slug)}
                    className="card lift"
                    style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, textDecoration: 'none', color: 'var(--ink)', boxShadow: on ? '0 0 0 3px var(--green), 0 10px 24px rgba(10,68,36,.14)' : undefined }}
                  >
                    <div style={{ width: 84, flex: 'none' }}><Photo id={f.photoIds[0]} alt="" height={84} size="small" /></div>
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <b style={{ fontSize: 18 }}>{f.publicName}</b>
                      <span style={{ color: 'var(--ink-2)', fontSize: 15 }}>{lang === 'km' ? f.provinceKm : f.province} · {f.district}</span>
                      <span className="small muted">{[f.breeds.join(', '), sizeText[f.sizeRange] ?? f.sizeRange, f.memberSince ? t.memberSince.replace('{year}', String(f.memberSince)) : ''].filter(Boolean).join(' · ')}</span>
                      <span className="row" style={{ gap: 6 }}>
                        {f.hasCattleAvailable && <span className="pill pill-now">{t.cattleAvailable}</span>}
                        {f.badges.map(b => <span key={b} className="pill pill-badge">✓ {badgeText[b] ?? b}</span>)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
