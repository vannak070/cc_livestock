import type { Dict } from '@/lib/i18n';
import { weightRangeText } from '@/lib/cattle';
import type { PublicListing } from '@/lib/snapshot/types';

/** A farm's cattle for sale by time window: "Available now" or "soon", then the rounded head count and the weight range as two chips. */
export function FarmWindows({ windows, t, lang }: { windows: PublicListing[]; t: Pick<Dict, 'common' | 'values'>; lang: 'km' | 'en' }) {
  return (
    <ul className="windows">
      {windows.map(w => (
        <li key={w.availability}>
          <span className={`pill ${w.availability === 'now' ? 'pill-now' : 'pill-soon'}`}>{w.availability === 'now' ? t.common.availNow : t.common.availSoon}</span>
          <span className="chips">
            <span className="chip">{t.values.count[w.headCount] ?? w.headCount}</span>
            <span className="chip">{weightRangeText(w.weightFrom, w.weightTo, t.values.range, lang)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
