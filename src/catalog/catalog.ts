import type { Catalog } from '../engine/types';

/**
 * Request Types: the kinds of request a level's wave can mix (ADR-0006). A wave without a mix carries one implicit
 * type, `watch`, so chapter 1 plays as it always did. Each building lists the types it `accepts` (all, when it does not say).
 */
export const DEFAULT_REQUEST_TYPE = 'watch';
/** A big file sent by a user: it keeps an app server busy for a long time (ADR-0007). */
export const UPLOAD = 'upload';
/** A read that must show the user's own latest change: only the primary database can answer it (ADR-0007). */
export const READ_YOUR_WRITES = 'readYourWrites';
/** A video file a user downloads: the CDN answers a share of them, and Object Storage serves the rest, with a limit on how many (ADR-0008). */
export const DOWNLOAD = 'download';
/** A request with no token, or junk: whoever receives it turns it away, and an app server wastes capacity on it (ADR-0008). */
export const INVALID = 'invalid';
/** Valid requests, but from a few clients that send far more than normal ones: only a Client Limit at the gateway holds them back (ADR-0008). */
export const ABUSIVE = 'abusive';
export const requestTypes = ['watch', 'job', 'read', 'write', READ_YOUR_WRITES, UPLOAD, DOWNLOAD, INVALID, ABUSIVE];
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
    // Carrying a big file keeps an app server busy as long as ten normal requests.
    effort: { [UPLOAD]: 10 },
    // An app server that gets a request with no token turns it away itself, using its own capacity.
    rejects: [INVALID],
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
    accepts: ['watch', 'read', 'write', READ_YOUR_WRITES, RESULT_TYPE, ABUSIVE],
    // In a level that offers Shard Keys its instances are Shards (ADR-0007).
    shardable: true,
    presentation: { zone: 'data', technology: 'PostgreSQL', instancePrefix: 'shard' },
  },
  // Chapter 3 (Data scale). A copy of the primary database that answers reads only (ADR-0007). It gets the reads
  // before the primary does, and instances share them without a load balancer.
  readReplica: {
    primitive: 'station', workers: 8, meanServiceMs: 20, monthlyCost: 50, endsRequests: true, scalesOut: true, balanced: true,
    accepts: ['read'], prefers: ['read'], follows: 'database', applyShare: 0.25, buildS: 7,
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
  // Chapter 3 (Data scale). Managed object storage: a fixed price, no settings, and a capacity that never fills in these
  // levels. Users may connect to it straight to upload files (the pre-signed URL pattern); it takes uploads only.
  objectStorage: {
    primitive: 'station', workers: 1000, meanServiceMs: 1, monthlyCost: 30, endsRequests: true, acceptsClients: true,
    accepts: [UPLOAD, DOWNLOAD], prefers: [UPLOAD], buildS: 4,
    // Real object storage keeps its data across Regions, so a Region that falls does not take it down.
    global: true,
    // Sending a big file out is a lot of work: a viral video passes its limit (about 200 downloads a second), which a CDN in front prevents (ADR-0008).
    effort: { [DOWNLOAD]: 5000 },
    presentation: { zone: 'data', technology: 'Amazon S3', hideCapacity: true },
  },
  // Chapter 4 (Edge). The one door for the users: it checks every request and turns away the invalid ones (no token, junk)
  // at a tiny cost, so the app servers behind it see only valid requests. Everything else goes on to the load balancer or the app servers.
  apiGateway: {
    primitive: 'station', workers: 1000, meanServiceMs: 1, monthlyCost: 30, endsRequests: false, acceptsClients: true, distributes: false,
    rejects: [INVALID], buildS: 4,
    // In a design with Regions the gateway stands at the door, in front of the DNS, outside any one Region.
    global: true,
    // The Client Limit: requests per second one client may send (a level sets how many clients send each Request Type).
    clientLimit: { param: 'limitRps', defaultValue: 40 },
    presentation: { zone: 'edge', technology: 'Kong', hideCapacity: true },
  },
  // Chapter 4 (Edge). Sits in front of Object Storage: a share of downloads is answered at the edge (the hit share grows with
  // the TTL, as in the cache), and the rest goes on to the origin. Users connect straight to it, for downloads only.
  cdn: {
    primitive: 'station', workers: 1000, meanServiceMs: 1, monthlyCost: 40, endsRequests: false, acceptsClients: true,
    accepts: [DOWNLOAD], prefers: [DOWNLOAD], buildS: 4,
    // A CDN is a network of edge servers outside any one Region.
    global: true,
    shortcut: { param: 'ttlS', defaultValue: 60, halfAt: 20, max: 0.95 },
    presentation: { zone: 'edge', technology: 'Amazon CloudFront', hideCapacity: true },
  },
  // Chapter 4 (Edge). Decides which Region the users reach. When the main Region fails it needs time to notice and for the old
  // answers to expire: it switches the users to the standby Region after its TTL, and until then requests to the dead Region fail.
  // A shorter TTL switches sooner and costs a little more (ADR-0008). The game's clock is fast, so the TTLs are a few seconds.
  dns: {
    primitive: 'station', workers: 1000, meanServiceMs: 1, monthlyCost: 30, endsRequests: false, acceptsClients: true, global: true, buildS: 4,
    failover: { options: [5, 10, 30], defaultValue: 30, monthlyCost: { 5: 40, 10: 30, 30: 20 } },
    presentation: { zone: 'edge', technology: 'Amazon Route 53', hideCapacity: true },
  },
  // What a standby Read Replica becomes when the main Region fails and the DNS switches: it takes every kind of request, like the
  // primary database it replaces. Not a building the player builds.
  promotedReplica: {
    primitive: 'station', workers: 8, meanServiceMs: 20, monthlyCost: 50, endsRequests: true, scalesOut: true, balanced: true, internal: true,
    accepts: ['watch', 'read', 'write', READ_YOUR_WRITES, RESULT_TYPE, ABUSIVE], buildS: 7,
    sizes: {
      small: { workers: 8, monthlyCost: 50, vcpu: 1 },
      medium: { workers: 16, monthlyCost: 100, vcpu: 2 },
      large: { workers: 32, monthlyCost: 200, vcpu: 4 },
    },
    defaultSize: 'small',
    presentation: { zone: 'data', technology: 'PostgreSQL primary', instancePrefix: 'primary' },
  },
};
