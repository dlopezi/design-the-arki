import { describe, expect, it } from 'vitest';
import { solve, type Building, type Link } from './flow';

const ready = (n = 1) => Array.from({ length: n }, () => ({ buildLeftS: 0, buildTotalS: 5, down: false }));
const b = (id: string, type: string, instances = 1, params: Building['params'] = {}): Building => ({ id, type, params, instances: ready(instances) });
const link = (from: string, to: string): Link => ({ from, to });

describe('traffic in real time follows the connections', () => {
  it('answers every request when the path has room: clients → app server → database', () => {
    const flow = solve([b('api', 'appServer'), b('db', 'database')], [link('client', 'api'), link('api', 'db')], 150);
    expect(flow.answered).toBeCloseTo(150);
    expect(flow.errors).toBe(0);
    expect(flow.edge['api>db']).toBeCloseTo(150);
  });

  it('drops what an app server instance cannot take (a medium one serves 200 req/s)', () => {
    const flow = solve([b('api', 'appServer'), b('db', 'database')], [link('client', 'api'), link('api', 'db')], 300);
    expect(flow.drop.api).toBeCloseTo(100);
    expect(flow.errors).toBeCloseTo(1 / 3);
  });

  it('without a load balancer only the first instance gets traffic; with one, all of them share it', () => {
    const direct = solve([b('api', 'appServer', 2), b('db', 'database')], [link('client', 'api'), link('api', 'db')], 300);
    expect(direct.drop.api).toBeCloseTo(100);
    const balanced = solve([b('lb', 'loadBalancer'), b('api', 'appServer', 2), b('db', 'database')],
      [link('client', 'lb'), link('lb', 'api'), link('api', 'db')], 300);
    expect(balanced.errors).toBe(0);
  });

  it('a component with nowhere to send requests drops them (a dead end)', () => {
    const flow = solve([b('api', 'appServer'), b('db', 'database')], [link('client', 'api')], 100);
    expect(flow.drop.api).toBeCloseTo(100);
    expect(flow.answered).toBe(0);
  });

  it('the cache answers its hits (TTL 60 s ≈ 67%) and sends only the misses on', () => {
    const flow = solve([b('api', 'appServer'), b('cache', 'cache', 1, { ttlS: 60 }), b('db', 'database')],
      [link('client', 'api'), link('api', 'cache'), link('cache', 'db')], 150);
    expect(flow.edge['cache>db']).toBeCloseTo(50);
    expect(flow.answered).toBeCloseTo(150);
  });

  it('an instance still being built or down does not take traffic', () => {
    const api = b('api', 'appServer', 2);
    api.instances[0]!.down = true;
    api.instances[1]!.buildLeftS = 3;
    const flow = solve([b('lb', 'loadBalancer'), api, b('db', 'database')], [link('client', 'lb'), link('lb', 'api'), link('api', 'db')], 100);
    expect(flow.drop.lb).toBeCloseTo(100);
  });

  it('latency grows as a component fills up', () => {
    const at = (rps: number) => solve([b('api', 'appServer'), b('db', 'database')], [link('client', 'api'), link('api', 'db')], rps).p95;
    expect(at(50)).toBeLessThan(at(190));
    expect(at(190)).toBeGreaterThan(200);
  });

  describe('Request Types: each type goes only where it can still be finished', () => {
    const mix = { watch: 0.6, job: 0.4 };
    // The cache takes only watches (the catalog says so); the database takes both.
    const twoPaths = [b('api', 'appServer'), b('cache', 'cache', 1, { ttlS: 60 }), b('db', 'database')];
    const toBoth = [link('client', 'api'), link('api', 'cache'), link('cache', 'db'), link('api', 'db')];

    it('two types from one app server take different paths: watches share the cache and the database, jobs go only to the database', () => {
      const flow = solve(twoPaths, toBoth, 100, undefined, mix);
      expect(flow.edge['api>cache']).toBeCloseTo(30); // half of the 60 watches
      expect(flow.edge['api>db']).toBeCloseTo(30 + 40); // the other half of the watches, and every job
      expect(flow.errors).toBe(0);
      expect(flow.answered).toBeCloseTo(100);
    });

    it('a type with nowhere to go is dropped and counts as errors', () => {
      const flow = solve(twoPaths, [link('client', 'api'), link('api', 'cache'), link('cache', 'db')], 100, undefined, mix);
      expect(flow.drop.api).toBeCloseTo(40); // the jobs: the cache does not take them
      expect(flow.errors).toBeCloseTo(0.4);
      expect(flow.answered).toBeCloseTo(60);
    });

    it('looks past the next building: a type is not sent down a path that cannot finish it', () => {
      // Behind the balancer, app server "a" leads only to the cache, so jobs cannot be finished there.
      const flow = solve([b('lb', 'loadBalancer'), b('a', 'appServer'), b('c', 'appServer'), b('cache', 'cache'), b('db', 'database')],
        [link('client', 'lb'), link('lb', 'a'), link('lb', 'c'), link('a', 'cache'), link('cache', 'db'), link('c', 'db')], 100, undefined, { watch: 0.5, job: 0.5 });
      expect(flow.edge['lb>a']).toBeCloseTo(25); // a share of the watches only
      expect(flow.edge['lb>c']).toBeCloseTo(25 + 50); // a share of the watches, and every job
      expect(flow.errors).toBe(0);
    });

    it('over capacity, every type is dropped in proportion', () => {
      const flow = solve([b('api', 'appServer'), b('db', 'database')], [link('client', 'api'), link('api', 'db')], 400, undefined, { watch: 0.5, job: 0.5 });
      expect(flow.drop.api).toBeCloseTo(200);
      expect(flow.edge['api>db']).toBeCloseTo(200);
    });

    it('without a mix, all traffic is the one default type and nothing changes', () => {
      const withMix = solve(twoPaths, toBoth, 100, undefined, { watch: 1 });
      const without = solve(twoPaths, toBoth, 100);
      expect(withMix).toEqual(without);
      expect(without.edge['api>cache']).toBeCloseTo(50);
    });
  });
});
