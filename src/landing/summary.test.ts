import { describe, expect, it } from 'vitest';
import type { Progress } from '../progress/progress';
import { playerSummary } from './summary';

const levels = [
  { id: 'a', chapter: 'Core', title: 'A', starCostThresholds: [10, 5] },
  { id: 'b', chapter: 'Core', title: 'B', starCostThresholds: [10] },
  { id: 'c', chapter: 'Async', title: 'C', starCostThresholds: [10, 5] },
];
const progress = (stars: Record<string, number>): Progress => ({ version: 1, levels: Object.fromEntries(Object.entries(stars).map(([id, bestStars]) => [id, { bestStars }])) });

describe('title screen player summary', () => {
  it('shows a new player no stars, the first chapter and level 1 next', () => {
    expect(playerSummary(levels, progress({}))).toEqual({
      stars: 0, maxStars: 8,
      chapter: { number: 1, name: 'Core', passed: 0, levels: 2 },
      next: { number: 1, title: 'A' },
    });
  });

  it('counts stars and passed levels in the chapter of the next level', () => {
    expect(playerSummary(levels, progress({ a: 3, b: 1 }))).toEqual({
      stars: 4, maxStars: 8,
      chapter: { number: 2, name: 'Async', passed: 0, levels: 1 },
      next: { number: 3, title: 'C' },
    });
  });

  it('shows the last chapter complete and no next level when everything is passed', () => {
    expect(playerSummary(levels, progress({ a: 1, b: 2, c: 3 }))).toMatchObject({
      stars: 6,
      chapter: { number: 2, name: 'Async', passed: 1, levels: 1 },
      next: null,
    });
  });
});
