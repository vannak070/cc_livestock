'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Photo } from '@/components/shared/Photo';
import { breedList, canonicalBreed } from '@/lib/breeds';
import type { PublicFarm } from '@/lib/snapshot/types';
import { MembersMap } from './MembersMap';

export interface MembersText {
  province: string;
  allProvinces: string;
  onlyAvailable: string;
  breed: string;
  allBreeds: string;
  count: string;
  countOne: string;
  pinNote: string;
  noMatch: string;
  memberSince: string;
  cattleAvailable: string;
}

/**
 * Farmer Members: province chips, breed, "has cattle available" and the farm count in one filter bar, then the map
 * and the list side by side (same top, same height; the list scrolls and fades at the bottom), all filtered
 * together. Choosing a farm in one highlights it in the other. List rows stay short: name, place, size and
 * member year, "cattle available"; breeds and record badges are on each farm's page.
 */
export function MembersExplorer({ farms, lang, t, profileHref, sizeText }: {
  farms: PublicFarm[];
  lang: 'km' | 'en';
  t: MembersText;
  profileHref: Record<string, string>;
  sizeText: Record<string, string>;
}) {
  const [province, setProvince] = useState('');
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [breed, setBreed] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const provinces = useMemo(() => [...new Map(farms.map(f => [f.province, lang === 'km' ? f.provinceKm : f.province])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [farms, lang]);
  const breeds = useMemo(() => breedList(farms.map(f => f.breeds), lang), [farms, lang]);
  const shown = useMemo(() => farms.filter(f =>
    (!province || f.province === province) && (!onlyAvail || f.hasCattleAvailable) && (!breed || f.breeds.some(b => canonicalBreed(b) === breed))
  ), [farms, province, onlyAvail, breed]);
  const countIn = (key: string) => farms.filter(f => !key || f.province === key).length;
  const countText = shown.length === 1 ? t.countOne : t.count.replace('{n}', String(shown.length));

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="toolbar">
        <div className="chips" role="group" aria-label={t.province}>
          <button type="button" className="chip" aria-pressed={!province} onClick={() => { setProvince(''); setPicked(null); }}>{t.allProvinces} <span className="chip-n">{countIn('')}</span></button>
          {provinces.map(([key, label]) => (
            <button key={key} type="button" className="chip" aria-pressed={province === key} onClick={() => { setProvince(key); setPicked(null); }}>{label} <span className="chip-n">{countIn(key)}</span></button>
          ))}
        </div>
        <div className="tool-right">
          <span className="list-count" aria-live="polite">{countText}</span>
          {breeds.length > 1 && (
            <label className="tool-select">
              <select className="select" value={breed} onChange={e => { setBreed(e.target.value); setPicked(null); }} aria-label={t.breed}>
                <option value="">{t.breed}: {t.allBreeds}</option>
                {breeds.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="toggle" aria-pressed={onlyAvail} onClick={() => { setOnlyAvail(v => !v); setPicked(null); }}>
            <span className="toggle-dot" aria-hidden="true" />
            {t.onlyAvailable}
          </button>
        </div>
      </div>
      <div className="split members-split">
        <div className="main">
          <MembersMap farms={shown} selected={picked} onSelect={setPicked} note={t.pinNote} height={560} />
        </div>
        <div className="side stack" style={{ gap: 12 }}>
          {shown.length === 0 && <p className="empty">{t.noMatch}</p>}
          <ul className="stack farm-list" style={{ gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
            {shown.map(f => (
              <li key={f.slug}>
                <Link
                  href={profileHref[f.slug]}
                  onMouseEnter={() => setPicked(f.slug)}
                  onFocus={() => setPicked(f.slug)}
                  className={`mf-card${picked === f.slug ? ' on' : ''}`}
                >
                  <span className="mf-card-photo"><Photo id={f.photoIds[0]} alt="" height={84} size="small" /></span>
                  <span className="mf-card-text">
                    <b>{f.publicName}</b>
                    <span className="mf-card-place">{f.district} · {lang === 'km' ? f.provinceKm : f.province}</span>
                    <span className="mf-card-facts">{[sizeText[f.sizeRange] ?? f.sizeRange, f.memberSince ? t.memberSince.replace('{year}', String(f.memberSince)) : ''].filter(Boolean).join(' · ')}</span>
                    {f.hasCattleAvailable && <span className="mf-card-now"><span className="win-dot win-now" aria-hidden="true" />{t.cattleAvailable}</span>}
                  </span>
                  <span className="mf-card-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
