import type { Metadata } from 'next';
import { Fraunces, Kantumruy_Pro } from 'next/font/google';
import Image from 'next/image';
import '@/styles/globals.css';
import { CONTACT } from '@/lib/contact';
import { DEFAULT_LANG } from '@/lib/i18n/langs';

const body = Kantumruy_Pro({ subsets: ['khmer', 'latin'], weight: ['400', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Fraunces({ subsets: ['latin'], weight: ['700'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = { title: 'Page not found · ខេម ខោវ CamCow' };

/**
 * Any address the site does not have (the root layout is per language, so it
 * cannot show a normal 404). Plain links in the default language.
 */
export default function GlobalNotFound() {
  const home = `/${DEFAULT_LANG}`;
  return (
    <html lang={DEFAULT_LANG} className={`${body.variable} ${display.variable}`} data-scroll-behavior="smooth">
      <body>
        <main className="section">
          <div className="wrap stack" style={{ gap: 18, alignItems: 'flex-start', maxWidth: 720 }}>
            <a href={home} className="brand" aria-label="ខេម ខោវ CamCow">
              <Image src="/logo.png" alt="" width={56} height={56} priority />
              <span>
                <span className="brand-km" lang="km">ខេម ខោវ</span>
                <span className="brand-en">CamCow</span>
              </span>
            </a>
            <h1 className="display h2">We could not find this page.</h1>
            <p className="lead">The address may be old or mistyped. These will help:</p>
            <div className="row" style={{ gap: 10 }}>
              <a className="btn btn-red" href={home}>Home page</a>
              <a className="btn btn-line" href={`${home}/members`}>Farmer Members</a>
              <a className="btn btn-line" href={`${home}/contact`}>Contact us</a>
            </div>
            <p className="muted">Or call us: <a href={`tel:${CONTACT.phoneTel}`}>{CONTACT.phone}</a></p>
          </div>
        </main>
      </body>
    </html>
  );
}
