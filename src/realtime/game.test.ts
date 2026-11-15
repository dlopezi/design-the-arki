import { describe, expect, it } from 'vitest';
import type { Design } from '../catalog/types';
import { hotShardOf } from './flow';
import { BUILD_PHASE_S, PASSIVE_INCOME, build, callNow, connect, contentAge, createGame, setCelebrityLimit, setClientLimit, setPartitionKey, setPartitions, setSubscription, upkeepPerS, runToEnd, buildProblem, demolish, disconnect, resize, run, setShardKey, setTtl, starsOf, toDesign, type GameLevel, type GameState } from './game';

const level: GameLevel = {
  allowedComponents: ['loadBalancer', 'appServer', 'cache', 'database'],
  componentOptions: { appServer: { maxInstances: 4 } },
  requirements: { p95Ms: 200, maxErrorRate: 0.01 },
  play: { startMoney: 300, wave: { rps: 300, lengthS: 40 }, starMoney: [100, 200] },
};
const empty: Design = { components: [], connections: [] };
const ids = (s: GameState) => s.links.map(l => `${l.from}>${l.to}`);
const typeOf = (s: GameState, id: string) => s.buildings.find(b => b.id === id)?.type ?? id;
const named = (s: GameState) => s.links.map(l => `${typeOf(s, l.from)}>${typeOf(s, l.to)}`);
/** Plays `seconds` of the game. */
const wait = (s: GameState, seconds: number) => run(s, seconds, level);

describe('real-time play', () => {
  it('starts in the build phase with the level money; a starting design is already built and connected', () => {
    const s = createGame(level, { components: [{ id: 'api', type: 'appServer', params: { instances: 2 } }], connections: [['client', 'api']] });
    expect(s.phase).toBe('build');
    expect(s.money).toBe(300);
    expect(s.buildings[0]!.instances).toHaveLength(2);
    expect(s.buildings[0]!.instances.every(i => i.buildLeftS === 0)).toBe(true);
    expect(ids(s)).toEqual(['client>api']);
  });

  it('building costs its monthly price and takes time; another app server is one more instance', () => {
    let s = createGame(level, empty);
    s = build(s, 'appServer', level);
    expect(s.money).toBe(260);
    expect(s.buildings[0]!.instances[0]!.buildLeftS).toBe(5);
    s = build(s, 'appServer', level);
    expect(s.buildings).toHaveLength(1);
    expect(s.buildings[0]!.instances).toHaveLength(2);
    s = build(s, 'database', level);
    expect(build(s, 'database', level)).toBe(s); // one database is enough here: a second one is refused
  });

  it('connects new buildings automatically, the way a player almost always wants', () => {
    let s = createGame(level, empty);
    s = build(s, 'appServer', level);
    s = build(s, 'database', level);
    expect(named(s)).toEqual(['client>appServer', 'appServer>database']);
    s = build(s, 'loadBalancer', level);
    expect(named(s).sort()).toEqual(['appServer>database', 'client>loadBalancer', 'loadBalancer>appServer']);
    s = build(s, 'cache', level);
    expect(named(s).sort()).toEqual(['appServer>cache', 'cache>database', 'client>loadBalancer', 'loadBalancer>appServer']);
  });

  it('lets the player change connections, but refuses circles, links into the users and links out of a database', () => {
    let s = createGame(level, empty);
    for (const type of ['appServer', 'database', 'loadBalancer']) s = build(s, type, level);
    const [api, db, lb] = s.buildings.map(b => b.id) as [string, string, string];
    expect(connect(s, db, api).links).toBe(s.links);
    expect(connect(s, api, 'client').links).toBe(s.links);
    expect(connect(s, api, lb).links).toBe(s.links);
    s = disconnect(s, lb, api);
    expect(ids(s)).not.toContain(`${lb}>${api}`);
    s = connect(s, 'client', api);
    expect(ids(s).filter(l => l.startsWith('client>'))).toEqual([`client>${api}`]); // the users have one entrance
  });

  it('the users arrive after the build phase, or at once with a bonus', () => {
    let s = createGame(level, empty);
    s = wait(s, BUILD_PHASE_S - 1);
    expect(s.phase).toBe('build');
    s = wait(s, 2);
    expect(s.phase).toBe('wave');
    const early = callNow(createGame(level, empty));
    expect(early.phase).toBe('wave');
    expect(early.money).toBeGreaterThan(300);
  });

  it('money grows by itself and with each answered visit, and maintenance costs it', () => {
    let s = createGame(level, empty);
    for (const type of ['loadBalancer', 'appServer', 'appServer', 'database']) s = build(s, type, level);
    s = callNow(wait(s, 10));
    const before = s.money;
    s = wait(s, 10);
    // 10 s × ($2 + 300 visits/s × $1 per 100 − upkeep (20 + 40 + 40 + 50) / 100) = 10 × 3.5
    expect(s.money - before).toBeCloseTo(35, 0);
  });

  it('a scripted incident takes an instance down during the wave', () => {
    const withIncident: GameLevel = { ...level, play: { ...level.play, incident: { atS: 5, componentType: 'appServer' } } };
    let s = createGame(withIncident, { components: [{ id: 'api', type: 'appServer', params: { instances: 2 } }], connections: [] });
    s = run(callNow(s), 6, withIncident);
    expect(s.buildings[0]!.instances.filter(i => i.down)).toHaveLength(1);
  });

  it('winning means lasting the whole wave; the stars depend on the money left', () => {
    let s = createGame(level, empty);
    for (const type of ['loadBalancer', 'appServer', 'appServer', 'appServer', 'database']) s = build(s, type, level);
    s = wait(s, BUILD_PHASE_S + level.play.wave.lengthS + 1);
    expect(s.phase).toBe('won');
    expect(starsOf(s, level)).toBe(1 + level.play.starMoney.filter(m => s.money >= m).length);
  });

  it('the base is lost when the reputation reaches 0', () => {
    let s = createGame(level, empty);
    s = build(s, 'appServer', level);
    s = wait(s, BUILD_PHASE_S + level.play.wave.lengthS);
    expect(s.phase).toBe('lost');
    expect(s.reputation).toBe(0);
  });

  it('the design on the map can be saved and played again', () => {
    let s = createGame(level, empty);
    for (const type of ['loadBalancer', 'appServer', 'appServer', 'database']) s = build(s, type, level);
    const design = toDesign(s);
    expect(design.components.find(c => c.type === 'appServer')!.params).toMatchObject({ instances: 2 });
    expect(ids(createGame(level, design))).toEqual(ids(s));
  });

  it('removing an instance takes away a fallen one first; resizing rebuilds every instance, fallen ones included', () => {
    let s = createGame(level, { components: [{ id: 'api', type: 'appServer', params: { instances: 3 } }], connections: [] });
    s = { ...s, buildings: s.buildings.map(b => ({ ...b, instances: b.instances.map((i, k) => (k === 1 ? { ...i, down: true } : i)) })) };
    expect(demolish(s, 'api').buildings[0]!.instances.some(i => i.down)).toBe(false);
    const resized = resize(s, 'api', 'large');
    expect(resized.buildings[0]!.instances.every(i => !i.down && i.buildLeftS === 5)).toBe(true);
    expect(resized.money).toBe(300 - (80 - 20) * 3);
  });

  it('a wave with a mix of Request Types: a type with no path counts as errors and costs reputation', () => {
    const mixed: GameLevel = { ...level, allowedComponents: [...level.allowedComponents, 'messageQueue', 'worker'],
      play: { ...level.play, wave: { rps: 100, lengthS: 40, mix: { watch: 0.7, job: 0.3 } } } };
    const design = (connections: [string, string][]): Design => ({
      components: [{ id: 'api', type: 'appServer' }, { id: 'cache', type: 'cache' }, { id: 'db', type: 'database' }, { id: 'q', type: 'messageQueue' }, { id: 'w', type: 'worker' }], connections });
    const play = (d: Design, l: GameLevel) => run(callNow(createGame(l, d)), 10, l);
    const plain: GameLevel = { ...level, play: { ...level.play, wave: { rps: 100, lengthS: 40 } } };
    // No queue and no Worker: the jobs have nowhere to go (30% errors: over the 1% maximum).
    const noQueue = play(design([['client', 'api'], ['api', 'cache'], ['cache', 'db']]), mixed);
    expect(noQueue.flow!.errors).toBeCloseTo(0.3);
    expect(noQueue.reputation).toBeLessThan(100);
    // With the queue and a Worker from the same app server, watches and jobs each take their own path and everything is answered.
    const both = play(design([['client', 'api'], ['api', 'cache'], ['cache', 'db'], ['api', 'q'], ['q', 'w'], ['w', 'db']]), mixed);
    expect(both.flow!.edge['api>cache']).toBeCloseTo(70);
    expect(both.flow!.edge['api>q']).toBeCloseTo(30);
    expect(both.flow!.edge['cache>db']).toBeGreaterThan(0); // the watches reach the database through the cache
    expect(both.flow!.edge['q>w']).toBeGreaterThan(0); // the jobs reach the Workers through the queue
    expect(both.flow!.edge['api>db']).toBeUndefined();
    expect(both.flow!.errors).toBe(0);
    expect(both.reputation).toBe(100);
    // The same base without a mix (chapter 1) answers everything, as before.
    expect(play(design([['client', 'api'], ['api', 'cache'], ['cache', 'db']]), plain).flow!.errors).toBe(0);
  });
});

