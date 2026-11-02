'use client';

import { useMemo, useState } from 'react';
import { groupByFarm } from '@/lib/cattle';
import { href, type Dict } from '@/lib/i18n';
import type { PublicFarm, PublicListing } from '@/lib/snapshot/types';
import { FarmSaleCard } from './FarmSaleCard';
import { SalesCard } from './SalesCard';

/**
 * Cattle for sale, by farm: which member farms have cattle ready, and when
 * ("now" or "soon", from the farms' selling schedules), with a rounded count
 * and a weight range. No breed, sex or individual animal. A filter bar like the Members page (when as chips with
 * counts, province as a list). The sales card sits beside: buyers call or message the sales team for prices (there
 * is no price form). Each farm row links to its own page (no per-card Ask button).
 */
export function CattleExplorer({ cattle, farms, t, lang, stale = false }: {
  cattle: PublicListing[];
  farms: PublicFarm[];
  t: Pick<Dict, 'cattle' | 'contact' | 'common' | 'values'>;
  lang: 'km' | 'en';
  /** The data is too old to say which cattle are available (see lib/snapshot/stale.ts). */
  stale?: boolean;
}) {
  const groups = useMemo(() => groupByFarm(cattle, farms), [cattle, farms]);
  const [province, setProvince] = useState('');
  const [when, setWhen] = useState('');
  const inProvince = useMemo(() => groups.filter(g => !province || g.farm.province === province), [groups, province]);
  const countWhen = (w: string) => inProvince.filter(g => !w || g.windows.some(x => x.availability === w)).length;
  const shown = inProvince.filter(g => !when || g.windows.some(w => w.availability === when));
  const provinces = [...new Map(groups.map(g => [g.farm.province, lang === 'km' ? g.farm.provinceKm : g.farm.province])).entries()];
  const whens: [string, string][] = [['', t.cattle.all], ['now', t.common.availNow], ['soon', t.common.availSoon]];
  return (
    <div className="split">
      <div className="main stack" style={{ gap: 20 }}>
        {groups.length > 0 && (
          <div className="toolbar">
            <div className="chips chips-wrap" role="group" aria-label={t.cattle.when}>
              {whens.map(([v, label]) => (
                <button key={v || 'all'} type="button" className="chip" aria-pressed={when === v} onClick={() => setWhen(v)}>{label} <span className="chip-n">{countWhen(v)}</span></button>
              ))}
            </div>
            {provinces.length > 1 && (
              <label className="tool-select">
                <select className="select" value={province} onChange={e => setProvince(e.target.value)} aria-label={t.cattle.province}>
                  <option value="">{t.cattle.province}: {t.cattle.all}</option>
                  {provinces.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
        {groups.length === 0 && (
          <div className="stack" style={{ gap: 18 }}>
            <p className="empty" style={{ fontSize: 18 }}>{stale ? t.cattle.stale : t.cattle.none}</p>
            <h2 style={{ fontSize: 24 }}>{t.cattle.expectTitle}</h2>
            <ul className="grid" style={{ listStyle: 'none', margin: 0, padding: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
              {t.cattle.expect.map(e => (
                <li key={e.title} className="card stack" style={{ gap: 6 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#138e46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                  <b style={{ fontSize: 18 }}>{e.title}</b>
                  <span style={{ color: 'var(--ink-2)' }}>{e.body}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {groups.length > 0 && shown.length === 0 && <p className="empty">{t.cattle.noMatch}</p>}
        <div className="sale-list">
          {shown.map((g, idx) => (
            <FarmSaleCard
              key={g.farm.slug}
              priority={idx === 0}
              group={g}
              t={t}
              lang={lang}
              layout="list"
              nameHref={href(lang, `/members/${g.farm.slug}`)}
            />
          ))}
        </div>
        {groups.length > 0 && <p className="small muted">{t.cattle.roundedNote}</p>}
      </div>
      <aside className="side cc-side" id="inquiry">
        <SalesCard t={t} />
      </aside>
    </div>
  );
}
