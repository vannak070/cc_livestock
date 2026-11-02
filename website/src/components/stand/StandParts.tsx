import Image from 'next/image';
import Link from 'next/link';
import { partnerLogo, shownPartners } from '@/lib/partners';
import { siteImages } from '@/lib/site-images';
import { LEADERS } from '@/lib/about';
import { KmWords } from '@/components/shared/KmWords';
import type { Dict } from '@/lib/i18n';

/**
 * Pieces in the look of CamCow's printed stands (navy panels, green icon circles, a green rule under headings):
 * used on the About page and the Farm loans page. Text comes from the `stand` and `loan` sections of the dictionary.
 */

const P = {
  seedling: 'M12 21v-9 M12 12c0-4 3-6 7-6 0 4-3 6-7 6z M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z',
  bag: 'M6 8h12l-1 13H7z M9 8V6a3 3 0 0 1 6 0v2',
  heart: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z M12 10v5 M9.5 12.5h5',
  barn: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-5h4v5',
  box: 'M4 8h16v12H4z M9 8V5h6v3 M9 14l2 2 4-4',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  truck: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19a2 2 0 1 0 0-.01 M17 19a2 2 0 1 0 0-.01',
  leaf: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14z M5 19l8-8',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
  check: 'M4 12l5 5L20 6',
  farmer: 'M7 21v-3a5 5 0 0 1 10 0v3 M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 6h12',
  bank: 'M3 10l9-6 9 6 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 21h18',
  cash: 'M3 7h18v10H3z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  percent: 'M19 5 5 19 M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  repeat: 'M17 3l3 3-3 3 M4 11V9a3 3 0 0 1 3-3h13 M7 21l-3-3 3-3 M20 13v2a3 3 0 0 1-3 3H4',
};
export type StandIconName = keyof typeof P;

