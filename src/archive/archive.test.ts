import { describe, expect, it } from 'vitest';
import type { Progress } from '../progress/progress';
import { archiveEntries } from './archive';

const levels = [
  { id: 'l1', title: 'One', allowedComponents: ['appServer', 'database'] },
  { id: 'l2', title: 'Two', allowedComponents: ['loadBalancer', 'appServer', 'database'] },
  { id: 'l3', title: 'Three', allowedComponents: ['loadBalancer', 'appServer', 'cache', 'database'] },
];
const progress = (passed: string[]): Progress => ({ version: 1, levels: Object.fromEntries(passed.map(id => [id, { bestStars: 1 }])) });

describe('building archive', () => {
  it('lists every component in the order the levels introduce it, with the level that brings it', () => {
    expect(archiveEntries(levels, progress([])).map(e => [e.type, e.level.number, e.level.title])).toEqual([
      ['appServer', 1, 'One'], ['database', 1, 'One'], ['loadBalancer', 2, 'Two'], ['cache', 3, 'Three'],
    ]);
  });

  it('unlocks a component once the level that brings it is open', () => {
    const unlocked = archiveEntries(levels, progress(['l1'])).filter(e => e.unlocked).map(e => e.type);
    expect(unlocked).toEqual(['appServer', 'database', 'loadBalancer']);
  });

  it('gives each component its monthly cost from the catalog', () => {
    expect(archiveEntries(levels, progress([])).find(e => e.type === 'appServer')!.monthlyCost).toBe(40);
  });
});
