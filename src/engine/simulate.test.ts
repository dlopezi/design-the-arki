import { describe, expect, it } from 'vitest';
import { DesignError, simulate } from './simulate';
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

  describe('designs that cannot serve traffic', () => {
    const problemOf = (design: Design) => {
      try { simulate(levelAt(50), design, 1); } catch (e) { if (e instanceof DesignError) return e.problem; throw e; }
      return null;
    };

    it('rejects a design where nothing is connected to the clients', () => {
      expect(problemOf({ components: [{ id: 'api', type: 'appServer' }], connections: [] })).toEqual({ kind: 'noEntry' });
    });

    it('rejects a design where a component that cannot answer requests has nowhere to send them', () => {
      // An app server needs its data; only a database can end a request in this catalogue.
      const design: Design = { components: [{ id: 'api', type: 'appServer' }], connections: [['client', 'api']] };
      expect(problemOf(design)).toEqual({ kind: 'deadEnd', componentId: 'api' });
    });

    it('rejects a design whose connections send requests round in a loop', () => {
      const design: Design = {
        components: [{ id: 'api', type: 'appServer' }, { id: 'api2', type: 'appServer' }],
        connections: [['client', 'api'], ['api', 'api2'], ['api2', 'api']],
      };
      expect(problemOf(design)).toEqual({ kind: 'loop', componentIds: ['api', 'api2'] });
    });

    it('rejects several instances of a component with no load balancer in front to spread requests', () => {
      const design: Design = {
        components: [{ id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }],
        connections: [['client', 'api'], ['api', 'db']],
      };
      expect(problemOf(design)).toEqual({ kind: 'needsBalancer', componentId: 'api' });
    });
  });

  describe('scaling', () => {
    const behindBalancer = (params: Record<string, unknown>): Design => ({
      components: [
        { id: 'lb', type: 'loadBalancer' },
        { id: 'api', type: 'appServer', params },
        { id: 'db', type: 'database' },
      ],
      connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']],
    });

    it('scales out: two app server instances behind a load balancer serve traffic that one cannot', () => {
      expect(simulate(levelAt(300), behindBalancer({ instances: 1 }), 1).passed).toBe(false);
      expect(simulate(levelAt(300), behindBalancer({ instances: 2 }), 1).passed).toBe(true);
    });

    it('charges for every instance: load balancer $20 + 2 app servers × $40 + database $50 = $150', () => {
      expect(simulate(levelAt(50), behindBalancer({ instances: 2 }), 1).cost).toBe(150);
    });

    it('scales up: one large app server (8 workers, $80) serves 300 req/s without a load balancer', () => {
      const design = (size: string): Design => ({
        components: [{ id: 'api', type: 'appServer', params: { size } }, { id: 'db', type: 'database' }],
        connections: [['client', 'api'], ['api', 'db']],
      });
      const large = simulate(levelAt(300), design('large'), 1);

      expect(large.passed).toBe(true);
      expect(large.cost).toBe(130);
      expect(simulate(levelAt(300), design('medium'), 1).passed).toBe(false);
    });

    it('honours a shorter queue: under overload it rejects more requests but the ones it keeps wait less', () => {
      const withQueue = (queueSize?: number): Design => ({
        components: [{ id: 'api', type: 'appServer', params: queueSize ? { queueSize } : {} }, { id: 'db', type: 'database' }],
        connections: [['client', 'api'], ['api', 'db']],
      });
      const short = simulate(levelAt(300), withQueue(10), 1);
      const standard = simulate(levelAt(300), withQueue(), 1);

      expect(short.errors.rejected).toBeGreaterThan(standard.errors.rejected);
      expect(short.p95).toBeLessThan(standard.p95);
    });
  });

  describe('timeline in 5-second buckets', () => {
    const rising = levelAt(0, { durationS: 30, traffic: [{ fromS: 0, toS: 15, rps: 50 }, { fromS: 15, toS: 30, rps: 150 }] });

    it('reports requests per second for each 5-second bucket, following the traffic profile', () => {
      const { buckets } = simulate(rising, serverAndDatabase, 3);

      expect(buckets.map(b => b.fromS)).toEqual([0, 5, 10, 15, 20, 25]);
      for (const b of buckets.slice(0, 3)) expect(b.rps).toBeGreaterThan(40), expect(b.rps).toBeLessThan(60);
      for (const b of buckets.slice(3)) expect(b.rps).toBeGreaterThan(130), expect(b.rps).toBeLessThan(170);
    });

    it('shows latency and errors rising only in the buckets where traffic exceeds capacity', () => {
      const overloadLate = levelAt(0, { durationS: 30, traffic: [{ fromS: 0, toS: 15, rps: 50 }, { fromS: 15, toS: 30, rps: 300 }] });
      const { buckets } = simulate(overloadLate, serverAndDatabase, 3);

      for (const b of buckets.slice(0, 3)) expect(b.errorRate).toBe(0), expect(b.p95).toBeLessThan(150);
      expect(buckets[5]!.errorRate).toBeGreaterThan(0.1);
      expect(buckets[5]!.p95).toBeGreaterThan(300);
    });

    it('reports utilisation per bucket for each component and each instance (arrivals × service time / workers)', () => {
      const design: Design = {
        components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }],
        connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']],
      };
      // 200 req/s × 20 ms over 2 × 4 workers = 0.5; each instance gets 100 req/s × 20 ms / 4 = 0.5; database 200 × 20 ms / 8 = 0.5.
      const result = simulate(levelAt(200), design, 5);
      const api = result.components.find(c => c.id === 'api')!;
      const db = result.components.find(c => c.id === 'db')!;
      const middle = (series: number[]) => series.slice(1, -1);

      for (const u of middle(api.bucketUtilization)) expect(u).toBeGreaterThan(0.4), expect(u).toBeLessThan(0.6);
      for (const u of middle(db.bucketUtilization)) expect(u).toBeGreaterThan(0.4), expect(u).toBeLessThan(0.6);
      expect(api.instances).toHaveLength(2);
      for (const instance of api.instances) for (const u of middle(instance.bucketUtilization)) expect(u).toBeGreaterThan(0.4), expect(u).toBeLessThan(0.6);
    });
  });

  describe('bottleneck', () => {
    const scaled = (instances: number): Design => ({
      components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances } }, { id: 'db', type: 'database' }],
      connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']],
    });

    it('names the saturated app server as the bottleneck when it cannot keep up', () => {
      expect(simulate(levelAt(300), serverAndDatabase, 1).bottleneck).toEqual({ componentId: 'api' });
    });

    it('moves the bottleneck to the database once the app servers are scaled out (500 req/s vs ~400 for a small database)', () => {
      expect(simulate(levelAt(500), scaled(3), 1).bottleneck).toEqual({ componentId: 'db' });
    });

    it('reports no bottleneck when every component has spare capacity', () => {
      expect(simulate(levelAt(150), scaled(2), 1).bottleneck).toBeNull();
    });

    it('gives per-instance stats: round-robin splits the work evenly and an overloaded instance fills its queue', () => {
      const even = simulate(levelAt(150), scaled(2), 1).components.find(c => c.id === 'api')!;
      const [a, b] = even.instances;
      expect(Math.abs(a!.served - b!.served)).toBeLessThanOrEqual(1);
      expect(a!.served + b!.served).toBe(even.served);

      const overloaded = simulate(levelAt(300), serverAndDatabase, 1).components.find(c => c.id === 'api')!;
      expect(overloaded.instances[0]!.maxQueue).toBe(100);
      expect(overloaded.instances[0]!.rejected).toBe(overloaded.rejected);
      expect(overloaded.instances[0]!.peakUtilization).toBeGreaterThan(0.95);
      expect(overloaded.peakUtilization).toBeGreaterThan(0.95);
      expect(overloaded.avgWaitMs).toBeGreaterThan(100);
    });
  });

  describe('cache and database tiers', () => {
    const withCache = (ttlS: number, instances = 3): Design => ({
      components: [
        { id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances } },
        { id: 'cache', type: 'cache', params: { ttlS } }, { id: 'db', type: 'database' },
      ],
      connections: [['client', 'lb'], ['lb', 'api'], ['api', 'cache'], ['cache', 'db']],
    });
    const dbServed = (design: Design) => simulate(levelAt(200), design, 1).components.find(c => c.id === 'db')!.served;

    it('sends fewer requests to the database the longer the cache keeps answers (TTL)', () => {
      expect(dbServed(withCache(60))).toBeLessThan(dbServed(withCache(10)));
    });

    it('lets a design pass that fails without a cache because the small database saturates (500 req/s)', () => {
      const noCache: Design = {
        components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 3 } }, { id: 'db', type: 'database' }],
        connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']],
      };
      expect(simulate(levelAt(500), noCache, 1).passed).toBe(false);
      expect(simulate(levelAt(500), withCache(60), 1).passed).toBe(true);
    });

    it('reports the observed hit rate, close to TTL / (TTL + 30 s): 60 s gives about 67%', () => {
      const cache = simulate(levelAt(200), withCache(60), 1).components.find(c => c.id === 'cache')!;
      expect(cache.hitRate).toBeGreaterThan(0.64);
      expect(cache.hitRate).toBeLessThan(0.7);
    });
  });
});
