/**
 * PRACTICE data: what a real operation under Plan 2 leaves in the system, for demonstrations. Pure: no database here
 * (seed-practice.ts writes it, remove-practice.ts takes it out).
 *
 * Each real farm runs a farm program from Planning plan 2: once a month, on the farm's 3-day slot, CC Livestock buys back the
 * cattle that finished their 4 months and sells the farm 20 new ones the same day. The records here are what the farm and the
 * office would have written down along the way (cattle registered, weighed every two weeks, vaccinated, sold back, feed bought
 * in and fed, running costs), with a few things going wrong on purpose (a swap that did not happen, a part-done buy-back, a
 * postponed sale) so every status shows on the Management screens. Feed is not part of the plan.
 *
 * Every farm takes 20 cattle a month (the plan's batch); the farm's cattle limit is raised by the seed to cover a year of
 * intake, because every registered animal counts toward it. Everything is marked "P2-" so it can be removed again.
 */
import { addDays } from '../../lib/daily-feed';
import { addMonths, cycleMonths } from '../../lib/ops-program';
import { planFeedLines } from '../../lib/feed-lines';
import type { ProposalPlanParams } from '../../types/proposal.types';

export const PRACTICE_PREFIX = 'P2-';
export const PRACTICE_ACTOR = 'Practice seed';
export const DSR_PRODUCT = { id: 'PROD-F01', name: 'DSR-16 Cow Feed', unitCost: 1367 } as const;

export interface FarmScenario {
  farm: string;
  /** Short code used in cattle and batch ids. */
  code: string;
  /** Monthly cohort size sold to the farm. */
  head: number;
  /** The farm's 3-day slot (1 to 10) and swap day (inside the slot). */
  slot: number;
  day: number;
  /** Months before the current month the first cycle started (negative: next month). */
  monthsAgo: number;
  /** Cohorts whose buy-back is due but not (fully) done: cohort -> animals sold back so far. */
  unsold?: Record<number, number>;
  /** Cohorts that never arrived (the swap did not happen). */
  missSell?: number[];
  /** The cohort due today has not arrived yet (it is still to be registered). */
  holdToday?: boolean;
  /** Share of a month's feed that was bought in, by cohort number; missing = all of it, 0 = none. */
  feed?: Record<number, number>;
  /** Animals in the newest cohort that are sick. */
  sick?: number;
  /** Extra days since the last weighing. */
  weighLag?: number;
  /** Days without a feed record at the end (the farm forgot to write them down). */
  feedMissed?: number;
  /** Task changes made by the office, by cycle key. */
  postpone?: { kind: 'sell_to_farm'; cycleKey: string; days: number; reason: string };
  start?: { kind: 'sell_to_farm'; cycleKey: string; owner: string; note: string };
  /** Monthly running costs. */
  monthlyCost: number;
}

/**
 * Real farms with a plan, arranged by location the way operations would: Kratie farms share slot 1, Kampot farms slot 2,
 * the others one slot each (more than one farm in a slot is normal; there will be up to 50 farms).
 */
export const SCENARIOS: FarmScenario[] = [
  { farm: 'VannaraCC1', code: 'VNR1', head: 20, slot: 1, day: 2, monthsAgo: 7, sick: 2, monthlyCost: 4_200_000 },
  { farm: 'SothunCC7', code: 'STN7', head: 20, slot: 1, day: 1, monthsAgo: 6, unsold: { 2: 0 }, missSell: [6], feed: { 4: 0.4, 5: 0 }, weighLag: 9, feedMissed: 5, sick: 2, monthlyCost: 3_100_000 },
  { farm: 'SunnyCC9', code: 'SNY9', head: 20, slot: 2, day: 5, monthsAgo: 3, postpone: { kind: 'sell_to_farm', cycleKey: 'c4', days: 10, reason: 'Truck not available' }, feedMissed: 2, monthlyCost: 3_300_000 },
  { farm: 'VechneatCC10', code: 'VCN10', head: 20, slot: 2, day: 6, monthsAgo: 1, monthlyCost: 3_000_000 },
  { farm: 'KImchhatCC5', code: 'KMC5', head: 20, slot: 3, day: 8, monthsAgo: 4, sick: 2, monthlyCost: 3_400_000 },
  { farm: 'SophalCC12', code: 'SPL12', head: 20, slot: 5, day: 15, monthsAgo: 0, holdToday: true, start: { kind: 'sell_to_farm', cycleKey: 'c0', owner: 'Operations team', note: 'Cattle booked; transport arranged for the start day.' }, monthlyCost: 3_300_000 },
  { farm: 'CC_001', code: 'C001', head: 20, slot: 7, day: 20, monthsAgo: 8, unsold: { 3: 12 }, sick: 1, monthlyCost: 4_600_000 },
  { farm: 'ViraksakCC2', code: 'VRK2', head: 20, slot: 7, day: 21, monthsAgo: 5, monthlyCost: 3_200_000 },
  { farm: 'VanndaCC3', code: 'VND3', head: 20, slot: 8, day: 22, monthsAgo: 4, start: { kind: 'sell_to_farm', cycleKey: 'c4', owner: 'Operations team', note: 'Truck booked for the swap.' }, monthlyCost: 3_000_000 },
  { farm: 'NimolCC11', code: 'NML11', head: 20, slot: 8, day: 23, monthsAgo: 1, sick: 1, monthlyCost: 3_000_000 },
];

