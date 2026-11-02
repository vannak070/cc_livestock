import { describe, expect, it } from 'vitest';
import { locationOf, moveToSlot, nextSwapDay, slotBoard, slotLabel, slotOf, slotRange } from './ops-slots';

describe('3-day slots', () => {
  it('cuts the month into ten slots, the last running to the end of the month', () => {
    expect([1, 3, 4, 27, 28, 31].map(d => slotOf(`2026-10-${String(d).padStart(2, '0')}`))).toEqual([1, 1, 2, 9, 10, 10]);
    expect(slotLabel(1)).toBe('1–3');
    expect(slotLabel(10)).toBe('28–31');
    expect(slotRange(10, 30)).toEqual({ from: 28, to: 30 });
  });

  it('moves a swap day into another slot, keeping its place inside the slot', () => {
    expect(moveToSlot('2026-03-12', 1)).toBe('2026-03-03'); // 12 is the 3rd day of slot 4 -> 3rd day of slot 1
    expect(moveToSlot('2026-03-10', 5)).toBe('2026-03-13'); // 1st -> 1st
    expect(moveToSlot('2026-03-11', 10)).toBe('2026-03-28'); // never past the 28th, so every month has the day
  });

  it('finds the next swap day on or after today, monthly on the same day', () => {
    expect(nextSwapDay('2026-03-12', '2026-10-15')).toBe('2026-11-12');
    expect(nextSwapDay('2026-03-12', '2026-10-12')).toBe('2026-10-12');
    expect(nextSwapDay('2026-12-20', '2026-10-15')).toBe('2026-12-20');
  });

  it('names the location from the end of the address', () => {
    expect(locationOf('Siem Reap, Cambodia')).toBe('Cambodia');
    expect(locationOf('ស្នួល ក្រចេះ')).toBe('ស្នួល ក្រចេះ');
    expect(locationOf('')).toBe('');
  });

  it('puts farms in the slot of their start day, closed programs left out, same location together', () => {
    const address = new Map<string, string | undefined>([['A', 'x, Kampot'], ['B', 'x, Kratie'], ['C', 'x, Kampot']]);
    const board = slotBoard([
      { id: '1', farm: 'A', startDate: '2026-05-05', status: 'Active' },
      { id: '2', farm: 'B', startDate: '2026-05-04', status: 'Active' },
      { id: '3', farm: 'C', startDate: '2026-05-06', status: 'Active' },
      { id: '4', farm: 'D', startDate: '2026-05-06', status: 'Closed' },
    ], address, '2026-10-15');
    expect(board).toHaveLength(10);
    expect(board[1].farms.map(f => f.farm)).toEqual(['A', 'C', 'B']);
    expect(board[1].farms[0].nextSwap).toBe('2026-11-05');
    expect(board.flatMap(b => b.farms).length).toBe(3);
  });
});
