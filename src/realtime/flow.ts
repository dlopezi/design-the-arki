import { catalog as defaultCatalog } from '../catalog/catalog';
import type { Catalog } from '../engine/types';

/**
 * The traffic model of real-time play (ADR-0005): each second, the users' requests follow the connections
 * through the buildings. A capacity model, not the event simulation: every component serves up to
 * `workers × 1000 / meanServiceMs` requests per second per instance, drops the rest, and gets slower as it fills.
 * All numbers come from the catalog, so the model knows no technology (ADR-0004).
 */

/** One running copy of a building; it serves only when built and not down. */
export type Instance = { buildLeftS: number; buildTotalS: number; down: boolean };
export type Building = { id: string; type: string; params: { size?: string; ttlS?: number }; instances: Instance[] };
/** A connection; `client` is the users on the Internet. */
export type Link = { from: string; to: string };

export const CLIENT = 'client';
export const linkKey = (l: Link) => `${l.from}>${l.to}`;
export const isServing = (i: Instance) => i.buildLeftS <= 0 && !i.down;

export type Flow = {
  rps: number;
  /** Requests answered per second (by a cache hit or a component that ends requests). */
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
};

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

/** Sends `rps` requests from the users through the buildings along the links. */
export function solve(buildings: Building[], links: Link[], rps: number, catalog: Catalog = defaultCatalog): Flow {
  const byId = new Map(buildings.map(b => [b.id, b]));
  const serving = (id: string) => byId.get(id)?.instances.filter(isServing).length ?? 0;
  const inflow: Record<string, number> = {}, drop: Record<string, number> = {}, edge: Record<string, number> = {};
  const load: Record<string, number> = {}, usable: Record<string, number> = {};
  const add = (map: Record<string, number>, key: string, v: number) => { map[key] = (map[key] ?? 0) + v; };
  let answered = 0;

  // Behind a component that spreads requests (a load balancer) every serving instance works; otherwise only the first.
  for (const b of buildings) {
    const spread = links.some(l => l.to === b.id && l.from !== CLIENT && catalog[byId.get(l.from)?.type ?? '']?.distributes);
    usable[b.id] = spread ? serving(b.id) : Math.min(1, serving(b.id));
  }
  // Links never make a circle (the game refuses them), so a depth-first order from the users is a valid order.
  const order: string[] = [], seen = new Set<string>();
  const visit = (id: string) => { if (seen.has(id)) return; seen.add(id); links.filter(l => l.from === id).forEach(l => visit(l.to)); order.unshift(id); };
  [CLIENT, ...buildings.map(b => b.id)].forEach(visit);

  const send = (from: string, amount: number) => {
    const targets = links.filter(l => l.from === from && usable[l.to]).map(l => l.to);
    if (!targets.length) { add(drop, from, amount); return; }
    for (const to of targets) { add(edge, `${from}>${to}`, amount / targets.length); add(inflow, to, amount / targets.length); }
  };
  inflow[CLIENT] = rps;
  for (const id of order) {
    const f = inflow[id] ?? 0;
    if (!f) continue;
    if (id === CLIENT) { send(id, f); continue; }
    const b = byId.get(id)!, spec = catalog[b.type]!;
    const capacity = usable[id]! * capacityOf(b, catalog);
    const ok = Math.min(f, capacity);
    load[id] = capacity ? ok / capacity : 1;
    add(drop, id, f - ok);
    if (spec.shortcut) {
      const hits = ok * hitRateOf(b, catalog);
      answered += hits;
      send(id, ok - hits);
    } else if (spec.endsRequests) answered += ok;
    else send(id, ok);
  }

  // Latency: each component adds its service time, longer as it fills; the tail follows the slowest busy path.
  const own = (id: string) => {
    const b = byId.get(id); if (!b) return 0;
    return (catalog[b.type]!.meanServiceMs / (1 - Math.min(0.97, load[id] ?? 0))) * 1.4;
  };
  const latency: Record<string, number> = {};
  for (const id of [...order].reverse()) {
    const busy = links.filter(l => l.from === id && (edge[linkKey(l)] ?? 0) > (inflow[id] || 1) * 0.05);
    latency[id] = own(id) + Math.max(0, ...busy.map(l => latency[l.to] ?? 0));
  }
  const dropped = Object.values(drop).reduce((a, v) => a + v, 0);
  return {
    rps, answered, inflow, drop, edge, load, usable,
    errors: rps ? Math.min(1, dropped / rps) : 0,
    p95: rps ? Math.min(2000, Math.round(latency[CLIENT] ?? 0)) : 0,
  };
}
