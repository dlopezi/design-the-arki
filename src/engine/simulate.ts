import { catalog as defaultCatalog } from '../catalog/catalog';
import { EventQueue } from './eventQueue';
import { seededRandom } from './random';
import type { Catalog, Design, DesignProblem, Level, Result } from './types';

/** Thrown by `simulate` when the design cannot serve traffic at all. */
export class DesignError extends Error {
  constructor(readonly problem: DesignProblem) {
    super(`Design cannot serve traffic: ${JSON.stringify(problem)}`);
    this.name = 'DesignError';
  }
}

/** Default queue size per instance; a component's `queueSize` param overrides it. */
export const DEFAULT_QUEUE_SIZE = 100;
export const TIMEOUT_MS = 1000;
export const BUCKET_S = 5;
/** Below this much added delay per request on average, no component counts as a bottleneck. */
const BOTTLENECK_MS_PER_REQUEST = 2;
const HOP_MS = 1;

type Request = { createdAt: number; enqueuedAt: number; hops: number };

type Instance = { busy: number; queue: Request[]; busyMs: number[] };

type Station = {
  id: string;
  workers: number;
  meanServiceMs: number;
  instances: Instance[];
  nextInstance: number;
  queueSize: number;
  next: string | null;
  stats: { id: string; served: number; rejected: number; timedOut: number };
  /** Total time requests spent queued here. */
  waitMs: number;
};

type SimEvent =
  | { kind: 'arrive'; station: string; request: Request }
  | { kind: 'done'; station: string; instance: number; request: Request };

/** Workers and monthly cost per instance, after applying the `size` param. */
function perInstance(component: Design['components'][number], catalog: Catalog): { workers: number; monthlyCost: number } {
  const spec = catalog[component.type]!;
  if (!spec.sizes) return { workers: spec.workers, monthlyCost: spec.monthlyCost };
  const size = component.params?.size ?? spec.defaultSize;
  const chosen = spec.sizes[size as string];
  if (!chosen) throw new Error(`Invalid size for ${component.id}: ${String(size)}`);
  return chosen;
}

function queueSizeOf(component: Design['components'][number]): number {
  const value = component.params?.queueSize ?? DEFAULT_QUEUE_SIZE;
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error(`Invalid queueSize for ${component.id}: ${String(value)}`);
  return value as number;
}

function instanceCount(component: Design['components'][number], catalog: Catalog): number {
  const value = component.params?.instances ?? 1;
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error(`Invalid instances for ${component.id}: ${String(value)}`);
  if ((value as number) > 1 && !catalog[component.type]!.scalesOut) throw new Error(`${component.type} cannot run several instances`);
  return value as number;
}

/** Monthly cost of a design in dollars, from the catalogue. */
export function designCost(design: Design, catalog: Catalog = defaultCatalog): number {
  return design.components.reduce((sum, c) => sum + (catalog[c.type] ? perInstance(c, catalog).monthlyCost * instanceCount(c, catalog) : 0), 0);
}

/**
 * Runs a deterministic discrete-event simulation of `level` traffic through `design`.
 * Same inputs and seed always give the same result (ADR-0001).
 */
