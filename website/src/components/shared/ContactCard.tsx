import Image from 'next/image';
import { CONTACT, contactAddress } from '@/lib/contact';
import type { Dict } from '@/lib/i18n';

const PATH = {
  telegram: 'M21.5 4.5 2.9 11.7c-1 .4-1 1.6 0 1.9l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.8 3.5c.6.4 1.4.1 1.6-.6l3.2-15.3c.2-1-.7-1.7-1.6-1.3zM9.9 14.9l-.4 3.6-1.3-4.1 9.6-6.1-7.9 6.6z',
  facebook: 'M15.1 8.3h-1.6c-.6 0-.8.3-.8.9v1.4h2.4l-.3 2.4h-2.1V19h-2.6v-6H8.6v-2.4h1.5V9c0-2 1.2-3.1 3-3.1.8 0 1.6.1 2 .1v2.3z',
  web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9m0-18C9.5 5.4 8.2 8.4 8.2 12s1.3 6.6 3.8 9M3.5 9h17M3.5 15h17',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
};

/** A round coloured badge with an icon, like on CamCow's printed contact card. */
function Badge({ kind }: { kind: 'telegram' | 'facebook' | 'web' }) {
  const bg = kind === 'web' ? '#138e46' : kind === 'telegram' ? '#229ed9' : '#1877f2';
  return (
    <span className="cc-badge" style={{ background: bg }} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill={kind === 'web' ? 'none' : '#fff'} stroke={kind === 'web' ? '#fff' : 'none'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PATH[kind]} /></svg>
    </span>
  );
}

/**
 * CamCow's contact details in the look of its printed contact card: the Telegram QR, Telegram, Facebook, website,
 * the phone in large type and the office (Contact and About pages). Beside a list (Cattle, a farm page, Join as a
 * buyer) the lighter cattle/SalesCard is used instead. Prices are never shown: buyers call or message the sales team.
 */
export function ContactCard({ lang, t }: {
  lang: 'km' | 'en';
  t: Pick<Dict, 'contact' | 'common'>;
}) {
  const rows = (
    <ul className="cc-rows">
      <li><a href={CONTACT.telegram} target="_blank" rel="noopener noreferrer"><Badge kind="telegram" /><span>{CONTACT.telegramHandle}</span></a></li>
      <li><a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label={`${t.common.facebook}: ${CONTACT.facebookName}`}><Badge kind="facebook" /><span><span lang="km">ខេម ខោវ</span> Cam Cow</span></a></li>
      <li><a href={CONTACT.websiteUrl} target="_blank" rel="noopener noreferrer"><Badge kind="web" /><span>{CONTACT.website}</span></a></li>
    </ul>
  );
  const phone = (
    <a className="cc-phone" href={`tel:${CONTACT.phoneTel}`} aria-label={`${t.common.phone}: ${CONTACT.phone}`}>
      <span className="cc-phone-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d={PATH.phone} /></svg></span>
      <span>{CONTACT.phone}</span>
    </a>
  );
  const qr = (
    <figure className="cc-qr">
      <Image src={CONTACT.qr} alt={t.contact.scan} width={112} height={112} unoptimized />
      <figcaption>{t.contact.scan}</figcaption>
    </figure>
  );
  return (
    <div className="cc-card cc-band">
      {qr}
      {rows}
      <div className="cc-call">
        {phone}
        <p className="cc-address" lang={lang}>{contactAddress(lang)}</p>
      </div>
    </div>
  );
}
