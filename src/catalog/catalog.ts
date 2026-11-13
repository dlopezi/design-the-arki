import type { Catalog } from '../engine/types';

/**
 * Request Types: the kinds of request a level's wave can mix (ADR-0006). A wave without a mix carries one implicit
 * type, `watch`, so chapter 1 plays as it always did. Each building lists the types it `accepts` (all, when it does not say).
 */
export const DEFAULT_REQUEST_TYPE = 'watch';
/** A read that must show the user's own latest change: only the primary database can answer it (ADR-0007). */
export const READ_YOUR_WRITES = 'readYourWrites';
export const requestTypes = ['watch', 'job', 'read', 'write', READ_YOUR_WRITES];
/** What a Worker writes to the database after a job: internal, so a level's mix never lists it. */
export const RESULT_TYPE = 'result';

// Every component type is a combination of engine primitives plus its numbers (ADR-0004).
export const catalog: Catalog = {
  // Capacity (~10 000 req/s) is deliberately far above early-access traffic and not shown to players.
  loadBalancer: {
    primitive: 'station', workers: 10, meanServiceMs: 1, monthlyCost: 20, endsRequests: false, distributes: true, acceptsClients: true, buildS: 4,
    presentation: { zone: 'edge', technology: 'L7 · round-robin', hideCapacity: true },
  },
  appServer: {
    primitive: 'station', workers: 4, meanServiceMs: 20, monthlyCost: 40, endsRequests: false, scalesOut: true, acceptsClients: true, buildS: 5,
    sizes: {
      small: { workers: 2, monthlyCost: 20, vcpu: 1 },
      medium: { workers: 4, monthlyCost: 40, vcpu: 2 },
      large: { workers: 8, monthlyCost: 80, vcpu: 4 },
    },
    defaultSize: 'medium',
    presentation: { zone: 'application', technology: 'Node.js', instancePrefix: 'app' },
  },
  cache: {
    primitive: 'station', workers: 50, meanServiceMs: 2, monthlyCost: 30, endsRequests: false, buildS: 6,
    shortcut: { param: 'ttlS', defaultValue: 10, halfAt: 30, max: 0.95 },
    // Only reads are worth caching: a processing job is not.
    accepts: ['watch'],
    presentation: { zone: 'data', technology: 'Redis' },
  },
  database: {
    primitive: 'station', workers: 8, meanServiceMs: 20, monthlyCost: 50, endsRequests: true, buildS: 8,
    // Tiers: connections the database serves at once.
    sizes: { small: { workers: 8, monthlyCost: 50 }, medium: { workers: 16, monthlyCost: 150 }, large: { workers: 32, monthlyCost: 400 } },
    defaultSize: 'small',
    // It serves every kind of read (also Read-your-writes, which a Read Replica cannot), takes writes and the results Workers write; processing a job is not its work.
    accepts: ['watch', 'read', 'write', READ_YOUR_WRITES, RESULT_TYPE],
    // In a level that offers Shard Keys its instances are Shards (ADR-0007).
    shardable: true,
    presentation: { zone: 'data', technology: 'PostgreSQL', instancePrefix: 'shard' },
  },
  // Chapter 3 (Data scale). A copy of the primary database that answers reads only (ADR-0007). It gets the reads
  // before the primary does, and instances share them without a load balancer.
  readReplica: {
    primitive: 'station', workers: 8, meanServiceMs: 20, monthlyCost: 50, endsRequests: true, scalesOut: true, balanced: true,
    accepts: ['read'], prefers: ['read'], follows: 'database', buildS: 7,
    sizes: {
      small: { workers: 8, monthlyCost: 50, vcpu: 1 },
      medium: { workers: 16, monthlyCost: 100, vcpu: 2 },
      large: { workers: 32, monthlyCost: 200, vcpu: 4 },
    },
    defaultSize: 'small',
    presentation: { zone: 'data', technology: 'PostgreSQL replica', instancePrefix: 'replica' },
  },
  // Chapter 2 (Async). A managed queue: no settings, a fixed price, and a capacity that never fills in these levels.
  messageQueue: {
    primitive: 'station', workers: 1000, meanServiceMs: 1, monthlyCost: 20, endsRequests: false, queue: true, distributes: true, accepts: ['job'], buildS: 4,
    presentation: { zone: 'application', technology: 'Amazon SQS', hideCapacity: true },
  },
  // Takes Messages from the queue and processes each job (about a second), then writes the result to the database.
  // Concurrency is how many jobs one instance processes at once.
  worker: {
    primitive: 'station', workers: 4, meanServiceMs: 1000, monthlyCost: 40, endsRequests: false, scalesOut: true, accepts: ['job'], emits: RESULT_TYPE, buildS: 5,
    sizes: {
      small: { workers: 2, monthlyCost: 20, vcpu: 1 },
      medium: { workers: 4, monthlyCost: 40, vcpu: 2 },
      large: { workers: 8, monthlyCost: 80, vcpu: 4 },
    },
    defaultSize: 'medium',
    presentation: { zone: 'application', technology: 'Celery', instancePrefix: 'worker' },
  },
};
