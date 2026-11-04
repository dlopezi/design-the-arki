// Public types of the simulation engine. The engine is technology-agnostic (ADR-0004):
// component types are catalogue entries described with generic primitives.

export type TrafficSegment = { fromS: number; toS: number; rps: number };

export type Level = {
  durationS: number;
  traffic: TrafficSegment[];
  requirements: { p95Ms: number; maxErrorRate: number };
};

export type DesignComponent = { id: string; type: string; params?: Record<string, unknown> };

/** 'client' is the implicit entry point of every design. */
export type Design = {
  components: DesignComponent[];
  connections: [from: string, to: string][];
};

/** A station: a pool of workers with a bounded FIFO queue. */
export type StationPrimitive = { primitive: 'station'; workers: number; meanServiceMs: number };

export type ComponentSpec = StationPrimitive;

export type Catalog = Record<string, ComponentSpec>;

export type Check = { requirement: 'p95' | 'errorRate'; target: number; actual: number; ok: boolean };

export type ComponentResult = { id: string; served: number; rejected: number; timedOut: number };

export type Result = {
  seed: number;
  totalRequests: number;
  passed: boolean;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  errors: { rejected: number; timedOut: number };
  checks: Check[];
  components: ComponentResult[];
};
