import { describe, expect, it } from 'vitest';
import { checkApplication, checkInquiry, isContact, isRobot } from './validate';

const app = { name: ' Sokha  Chan ', phone: '012 345 678', province: 'Takeo', district: 'Bati', landM2: '5,000', cattleNow: 12, hasPens: true, consent: true, language: 'km' };

describe('public form checks', () => {
  it('accepts a complete application and cleans it', () => {
    const r = checkApplication(app);
    expect(r).toEqual({ ok: true, value: { name: 'Sokha Chan', phone: '012 345 678', province: 'Takeo', district: 'Bati', landM2: 5000, cattleNow: 12, hasPens: true, consent: true, language: 'km' } });
  });
  it('names the first wrong field', () => {
    expect(checkApplication({ ...app, phone: '123' })).toEqual({ ok: false, field: 'phone' });
    expect(checkApplication({ ...app, province: 'Bangkok' })).toEqual({ ok: false, field: 'province' });
    expect(checkApplication({ ...app, cattleNow: -1 })).toEqual({ ok: false, field: 'cattleNow' });
    expect(checkApplication({ ...app, consent: 'yes' })).toEqual({ ok: false, field: 'consent' });
  });
  it('accepts Cambodian numbers and Telegram names', () => {
    expect(isContact('012345678')).toBe(true);
    expect(isContact('+855 12 345 678')).toBe(true);
    expect(isContact('@camcow_sales')).toBe(true);
    expect(isContact('hello')).toBe(false);
  });
  it('checks inquiries, including the listing code shape', () => {
    expect(checkInquiry({ name: 'Dara', phone: '098765432', buyerType: 'trader', quantity: '20', weightClass: '350–400 kg', listingId: 'l-abc123', message: 'Hi' }).ok).toBe(true);
    expect(checkInquiry({ name: 'Dara', phone: '098765432', listingId: 'BATCH-1' })).toEqual({ ok: false, field: 'listingId' });
    const price = checkInquiry({ name: 'Dara', phone: '098765432', listingId: 'l-abc123' });
    expect(price.ok && price.value.kind).toBe('price');
    const notify = checkInquiry({ name: 'Dara', phone: '098765432', kind: 'notify', listingId: 'l-abc123' });
    expect(notify.ok && notify.value.kind).toBe('notify');
    expect(notify.ok && notify.value.listingId).toBeNull();
    const odd = checkInquiry({ name: 'Dara', phone: '098765432', kind: 'something' });
    expect(odd.ok && odd.value.kind).toBe('price');
    expect(checkInquiry({ name: 'Dara', phone: '098765432', weightClass: '999 kg' })).toEqual({ ok: false, field: 'weightClass' });
  });
  it('spots robots by the hidden field', () => {
    expect(isRobot({ website: 'http://spam' })).toBe(true);
    expect(isRobot({ website: '' })).toBe(false);
  });
});
