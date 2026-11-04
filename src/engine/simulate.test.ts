import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import type { Design, Level } from './types';

// An app server (4 workers, 20 ms) serves ~200 req/s; a small database (8 connections, 20 ms) ~400 req/s.
function levelAt(rps: number, overrides: Partial<Level> = {}): Level {
  return {
    durationS: 30,
    traffic: [{ fromS: 0, toS: 30, rps }],
    requirements: { p95Ms: 200, maxErrorRate: 0.01 },
    budget: 1000,
    starCostThresholds: [],
    ...overrides,
  };
}

const serverAndDatabase: Design = {
  components: [
    { id: 'api', type: 'appServer' },
    { id: 'db', type: 'database' },
  ],
  connections: [['client', 'api'], ['api', 'db']],
};

describe('simulate', () => {
  it('passes a level when the design has spare capacity', () => {
    const result = simulate(levelAt(50), serverAndDatabase, 1);

    expect(result.passed).toBe(true);
    expect(result.errorRate).toBe(0);
  });

  it('fails a level and rejects requests at the saturated component when traffic exceeds its capacity', () => {
    const result = simulate(levelAt(300), serverAndDatabase, 1);

    expect(result.passed).toBe(false);
    const byId = Object.fromEntries(result.components.map(c => [c.id, c]));
    expect(byId.api!.rejected).toBeGreaterThan(0);
    expect(byId.db!.rejected).toBe(0);
    expect(result.errors.rejected).toBe(byId.api!.rejected);
  });

  it('matches queueing theory when lightly loaded: p95 of two 20 ms stations is about 95 ms', () => {
    // Two exponential stages of mean 20 ms sum to an Erlang-2 whose 95th percentile is 20 × 4.744 ≈ 95 ms,
    // plus ~2 ms of network hops.
    const result = simulate(levelAt(10, { durationS: 300, traffic: [{ fromS: 0, toS: 300, rps: 10 }] }), serverAndDatabase, 7);

    expect(result.p95).toBeGreaterThan(85);
    expect(result.p95).toBeLessThan(110);
  });

  it('gives an identical result for the same seed', () => {
    expect(simulate(levelAt(180), serverAndDatabase, 42)).toEqual(simulate(levelAt(180), serverAndDatabase, 42));
  });

  it('gives a close but different result for a different seed', () => {
    const a = simulate(levelAt(100), serverAndDatabase, 1);
    const b = simulate(levelAt(100), serverAndDatabase, 2);

    expect(a.totalRequests).not.toBe(b.totalRequests);
    expect(Math.abs(a.p95 - b.p95) / a.p95).toBeLessThan(0.15);
    expect(a.passed).toBe(b.passed);
  });

  describe('cost and stars', () => {
    it('prices the design from the catalogue: an app server ($40) and a small database ($50) cost $90/month', () => {
      expect(simulate(levelAt(50), serverAndDatabase, 1).cost).toBe(90);
    });

    it('fails a level when the design costs more than the budget, even if it is fast enough', () => {
      const result = simulate(levelAt(50, { budget: 80 }), serverAndDatabase, 1);

      expect(result.passed).toBe(false);
      expect(result.checks.find(c => c.requirement === 'budget')).toMatchObject({ target: 80, actual: 90, ok: false });
      expect(result.checks.filter(c => c.requirement !== 'budget').every(c => c.ok)).toBe(true);
    });

    it.each([
      { thresholds: [100, 95], stars: 3 },
      { thresholds: [100, 85], stars: 2 },
      { thresholds: [80, 70], stars: 1 },
    ])('a passing design costing 90 dollars with star thresholds $thresholds earns $stars star(s)', ({ thresholds, stars }) => {
      expect(simulate(levelAt(50, { starCostThresholds: thresholds }), serverAndDatabase, 1).stars).toBe(stars);
    });

    it('earns no stars when the level is failed, however cheap the design', () => {
      expect(simulate(levelAt(300, { starCostThresholds: [100, 95] }), serverAndDatabase, 1).stars).toBe(0);
    });

    it('tells a passing player the monthly cost to reach for the next star', () => {
      expect(simulate(levelAt(50, { starCostThresholds: [100, 85] }), serverAndDatabase, 1).nextStarCost).toBe(85);
      expect(simulate(levelAt(50, { starCostThresholds: [80, 70] }), serverAndDatabase, 1).nextStarCost).toBe(80);
    });

    it('has no next-star cost when all stars are earned or the level is failed', () => {
      expect(simulate(levelAt(50, { starCostThresholds: [100, 95] }), serverAndDatabase, 1).nextStarCost).toBeNull();
      expect(simulate(levelAt(300, { starCostThresholds: [100, 95] }), serverAndDatabase, 1).nextStarCost).toBeNull();
    });
  });
});