// ───────── Async: the Message Queue, the Worker and the Drain Phase (ADR-0006) ─────────
describe('async work: a queue answers at once and Workers take the jobs in the background', () => {
  // One medium Worker serves 4 jobs/s (concurrency 4, a job takes 1 s). The wave brings 8 jobs/s: more than it can take.
  const asyncLevel: GameLevel = {
    allowedComponents: ['appServer', 'database', 'messageQueue', 'worker'],
    componentOptions: { worker: { maxInstances: 6 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01, maxQueueAgeS: 20 },
    play: { startMoney: 500, wave: { rps: 8, lengthS: 30, mix: { job: 1 } }, starMoney: [100, 200] },
  };
  const base = (workers: number, ...extra: [string, string][]): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 'q', type: 'messageQueue' }, { id: 'w', type: 'worker', params: { instances: workers } }],
    connections: [['client', 'api'], ['api', 'q'], ['q', 'w'], ['w', 'db'], ...extra],
  });
  const play = (s: GameState, seconds: number, l = asyncLevel) => run(s, seconds, l);
  const live = (design: Design, l = asyncLevel) => callNow(createGame(l, design));

  it('a job is answered when it enters the queue: p95 stays low, whatever the Worker is doing', () => {
    const s = play(live(base(1)), 10);
    expect(s.flow!.answered).toBeCloseTo(8);
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.p95).toBeLessThan(100);
  });

  it('a job sent from the app server straight to a Worker is synchronous: slow, and what the Worker cannot take is an error', () => {
    const direct: Design = { ...base(1), connections: [['client', 'api'], ['api', 'w'], ['w', 'db']] };
    const s = play(live(direct), 10);
    expect(s.flow!.p95).toBeGreaterThan(1000);
    expect(s.flow!.errors).toBeCloseTo(0.5); // 4 of the 8 jobs per second
  });

  it('a job with no queue and no Worker has nowhere to go: the database does not process jobs', () => {
    const none: Design = { components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }], connections: [['client', 'api'], ['api', 'db']] };
    expect(play(live(none), 5).flow!.errors).toBe(1);
  });

  it('the Backlog grows when jobs arrive faster than the Workers take them, and shrinks when they do not', () => {
    let s = play(live(base(1)), 10);
    const grown = s.backlog['q']!;
    expect(grown).toBeGreaterThan(30); // about (8 − 4) × 10
    // Two more Workers: 12 jobs/s of capacity against 8 arriving.
    s = build(build(s, 'worker', asyncLevel), 'worker', asyncLevel);
    s = play(s, 20);
    expect(s.backlog['q']!).toBeLessThan(grown);
    expect(s.flow!.errors).toBe(0);
  });

  it('records the Backlog and the Queue Age every second, for the charts', () => {
    const s = play(live(base(1)), 10);
    const last = s.history.at(-1)!;
    expect(last.backlog).toBeCloseTo(s.backlog['q']!, 0);
    expect(last.age).toBeCloseTo(s.queueAge['q']!, 0);
    expect(s.history.map(h => h.backlog)).toEqual([...s.history.map(h => h.backlog)].sort((a, b) => a - b)); // it only grows while the Workers fall behind
    expect(play(live(base(2)), 10).history.every(h => h.age === 0 && h.backlog === 0)).toBe(true);
  });

  it('a Backlog of zero has a Queue Age of zero; the age is the Backlog over the rate the Workers take it', () => {
    expect(play(live(base(2)), 10).queueAge['q'] ?? 0).toBe(0); // 8 jobs/s in, 8 jobs/s out
    const s = play(live(base(1)), 10);
    expect(s.queueAge['q']).toBeCloseTo(s.backlog['q']! / 4, 1);
  });

  it('the Drain Phase starts after the wave, is announced, charges maintenance and ends as won when the Backlog is empty', () => {
    let s = play(live(base(1)), asyncLevel.play.wave.lengthS - 0.5);
    expect(s.phase).toBe('wave');
    s = play(s, 1);
    expect(s.phase).toBe('drain');
    expect(s.events.some(e => e.kind === 'drain')).toBe(true);
    expect(s.backlog['q']!).toBeGreaterThan(20);
    // No new users, but the clock, the income and the maintenance go on: $2 − upkeep (40 + 50 + 20 + 40) / 100 per second.
    const before = s.money;
    s = play(s, 2);
    expect(s.phase).toBe('drain');
    expect(s.flow!.rps).toBe(0);
    expect(s.money - before).toBeCloseTo(2 * (PASSIVE_INCOME - 1.5), 1);
    s = play(s, 60);
    expect(s.phase).toBe('won');
    expect(s.backlog['q']!).toBeLessThan(1);
    expect(starsOf(s, asyncLevel)).toBeGreaterThanOrEqual(1);
  });

  it('a wave that leaves no Backlog is won at its end, with no Drain Phase', () => {
    const s = play(live(base(2)), asyncLevel.play.wave.lengthS + 1);
    expect(s.phase).toBe('won');
    expect(s.events.some(e => e.kind === 'drain')).toBe(false);
  });

  it('the Drain Phase can be lost: out of money, or the Queue Age stays over its maximum', () => {
    const drain = (s: GameState, backlog: number): GameState => ({ ...s, phase: 'drain', backlog: { q: backlog } });
    // Many large Workers cost more than the game earns: a long Backlog and little money run out.
    const costly: Design = { ...base(1), components: base(1).components.map(c => (c.type === 'worker' ? { ...c, params: { instances: 6, size: 'large' } } : c)) };
    const poor = drain({ ...createGame(asyncLevel, costly), money: 2 }, 100000);
    expect(play(poor, 10).phase).toBe('lost');
    expect(play(poor, 10).events.at(-1)).toMatchObject({ kind: 'lost', reason: 'money' });
    // No Worker built: the Backlog never moves and its age keeps growing, so the reputation falls to 0.
    const stuck: Design = { ...base(1), components: base(1).components.filter(c => c.type !== 'worker'), connections: [['client', 'api'], ['api', 'q']] };
    let s = drain(createGame(asyncLevel, stuck), 10);
    s = play(s, 25);
    expect(s.queueAge['q']).toBeGreaterThan(asyncLevel.requirements.maxQueueAgeS!);
    expect(s.reputation).toBeLessThan(100);
    s = play(s, 40);
    expect(s.phase).toBe('lost');
    expect(s.events.at(-1)).toMatchObject({ kind: 'lost', reason: 'reputation' });
  });

  it('a Queue Age over the maximum lowers the reputation as a slow base does, in the wave too', () => {
    const lenient = { ...asyncLevel, requirements: { ...asyncLevel.requirements, maxQueueAgeS: 1000 } };
    const strict = { ...asyncLevel, requirements: { ...asyncLevel.requirements, maxQueueAgeS: 5 } };
    expect(play(live(base(1), lenient), 20, lenient).reputation).toBe(100);
    expect(play(live(base(1), strict), 20, strict).reputation).toBeLessThan(100);
  });

  it('a queue absorbs a peak but not a load that stays above the Workers capacity: the Queue Age passes its maximum and the reputation falls', () => {
    // A peak: 12 s of 8 jobs/s against 4 jobs/s, then nothing. The queue absorbs it and the Backlog drains.
    const peak: GameLevel = { ...asyncLevel, play: { ...asyncLevel.play, wave: { rps: 8, lengthS: 12, mix: { job: 1 } } } };
    const absorbed = play(live(base(1), peak), 60, peak);
    expect(absorbed.phase).toBe('won');
    expect(absorbed.reputation).toBe(100);
    // The same load, always: the Backlog and the Queue Age keep growing until the reputation is gone.
    const always: GameLevel = { ...asyncLevel, play: { ...asyncLevel.play, wave: { rps: 8, lengthS: 200, mix: { job: 1 } } } };
    let s = play(live(base(1), always), 20, always);
    const early = { backlog: s.backlog['q']!, age: s.queueAge['q']! };
    s = play(s, 20, always);
    expect(s.queueAge['q']!).toBeGreaterThan(early.age);
    expect(s.backlog['q']!).toBeGreaterThan(early.backlog);
    expect(s.queueAge['q']!).toBeGreaterThan(always.requirements.maxQueueAgeS!);
    expect(s.reputation).toBeLessThan(100);
    expect(play(s, 100, always).phase).toBe('lost');
  });

  it('a Worker going down keeps the Backlog and only lowers the rate at which it is taken', () => {
    const outage: GameLevel = { ...asyncLevel, play: { ...asyncLevel.play, wave: { ...asyncLevel.play.wave, rps: 6 }, incident: { atS: 8, componentType: 'worker' } } };
    let s = play(live(base(2), outage), 7.9, outage); // 8 jobs/s of capacity against 6 arriving
    expect(s.backlog['q'] ?? 0).toBeLessThan(1);
    s = play(s, 0.5, outage);
    expect(s.buildings.find(b => b.id === 'w')!.instances.filter(i => i.down)).toHaveLength(1);
    const atOutage = s.backlog['q'] ?? 0;
    s = play(s, 10, outage); // 4 jobs/s of capacity against 6 arriving: the Backlog builds up, nothing is dropped
    expect(s.backlog['q']!).toBeGreaterThan(atOutage + 15);
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.releaseCapacity['q']).toBeCloseTo(4);
  });

  it('with every Worker down the Queue Age keeps growing', () => {
    let s = play(live(base(1)), 5);
    s = { ...s, buildings: s.buildings.map(b => (b.type === 'worker' ? { ...b, instances: b.instances.map(i => ({ ...i, down: true })) } : b)) };
    const a = play(s, 3).queueAge['q']!, b = play(s, 6).queueAge['q']!;
    expect(b).toBeGreaterThan(a + 2.5);
  });

  it('a queue that still holds Messages cannot be removed: the Backlog is never dropped', () => {
    let s = play(live(base(1)), asyncLevel.play.wave.lengthS + 1);
    expect(s.phase).toBe('drain');
    const kept = demolish(s, 'q');
    expect(kept.buildings.some(b => b.id === 'q')).toBe(true);
    expect(kept.money).toBe(s.money);
    expect(kept.events.at(-1)).toMatchObject({ kind: 'refused', reason: 'queueHoldsMessages' });
    s = play(s, 60); // won: the queue is empty now and can go
    expect(demolish({ ...s, phase: 'build' }, 'q').buildings.some(b => b.id === 'q')).toBe(false);
  });

  it('the users cannot connect to a Message Queue: jobs come through an app server', () => {
    let s = createGame(asyncLevel, empty);
    s = build(build(s, 'appServer', asyncLevel), 'messageQueue', asyncLevel);
    const q = s.buildings.find(b => b.type === 'messageQueue')!.id;
    const refused = connect(s, 'client', q);
    expect(refused.links).toBe(s.links);
    expect(refused.events.at(-1)).toMatchObject({ kind: 'refused', reason: 'queueNotPublic' });
  });

  it('new buildings connect app server → queue → Worker → database by themselves, in any order', () => {
    const built = (order: string[]) => named(order.reduce((acc, type) => build(acc, type, asyncLevel), createGame(asyncLevel, empty))).sort();
    const wired = ['appServer>database', 'appServer>messageQueue', 'client>appServer', 'messageQueue>worker', 'worker>database'];
    expect(built(['appServer', 'database', 'messageQueue', 'worker'])).toEqual(wired);
    expect(built(['worker', 'messageQueue', 'database', 'appServer'])).toEqual(wired);
    expect(built(['messageQueue', 'worker', 'appServer', 'database'])).toEqual(wired);
  });

  it('the queue and the Worker have a fixed or a chosen price: the Worker has sizes and instances, the queue neither', () => {
    let s = build(build(createGame(asyncLevel, empty), 'messageQueue', asyncLevel), 'worker', asyncLevel);
    expect(s.money).toBe(500 - 20 - 40);
    s = build(s, 'worker', asyncLevel);
    expect(s.buildings.find(b => b.type === 'worker')!.instances).toHaveLength(2);
    expect(build(s, 'messageQueue', asyncLevel)).toBe(s);
  });
});

