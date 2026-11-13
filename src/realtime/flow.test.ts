import { describe, expect, it } from 'vitest';
import { FULL_LOAD, ROOMY_LOAD, hotShardOf, solve, type Building, type Link } from './flow';

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
    // The cache takes watches only; the database takes watches and the results Workers write, but does not process jobs.
    const chapterOne = [b('api', 'appServer'), b('cache', 'cache', 1, { ttlS: 60 }), b('db', 'database')];
    const chapterOneLinks = [link('client', 'api'), link('api', 'cache'), link('cache', 'db'), link('api', 'db')];
    const withAsync = [...chapterOne, b('q', 'messageQueue'), b('w', 'worker')];
    const asyncLinks = [...chapterOneLinks, link('api', 'q'), link('q', 'w'), link('w', 'db')];

    it('two types from one app server take different paths: watches share the cache and the database, jobs go only to the queue', () => {
      const flow = solve(withAsync, asyncLinks, 100, undefined, mix);
      expect(flow.edge['api>cache']).toBeCloseTo(30); // half of the 60 watches
      expect(flow.edge['api>db']).toBeCloseTo(30); // the other half
      expect(flow.edge['api>q']).toBeCloseTo(40); // every job
      expect(flow.errors).toBe(0);
      expect(flow.answered).toBeCloseTo(100); // a job is answered when it enters the queue
    });

    it('a type with nowhere to go is dropped and counts as errors', () => {
      const flow = solve(chapterOne, [link('client', 'api'), link('api', 'cache'), link('cache', 'db')], 100, undefined, mix);
      expect(flow.drop.api).toBeCloseTo(40); // the jobs: the cache does not take them
      expect(flow.errors).toBeCloseTo(0.4);
      expect(flow.answered).toBeCloseTo(60);
    });

    it('the database does not process jobs: a job sent straight to it has nowhere to go', () => {
      const flow = solve(chapterOne, chapterOneLinks, 100, undefined, mix);
      expect(flow.drop.api).toBeCloseTo(40);
      expect(flow.errors).toBeCloseTo(0.4);
    });

    it('looks past the next building: a type is not sent down a path that cannot finish it', () => {
      // Behind the balancer, app server "a" leads only to the cache, so jobs cannot be finished there.
      const flow = solve([b('lb', 'loadBalancer'), b('a', 'appServer'), b('c', 'appServer'), b('cache', 'cache'), b('db', 'database'), b('q', 'messageQueue'), b('w', 'worker')],
        [link('client', 'lb'), link('lb', 'a'), link('lb', 'c'), link('a', 'cache'), link('cache', 'db'), link('c', 'db'), link('c', 'q'), link('q', 'w'), link('w', 'db')],
        100, undefined, { watch: 0.5, job: 0.5 });
      expect(flow.edge['lb>a']).toBeCloseTo(25); // a share of the watches only
      expect(flow.edge['lb>c']).toBeCloseTo(25 + 50); // a share of the watches, and every job
      expect(flow.errors).toBe(0);
    });

    it('over capacity, every type is dropped in proportion', () => {
      const flow = solve(withAsync, [link('client', 'api'), link('api', 'db'), link('api', 'q'), link('q', 'w'), link('w', 'db')], 400, undefined, { watch: 0.5, job: 0.5 });
      expect(flow.drop.api).toBeCloseTo(200); // an app server takes 200 req/s
      expect(flow.edge['api>db']).toBeCloseTo(100);
      expect(flow.edge['api>q']).toBeCloseTo(100);
    });

    it('without a mix, all traffic is the one default type and nothing changes', () => {
      const withMix = solve(chapterOne, chapterOneLinks, 100, undefined, { watch: 1 });
      const without = solve(chapterOne, chapterOneLinks, 100);
      expect(withMix).toEqual(without);
      expect(without.edge['api>cache']).toBeCloseTo(50);
    });
  });

  describe('a queue answers at once and releases Messages to the Workers behind it', () => {
    const jobs = { job: 1 };
    const parts = (workers = 1) => [b('api', 'appServer'), b('q', 'messageQueue'), b('w', 'worker', workers), b('db', 'database')];
    const wired = [link('client', 'api'), link('api', 'q'), link('q', 'w'), link('w', 'db')];

    it('releases at the Workers total capacity (a medium Worker takes 4 jobs/s) and keeps the rest as Backlog', () => {
      const flow = solve(parts(), wired, 10, undefined, jobs, { backlog: {}, dt: 1 });
      expect(flow.answered).toBeCloseTo(10);
      expect(flow.release.q).toBeCloseTo(4);
      expect(flow.backlog.q).toBeCloseTo(6);
      expect(flow.edge['q>w']).toBeCloseTo(4);
      expect(flow.edge['w>db']).toBeCloseTo(4);
    });

    it('spreads Messages over every serving Worker instance without a load balancer', () => {
      const flow = solve(parts(3), wired, 10, undefined, jobs, { backlog: { q: 0 }, dt: 1 });
      expect(flow.releaseCapacity.q).toBeCloseTo(12);
      expect(flow.backlog.q).toBe(0);
      expect(flow.load.w).toBeCloseTo(10 / 12);
    });

    it('keeps releasing after the users are gone, until the Backlog is empty', () => {
      const flow = solve(parts(), wired, 0, undefined, jobs, { backlog: { q: 6 }, dt: 1 });
      expect(flow.release.q).toBeCloseTo(4);
      expect(flow.backlog.q).toBeCloseTo(2);
      expect(solve(parts(), wired, 0, undefined, jobs, { backlog: { q: 2 }, dt: 1 }).backlog.q).toBe(0);
    });

    it('with no Worker serving nothing is released and the Backlog only grows', () => {
      const workers = parts();
      workers[2]!.instances[0]!.down = true;
      const flow = solve(workers, wired, 10, undefined, jobs, { backlog: { q: 5 }, dt: 0.5 });
      expect(flow.release.q).toBe(0);
      expect(flow.releaseCapacity.q).toBe(0);
      expect(flow.backlog.q).toBeCloseTo(10);
      expect(flow.errors).toBe(0);
    });

    it('Messages a Worker cannot take go back to the queue: none is ever lost', () => {
      // Half the jobs come straight from the app server, so the Worker (4 jobs/s) is shared and cannot take everything released.
      const flow = solve(parts(), [...wired, link('api', 'w')], 10, undefined, jobs, { backlog: {}, dt: 1 });
      // 5 jobs/s reach the queue, 4 are released, and the Worker takes 4/9 of the 9 jobs/s it receives: the rest return.
      expect(flow.backlog.q).toBeCloseTo(1 + 4 * (5 / 9), 2);
    });

    it('what the database drops after the queue is not the users error: the job was already answered', () => {
      const slowDb = [...parts(8)];
      slowDb[3] = b('db', 'database'); // 8 connections serve 400 req/s
      const flow = solve(slowDb, [...wired, link('api', 'db')], 20, undefined, { watch: 0.5, job: 0.5 }, { backlog: { q: 100 }, dt: 1 });
      expect(flow.errors).toBe(0);
    });
  });
});

describe('the Hot Shard among the Shards of a building', () => {
  it('is the busiest Shard when it is nearly full while another still has room', () => {
    expect(hotShardOf([1, 0.3, 0.2])).toBe(0);
    expect(hotShardOf([0.4, 0.95])).toBe(1);
  });

  it('is none when every Shard is full (the answer is more Shards), when none is full, or when there is only one Shard', () => {
    expect(hotShardOf([1, 1, 0.95])).toBeNull();
    expect(hotShardOf([0.6, 0.5, 0.2])).toBeNull();
    expect(hotShardOf([1])).toBeNull();
    expect(hotShardOf(undefined)).toBeNull();
  });

  it('uses the same thresholds as the load bars: full from 90%, roomy under 70%', () => {
    expect(hotShardOf([FULL_LOAD, ROOMY_LOAD - 0.01])).toBe(0);
    expect(hotShardOf([FULL_LOAD - 0.01, 0.1])).toBeNull();
    expect(hotShardOf([1, ROOMY_LOAD])).toBeNull();
  });
});
