import { describe, it, expect } from 'vitest';
import { alertsDue, batchAlertDetail, buildBatchAlertMessage, buildSaleAlertMessages, daysBetweenDays, farmHour, planSaleAlerts, type SentAlert } from './sale-alerts';
import type { StockItem, WeightRecord } from './xlsx-parser';
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

describe('batch detail and messages', () => {
  const cow = (id: string, sex: string, weight: number, health = 'Good') => ({ id, no: id, weight, status: 'Active', sex, healthStatus: health, purchaseDate: '2026-06-01', breed: '', age: '', ownerName: '', location: 'SNR Farm', phone: '', buyType: '', unitPrice: 0, totalPrice: 0, remark: '' }) as StockItem;
  const rec = (cowId: string, d: string, w: number) => ({ cowId, trackingDate: d, currentWeight: w, oldWeight: 0, breed: '', age: '', gainLoss: 0, healthStatus: 'Good', status: 'Active' }) as WeightRecord;
  const stock = [cow('CC-010', 'Male', 330), cow('CC-002', 'Female', 290, 'Poor'), cow('CC-001', 'Male', 310), cow('CC-099', 'Male', 999)];
  const weights = [rec('CC-001', '2026-09-20', 300), rec('CC-001', '2026-10-01', 312), rec('CC-002', '2026-09-10', 285), rec('CC-010', '2026-10-04', 334)];
  const batch = { id: 'B', name: 'Batch <A> & co', type: 'Fattening', startDate: '2026-06-11T00:00:00.000Z', status: 'Active', cowIds: ['CC-001', 'CC-002', 'CC-010', 'GONE'], sellingTargetDate: '2026-10-10', expectedSellingPrice: 12500 } as SaleReviewRow['batch'];
  const detail = batchAlertDetail(batch, stock, weights, TODAY);
  const alert = (days: number, over: Partial<SaleReviewRow> = {}) => planSaleAlerts([row('B', days, { batch, perDay: 0.9, ...over })], [], TODAY)[0];

  it('counts the animals, weights and sex, in natural tag order, only those in the batch', () => {
    expect(detail.animals.map(a => a.id)).toEqual(['CC-001', 'CC-002', 'CC-010']);
    expect(detail).toMatchObject({ male: 2, female: 1, other: 0, total: 931, min: 285, max: 334, lastWeighed: '2026-10-04', sick: ['CC-002'], daysFed: 116 });
    expect(Math.round(detail.avg)).toBe(310);
  });

  it('knows each animal\'s change and how long ago it was weighed', () => {
    const a = (id: string) => detail.animals.find(x => x.id === id)!;
    expect(a('CC-001')).toMatchObject({ weight: 312, change: 12, staleDays: 4 });
    expect(a('CC-002')).toMatchObject({ weight: 285, staleDays: 25 });
    expect(a('CC-010')).toMatchObject({ weight: 334 });
  });

  it('writes a readable batch message', () => {
    const msg = buildBatchAlertMessage(alert(5), detail, { appUrl: 'https://app.example.com' });
    expect(msg).toContain('🟠 <b>SELLING DATE IN 5 DAYS</b>');
    expect(msg).toContain('<b>Batch &lt;A&gt; &amp; co</b>');
    expect(msg).toContain('📍 SNR Farm');
    expect(msg).toContain('Sell by 10 Oct 2026 · fed for 116 days');
    expect(msg).toContain('3 animals: 2 male · 1 female');
    expect(msg).toContain('Total 931 kg · average 310 kg');
    expect(msg).toContain('Lightest 285 kg · heaviest 334 kg');
    expect(msg).toContain('Gaining 0.9 kg a day · last weighed 4 Oct 2026');
    expect(msg).toContain('Expected 11,637,500 ៛ (at 12,500 ៛ per kg)');
    expect(msg).toContain('1 sick animal: CC-002');
    expect(msg).toContain('⚠ 1 animal not weighed for over 14 days: CC-002');
    expect(msg).not.toContain('<pre>');
    expect(msg).not.toContain('CC-001 M');
    expect(msg).toContain('https://app.example.com');
  });

  it('says once that the weights are old, instead of marking every row', () => {
    const old = batchAlertDetail(batch, stock, [rec('CC-001', '2026-07-23', 300), rec('CC-002', '2026-07-23', 285), rec('CC-010', '2026-07-23', 334)], TODAY);
    const msg = buildBatchAlertMessage(alert(5), old, {});
    expect(msg).toContain('⚠ These weights are old: the latest weighing was 74 days ago.');
    expect(msg).not.toContain('not weighed for over');
    const never = batchAlertDetail(batch, stock, [], TODAY);
    expect(buildBatchAlertMessage(alert(5), never, {})).toContain('None of these animals has been weighed.');
  });

  it('titles every stage, and marks reminders', () => {
    expect(buildBatchAlertMessage(alert(-4), detail, {})).toContain('🔴 <b>PAST THE SELLING DATE · 4 days late</b>');
    expect(buildBatchAlertMessage(alert(12), detail, {})).toContain('🟡 <b>COMING UP · in 12 days</b>');
    expect(buildBatchAlertMessage(alert(0), detail, {})).toContain('SELLING DATE IS TODAY');
    expect(buildBatchAlertMessage(alert(1), detail, {})).toContain('SELLING DATE IN 1 DAY</b>');
    const reminder = planSaleAlerts([row('B', -5, { batch })], [sent('B', 'overdue', '2026-10-01')], TODAY)[0];
    expect(buildBatchAlertMessage(reminder, detail, {})).toContain('<i>reminder</i>');
  });

  it('leaves out what it does not know', () => {
    const noPrice = { ...batch, expectedSellingPrice: undefined } as SaleReviewRow['batch'];
    const msg = buildBatchAlertMessage(planSaleAlerts([row('B', 3, { batch: noPrice, perDay: null })], [], TODAY)[0], detail, {});
    expect(msg).not.toContain('Expected');
    expect(msg).toContain('Growth not known yet');
    const empty = batchAlertDetail({ ...batch, cowIds: [] }, stock, weights, TODAY);
    const none = buildBatchAlertMessage(alert(3), empty, {});
    expect(none).toContain('No animals in this batch');
    expect(buildBatchAlertMessage(planSaleAlerts([row('B', 3, { batch, farm: '', standardDate: true })], [], TODAY)[0], detail, {})).toContain('No farm set');
  });

  it('stays short however many animals there are, and names only a few old-weight tags', () => {
    const many = Array.from({ length: 60 }, (_, i) => cow(`CC-${String(i + 1).padStart(3, '0')}`, i % 2 ? 'Female' : 'Male', 300 + i));
    const big = { ...batch, cowIds: many.map(c => c.id) } as SaleReviewRow['batch'];
    const d = batchAlertDetail(big, many, [], TODAY);
    const msg = buildBatchAlertMessage(alert(5, { batch: big }), d, { appUrl: 'https://app.example.com' });
    expect(d.animals.length).toBe(60);
    expect(msg).toContain('60 animals: 30 male · 30 female');
    expect(msg).toContain('None of these animals has been weighed.');
    expect(msg.length).toBeLessThan(1500);
    const some = batchAlertDetail(big, many, many.slice(0, 50).map(c => rec(c.id, '2026-10-03', 320)), TODAY);
    const m2 = buildBatchAlertMessage(alert(5, { batch: big }), some, {});
    expect(m2).toContain('⚠ 10 animals not weighed for over 14 days: CC-051, CC-052, CC-053, CC-054, CC-055, CC-056, CC-057, CC-058 and 2 more');
  });

  it('sends a header only when several batches are reported, with one message per batch worst first', () => {
    const plan = planSaleAlerts([row('late', -2, { batch: { ...batch, id: 'late', name: 'Late one' } }), row('B', 5, { batch }), row('soon', 12, { batch: { ...batch, id: 'soon', name: 'Soon one' } })], [], TODAY);
    const one = buildSaleAlertMessages(plan.slice(0, 1), () => detail, { today: TODAY });
    expect(one.header).toBeNull();
    const all = buildSaleAlertMessages(plan, () => detail, { today: TODAY });
    expect(all.header).toContain('5 Oct 2026');
    expect(all.header).toContain('🔴 1 past the date');
    expect(all.header).toContain('🟠 1 within 7 days');
    expect(all.header).toContain('🟡 1 coming up');
    expect(all.items.map(i => i.alert.row.batch.id)).toEqual(['late', 'B', 'soon']);
  });

  it('limits one go to 12 batch messages and says the rest follow', () => {
    const plan = planSaleAlerts(Array.from({ length: 15 }, (_, i) => row(`b${String(i).padStart(2, '0')}`, 3, { batch: { ...batch, id: `b${i}` } })), [], TODAY);
    const msgs = buildSaleAlertMessages(plan, () => detail, { today: TODAY });
    expect(msgs.items.length).toBe(12);
    expect(msgs.header).toContain('Showing 12 now; the other 3 follow shortly.');
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
