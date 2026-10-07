import Image from 'next/image';
import Link from 'next/link';
import { href, type Dict, type Lang } from '@/lib/i18n';
import { CONTACT } from '@/lib/contact';

export function Footer({ lang, t, hasNews }: { lang: Lang; t: Dict; hasNews: boolean }) {
  return (
    <footer className="footer" id="contact">
      <div className="wrap footer-in">
        <div className="stack" style={{ gap: 8 }}>
          <Image src="/logo.png" alt="" width={72} height={72} style={{ borderRadius: '50%', background: '#fff' }} />
          <span lang="km" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{t.brand.km}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--green-700)' }}>{t.brand.en}</span>
          <span className="muted small">{t.brand.company}</span>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <b>{t.footer.contact}</b>
          <a href={`tel:${CONTACT.phoneTel}`}>{CONTACT.phone}</a>
          {CONTACT.telegram && <a href={CONTACT.telegram}>Telegram</a>}
          <a href={CONTACT.facebook} rel="noopener noreferrer" target="_blank">{t.common.facebook}: ខេម ខោវ Cam Cow</a>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <b>{t.footer.explore}</b>
          <Link href={href(lang, '/members')}>{t.nav.members}</Link>
          <Link href={href(lang, '/cattle')}>{t.nav.cattle}</Link>
          <Link href={href(lang, '/join')}>{t.nav.join}</Link>
          {hasNews && <Link href={href(lang, '/news')}>{t.nav.news}</Link>}
        </div>
      </div>
      <div className="wrap muted small" style={{ paddingBottom: 24 }}>{t.footer.rights}</div>
    </footer>
  );
}
