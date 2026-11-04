import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { simulate } from '../engine/simulate';
import { allLevels, parseLevel } from './levels';

describe('level files', () => {
  it('ships levels 1 to 6 in order', () => {
    expect(allLevels().map(l => l.id).slice(0, 6)).toEqual(['01-hello-world', '02-first-spike', '03-bigger-or-more', '04-flash-sale', '05-popular-content', '06-server-goes-down']);
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

    for (const mode of ['guided', 'normal', 'hard'] as const) {
      it(`${level.id}: its ${mode} starting design does not already pass the level`, () => {
        const start = level.startingDesigns[mode];
        let passed = false;
        try { passed = simulate(level, start, 1).passed; } catch { passed = false; } // an unrunnable design does not pass either
        expect(passed).toBe(false);
      });
    }

    it(`${level.id}: has a hint for guided mode`, () => {
      expect(level.guidedHint.length).toBeGreaterThan(10);
    });

    it(`${level.id}: its reference design respects the level's component options`, () => {
      for (const component of level.referenceDesign.components) {
        const options = level.componentOptions[component.type];
        if (!options) continue;
        if (options.sizes) expect(options.sizes).toContain(component.params?.size ?? catalog[component.type]!.defaultSize);
        if (options.maxInstances) expect(Number(component.params?.instances ?? 1)).toBeLessThanOrEqual(options.maxInstances);
        for (const [param, max] of Object.entries(options.limits ?? {})) expect(Number(component.params?.[param] ?? 0)).toBeLessThanOrEqual(max);
      }
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
