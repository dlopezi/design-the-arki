import { ABUSIVE, catalog as defaultCatalog, DEFAULT_REQUEST_TYPE, FEED_WRITE, POST, READ_FEED } from '../catalog/catalog';
import type { Catalog } from '../catalog/types';

/**
 * The traffic model of real-time play (ADR-0005): each second, the users' requests follow the connections
 * through the buildings. A capacity model, not the event simulation: every component serves up to
 * `workers × 1000 / meanServiceMs` requests per second per instance, drops the rest, and gets slower as it fills.
 * All numbers come from the catalog, so the model knows no technology (ADR-0004).
 * A wave can mix Request Types (ADR-0006): each building sends each type only along the connections from which that
 * type can still be finished, and a type with nowhere to go is dropped.
 */

/** One running copy of a building; it serves only when built and not down. */
export type Instance = { buildLeftS: number; buildTotalS: number; down: boolean };
/** The Regions a design can have: the main one, and a standby the DNS switches to when the main one fails (ADR-0008). */
export const MAIN = 'main', STANDBY = 'standby';
/** The Region a building stands in: the main one unless it says otherwise. */
export const regionOf = (b: Pick<Building, 'region'>) => b.region ?? MAIN;
export type Building = { id: string; region?: string; type: string; params: { size?: string; ttlS?: number; shardKey?: string; limitRps?: number; subscription?: string; partitions?: number; partitionKey?: string; celebrityLimit?: number }; instances: Instance[] };
/** How traffic spreads over the values of each Shard Key: per key, the share of requests for each value (adds up to 1). */
export type ShardKeys = Record<string, number[]>;
/** Each value of a key lives on shard `value mod shards`; a Shard's share is the sum over its values. */
export function shardShares(weights: number[], shards: number): number[] {
  const shares = new Array<number>(shards).fill(0);
  weights.forEach((w, value) => { shares[value % shards]! += w; });
  return shares;
}
/** A building is (nearly) full from this share of its capacity, and has room under the second share: the load bars use the same two. */
export const FULL_LOAD = 0.9;
export const ROOMY_LOAD = 0.7;
/**
 * The Hot Shard among the loads of a building's Shards: the busiest one when it is (nearly) full while another still
 * has room, which is what a poor Shard Key does. When every Shard is full, the answer is more Shards, so none is hot.
 */
export function hotShardOf(loads: number[] | undefined): number | null {
  // The same rule finds the Hot Partition among the Partitions of a Topic (ADR-0009).
  if (!loads || loads.length < 2) return null;
  const busiest = Math.max(...loads);
  return busiest >= FULL_LOAD && Math.min(...loads) < ROOMY_LOAD ? loads.indexOf(busiest) : null;
}
/**
 * A building split into Shards (ADR-0007): the Shard Key sends each Shard its slice of `rps`, and a Shard serves only
 * its own slice, up to its capacity. A Shard that is down or still being built serves nothing, so a slice that reaches
 * it is lost (it counts as full). Returns each Shard's load (0–1) and the requests per second served in all.
 */
function serveShards(b: Building, rps: number, keys: ShardKeys, capacityPerShard: number): { loads: number[]; served: number } {
  const weights = keys[b.params.shardKey ?? ''] ?? Object.values(keys)[0]!; // the first key on offer is the default
  const slices = shardShares(weights, b.instances.length).map(share => rps * share);
  const loads = slices.map((slice, k) => (!slice ? 0 : isServing(b.instances[k]!) ? Math.min(1, slice / capacityPerShard) : 1));
  const served = slices.reduce((sum, slice, k) => sum + (isServing(b.instances[k]!) ? Math.min(slice, capacityPerShard) : 0), 0);
  return { loads, served };
}
/**
 * The news feed of a level (ADR-0009): the Subscription whose Workers write each post into every follower's feed, how many
 * followers an account has, and how many accounts a user follows.
 */