describe('data scale: Read Replicas answer the reads and the primary database keeps the writes', () => {
  // A small database and a small Read Replica instance each serve 400 requests per second.
  const dataLevel = (mix: Record<string, number>, rps = 100): GameLevel => ({
    allowedComponents: ['appServer', 'database', 'readReplica'],
    componentOptions: { readReplica: { maxInstances: 4 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 500, wave: { rps, lengthS: 30, mix }, starMoney: [100, 200] },
  });
  const design = (replicas: number, links: [string, string][]): Design => ({
    components: [{ id: 'api', type: 'appServer', params: { size: 'large' } }, { id: 'db', type: 'database' },
      ...(replicas ? [{ id: 'rep', type: 'readReplica', params: { instances: replicas } }] : [])],
    connections: [['client', 'api'], ...links],
  });
  const withReplica: [string, string][] = [['api', 'db'], ['api', 'rep'], ['rep', 'db']];
  const play = (l: GameLevel, d: Design, seconds = 5) => run(callNow(createGame(l, d)), seconds, l);

  it('sends reads to the Read Replica and writes to the primary database', () => {
    const s = play(dataLevel({ read: 0.9, write: 0.1 }), design(1, withReplica));
    expect(s.flow!.inflow.rep).toBeCloseTo(90);
    expect(s.flow!.inflow.db).toBeCloseTo(10);
    expect(s.flow!.errors).toBe(0);
  });

  it('a write that reaches only a Read Replica is an error: a replica answers reads only', () => {
    const s = play(dataLevel({ write: 1 }), design(1, [['api', 'rep'], ['rep', 'db']]));
    expect(s.flow!.errors).toBe(1);
  });

  it('reads go to the primary database when no Read Replica is connected', () => {
    const s = play(dataLevel({ read: 1 }), design(1, [['api', 'db'], ['rep', 'db']]));
    expect(s.flow!.inflow.db).toBeCloseTo(100);
    expect(s.flow!.inflow.rep ?? 0).toBe(0);
    expect(s.flow!.errors).toBe(0);
  });

  it('Read Replicas scale reads: instances share them without a load balancer, and one is not enough for 600 reads a second', () => {
    const l = { ...dataLevel({ read: 1 }, 600), allowedComponents: ['loadBalancer', 'appServer', 'database', 'readReplica'] };
    // Two large app servers behind a load balancer can take the 600; the Read Replicas are what is under test.
    const wide = (replicas: number): Design => ({
      components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { size: 'large', instances: 2 } }, { id: 'db', type: 'database' },
        { id: 'rep', type: 'readReplica', params: { instances: replicas } }],
      connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db'], ['api', 'rep'], ['rep', 'db']],
    });
    expect(play(l, wide(1)).flow!.errors).toBeCloseTo(1 / 3);
    expect(play(l, wide(2)).flow!.errors).toBe(0);
  });

  it('writes stay on the primary database however many Read Replicas there are', () => {
    const l = dataLevel({ write: 1 }, 600);
    expect(play(l, design(4, withReplica)).flow!.errors).toBeCloseTo(1 / 3); // the primary serves 400 of 600
  });

  it('sends Read-your-writes to the primary database, and plain reads to the Read Replica', () => {
    const s = play(dataLevel({ read: 0.5, readYourWrites: 0.4, write: 0.1 }), design(1, withReplica));
    expect(s.flow!.inflow.rep).toBeCloseTo(50);
    expect(s.flow!.inflow.db).toBeCloseTo(50); // 40 Read-your-writes + 10 writes
    expect(s.flow!.errors).toBe(0);
  });

  it('a Read-your-writes request that reaches only a Read Replica is an error: a stale read', () => {
    const s = play(dataLevel({ readYourWrites: 1 }), design(1, [['api', 'rep'], ['rep', 'db']]));
    expect(s.flow!.errors).toBe(1);
  });

  it('a Read-your-writes request is answered when the app server is connected to the primary database', () => {
    const s = play(dataLevel({ readYourWrites: 1 }), design(1, [['api', 'db']]));
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.inflow.db).toBeCloseTo(100);
  });

  it('a cache cannot answer reads, because the data must be fresh: reads sent through it are not answered', () => {
    const l: GameLevel = { ...dataLevel({ read: 1 }), allowedComponents: ['appServer', 'cache', 'database'] };
    const viaCache: Design = {
      components: [{ id: 'api', type: 'appServer' }, { id: 'cache', type: 'cache' }, { id: 'db', type: 'database' }],
      connections: [['client', 'api'], ['api', 'cache'], ['cache', 'db']],
    };
    expect(play(l, viaCache).flow!.errors).toBe(1);
  });

  it('a Read Replica can be connected to the database it copies, but nothing else comes out of it', () => {
    const l = dataLevel({ read: 1 });
    const s = createGame(l, design(1, []));
    expect(connect(s, 'rep', 'db').links.map(x => `${x.from}>${x.to}`)).toContain('rep>db');
    const refused = connect(connect(s, 'api', 'rep'), 'rep', 'api');
    expect(refused.events.at(-1)).toMatchObject({ kind: 'refused', reason: 'endsRequests' });
    expect(connect(s, 'db', 'rep').events.at(-1)).toMatchObject({ kind: 'refused' });
  });

  it('new buildings connect app server → Read Replica → database by themselves, in any order', () => {
    const l = dataLevel({ read: 1 });
    const built = (order: string[]) => named(order.reduce((acc, type) => build(acc, type, l), createGame(l, empty))).sort();
    const wired = ['appServer>database', 'appServer>readReplica', 'client>appServer', 'readReplica>database'];
    expect(built(['appServer', 'database', 'readReplica'])).toEqual(wired);
    expect(built(['readReplica', 'database', 'appServer'])).toEqual(wired);
    expect(built(['database', 'readReplica', 'appServer'])).toEqual(wired);
  });

  it('a Read Replica has instances, each with a price', () => {
    const l = dataLevel({ read: 1 });
    let s = build(createGame(l, empty), 'readReplica', l);
    expect(s.money).toBe(500 - 50);
    s = build(s, 'readReplica', l);
    expect(s.buildings.find(b => b.type === 'readReplica')!.instances).toHaveLength(2);
  });
});

describe('data scale: Shards hold more writes, and the Shard Key decides how traffic spreads over them', () => {
  // A small database serves 400 requests per second. Two large app servers behind a load balancer take 600 without trouble.
  const even = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(w => w / 12);
  const shardLevel = (keys: Record<string, number[]> | undefined, rps = 600): GameLevel => ({
    allowedComponents: ['loadBalancer', 'appServer', 'database'],
    componentOptions: { database: { maxInstances: 4 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 800, wave: { rps, lengthS: 30, mix: { write: 1 } }, shardKeys: keys, starMoney: [100, 200] },
  });
  const sharded = (shards: number, key?: string): Design => ({
    components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { size: 'large', instances: 2 } },
      { id: 'db', type: 'database', params: { instances: shards, ...(key ? { shardKey: key } : {}) } }],
    connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']],
  });
  const play = (l: GameLevel, d: Design) => run(callNow(createGame(l, d)), 5, l);
  const keys = { userId: even, country: [0.7, 0.3] };

  it('one Shard cannot take the writes; two can, each serving half', () => {
    const l = shardLevel(keys);
    expect(play(l, sharded(1)).flow!.errors).toBeCloseTo(1 / 3);
    const two = play(l, sharded(2, 'userId'));
    expect(two.flow!.errors).toBeCloseTo(0);
    two.flow!.shards.db!.forEach(load => expect(load).toBeCloseTo(0.75));
  });

  it('a skewed Shard Key overloads one Shard while the others have room', () => {
    const s = play(shardLevel(keys), sharded(2, 'country'));
    expect(s.flow!.shards.db![0]).toBe(1);
    expect(s.flow!.shards.db![1]).toBeLessThan(0.5);
    expect(s.flow!.errors).toBeCloseTo(20 / 600); // the hot Shard gets 420 and serves 400
  });

  it('the first key on offer is used until the player picks another', () => {
    const s = play(shardLevel(keys), sharded(2));
    s.flow!.shards.db!.forEach(load => expect(load).toBeCloseTo(0.75));
  });

  it('the Shard Key can be picked in the build phase, and not once the wave has started', () => {
    const l = shardLevel(keys);
    const s = createGame(l, sharded(2, 'userId'));
    expect(setShardKey(s, 'db', 'country', l).buildings.find(b => b.id === 'db')!.params.shardKey).toBe('country');
    const locked = setShardKey(callNow(s), 'db', 'country', l);
    expect(locked.buildings.find(b => b.id === 'db')!.params.shardKey).toBe('userId');
    expect(locked.events.at(-1)).toMatchObject({ kind: 'refused', reason: 'shardKeyLocked' });
    expect(setShardKey(s, 'db', 'nope', l)).toBe(s);
  });

  it('a Shard is one more instance of the database, with its own price, only in a level that offers Shard Keys', () => {
    const l = shardLevel(keys);
    let s = build(createGame(l, { components: [{ id: 'db', type: 'database' }], connections: [] }), 'database', l);
    expect(s.buildings[0]!.instances).toHaveLength(2);
    expect(s.money).toBe(800 - 50);
    expect(build(createGame(shardLevel(undefined), { components: [{ id: 'db', type: 'database' }], connections: [] }), 'database', shardLevel(undefined)).buildings[0]!.instances).toHaveLength(1);
  });

  it('keeps the number of Shards and the Shard Key in the saved design', () => {
    const l = shardLevel(keys);
    const design = toDesign(createGame(l, sharded(3, 'country')));
    expect(design.components.find(c => c.id === 'db')!.params).toMatchObject({ instances: 3, shardKey: 'country' });
  });

  it('a Shard that holds no data because the key has fewer values than Shards, and is down, does not break the latency', () => {
    const l = shardLevel({ userId: [0.5, 0.5] }, 400);
    const live = callNow(createGame(l, sharded(4, 'userId')));
    const down = { ...live, buildings: live.buildings.map(b => (b.id === 'db' ? { ...b, instances: b.instances.map((i, k) => (k === 3 ? { ...i, down: true } : i)) } : b)) };
    const s = run(down, 5, l);
    expect(Number.isFinite(s.flow!.p95)).toBe(true);
    expect(s.flow!.errors).toBe(0); // the two Shards that hold data are fine
    expect(s.flow!.shards.db![3]).toBe(0);
  });

  it('a Shard that is down loses its slice of the data', () => {
    const l = shardLevel(keys, 400);
    const live = callNow(createGame(l, sharded(2, 'userId')));
    const down = { ...live, buildings: live.buildings.map(b => (b.id === 'db' ? { ...b, instances: b.instances.map((i, k) => (k === 0 ? { ...i, down: true } : i)) } : b)) };
    expect(run(down, 5, l).flow!.errors).toBeCloseTo(0.5);
  });
});

