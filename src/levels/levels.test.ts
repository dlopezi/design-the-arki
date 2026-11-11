import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { designCost } from '../engine/simulate';
import { callNow, createGame, run, starsOf, waveEnd } from '../realtime/game';
import { allLevels, parseLevel } from './levels';
import { levelTextEs } from './text.es';

describe('Spanish level texts', () => {
  for (const level of allLevels('en')) {
    it(`${level.id}: has a complete Spanish entry`, () => {
      const es = levelTextEs[level.id];
      expect(es, 'missing entry in text.es.ts').toBeDefined();
      expect(es!.tutorial?.length ?? 0).toBe(level.tutorial?.length ?? 0);
      level.tutorial?.forEach((step, i) => expect(Boolean(es!.tutorial![i]!.textCompact)).toBe(Boolean(step.textCompact)));
    });
  }

  it('has no entry for a level that does not exist', () => {
    const ids = allLevels('en').map(l => l.id);
    expect(Object.keys(levelTextEs).filter(id => !ids.includes(id))).toEqual([]);
  });

  it('changes only the texts, never the rules', () => {
    const en = allLevels('en'), es = allLevels('es');
    es.forEach((level, i) => {
      const { chapter: _c, title: _t, brief: _b, guidedHint: _g, tutorial: tutEs, ...rulesEs } = level;
      const { chapter: _c2, title: _t2, brief: _b2, guidedHint: _g2, tutorial: tutEn, ...rulesEn } = en[i]!;
      expect(rulesEs).toEqual(rulesEn);
      expect(tutEs?.map(s => [s.target, s.until])).toEqual(tutEn?.map(s => [s.target, s.until]));
    });
  });
});

describe('level files', () => {
  it('ships the 8 levels of chapter 1 in order', () => {
    expect(allLevels().map(l => l.id)).toEqual(['01-hello-world', '02-first-spike', '03-bigger-or-more', '04-flash-sale', '05-popular-content', '06-server-goes-down', '07-tight-budget', '08-black-friday']);
  });

  for (const level of allLevels()) {
    it(`${level.id}: its reference design, bought at the start, lasts the wave: 2 stars, and all 3 when the users are called early`, () => {
      const bought = () => { const s = createGame(level, level.referenceDesign); return { ...s, money: s.money - designCost(level.referenceDesign) }; };
      const plain = run(bought(), waveEnd(level) + 1, level);
      expect(plain.phase).toBe('won');
      expect(starsOf(plain, level)).toBe(2);
      const early = run(callNow(run(bought(), 10, level)), level.play.wave.lengthS + 1, level);
      expect(starsOf(early, level)).toBe(3);
    });

    it(`${level.id}: its reference design only uses the level's allowed components`, () => {
      const used = level.referenceDesign.components.map(c => c.type);
      expect(used.filter(type => !level.allowedComponents.includes(type))).toEqual([]);
    });

    for (const mode of ['guided', 'normal', 'hard'] as const) {
      it(`${level.id}: its ${mode} starting design, left as it is, does not last the wave`, () => {
        expect(run(createGame(level, level.startingDesigns[mode]), waveEnd(level) + 1, level).phase).toBe('lost');
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
