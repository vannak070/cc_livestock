import type { Dict } from '@/lib/i18n';
import { weightRangeText } from '@/lib/cattle';
import type { PublicListing } from '@/lib/snapshot/types';

/**
 * A farm's cattle for sale as a small table, one row per time window: when ("Now" with a green dot, "Soon" with an
 * amber one; short words, the column is headed "When"), the rounded head count and the weight range. Plain text, not
 * chips: nothing here can be tapped.
 */
export function FarmWindows({ windows, t, lang }: { windows: PublicListing[]; t: Pick<Dict, 'cattle' | 'common' | 'values'>; lang: 'km' | 'en' }) {
  return (
    <table className="win-table">
      <thead>
        <tr><th scope="col">{t.cattle.when}</th><th scope="col">{t.cattle.headCol}</th><th scope="col">{t.cattle.weightCol}</th></tr>
      </thead>
      <tbody>
        {windows.map(w => (
          <tr key={w.availability}>
            <th scope="row"><span className={`win-dot win-${w.availability}`} aria-hidden="true" />{w.availability === 'now' ? t.cattle.nowShort : t.cattle.soonShort}</th>
            <td>{t.values.count[w.headCount] ?? w.headCount}</td>
            <td>{weightRangeText(w.weightFrom, w.weightTo, t.values.range, lang)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
