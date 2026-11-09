import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import type { Progress } from '../progress/progress';
import { baseOf, buildingCount } from './base';

const reference = (components: Design['components']): Design => ({ components, connections: [] });
const levels = [
  { id: 'l1', title: 'One', referenceDesign: reference([{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }]) },
  { id: 'l2', title: 'Two', referenceDesign: reference([{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }]) },
  { id: 'l3', title: 'Three', referenceDesign: reference([{ id: 'c', type: 'cache' }]) },
];

describe('the player\'s Base', () => {
  it('is empty before the first pass', () => {
    expect(baseOf(levels, { version: 1, levels: {} })).toEqual({ districts: [], buildings: 0 });
  });

  it('has one district per passed level, with one building per instance of the design that passed', () => {
    const progress: Progress = { version: 1, levels: {
      l1: { bestStars: 1 },
      l2: { bestStars: 2, passedDesign: reference([{ id: 'lb', type: 'loadBalancer' }, { id: 'a', type: 'appServer', params: { instances: 3 } }, { id: 'db', type: 'database' }]) },
      l3: { bestStars: 0 },
    } };
    const base = baseOf(levels, progress);
    expect(base.districts.map(d => [d.number, d.title, d.buildings])).toEqual([
      [1, 'One', [{ type: 'appServer', count: 1 }, { type: 'database', count: 1 }]],
      [2, 'Two', [{ type: 'loadBalancer', count: 1 }, { type: 'appServer', count: 3 }, { type: 'database', count: 1 }]],
    ]);
    expect(base.buildings).toBe(7);
  });
});

describe('buildings a design adds to the Base', () => {
  it('counts one building per instance', () => {
    expect(buildingCount(reference([{ id: 'lb', type: 'loadBalancer' }, { id: 'a', type: 'appServer', params: { instances: 4 } }, { id: 'db', type: 'database' }]))).toBe(6);
  });
});
