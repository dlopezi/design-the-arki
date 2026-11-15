// The types of the catalog and of a design. The game rules are technology-agnostic (ADR-0004):
// component types are catalog entries described with generic primitives.

export type DesignComponent = { id: string; type: string; params?: Record<string, unknown> };

/** 'client' is the implicit entry point of every design. */
export type Design = {
  components: DesignComponent[];
  connections: [from: string, to: string][];
};

/** A station: a pool of workers. One instance serves up to `workers × 1000 / meanServiceMs` requests per second. */
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
  /**
   * The Request Types it accepts (real-time play, ADR-0006). Left out, it accepts every type: it just passes them on
   * (a load balancer or an app server). A building that lists its types takes only those.
   */
  accepts?: string[];
  /** The Request Type it passes on, when it turns what it takes into something else (a Worker saves the result of a job). */
  emits?: string;
  /**
   * Request Types it gets before any other building that also accepts them: a caller that is connected to it sends
   * those types here, and to the others only when it is not (a Read Replica takes the reads, the primary database the rest).
   */
  prefers?: string[];
  /**
   * Its instances can be Shards, in a level that offers Shard Keys (ADR-0007): each Shard holds one slice of the data,
   * chosen by the Shard Key, and serves only that slice.
   */
  shardable?: boolean;
  /**
   * Request Types that keep the building busy longer than a normal request: the capacity one request of the type
   * uses, in normal requests (an upload on an app server).
   */
  effort?: Record<string, number>;
  /** Real-time play: the building stands in front of the Regions and belongs to none of them (the DNS). */
  global?: boolean;
  /** Real-time play: not a building the player builds; it only appears when another one is promoted (the Manual and the cards skip it). */
  internal?: boolean;
  /**
   * Real-time play: the building decides which Region the users go to. When the main Region fails it switches them to the standby
   * Region after its TTL (param `ttlS`, one of `options`, in seconds); a shorter TTL switches sooner and costs more (`monthlyCost` by TTL).
   */
  failover?: { options: number[]; defaultValue: number; monthlyCost: Record<number, number> };
  /**
   * Per-client limit (real-time play): of each Request Type whose clients the level counts, this building passes at most the
   * `param` value in requests per second for each client. The rest of an abusive type is turned away; the rest of any other type
   * is an error, because normal clients were refused (ADR-0008).
   */
  clientLimit?: { param: string; defaultValue: number };
  /**
   * Request Types this building turns away itself (real-time play): it answers them with a refusal, such as 401 for a request
   * with no token. They are neither answered nor errors, and they go no further, but they use some of its capacity.
   */
  rejects?: string[];
  /** Every serving instance works even when the building is reached directly, because the caller spreads its requests over them. */
  balanced?: boolean;
  /** Share of one instance's capacity that goes to applying the writes copied from the building it follows (Replication Lag). */
  applyShare?: number;
  /** The type of building whose data it keeps a copy of: it may be connected to it without ending in a dead end (replication). */
  follows?: string;
  /**
   * Queue primitive (real-time play): it answers at once and holds what reaches it as a Backlog that lasts from one
   * tick to the next, then releases it to the buildings behind it at their total capacity. Never drops the Backlog.
   */
  queue?: boolean;
  /**
   * Pub/sub primitive (real-time play, ADR-0009): like a queue it answers at once, but it keeps one Backlog for each Subscription
   * of the level and gives every Subscription its own copy, released to the buildings that serve that Subscription.
   */
  pubSub?: boolean;
  /**
   * Its log is split into Partitions (param `partitions`, default `defaultValue`), each costing `costEach` a month on top of
   * `monthlyCost`. Only one Worker instance of a Subscription reads a Partition at a time, so a Subscription uses at most as
   * many instances as there are Partitions (ADR-0009).
   */
  partitions?: { defaultValue: number; costEach: number };
  /**
   * It answers feed reads (ADR-0009). With fan-out on read (no Feed Worker writing the feeds ahead), one feed read costs it one
   * read per followed account; with fan-out on write, one read.
   */
  feedStore?: boolean;
  /**
   * The Celebrity Limit of a Feed Worker (param `celebrityLimit`, one of `options`, in followers; left out, no limit): posts of
   * accounts with more followers are not written into every feed but merged when a feed is read (the hybrid feed, ADR-0009).
   */
  celebrityLimit?: { options: number[] };
  /** Request Types it finishes itself: their work leaves the system from here (a Worker sends a notification to a push service). */
  ends?: string[];
  /** In a level with Subscriptions, each building of this type serves one of them (param `subscription`): a consumer group (ADR-0009). */
  subscribes?: boolean;
  /** Instance sizes the player can pick (param `size`); each overrides workers and monthly cost. */
  sizes?: Record<string, { workers: number; monthlyCost: number; vcpu?: number }>;
  defaultSize?: string;
  /** Seconds to build one instance. */
  buildS?: number;
  /** How the game draws it; the rules ignore this. */
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