/** Farms that already hold their own cattle: the program is set up around them and no cattle are added. */
export const EXISTING: { farm: string; code: string; head: number; slot: number; day: number; monthsAgo: number; monthlyCost: number }[] = [
  { farm: 'SokcheaCC4', code: 'SKC4', head: 20, slot: 4, day: 11, monthsAgo: -1, monthlyCost: 1_300_000 },
  { farm: 'SNR Farm', code: 'SNR', head: 20, slot: 6, day: 16, monthsAgo: -1, monthlyCost: 3_800_000 },
];

export interface PCow {
  id: string; no: string; breed: string; sex: 'Male' | 'Female'; weight: number; location: string; unitPrice: number; totalPrice: number;
  healthStatus: 'Good' | 'Poor'; status: 'Active' | 'Sold'; purchaseDate: string; batchId: string;
}
export interface PWeighing { cowId: string; breed: string; oldWeight: number; currentWeight: number; gainLoss: number; healthStatus: string; status: string; date: string }
export interface PHealth { id: string; cowId: string; type: 'Vaccination' | 'Deworming' | 'Disease' | 'Treatment'; name: string; date: string; by: string; cost: number; notes: string }
/** An animal CC Livestock holds (or held) after collecting it: received on the collection day, sold on to a buyer, or lost. */
export interface PHolding {
  cowId: string; sourceFarm: string; batchId: string; collectedOn: string; collectionWeight: number; collectionTotal: number;
  status: 'Held' | 'Sold' | 'Lost'; soldOn?: string; buyer?: string; buyerId?: string; saleWeight?: number; salePricePerKg?: number; saleTotal?: number; lostOn?: string; note?: string;
}
/** A buyer of CamCow stock (migration 030). */
export interface PBuyer { id: string; name: string; kind: 'slaughterhouse' | 'trader' | 'farm' | 'other'; phone: string; location: string }
/** A cost of keeping cattle at CamCow's stock site (migration 032). */
export interface PStockCost { id: string; date: string; kind: 'feed' | 'medicine' | 'labour' | 'transport' | 'other'; amount: number; note: string }
export interface PSale { cowId: string; breed: string; weight: number; unitPrice: number; totalPrice: number; date: string }
export interface PBatch { id: string; name: string; startDate: string; status: 'Active' | 'Closed'; farm: string; price: number; target: string; cowIds: string[] }
export interface PFeedIn { id: string; date: string; kg: number; bags: number; farm: string; note: string }
export interface PFeedDay { farm: string; day: string; batches: { batchId: string; units: number }[] }
export interface PCost { id: string; farm: string; category: string; amount: number; date: string; note: string }
export interface PProgram { farm: string; startDate: string; headPerCycle: number }
export interface PChange { farm: string; kind: 'sell_to_farm'; cycleKey: string; action: 'postpone' | 'start'; days?: number; reason?: string; owner?: string; note?: string }

export interface PracticeData {
  today: string;
  cows: PCow[];
  weighings: PWeighing[];
  health: PHealth[];
  batches: PBatch[];
  sales: PSale[];
  holdings: PHolding[];
  buyers: PBuyer[];
  stockCosts: PStockCost[];
  feedIns: PFeedIn[];
  feedDays: PFeedDay[];
  costs: PCost[];
  programs: PProgram[];
  changes: PChange[];
}