export type FeedModel = { subscription: string; followers: number; follows: number;
  /**
   * Celebrities: `share` of the posts arriving now are theirs (0 outside the celebrity's moment), each with `followers` followers;
   * a user follows `followed` of them, so a hybrid feed read merges that many more reads.
   */
  celebrity?: { share: number; followers: number; followed: number } };
/** A connection; `client` is the users on the Internet. */
export type Link = { from: string; to: string };

export const CLIENT = 'client';
export const linkKey = (l: Link) => `${l.from}>${l.to}`;
export const isServing = (i: Instance) => i.buildLeftS <= 0 && !i.down;

export type Flow = {
  rps: number;
  /** Requests answered per second (by a cache hit, a component that ends requests, or a queue that takes a job). */
  answered: number;
  /** Requests per second turned away on purpose (an invalid request refused by the gateway or the app server): not answered, and not errors. */
  rejected: number;
  /** Share of requests not answered, 0–1. */
  errors: number;
  /** Estimated 95th percentile latency, in ms. */
  p95: number;
  /** Requests per second reaching each building, dropped by it, and on each connection. */
  inflow: Record<string, number>;
  drop: Record<string, number>;
  edge: Record<string, number>;
  /** Share of capacity in use, 0–1, for the instances that receive traffic. */
  load: Record<string, number>;
  /** How many instances receive traffic: all serving ones behind a load balancer, otherwise one. */
  usable: Record<string, number>;
  /** Messages waiting in each queue after this step (ADR-0006). */
  backlog: Record<string, number>;
  /** Messages per second each queue released to its Workers in this step. */
  release: Record<string, number>;
  /** Messages per second the serving Workers behind each queue can take; 0 when none serves. */
  releaseCapacity: Record<string, number>;
  /** Writes each Read Replica still has to apply after this step, and how far behind the primary database that puts it, in seconds. */
  unapplied: Record<string, number>;
  lag: Record<string, number>;
  /** Share of capacity in use on each Shard (0–1), for each building that is split into several Shards. */
  shards: Record<string, number[]>;
  /**
   * Pub/sub (ADR-0009), per Subscription of the level: the posts it has not processed yet after this step (its Backlog), the posts
   * per second released to it, and the posts per second its serving Workers can take (0 when none serves).
   */
  subBacklog: Record<string, number>;
  subRelease: Record<string, number>;
  subCapacity: Record<string, number>;
  /** Share of capacity in use for each Partition of a Topic (0–1): the load of the busiest Worker instance that reads it, over every Subscription. */
  partitions: Record<string, number[]>;
  /** What waits in each Partition of a Topic for each Subscription after this step (`topicId|subscription`). */
  partBacklog: Record<string, number[]>;
  /** In a news-feed level: whether a Feed Worker writes the feeds ahead (fan-out on write), and what one feed read costs the database, in reads. */
  fanOutOnWrite: boolean;
  feedReadCost: number;
};
/** What lasts from one step to the next: the Messages waiting in each queue, and the length of the step in seconds. */
export type Queues = { backlog: Record<string, number>; dt: number;
  /** Writes each Read Replica has not applied yet (ADR-0007), kept from the step before like the Backlog. */
  unapplied?: Record<string, number>;
  /** The posts each Subscription has not processed yet (ADR-0009), kept from the step before like the Backlog. */
  subBacklog?: Record<string, number>;
  /** The same, in each Partition of a Topic: for `topicId|subscription`, what waits in each Partition. */
  partBacklog?: Record<string, number[]> };