describe('data scale: big uploads go straight to Object Storage, not through the app server', () => {
  // A medium app server serves 200 normal requests per second; an upload keeps it busy as long as 10 of them.
  const uploadLevel = (mix: Record<string, number>, rps: number): GameLevel => ({
    allowedComponents: ['loadBalancer', 'appServer', 'database', 'objectStorage'],
    componentOptions: { appServer: { maxInstances: 4 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 500, wave: { rps, lengthS: 30, mix }, starMoney: [100, 200] },
  });
  const design = (links: [string, string][], withStorage = true): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, ...(withStorage ? [{ id: 'files', type: 'objectStorage' }] : [])],
    connections: [['client', 'api'], ['api', 'db'], ...links],
  });
  const play = (l: GameLevel, d: Design) => run(callNow(createGame(l, d)), 5, l);

  it('an upload sent through the app server keeps it busy: 40 uploads a second are 400 normal requests for a medium app server', () => {
    const l = uploadLevel({ upload: 1 }, 40);
    const s = play(l, design([['api', 'files']]));
    expect(s.flow!.errors).toBeCloseTo(0.5);
    expect(s.flow!.load.api).toBe(1);
  });

  it('an upload sent straight from the users to Object Storage leaves the app server free', () => {
    const l = uploadLevel({ upload: 0.8, watch: 0.2 }, 100);
    const s = play(l, design([['api', 'files'], ['client', 'files']]));
    expect(s.flow!.inflow.files).toBeCloseTo(80);
    expect(s.flow!.inflow.api).toBeCloseTo(20);
    expect(s.flow!.errors).toBe(0);
  });

  it('the users can have two entrances: the app server for the work and Object Storage for the files; a new load balancer replaces only the first', () => {
    const l = uploadLevel({ upload: 0.5, watch: 0.5 }, 20);
    const s = connect(createGame(l, design([['api', 'files']])), 'client', 'files');
    expect(named(s)).toEqual(expect.arrayContaining(['client>appServer', 'client>objectStorage']));
    const withLb = named(build(s, 'loadBalancer', l));
    expect(withLb).toContain('client>loadBalancer');
    expect(withLb).toContain('client>objectStorage');
    expect(withLb).not.toContain('client>appServer');
  });

  it('the users connecting to a building that is not an entrance for some types (a cache) still replace the way in, as before', () => {
    const l = { ...uploadLevel({ watch: 1 }, 10), allowedComponents: ['appServer', 'cache', 'database', 'objectStorage'] };
    const s = build(createGame(l, design([])), 'cache', l);
    const cache = s.buildings.find(b => b.type === 'cache')!.id;
    expect(named(connect(s, 'client', cache))).toEqual(expect.arrayContaining(['client>cache']));
    expect(named(connect(s, 'client', cache))).not.toContain('client>appServer');
  });

  it('Object Storage takes uploads only: a watch is never sent to it, even from a connected user', () => {
    const l = uploadLevel({ watch: 0.5, upload: 0.5 }, 100);
    const s = play(l, design([['api', 'files'], ['client', 'files']]));
    expect(s.flow!.inflow.files).toBeCloseTo(50); // the uploads only
    expect(s.flow!.errors).toBe(0);
  });

  it('the users cannot connect to Object Storage in a level with no uploads: it takes uploads only', () => {
    const l = uploadLevel({ watch: 1 }, 10);
    const s = createGame(l, design([]));
    const files = s.buildings.find(b => b.type === 'objectStorage')!.id;
    const refused = connect(s, 'client', files);
    expect(refused.links).toBe(s.links);
    expect(refused.events.at(-1)).toMatchObject({ kind: 'refused', reason: 'uploadsOnly' });
    const withUploads = uploadLevel({ watch: 0.5, upload: 0.5 }, 10);
    expect(named(connect(createGame(withUploads, design([])), 'client', 'files'))).toContain('client>objectStorage');
  });

  it('with no way to store a file, an upload is an error', () => {
    const l = uploadLevel({ upload: 1 }, 10);
    expect(play(l, design([], false)).flow!.errors).toBe(1);
  });

  it('new buildings connect the app server to Object Storage by themselves, in any order, and keep the users at the app server', () => {
    const l = uploadLevel({ upload: 1 }, 10);
    const built = (order: string[]) => named(order.reduce((acc, type) => build(acc, type, l), createGame(l, empty))).sort();
    const wired = ['appServer>database', 'appServer>objectStorage', 'client>appServer'];
    expect(built(['appServer', 'database', 'objectStorage'])).toEqual(wired);
    expect(built(['objectStorage', 'database', 'appServer'])).toEqual(wired);
  });

  it('Object Storage has a fixed price and no instances to add', () => {
    const l = uploadLevel({ upload: 1 }, 10);
    const s = build(createGame(l, empty), 'objectStorage', l);
    expect(s.money).toBe(500 - 30);
    expect(build(s, 'objectStorage', l).buildings.find(b => b.type === 'objectStorage')!.instances).toHaveLength(1);
  });
});

describe('data scale: Replication Lag grows while writes are higher than a Read Replica can apply', () => {
  // A small Read Replica applies 100 writes a second, a medium one 200. The wave brings 150 writes and 150 reads a second.
  const lagLevel: GameLevel = {
    allowedComponents: ['loadBalancer', 'appServer', 'database', 'readReplica'],
    componentOptions: { appServer: { maxInstances: 4 }, readReplica: { maxInstances: 2 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01, maxReplicationLagS: 2 },
    play: { startMoney: 800, wave: { rps: 300, lengthS: 60, mix: { read: 0.5, write: 0.5 } }, starMoney: [100, 200] },
  };
  const withReplica = (size: string): Design => ({
    components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { size: 'large', instances: 2 } }, { id: 'db', type: 'database' },
      { id: 'rep', type: 'readReplica', params: { size } }],
    connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db'], ['api', 'rep'], ['rep', 'db']],
  });
  const play = (d: Design, seconds: number) => run(callNow(createGame(lagLevel, d)), seconds, lagLevel);
  const lagOf = (s: GameState) => Math.max(0, ...Object.values(s.lag));

  it('grows while the writes are higher than the replica applies, and is kept from one moment to the next', () => {
    const early = lagOf(play(withReplica('small'), 5)), later = lagOf(play(withReplica('small'), 15));
    expect(early).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(early);
  });

  it('stays at zero when the replica applies the writes as fast as they come: a bigger replica', () => {
    expect(lagOf(play(withReplica('medium'), 20))).toBe(0);
  });

  it('is zero when there is no Read Replica: nothing is behind', () => {
    const none: Design = { ...withReplica('small'), components: withReplica('small').components.filter(c => c.type !== 'readReplica'), connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']] };
    expect(lagOf(play(none, 20))).toBe(0);
  });

  it('does not pile up writes while the Read Replica is still being built, so the lag does not jump when it is ready', () => {
    const none: Design = { components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { size: 'large', instances: 2 } }, { id: 'db', type: 'database' }], connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']] };
    const building = run(callNow(build(createGame(lagLevel, none), 'readReplica', lagLevel)), 4, lagLevel); // a Read Replica takes 7 s to build
    const replica = building.buildings.find(b => b.type === 'readReplica')!;
    expect(replica.instances[0]!.buildLeftS).toBeGreaterThan(0);
    expect(building.unapplied[replica.id] ?? 0).toBe(0);
    expect(lagOf(building)).toBe(0);
  });

  it('costs reputation while it is over the level maximum, as a slow base does', () => {
    expect(play(withReplica('medium'), 25).reputation).toBe(100);
    expect(play(withReplica('small'), 25).reputation).toBeLessThan(100);
  });

  it('shrinks again when the writes slow down', () => {
    const behind = play(withReplica('small'), 15);
    const calmer: GameLevel = { ...lagLevel, play: { ...lagLevel.play, wave: { ...lagLevel.play.wave, mix: { read: 0.95, write: 0.05 } } } };
    expect(lagOf(run(behind, 15, calmer))).toBeLessThan(lagOf(behind));
  });
});

describe('edge: the CDN answers a share of the downloads in front of Object Storage', () => {
  const cdnLevel = (mix: Record<string, number>): GameLevel => ({
    allowedComponents: ['cdn', 'loadBalancer', 'appServer', 'database', 'objectStorage'],
    componentOptions: { appServer: { maxInstances: 4 }, cdn: { limits: { ttlS: 120 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 800, wave: { rps: 400, lengthS: 30, mix }, starMoney: [100, 200] },
  });
  const base = [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }, { id: 'files', type: 'objectStorage' }];
  const design = (withCdn: boolean, users: boolean): Design => ({
    components: withCdn ? [...base, { id: 'cdn', type: 'cdn' }] : base,
    connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db'], ['api', 'files'], ...(withCdn ? [['cdn', 'files']] : []), ...(users ? [['client', 'cdn']] : [])] as [string, string][],
  });
  const play = (l: GameLevel, d: Design, seconds = 5) => run(callNow(createGame(l, d)), seconds, l);
  const mix = { watch: 0.3, download: 0.7 };

  it('Object Storage cannot send out a viral video on its own: the downloads that pass its limit are errors', () => {
    const l = cdnLevel(mix);
    const s = play(l, design(false, false));
    expect(s.flow!.errors).toBeGreaterThan(0.1);
    expect(s.flow!.drop.files).toBeGreaterThan(0);
  });

  it('a CDN in front answers a share of the downloads, so only the rest reaches Object Storage', () => {
    const l = cdnLevel(mix);
    const s = play(l, design(true, true));
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.inflow.cdn).toBeCloseTo(280); // every download goes to the CDN, none through the app servers
    expect(s.flow!.inflow.files).toBeCloseTo(280 * 0.25); // the default TTL of 60 s answers 75 %
  });

  it('a longer TTL answers more downloads and a shorter one lets more through to Object Storage', () => {
    const l = cdnLevel(mix);
    const reach = (ttlS: number) => run(setTtl(callNow(createGame(l, design(true, true))), 'cdn', ttlS), 3, l).flow!.inflow.files!;
    expect(reach(120)).toBeLessThan(reach(60));
    expect(reach(60)).toBeLessThan(reach(5));
  });

  it('a CDN with no connection to Object Storage drops what it does not answer', () => {
    const l = cdnLevel(mix);
    const d = design(true, true);
    const s = play(l, { ...d, connections: d.connections.filter(([a, b]) => !(a === 'cdn' && b === 'files')) });
    expect(s.flow!.drop.cdn).toBeGreaterThan(0);
    expect(s.flow!.errors).toBeGreaterThan(0.1);
  });

  it('the users cannot connect to the CDN in a level with no downloads: it takes downloads only', () => {
    const l = cdnLevel({ watch: 1 });
    const s = createGame(l, design(true, false));
    const refused = connect(s, 'client', 'cdn');
    expect(refused.links).toBe(s.links);
    expect(refused.events.at(-1)).toMatchObject({ kind: 'refused', reason: 'downloadsOnly' });
    expect(named(connect(createGame(cdnLevel(mix), design(true, false)), 'client', 'cdn'))).toContain('client>cdn');
  });

  it('the users can reach the CDN, Object Storage and the load balancer at once: a direct entrance does not replace another', () => {
    const l = cdnLevel({ watch: 0.4, upload: 0.2, download: 0.4 });
    let s = createGame(l, design(true, false));
    s = connect(connect(s, 'client', 'files'), 'client', 'cdn');
    expect(named(s).filter(x => x.startsWith('client>')).sort()).toEqual(['client>cdn', 'client>loadBalancer', 'client>objectStorage']);
  });

  it('a new CDN connects itself to the users and to Object Storage, in any order, and a new Object Storage goes behind an existing CDN', () => {
    const l = cdnLevel(mix);
    const built = (order: string[]) => named(order.reduce((acc, type) => build(acc, type, l), createGame(l, empty))).sort();
    expect(built(['objectStorage', 'cdn'])).toEqual(['cdn>objectStorage', 'client>cdn']);
    expect(built(['cdn', 'objectStorage'])).toEqual(['cdn>objectStorage', 'client>cdn']);
  });

  it('chapters 2 and 3 uploads stay far under the limit of Object Storage', () => {
    const l = cdnLevel({ watch: 0.3, upload: 0.7 });
    const d = design(false, false);
    const s = play(l, { ...d, connections: [...d.connections, ['client', 'files']] });
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.load.files ?? 0).toBeLessThan(0.1);
  });
});

