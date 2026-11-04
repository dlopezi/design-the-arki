// Public types of the simulation engine. The engine is technology-agnostic (ADR-0004):
// component types are catalogue entries described with generic primitives.

export type TrafficSegment = { fromS: number; toS: number; rps: number };

export type Level = {
  durationS: number;
  traffic: TrafficSegment[];
  requirements: { p95Ms: number; maxErrorRate: number };
  /** Maximum monthly cost in dollars. */
  budget: number;
  /** Monthly costs at or below which the 2nd, 3rd… star is earned. */
  starCostThresholds: number[];
  /** Scripted incidents: at `atS`, instance number `instance` of the first component of `componentType` goes down. */
  failureEvents?: FailureEvent[];
};

export type FailureEvent = { atS: number; componentType: string; instance: number };

export type DesignComponent = { id: string; type: string; params?: Record<string, unknown> };

/** 'client' is the implicit entry point of every design. */
export type Design = {
  components: DesignComponent[];
  connections: [from: string, to: string][];
};

/** A station: a pool of workers with a bounded FIFO queue. */
export type StationPrimitive = {
  primitive: 'station'; workers: number; meanServiceMs: number; monthlyCost: number;
  /** Whether a request can finish here; otherwise the component must forward it. */
  endsRequests: boolean;
  /** Whether the player can run several instances (param `instances`); requests are spread round-robin. */
  scalesOut?: boolean;
  /** Whether clients may connect to it directly (the design's entry point). */
  acceptsClients?: boolean;
  /** Whether it can spread requests over the instances of the next component. */
  distributes?: boolean;
  /** Instance sizes the player can pick (param `size`); each overrides workers and monthly cost. */
  sizes?: Record<string, { workers: number; monthlyCost: number; vcpu?: number }>;
  defaultSize?: string;
  /** How the game draws it; the engine ignores this. */
  presentation?: Presentation;
  /**
   * Shortcut primitive: a share of requests completes here (a hit) and the rest continue (a miss).
   * Hit rate = value / (value + halfAt), capped at `max`, where value is the `param` (default `defaultValue`).
   */
  shortcut?: { param: string; defaultValue: number; halfAt: number; max: number };
};

export type Presentation = {
  /** C4-style container group the component is drawn in. */
  zone: 'edge' | 'application' | 'data';
  technology: string;
  /** Prefix for instance names (app-1, app-2…). */
  instancePrefix?: string;
  /** Hide capacity from players (e.g. the load balancer in early chapters). */
  hideCapacity?: boolean;
};

export type ComponentSpec = StationPrimitive;

export type Catalog = Record<string, ComponentSpec>;

/** Why a design cannot serve traffic. */
export type DesignProblem = { kind: 'noEntry' } | { kind: 'deadEnd'; componentId: string }
  | { kind: 'loop'; componentIds: string[] }
  | { kind: 'needsBalancer'; componentId: string }
  | { kind: 'notPublic'; componentId: string };

export type Check = { requirement: 'p95' | 'errorRate' | 'budget'; target: number; actual: number; ok: boolean };

export type ComponentResult = {
  id: string; served: number; rejected: number; timedOut: number;
  /** Requests dropped because the instance holding them went down. */
  lost: number;
  /** Share of worker time busy in each 5-second bucket, 0–1, across all instances. */
  bucketUtilization: number[];
  peakUtilization: number;
  /** Mean time a request spent queued here, over requests that started service. */
  avgWaitMs: number;
  maxQueue: number;
  /** Share of requests completed here early (shortcut primitive); null for plain stations. */
  hitRate: number | null;
  instances: InstanceResult[];
};

export type InstanceResult = {
  served: number; rejected: number; maxQueue: number; bucketUtilization: number[]; peakUtilization: number;
  /** When it went down, in seconds; null if it stayed up. */
  killedAtS: number | null;
};

/** Metrics for one slice of the run, used for charts and playback. */
export type Bucket = { fromS: number; rps: number; p95: number; errorRate: number };

export type Result = {
  seed: number;
  totalRequests: number;
  passed: boolean;
  cost: number;
  /** 0 when failed; 1 for passing plus one per star cost threshold met. */
  stars: number;
  /** Cost at or below which the next star is earned; null when failed or all stars earned. */
  nextStarCost: number | null;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  /** rejected: queue full · timedOut: too slow · lost: held by an instance that went down · unavailable: no instance alive. */
  errors: { rejected: number; timedOut: number; lost: number; unavailable: number };
  checks: Check[];
  components: ComponentResult[];
  /** The run in 5-second buckets, by request arrival time. */
  buckets: Bucket[];
  /** The component that held requests back the most, when it mattered; null for a healthy run. */
  bottleneck: { componentId: string } | null;
};
