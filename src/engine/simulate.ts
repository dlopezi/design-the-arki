import { catalog as defaultCatalog } from '../catalog/catalog';
import { EventQueue } from './eventQueue';
import { seededRandom } from './random';
import type { Catalog, ComponentResult, Design, Level, Result } from './types';

const QUEUE_CAPACITY = 100;
const TIMEOUT_MS = 1000;
const HOP_MS = 1;

type Request = { createdAt: number; enqueuedAt: number; hops: number };

type Station = {
  id: string;
  workers: number;
  meanServiceMs: number;
  busy: number;
  queue: Request[];
  next: string | null;
  stats: ComponentResult;
};

type SimEvent =
  | { kind: 'arrive'; station: string; request: Request }
  | { kind: 'done'; station: string; request: Request };

/** Monthly cost of a design in dollars, from the catalogue. */
export function designCost(design: Design, catalog: Catalog = defaultCatalog): number {
  return design.components.reduce((sum, c) => sum + (catalog[c.type]?.monthlyCost ?? 0), 0);
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
      id: component.id, workers: spec.workers, meanServiceMs: spec.meanServiceMs, busy: 0, queue: [],
      next: nextOf(component.id), stats: { id: component.id, served: 0, rejected: 0, timedOut: 0 },
    });
  }
  const entry = nextOf('client');
  if (!entry || !stations.has(entry)) throw new Error('Design has no entry point connected to the client');

  const events = new EventQueue<SimEvent>();
  let totalRequests = 0;
  for (const segment of level.traffic) {
    const end = segment.toS * 1000;
    const meanGap = 1000 / segment.rps;
    for (let t = segment.fromS * 1000 + exponential(meanGap); t < end; t += exponential(meanGap)) {
      events.push(t, { kind: 'arrive', station: entry, request: { createdAt: t, enqueuedAt: t, hops: 1 } });
      totalRequests++;
    }
  }

  const latencies: number[] = [];
  const errors = { rejected: 0, timedOut: 0 };

  const start = (station: Station, request: Request, now: number) => {
    if (now - request.createdAt > TIMEOUT_MS) {
      errors.timedOut++; station.stats.timedOut++;
      return;
    }
    station.busy++;
    events.push(now + exponential(station.meanServiceMs), { kind: 'done', station: station.id, request });
  };

  const complete = (request: Request, now: number) => {
    const latency = now - request.createdAt + request.hops * HOP_MS;
    if (latency > TIMEOUT_MS) errors.timedOut++;
    else latencies.push(latency);
  };

  for (let event = events.pop(); event; event = events.pop()) {
    const { time: now, value } = event;
    const station = stations.get(value.station)!;
    if (value.kind === 'arrive') {
      value.request.enqueuedAt = now;
      if (station.busy < station.workers) start(station, value.request, now);
      else if (station.queue.length < QUEUE_CAPACITY) station.queue.push(value.request);
      else { errors.rejected++; station.stats.rejected++; }
    } else {
      station.busy--;
      station.stats.served++;
      if (station.next) {
        value.request.hops++;
        events.push(now + HOP_MS, { kind: 'arrive', station: station.next, request: value.request });
      } else {
        complete(value.request, now);
      }
      while (station.busy < station.workers && station.queue.length) start(station, station.queue.shift()!, now);
    }
  }

  latencies.sort((a, b) => a - b);
  const percentile = (p: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]! : 0);
  const p95 = percentile(0.95);
  const errorRate = totalRequests ? (errors.rejected + errors.timedOut) / totalRequests : 0;
  const cost = designCost(design, catalog);
  const checks: Result['checks'] = [
    { requirement: 'p95', target: level.requirements.p95Ms, actual: p95, ok: p95 <= level.requirements.p95Ms },
    { requirement: 'errorRate', target: level.requirements.maxErrorRate, actual: errorRate, ok: errorRate <= level.requirements.maxErrorRate },
    { requirement: 'budget', target: level.budget, actual: cost, ok: cost <= level.budget },
  ];

  const passed = checks.every(c => c.ok);
  const stars = passed ? 1 + level.starCostThresholds.filter(threshold => cost <= threshold).length : 0;

  const nextStarCost = passed ? (level.starCostThresholds.find(threshold => cost > threshold) ?? null) : null;

  return {
    seed, totalRequests, p50: percentile(0.5), p95, p99: percentile(0.99), errorRate, errors, checks,
    passed,
    cost,
    stars,
    nextStarCost,
    components: [...stations.values()].map(s => s.stats),
  };
}
