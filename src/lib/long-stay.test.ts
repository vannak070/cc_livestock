import { describe, expect, it } from 'vitest';
import { addMonths, followUpProblem, longStayCattle, longStayMonths, longStayMonthsProblem, monthsBetween, openFollowUp } from './long-stay';
import type { CattleFollowUp, StockItem } from './types';

const cow = (id: string, purchaseDate: string | null, status = 'Active') => ({ id, purchaseDate, status }) as unknown as StockItem;
const fu = (over: Partial<CattleFollowUp>): CattleFollowUp => ({ id: 'F', cowId: 'A', action: 'sell', note: '', createdBy: 'M', createdAt: '2026-10-01T00:00:00Z', ...over });

describe('months setting', () => {
  it('defaults to 6 and accepts whole numbers from 1 to 24', () => {
    expect(longStayMonths(undefined)).toBe(6);
    expect(longStayMonths({ longStayMonths: 9 })).toBe(9);
    expect(longStayMonths({ longStayMonths: 0 })).toBe(6);
    expect(longStayMonths({ longStayMonths: 25 })).toBe(6);
    expect(longStayMonthsProblem(12)).toBeNull();
    expect(longStayMonthsProblem(1.5)).toMatch(/whole number/);
    expect(longStayMonthsProblem(0)).toMatch(/1 to 24/);
  });
});

describe('calendar months', () => {
  it('adds months and keeps the day inside short months', () => {
    expect(addMonths('2026-04-10', 6)).toBe('2026-10-10');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('counts whole months between two days', () => {
    expect(monthsBetween('2026-04-10', '2026-10-09')).toBe(5);
    expect(monthsBetween('2026-04-10', '2026-10-10')).toBe(6);
    expect(monthsBetween('2026-04-10', '2027-01-01')).toBe(8);
  });
});

describe('longStayCattle', () => {
  const stock = [
    cow('A', '2026-04-10T00:00:00.000Z'),
    cow('B', '2026-04-11T00:00:00.000Z'),
    cow('C', '2026-01-02T00:00:00.000Z'),
    cow('S', '2026-01-01T00:00:00.000Z', 'Sold'),
    cow('N', null),
  ];

  it('lists active cattle on the farm for the months or more, longest first, from the arrival day', () => {
    expect(longStayCattle(stock, 6, [], '2026-10-09').map(r => r.cow.id)).toEqual(['C']);
    const rows = longStayCattle(stock, 6, [], '2026-10-10');
    expect(rows.map(r => [r.cow.id, r.months])).toEqual([['C', 9], ['A', 6]]);
    expect(rows[1].days).toBe(183);
  });

  it('attaches the open next action and flags it when its date has passed', () => {
    const followUps = [
      fu({ id: 'old', cowId: 'C', action: 'weigh', createdAt: '2026-09-01T00:00:00Z', doneAt: '2026-09-05T00:00:00Z' }),
      fu({ id: 'now', cowId: 'C', action: 'sell', dueDate: '2026-10-05' }),
    ];
    const [c] = longStayCattle(stock, 6, followUps, '2026-10-10');
    expect(c.next?.id).toBe('now');
    expect(c.overdue).toBe(true);
    expect(openFollowUp('A', followUps)).toBeUndefined();
  });
});

describe('followUpProblem', () => {
  const today = '2026-10-10';
  it('accepts a plain action with or without a date', () => {
    expect(followUpProblem({ action: 'sell', note: '', dueDate: '' }, today)).toBeNull();
    expect(followUpProblem({ action: 'keep', note: 'heavy enough in a month', dueDate: '2026-11-10' }, today)).toBeNull();
  });

  it('rejects unknown actions, "other" without words, past or far dates and long notes', () => {
    expect(followUpProblem({ action: 'eat' as never, note: '', dueDate: '' }, today)).toMatch(/Choose what/);
    expect(followUpProblem({ action: 'other', note: '  ', dueDate: '' }, today)).toMatch(/Write what/);
    expect(followUpProblem({ action: 'sell', note: '', dueDate: '2026-10-09' }, today)).toMatch(/today or a later/);
    expect(followUpProblem({ action: 'sell', note: '', dueDate: '2027-12-01' }, today)).toMatch(/within a year/);
    expect(followUpProblem({ action: 'sell', note: '', dueDate: '2026-13-01' }, today)).toMatch(/real date/);
    expect(followUpProblem({ action: 'sell', note: 'x'.repeat(501), dueDate: '' }, today)).toMatch(/under 500/);
  });
});
