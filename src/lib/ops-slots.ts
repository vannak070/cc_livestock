/**
 * The 3-day calendar (user, 2026-10-15): each month is cut into ten 3-day slots (1-3, 4-6, ... 28-end). A farm's monthly
 * swap (cattle bought back and the replacement sold the same day) happens inside its slot, every month. Several farms
 * can share a slot; operations arrange them by location. Pure and browser-safe.
 *
 * A farm's slot is read from its program's start day (the first swap day): the monthly tasks fall on the same day of the
 * month, so moving a farm to another slot means moving that day.
 */
import { addMonths } from './ops-program';

export const SLOT_DAYS = 3;
export const SLOT_COUNT = 10;

const dayOfMonth = (day: string) => Number(day.slice(8, 10));

/** The slot (1 to 10) a day of the month falls in; the 28th to the end of the month is slot 10. */
export function slotOf(day: string): number {
  return Math.min(SLOT_COUNT, Math.ceil(dayOfMonth(day) / SLOT_DAYS));
}

/** First day of the month a slot starts on (1, 4, 7, ... 28). */
export const slotFirstDay = (slot: number) => (slot - 1) * SLOT_DAYS + 1;

/** The days of the month a slot covers; slot 10 runs to the end of the month. */
export function slotRange(slot: number, daysInMonth = 31): { from: number; to: number } {
  const from = slotFirstDay(slot);
  return { from, to: slot >= SLOT_COUNT ? daysInMonth : from + SLOT_DAYS - 1 };
}

/** "1-3", "4-6" ... "28-31". */
export function slotLabel(slot: number): string {
  const { from, to } = slotRange(slot);
  return `${from}–${to}`;
}

/**
 * The same year and month with the day moved into `slot`, keeping the day's place inside the slot (first, second or
 * third day) so a farm that always swaps on the second day of its slot keeps doing so.
 */
export function moveToSlot(day: string, slot: number): string {
  const place = Math.min(SLOT_DAYS - 1, (dayOfMonth(day) - slotFirstDay(slotOf(day)) + SLOT_DAYS) % SLOT_DAYS);
  const d = Math.min(28, slotFirstDay(slot) + place);
  return `${day.slice(0, 8)}${String(d).padStart(2, '0')}`;
}

/** The next swap day on or after `today` for a program that started on `startDate` (monthly, same day of the month). */
export function nextSwapDay(startDate: string, today: string): string {
  for (let k = 0; k < 600; k++) {
    const d = addMonths(startDate, k);
    if (d >= today) return d;
  }
  return startDate;
}

/** The province or last place named in an address, to group farms by location ("Siem Reap", "ខេត្តកណ្តាល"). */
export function locationOf(address: string | undefined | null): string {
  const parts = (address ?? '').split(/[,،]|\s{2,}/).map(s => s.trim()).filter(Boolean);
  const last = (parts[parts.length - 1] ?? '').split(/\s+/).filter(Boolean);
  return last.length > 2 ? last.slice(-2).join(' ') : last.join(' ');
}

export interface SlotFarm { farm: string; programId: string; location: string; startDate: string; nextSwap: string }
export interface SlotBox { slot: number; label: string; farms: SlotFarm[] }

/** The ten slots with the farms in each (farms with the same location side by side). */
export function slotBoard(programs: { id: string; farm: string; startDate: string; status: string }[], addressOf: Map<string, string | undefined>, today: string): SlotBox[] {
  const boxes: SlotBox[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({ slot: i + 1, label: slotLabel(i + 1), farms: [] }));
  for (const p of programs) {
    if (p.status === 'Closed') continue;
    boxes[slotOf(p.startDate) - 1].farms.push({ farm: p.farm, programId: p.id, location: locationOf(addressOf.get(p.farm)), startDate: p.startDate, nextSwap: nextSwapDay(p.startDate, today) });
  }
  for (const b of boxes) b.farms.sort((a, c) => a.location.localeCompare(c.location) || a.farm.localeCompare(c.farm));
  return boxes;
}
