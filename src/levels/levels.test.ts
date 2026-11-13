import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { designCost } from '../engine/simulate';
import { hotShardOf } from '../realtime/flow';
import { callNow, createGame, run, runToEnd, starsOf } from '../realtime/game';
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
  it('ships the 8 levels of chapter 1, then the Async chapter, then the Data scale chapter, in order', () => {
    expect(allLevels().map(l => l.id)).toEqual(['01-hello-world', '02-first-spike', '03-bigger-or-more', '04-flash-sale', '05-popular-content', '06-server-goes-down', '07-tight-budget', '08-black-friday', '09-slow-processing', '10-watch-and-upload', '11-upload-rush', '12-worker-goes-down', '13-fresh-videos', '14-launch-day', '15-too-many-reads', '16-just-saved-not-there', '17-too-much-to-write', '18-hot-shard', '19-big-uploads', '20-release-day']);
    expect(allLevels('en').find(l => l.id === '15-too-many-reads')!.chapter).toBe('Data scale');
  });

  for (const level of allLevels()) {
    it(`${level.id}: its reference design, bought at the start, lasts the wave: 2 stars, and all 3 when the users are called early`, () => {
      const bought = () => { const s = createGame(level, level.referenceDesign); return { ...s, money: s.money - designCost(level.referenceDesign) }; };
      const plain = runToEnd(bought(), level);
      expect(plain.phase).toBe('won');
      expect(starsOf(plain, level)).toBe(2);
      const early = runToEnd(callNow(run(bought(), 10, level)), level);
      expect(starsOf(early, level)).toBe(3);
    });

    it(`${level.id}: its reference design only uses the level's allowed components`, () => {
      const used = level.referenceDesign.components.map(c => c.type);
      expect(used.filter(type => !level.allowedComponents.includes(type))).toEqual([]);
    });

    for (const mode of ['guided', 'normal', 'hard'] as const) {
      it(`${level.id}: its ${mode} starting design, left as it is, does not win`, () => {
        expect(runToEnd(createGame(level, level.startingDesigns[mode]), level).phase).toBe('lost');
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

  describe('wave mix of Request Types', () => {
    const base = allLevels('en').find(l => l.id === '09-slow-processing')!;
    const withMix = (mix: unknown) => ({ ...base, play: { ...base.play, wave: { ...base.play.wave, mix } } });

    it('accepts a mix whose shares add up to 1', () => {
      expect(parseLevel(withMix({ watch: 0.7, job: 0.3 })).play.wave.mix).toEqual({ watch: 0.7, job: 0.3 });
    });

    it('ignores a tiny rounding error in the sum', () => {
      expect(() => parseLevel(withMix({ watch: 0.1 + 0.2, job: 0.7 }))).not.toThrow(); // 0.30000000000000004 + 0.7
    });

    it('rejects a mix that does not add up to 1', () => {
      expect(() => parseLevel(withMix({ watch: 0.5, job: 0.3 }))).toThrow(/must add up to 1/);
    });

    it('rejects an empty mix, a share of 0 and an unknown Request Type', () => {
      expect(() => parseLevel(withMix({}))).toThrow(/at least one/);
      expect(() => parseLevel(withMix({ watch: 1, job: 0 }))).toThrow(/mix/);
      expect(() => parseLevel(withMix({ watch: 0.5, telepathy: 0.5 }))).toThrow(/Unknown Request Type: telepathy/);
    });

    it('is optional: the levels of chapter 1 have none', () => {
      expect(allLevels('en').filter(l => l.chapter === 'Core').every(l => l.play.wave.mix === undefined)).toBe(true);
    });

    it('accepts reads, writes and Read-your-writes as Request Types', () => {
      expect(parseLevel(withMix({ read: 0.9, write: 0.1 })).play.wave.mix).toEqual({ read: 0.9, write: 0.1 });
      expect(parseLevel(withMix({ read: 0.5, readYourWrites: 0.4, write: 0.1 })).play.wave.mix).toEqual({ read: 0.5, readYourWrites: 0.4, write: 0.1 });
    });

    it('needs the primary database in a level that allows a Read Replica', () => {
      const data = allLevels('en').find(l => l.id === '15-too-many-reads')!;
      expect(() => parseLevel({ ...data, allowedComponents: ['loadBalancer', 'appServer', 'readReplica'] })).toThrow(/readReplica must allow a database/);
    });

    it('needs a message queue and a worker in a level whose wave has jobs', () => {
      expect(() => parseLevel({ ...base, allowedComponents: ['appServer', 'database'] })).toThrow(/must allow a messageQueue and a worker/);
      expect(() => parseLevel({ ...base, allowedComponents: ['appServer', 'database', 'messageQueue'] })).toThrow(/messageQueue and a worker/);
    });

    it('needs a maximum Queue Age in a level that allows a message queue', () => {
      const { maxQueueAgeS: _gone, ...requirements } = base.requirements;
      expect(() => parseLevel({ ...base, requirements })).toThrow(/maximum Queue Age/);
      expect(parseLevel({ ...base, requirements: { ...requirements, maxQueueAgeS: 12 } }).requirements.maxQueueAgeS).toBe(12);
    });
  });

  it('14-launch-day: the chapter review needs a load balancer in front of several app servers and a cache for watches', () => {
    const level = allLevels('en').find(l => l.id === '14-launch-day')!;
    const ref = level.referenceDesign;
    expect(ref.components.find(c => c.type === 'loadBalancer')).toBeDefined();
    expect(Number(ref.components.find(c => c.type === 'appServer')!.params?.instances)).toBeGreaterThan(1);
    expect(ref.components.find(c => c.type === 'cache')).toBeDefined();
    const without = (type: string, bypass: [string, string]) => ({
      components: ref.components.filter(c => c.type !== type),
      connections: [...ref.connections.filter(([a, b]) => ![a, b].some(id => ref.components.find(c => c.id === id)?.type === type)), bypass] as [string, string][],
    });
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level).phase;
    expect(play(ref)).toBe('won');
    expect(play(without('loadBalancer', ['client', 'api']))).toBe('lost');
    expect(play(without('cache', ['api', 'db']))).toBe('lost');
    expect(play({ ...ref, components: ref.components.map(c => (c.type === 'appServer' ? { ...c, params: {} } : c)) })).toBe('lost'); // one app server
  });

  describe('15-too-many-reads: Read Replicas scale reads, not writes', () => {
    const level = allLevels('en').find(l => l.id === '15-too-many-reads')!;
    const ref = level.referenceDesign;
    const isReplica = (id: string) => ref.components.find(c => c.id === id)?.type === 'readReplica';
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level);
    const replicas = (n: number) => ({ ...ref, components: ref.components.map(c => (c.type === 'readReplica' ? { ...c, params: { ...c.params, instances: n } } : c)) });

    it('wins with Read Replicas and loses with the primary database alone, which is full of reads', () => {
      expect(play(ref).phase).toBe('won');
      const alone = { components: ref.components.filter(c => c.type !== 'readReplica'), connections: ref.connections.filter(([a, b]) => !isReplica(a) && !isReplica(b)) };
      expect(play(alone).phase).toBe('lost');
    });

    it('needs enough replica instances: one is too few for the reads', () => {
      expect(play(replicas(1)).phase).toBe('lost');
      expect(play(replicas(2)).phase).toBe('won');
    });
  });

  describe('16-just-saved-not-there: a replica is behind, so Read-your-writes goes to the primary', () => {
    const level = allLevels('en').find(l => l.id === '16-just-saved-not-there')!;
    const ref = level.referenceDesign;
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level);
    const links = (pairs: [string, string][]) => ({ ...ref, connections: pairs });

    it('wins when the app server reaches both the Read Replicas and the primary database', () => {
      expect(play(ref).phase).toBe('won');
    });

    it('loses when the app server reaches only the Read Replicas: the primary database gets none of the traffic', () => {
      const replicaOnly = ref.connections.filter(([a, b]) => !(a === 'api' && b === 'db'));
      expect(play(links(replicaOnly)).phase).toBe('lost');
    });

    it('loses with no Read Replica: the primary database takes every read', () => {
      const bare = { components: ref.components.filter(c => c.type !== 'readReplica'), connections: ref.connections.filter(([a, b]) => a !== 'replicas' && b !== 'replicas') };
      expect(play(bare).phase).toBe('lost');
    });
  });

  describe('Shard Keys in a level file', () => {
    const base = allLevels('en').find(l => l.id === '17-too-much-to-write')!;
    const withKeys = (shardKeys: unknown) => ({ ...base, play: { ...base.play, shardKeys } });

    it('accepts keys whose shares add up to 1', () => {
      expect(parseLevel(withKeys({ userId: [0.5, 0.5], country: [0.8, 0.1, 0.1] })).play.shardKeys!.country).toEqual([0.8, 0.1, 0.1]);
    });

    it('rejects a key whose shares do not add up to 1, an empty key and a share of 0 or less', () => {
      expect(() => parseLevel(withKeys({ userId: [0.5, 0.3] }))).toThrow(/must add up to 1/);
      expect(() => parseLevel(withKeys({ userId: [] }))).toThrow(/Shard Key/);
      expect(() => parseLevel(withKeys({ userId: [1, 0] }))).toThrow(/Shard Key/);
    });

    it('needs a database in a level that offers Shard Keys, and at least one key', () => {
      expect(() => parseLevel({ ...withKeys({ userId: [0.5, 0.5] }), allowedComponents: ['loadBalancer', 'appServer'] })).toThrow(/must allow a database/);
      expect(() => parseLevel(withKeys({}))).toThrow(/at least one/);
    });

    it('rejects a design that sets a Shard Key the level does not offer', () => {
      const design = { components: [{ id: 'db', type: 'database', params: { instances: 2, shardKey: 'nope' } }], connections: [['client', 'db']] };
      expect(() => parseLevel({ ...base, referenceDesign: design })).toThrow(/Shard Key "nope" is not on offer/);
      expect(() => parseLevel({ ...base, startingDesigns: { ...base.startingDesigns, hard: design } })).toThrow(/Shard Key "nope" is not on offer/);
    });

    it('is optional: levels of chapters 1 and 2 have none', () => {
      expect(allLevels('en').filter(l => l.chapter === 'Core' || l.chapter === 'Async').every(l => l.play.shardKeys === undefined)).toBe(true);
    });
  });

  describe('17-too-much-to-write: one database cannot take the writes, so add Shards', () => {
    const level = allLevels('en').find(l => l.id === '17-too-much-to-write')!;
    const ref = level.referenceDesign;
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level).phase;
    const shards = (n: number) => ({ ...ref, components: ref.components.map(c => (c.type === 'database' ? { ...c, params: { ...c.params, instances: n } } : c)) });

    it('wins with enough Shards, and loses with one database or with too few Shards', () => {
      expect(play(ref)).toBe('won');
      expect(play(shards(1))).toBe('lost');
      expect(play(shards(2))).toBe('lost');
    });
  });

  describe('18-hot-shard: a poor Shard Key makes a Hot Shard, and more Shards do not fix it', () => {
    const level = allLevels('en').find(l => l.id === '18-hot-shard')!;
    const ref = level.referenceDesign;
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level).phase;
    const withDatabase = (params: Record<string, unknown>) => ({ ...ref, components: ref.components.map(c => (c.type === 'database' ? { ...c, params } : c)) });

    it('wins with an even Shard Key, and loses with a skewed one', () => {
      expect(play(ref)).toBe('won');
      expect(play(withDatabase({ instances: 3, shardKey: 'country' }))).toBe('lost');
      expect(play(withDatabase({ instances: 3, shardKey: 'date' }))).toBe('lost');
    });

    it('a skewed key fills one Shard while the others have room', () => {
      const loads = run(callNow(createGame(level, withDatabase({ instances: 3, shardKey: 'country' }))), 5, level).flow!.shards.db!;
      expect(hotShardOf(loads)).toBe(0);
    });

    it('is not fixed by adding Shards while the key stays skewed', () => {
      expect(play(withDatabase({ instances: 4, shardKey: 'country' }))).toBe('lost');
    });
  });

  describe('19-big-uploads: files go straight to Object Storage, not through the app server', () => {
    const level = allLevels('en').find(l => l.id === '19-big-uploads')!;
    const ref = level.referenceDesign;
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level).phase;
    const storageId = ref.components.find(c => c.type === 'objectStorage')!.id;
    const withoutDirect = { ...ref, connections: ref.connections.filter(([a, b]) => !(a === 'client' && b === storageId)) };

    it('wins when the users upload straight to Object Storage', () => {
      expect(play(ref)).toBe('won');
      expect(ref.connections).toContainEqual(['client', storageId]);
    });

    it('loses when the files go through the app servers, even with every app server the level allows', () => {
      expect(play(withoutDirect)).toBe('lost');
      const maxApps = level.componentOptions.appServer!.maxInstances!;
      const bigger = { ...withoutDirect, components: withoutDirect.components.map(c => (c.type === 'appServer' ? { ...c, params: { instances: maxApps } } : c)) };
      expect(play(bigger)).toBe('lost');
    });

    it('loses with no Object Storage at all: the files have nowhere to go', () => {
      const none = { components: ref.components.filter(c => c.type !== 'objectStorage'), connections: ref.connections.filter(([a, b]) => a !== storageId && b !== storageId) };
      expect(play(none)).toBe('lost');
    });
  });

  describe('20-release-day: the chapter review, with a maximum Replication Lag', () => {
    const level = allLevels('en').find(l => l.id === '20-release-day')!;
    const ref = level.referenceDesign;
    const play = (design: typeof ref) => runToEnd(callNow(createGame(level, design)), level).phase;
    const without = (type: string) => ({ components: ref.components.filter(c => c.type !== type), connections: ref.connections.filter(([a, b]) => ![a, b].some(id => ref.components.find(c => c.id === id)?.type === type)) });
    const replicaSize = (size: string) => ({ ...ref, components: ref.components.map(c => (c.type === 'readReplica' ? { ...c, params: { ...c.params, size } } : c)) });

    it('uses buildings of chapters 1, 2 and 3 together', () => {
      const types = ref.components.map(c => c.type);
      for (const type of ['loadBalancer', 'appServer', 'cache', 'database', 'messageQueue', 'worker', 'readReplica', 'objectStorage']) expect(types).toContain(type);
      expect(level.requirements.maxReplicationLagS).toBeGreaterThan(0);
    });

    it('wins with the Reference Design', () => {
      expect(play(ref)).toBe('won');
    });

    it('loses when the Read Replica is too small to apply the writes: the Replication Lag passes its maximum', () => {
      expect(play(replicaSize('small'))).toBe('lost');
    });

    it('loses when any one part of the review is missing', () => {
      for (const type of ['readReplica', 'messageQueue', 'objectStorage']) expect(play(without(type)), type).toBe('lost');
    });
  });

  it('13-fresh-videos: fewer Workers are cheaper but let the Queue Age pass its maximum, which costs reputation', () => {
    const level = allLevels('en').find(l => l.id === '13-fresh-videos')!;
    const withWorkers = (n: number) => runToEnd(callNow(createGame(level, { ...level.referenceDesign, components: level.referenceDesign.components.map(c => (c.type === 'worker' ? { ...c, params: { instances: n } } : c)) })), level);
    const enough = withWorkers(3), few = withWorkers(2);
    expect(enough.reputation).toBe(100);
    expect(few.reputation).toBeLessThan(enough.reputation);
  });

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
