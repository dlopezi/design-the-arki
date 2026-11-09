import { describe, expect, it } from 'vitest';
import type { Progress } from '../progress/progress';
import { mainAction } from './mainAction';

const levels = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const progress = (passed: string[]): Progress => ({ version: 1, levels: Object.fromEntries(passed.map(id => [id, { bestStars: 1 }])) });

describe('landing main button', () => {
  it('sends a new player to the briefing, which explains each building before level 1', () => {
    expect(mainAction(levels, progress([]))).toEqual({ href: '#briefing', label: 'Play level 1', returning: false });
  });

  it('sends a returning player to the first level not passed yet', () => {
    expect(mainAction(levels, progress(['a']))).toEqual({ href: '#b', label: 'Continue: level 2', returning: true });
  });

  it('sends a player who passed everything to the level map', () => {
    expect(mainAction(levels, progress(['a', 'b', 'c']))).toEqual({ href: '#levels', label: 'Play again', returning: true });
  });
});
