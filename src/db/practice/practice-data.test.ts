import { describe, expect, it } from 'vitest';
import plan2 from './plan2.fixture.json';
import { buildPracticeData, EXISTING, SCENARIOS, startOf, PRACTICE_PREFIX } from './practice-data';
import { allocateEvidence, generateTasks, taskState, type Task } from '../../lib/ops-program';
import { slotOf } from '../../lib/ops-slots';
import type { ProposalPlanParams } from '../../types/proposal.types';

const plan = plan2 as unknown as ProposalPlanParams;
const today = '2026-10-15';
const data = buildPracticeData(today, plan);

/** Every task of a farm with the status the Management screens would show. */
function statuses(farm: string) {
  const s = SCENARIOS.find(x => x.farm === farm)!;
  const seeds = generateTasks({ farm, startDate: startOf(s, today), headPerCycle: s.head, plan }, []).tasks;
  const tasks = seeds.map((t, i) => ({ ...t, id: `T${i}`, programId: 'P', originalDueDate: t.dueDate, reason: '', owner: '', notes: '', updatedBy: '', updatedAt: '' }) as Task);
  const own = new Set(data.cows.filter(c => c.location === farm).map(c => c.id));
  const ev = allocateEvidence(tasks, {
    registrations: data.cows.filter(c => c.location === farm).map(c => ({ date: c.purchaseDate, farm })),
    sales: data.sales.filter(x => own.has(x.cowId)).map(x => ({ date: x.date, farm, kg: x.weight, value: x.totalPrice })),
  });
  return tasks.map(t => ({ t, st: taskState(t, ev.get(t.id), today) }));
}
const find = (farm: string, kind: string, key: string) => statuses(farm).find(x => x.t.kind === kind && x.t.cycleKey === key)!;

