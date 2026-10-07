'use client';

import { useMemo, useState } from 'react';
import { groupByFarm, weightRangeText } from '@/lib/cattle';
import { href, type Dict } from '@/lib/i18n';
import type { PublicFarm, PublicListing } from '@/lib/snapshot/types';
import { FarmSaleCard } from './FarmSaleCard';
import { InquiryForm } from './InquiryForm';

/**
 * Cattle for sale, by farm: which member farms have cattle ready, and when
 * ("now" or "soon", from the farms' selling schedules), with a rounded count
 * and a weight range. No breed, sex or individual animal. The price form sits beside.
 */
export function CattleExplorer({ cattle, farms, t, lang, initialAbout }: {
  cattle: PublicListing[];
  farms: PublicFarm[];
  t: Pick<Dict, 'cattle' | 'inquiry' | 'common' | 'values'>;
  lang: 'km' | 'en';
  initialAbout: string;
}) {
  const groups = useMemo(() => groupByFarm(cattle, farms), [cattle, farms]);
  const [f, setF] = useState({ province: '', when: '' });
  const [about, setAbout] = useState(groups.some(g => g.listingId === initialAbout) ? initialAbout : '');
  const shown = useMemo(() => groups.filter(g =>
    (!f.province || g.farm.province === f.province) && (!f.when || g.windows.some(w => w.availability === f.when))
  ), [groups, f]);
  const provinces = [...new Map(groups.map(g => [g.farm.province, lang === 'km' ? g.farm.provinceKm : g.farm.province])).entries()];
  const pick = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));
  const filter = (k: keyof typeof f, name: string, values: [string, string][]) => (
    <label className="field">{name}
      <select className="select" value={f[k]} onChange={pick(k)}>
        <option value="">{t.cattle.all}</option>
        {values.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  // What the price form's "About" list shows for each farm.
  const options = groups.map(g => ({
    id: g.listingId,
    label: [g.farm.publicName, g.windows.map(w => (w.availability === 'now' ? t.common.availNow : t.common.availSoon)).join(' + '), weightRangeText(g.windows[0].weightFrom, g.windows[g.windows.length - 1].weightTo, t.values.range, lang)].join(' · '),
  }));

  return (
    <div className="split">
      <div className="main stack" style={{ gap: 20 }}>
        {groups.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {filter('province', t.cattle.province, provinces)}
            {filter('when', t.cattle.when, [['now', t.common.availNow], ['soon', t.common.availSoon]])}
          </div>
        )}
        {groups.length === 0 && (
          <div className="stack" style={{ gap: 18 }}>
            <p className="empty" style={{ fontSize: 18 }}>{t.cattle.none}</p>
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
        <div className="sale-grid" data-count={shown.length}>
          {shown.map(g => (
            <FarmSaleCard
              key={g.farm.slug}
              group={g}
              t={t}
              lang={lang}
              nameHref={href(lang, `/members/${g.farm.slug}`)}
              selected={about === g.listingId}
              action={<a href="#inquiry" className="btn btn-red" onClick={() => setAbout(g.listingId)}>{t.cattle.askFarm}</a>}
            />
          ))}
        </div>
        {groups.length > 0 && <p className="small muted">{t.cattle.roundedNote}</p>}
      </div>
      <aside className="side" id="inquiry">
        <div className="card form-card stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 22 }}>{groups.length ? t.inquiry.title : t.inquiry.notifyTitle}</h2>
          {groups.length === 0 && <p style={{ color: 'var(--ink-2)', margin: 0 }}>{t.inquiry.notifyIntro}</p>}
          <InquiryForm t={t} lang={lang} kind={groups.length ? 'price' : 'notify'} listings={options} about={about} onAboutChange={setAbout} />
        </div>
      </aside>
    </div>
  );
}
