import { describe, expect, it } from 'vitest';
import type { WebsiteApplication, WebsiteInquiry } from '../types';
import { buildApplicationMessage, buildInquiryMessage } from './notify';

const app = { id: 'A1', name: 'Sokha <b>', phone: '012345678', province: 'Takeo', district: 'Bati', cattleNow: 12, landM2: 5000, hasPens: true, photoIds: [], consentChecked: true, language: 'km', status: 'new', notes: '', createdAt: 'x', updatedAt: 'x' } as WebsiteApplication;
const inq = { id: 'I1', kind: 'price', name: 'Dara', phone: '098765432', buyerType: 'Trader', quantity: 20, weightClass: '350–400 kg', listingRef: 'l-abc', message: 'Need 20 bulls', language: 'en', status: 'new', notes: '', createdAt: 'x', updatedAt: 'x' } as WebsiteInquiry;

describe('website request messages', () => {
  it('says plainly who applied, how to reach them and what they have, with names escaped', () => {
    const m = buildApplicationMessage(app, 'https://app.example/?a=1&b=2');
    expect(m).toContain('New farm application · Sokha &lt;b&gt;');
    expect(m).toContain('Phone: 012345678');
    expect(m).toContain('Where: Bati, Takeo');
    expect(m).toContain('Cattle now: 12');
    expect(m).toContain('Land: 5,000 m²');
    expect(m).toContain('https://app.example/?a=1&amp;b=2');
  });

  it('gives the buyer, the cattle asked about and their message', () => {
    const m = buildInquiryMessage(inq, 'Batch01');
    expect(m).toContain('New price inquiry · Dara');
    expect(m).toContain('How many: 20');
    expect(m).toContain('Asked about: Batch01');
    expect(m).toContain('“Need 20 bulls”');
  });

  it('says when a buyer is waiting for cattle rather than asking a price', () => {
    const m = buildInquiryMessage({ ...inq, kind: 'notify', listingRef: undefined }, undefined);
    expect(m).toContain('Buyer waiting for cattle · Dara');
    expect(m).toContain('hear when cattle are available');
    expect(m).not.toContain('New price inquiry');
  });
});
