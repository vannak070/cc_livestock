import { describe, it, expect } from 'vitest';
import { checkApplicationIn, checkEventIn, checkInquiryIn, cleanPath, deviceOf, isContact, referrerHost } from './intake';
// The website is a separate app, but its form rules must match these ones exactly.
import { checkApplication, checkInquiry } from '../../../website/src/lib/forms/validate';
import { checkEvent } from '../../../website/src/lib/visits';

const app = (over: Record<string, unknown> = {}) => ({ name: 'Sokha Farm', phone: '012 345 678', province: 'Kandal', district: 'Kien Svay', landM2: 5000, cattleNow: 12, hasPens: true, consent: true, language: 'en', ...over });
const inq = (over: Record<string, unknown> = {}) => ({ kind: 'price', name: 'Buyer', phone: '+855 12 345 678', buyerType: 'trader', quantity: 5, weightClass: '300–350 kg', listingId: 'l-abc123', message: 'Hello', language: 'km', ...over });

describe('application', () => {
  it('accepts a good application and cleans the text', () => {
    const r = checkApplicationIn(app({ name: '  Sokha   Farm ', cattleNow: '12', landM2: '5,000' }));
    expect(r).toEqual({ ok: true, value: { name: 'Sokha Farm', phone: '012 345 678', province: 'Kandal', district: 'Kien Svay', landM2: 5000, cattleNow: 12, hasPens: true, consent: true, language: 'en' } });
  });
  it('names the first wrong field', () => {
    expect(checkApplicationIn(app({ name: 'A' }))).toEqual({ ok: false, field: 'name' });
    expect(checkApplicationIn(app({ phone: '123' }))).toEqual({ ok: false, field: 'phone' });
    expect(checkApplicationIn(app({ province: 'Atlantis' }))).toEqual({ ok: false, field: 'province' });
    expect(checkApplicationIn(app({ landM2: -1 }))).toEqual({ ok: false, field: 'landM2' });
    expect(checkApplicationIn(app({ cattleNow: 1.5 }))).toEqual({ ok: false, field: 'cattleNow' });
    expect(checkApplicationIn(app({ consent: false }))).toEqual({ ok: false, field: 'consent' });
    expect(checkApplicationIn(app({ consent: 'yes' }))).toEqual({ ok: false, field: 'consent' });
  });
  it('treats missing optional answers as unknown', () => {
    const r = checkApplicationIn(app({ landM2: '', cattleNow: undefined, hasPens: 'maybe' }));
    expect(r.ok && r.value).toMatchObject({ landM2: null, cattleNow: null, hasPens: null });
  });
  it('limits text length', () => {
    const r = checkApplicationIn(app({ name: 'x'.repeat(200), district: 'y'.repeat(200) }));
    expect(r.ok && r.value.name.length).toBe(80);
    expect(r.ok && r.value.district.length).toBe(60);
  });
});

describe('inquiry', () => {
  it('accepts a price inquiry and a notify request', () => {
    expect(checkInquiryIn(inq())).toMatchObject({ ok: true, value: { kind: 'price', listingId: 'l-abc123', quantity: 5 } });
    expect(checkInquiryIn(inq({ kind: 'notify', listingId: 'l-abc123' }))).toMatchObject({ ok: true, value: { kind: 'notify', listingId: null } });
  });
  it('names the first wrong field', () => {
    expect(checkInquiryIn(inq({ name: '' }))).toEqual({ ok: false, field: 'name' });
    expect(checkInquiryIn(inq({ phone: 'abc' }))).toEqual({ ok: false, field: 'phone' });
    expect(checkInquiryIn(inq({ buyerType: 'wizard' }))).toEqual({ ok: false, field: 'buyerType' });
    expect(checkInquiryIn(inq({ quantity: 99999 }))).toEqual({ ok: false, field: 'quantity' });
    expect(checkInquiryIn(inq({ weightClass: '1 ton' }))).toEqual({ ok: false, field: 'weightClass' });
    expect(checkInquiryIn(inq({ listingId: 'bad id' }))).toEqual({ ok: false, field: 'listingId' });
  });
  it('shortens a long message', () => {
    const r = checkInquiryIn(inq({ message: 'm'.repeat(2000) }));
    expect(r.ok && r.value.message.length).toBe(1000);
  });
});

