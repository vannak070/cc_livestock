import { describe, expect, it } from 'vitest';
import { farmSizeRange, farmSlug, headCountLabel, percentTo5, publicCode, publicPin, roundedTotal, weightClass } from './rounding';

describe('rounding rules', () => {
  it('turns an exact weight into a class', () => {
    expect(weightClass(249.9)).toBe('Under 250 kg');
    expect(weightClass(250)).toBe('250–300 kg');
    expect(weightClass(349)).toBe('300–350 kg');
    expect(weightClass(399.9)).toBe('350–400 kg');
    expect(weightClass(412.3)).toBe('400 kg+');
  });

  it('never shows an exact head count', () => {
    expect(headCountLabel(3)).toBe('Under 10');
    expect(headCountLabel(10)).toBe('10+');
    expect(headCountLabel(24)).toBe('20+');
    expect(headCountLabel(80)).toBe('50+');
  });

  it('gives a farm a size range', () => {
    expect(farmSizeRange(7)).toBe('Under 20 head');
    expect(farmSizeRange(53)).toBe('50–100 head');
    expect(farmSizeRange(100)).toBe('100+ head');
  });

  it('rounds totals down and adds "+"', () => {
    expect(roundedTotal(27, 5)).toBe('25+');
    expect(roundedTotal(1234, 100)).toBe('1,200+');
    expect(roundedTotal(3, 5)).toBe('3');
  });

  it('rounds a share to 5 and gives null with nothing to count', () => {
    expect(percentTo5(23, 25)).toBe(90);
    expect(percentTo5(0, 0)).toBeNull();
  });

  it('blurs the map pin to about 11 km unless the exact place is allowed', () => {
    expect(publicPin(11.4567, 104.5234, false)).toEqual({ lat: 11.5, lng: 104.5 });
    expect(publicPin(11.45678, 104.52341, true)).toEqual({ lat: 11.4568, lng: 104.5234 });
  });

  it('makes stable public codes that do not show the internal id', () => {
    expect(publicCode('FARM-01')).toBe(publicCode('FARM-01'));
    expect(publicCode('FARM-01')).not.toBe(publicCode('FARM-02'));
    expect(publicCode('FARM-01')).not.toContain('FARM');
    expect(farmSlug('Green Hill Farm', 'FARM-01')).toMatch(/^green-hill-farm-[a-z0-9]{6}$/);
    expect(farmSlug('កសិដ្ឋានសុខា', 'FARM-02')).toMatch(/^farm-[a-z0-9]{6}$/);
  });
});