describe('practice data', () => {
  it('marks everything it writes, with no id used twice', () => {
    for (const list of [data.cows.map(c => c.id), data.batches.map(b => b.id), data.health.map(h => h.id), data.feedIns.map(f => f.id), data.costs.map(c => c.id)]) {
      expect(list.every(id => id.startsWith(PRACTICE_PREFIX))).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('gives every farm 20 cattle a month, and no feed task', () => {
    expect(SCENARIOS.every(s => s.head === 20) && EXISTING.every(e => e.head === 20)).toBe(true);
    expect(data.programs).toHaveLength(SCENARIOS.length + EXISTING.length);
  });

  it('puts every farm\'s swap day inside its 3-day slot, and shares slots between farms in the same area', () => {
    for (const s of [...SCENARIOS, ...EXISTING]) expect(slotOf(startOf(s, today)), s.farm).toBe(s.slot);
    const bySlot = new Map<number, string[]>();
    for (const s of [...SCENARIOS, ...EXISTING]) bySlot.set(s.slot, [...(bySlot.get(s.slot) ?? []), s.farm]);
    expect(bySlot.get(1)).toEqual(['VannaraCC1', 'SothunCC7']);
    expect(bySlot.get(2)).toEqual(['SunnyCC9', 'VechneatCC10']);
  });

  it('keeps a farm that starts today waiting and registers each other cohort on its swap day', () => {
    expect(data.cows.some(c => c.location === 'SophalCC12')).toBe(false);
    expect(data.cows.filter(c => c.location === 'NimolCC11')).toHaveLength(20);
    expect(data.cows.every(c => c.purchaseDate <= today)).toBe(true);
  });

  it('shows a mature farm on track, this month\'s swap done', () => {
    for (const k of ['c0', 'c1', 'c2', 'c3']) expect(find('VannaraCC1', 'buy_back', k).st.status).toBe('done');
    expect(find('VannaraCC1', 'sell_to_farm', 'c7').st.status).toBe('done');
    expect(data.cows.filter(c => c.location === 'VannaraCC1')).toHaveLength(160);
  });

  it('shows a farm whose swap did not happen as late on both sides', () => {
    expect(find('SothunCC7', 'buy_back', 'c2').st).toMatchObject({ status: 'late', daysLate: 14, severe: true });
    expect(find('SothunCC7', 'sell_to_farm', 'c6').st).toMatchObject({ status: 'late', daysLate: 14 });
    expect(find('SothunCC7', 'buy_back', 'c1').st.status).toBe('done');
  });

  it('shows the company farm with a part-sold cohort that is badly late, and the next swap due soon', () => {
    const c3 = find('CC_001', 'buy_back', 'c3');
    expect(c3.st).toMatchObject({ status: 'late', severe: true });
    expect(c3.st.progress).toBeCloseTo(0.6, 1);
    expect(find('CC_001', 'buy_back', 'c4').st.status).toBe('due_soon');
  });

  it('puts work due this week in Due soon and later work in Planned', () => {
    expect(find('SophalCC12', 'sell_to_farm', 'c0').st.status).toBe('due_soon');
    expect(find('ViraksakCC2', 'buy_back', 'c1').st.status).toBe('due_soon');
    expect(find('ViraksakCC2', 'buy_back', 'c0').st.status).toBe('done');
    expect(find('VanndaCC3', 'buy_back', 'c0').st.status).toBe('due_soon');
    expect(find('NimolCC11', 'sell_to_farm', 'c1').st.status).toBe('planned');
    expect(find('KImchhatCC5', 'buy_back', 'c0').st.status).toBe('done');
  });

  it('gives sold animals a sale on the buy-back price and closes batches that are fully sold back', () => {
    const farmSales = data.sales.filter(s => s.cowId.startsWith('P2-VNR1-'));
    expect(farmSales.length).toBe(80); // four cohorts of 20
    expect(farmSales.every(s => s.unitPrice === 12_500 && s.weight > 370 && s.weight < 480)).toBe(true);
    expect(data.batches.find(b => b.id === 'P2-B-VNR1-01')!.status).toBe('Closed');
    expect(data.batches.find(b => b.id === 'P2-B-VNR1-05')!.status).toBe('Active');
  });

  it('buys feed in as ordinary stock on swap days, short where the scenario says', () => {
    const full = data.feedIns.find(f => f.id === 'P2-TX-VNR1-08')!;
    expect(full.kg).toBe(20 * 4 * 8 * 30);
    expect(data.feedIns.find(f => f.id === 'P2-TX-STN7-06')).toBeUndefined();
    expect(data.feedIns.find(f => f.id === 'P2-TX-STN7-05')!.kg).toBeLessThan(20 * 4 * 8 * 30);
  });

  it('keeps CamCow stock records for collected cattle: received, held, sold on to buyers or lost, with the newest still waiting', () => {
    const byStatus = (st: string) => data.holdings.filter(h => h.status === st);
    expect(byStatus('Held').length).toBeGreaterThan(0);
    expect(byStatus('Sold').length).toBeGreaterThan(0);
    expect(byStatus('Lost').length).toBeGreaterThan(0);
    // The newest collections have not been received yet (they show as waiting).
    const soldIds = new Set(data.sales.map(s => s.cowId));
    const waiting = [...soldIds].filter(id => !data.holdings.some(h => h.cowId === id));
    expect(waiting.length).toBeGreaterThan(0);
    // Every holding is a collected animal, and a sale on comes after its collection at a price above the collection price per kg.
    for (const h of data.holdings) {
      expect(soldIds.has(h.cowId)).toBe(true);
      if (h.status === 'Sold') {
        expect(h.soldOn! > h.collectedOn).toBe(true);
        expect(h.soldOn! <= today).toBe(true);
        expect(h.salePricePerKg!).toBeGreaterThan(12_500);
        expect(h.buyer).toBeTruthy();
      }
    }
    // At least one lot has been in stock for over a month (the "held too long" alert has something to show).
    expect(byStatus('Held').some(h => (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${h.collectedOn}T00:00:00Z`)) / 86_400_000 > 30)).toBe(true);
    expect(new Set(data.holdings.map(h => h.cowId)).size).toBe(data.holdings.length);
  });

  it('gives every sale on a buyer', () => {
    const ids = new Set(data.buyers.map(b => b.id));
    expect(ids.size).toBeGreaterThan(1);
    for (const h of data.holdings.filter(x => x.status === 'Sold')) expect(ids.has(h.buyerId!)).toBe(true);
  });

  it('has holding costs at the stock site, never on a day with nothing in stock and never in the future', () => {
    expect(data.stockCosts.length).toBeGreaterThan(5);
    expect(new Set(data.stockCosts.map(c => c.kind)).size).toBeGreaterThan(1);
    expect(data.stockCosts.every(c => c.date <= today && c.amount > 0 && c.id.startsWith('P2-CST-'))).toBe(true);
    expect(new Set(data.stockCosts.map(c => c.id)).size).toBe(data.stockCosts.length);
  });
});
