import { describe, it, expect } from 'vitest';
import { feedNeeds, feedPerHeadDay, parseFeedLines, planFeedLines } from './feed-lines';
import { DEFAULT_PLAN } from './proposal-plan';

describe('feed lines', () => {
  const lines = [{ name: 'Concentrate', kgPerHeadDay: 6, pricePerKgKhr: 1367 }, { name: 'Straw', kgPerHeadDay: 3, pricePerKgKhr: 150 }];
  it('adds up kg and riel per animal a day', () => {
    expect(feedPerHeadDay(lines)).toEqual({ kg: 9, costKhr: 8652 });
  });
  it('works out each feed for a number of animal-days', () => {
    expect(feedNeeds(lines, 100)).toEqual([{ name: 'Concentrate', kg: 600, costKhr: 820_200 }, { name: 'Straw', kg: 300, costKhr: 45_000 }]);
  });
  it('turns an older plan into grass and concentrate lines', () => {
    expect(planFeedLines(DEFAULT_PLAN)).toEqual([{ name: 'Grass', kgPerHeadDay: 30, pricePerKgKhr: 200 }, { name: 'Concentrate', kgPerHeadDay: 7, pricePerKgKhr: 1200 }]);
    expect(planFeedLines({ ...DEFAULT_PLAN, feedLines: lines })).toBe(lines);
  });
  it('checks lines from outside', () => {
    expect(parseFeedLines(undefined)).toEqual([]);
    expect(parseFeedLines([{ name: ' Straw ', kgPerHeadDay: 3, pricePerKgKhr: 0, productId: 'P1' }])).toEqual([{ productId: 'P1', name: 'Straw', kgPerHeadDay: 3, pricePerKgKhr: 0 }]);
    expect(parseFeedLines('x')).toMatch(/not valid/);
    expect(parseFeedLines([{ name: 'Straw', kgPerHeadDay: 300, pricePerKgKhr: 0 }])).toMatch(/0 to 200/);
    expect(parseFeedLines(Array.from({ length: 21 }, () => lines[0]))).toMatch(/20 feeds/);
  });
});
