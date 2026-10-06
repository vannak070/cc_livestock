import { describe, expect, it } from 'vitest';
import { buildCapacityAlert, capacityLevels, capacityStep, nearLimit, planCapacityAlerts } from './capacity-alerts';

const cows = (farm: string, n: number) => Array.from({ length: n }, () => ({ location: farm }));

describe('capacityStep', () => {
  it('reports the highest of 80, 90 and 100 reached, exactly at the edge', () => {
    expect(capacityStep(79, 100)).toBe(0);
    expect(capacityStep(80, 100)).toBe(80);
    expect(capacityStep(89, 100)).toBe(80);
    expect(capacityStep(90, 100)).toBe(90);
    expect(capacityStep(99, 100)).toBe(90);
    expect(capacityStep(100, 100)).toBe(100);
    expect(capacityStep(120, 100)).toBe(100);
  });

  it('works for limits that are not 100 (no rounding surprises)', () => {
    expect(capacityStep(4, 5)).toBe(80);
    expect(capacityStep(7, 9)).toBe(0); // 77.8%
    expect(capacityStep(8, 9)).toBe(80); // 88.9%: past 80, short of 90
    expect(capacityStep(9, 10)).toBe(90);
  });

  it('is 0 for a farm with no limit', () => {
    expect(capacityStep(50, 0)).toBe(0);
  });
});

describe('capacityLevels / nearLimit', () => {
  const farms = [{ name: 'SNR Farm', capacity: 100 }, { name: 'Sokchea', capacity: 10 }, { name: 'New', capacity: 0 }, { name: 'Quiet', capacity: 500 }];
  const stock = [...cows('SNR Farm', 91), ...cows(' sokchea ', 8), ...cows('Quiet', 3)];

  it('counts every registered animal on each farm with a limit, ignoring farms without one', () => {
    const levels = capacityLevels(farms, stock);
    expect(levels.map(l => [l.farm, l.used, l.limit, l.left, l.step])).toEqual([
      ['SNR Farm', 91, 100, 9, 90], ['Sokchea', 8, 10, 2, 80], ['Quiet', 3, 500, 497, 0],
    ]);
  });

  it('lists the farms at 80% or more, fullest first', () => {
    expect(nearLimit(capacityLevels(farms, stock)).map(l => l.farm)).toEqual(['SNR Farm', 'Sokchea']);
  });
});

describe('planCapacityAlerts', () => {
  const level = (used: number, limit = 100, farm = 'SNR Farm') => capacityLevels([{ name: farm, capacity: limit }], cows(farm, used));

  it('announces a farm the first time it reaches a step', () => {
    expect(planCapacityAlerts(level(80), []).map(l => l.step)).toEqual([80]);
    expect(planCapacityAlerts(level(79), [])).toEqual([]);
  });

  it('does not repeat a step already sent, but announces the next one', () => {
    expect(planCapacityAlerts(level(85), [{ farm: 'SNR Farm', limit: 100, step: 80 }])).toEqual([]);
    expect(planCapacityAlerts(level(92), [{ farm: 'SNR Farm', limit: 100, step: 80 }]).map(l => l.step)).toEqual([90]);
    expect(planCapacityAlerts(level(100), [{ farm: 'snr farm', limit: 100, step: 90 }]).map(l => l.step)).toEqual([100]);
  });

  it('sends one alert for the highest step when a farm jumps past several', () => {
    expect(planCapacityAlerts(level(100), [])).toHaveLength(1);
    expect(planCapacityAlerts(level(100), [])[0].step).toBe(100);
  });

  it('stays quiet when usage drops back (a higher step was sent before)', () => {
    expect(planCapacityAlerts(level(81), [{ farm: 'SNR Farm', limit: 100, step: 100 }])).toEqual([]);
  });

  it('starts over when the limit is raised: the same use against a new limit is a new situation', () => {
    expect(planCapacityAlerts(level(100, 100), [{ farm: 'SNR Farm', limit: 100, step: 100 }])).toEqual([]);
    expect(planCapacityAlerts(level(100, 110), [{ farm: 'SNR Farm', limit: 100, step: 100 }]).map(l => l.step)).toEqual([90]);
  });
});

describe('buildCapacityAlert', () => {
  it('says how full the farm is and what happens at 100%', () => {
    const l = capacityLevels([{ name: 'SNR Farm', capacity: 100 }], cows('SNR Farm', 90))[0];
    const text = buildCapacityAlert(l);
    expect(text).toContain('<b>Cattle limit · SNR Farm</b>');
    expect(text).toContain('90% used: 90 of 100 cattle. 10 places left.');
    expect(text).toContain('Please ask for a higher limit before it is full.');
  });

  it('says plainly that registering is blocked when the limit is used up, and escapes names and links', () => {
    const l = capacityLevels([{ name: 'A <b>&Farm', capacity: 10 }], cows('A <b>&Farm', 10))[0];
    const text = buildCapacityAlert(l, { appUrl: 'https://x.test/?a=1&b=2' });
    expect(text).toContain('<b>Cattle limit · A &lt;b&gt;&amp;Farm</b>');
    expect(text).toContain('The limit is reached: 10 of 10 cattle.');
    expect(text).toContain('No more cattle can be registered');
    expect(text).toContain('https://x.test/?a=1&amp;b=2');
  });
});