describe('edge: a freshness limit caps how long a CDN may keep a copy', () => {
  const freshLevel: GameLevel = {
    allowedComponents: ['cdn', 'loadBalancer', 'appServer', 'database', 'objectStorage'],
    componentOptions: { appServer: { maxInstances: 4 }, cdn: { limits: { ttlS: 300 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01, maxStaleS: 50 },
    play: { startMoney: 800, wave: { rps: 600, lengthS: 30, mix: { watch: 0.15, download: 0.85 } }, starMoney: [100, 200] },
  };
  const withTtl = (ttlS: number): Design => ({
    components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' },
      { id: 'files', type: 'objectStorage' }, { id: 'cdn', type: 'cdn', params: { ttlS } }],
    connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db'], ['cdn', 'files'], ['client', 'cdn']],
  });
  const play = (ttlS: number, seconds: number) => run(callNow(createGame(freshLevel, withTtl(ttlS))), seconds, freshLevel);

  it('content age is the longest TTL of a CDN, and 0 with no CDN', () => {
    expect(contentAge(createGame(freshLevel, withTtl(40)))).toBe(40);
    expect(contentAge(createGame(freshLevel, { components: [{ id: 'db', type: 'database' }], connections: [] }))).toBe(0);
    expect(contentAge(createGame(freshLevel, { components: [{ id: 'c', type: 'cache', params: { ttlS: 90 } }], connections: [] }))).toBe(0); // a cache is not a CDN
  });

  it('a TTL over the limit costs reputation (old content), though every download is answered', () => {
    const s = play(120, 15);
    expect(s.flow!.errors).toBe(0);
    expect(s.reputation).toBeLessThan(100);
  });

  it('a TTL at or under the limit, and long enough to protect Object Storage, keeps the reputation', () => {
    const s = play(40, 15);
    expect(s.flow!.errors).toBe(0);
    expect(s.reputation).toBe(100);
  });

  it('a TTL that is too short lets too many downloads reach Object Storage, which fails', () => {
    const s = play(10, 5);
    expect(s.flow!.drop.files).toBeGreaterThan(0);
    expect(s.flow!.errors).toBeGreaterThan(0.01);
  });
});

describe('edge: the API Gateway turns invalid requests away before the app servers see them', () => {
  const gatewayLevel: GameLevel = {
    allowedComponents: ['apiGateway', 'loadBalancer', 'appServer', 'database'],
    componentOptions: { appServer: { maxInstances: 2 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 800, wave: { rps: 600, lengthS: 30, mix: { watch: 0.4, invalid: 0.6 } }, starMoney: [100, 200] },
  };
  const parts = [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }];
  const open: Design = { components: parts, connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']] };
  const doored: Design = { components: [...parts, { id: 'gw', type: 'apiGateway' }], connections: [['client', 'gw'], ['gw', 'lb'], ['lb', 'api'], ['api', 'db']] };
  const play = (d: Design, mix = gatewayLevel.play.wave.mix, seconds = 5, rps = 600) => {
    const l = { ...gatewayLevel, play: { ...gatewayLevel.play, wave: { ...gatewayLevel.play.wave, mix, rps } } };
    return run(callNow(createGame(l, d)), seconds, l);
  };

  it('without a gateway the app servers read every invalid request first, and the junk uses the capacity real users need', () => {
    const s = play(open);
    expect(s.flow!.inflow.api).toBeCloseTo(600);
    expect(s.flow!.errors).toBeGreaterThan(0.1);
  });

  it('with a gateway the app servers see only the valid requests', () => {
    const s = play(doored);
    expect(s.flow!.inflow.api).toBeCloseTo(240);
    expect(s.flow!.errors).toBe(0);
  });

  it('a request turned away is neither answered nor an error, and the gateway counts it', () => {
    const s = play(doored);
    expect(s.flow!.rejected).toBeCloseTo(360);
    expect(s.flow!.answered).toBeCloseTo(240);
    expect(s.flow!.errors).toBe(0);
  });

  it('an app server also turns invalid requests away: they are not errors, only a use of its capacity', () => {
    const s = play(open, { watch: 0.7, invalid: 0.3 }, 5, 300);
    expect(s.flow!.rejected).toBeCloseTo(90);
    expect(s.flow!.errors).toBe(0);
  });

  it('a gateway with nothing behind it drops the valid requests', () => {
    const s = play({ ...doored, connections: [['client', 'gw'], ['lb', 'api'], ['api', 'db']] });
    expect(s.flow!.errors).toBeCloseTo(0.4);
    expect(s.flow!.drop.gw).toBeGreaterThan(0);
  });

  it('a new gateway takes the users and connects to the load balancer, in any order', () => {
    const built = (order: string[]) => named(order.reduce((acc, type) => build(acc, type, gatewayLevel), createGame(gatewayLevel, empty))).sort();
    const wired = ['apiGateway>loadBalancer', 'appServer>database', 'client>apiGateway', 'loadBalancer>appServer'];
    expect(built(['loadBalancer', 'appServer', 'database', 'apiGateway'])).toEqual(wired);
    expect(built(['apiGateway', 'loadBalancer', 'appServer', 'database'])).toEqual(wired);
    expect(built(['apiGateway', 'appServer', 'database'])).toEqual(['apiGateway>appServer', 'appServer>database', 'client>apiGateway']);
  });

  it('connecting the users to the gateway replaces their old way in', () => {
    const s = connect(createGame(gatewayLevel, { ...doored, connections: [['client', 'lb'], ['gw', 'lb'], ['lb', 'api'], ['api', 'db']] }), 'client', 'gw');
    expect(named(s).filter(x => x.startsWith('client>'))).toEqual(['client>apiGateway']);
  });
});

describe('edge: the Client Limit stops abusive clients without refusing normal ones', () => {
  // 30 normal clients send 8 requests a second each (240); 4 abusive clients send 90 each (360).
  const limitLevel: GameLevel = {
    allowedComponents: ['apiGateway', 'loadBalancer', 'appServer', 'database'],
    componentOptions: { appServer: { maxInstances: 2 }, apiGateway: { limits: { limitRps: 100 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 800, wave: { rps: 600, lengthS: 30, mix: { watch: 0.4, abusive: 0.6 } }, clients: { watch: 30, abusive: 4 }, starMoney: [100, 200] },
  };
  const withLimit = (limitRps: number): Design => ({
    components: [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }, { id: 'gw', type: 'apiGateway', params: { limitRps } }],
    connections: [['client', 'gw'], ['gw', 'lb'], ['lb', 'api'], ['api', 'db']],
  });
  const play = (limitRps: number, seconds = 5) => run(callNow(createGame(limitLevel, withLimit(limitRps))), seconds, limitLevel);

  it('a limit above what the abusive clients send changes nothing: they fill the app servers', () => {
    expect(play(100).flow!.errors).toBeGreaterThan(0.1);
  });

  it('a limit between the two keeps the normal clients and turns the abusive ones away above it', () => {
    const s = play(10);
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.inflow.api).toBeCloseTo(240 + 4 * 10);
    expect(s.flow!.rejected).toBeCloseTo(360 - 4 * 10); // not errors
    expect(s.reputation).toBe(100);
  });

  it('a limit under what a normal client sends refuses normal clients too, and those refusals are errors', () => {
    const s = play(5);
    expect(s.flow!.errors).toBeCloseTo((8 - 5) * 30 / 600); // 90 of 600 requests
    expect(s.flow!.drop.gw).toBeGreaterThan(0);
  });

  it('only some limits win: too low and too high both fail', () => {
    const wins = [5, 10, 15, 20, 25, 30, 35, 40].filter(l => { const s = play(l, 15); return s.flow!.errors <= 0.01 && s.reputation === 100; });
    expect(wins).toEqual([10, 15, 20]);
  });

  it('the Client Limit is changed in the inspector: free, immediate, and saved with the design', () => {
    const s = setClientLimit(createGame(limitLevel, withLimit(40)), 'gw', 15);
    expect(s.buildings.find(b => b.id === 'gw')!.params.limitRps).toBe(15);
    expect(toDesign(s).components.find(c => c.id === 'gw')!.params).toMatchObject({ limitRps: 15 });
  });

  it('a level with no counted clients ignores the limit', () => {
    const l: GameLevel = { ...limitLevel, play: { ...limitLevel.play, clients: undefined, wave: { rps: 300, lengthS: 30, mix: { watch: 1 } } } };
    expect(run(callNow(createGame(l, withLimit(1))), 5, l).flow!.errors).toBe(0);
  });
});

describe('edge: a standby Region, the DNS and a Region that falls', () => {
  const regionLevel: GameLevel = {
    allowedComponents: ['dns', 'loadBalancer', 'appServer', 'database', 'readReplica'],
    componentOptions: { appServer: { maxInstances: 2 }, readReplica: { maxInstances: 1 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 900, wave: { rps: 160, lengthS: 60, mix: { read: 0.6, write: 0.4 } }, incident: { atS: 20, region: 'main' }, starMoney: [100, 190] },
  };
  const main = [{ id: 'lb', type: 'loadBalancer' }, { id: 'api', type: 'appServer', params: { instances: 2 } }, { id: 'db', type: 'database' }];
  const standby = [{ id: 'lb2', type: 'loadBalancer', params: { region: 'standby' } }, { id: 'api2', type: 'appServer', params: { instances: 2, region: 'standby' } }, { id: 'rep', type: 'readReplica', params: { region: 'standby' } }];
  const design = (ttlS: number, withStandby = true): Design => ({
    components: withStandby ? [{ id: 'dns', type: 'dns', params: { ttlS } }, ...main, ...standby] : [{ id: 'dns', type: 'dns', params: { ttlS } }, ...main],
    connections: [['client', 'dns'], ['dns', 'lb'], ['lb', 'api'], ['api', 'db'], ...(withStandby ? [['dns', 'lb2'], ['lb2', 'api2'], ['api2', 'rep'], ['rep', 'db']] : [])] as [string, string][],
  });
  const at = (seconds: number, d: Design) => run(callNow(createGame(regionLevel, d)), seconds, regionLevel);
  // The incident is at 20 s into the wave.

  it('before anything fails the DNS sends every request to the main Region, and the standby sits idle', () => {
    const s = at(10, design(10));
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.inflow.lb).toBeCloseTo(160);
    expect(s.flow!.inflow.lb2 ?? 0).toBe(0);
  });

  it('when the main Region falls every building in it is down, the standby stays up, and every request fails until the DNS switches', () => {
    const s = at(22, design(10)); // 2 s after the fall, the TTL is 10 s
    expect(s.incidentDone).toBe(true);
    expect(s.buildings.filter(b => b.region !== 'standby' && b.type !== 'dns').every(b => b.instances.every(i => i.down))).toBe(true);
    expect(s.buildings.filter(b => b.region === 'standby').every(b => b.instances.every(i => !i.down))).toBe(true);
    expect(s.failover.switched).toBe(false);
    expect(s.flow!.errors).toBe(1);
    expect(s.reputation).toBeLessThan(100);
  });

  it('switches the users after the TTL: the standby serves them, and its Read Replica becomes the primary database', () => {
    const s = at(35, design(10)); // the fall at 20 s, the switch at 30 s
    expect(s.failover.switched).toBe(true);
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.inflow.lb2).toBeCloseTo(160);
    expect(s.buildings.find(b => b.id === 'rep')!.type).toBe('promotedReplica');
    expect(s.events.map(e => e.kind)).toContain('failover');
  });

  it('a Read Replica that answers reads only could not take the writes: promoting it is what lets the standby serve everything', () => {
    const s = at(35, design(10));
    expect(s.flow!.inflow.rep).toBeCloseTo(160); // reads and writes alike
    expect(s.flow!.drop.rep ?? 0).toBe(0);
  });

  it('a shorter TTL switches sooner, and costs more each second', () => {
    const switchedAt = (ttlS: number) => at(70, design(ttlS)).failover.switchAt! - (BUILD_PHASE_S + 20);
    expect(switchedAt(5)).toBeCloseTo(5, 0);
    expect(switchedAt(30)).toBeCloseTo(30, 0);
    const price = (ttlS: number) => upkeepPerS(createGame(regionLevel, design(ttlS)));
    expect(price(5)).toBeGreaterThan(price(10));
    expect(price(10)).toBeGreaterThan(price(30));
  });

  it('waiting 30 s for the DNS loses the base: reputation falls too fast, while 10 s survives', () => {
    expect(runToEnd(callNow(createGame(regionLevel, design(30))), regionLevel).phase).toBe('lost');
    expect(runToEnd(callNow(createGame(regionLevel, design(10))), regionLevel).phase).toBe('won');
  });

  it('with no standby Region nothing can take the users, however fast the DNS is', () => {
    const s = at(60, design(5, false));
    expect(s.failover.switchAt).toBeNull();
    expect(s.flow!.errors).toBe(1);
  });

  it('a DNS that is not connected to the standby Region switches the users to nothing', () => {
    const d = design(5);
    const s = at(40, { ...d, connections: d.connections.filter(([a, b]) => !(a === 'dns' && b === 'lb2')) });
    expect(s.failover.switched).toBe(true);
    expect(s.flow!.errors).toBe(1);
  });

  it('a building goes into the Region chosen when it is built, and a new Region has its own copy of each type', () => {
    let s = createGame(regionLevel, { components: [], connections: [] });
    s = build(s, 'appServer', regionLevel, undefined, 'standby');
    s = build(s, 'appServer', regionLevel, undefined, 'main');
    expect(s.buildings.map(b => [b.type, b.region ?? 'main'])).toEqual([['appServer', 'standby'], ['appServer', 'main']]);
    const more = build(s, 'appServer', regionLevel, undefined, 'standby');
    expect(more.buildings.find(b => b.region === 'standby')!.instances).toHaveLength(2);
  });

  it('there is one DNS for the whole design, wherever it is built', () => {
    let s = build(createGame(regionLevel, { components: [], connections: [] }), 'dns', regionLevel, undefined, 'standby');
    expect(s.buildings[0]!.region).toBeUndefined();
    expect(buildProblem(s, 'dns', regionLevel, undefined, 'main')).toBe('built');
    s = build(s, 'dns', regionLevel);
    expect(s.buildings).toHaveLength(1);
  });

  it('a Region is a group: buildings connect inside it, and only the DNS and replication cross to the other', () => {
    const s = createGame(regionLevel, design(10));
    expect(connect(s, 'api', 'rep').events.at(-1)).toMatchObject({ kind: 'refused', reason: 'otherRegion' });
    expect(connect(s, 'lb2', 'api').events.at(-1)).toMatchObject({ kind: 'refused', reason: 'otherRegion' });
    expect(ids(s)).toContain('rep>db'); // replication crosses Regions
    expect(ids(s)).toContain('dns>lb2'); // and so does the DNS
  });

  it('new buildings wire themselves inside their Region, the DNS reaches each Region, and the standby Read Replica copies the primary database', () => {
    const l = regionLevel;
    const order: [string, string][] = [['loadBalancer', 'main'], ['appServer', 'main'], ['database', 'main'], ['loadBalancer', 'standby'], ['appServer', 'standby'], ['readReplica', 'standby'], ['dns', 'main']];
    const s = order.reduce((acc, [type, region]) => build(acc, type, l, undefined, region), createGame(l, { components: [], connections: [] }));
    expect(named(s).sort()).toEqual(['appServer>database', 'appServer>readReplica', 'client>dns', 'dns>loadBalancer', 'dns>loadBalancer', 'loadBalancer>appServer', 'loadBalancer>appServer', 'readReplica>database']);
    // The same buildings in the other order give the same wiring.
    const reversed = [...order].reverse().reduce((acc, [type, region]) => build(acc, type, l, undefined, region), createGame(l, { components: [], connections: [] }));
    expect(named(reversed).sort()).toEqual(named(s).sort());
  });

  it('a Region that falls where there is no DNS is not switched, and the design is saved with each building\'s Region', () => {
    const s = createGame(regionLevel, design(10));
    const saved = toDesign(s);
    expect(saved.components.find(c => c.id === 'rep')!.params).toMatchObject({ region: 'standby' });
    expect(saved.components.find(c => c.id === 'lb')!.params?.region).toBeUndefined();
  });
});

describe('edge: the buildings that stand outside the Regions, and the way in through the gateway and the DNS', () => {
  const lvl: GameLevel = {
    allowedComponents: ['cdn', 'apiGateway', 'dns', 'loadBalancer', 'appServer', 'database', 'readReplica', 'objectStorage'],
    componentOptions: { appServer: { maxInstances: 2 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 2000, wave: { rps: 700, lengthS: 70, mix: { download: 0.35, abusive: 0.45, watch: 0.15, upload: 0.05 } }, clients: { watch: 35, abusive: 3 }, incident: { atS: 45, region: 'main' }, starMoney: [100, 300] },
  };
  const built = (order: [string, string?][]) => order.reduce((acc, [type, region]) => build(acc, type, lvl, undefined, region ?? 'main'), createGame(lvl, { components: [], connections: [] }));

  it('the gateway stands in front of the DNS, in any build order: the users reach the gateway, the gateway the DNS, the DNS each Region', () => {
    const wired = ['apiGateway>dns', 'client>apiGateway', 'dns>loadBalancer', 'dns>loadBalancer'];
    const parts: [string, string?][] = [['loadBalancer'], ['loadBalancer', 'standby']];
    const a = named(built([...parts, ['dns'], ['apiGateway']])).sort();
    const b = named(built([...parts, ['apiGateway'], ['dns']])).sort();
    const c = named(built([['apiGateway'], ['dns'], ...parts])).sort();
    expect(a).toEqual(wired);
    expect(b).toEqual(wired);
    expect(c).toEqual(wired);
  });

  it('the CDN, the gateway and Object Storage belong to no Region, so a Region that falls does not take them down', () => {
    const l: GameLevel = { ...lvl, play: { ...lvl.play, incident: { atS: 1, region: 'main' } } };
    let s = createGame(l, { components: [{ id: 'cdn', type: 'cdn' }, { id: 'gw', type: 'apiGateway' }, { id: 'files', type: 'objectStorage' }, { id: 'lb', type: 'loadBalancer' }], connections: [] });
    s = run(callNow(s), 3, l);
    expect(s.buildings.find(b => b.id === 'lb')!.instances.every(i => i.down)).toBe(true);
    for (const id of ['cdn', 'gw', 'files']) expect(s.buildings.find(b => b.id === id)!.instances.every(i => !i.down)).toBe(true);
  });

  it('a global building is one for the whole design, wherever it is built', () => {
    const s = built([['objectStorage', 'standby'], ['cdn', 'standby'], ['apiGateway', 'standby']]);
    expect(s.buildings.every(b => b.region === undefined)).toBe(true);
    expect(buildProblem(s, 'cdn', lvl, undefined, 'main')).toBe('built');
  });
});

// ───────── Events: a Topic gives every Subscription its own copy of each post (ADR-0009) ─────────
describe('events: a Topic keeps every post for each Subscription, served by its own Workers', () => {
  // 6 posts/s. A medium Worker takes 4 posts/s, so each Subscription needs two instances to keep up.
  const pubSub: GameLevel = {
    allowedComponents: ['appServer', 'database', 'messageQueue', 'topic', 'worker'],
    componentOptions: { worker: { maxInstances: 4 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01, maxQueueAgeS: 30 },
    play: { startMoney: 900, wave: { rps: 30, lengthS: 30, mix: { post: 0.2, readFeed: 0.8 } }, starMoney: [100, 200],
      subscriptions: { notifications: { maxLagS: 5 }, search: { maxLagS: 20 } } },
  };
  const worker = (id: string, subscription: string, instances = 2) => ({ id, type: 'worker', params: { subscription, instances } });
  const withTopic = (n = 2, s = 2): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 't', type: 'topic' }, worker('wn', 'notifications', n), worker('ws', 'search', s)],
    connections: [['client', 'api'], ['api', 'db'], ['api', 't'], ['t', 'wn'], ['t', 'ws']],
  });
  const withQueue: Design = {
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 'q', type: 'messageQueue' }, worker('wn', 'notifications'), worker('ws', 'search')],
    connections: [['client', 'api'], ['api', 'db'], ['api', 'q'], ['q', 'wn'], ['q', 'ws']],
  };
  const play = (s: GameState, seconds: number) => run(s, seconds, pubSub);
  const live = (design: Design) => callNow(createGame(pubSub, design));

  it('a post is answered when it enters the Topic, and every Subscription processes every post', () => {
    const s = play(live(withTopic()), 10);
    expect(s.flow!.errors).toBe(0);
    expect(s.flow!.p95).toBeLessThan(100);
    // Both Subscriptions get all 6 posts/s, not a share of them.
    expect(s.flow!.edge['t>wn']).toBeCloseTo(6);
    expect(s.flow!.edge['t>ws']).toBeCloseTo(6);
    expect(s.subBacklog['notifications']).toBeLessThan(1);
    expect(s.subBacklog['search']).toBeLessThan(1);
    expect(s.reputation).toBe(100);
  });

  it('a Message Queue gives each post to one Worker only: each Subscription misses the posts the other took, and falls behind', () => {
    const s = play(live(withQueue), 15);
    expect(s.flow!.errors).toBe(0); // the posts are answered: the problem is what never reaches each system
    expect(s.subBacklog['notifications']).toBeGreaterThan(30); // about 3 posts/s missed for 15 s
    expect(s.consumerLag['notifications']!).toBeGreaterThan(pubSub.play.subscriptions!.notifications!.maxLagS);
    expect(s.reputation).toBeLessThan(100);
  });

  it('each Subscription has its own Backlog and Consumer Lag: a slow one does not slow the others', () => {
    const s = play(live(withTopic(2, 1)), 10); // search: 4 posts/s of capacity against 6
    expect(s.subBacklog['notifications']).toBeLessThan(1);
    expect(s.consumerLag['notifications']).toBe(0);
    expect(s.subBacklog['search']).toBeGreaterThan(15); // about 2 posts/s for 10 s
    expect(s.consumerLag['search']).toBeCloseTo(s.subBacklog['search']! / 4, 1);
    // Search is under its loose 20 s maximum: the reputation holds.
    expect(s.reputation).toBe(100);
  });

  it('a Subscription with no Worker keeps every post, and its lag grows with the clock until the reputation falls', () => {
    const noSearch: Design = { ...withTopic(), components: withTopic().components.filter(c => c.id !== 'ws'), connections: withTopic().connections.filter(([, to]) => to !== 'ws') };
    const s = play(live(noSearch), 25);
    expect(s.subBacklog['search']).toBeGreaterThan(140);
    expect(s.consumerLag['search']).toBeGreaterThan(20);
    expect(s.reputation).toBeLessThan(100);
  });

  it('records each Subscription\'s Consumer Lag every second, for the console chart', () => {
    const s = play(live(withTopic(2, 1)), 6);
    expect(s.history.at(-1)!.consumerLag?.['search']).toBeCloseTo(s.consumerLag['search']!, 0);
    expect(Object.keys(s.history.at(-1)!.consumerLag ?? {})).toEqual(['notifications', 'search']);
  });

  it('the Drain Phase lasts until every Subscription has caught up', () => {
    let s = play(live(withTopic(2, 1)), pubSub.play.wave.lengthS + 0.5);
    expect(s.phase).toBe('drain');
    expect(s.subBacklog['search']).toBeGreaterThan(30);
    s = play(s, 30);
    expect(s.phase).toBe('won');
  });

  it('a new Worker serves the first Subscription without one; when all have one, more capacity is an instance added from the inspector', () => {
    let s = createGame(pubSub, { components: [{ id: 'api', type: 'appServer' }, { id: 't', type: 'topic' }], connections: [['client', 'api'], ['api', 't']] });
    s = build(s, 'worker', pubSub);
    s = build(s, 'worker', pubSub);
    const workers = s.buildings.filter(b => b.type === 'worker');
    expect(workers.map(w => w.params.subscription)).toEqual(['notifications', 'search']);
    // The new Workers connect themselves to the Topic, not to the database: their work leaves the system.
    expect(named(s).filter(l => l.includes('worker'))).toEqual(['topic>worker', 'topic>worker']);
    expect(buildProblem(s, 'worker', pubSub)).toBe('allSubscribed');
    const target = workers[1]!.id;
    s = build(s, 'worker', pubSub, undefined, undefined, target);
    expect(s.buildings.find(b => b.id === target)!.instances).toHaveLength(2);
  });

  it('a Topic connects itself between the app servers and the Workers, and the users cannot write to it straight', () => {
    let s = createGame(pubSub, empty);
    for (const type of ['appServer', 'worker', 'topic']) s = build(s, type, pubSub);
    expect(named(s).sort()).toEqual(['appServer>topic', 'client>appServer', 'topic>worker']);
    const topic = s.buildings.find(b => b.type === 'topic')!.id;
    expect(connect(s, 'client', topic).events.at(-1)).toMatchObject({ kind: 'refused', reason: 'topicNotPublic' });
  });

  it('the Subscription of a Worker is picked in the build phase and locked during the wave', () => {
    let s = createGame(pubSub, withTopic());
    s = setSubscription(s, 'wn', 'search', pubSub);
    expect(s.buildings.find(b => b.id === 'wn')!.params.subscription).toBe('search');
    expect(setSubscription(s, 'wn', 'nothing', pubSub)).toBe(s);
    const live = callNow(s);
    expect(setSubscription(live, 'wn', 'notifications', pubSub).events.at(-1)).toMatchObject({ kind: 'refused', reason: 'subscriptionLocked' });
    expect(toDesign(s).components.find(c => c.id === 'wn')!.params).toMatchObject({ subscription: 'search', instances: 2 });
  });

  it('a Topic that still holds posts for a Subscription cannot be removed', () => {
    const s = play(live(withTopic(2, 1)), 10);
    expect(demolish(s, 't').events.at(-1)).toMatchObject({ kind: 'refused', reason: 'topicHoldsMessages' });
  });
});