export function simulate(level: Level, design: Design, seed: number, catalog: Catalog = defaultCatalog): Result {
  const random = seededRandom(seed);
  const exponential = (mean: number) => -Math.log(1 - random()) * mean;
  const nextOf = (id: string) => design.connections.find(([from]) => from === id)?.[1] ?? null;

  const stations = new Map<string, Station>();
  for (const component of design.components) {
    const spec = catalog[component.type];
    if (!spec) throw new Error(`Unknown component type: ${component.type}`);
    stations.set(component.id, {
      id: component.id, workers: perInstance(component, catalog).workers, meanServiceMs: spec.meanServiceMs,
      instances: Array.from({ length: instanceCount(component, catalog) }, () => ({ busy: 0, queue: [], busyMs: new Array<number>(Math.ceil(level.durationS / BUCKET_S)).fill(0) })), nextInstance: 0,
      queueSize: queueSizeOf(component), waitMs: 0,
      next: nextOf(component.id), stats: { id: component.id, served: 0, rejected: 0, timedOut: 0 },
    });
  }
  const entry = nextOf('client');
  if (!entry || !stations.has(entry)) throw new DesignError({ kind: 'noEntry' });
  const path: string[] = [];
  for (let id: string | null = entry; id; id = stations.get(id)!.next) {
    if (path.includes(id)) throw new DesignError({ kind: 'loop', componentIds: path.slice(path.indexOf(id)) });
    const previous = path.at(-1);
    path.push(id);
    const station = stations.get(id)!;
    const typeOf = (componentId: string) => catalog[design.components.find(c => c.id === componentId)!.type]!;
    if (station.instances.length > 1 && !(previous && typeOf(previous).distributes)) {
      throw new DesignError({ kind: 'needsBalancer', componentId: id });
    }
    if (!station.next && !catalog[design.components.find(c => c.id === id)!.type]!.endsRequests) {
      throw new DesignError({ kind: 'deadEnd', componentId: id });
    }
  }

  const events = new EventQueue<SimEvent>();
  let totalRequests = 0;
  const bucketCount = Math.ceil(level.durationS / BUCKET_S);
  const bucketOf = (timeMs: number) => Math.min(bucketCount - 1, Math.floor(timeMs / (BUCKET_S * 1000)));
  const bucketRequests = new Array<number>(bucketCount).fill(0);
  const bucketErrors = new Array<number>(bucketCount).fill(0);
  const bucketLatencies: number[][] = Array.from({ length: bucketCount }, () => []);
  const fail = (request: Request) => { bucketErrors[bucketOf(request.createdAt)]!++; };
  for (const segment of level.traffic) {
    const end = segment.toS * 1000;
    const meanGap = 1000 / segment.rps;
    for (let t = segment.fromS * 1000 + exponential(meanGap); t < end; t += exponential(meanGap)) {
      events.push(t, { kind: 'arrive', station: entry, request: { createdAt: t, enqueuedAt: t, hops: 1 } });
      totalRequests++;
      bucketRequests[bucketOf(t)]!++;
    }
  }

  const latencies: number[] = [];
  const errors = { rejected: 0, timedOut: 0 };

  const start = (station: Station, instance: number, request: Request, now: number) => {
    if (now - request.createdAt > TIMEOUT_MS) {
      errors.timedOut++; station.stats.timedOut++; fail(request);
      return;
    }
    const worker = station.instances[instance]!;
    worker.busy++;
    station.waitMs += now - request.enqueuedAt;
    const serviceMs = exponential(station.meanServiceMs);
    // Spread the busy time over the buckets it covers.
    for (let t = now, end = now + serviceMs; t < end;) {
      const b = Math.floor(t / (BUCKET_S * 1000));
      if (b >= bucketCount) break;
      const sliceEnd = Math.min(end, (b + 1) * BUCKET_S * 1000);
      worker.busyMs[b]! += sliceEnd - t;
      t = sliceEnd;
    }
    events.push(now + serviceMs, { kind: 'done', station: station.id, instance, request });
  };

  const complete = (request: Request, now: number) => {
    const latency = now - request.createdAt + request.hops * HOP_MS;
    if (latency > TIMEOUT_MS) { errors.timedOut++; fail(request); return; }
    latencies.push(latency);
    bucketLatencies[bucketOf(request.createdAt)]!.push(latency);
  };

  for (let event = events.pop(); event; event = events.pop()) {
    const { time: now, value } = event;
    const station = stations.get(value.station)!;
    if (value.kind === 'arrive') {
      value.request.enqueuedAt = now;
      const index = station.nextInstance;
      station.nextInstance = (index + 1) % station.instances.length;
      const instance = station.instances[index]!;
      if (instance.busy < station.workers) start(station, index, value.request, now);
      else if (instance.queue.length < station.queueSize) instance.queue.push(value.request);
      else { errors.rejected++; station.stats.rejected++; fail(value.request); }
    } else {
      const instance = station.instances[value.instance]!;
      instance.busy--;
      station.stats.served++;
      if (station.next) {
        value.request.hops++;
        events.push(now + HOP_MS, { kind: 'arrive', station: station.next, request: value.request });
      } else {
        complete(value.request, now);
      }
      while (instance.busy < station.workers && instance.queue.length) start(station, value.instance, instance.queue.shift()!, now);
    }
  }

  latencies.sort((a, b) => a - b);
  const percentile = (p: number, sorted = latencies) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! : 0);
  const p95 = percentile(0.95);
  const errorRate = totalRequests ? (errors.rejected + errors.timedOut) / totalRequests : 0;
  const cost = designCost(design, catalog);
  const checks: Result['checks'] = [
    { requirement: 'p95', target: level.requirements.p95Ms, actual: p95, ok: p95 <= level.requirements.p95Ms },
    { requirement: 'errorRate', target: level.requirements.maxErrorRate, actual: errorRate, ok: errorRate <= level.requirements.maxErrorRate },
    { requirement: 'budget', target: level.budget, actual: cost, ok: cost <= level.budget },
  ];

  const passed = checks.every(c => c.ok);
  // Pressure: time requests waited here, plus a full timeout for each one it turned away.
  const pressureOf = (s: Station) => s.waitMs + (s.stats.rejected + s.stats.timedOut) * TIMEOUT_MS;
  const worst = [...stations.values()].reduce<Station | null>((a, b) => (!a || pressureOf(b) > pressureOf(a) ? b : a), null);
  const significant = worst && totalRequests && pressureOf(worst) / totalRequests >= BOTTLENECK_MS_PER_REQUEST;
  const bottleneck = significant ? { componentId: worst.id } : null;
  const stars = passed ? 1 + level.starCostThresholds.filter(threshold => cost <= threshold).length : 0;

  const nextStarCost = passed ? (level.starCostThresholds.find(threshold => cost > threshold) ?? null) : null;

  return {
    seed, totalRequests, p50: percentile(0.5), p95, p99: percentile(0.99), errorRate, errors, checks,
    passed,
    cost,
    stars,
    nextStarCost,
    components: [...stations.values()].map(s => {
      const bucketMs = BUCKET_S * 1000 * s.workers;
      const instances = s.instances.map(i => ({ bucketUtilization: i.busyMs.map(ms => Math.min(1, ms / bucketMs)) }));
      const bucketUtilization = Array.from({ length: bucketCount }, (_, b) =>
        Math.min(1, s.instances.reduce((sum, i) => sum + i.busyMs[b]!, 0) / (bucketMs * s.instances.length)));
      return { ...s.stats, bucketUtilization, instances };
    }),
    bottleneck,
    buckets: bucketRequests.map((count, i) => ({
      fromS: i * BUCKET_S, rps: count / BUCKET_S,
      p95: percentile(0.95, bucketLatencies[i]!.sort((a, b) => a - b)),
      errorRate: count ? bucketErrors[i]! / count : 0,
    })),
  };
}
