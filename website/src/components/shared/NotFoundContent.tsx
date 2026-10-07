'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_LANG, getDict, href, isLang } from '@/lib/i18n';

/** "We could not find this page", in the address's language, with ways onward. */
export function NotFoundContent() {
  const first = (usePathname() || '').split('/')[1] ?? '';
  const lang = isLang(first) ? first : DEFAULT_LANG;
  const t = getDict(lang);
  return (
    <section className="section">
      <div className="wrap stack" style={{ gap: 16, alignItems: 'flex-start', maxWidth: 720 }}>
        <h1 className="display h2">{t.notFound.title}</h1>
        <p className="lead">{t.notFound.body}</p>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn btn-red" href={href(lang)}>{t.notFound.home}</Link>
          <Link className="btn btn-line" href={href(lang, '/members')}>{t.nav.members}</Link>
          <Link className="btn btn-line" href={href(lang, '/contact')}>{t.nav.contact}</Link>
        </div>
      </div>
    </section>
  );
}