describe('events: Partitions cap how many Worker instances of a Subscription can work', () => {
  // 10 posts/s; a medium Worker takes 4, so three instances are needed, and three Partitions for them to work.
  const level: GameLevel = {
    allowedComponents: ['appServer', 'database', 'topic', 'worker'],
    componentOptions: { worker: { maxInstances: 4 }, topic: { limits: { partitions: 6 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 900, wave: { rps: 50, lengthS: 30, mix: { post: 0.2, readFeed: 0.8 } }, starMoney: [100, 200], subscriptions: { notifications: { maxLagS: 5 } } },
  };
  const design = (partitions: number, instances: number): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 't', type: 'topic', params: { partitions } }, { id: 'w', type: 'worker', params: { subscription: 'notifications', instances } }],
    connections: [['client', 'api'], ['api', 'db'], ['api', 't'], ['t', 'w']],
  });
  const live = (d: Design) => callNow(createGame(level, d));

  it('instances beyond the number of Partitions do no work: three Workers on two Partitions take 8 posts/s, not 12', () => {
    const s = run(live(design(2, 3)), 10, level);
    expect(s.flow!.usable['w']).toBe(2);
    expect(s.flow!.subRelease['notifications']).toBeCloseTo(8);
    expect(s.subBacklog['notifications']).toBeGreaterThan(15);
  });

  it('with as many Partitions as instances every instance works and the Subscription keeps up', () => {
    const s = run(live(design(3, 3)), 10, level);
    expect(s.flow!.usable['w']).toBe(3);
    expect(s.subBacklog['notifications']).toBeLessThan(1);
    expect(s.flow!.partitions['t']).toHaveLength(3);
    expect(s.flow!.partitions['t']!.every(l => l > 0.8 && l <= 1)).toBe(true); // 10/3 posts/s on each 4 posts/s instance
  });

  it('more Partitions than instances: one instance reads several Partitions', () => {
    const s = run(live(design(4, 2)), 10, level);
    expect(s.flow!.usable['w']).toBe(2);
    expect(s.flow!.subRelease['notifications']).toBeCloseTo(8);
  });

  it('each Partition costs $5 a month on top of the Topic price, and Partitions change only in the build phase', () => {
    let s = createGame(level, design(2, 1));
    const price = (st: GameState) => upkeepPerS(st);
    const before = price(s);
    s = setPartitions(s, 't', 4, level);
    expect(s.buildings.find(b => b.id === 't')!.params.partitions).toBe(4);
    expect(price(s) - before).toBeCloseTo(10 / 100);
    expect(setPartitions(s, 't', 7, level)).toBe(s); // over the level's maximum
    expect(setPartitions(callNow(s), 't', 3, level).events.at(-1)).toMatchObject({ kind: 'refused', reason: 'partitionsLocked' });
    expect(toDesign(s).components.find(c => c.id === 't')!.params).toMatchObject({ partitions: 4 });
  });
});

