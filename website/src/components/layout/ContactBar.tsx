import { CONTACT } from '@/lib/contact';
import type { Dict } from '@/lib/i18n';

/**
 * Phones only: Call (and Telegram, once CONTACT.telegram is set) always in
 * reach at the bottom of the screen. Farmers call or message more often than
 * they fill in forms.
 */
export function ContactBar({ t }: { t: Pick<Dict, 'common'> }) {
  return (
    <nav className="contact-bar" aria-label={t.common.phone}>
      <a className="btn btn-red" href={`tel:${CONTACT.phoneTel}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
        {t.common.callUs}
      </a>
      {CONTACT.telegram && (
        <a className="btn btn-line" href={CONTACT.telegram} rel="noopener noreferrer" target="_blank">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          Telegram
        </a>
      )}
    </nav>
  );
}
