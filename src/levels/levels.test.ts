import { describe, expect, it } from 'vitest';
import { simulate } from '../engine/simulate';
import { allLevels, parseLevel } from './levels';

describe('level files', () => {
  it('ships at least level 1', () => {
    expect(allLevels().map(l => l.id)).toContain('01-hello-world');
  });

  for (const level of allLevels()) {
    it(`${level.id}: its reference design passes the level`, () => {
      const result = simulate(level, level.referenceDesign, 1);
      expect(result.checks.filter(c => !c.ok)).toEqual([]);
    });

    it(`${level.id}: its reference design only uses the level's allowed components`, () => {
      const used = level.referenceDesign.components.map(c => c.type);
      expect(used.filter(type => !level.allowedComponents.includes(type))).toEqual([]);
    });
  }

  it('rejects a level file without requirements', () => {
    const broken = { id: 'x', title: 'X', brief: 'b', durationS: 10, traffic: [{ fromS: 0, toS: 10, rps: 5 }],
      referenceDesign: { components: [], connections: [] } };
    expect(() => parseLevel(broken)).toThrow(/requirements/);
  });

  it('rejects a reference design that uses an unknown component type', () => {
    const broken = { id: 'x', title: 'X', brief: 'b', durationS: 10, traffic: [{ fromS: 0, toS: 10, rps: 5 }],
      requirements: { p95Ms: 200, maxErrorRate: 0.01 },
      referenceDesign: { components: [{ id: 'q', type: 'quantumComputer' }], connections: [['client', 'q']] } };
    expect(() => parseLevel(broken)).toThrow(/quantumComputer/);
  });
});
