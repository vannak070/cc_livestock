import { describe, expect, it } from 'vitest';
import { FARM_COLORS, canDropOn, canMoveTask, exchangePartner, farmColorMap, monthGrid } from './ops-calendar';
import type { TaskStatus } from './ops-program';

const view = (id: string, kind: 'sell_to_farm' | 'buy_back', dueDate: string, status: TaskStatus = 'planned', programId = 'P1') =>
  ({ task: { id, programId, kind, dueDate }, state: { status } });

describe('moving tasks', () => {
  it('only tasks still to do can be moved', () => {
    expect(['planned', 'due_soon', 'in_progress', 'late', 'postponed'].every(s => canMoveTask(s as TaskStatus))).toBe(true);
    expect(canMoveTask('done')).toBe(false);
    expect(canMoveTask('cancelled')).toBe(false);
  });

  it('a task can be dropped on another day that is not in the past', () => {
    expect(canDropOn('2026-10-01', '2026-10-06', '2026-10-16')).toBe(false); // past
    expect(canDropOn('2026-10-01', '2026-10-16', '2026-10-16')).toBe(true);   // late task to today
    expect(canDropOn('2026-10-20', '2026-10-20', '2026-10-16')).toBe(false);  // same day
    expect(canDropOn('2026-10-20', '2026-11-03', '2026-10-16')).toBe(true);
  });

  it('finds the other half of an exchange day, in the same program only', () => {
    const collect = view('a', 'buy_back', '2026-10-20');
    const sell = view('b', 'sell_to_farm', '2026-10-20');
    const views = [collect, sell, view('c', 'sell_to_farm', '2026-10-20', 'planned', 'P2'), view('d', 'sell_to_farm', '2026-10-21')];
    expect(exchangePartner(views, collect.task)?.task.id).toBe('b');
    expect(exchangePartner(views, sell.task)?.task.id).toBe('a');
    expect(exchangePartner([collect, view('b', 'sell_to_farm', '2026-10-20', 'done')], collect.task)).toBeUndefined();
    expect(exchangePartner([view('x', 'sell_to_farm', '2026-10-20')], view('y', 'sell_to_farm', '2026-10-20').task)).toBeUndefined();
  });
});

describe('farm colours', () => {
  it('gives each farm its own colour, the same whatever order the list comes in', () => {
    const a = farmColorMap(['SNR Farm', 'CC_001', 'Kimchhat']);
    const b = farmColorMap(['Kimchhat', 'CC_001', 'SNR Farm', 'CC_001']);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(new Set([...a.values()]).size).toBe(3);
    expect(a.get('CC_001')).toBe(FARM_COLORS[0]);
  });
  it('reuses colours after ten farms', () => {
    const m = farmColorMap(Array.from({ length: 12 }, (_, i) => `F${String(i).padStart(2, '0')}`));
    expect(m.get('F10')).toBe(FARM_COLORS[0]);
  });
});

describe('monthGrid (unchanged)', () => {
  it('starts on a Monday', () => {
    expect(monthGrid('2026-10')[0][0].day).toBe('2026-09-28');
  });
});
