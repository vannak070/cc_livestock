import Image from 'next/image';
import Link from 'next/link';
import { href, type Dict, type Lang } from '@/lib/i18n';
import { ABOUT } from '@/lib/about';
import { CONTACT } from '@/lib/contact';
import { FooterBand } from './FooterBand';

const icon = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  telegram: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  up: 'M12 19V5M5 12l7-7 7 7',
};

function Icon({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/**
 * Site footer: a join band (not on pages that already end with one), then brand, pages, "for you" shortcuts and
 * contact, then the privacy promise and copyright. Pages that are empty or
 * not ready (Stories, About us) are left out, like in the header.
 */
export function Footer({ lang, t, hasNews }: { lang: Lang; t: Dict; hasNews: boolean }) {
  const f = t.footer;
  return (
    <footer className="footer" id="contact">
      <FooterBand
        title={f.ctaTitle}
        sub={f.ctaSub}
        joinHref={href(lang, '/join')}
        joinLabel={t.home.ctaJoin}
      />

      <div className="wrap footer-in">
        <div className="stack footer-brand" style={{ gap: 10 }}>
          <Link href={href(lang)} className="row" style={{ gap: 12, flexWrap: 'nowrap' }} aria-label={`${t.brand.km} ${t.brand.en}`}>
            <Image src="/logo.png" alt="" width={60} height={60} style={{ borderRadius: '50%', background: '#fff' }} />
            <span className="stack" style={{ gap: 0 }}>
              <span lang="km" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' }}>{t.brand.km}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--green-700)' }}>{t.brand.en}</span>
            </span>
          </Link>
          <p style={{ color: 'var(--ink-2)', margin: 0, maxWidth: '36ch' }}>{f.tagline}</p>
        </div>

        <nav className="stack" style={{ gap: 10 }} aria-label={f.explore}>
          <b>{f.explore}</b>
          <Link href={href(lang, '/members')}>{t.nav.members}</Link>
          <Link href={href(lang, '/cattle')}>{t.nav.cattle}</Link>
          <Link href={href(lang, '/#how')}>{t.nav.how}</Link>
          {hasNews && <Link href={href(lang, '/news')}>{t.nav.news}</Link>}
          {ABOUT.ready && <Link href={href(lang, '/about')}>{t.nav.about}</Link>}
          <Link href={href(lang, '/contact')}>{t.nav.contact}</Link>
        </nav>

        <nav className="stack" style={{ gap: 10 }} aria-label={f.forYou}>
          <b>{f.forYou}</b>
          <Link href={href(lang, '/join')}>{f.forFarmers}</Link>
          <Link href={`${href(lang, '/cattle')}#inquiry`}>{f.forBuyers}</Link>
          <Link href={`${href(lang, '/join')}?role=investor#apply`}>{f.forInvestors}</Link>
        </nav>

        <div className="stack" style={{ gap: 10 }}>
          <b>{f.contact}</b>
          <a className="footer-line" href={`tel:${CONTACT.phoneTel}`}><Icon d={icon.phone} />{CONTACT.phone}</a>
          {CONTACT.telegram && <a className="footer-line" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer"><Icon d={icon.telegram} />Telegram</a>}
          <a className="footer-line" href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${t.common.facebook}: ខេម ខោវ Cam Cow`}><Icon d={icon.facebook} /><span><span lang="km">ខេម ខោវ</span> Cam Cow</span></a>
          {ABOUT.mapLink
            ? <a className="footer-line" href={ABOUT.mapLink} target="_blank" rel="noopener noreferrer"><Icon d={icon.pin} />{ABOUT.address || t.contact.officeText}</a>
            : <span className="footer-line"><Icon d={icon.pin} />{ABOUT.address || t.contact.officeText}</span>}
          {ABOUT.hours && <span className="footer-line"><Icon d={icon.clock} />{ABOUT.hours}</span>}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="wrap footer-bottom-in">
          <span>{f.rights.replace('{year}', String(new Date().getFullYear()))}</span>
          <a href="#top" className="footer-line"><Icon d={icon.up} />{f.top}</a>
        </div>
      </div>
    </footer>
  );
}
