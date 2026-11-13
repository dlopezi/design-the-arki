import { catalog as defaultCatalog, DEFAULT_REQUEST_TYPE } from '../catalog/catalog';
import type { Catalog } from '../engine/types';

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
export type Building = { id: string; type: string; params: { size?: string; ttlS?: number; shardKey?: string }; instances: Instance[] };
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
/** A connection; `client` is the users on the Internet. */
export type Link = { from: string; to: string };

export const CLIENT = 'client';
export const linkKey = (l: Link) => `${l.from}>${l.to}`;
export const isServing = (i: Instance) => i.buildLeftS <= 0 && !i.down;

export type Flow = {
  rps: number;
  /** Requests answered per second (by a cache hit, a component that ends requests, or a queue that takes a job). */
  answered: number;
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
  /** Share of capacity in use on each Shard (0–1), for each building that is split into several Shards. */
  shards: Record<string, number[]>;
};
/** What lasts from one step to the next: the Messages waiting in each queue, and the length of the step in seconds. */
export type Queues = { backlog: Record<string, number>; dt: number };

const perInstance = (b: Building, catalog: Catalog) => {
  const spec = catalog[b.type]!;
  const size = b.params.size ?? spec.defaultSize;
  return size && spec.sizes?.[size] ? spec.sizes[size]! : { workers: spec.workers, monthlyCost: spec.monthlyCost };
};
/** Requests per second one instance can serve. */
export const capacityOf = (b: Building, catalog: Catalog = defaultCatalog) =>
  (perInstance(b, catalog).workers * 1000) / catalog[b.type]!.meanServiceMs;
/** Monthly cost of one instance at the building's size. */
export const instancePrice = (b: Pick<Building, 'type' | 'params'>, catalog: Catalog = defaultCatalog) =>
  perInstance({ id: '', instances: [], ...b }, catalog).monthlyCost;
/** Share of requests a cache answers, from its TTL (same rule as the engine's shortcut). */
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
 * Backlog of each queue from the step before; the result holds it after this one.
 */
export function solve(buildings: Building[], links: Link[], rps: number, catalog: Catalog = defaultCatalog,
  mix: Record<string, number> = { [DEFAULT_REQUEST_TYPE]: 1 }, queues: Queues = { backlog: {}, dt: 1 }, keys?: ShardKeys): Flow {
  const byId = new Map(buildings.map(b => [b.id, b]));
  const serving = (id: string) => byId.get(id)?.instances.filter(isServing).length ?? 0;
  const inflow: Record<string, number> = {}, drop: Record<string, number> = {}, edge: Record<string, number> = {};
  const load: Record<string, number> = {}, usable: Record<string, number> = {};
  const backlog: Record<string, number> = {}, release: Record<string, number> = {}, releaseCapacity: Record<string, number> = {};
  const shards: Record<string, number[]> = {};
  const add = (map: Record<string, number>, key: string, v: number) => { map[key] = (map[key] ?? 0) + v; };
  /** The capacity the requests reaching a building use, in normal requests per second: each Request Type weighs by its effort. */
  const demandOn = (id: string, spec: Catalog[string], requests: number) => {
    const weighted = Object.entries(inflowBy[id] ?? {}).reduce((sum, [channel, x]) => sum + x * (spec.effort?.[typeOfChannel(channel)] ?? 1), 0);
    return weighted || requests; // no recorded traffic by type (nothing reached it): the plain request count
  };
  /** Whether a building is split into several Shards: a shardable one, with more than one instance, in a level that offers Shard Keys. */
  const isSharded = (b: Building) => !!catalog[b.type]?.shardable && !!keys && Object.keys(keys).length > 0 && b.instances.length > 1;
  let answered = 0;
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
  const channels = [...new Set([...types, ...emitted])].flatMap(t => [t, t + BACKGROUND]);
  const specOf = (id: string) => catalog[byId.get(id)?.type ?? ''];
  const accepts = (id: string, type: string) => { const list = specOf(id)?.accepts; return !list || list.includes(type); };
  const finishable = new Map<string, boolean>();
  const canFinish = (id: string, type: string): boolean => {
    const key = `${id}|${type}`;
    if (!finishable.has(key)) {
      finishable.set(key, false); // guards against a circle
      const out = links.filter(l => l.from === id), next = specOf(id)?.emits ?? type;
      finishable.set(key, accepts(id, type) && (!out.length || out.some(l => canFinish(l.to, next))));
    }
    return finishable.get(key)!;
  };
  /** Requests per second of each channel reaching each building. */
  const inflowBy: Record<string, Record<string, number>> = {};
  const send = (from: string, channel: string, amount: number) => {
    const type = typeOfChannel(channel);
    const open = links.filter(l => l.from === from && usable[l.to]);
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
    const waiting = specOf(id)?.queue ? queues.backlog[id] ?? 0 : 0;
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
    for (const c of channels) if (isBackground(c) && inflowBy[id]?.[c]) lostInBackground += inflowBy[id]![c]! - taken(c);
    if (spec.queue) {
      // A job is answered when it enters the queue; the queue then releases Messages to its Workers at their total
      // capacity, and what is not released stays in the Backlog until the next step.
      answered += ok;
      const type = spec.accepts?.[0] ?? DEFAULT_REQUEST_TYPE;
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
      if (spec.shortcut) { if (!isBackground(c)) answered += taken(c) * hit; send(id, out, taken(c) - taken(c) * hit); }
      else if (spec.endsRequests) { if (!isBackground(c)) answered += taken(c); }
      else send(id, out, taken(c));
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

  // Latency: each component adds its service time, longer as it fills; the tail follows the slowest busy path.
  // A queue answers at once, so the time its Workers take is not the users' wait.
  const own = (id: string) => {
    const b = byId.get(id); if (!b) return 0;
    return (catalog[b.type]!.meanServiceMs / (1 - Math.min(0.97, load[id] ?? 0))) * 1.4;
  };
  const latency: Record<string, number> = {};
  for (const id of [...order].reverse()) {
    const busy = specOf(id)?.queue ? [] : links.filter(l => l.from === id && (edge[linkKey(l)] ?? 0) > (inflow[id] || 1) * 0.05);
    latency[id] = own(id) + Math.max(0, ...busy.map(l => latency[l.to] ?? 0));
  }
  const dropped = Object.values(drop).reduce((a, v) => a + v, 0);
  return {
    rps, answered, inflow, drop, edge, load, usable, backlog, release, releaseCapacity, shards,
    errors: rps ? Math.min(1, (dropped - lostInBackground) / rps) : 0,
    p95: rps ? Math.min(2000, Math.round(latency[CLIENT] ?? 0)) : 0,
  };
}