describe('events: the Partition Key spreads posts over the Partitions, and a poor one makes a Hot Partition', () => {
  // 10 posts/s over 3 Partitions, read by 3 medium instances (4 posts/s each). Country sends 60% of posts to one Partition.
  const level: GameLevel = {
    allowedComponents: ['appServer', 'database', 'topic', 'worker'],
    componentOptions: { worker: { maxInstances: 4 }, topic: { limits: { partitions: 6 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 900, wave: { rps: 50, lengthS: 30, mix: { post: 0.2, readFeed: 0.8 } }, starMoney: [100, 200], subscriptions: { notifications: { maxLagS: 5 } },
      partitionKeys: { country: [0.6, 0.25, 0.15], userId: [0.17, 0.17, 0.17, 0.17, 0.16, 0.16] } },
  };
  const design = (partitionKey: string, partitions = 3, instances = 3): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 't', type: 'topic', params: { partitions, partitionKey } }, { id: 'w', type: 'worker', params: { subscription: 'notifications', instances } }],
    connections: [['client', 'api'], ['api', 'db'], ['api', 't'], ['t', 'w']],
  });
  const play = (d: Design) => run(callNow(createGame(level, d)), 10, level);

  it('an even key keeps every instance under its capacity', () => {
    const s = play(design('userId'));
    expect(hotShardOf(s.flow!.partitions['t'])).toBeNull();
    expect(s.subBacklog['notifications']).toBeLessThan(1);
  });

  it('a skewed key sends most posts to one Partition: its instance falls behind while the others have room', () => {
    const s = play(design('country'));
    expect(hotShardOf(s.flow!.partitions['t'])).toBe(0);
    expect(s.subBacklog['notifications']).toBeGreaterThan(15); // about 6 − 4 posts/s for 10 s
    expect(s.consumerLag['notifications']).toBeGreaterThan(4.5); // about 20 posts waiting in Partition 1, read at 4 posts/s
    expect(s.partBacklog['t|notifications']![0]).toBeGreaterThan(15); // they wait in the hot Partition, not in the others
    expect(s.partBacklog['t|notifications']![1]).toBeLessThan(1);
  });

  it('more Partitions and instances do not cool a Hot Partition: the busy key value stays on one Partition', () => {
    const s = play(design('country', 6, 4));
    expect(s.subBacklog['notifications']).toBeGreaterThan(15);
  });

  it('the key is the first on offer by default, and can be changed only in the build phase', () => {
    let s = createGame(level, { ...design('country'), components: design('country').components.map(c => (c.id === 't' ? { id: 't', type: 'topic', params: { partitions: 3 } } : c)) });
    expect(hotShardOf(run(callNow(s), 10, level).flow!.partitions['t'])).toBe(0); // country, the first key
    s = setPartitionKey(s, 't', 'userId', level);
    expect(s.buildings.find(b => b.id === 't')!.params.partitionKey).toBe('userId');
    expect(setPartitionKey(callNow(s), 't', 'country', level).events.at(-1)).toMatchObject({ kind: 'refused', reason: 'partitionKeyLocked' });
  });
});

