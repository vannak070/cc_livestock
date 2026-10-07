import type { Dict } from '@/lib/i18n';
import { weightRangeText } from '@/lib/cattle';
import type { PublicListing } from '@/lib/snapshot/types';

/** A farm's cattle for sale by time window: "Available now" or "soon", a rounded head count and a weight range. */
export function FarmWindows({ windows, t, lang }: { windows: PublicListing[]; t: Pick<Dict, 'common' | 'values'>; lang: 'km' | 'en' }) {
  return (
    <ul className="stack" style={{ gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
      {windows.map(w => (
        <li key={w.availability} className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span className={`pill ${w.availability === 'now' ? 'pill-now' : 'pill-soon'}`}>{w.availability === 'now' ? t.common.availNow : t.common.availSoon}</span>
          <span style={{ color: 'var(--ink-2)' }}>{t.values.count[w.headCount] ?? w.headCount} · {weightRangeText(w.weightFrom, w.weightTo, t.values.range, lang)}</span>
        </li>
      ))}
    </ul>
  );
}