describe('visit counts', () => {
  it('cleans the page and keeps the language', () => {
    expect(cleanPath('/en/members/sokha-farm?x=1#top')).toEqual({ lang: 'en', path: '/members/sokha-farm' });
    expect(cleanPath('/km')).toEqual({ lang: 'km', path: '/' });
    expect(cleanPath('/fr/members')).toBeNull();
    expect(cleanPath('/en/../etc')).toBeNull();
    expect(cleanPath(42)).toBeNull();
  });
  it('accepts a view with a referrer host, and drops the referrer from other events', () => {
    expect(checkEventIn({ kind: 'view', path: '/en/cattle', referrer: 'facebook.com' })).toEqual({ kind: 'view', lang: 'en', path: '/cattle', referrer: 'facebook.com' });
    expect(checkEventIn({ kind: 'call', path: '/en', referrer: 'facebook.com' })).toMatchObject({ kind: 'call', referrer: '' });
    expect(checkEventIn({ kind: 'view', path: '/en', referrer: 'https://evil.example/x?y=1' })).toMatchObject({ referrer: '' });
  });
  it('refuses odd kinds and pages', () => {
    expect(checkEventIn({ kind: 'hack', path: '/en' })).toBeNull();
    expect(checkEventIn({ kind: 'view', path: 'javascript:alert(1)' })).toBeNull();
  });
  it('reads the device, defaulting to computer', () => {
    expect(deviceOf('phone')).toBe('phone');
    expect(deviceOf('tablet')).toBe('computer');
    expect(deviceOf(undefined)).toBe('computer');
  });
  it('reduces a referrer address to its host name only', () => {
    expect(referrerHost('https://www.facebook.com/some/post?id=1', 'camcow.example')).toBe('facebook.com');
    expect(referrerHost('https://camcow.example/en', 'camcow.example')).toBe('');
  });
});

describe('contact', () => {
  it('accepts Cambodian numbers and Telegram names', () => {
    for (const ok of ['012345678', '+855 12 345 678', '855123456789'.slice(0, 11), '@sokha_farm']) expect(isContact(ok)).toBe(true);
    for (const bad of ['', '12', 'hello', '@ab']) expect(isContact(bad)).toBe(false);
  });
});

describe('same rules as the website', () => {
  const apps = [app(), app({ name: '' }), app({ phone: 'x' }), app({ province: 'Nope' }), app({ landM2: 'abc' }), app({ cattleNow: -5 }), app({ consent: false }), app({ language: 'fr' }), app({ hasPens: false }), app({ district: '' }), app({ name: ' a  b ' })];
  const inqs = [inq(), inq({ kind: 'notify' }), inq({ name: 'x' }), inq({ phone: '1' }), inq({ buyerType: 'zzz' }), inq({ buyerType: '' }), inq({ quantity: 'ten' }), inq({ weightClass: 'zzz' }), inq({ listingId: 'nope' }), inq({ message: 5 })];
  it('gives the same answer to the same application', () => {
    for (const a of apps) expect(checkApplicationIn(a)).toEqual(checkApplication(a));
  });
  it('gives the same answer to the same inquiry', () => {
    for (const i of inqs) expect(checkInquiryIn(i)).toEqual(checkInquiry(i));
  });
  it('accepts what the website really forwards: its own checked values', () => {
    for (const a of apps) {
      const site = checkApplication(a);
      if (site.ok) expect(checkApplicationIn({ ...site.value })).toEqual(site);
    }
    for (const i of inqs) {
      const site = checkInquiry(i);
      if (site.ok) expect(checkInquiryIn({ ...site.value })).toEqual(site);
    }
  });
  it('accepts whatever the website lets through as a visit count', () => {
    const raws = [{ kind: 'view', path: '/en/cattle', referrer: 'https://www.facebook.com/x' }, { kind: 'join', path: '/km/join' }, { kind: 'call', path: '/en' }, { kind: 'view', path: '/en/members/farm-1' }];
    for (const raw of raws) {
      const fromSite = checkEvent(raw, 'camcow.example');
      expect(fromSite).not.toBeNull();
      expect(checkEventIn({ ...raw, referrer: fromSite!.referrer })).toEqual(fromSite);
      // What the website really forwards: the cleaned count plus the device.
      expect(checkEventIn({ ...fromSite!, device: 'phone' })).toEqual(fromSite);
    }
    expect(checkEventIn({ kind: 'view', lang: 'fr', path: '/members' })).toBeNull();
    expect(checkEventIn({ kind: 'view', lang: 'en', path: '/<x>' })).toBeNull();
    for (const raw of [{ kind: 'x', path: '/en' }, { kind: 'view', path: '/zz/en' }]) {
      expect(checkEvent(raw, 'camcow.example')).toBeNull();
      expect(checkEventIn(raw)).toBeNull();
    }
  });
});
