import Image from 'next/image';
import Link from 'next/link';
import { href, type Dict, type Lang } from '@/lib/i18n';
import { ABOUT } from '@/lib/about';
import { CONTACT, contactAddress, contactMapLink } from '@/lib/contact';
import { FooterBand } from './FooterBand';

const icon = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  telegram: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  up: 'M12 19V5M5 12l7-7 7 7',
  farmer: 'M12 22V12 M12 12c0-4 3-7 8-7 0 4-3 7-8 7z M12 14c0-3-2.5-5-7-5 0 3 2.5 5 7 5z',
  buyer: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01',
  investor: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9m0-18C9.5 5.4 8.2 8.4 8.2 12s1.3 6.6 3.8 9M3.5 9h17M3.5 15h17',
};

function Icon({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/**
 * Site footer (navy): a join band (not on pages that already end with one), then brand (tagline, website, office
 * address; the "Working with" partners and the slogan were removed 10-27 at the user's request), three "for you"
 * action rows (farmers, buyers, investors) and contact (big phone number, Telegram, Facebook, Telegram QR on wide
 * screens), then a bottom bar with the page links, copyright and back to top. Pages that are empty or
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
            <Image src="/logo-2026.png" alt="" width={72} height={72} />
            <span className="stack" style={{ gap: 0 }}>
              <span lang="km" className="footer-km">{t.brand.km}</span>
              <span className="footer-en">{t.brand.en}</span>
            </span>
          </Link>
          <p className="footer-tagline">{f.tagline}</p>
          <div className="footer-where">
            <a className="footer-line" href={CONTACT.websiteUrl} target="_blank" rel="noopener noreferrer"><Icon d={icon.web} />{CONTACT.website}</a>
            <a className="footer-line footer-address" href={contactMapLink} target="_blank" rel="noopener noreferrer"><Icon d={icon.pin} /><span lang={lang}>{contactAddress(lang)}</span></a>
          </div>
        </div>

        <nav className="footer-paths" aria-label={f.forYou}>
          <b>{f.forYou}</b>
          {([
            ['farmer', f.forFarmers, href(lang, '/join')],
            ['buyer', f.forBuyers, `${href(lang, '/cattle')}#inquiry`],
            ['investor', f.forInvestors, `${href(lang, '/join')}?role=investor#apply`],
          ] as const).map(([key, p, to]) => (
            <Link key={key} href={to} className="footer-path">
              <span className="fp-icon"><Icon d={icon[key]} /></span>
              <span className="fp-text"><b>{p.label}</b><span>{p.action}</span></span>
              <span className="fp-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>

        <div className="stack footer-contact" style={{ gap: 10 }}>
          <b>{f.contact}</b>
          <a className="footer-line footer-phone" href={`tel:${CONTACT.phoneTel}`}><Icon d={icon.phone} /><span>{CONTACT.phone}<small>{t.about.officeSub}</small></span></a>
          <a className="footer-line" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer"><Icon d={icon.telegram} />Telegram {CONTACT.telegramHandle}</a>
          <a className="footer-line" href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${t.common.facebook}: ${CONTACT.facebookName}`}><Icon d={icon.facebook} /><span><span lang="km">ខេម ខោវ</span> Cam Cow</span></a>
          <a className="footer-qr" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer">
            <Image src={CONTACT.qr} alt="" width={84} height={84} unoptimized />
            <span>{t.contact.scan}<b>{CONTACT.telegramHandle}</b></span>
          </a>
          {ABOUT.hours && <span className="footer-line"><Icon d={icon.clock} />{ABOUT.hours}</span>}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="wrap footer-bottom-in">
          <nav className="footer-links" aria-label={f.explore}>
            <Link href={href(lang, '/members')}>{t.nav.members}</Link>
            <Link href={href(lang, '/cattle')}>{t.nav.cattle}</Link>
            {hasNews && <Link href={href(lang, '/news')}>{t.nav.news}</Link>}
            {ABOUT.ready && <Link href={href(lang, '/about')}>{t.nav.about}</Link>}
            <Link href={href(lang, '/for-farmers')}>{t.nav.forFarmers}</Link>
            <Link href={href(lang, '/contact')}>{t.nav.contact}</Link>
            <Link href={href(lang, '/join')}>{t.nav.join}</Link>
          </nav>
          <span>{f.rights.replace('{year}', String(new Date().getFullYear()))}</span>
          <a href="#top" className="footer-line"><Icon d={icon.up} />{f.top}</a>
        </div>
      </div>
    </footer>
  );
}