const BREEDS = ['គោទន្លេ', 'ប្រ៉ាម៉ាន់ កាត់ទន្លេ', 'ប្រ៉ាម៉ាន់'];
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const round1 = (n: number) => Math.round(n * 10) / 10;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The program start for a scenario: its swap day in the month it started (monthsAgo months before this one). */
export function startOf(s: { day: number; monthsAgo: number }, today: string): string {
  return addMonths(`${today.slice(0, 7)}-${String(s.day).padStart(2, '0')}`, -s.monthsAgo);
}

export function buildPracticeData(today: string, plan: ProposalPlanParams): PracticeData {
  const rand = mulberry32(Number(today.replace(/-/g, '')) + 7);
  const F = cycleMonths(plan);
  const gain = plan.dailyWeightGainKg;
  const buyPrice = plan.sellingPricePerKgKhr; // what CC Livestock pays when it buys the cattle back
  const sellPrice = plan.purchasePricePerKgKhr; // what the farm pays for the cattle sold to it
  const feedKgPerHeadDay = planFeedLines(plan).filter(l => /dsr/i.test(l.name)).reduce((s, l) => s + l.kgPerHeadDay, 0) || 8;

  const out: PracticeData = { today, cows: [], weighings: [], health: [], batches: [], sales: [], holdings: [], buyers: [], stockCosts: [], feedIns: [], feedDays: [], costs: [], programs: [], changes: [] };
  let healthSeq = 0;
  const addHealth = (cowId: string, type: PHealth['type'], name: string, date: string, by: string, cost: number, notes = '') => {
    if (date > today) return;
    out.health.push({ id: `${PRACTICE_PREFIX}HL-${String(++healthSeq).padStart(4, '0')}`, cowId, type, name, date, by, cost, notes });
  };

  for (const s of SCENARIOS) {
    const start = startOf(s, today);
    out.programs.push({ farm: s.farm, startDate: start, headPerCycle: s.head });
    let n = 0;
    const activeByBatch: { batchId: string; start: string; head: number }[] = [];
    let lastCohort: string[] = [];

    for (let k = 0; ; k++) {
      const sellDay = addMonths(start, k);
      if (sellDay > today || (s.holdToday && sellDay === today)) break;
      if (s.missSell?.includes(k)) continue; // the swap did not happen this month
      const buyDay = addMonths(start, k + F);
      const batchId = `${PRACTICE_PREFIX}B-${s.code}-${String(k + 1).padStart(2, '0')}`;
      const soldBack = buyDay <= today ? (k in (s.unsold ?? {}) ? s.unsold![k] : s.head) : 0;
      const ids: string[] = [];
      for (let i = 0; i < s.head; i++) {
        n++;
        const id = `${PRACTICE_PREFIX}${s.code}-${String(n).padStart(3, '0')}`;
        const breed = BREEDS[(n + k) % BREEDS.length];
        const w0 = round1(plan.initialWeightKg + (rand() - 0.5) * 36);
        const perDay = gain + (rand() - 0.5) * 0.3;
        const sold = i < soldBack;
        const saleDay = sold ? (daysBetween(buyDay, today) >= 2 ? addDays(buyDay, (k + i) % 3 === 0 ? 1 : 0) : buyDay) : '';
        const lag = (i % 12) + 1 + (s.weighLag ?? 0);
        const endDay = sold ? saleDay : addDays(today, -lag);
        const weigh: string[] = [sellDay];
        for (let d = addDays(sellDay, 14 + (rand() < 0.3 ? 1 : 0)); d < endDay; d = addDays(d, 14 + (rand() < 0.3 ? 1 : 0))) weigh.push(d);
        if (endDay > sellDay) weigh.push(endDay);
        let prev = 0;
        weigh.forEach((day, j) => {
          const w = j === 0 ? w0 : round1(w0 + perDay * daysBetween(sellDay, day) + (rand() - 0.5) * 3);
          const last = j === weigh.length - 1;
          out.weighings.push({ cowId: id, breed, oldWeight: prev, currentWeight: w, gainLoss: prev > 0 ? Math.round(((w - prev) / prev) * 10000) / 10000 : 0, healthStatus: 'Good', status: last && sold ? 'Sold' : 'Active', date: day });
          prev = w;
        });
        out.cows.push({
          id, no: String(n), breed, sex: (n + k) % 5 < 3 ? 'Male' : 'Female', weight: prev, location: s.farm, unitPrice: sellPrice, totalPrice: Math.round(w0 * sellPrice),
          healthStatus: 'Good', status: sold ? 'Sold' : 'Active', purchaseDate: sellDay, batchId,
        });
        if (sold) out.sales.push({ cowId: id, breed, weight: prev, unitPrice: buyPrice, totalPrice: Math.round(prev * buyPrice), date: saleDay });
        ids.push(id);
        addHealth(id, 'Vaccination', 'FMD Vaccine', addDays(sellDay, 7), `Vet, ${s.farm}`, 3000);
        if (i % 2 === 0) addHealth(id, 'Deworming', 'Ivermectin', addDays(sellDay, 10), `Staff, ${s.farm}`, 1500);
      }
      const remaining = s.head - soldBack;
      out.batches.push({
        id: batchId, name: `Plan 2 · cycle ${k + 1}`, startDate: sellDay, status: remaining === 0 ? 'Closed' : 'Active', farm: s.farm, price: buyPrice, target: buyDay, cowIds: ids,
      });
      if (remaining > 0) activeByBatch.push({ batchId, start: sellDay, head: remaining });
      lastCohort = ids;
      // Feed bought in on the swap day for the month ahead (ordinary feed stock, not part of the plan).
      const share = s.feed && k in s.feed ? s.feed[k] : 1;
      const kg = Math.round(Math.min(k + 1, F) * s.head * feedKgPerHeadDay * 30 * share);
      if (share > 0) out.feedIns.push({ id: `${PRACTICE_PREFIX}TX-${s.code}-${String(k + 1).padStart(2, '0')}`, date: sellDay, kg, bags: round1(kg / 30), farm: s.farm, note: share < 1 ? 'Part of the month\'s DSR-16' : 'DSR-16 for the month' });
    }

    // Sick animals in the newest cohort: still Poor, with a disease record in the last few days.
    for (let j = 0; j < (s.sick ?? 0); j++) {
      const id = lastCohort[j * 2];
      const cow = out.cows.find(c => c.id === id);
      if (!cow || cow.status !== 'Active') continue;
      cow.healthStatus = 'Poor';
      const w = out.weighings.filter(x => x.cowId === id).at(-1);
      if (w) w.healthStatus = 'Poor';
      addHealth(id, 'Disease', j % 2 === 0 ? 'Lumpy skin disease' : 'Foot rot', addDays(today, -(1 + j)), `Vet, ${s.farm}`, 0, j % 2 === 0 ? 'Nodules on the back; keep apart from the others.' : 'Limping on a hind leg.');
    }

    // Feed written down for the last two weeks, for the batches on the farm.
    const missed = s.feedMissed ?? 0;
    for (let k = 14; k >= missed; k--) {
      const day = addDays(today, -k);
      const batches = activeByBatch.filter(b => b.start <= day).map(b => ({ batchId: b.batchId, units: round1((b.head * feedKgPerHeadDay) / 30) }));
      if (batches.length > 0) out.feedDays.push({ farm: s.farm, day, batches });
    }

    // Three months of running costs.
    addCosts(out, s.farm, s.code, s.monthlyCost, today, rand);

    if (s.postpone) out.changes.push({ farm: s.farm, kind: s.postpone.kind, cycleKey: s.postpone.cycleKey, action: 'postpone', days: s.postpone.days, reason: s.postpone.reason });
    if (s.start) out.changes.push({ farm: s.farm, kind: s.start.kind, cycleKey: s.start.cycleKey, action: 'start', owner: s.start.owner, note: s.start.note });
  }

  for (const e of EXISTING) {
    out.programs.push({ farm: e.farm, startDate: startOf(e, today), headPerCycle: e.head });
    addCosts(out, e.farm, e.code, e.monthlyCost, today, rand);
  }

  // CamCow's stock site: collected cattle are received there, held for a while, and sold on to buyers by scale. The newest collections
  // are still on their way (waiting to be received), a few animals were lost, and some lots stay unsold for over a month.
  out.buyers.push(
    { id: `${PRACTICE_PREFIX}BUY-1`, name: 'Phnom Penh Meat Co.', kind: 'slaughterhouse', phone: '012 345 678', location: 'Phnom Penh' },
    { id: `${PRACTICE_PREFIX}BUY-2`, name: 'Kampot Cattle Traders', kind: 'trader', phone: '011 222 333', location: 'Kampot' },
    { id: `${PRACTICE_PREFIX}BUY-3`, name: 'Siem Reap Slaughterhouse', kind: 'slaughterhouse', phone: '097 888 999', location: 'Siem Reap' },
  );
  const cowOf = new Map(out.cows.map(c => [c.id, c]));
  const lotKeys = [...new Set(out.sales.map(x => `${cowOf.get(x.cowId)!.location}|${x.date}`))].sort();
  const lotIndex = new Map(lotKeys.map((k, i) => [k, i]));
  out.sales.forEach((x, i) => {
    const cow = cowOf.get(x.cowId)!;
    const age = daysBetween(x.date, today);
    if (age < 8) return;
    const base = { cowId: x.cowId, sourceFarm: cow.location, batchId: cow.batchId, collectedOn: x.date, collectionWeight: x.weight, collectionTotal: x.totalPrice };
    const li = lotIndex.get(`${cow.location}|${x.date}`)!;
    if (i % 97 === 50) { out.holdings.push({ ...base, status: 'Lost', lostOn: addDays(x.date, 3), note: 'Died after transport' }); return; }
    if (li % 7 === 3 || age < 21) { out.holdings.push({ ...base, status: 'Held' }); return; }
    const days = 7 + (li % 12);
    const weight = round1(x.weight + 0.9 * days + (rand() - 0.5) * 4);
    const price = 13_000 + (li % 5) * 100;
    out.holdings.push({ ...base, status: 'Sold', soldOn: addDays(x.date, days), buyer: out.buyers[li % out.buyers.length].name, buyerId: out.buyers[li % out.buyers.length].id, saleWeight: weight, salePricePerKg: price, saleTotal: Math.round(weight * price) });
  });

  // Holding costs at the stock site: feed every 3 days for the animals in stock, labour weekly, medicine every two weeks.
  if (out.holdings.length > 0) {
    const first = out.holdings.reduce((m, x) => (x.collectedOn < m ? x.collectedOn : m), out.holdings[0].collectedOn);
    const endOf = (x: PHolding) => (x.status === 'Sold' ? x.soldOn : x.status === 'Lost' ? x.lostOn : undefined);
    for (let d = addDays(first, 1), n = 0; d <= today; d = addDays(d, 1), n++) {
      const inStock = out.holdings.filter(x => x.collectedOn <= d && (endOf(x) === undefined || endOf(x)! >= d)).length;
      if (inStock === 0) continue;
      const id = (k: string) => `${PRACTICE_PREFIX}CST-${k}-${d}`;
      if (n % 3 === 0) out.stockCosts.push({ id: id('F'), date: d, kind: 'feed', amount: Math.round((inStock * 3 * 2_500) / 1000) * 1000, note: 'Hay and feed for 3 days' });
      if (n % 7 === 0) out.stockCosts.push({ id: id('L'), date: d, kind: 'labour', amount: 150_000, note: 'Weekly wages' });
      if (n % 14 === 6) out.stockCosts.push({ id: id('M'), date: d, kind: 'medicine', amount: 80_000, note: 'Vitamins and deworming' });
    }
  }

  out.health.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return out;
}

function addCosts(out: PracticeData, farm: string, code: string, monthly: number, today: string, rand: () => number) {
  const share: [string, number, number][] = [['Wages', 0.6, 20], ['Power and water', 0.15, 12], ['Fuel and transport', 0.25, 5]];
  for (let m = 0; m < 3; m++) {
    share.forEach(([category, part, dayAgo]) => {
      const day = addDays(today, -(30 * m + dayAgo));
      out.costs.push({ id: `${PRACTICE_PREFIX}COST-${code}-${m}-${category.slice(0, 2).toUpperCase()}`, farm, category, amount: Math.round((monthly * part * (0.93 + rand() * 0.14)) / 1000) * 1000, date: day, note: `${category} for the month` });
    });
  }
}
