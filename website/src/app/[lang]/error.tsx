'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { CONTACT } from '@/lib/contact';
import { getDict, href, type Lang } from '@/lib/i18n';

/**
 * Shown instead of a raw "Internal Server Error" when a page fails (for example while CC Livestock cannot be
 * reached and no saved copy exists). The header and footer stay; visitors can retry or call CamCow.
 */
export default function PageError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const params = useParams<{ lang?: string }>();
  const lang: Lang = params?.lang === 'km' ? 'km' : 'en';
  const t = getDict(lang);
  useEffect(() => { console.error('[page error]', error.digest ?? error.message); }, [error]);
  return (
    <section className="section">
      <div className="wrap stack" style={{ gap: 18, maxWidth: 640, textAlign: 'center', alignItems: 'center' }}>
        <Image src="/logo-2026.png" alt="" width={96} height={96} />
        <h1 className="display h2" style={{ margin: 0 }}>{t.errorPage.title}</h1>
        <p className="lead" style={{ margin: 0 }}>{t.errorPage.body}</p>
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <button type="button" className="btn btn-green" onClick={() => unstable_retry()}>{t.errorPage.retry}</button>
          <Link className="btn btn-line" href={href(lang)}>{t.errorPage.home}</Link>
        </div>
        <p style={{ margin: 0 }}>
          <a href={`tel:${CONTACT.phoneTel}`}><b>{CONTACT.phone}</b></a> · <a href={CONTACT.telegram} target="_blank" rel="noopener noreferrer">Telegram {CONTACT.telegramHandle}</a>
        </p>
      </div>
    </section>
  );
}
