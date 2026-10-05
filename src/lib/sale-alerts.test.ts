import { describe, it, expect } from 'vitest';
import { alertsDue, buildSaleAlertMessage, daysBetweenDays, farmHour, planSaleAlerts, type SentAlert } from './sale-alerts';
import type { SaleReviewRow } from './sale-review';
import { saleTier } from './sale-review';

const row = (id: string, days: number, over: Partial<SaleReviewRow> = {}, target = '2026-10-10'): SaleReviewRow => ({
  batch: { id, name: id, type: 'Fattening', startDate: '2026-07-01', status: 'Active', cowIds: [], sellingTargetDate: target } as SaleReviewRow['batch'],
  farm: 'SNR Farm', daysRemaining: days, tier: saleTier(days), decided: false, head: 12, avgWeight: 295.4, perDay: 0.8, expectedValue: 7440000, standardDate: false, ...over,
});
const sent = (batchId: string, stage: SentAlert['stage'], sentOn: string, targetDate = '2026-10-10'): SentAlert => ({ batchId, targetDate, stage, sentOn });
const TODAY = '2026-10-05';

describe('planSaleAlerts', () => {
  it('alerts a batch the first time it reaches a stage, worst first', () => {
    const plan = planSaleAlerts([row('soon', 12), row('late', -2), row('week', 4)], [], TODAY);
    expect(plan.map(p => [p.row.batch.id, p.stage, p.kind])).toEqual([['late', 'overdue', 'new'], ['week', 'week', 'new'], ['soon', 'window', 'new']]);
  });

  it('does not repeat a stage already sent for the same selling date', () => {
    expect(planSaleAlerts([row('a', 12)], [sent('a', 'window', '2026-10-03')], TODAY)).toEqual([]);
    expect(planSaleAlerts([row('a', 4)], [sent('a', 'week', '2026-10-04')], TODAY)).toEqual([]);
  });

  it('alerts again when the batch moves to the next stage', () => {
    const plan = planSaleAlerts([row('a', 4)], [sent('a', 'window', '2026-09-28')], TODAY);
    expect(plan.map(p => [p.stage, p.kind])).toEqual([['week', 'new']]);
  });

  it('reminds every 3 days while still past the date, not before', () => {
    expect(planSaleAlerts([row('a', -1)], [sent('a', 'overdue', '2026-10-03')], TODAY)).toEqual([]);
    const plan = planSaleAlerts([row('a', -4)], [sent('a', 'overdue', '2026-10-02')], TODAY);
    expect(plan.map(p => [p.stage, p.kind])).toEqual([['overdue', 'reminder']]);
    // the latest send counts, not the first
    expect(planSaleAlerts([row('a', -4)], [sent('a', 'overdue', '2026-09-28'), sent('a', 'overdue', '2026-10-04')], TODAY)).toEqual([]);
  });

  it('starts over when the selling date changes (keep feeding)', () => {
    const plan = planSaleAlerts([row('a', 12, {}, '2026-10-17')], [sent('a', 'window', '2026-09-20', '2026-10-10')], TODAY);
    expect(plan.map(p => p.kind)).toEqual(['new']);
  });

  it('never alerts a batch already decided ready to sell', () => {
    expect(planSaleAlerts([row('a', -3, { decided: true })], [], TODAY)).toEqual([]);
  });
});

describe('buildSaleAlertMessage', () => {
  const opts = { today: TODAY, windowDays: 15, appUrl: 'https://app.example.com' };

  it('groups by stage and carries the batch facts and the link', () => {
    const msg = buildSaleAlertMessage(planSaleAlerts([row('Late <1>', -2), row('Soon', 12)], [], TODAY), opts);
    expect(msg).toContain('Sale review');
    expect(msg).toContain('Past the selling date');
    expect(msg).toContain('Coming up');
    expect(msg).toContain('<b>Late &lt;1&gt;</b> (SNR Farm): 2 days past the date, 2026-10-10');
    expect(msg).toContain('12 animals · avg 295 kg · about 7,440,000 ៛');
    expect(msg.indexOf('Past the selling date')).toBeLessThan(msg.indexOf('Coming up'));
    expect(msg).toContain('https://app.example.com');
    expect(msg).not.toContain('Selling date within 7 days');
  });

  it('marks reminders and the standard date, and says singular correctly', () => {
    const plan = planSaleAlerts([row('a', 1, { head: 1, standardDate: true, expectedValue: null }), row('b', -5)], [sent('b', 'overdue', '2026-10-01')], TODAY);
    const msg = buildSaleAlertMessage(plan, opts);
    expect(msg).toContain('in 1 day');
    expect(msg).toContain('1 animal ·');
    expect(msg).toContain('<i>reminder</i>');
    expect(msg).toContain('<i>standard 90-day date</i>');
  });

  it('keeps a long list readable', () => {
    const many = Array.from({ length: 20 }, (_, i) => row(`b${String(i).padStart(2, '0')}`, 3));
    const msg = buildSaleAlertMessage(planSaleAlerts(many, [], TODAY), opts);
    expect(msg.match(/•/g)!.length).toBe(15);
    expect(msg).toContain('and 5 more batches');
    expect(msg.length).toBeLessThan(4000);
  });
});

describe('timing', () => {
  it('counts days between calendar days', () => {
    expect(daysBetweenDays('2026-10-02', '2026-10-05')).toBe(3);
    expect(daysBetweenDays('2026-10-30', '2026-11-02')).toBe(3);
  });
  it('reads the hour at the farms (UTC+7)', () => {
    expect(farmHour(new Date('2026-10-05T00:30:00Z'))).toBe(7);
    expect(farmHour(new Date('2026-10-05T17:00:00Z'))).toBe(0);
  });
  it('is due only when on, a group is chosen and the hour has come', () => {
    const cfg = { telegramEnabled: true, chatId: '-100123456', sendHour: 7 };
    expect(alertsDue(cfg, new Date('2026-10-05T00:30:00Z'))).toBe(true);   // 07:30 in Cambodia
    expect(alertsDue(cfg, new Date('2026-10-04T23:30:00Z'))).toBe(false);  // 06:30
    expect(alertsDue({ ...cfg, telegramEnabled: false }, new Date('2026-10-05T03:00:00Z'))).toBe(false);
    expect(alertsDue({ ...cfg, chatId: '' }, new Date('2026-10-05T03:00:00Z'))).toBe(false);
  });
});
