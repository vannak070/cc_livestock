'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ABOUT } from '@/lib/about';
import { ENABLED_LANGS, href, type Dict, type Lang } from '@/lib/i18n';

/** Site header: logo with ខេម ខោវ first, menu, Khmer / English switch. */
export function Header({ lang, t, hasNews }: { lang: Lang; t: Dict; hasNews: boolean }) {
  const pathname = usePathname() || `/${lang}`;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const rest = pathname.replace(/^\/(km|en)/, '') || '/';
  const links: [string, string][] = [
    ['/members', t.nav.members],
    ['/cattle', t.nav.cattle],
    ['/#how', t.nav.how],
    ...(hasNews ? [['/news', t.nav.news] as [string, string]] : []),
    ...(ABOUT.ready ? [['/about', t.nav.about] as [string, string]] : []),
    ['/contact', t.nav.contact],
    // Last, shown as a button.
    ['/join', t.nav.join],
  ];
  const current = (p: string) => (p !== '/#how' && (rest === p || rest.startsWith(`${p}/`)) ? 'page' : undefined);

  return (
    <header className={`header${scrolled ? ' scrolled' : ''}`}>
      <div className="wrap header-in">
        <Link href={href(lang)} className="brand" aria-label={`${t.brand.km} ${t.brand.en}`}>
          <Image src="/logo.png" alt="" width={52} height={52} priority />
          <span>
            <span className="brand-km" lang="km">{t.brand.km}</span>
            <span className="brand-en">{t.brand.en}</span>
          </span>
        </Link>
        <nav className={`nav${open ? ' open' : ''}`} aria-label={t.nav.menu}>
          {links.map(([p, label]) => (
            <Link key={p} href={href(lang, p)} aria-current={current(p)} className={p === '/join' ? 'nav-cta' : undefined} onClick={() => setOpen(false)}>{label}</Link>
          ))}
        </nav>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {ENABLED_LANGS.length > 1 && (
            <div className="lang" role="group" aria-label={t.nav.language}>
              <svg className="lang-globe" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>
              {ENABLED_LANGS.includes('km') && <Link href={`/km${rest === '/' ? '' : rest}`} aria-current={lang === 'km' ? 'true' : undefined} lang="km">ខ្មែរ</Link>}
              <Link href={`/en${rest === '/' ? '' : rest}`} aria-current={lang === 'en' ? 'true' : undefined} lang="en">EN</Link>
            </div>
          )}
          <button type="button" className="menu-btn" aria-expanded={open} aria-label={t.nav.menu} onClick={() => setOpen(o => !o)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
