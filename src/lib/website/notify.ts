import type { WebsiteApplication, WebsiteInquiry } from '../types';
import { escapeHtml } from '../alerts';
import { provinceOf } from './places';

/**
 * Telegram messages for new website requests (plain English, like the other
 * CamCow alerts). They go only to the private CamCow group, so the phone
 * number is included for the office to call back.
 */
const where = (district: string, province: string) => [district, provinceOf(province)?.key ?? province].filter(Boolean).join(', ');

export function buildApplicationMessage(a: WebsiteApplication, appUrl?: string): string {
  const lines = [
    `🌱 <b>New farm application · ${escapeHtml(a.name)}</b>`,
    '',
    `Phone: ${escapeHtml(a.phone)}`,
    ...(where(a.district, a.province) ? [`Where: ${escapeHtml(where(a.district, a.province))}`] : []),
    ...(a.cattleNow !== undefined ? [`Cattle now: ${a.cattleNow}`] : []),
    ...(a.landM2 !== undefined ? [`Land: ${a.landM2.toLocaleString('en-US')} m²`] : []),
    ...(a.hasPens !== undefined ? [`Pens with a roof: ${a.hasPens ? 'yes' : 'not yet'}`] : []),
    '',
    'Please call them, then update the request on the Website page.',
  ];
  return lines.join('\n') + (appUrl ? `\n\n<a href="${escapeHtml(appUrl)}">Open CC Livestock</a>` : '');
}

export function buildInquiryMessage(i: WebsiteInquiry, listingName?: string, appUrl?: string): string {
  const notify = i.kind === 'notify';
  const investor = i.buyerType === 'investor';
  const lines = [
    notify ? `🔔 <b>Buyer waiting for cattle · ${escapeHtml(i.name)}</b>` : investor ? `📈 <b>New investor request · ${escapeHtml(i.name)}</b>` : `💬 <b>New price inquiry · ${escapeHtml(i.name)}</b>`,
    '',
    `Phone: ${escapeHtml(i.phone)}`,
    ...(i.buyerType ? [`Buyer: ${escapeHtml(i.buyerType)}`] : []),
    ...(i.quantity !== undefined ? [`How many: ${i.quantity}`] : []),
    ...(i.weightClass ? [`Weight class: ${escapeHtml(i.weightClass)}`] : []),
    ...(listingName ? [`Asked about: ${escapeHtml(listingName)}`] : []),
    ...(i.message ? ['', `“${escapeHtml(i.message.slice(0, 300))}”`] : []),
    '',
    notify ? 'They asked to hear when cattle are available. Please call them when you have some, then update the request on the Website page.' : investor ? 'Please call them to talk about investing, then update the request on the Website page.' : 'Please call them with a price, then update the request on the Website page.',
  ];
  return lines.join('\n') + (appUrl ? `\n\n<a href="${escapeHtml(appUrl)}">Open CC Livestock</a>` : '');
}
