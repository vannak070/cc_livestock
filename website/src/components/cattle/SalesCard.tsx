import Image from 'next/image';
import { CONTACT } from '@/lib/contact';
import type { Dict } from '@/lib/i18n';

const PHONE = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z';
const SEND = 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z';
const TICK = 'M4 12l5 5L20 6';

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/**
 * "Talk to our sales team" beside the cattle list: call (the page's one red button) or message on Telegram, what to tell
 * us for a quick price, and the Telegram QR for people on a computer (hidden on phones, which cannot scan their own
 * screen). On a farm page the farm is named at the top (asking) so the buyer can mention it.
 * No prices, ever: the sales team shares them privately. Also on a farm page (the farm named, Call outlined because
 * the page top has the red button) and on Join for buyers (title=null: the tab already shows it).
 */
export function SalesCard({ t, asking, title, note, callPrimary = true }: {
  t: Pick<Dict, 'cattle' | 'contact' | 'common'>;
  asking?: string;
  /** The heading; null leaves the eyebrow and heading out (the page already shows one). */
  title?: string | null;
  note?: string;
  /** The Call button is the page's one red button; false makes it an outline button. */
  callPrimary?: boolean;
}) {
  const c = t.cattle;
  return (
    <div className="sales-card">
      <div className="sales-head">
        {title !== null && <span className="sales-eyebrow">{c.salesEyebrow}</span>}
        {title !== null && <h2 className="display">{title ?? t.contact.cardTitle}</h2>}
        <p>{note ?? c.salesNote}</p>
      </div>

      {asking && (
        <div className="sales-asking" role="status">
          <span>{c.asking} <b>{asking}</b></span>
          <small>{c.askingHint}</small>
        </div>
      )}

      <div className="sales-actions">
        <a className={`btn ${callPrimary ? 'btn-red' : 'btn-line'}`} href={`tel:${CONTACT.phoneTel}`}>
          <Icon d={PHONE} /><span className="btn-label">{c.salesCall} <span className="nowrap">{CONTACT.phone}</span></span>
        </a>
        <a className="btn btn-line" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer">
          <Icon d={SEND} />{t.common.telegram}
        </a>
        <a className="sales-fb" href={CONTACT.facebook} target="_blank" rel="noopener noreferrer">{c.salesFb}</a>
      </div>

      <div className="sales-tell">
        <b>{c.tellTitle}</b>
        <ul>
          {c.tell.map(x => <li key={x}><Icon d={TICK} size={16} />{x}</li>)}
        </ul>
      </div>

      <a className="sales-qr" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer">
        <Image src={CONTACT.qr} alt="" width={84} height={84} unoptimized />
        <span>{c.scanDesk} <b>{CONTACT.telegramHandle}</b></span>
      </a>
    </div>
  );
}
