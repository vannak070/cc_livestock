import Link from 'next/link';
import { Photo } from '@/components/shared/Photo';
import type { FarmCattle } from '@/lib/cattle';
import type { Dict } from '@/lib/i18n';
import { FarmWindows } from './FarmWindows';

const PIN = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

/**
 * One farm's cattle for sale: its photo (with "Available now" or "soon" on it), name and place, a small table of
 * when / how many / what weight, and one next step: "See the farm" (its page has the sales card, naming the farm).
 * No "Ask" button per card: the sales card beside the list (and the phone's call bar) already does that.
 * layout "list" is a compact row for the Cattle page (photo left on wide screens, short photo on top on phones);
 * "row" is a wide feature card for a single farm; "stack" is a card for a grid.
 */
export function FarmSaleCard({ group, t, lang, layout = 'stack', nameHref, selected, priority = false }: {
  /** Load the photo straight away (the first card on the page). */
  priority?: boolean;
  group: FarmCattle;
  t: Pick<Dict, 'cattle' | 'common' | 'values'>;
  lang: 'km' | 'en';
  layout?: 'list' | 'row' | 'stack';
  nameHref?: string;
  selected?: boolean;
}) {
  const { farm, windows } = group;
  const first = windows[0]?.availability ?? 'soon';
  return (
    <article className={`sale-card lift${layout === 'row' ? ' sale-row' : layout === 'list' ? ' sale-list-item' : ''}`} style={selected ? { boxShadow: '0 0 0 3px var(--green)' } : undefined}>
      <div className="sale-photo">
        <Photo id={farm.photoIds[0]} alt={farm.publicName} height={220} size="large" priority={priority} />
        <span className={`sale-flag sale-flag-${first}`}><span className={`win-dot win-${first}`} aria-hidden="true" />{first === 'now' ? t.common.availNow : t.common.availSoon}</span>
      </div>
      <div className="sale-body">
        <div className="stack" style={{ gap: 6 }}>
          <h3 className="sale-name">{nameHref ? <Link href={nameHref}>{farm.publicName}</Link> : farm.publicName}</h3>
          <p className="sale-where">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PIN} /></svg>
            {farm.district} · {lang === 'km' ? farm.provinceKm : farm.province}
          </p>
        </div>
        <FarmWindows windows={windows} t={t} lang={lang} />
        <p className="sale-note"><span aria-hidden="true">✓</span> {t.cattle.vetChecked}</p>
        <div className="sale-action">
          {nameHref && <Link className="btn btn-line" href={nameHref}>{t.cattle.seeFarm} <span aria-hidden="true">→</span></Link>}
        </div>
      </div>
    </article>
  );
}
