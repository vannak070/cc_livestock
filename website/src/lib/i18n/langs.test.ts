import { describe, expect, it } from 'vitest';
import { DEFAULT_LANG, startLang } from './langs';

describe('startLang', () => {
  it('opens in the remembered language when it is switched on', () => {
    expect(startLang('km')).toBe('km');
    expect(startLang('en')).toBe('en');
  });
  it('falls back to the default for nothing, nonsense or a language that is not switched on', () => {
    expect(startLang(undefined)).toBe(DEFAULT_LANG);
    expect(startLang(null)).toBe(DEFAULT_LANG);
    expect(startLang('')).toBe(DEFAULT_LANG);
    expect(startLang('fr')).toBe(DEFAULT_LANG);
    expect(startLang('KM')).toBe(DEFAULT_LANG);
  });
});
