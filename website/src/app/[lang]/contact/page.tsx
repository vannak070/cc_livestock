import type { Metadata } from 'next';
import Image from 'next/image';
import { InquiryForm } from '@/components/cattle/InquiryForm';
import { PageHead } from '@/components/shared/PageHead';
import { CONTACT, contactAddress, contactMapLink } from '@/lib/contact';
import { pageLang } from '@/lib/page';
import { KmWords } from '@/components/shared/KmWords';
import { siteImages } from '@/lib/site-images';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  return { title: t.contact.title, description: t.contact.sub };
}

const ICON = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  telegram: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

/**
 * Contact: "Send us a message" (the form, the page's main action) beside "Talk to us directly" (tappable rows for
 * phone, Telegram and Facebook, the Telegram QR on computers) and "Visit our office" (team photo, address,
 * directions); both sides end level. Phones: the direct rows first, then the form, then the office.
 * The navy contact card and the "How can we help you?" cards were dropped 10-27: the footer already shows both.
 */
export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const c = t.contact;
  const img = await siteImages();
  const rows = [
    { key: 'call', icon: ICON.phone, to: `tel:${CONTACT.phoneTel}`, value: CONTACT.phone, note: t.about.officeSub, external: false },
    { key: 'telegram', icon: ICON.telegram, to: CONTACT.telegram, value: `Telegram ${CONTACT.telegramHandle}`, note: c.telegramNote, external: true },
    { key: 'facebook', icon: ICON.facebook, to: CONTACT.facebook, value: CONTACT.facebookName, note: c.facebookNote, external: true },
  ];
  const svg = (d: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
  return (
    <>
      <PageHead eyebrow={t.eyebrow.contact} title={c.title} sub={c.sub} photo={img['farm-grazing']} />
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap ct-main">
          <div className="ct-form form-card jn-form" id="message">
            <div className="stack" style={{ gap: 8 }}>
              <h2 className="display h3"><KmWords text={t.inquiry.questionTitle} /></h2>
              <p className="muted" style={{ margin: 0 }}>{t.inquiry.questionIntro}</p>
            </div>
            <InquiryForm t={{ inquiry: t.inquiry, common: t.common, values: t.values }} lang={lang} listings={[]} question />
          </div>

          <div className="ct-direct">
            <h2 className="ct-card-title">{c.directTitle}</h2>
            <ul className="ct-rows">
              {rows.map(r => (
                <li key={r.key}>
                  <a className={`ct-row ct-row-${r.key}`} href={r.to} {...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    <span className="ct-row-icon">{svg(r.icon)}</span>
                    <span className="ct-row-text"><b {...(r.key === 'facebook' ? { lang: 'km' } : {})}>{r.value}</b><small>{r.note}</small></span>
                    <span className="ct-row-arrow" aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
            <a className="ct-qr-row" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer">
              <Image src={CONTACT.qr} alt="" width={76} height={76} unoptimized />
              <span>{c.scanDesk}<b>{CONTACT.telegramHandle}</b></span>
            </a>
          </div>

          <div className="ct-office">
            <div className="ct-office-photo"><Image src={img['team-group']} alt={c.teamAlt} fill sizes="(max-width: 900px) calc(100vw - 32px), 460px" /></div>
            <div className="ct-office-body">
              <h2 className="ct-card-title">{c.visitLabel}</h2>
              <p lang={lang}>{contactAddress(lang)}</p>
              <a className="ct-directions" href={contactMapLink} target="_blank" rel="noopener noreferrer">{svg(ICON.pin)}{c.directions} <span aria-hidden="true">→</span></a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