export function StandIcon({ name, size = 22 }: { name: StandIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>;
}

/** A sub-heading inside a section (one size below SectionHead), e.g. "Three partners" in the farm loan. */
export function StandHeading({ text }: { text: string }) {
  return <h3 className="display h3"><KmWords text={text} /></h3>;
}

/** Vision (first leader's photo, green) and mission (second leader's photo, navy), as on stand 1: two photo cards. */
export async function VisionMission({ t, lang }: { t: Pick<Dict, 'stand'>; lang: 'km' | 'en' }) {
  const img = await siteImages();
  const [vision, mission] = LEADERS;
  const card = (kind: 'vision' | 'mission', l: (typeof LEADERS)[number] | undefined, title: string, text: string) => (
    <article className={`vm-card vm-${kind}`}>
      {l && (
        <figure className="vm-photo">
          <Image src={img[l.photo]} alt={l.name[lang]} width={631} height={840} sizes="(max-width: 760px) 100vw, 560px" style={{ objectFit: 'cover' }} />
          {l.name[lang] && <figcaption><b>{l.name[lang]}</b>{l.title[lang] && <span>{l.title[lang]}</span>}</figcaption>}
        </figure>
      )}
      <div className="vm-body">
        <h3><span className="st-dot"><StandIcon name={kind === 'vision' ? 'eye' : 'target'} size={18} /></span><KmWords text={title} /></h3>
        <p>{text}</p>
      </div>
    </article>
  );
  return (
    <div className="vm-grid">
      {card('vision', vision, t.stand.visionTitle, t.stand.vision)}
      {card('mission', mission, t.stand.missionTitle, t.stand.mission)}
    </div>
  );
}

const VALUE_ICONS: StandIconName[] = ['shield', 'check', 'farmer'];
/** The three values as numbered cards. */
export function ValueCards({ t }: { t: Pick<Dict, 'stand'> }) {
  return (
    <ol className="val-cards">
      {t.stand.values.map((v, i) => (
        <li key={v.title}>
          <span className="val-no">{String(i + 1).padStart(2, '0')}</span>
          <span className="st-dot st-dot-lg"><StandIcon name={VALUE_ICONS[i % VALUE_ICONS.length]} /></span>
          <b>{v.title}</b>
          <span>{v.body}</span>
        </li>
      ))}
    </ol>
  );
}

const CHAIN_ICONS: StandIconName[] = ['seedling', 'bag', 'heart', 'barn', 'box'];
/** The production chain: five circles joined by a green line. */
export function ValueChain({ t }: { t: Pick<Dict, 'stand'> }) {
  return (
    <ol className="st-chain">
      {t.stand.chain.map((c, i) => (
        <li key={c}><span className="st-circle"><StandIcon name={CHAIN_ICONS[i % CHAIN_ICONS.length]} size={28} /></span><b>{c}</b></li>
      ))}
    </ol>
  );
}

const WHY_ICONS: StandIconName[] = ['home', 'truck', 'leaf', 'shield'];
/** "Why choose CamCow beef?": a navy panel with four boxes, as on stand 2. */
export function WhyPanel({ t }: { t: Pick<Dict, 'stand'> }) {
  return (
    <div className="st-why">
      <div className="st-why-head">
        <h2 className="display h3"><KmWords text={t.stand.whyTitle} /></h2>
        <p>{t.stand.whySub}</p>
      </div>
      <ul>
        {t.stand.why.map((w, i) => (
          <li key={w.title}>
            <span className="st-dot st-dot-lg"><StandIcon name={WHY_ICONS[i % WHY_ICONS.length]} /></span>
            <b>{w.title}</b>
            <span>{w.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FARM_SLOTS = ['farm-shed', 'farm-grazing', 'farm-feeding'] as const;
/**
 * Healthy farms (stand 2), For farmers page: the three farm photos as one large and two small (captions on the
 * photos) beside the farming standards as a numbered list; both sides end level.
 */
export async function HealthyFarms({ t }: { t: Pick<Dict, 'stand'> }) {
  const img = await siteImages();
  return (
    <div className="hf">
      <ul className="hf-photos">
        {t.stand.farmPhotos.map((cap, i) => (
          <li key={cap} className={`hf-photo hf-photo-${i}`}>
            <Image src={img[FARM_SLOTS[i]]} alt="" fill sizes={i === 0 ? '(max-width: 900px) 100vw, 560px' : '(max-width: 900px) 50vw, 280px'} />
            <span>{cap}</span>
          </li>
        ))}
      </ul>
      <div className="hf-standards">
        <h3>{t.stand.standardsTitle}</h3>
        <ol>
          {t.stand.standards.map(s => <li key={s}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}

/** The partners named on the stands (Techo farmers' network, ARDB Bank), as a small logo row. */
export async function PartnerStrip({ t, lang }: { t: Pick<Dict, 'stand'>; lang: 'km' | 'en' }) {
  const img = await siteImages();
  const partners = shownPartners().filter(p => p.key !== 'camcow');
  if (partners.length === 0) return null;
  return (
    <div className="st-partners">
      <span className="st-partners-label">{t.stand.partnersTitle}</span>
      <ul>
        {partners.map(p => {
          const inner = <><Image src={partnerLogo(p, img)} alt="" width={56} height={56} style={{ objectFit: 'contain' }} /><span><small>{p.tag[lang]}</small><b>{p.name[lang]}</b></span></>;
          return <li key={p.key}>{p.link ? <a href={p.link} target="_blank" rel="noopener noreferrer">{inner}</a> : <span className="st-partner">{inner}</span>}</li>;
        })}
      </ul>
    </div>
  );
}

/** A navy teaser for the Farm loans page (stand 3), with the ARDB logo and two of the loan terms. */
export async function LoanTeaser({ t, to }: { t: Pick<Dict, 'loan'>; to: string }) {
  const img = await siteImages();
  return (
    <div className="ln-teaser">
      <Image src={img['partner-ardb']} alt="" width={84} height={84} className="ln-party-logo" style={{ objectFit: 'contain' }} />
      <div className="stack" style={{ gap: 8, minWidth: 0 }}>
        <span className="ln-party-label" style={{ justifySelf: 'start', alignSelf: 'flex-start' }}>{t.loan.title}</span>
        <h3><KmWords text={t.loan.pageTitle} /></h3>
        <p>{t.loan.sub}</p>
        <div className="row" style={{ gap: 8 }}>
          {[t.loan.features[0], t.loan.features[2]].map(f => <span key={f.label} className="ln-chip">{f.label}: <b>{f.value}</b></span>)}
        </div>
      </div>
      <Link className="btn btn-line" href={to}>{t.loan.cta} <span aria-hidden="true">→</span></Link>
    </div>
  );
}