describe('events: the news feed is built when posts are written (fan-out on write) or when feeds are read (fan-out on read)', () => {
  // 5 posts/s and 120 feed reads/s. An account has 30 followers and a user follows 20 accounts. A small database serves 400 req/s.
  const level: GameLevel = {
    allowedComponents: ['appServer', 'database', 'topic', 'worker'],
    componentOptions: { worker: { maxInstances: 4 } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 900, wave: { rps: 125, lengthS: 30, mix: { post: 0.04, readFeed: 0.96 } }, starMoney: [100, 200],
      subscriptions: { notifications: { maxLagS: 10 }, feed: { maxLagS: 10 } }, feed: { subscription: 'feed', followers: 30, follows: 20 } },
  };
  const base: Design['components'] = [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 't', type: 'topic' }, { id: 'wn', type: 'worker', params: { subscription: 'notifications', instances: 2 } }];
  const onRead: Design = { components: base, connections: [['client', 'api'], ['api', 'db'], ['api', 't'], ['t', 'wn']] };
  const onWrite: Design = {
    components: [...base, { id: 'wf', type: 'worker', params: { subscription: 'feed', instances: 2 } }],
    connections: [...onRead.connections, ['t', 'wf'], ['wf', 'db']],
  };
  const play = (d: Design) => run(callNow(createGame(level, d)), 10, level);

  it('fan-out on read: each feed read gathers the posts of 20 accounts, and the database cannot keep up', () => {
    const s = play(onRead);
    expect(s.flow!.load['db']).toBe(1);
    expect(s.flow!.errors).toBeGreaterThan(0.5);
  });

  it('fan-out on write: the Feed Worker writes each post to 30 followers, and a feed read is one read', () => {
    const s = play(onWrite);
    expect(s.flow!.edge['wf>db']).toBeCloseTo(5 * 30); // 150 writes/s
    expect(s.flow!.load['db']).toBeCloseTo((150 + 120) / 400, 1);
    expect(s.flow!.errors).toBe(0);
    expect(s.subBacklog['feed']).toBeLessThan(1);
  });

  it('a Feed Worker with no way to the database writes no feed, so feed reads still gather every account', () => {
    const cut: Design = { ...onWrite, connections: onWrite.connections.filter(([from]) => from !== 'wf') };
    expect(play(cut).flow!.load['db']).toBe(1);
  });

  it('a new Feed Worker connects itself to the Topic and to the database; the others only to the Topic', () => {
    let s = createGame(level, { components: base.slice(0, 3), connections: [['client', 'api'], ['api', 'db'], ['api', 't']] });
    s = build(build(s, 'worker', level), 'worker', level);
    const feedWorker = s.buildings.find(b => b.params.subscription === 'feed')!.id;
    const notifyWorker = s.buildings.find(b => b.params.subscription === 'notifications')!.id;
    expect(s.links.some(l => l.from === feedWorker && l.to === 'db')).toBe(true);
    expect(s.links.some(l => l.from === notifyWorker)).toBe(false);
  });
});

describe('events: a celebrity makes fan-out on write explode; the Celebrity Limit merges their posts on read (the hybrid feed)', () => {
  // 10 posts/s, 100 feed reads/s, a small database (400 req/s). An account has 15 followers; from 5 s into the wave, for 20 s,
  // 30% of the posts are a celebrity's, with 3000 followers. A user follows one celebrity.
  const level: GameLevel = {
    allowedComponents: ['appServer', 'database', 'topic', 'worker'],
    componentOptions: { worker: { maxInstances: 4 }, topic: { limits: { partitions: 6 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 900, wave: { rps: 110, lengthS: 40, mix: { post: 10 / 110, readFeed: 100 / 110 } }, starMoney: [100, 200],
      subscriptions: { feed: { maxLagS: 20 } },
      feed: { subscription: 'feed', followers: 15, follows: 20, celebrity: { atS: 5, lengthS: 20, share: 0.3, followers: 3000, followed: 1 } } },
  };
  const design = (celebrityLimit?: number): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 't', type: 'topic', params: { partitions: 3 } },
      { id: 'wf', type: 'worker', params: { subscription: 'feed', instances: 3, ...(celebrityLimit !== undefined ? { celebrityLimit } : {}) } }],
    connections: [['client', 'api'], ['api', 'db'], ['api', 't'], ['t', 'wf'], ['wf', 'db']],
  });
  const at = (d: Design, seconds: number) => run(callNow(createGame(level, d)), seconds, level);

  it('before the celebrity posts, fan-out on write is calm: 150 writes and 100 reads a second', () => {
    const s = at(design(), 4);
    expect(s.flow!.edge['wf>db']).toBeCloseTo(150);
    expect(s.flow!.errors).toBe(0);
  });

  it('with no limit, each celebrity post is written into 3000 feeds: the database is flooded and feed reads fail', () => {
    const s = at(design(), 10);
    expect(s.events.some(e => e.kind === 'celebrity')).toBe(true);
    expect(s.flow!.edge['wf>db']).toBeGreaterThan(5000);
    expect(s.flow!.errors).toBeGreaterThan(0.3);
  });

  it('a Celebrity Limit of 1000 followers skips their fan-out; each feed read merges one more read for the celebrity', () => {
    const s = at(design(1000), 10);
    expect(s.flow!.edge['wf>db']).toBeCloseTo(7 * 15); // only the normal accounts' posts are written
    expect(s.flow!.feedReadCost).toBe(2);
    expect(s.flow!.errors).toBe(0);
  });

  it('a limit under a normal account\'s followers skips everyone: back to fan-out on read, and the database is flooded by reads', () => {
    const s = at(design(10), 3);
    expect(s.flow!.fanOutOnWrite).toBe(false);
    expect(s.flow!.feedReadCost).toBe(20);
    expect(s.flow!.errors).toBeGreaterThan(0.3);
  });

  it('the limit is free and can change at any time; none removes it', () => {
    let s = at(design(), 2);
    s = setCelebrityLimit(s, 'wf', 1000);
    expect(s.buildings.find(b => b.id === 'wf')!.params.celebrityLimit).toBe(1000);
    expect(setCelebrityLimit(s, 'wf', 999)).toBe(s);
    expect(setCelebrityLimit(s, 'wf', undefined).buildings.find(b => b.id === 'wf')!.params.celebrityLimit).toBeUndefined();
  });
});

describe('events: a Worker instance that goes down makes its group rebalance; a spare instance takes over its Partitions', () => {
  // 10 posts/s over 3 Partitions; the first instance of the Notifications Worker goes down 10 s into the wave.
  const level: GameLevel = {
    allowedComponents: ['appServer', 'database', 'topic', 'worker'],
    componentOptions: { worker: { maxInstances: 4 }, topic: { limits: { partitions: 6 } } },
    requirements: { p95Ms: 300, maxErrorRate: 0.01 },
    play: { startMoney: 900, wave: { rps: 50, lengthS: 40, mix: { post: 0.2, readFeed: 0.8 } }, starMoney: [100, 200],
      subscriptions: { notifications: { maxLagS: 10 } }, incident: { atS: 10, componentType: 'worker' } },
  };
  const design = (instances: number): Design => ({
    components: [{ id: 'api', type: 'appServer' }, { id: 'db', type: 'database' }, { id: 't', type: 'topic', params: { partitions: 3 } }, { id: 'w', type: 'worker', params: { subscription: 'notifications', instances } }],
    connections: [['client', 'api'], ['api', 'db'], ['api', 't'], ['t', 'w']],
  });
  const at = (instances: number, seconds: number) => run(callNow(createGame(level, design(instances))), seconds, level);

  it('the group stops for 2 s: nothing is read, and posts wait', () => {
    const s = at(4, 11);
    expect(s.events.some(e => e.kind === 'rebalance' && e.id === 'w')).toBe(true);
    expect(s.flow!.subRelease['notifications'] ?? 0).toBe(0);
    expect(s.subBacklog['notifications']).toBeGreaterThan(5);
  });

  it('then the spare instance, idle until now, reads the Partition of the fallen one, and the group catches up', () => {
    const s = at(4, 25);
    expect(s.flow!.usable['w']).toBe(3);
    expect(s.subBacklog['notifications']).toBeLessThan(1);
    expect(s.reputation).toBe(100);
  });

  it('without a spare, two instances read three Partitions: one reads two and falls behind', () => {
    const s = at(3, 30);
    expect(s.subBacklog['notifications']).toBeGreaterThan(20);
  });
});