/** How many Partitions a Topic has (none for any other building). */
export const partitionsOf = (b: Pick<Building, 'type' | 'params'>, catalog: Catalog = defaultCatalog) => {
  const spec = catalog[b.type]?.partitions;
  return spec ? Math.max(1, Math.round(Number(b.params.partitions ?? spec.defaultValue))) : 0;
};
const perInstance = (b: Building, catalog: Catalog) => {
  const spec = catalog[b.type]!;
  // A Topic costs a base price plus each of its Partitions.
  if (spec.partitions) return { workers: spec.workers, monthlyCost: spec.monthlyCost + spec.partitions.costEach * partitionsOf(b, catalog) };
  // A DNS costs more the shorter its TTL.
  if (spec.failover) return { workers: spec.workers, monthlyCost: spec.failover.monthlyCost[Number(b.params.ttlS ?? spec.failover.defaultValue)] ?? spec.monthlyCost };
  const size = b.params.size ?? spec.defaultSize;
  return size && spec.sizes?.[size] ? spec.sizes[size]! : { workers: spec.workers, monthlyCost: spec.monthlyCost };
};
/** Requests per second one instance can serve. */
export const capacityOf = (b: Building, catalog: Catalog = defaultCatalog) =>
  (perInstance(b, catalog).workers * 1000) / catalog[b.type]!.meanServiceMs;
/** Monthly cost of one instance at the building's size. */
export const instancePrice = (b: Pick<Building, 'type' | 'params'>, catalog: Catalog = defaultCatalog) =>
  perInstance({ id: '', instances: [], ...b }, catalog).monthlyCost;
/** Share of requests a cache answers, from its TTL: `value / (value + halfAt)`, up to `max`. */
export function hitRateOf(b: Building, catalog: Catalog = defaultCatalog): number {
  const shortcut = catalog[b.type]?.shortcut;
  if (!shortcut) return 0;
  const value = Number(b.params.ttlS ?? shortcut.defaultValue);
  return Math.min(shortcut.max, value / (value + shortcut.halfAt));
}

/** Work released by a queue is not the users' any more: the job was answered when it entered the queue. */
const BACKGROUND = '#bg';
const isBackground = (channel: string) => channel.endsWith(BACKGROUND);
const typeOfChannel = (channel: string) => (isBackground(channel) ? channel.slice(0, -BACKGROUND.length) : channel);

/**
 * Sends `rps` requests from the users through the buildings along the links. `mix` is the share of each Request Type
 * (adds up to 1); left out, all requests are one type that every building accepts, as in chapter 1. `queues` holds the
 * Backlog of each queue from the step before; the result holds it after this one. `subscriptions` are the systems that must
 * each process every post (ADR-0009): a post answered anywhere is owed to each of them until a Worker serving it processes it.
 */
