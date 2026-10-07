import { describe, expect, it } from 'vitest';
import { checkEvent, cleanPath, isBot, isPhone, referrerHost } from './visits';

describe('visitor counts', () => {
  it('keeps only the page, without query, hash or odd characters', () => {
    expect(cleanPath('/en/members/sokha-farm?phone=012#x')).toEqual({ lang: 'en', path: '/members/sokha-farm' });
    expect(cleanPath('/km')).toEqual({ lang: 'km', path: '/' });
    expect(cleanPath('/en/')).toEqual({ lang: 'en', path: '/' });
    expect(cleanPath('/fr/members')).toBeNull();
    expect(cleanPath('/en/<script>')).toBeNull();
    expect(cleanPath(42)).toBeNull();
  });

  it('keeps only the name of another site', () => {
    expect(referrerHost('https://m.facebook.com/some/post?id=1', 'camcow.com.kh')).toBe('facebook.com');
    expect(referrerHost('https://www.camcow.com.kh/en', 'camcow.com.kh')).toBe('');
    expect(referrerHost('not a url', 'camcow.com.kh')).toBe('');
  });

  it('accepts known kinds only, and a referrer only on page views', () => {
    expect(checkEvent({ kind: 'view', path: '/en', referrer: 'https://google.com/' }, 'x')).toEqual({ kind: 'view', lang: 'en', path: '/', referrer: 'google.com' });
    expect(checkEvent({ kind: 'call', path: '/en/contact', referrer: 'https://google.com/' }, 'x')?.referrer).toBe('');
    expect(checkEvent({ kind: 'hack', path: '/en' }, 'x')).toBeNull();
  });

  it('tells phones and robots apart', () => {
    expect(isPhone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(true);
    expect(isPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
    expect(isBot('Googlebot/2.1')).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot('Mozilla/5.0 (Macintosh)')).toBe(false);
  });
});
