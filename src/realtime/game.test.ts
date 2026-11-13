import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import { BUILD_PHASE_S, PASSIVE_INCOME, build, callNow, connect, createGame, demolish, disconnect, resize, run, setShardKey, starsOf, toDesign, type GameLevel, type GameState } from './game';

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