export function solve(buildings: Building[], links: Link[], rps: number, catalog: Catalog = defaultCatalog,
  mix: Record<string, number> = { [DEFAULT_REQUEST_TYPE]: 1 }, queues: Queues = { backlog: {}, dt: 1 }, keys?: ShardKeys, clients?: Record<string, number>, regions?: { active: string },
  subscriptions: string[] = [], partitionKeys?: ShardKeys, feed?: FeedModel): Flow {
  const byId = new Map(buildings.map(b => [b.id, b]));
  const serving = (id: string) => byId.get(id)?.instances.filter(isServing).length ?? 0;
  const inflow: Record<string, number> = {}, drop: Record<string, number> = {}, edge: Record<string, number> = {};
  const load: Record<string, number> = {}, usable: Record<string, number> = {};
  const backlog: Record<string, number> = {}, release: Record<string, number> = {}, releaseCapacity: Record<string, number> = {};
  const shards: Record<string, number[]> = {};
  /** Writes per second each building served: what a Read Replica has to copy. */
  const writesServed: Record<string, number> = {};
  const add = (map: Record<string, number>, key: string, v: number) => { map[key] = (map[key] ?? 0) + v; };
  /**
   * Fan-out on write (ADR-0009): a Worker serving the feed's Subscription, fed posts and with a way to a building that stores feeds.
   * Without one, every feed read gathers the posts of each followed account (fan-out on read).
   */
  const feedWorker = feed ? buildings.find(b => b.params.subscription === feed.subscription && links.some(l => l.to === b.id)
    && links.some(l => l.from === b.id && !!catalog[byId.get(l.to)?.type ?? '']?.feedStore)) : undefined;
  // The Celebrity Limit: accounts above it are not fanned out on write. Set under a normal account's followers, nobody is.
  const celebrityLimit = feedWorker?.params.celebrityLimit ?? Infinity;
  const fanOutOnWrite = !!feedWorker && feed!.followers <= celebrityLimit;
  // A hybrid feed read also gathers the posts of the celebrities the user follows, which were not written into the feed.
  const mergedCelebrities = fanOutOnWrite && feed?.celebrity && feed.celebrity.followers > celebrityLimit ? feed.celebrity.followed : 0;
  const readCost = !feed ? 1 : fanOutOnWrite ? 1 + mergedCelebrities : feed.follows;
  const feedReadCost = (spec: Catalog[string]) => (feed && spec.feedStore ? readCost : 1);
  /** The capacity the requests reaching a building use, in normal requests per second: each Request Type weighs by its effort. */
  const demandOn = (id: string, spec: Catalog[string], requests: number) => {
    const weighted = Object.entries(inflowBy[id] ?? {}).reduce((sum, [channel, x]) => sum + x * (typeOfChannel(channel) === READ_FEED ? feedReadCost(spec) : spec.effort?.[typeOfChannel(channel)] ?? 1), 0);
    return weighted || requests; // no recorded traffic by type (nothing reached it): the plain request count
  };
  /** Whether a building is split into several Shards: a shardable one, with more than one instance, in a level that offers Shard Keys. */
  const isSharded = (b: Building) => !!catalog[b.type]?.shardable && !!keys && Object.keys(keys).length > 0 && b.instances.length > 1;
  let answered = 0, rejected = 0;
  /** Pub/sub (ADR-0009): posts per second answered in this step, and how many of them each Subscription processed. */
  let published = 0;
  const processed: Record<string, number> = {};
  const subRelease: Record<string, number> = {}, subCapacity: Record<string, number> = {};
  const partitionLoads: Record<string, number[]> = {}, partBacklog: Record<string, number[]> = {};
  const subBefore = (sub: string) => queues.subBacklog?.[sub] ?? 0;
  /** Requests dropped that were already answered by a queue: they are not the users' errors. */
  let lostInBackground = 0;

  // Behind a component that spreads requests (a load balancer, a queue) every serving instance works; otherwise only the first.
  // A building marked `balanced` (a Read Replica) is spread over by whoever calls it.
  for (const b of buildings) {
    const spread = catalog[b.type]?.balanced || links.some(l => l.to === b.id && l.from !== CLIENT && catalog[byId.get(l.from)?.type ?? '']?.distributes);
    // Shards each serve their own slice, so every serving one works.
    usable[b.id] = spread || isSharded(b) ? serving(b.id) : Math.min(1, serving(b.id));
  }
  // Links never make a circle (the game refuses them), so a depth-first order from the users is a valid order.
  const order: string[] = [], seen = new Set<string>();
  const visit = (id: string) => { if (seen.has(id)) return; seen.add(id); links.filter(l => l.from === id).forEach(l => visit(l.to)); order.unshift(id); };
  [CLIENT, ...buildings.map(b => b.id)].forEach(visit);

  // Request Types. A building accepts a type unless its catalog entry lists other types. A type can still be finished
  // from a building that accepts it and either leads nowhere (a dead end, as today) or leads on to a building that can
  // (a Worker turns a job into a result for the database). Only the connections decide, not which instances are serving,
  // so a single type that all accept never changes a route.
  const types = Object.keys(mix);
  const emitted = Object.values(catalog).flatMap(spec => (spec.emits ? [spec.emits] : []));
  // A channel is a type of request, for the users (`job`) or released by a queue (`job#bg`).
  const channels = [...new Set([...types, ...emitted, ...(feed ? [FEED_WRITE] : [])])].flatMap(t => [t, t + BACKGROUND]);
  const specOf = (id: string) => catalog[byId.get(id)?.type ?? ''];
  const accepts = (id: string, type: string) => { const list = specOf(id)?.accepts; return !list || list.includes(type); };
  const finishable = new Map<string, boolean>();
  const canFinish = (id: string, type: string): boolean => {
    const key = `${id}|${type}`;
    if (!finishable.has(key)) {
      finishable.set(key, false); // guards against a circle
      const out = links.filter(l => l.from === id), next = specOf(id)?.emits ?? type;
      finishable.set(key, accepts(id, type) && (!!specOf(id)?.rejects?.includes(type) || !!specOf(id)?.ends?.includes(type) || !out.length || out.some(l => canFinish(l.to, next))));
    }
    return finishable.get(key)!;
  };
  /** Requests per second of each channel reaching each building. */
  const inflowBy: Record<string, Record<string, number>> = {};
  const send = (from: string, channel: string, amount: number) => {
    const type = typeOfChannel(channel);
    // A DNS sends the users to one Region only: the active one, even when it is dead (the requests then fail until it switches).
    const regional = !!specOf(from)?.failover && !!regions;
    const open = links.filter(l => l.from === from && usable[l.to] && (!regional || regionOf(byId.get(l.to) ?? {}) === regions!.active));
    // Where the type can be finished; if nowhere, it still goes to a building that accepts it and is dropped there,
    // so the error shows at the building that has nowhere to send it (as a dead end does today).
    let targets = open.filter(l => canFinish(l.to, type)).map(l => l.to);
    if (!targets.length) targets = open.filter(l => accepts(l.to, type)).map(l => l.to);
    // A building that prefers this type (a Read Replica for reads) gets it before the others that also accept it.
    const preferred = targets.filter(to => specOf(to)?.prefers?.includes(type));
    if (preferred.length) targets = preferred;
    if (!targets.length) { add(drop, from, amount); if (isBackground(channel)) lostInBackground += amount; return; }
    for (const to of targets) {
      add(edge, `${from}>${to}`, amount / targets.length); add(inflow, to, amount / targets.length);
      add((inflowBy[to] ??= {}), channel, amount / targets.length);
    }
  };
  inflow[CLIENT] = rps;
  for (const id of order) {
    const f = inflow[id] ?? 0;
    // A Topic still has posts to release while any Subscription has a Backlog, even after the users are gone.
    const waiting = specOf(id)?.queue ? queues.backlog[id] ?? 0 : specOf(id)?.pubSub ? Math.max(0, ...subscriptions.map(subBefore)) : 0;
    if (!f && !waiting) continue;
    if (id === CLIENT) { for (const t of types) send(id, t, rps * mix[t]!); continue; }
    const b = byId.get(id)!, spec = catalog[b.type]!;
    const capacity = usable[id]! * capacityOf(b, catalog);
    // The busiest Shard sets the load and latency of a building split into Shards.
    const split = isSharded(b) ? serveShards(b, f, keys!, capacityOf(b, catalog)) : null;
    if (split) shards[id] = split.loads;
    // Some Request Types keep a building busy longer than a normal request (an upload on an app server): they weigh by their effort.
    const demand = demandOn(id, spec, f);
    const ok = split ? split.served : demand > capacity + 1e-9 ? (f * capacity) / demand : f;
    load[id] = split ? Math.max(...split.loads) : capacity ? Math.min(1, demand / capacity) : 1;
    add(drop, id, f - ok);
    // What gets in is a share of each channel, the same share for all.
    const taken = (c: string) => { const x = inflowBy[id]?.[c] ?? 0; return x === f ? ok : (x * ok) / f; };
    if (inflowBy[id]?.['write']) writesServed[id] = taken('write');
    for (const c of channels) if (isBackground(c) && inflowBy[id]?.[c]) lostInBackground += inflowBy[id]![c]! - taken(c);
    if (spec.pubSub) {
      // A post is answered when it enters the Topic. Every Subscription gets its own copy: the Topic releases to the Workers that
      // serve it, at their total capacity, and what they cannot take yet waits in that Subscription's Backlog (ADR-0009).
      answered += ok; published += ok;
      const type = spec.accepts?.[0] ?? DEFAULT_REQUEST_TYPE;
      const dt = queues.dt || 1;
      // Partitions: each one is read by one Worker instance of a Subscription at a time, so a Subscription uses at most as many
      // instances as there are Partitions, and Partition p goes to working instance p mod n. Each Subscription keeps its own place
      // in each Partition, so a post waits in its own Partition: a busy one cannot be emptied by the instances of the others (ADR-0009).
      const count = Math.max(1, partitionsOf(b, catalog));
      // The Partition Key spreads the posts over the Partitions as a Shard Key spreads data over Shards: a poor key makes a Hot Partition.
      const keyWeights = partitionKeys && Object.keys(partitionKeys).length ? partitionKeys[b.params.partitionKey ?? ''] ?? Object.values(partitionKeys)[0]! : null;
      const shares = keyWeights ? shardShares(keyWeights, count) : new Array<number>(count).fill(1 / count);
      const loads = shares.map(() => 0);
      for (const sub of subscriptions) {
        const takers = links.filter(l => l.from === id && usable[l.to] && byId.get(l.to)?.params.subscription === sub && canFinish(l.to, type));
        // The working instances of the Subscription, in order, each with its capacity and the Worker building it belongs to.
        const working: { link: Link; capacity: number }[] = [];
        for (const l of takers) {
          const n = Math.min(usable[l.to]!, Math.max(0, count - working.length));
          usable[l.to] = n; // the instances left without a Partition stay idle
          for (let k = 0; k < n; k++) working.push({ link: l, capacity: capacityOf(byId.get(l.to)!, catalog) });
        }
        const owner = (p: number) => (working.length ? p % working.length : -1);
        // What waits in each Partition for this Subscription (spread by the key the first time, or after the Partitions changed).
        const kept = queues.partBacklog?.[`${id}|${sub}`];
        const waitingIn = kept?.length === count ? [...kept] : shares.map(share => subBefore(sub) * share);
        const offeredIn = shares.map((share, p) => share * ok + waitingIn[p]! / dt);
        const releasedIn = shares.map(() => 0);
        working.forEach((w, i) => {
          const mine = shares.map((_, p) => p).filter(p => owner(p) === i);
          const asked = mine.reduce((sum, p) => sum + offeredIn[p]!, 0);
          const done = Math.min(asked, w.capacity);
          for (const p of mine) releasedIn[p] = asked ? (offeredIn[p]! * done) / asked : 0;
          // An instance's load is the posts arriving in its Partitions over what it can take.
          const arriving = mine.reduce((sum, p) => sum + shares[p]! * ok, 0);
          for (const p of mine) loads[p] = Math.max(loads[p]!, Math.min(1, arriving / w.capacity));
        });
        if (!working.length) shares.forEach((share, p) => { if (share > 0 && ok > 0) loads[p] = 1; });
        const after = shares.map((share, p) => Math.max(0, waitingIn[p]! + (share * ok - releasedIn[p]!) * dt));
        partBacklog[`${id}|${sub}`] = after;
        subRelease[sub] = releasedIn.reduce((a, v) => a + v, 0);
        // The rate for the Consumer Lag: so that the Backlog over it is the time the slowest instance needs to empty its Partitions, and with
        // nothing waiting, the throughput at which the busiest instance is full.
        // An instance empties all its Partitions at its capacity; a Partition with no instance never empties.
        const unread = after.some((x, p) => x > 0 && owner(p) < 0);
        const worst = unread ? Infinity : Math.max(0, ...working.map((w, i) => after.reduce((sum, x, p) => sum + (owner(p) === i ? x : 0), 0) / w.capacity));
        const total = after.reduce((a, v) => a + v, 0);
        const busiest = working.length ? Math.min(...working.map((w, i) => { const share = shares.reduce((sum, x, p) => sum + (owner(p) === i ? x : 0), 0); return share > 0 ? w.capacity / share : Infinity; })) : 0;
        subCapacity[sub] = !working.length ? 0 : total > 0 && Number.isFinite(worst) && worst > 0 ? total / worst : Number.isFinite(busiest) ? busiest : working.reduce((a, w) => a + w.capacity, 0);
        // Each Worker building of the Subscription gets what its instances released.
        const byLink = new Map<Link, number>();
        shares.forEach((_, p) => { if (owner(p) >= 0 && releasedIn[p]) byLink.set(working[owner(p)]!.link, (byLink.get(working[owner(p)]!.link) ?? 0) + releasedIn[p]!); });
        byLink.forEach((amount, l) => { add(edge, linkKey(l), amount); add(inflow, l.to, amount); add((inflowBy[l.to] ??= {}), type + BACKGROUND, amount); });
      }
      partitionLoads[id] = loads;
      continue;
    }
    if (spec.queue) {
      // A job is answered when it enters the queue; the queue then releases Messages to its Workers at their total
      // capacity, and what is not released stays in the Backlog until the next step.
      answered += ok;
      if (inflowBy[id]?.[POST]) published += taken(POST);
      // The queue carries the type the wave sends it (jobs, or posts in a level that lets the player try a queue for pub/sub).
      const type = spec.accepts?.find(a => types.includes(a)) ?? spec.accepts?.[0] ?? DEFAULT_REQUEST_TYPE;
      const takers = links.filter(l => l.from === id && usable[l.to] && canFinish(l.to, type));
      const rate = takers.reduce((sum, l) => sum + usable[l.to]! * capacityOf(byId.get(l.to)!, catalog), 0);
      const dt = queues.dt || 1;
      releaseCapacity[id] = rate;
      release[id] = Math.min(ok + waiting / dt, rate);
      backlog[id] = Math.max(0, waiting + (ok - release[id]!) * dt);
      if (release[id]! > 0) send(id, type + BACKGROUND, release[id]!);
      continue;
    }
    const hit = spec.shortcut ? hitRateOf(b, catalog) : 0;
    for (const c of channels) {
      if (!inflowBy[id]?.[c]) continue;
      const out = spec.emits ? spec.emits + (isBackground(c) ? BACKGROUND : '') : c;
      // A building that turns this type away answers with a refusal: the request goes no further and is no error.
      if (spec.rejects?.includes(typeOfChannel(c))) { rejected += taken(c); continue; }
      // A building that finishes this type itself (a Worker sending a notification) answers it here; the work leaves the system.
      // A post processed by a Worker counts for the Subscription that Worker serves (ADR-0009).
      if (spec.ends?.includes(typeOfChannel(c))) {
        if (!isBackground(c)) { answered += taken(c); if (typeOfChannel(c) === POST) published += taken(c); }
        const sub = b.params.subscription;
        if (sub) processed[sub] = (processed[sub] ?? 0) + taken(c);
        // A Feed Worker writes the post into the feed of every follower: background work, never the users' own requests.
        if (feed && sub === feed.subscription && typeOfChannel(c) === POST) {
          // Each post goes into its followers' feeds, unless its account has more followers than the Celebrity Limit.
          const limit = b.params.celebrityLimit ?? Infinity, c0 = feed.celebrity?.share ?? 0;
          const perPost = (1 - c0) * (feed.followers <= limit ? feed.followers : 0) + c0 * (feed.celebrity && feed.celebrity.followers <= limit ? feed.celebrity.followers : 0);
          if (perPost > 0) send(id, FEED_WRITE + BACKGROUND, taken(c) * perPost);
        }
        continue;
      }
      // A Client Limit passes at most so many requests per second for each client of a type the level counts clients for.
      let amount = taken(c);
      const type = typeOfChannel(c), count = clients?.[type];
      if (spec.clientLimit && count && !isBackground(c)) {
        const limit = Number(b.params.limitRps ?? spec.clientLimit.defaultValue);
        const over = Math.max(0, amount - limit * count);
        amount -= over;
        // What an abusive client sent above the limit is turned away; what a normal client sent above it is an error (a false positive).
        if (type === ABUSIVE) rejected += over; else add(drop, id, over);
      }
      if (spec.shortcut) { if (!isBackground(c)) answered += taken(c) * hit; send(id, out, taken(c) - taken(c) * hit); }
      else if (spec.endsRequests) { if (!isBackground(c)) answered += taken(c); }
      else send(id, out, amount);
    }
  }
  // A queue that no traffic reached still keeps its Messages.
  for (const b of buildings) if (specOf(b.id)?.queue && backlog[b.id] === undefined) backlog[b.id] = queues.backlog[b.id] ?? 0;
  // A Message a Worker or the database could not take goes back to its queue to be delivered again: none is ever lost.
  const queueIds = Object.keys(backlog);
  if (lostInBackground > 0 && queueIds.length) {
    for (const id of queueIds) {
      const back = lostInBackground / queueIds.length;
      backlog[id]! += back * (queues.dt || 1);
      if (release[id] !== undefined) release[id] = Math.max(0, release[id]! - back);
    }
  }

  // Each Subscription owes every post answered in this step, and has caught up with those its Workers processed (ADR-0009).
  // A post a Message Queue gave to another Subscription's Worker never reaches this one, so its Backlog grows.
  const subBacklog: Record<string, number> = {};
  for (const sub of subscriptions) subBacklog[sub] = Math.max(0, subBefore(sub) + (published - (processed[sub] ?? 0)) * (queues.dt || 1));

  // Replication Lag (ADR-0007): each Read Replica must apply every write the database it follows has served. Writes it cannot
  // apply as fast as they come pile up, and the pile is how far behind it is. Under the pile it is zero; no replica, no lag.
  const unapplied: Record<string, number> = {}, lag: Record<string, number> = {};
  for (const b of buildings) {
    const spec = catalog[b.type];
    if (!spec?.follows) continue;
    const source = links.find(l => l.from === b.id && byId.get(l.to)?.type === spec.follows)?.to;
    if (!source) continue;
    // A replica that is not serving yet (still being built, or down) is not copying anything: the pile stays as it was.
    const applies = serving(b.id) > 0 ? (spec.applyShare ?? 0) * capacityOf(b, catalog) : 0;
    const before = queues.unapplied?.[b.id] ?? 0;
    unapplied[b.id] = applies > 0 ? Math.max(0, before + ((writesServed[source] ?? 0) - applies) * (queues.dt || 1)) : before;
    lag[b.id] = applies > 0 ? unapplied[b.id]! / applies : 0;
  }

  // Latency: each component adds its service time, longer as it fills; the tail follows the slowest busy path.
  // A queue answers at once, so the time its Workers take is not the users' wait.
  const own = (id: string) => {
    const b = byId.get(id); if (!b) return 0;
    return (catalog[b.type]!.meanServiceMs / (1 - Math.min(0.97, load[id] ?? 0))) * 1.4;
  };
  const latency: Record<string, number> = {};
  for (const id of [...order].reverse()) {
    const busy = specOf(id)?.queue || specOf(id)?.pubSub ? [] : links.filter(l => l.from === id && (edge[linkKey(l)] ?? 0) > (inflow[id] || 1) * 0.05);
    latency[id] = own(id) + Math.max(0, ...busy.map(l => latency[l.to] ?? 0));
  }
  const dropped = Object.values(drop).reduce((a, v) => a + v, 0);
  return {
    rps, answered, rejected, inflow, drop, edge, load, usable, backlog, release, releaseCapacity, shards, unapplied, lag, subBacklog, subRelease, subCapacity, partitions: partitionLoads, partBacklog, fanOutOnWrite, feedReadCost: readCost,
    errors: rps ? Math.min(1, (dropped - lostInBackground) / rps) : 0,
    p95: rps ? Math.min(2000, Math.round(latency[CLIENT] ?? 0)) : 0,
  };
}
