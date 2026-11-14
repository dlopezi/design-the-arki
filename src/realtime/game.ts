import { catalog as defaultCatalog, DEFAULT_REQUEST_TYPE, DOWNLOAD, UPLOAD } from '../catalog/catalog';
import type { Catalog, Design } from '../engine/types';
import { CLIENT, MAIN, STANDBY, instancePrice, regionOf, solve, type Building, type Flow, type Instance, type Link, type ShardKeys } from './flow';

/**
 * Real-time play (ADR-0005): a build phase, then one wave of users. Money grows by itself and with every answered
 * visit, and each building costs maintenance; reputation falls while the base is slow or failing. All functions are
 * pure: they take a state and return a new one, so the UI only renders and the rules are tested here.
 */

export const BUILD_PHASE_S = 30;
/** $ per second, always. */
export const PASSIVE_INCOME = 2;
/** $ per 100 answered requests. */
export const PER_100_VISITS = 1;
/** Maintenance per second is the monthly cost divided by this. */
export const UPKEEP_DIVISOR = 100;
/** Share of the price given back when a building is removed. */
export const REFUND = 0.5;
/** Reputation change per second: failing, too slow, or fine. */
export const REPUTATION = { failing: -6, slow: -4, fine: 1 };
/** Bonus per second of build phase skipped by calling the users early. */
export const EARLY_BONUS_PER_S = PASSIVE_INCOME * 2;
/** Seconds a consumer group stops to rebalance after one of its instances goes down. */
export const REBALANCE_S = 2;
/** A Backlog under this (half a Message) counts as empty. */
export const EMPTY_BACKLOG = 0.5;

export type Play = {
  startMoney: number;
  /** `mix`: the share of each Request Type in the wave (adds up to 1); left out, all traffic is one type. */
  wave: { rps: number; lengthS: number; mix?: Record<string, number> };
  /** At `atS` seconds into the wave, one serving instance of the first `componentType` goes down, or every building of a whole `region` does (ADR-0008). */
  incident?: { atS: number; componentType?: string; region?: string };
  /** Money left at the end for the 2nd, 3rd… star. */
  starMoney: number[];
  /** Levels with abusive clients: how many clients send each Request Type, so a Client Limit can be applied to each one's rate (ADR-0008). */
  clients?: Record<string, number>;
  /** Levels that teach Sharding: the Shard Keys on offer and how traffic spreads over the values of each (ADR-0007). The first is the default. */
  shardKeys?: ShardKeys;
  /**
   * Pub/sub levels (ADR-0009): the systems that must each process every post (Notifications, Search…), in order, with the longest
   * their oldest unprocessed post may wait (the Consumer Lag), in seconds.
   */
  subscriptions?: Record<string, { maxLagS: number }>;
  /** Levels that teach the Partition Key: the keys on offer and how posts spread over the values of each, as for Shard Keys. The first is the default. */
  partitionKeys?: ShardKeys;
  /**
   * News-feed levels (ADR-0009): the Subscription whose Workers write each post into every follower's feed (fan-out on write),
   * the followers of an account, and the accounts a user follows (what a feed read gathers without fan-out on write).
   */
  feed?: { subscription: string; followers: number; follows: number;
    /** A celebrity: from `atS` seconds into the wave, for `lengthS`, `share` of the posts are by accounts with `followers` followers; a user follows `followed` celebrities. */
    celebrity?: { atS: number; lengthS: number; share: number; followers: number; followed: number } };
};
export type GameLevel = {
  allowedComponents: string[];
  componentOptions: Record<string, { sizes?: string[]; maxInstances?: number; limits?: Record<string, number> }>;
  requirements: { p95Ms: number; maxErrorRate: number; /** The longest the oldest Message may wait in a queue, in seconds. */ maxQueueAgeS?: number;
    /** The longest a Read Replica may be behind the primary database, in seconds. */ maxReplicationLagS?: number;
    /** The longest a CDN may keep a copy of a file, in seconds: users must not see older content (ADR-0008). */ maxStaleS?: number };
  play: Play;
};

/** What happened, for the message log; the UI turns each kind into text. */
export type GameEvent = { t: number; kind: 'building' | 'ready' | 'wave' | 'drain' | 'early' | 'incident' | 'rebalance' | 'celebrity' | 'regionDown' | 'failover' | 'removed' | 'resized' | 'linked' | 'unlinked' | 'refused' | 'won' | 'lost';
  type?: string; id?: string; from?: string; to?: string; amount?: number; reason?: string };
/** One second of the run, for the charts: `age` is the oldest Message in any queue (s), `backlog` the Messages waiting in all of them, `consumerLag` each Subscription's lag (s). */
export type Sample = { t: number; rps: number; p95: number; errors: number; age: number; backlog: number; lag: number; consumerLag?: Record<string, number> };
export type GameState = {
  t: number;
  /** build → wave → (drain, while Messages are still waiting after the wave) → won or lost. */
  phase: 'build' | 'wave' | 'drain' | 'won' | 'lost';
  money: number;
  reputation: number;
  buildings: Building[];
  links: Link[];
  /** Whether new buildings are connected automatically. */
  autoLink: boolean;
  /** The Subscription whose Workers write the feeds into the database (a news-feed level), so a new one connects to it. */
  feedSubscription?: string;
  /** The Request Types the wave carries: a building the users reach for only some types is useless without them. */
  waveTypes: string[];
  /** Requests answered so far. */
  visits: number;
  incidentDone: boolean;
  flow: Flow | null;
  /** Messages waiting in each queue (ADR-0006): the one state that lasts from one step to the next. */
  backlog: Record<string, number>;
  /** How long the oldest Message of each queue has waited, estimated: the Backlog over the rate its Workers take it. */
  queueAge: Record<string, number>;
  /** Writes each Read Replica has not applied yet, and how far behind the primary database that puts it, in seconds (ADR-0007). */
  unapplied: Record<string, number>;
  lag: Record<string, number>;
  /** Posts each Subscription has not processed yet, and how long the oldest of them has waited, in seconds (ADR-0009). */
  subBacklog: Record<string, number>;
  consumerLag: Record<string, number>;
  /** What waits in each Partition of a Topic for each Subscription (`topicId|subscription`). */
  partBacklog: Record<string, number[]>;
  /** Worker buildings whose group is rebalancing after an instance went down, and until when (ADR-0009): none of their instances reads. */
  rebalance: Record<string, number>;
  /** A Region failure and the switch to the standby Region: when it fell, when the DNS will switch (null: nothing will), and whether it has. */
  failover: { downAt: number | null; switchAt: number | null; switched: boolean };
  history: Sample[];
  events: GameEvent[];
  nextId: number;
};

const buildTime = (type: string, catalog: Catalog) => catalog[type]?.buildS ?? 5;
const ready = (n: number): Instance[] => Array.from({ length: n }, () => ({ buildLeftS: 0, buildTotalS: 0, down: false }));
const log = (s: GameState, e: Omit<GameEvent, 't'>): GameEvent[] => [...s.events, { t: s.t, ...e }].slice(-40);
export const waveEnd = (level: GameLevel) => BUILD_PHASE_S + level.play.wave.lengthS;
/** Messages waiting in all queues, and posts no Subscription has processed yet. */
export const totalBacklog = (s: Pick<GameState, 'backlog'> & Partial<Pick<GameState, 'subBacklog'>>) =>
  [...Object.values(s.backlog), ...Object.values(s.subBacklog ?? {})].reduce((a, v) => a + v, 0);
/** The Subscriptions of a level, in order (none outside pub/sub levels). */
export const subscriptionsOf = (level: Pick<GameLevel, 'play'>) => Object.keys(level.play.subscriptions ?? {});
/** The Subscription whose Consumer Lag is closest to (or furthest over) its maximum, or null in a level without Subscriptions. */
export function worstSubscription(s: Pick<GameState, 'consumerLag'>, level: Pick<GameLevel, 'play'>): string | null {
  const subs = level.play.subscriptions ?? {};
  return Object.keys(subs).reduce<string | null>((worst, sub) => (worst === null || (s.consumerLag[sub] ?? 0) / subs[sub]!.maxLagS > (s.consumerLag[worst] ?? 0) / subs[worst]!.maxLagS ? sub : worst), null);
}
/** The longest any CDN keeps a copy of a file, in seconds: the oldest content a user may be shown. 0 with no CDN. */
export const contentAge = (s: Pick<GameState, 'buildings'>, catalog: Catalog = defaultCatalog) =>
  Math.max(0, ...s.buildings.flatMap(b => { const spec = catalog[b.type]; return spec?.shortcut && spec.accepts?.includes(DOWNLOAD) ? [Number(b.params.ttlS ?? spec.shortcut.defaultValue)] : []; }));
export const upkeepPerS = (s: Pick<GameState, 'buildings'>, catalog: Catalog = defaultCatalog) =>
  s.buildings.reduce((sum, b) => sum + instancePrice(b, catalog) * b.instances.length, 0) / UPKEEP_DIVISOR;

/** A new game: the level's money, and the mode's starting design already built and connected. */
export function createGame(level: GameLevel, design: Design): GameState {
  const buildings: Building[] = design.components.map(c => ({
    id: c.id, type: c.type, ...(c.params?.region && c.params.region !== MAIN ? { region: String(c.params.region) } : {}),
    params: { ...(c.params?.size ? { size: String(c.params.size) } : {}), ...(c.params?.ttlS !== undefined ? { ttlS: Number(c.params.ttlS) } : {}), ...(c.params?.shardKey ? { shardKey: String(c.params.shardKey) } : {}), ...(c.params?.limitRps !== undefined ? { limitRps: Number(c.params.limitRps) } : {}), ...(c.params?.subscription ? { subscription: String(c.params.subscription) } : {}), ...(c.params?.partitions !== undefined ? { partitions: Number(c.params.partitions) } : {}), ...(c.params?.partitionKey ? { partitionKey: String(c.params.partitionKey) } : {}), ...(c.params?.celebrityLimit !== undefined ? { celebrityLimit: Number(c.params.celebrityLimit) } : {}) },
    instances: ready(Math.max(1, Number(c.params?.instances ?? 1))),
  }));
  const s: GameState = { t: 0, phase: 'build', money: level.play.startMoney, reputation: 100, buildings, links: [], autoLink: true,
    ...(level.play.feed ? { feedSubscription: level.play.feed.subscription } : {}),
    waveTypes: Object.keys(level.play.wave.mix ?? { [DEFAULT_REQUEST_TYPE]: 1 }),
    visits: 0, incidentDone: false, flow: null, backlog: {}, queueAge: {}, unapplied: {}, lag: {}, subBacklog: {}, consumerLag: {}, partBacklog: {}, rebalance: {}, failover: { downAt: null, switchAt: null, switched: false }, history: [], events: [], nextId: design.components.length + 1 };
  // Keep the design's connections, in order, skipping any the rules refuse (a broken design may hold one).
  return design.connections.reduce((acc, [from, to]) => (linkProblem(acc, from, to) ? acc : { ...acc, links: [...acc.links, { from, to }] }), s);
}

/** The design on the map, to save it or show it in the player's Base. */
export function toDesign(s: GameState): Design {
  return {
    components: s.buildings.map(b => ({ id: b.id, type: b.type, params: { ...b.params, ...(b.region && b.region !== MAIN ? { region: b.region } : {}), ...(defaultCatalog[b.type]?.scalesOut || (defaultCatalog[b.type]?.shardable && b.instances.length > 1) ? { instances: b.instances.length } : {}) } })),
    connections: s.links.map(l => [l.from, l.to]),
  };
}

// ───────── Connections ─────────
const typeOf = (s: GameState, id: string) => s.buildings.find(b => b.id === id)?.type;
const reaches = (links: Link[], from: string, to: string): boolean => from === to || links.some(l => l.from === from && reaches(links, l.to, to));
/** Why a connection is not allowed, or null when it is. */
export function linkProblem(s: GameState, from: string, to: string, catalog: Catalog = defaultCatalog): string | null {
  if (from === to) return 'self';
  if (to === CLIENT) return 'intoUsers';
  // Jobs reach a queue through an API, never straight from the users.
  if (from === CLIENT && catalog[typeOf(s, to) ?? '']?.queue) return 'queueNotPublic';
  // Posts reach a Topic through an API too: the users never write to it straight (ADR-0009).
  if (from === CLIENT && catalog[typeOf(s, to) ?? '']?.pubSub) return 'topicNotPublic';
  // The users reach Object Storage (uploads) and the CDN (downloads) straight, only for the files they carry: with none in the wave there is nothing to send.
  const direct = catalog[typeOf(s, to) ?? ''];
  if (from === CLIENT && direct?.acceptsClients && direct.accepts && !direct.accepts.some(type => s.waveTypes.includes(type))) return direct.accepts.includes(UPLOAD) ? 'uploadsOnly' : 'downloadsOnly';
  if (from !== CLIENT && !typeOf(s, from)) return 'missing';
  if (!typeOf(s, to)) return 'missing';
  const spec = catalog[typeOf(s, from) ?? ''];
  // A Region is a group of buildings: they connect inside it. Only the DNS (it stands in front of the Regions) and a Read Replica keeping
  // a copy of the primary database (replication) cross from one Region to another.
  const a = s.buildings.find(b => b.id === from), z = s.buildings.find(b => b.id === to);
  if (a && z && regionOf(a) !== regionOf(z) && !spec?.global && !catalog[z.type]?.global && !(spec?.follows && spec.follows === z.type)) return 'otherRegion';
  // A Read Replica ends requests, but it may be connected to the database it keeps a copy of (replication, no requests).
  if (spec && spec.endsRequests && !spec.shortcut && !(spec.follows && spec.follows === typeOf(s, to))) return 'endsRequests';
  if (s.links.some(l => l.from === from && l.to === to)) return 'exists';
  if (reaches(s.links, to, from)) return 'circle';
  return null;
}
/** Whether the users may connect to this building for only some Request Types (Object Storage for uploads, the CDN for downloads), not as the way in. */
const isDirectEntrance = (s: GameState, id: string) => {
  const spec = defaultCatalog[typeOf(s, id) ?? ''];
  return !!spec?.acceptsClients && !!spec.accepts;
};
const hasGeneralEntrance = (s: GameState) => s.links.some(l => l.from === CLIENT && !isDirectEntrance(s, l.to));
function addLink(s: GameState, from: string, to: string): GameState {
  if (linkProblem(s, from, to)) return s;
  // The users reach the system through one general entrance (a new one replaces the old), and may also have a direct one
  // to each building that takes only some Request Types (Object Storage for uploads, the CDN for downloads).
  const sameEntrance = (a: string, b: string) => isDirectEntrance(s, a) === isDirectEntrance(s, b) && (!isDirectEntrance(s, a) || typeOf(s, a) === typeOf(s, b));
  const links = from === CLIENT ? s.links.filter(l => l.from !== CLIENT || !sameEntrance(l.to, to)) : s.links;
  return { ...s, links: [...links, { from, to }] };
}
/** The player connects two buildings (or the users to one). */
export function connect(s: GameState, from: string, to: string): GameState {
  const reason = linkProblem(s, from, to);
  if (reason) return { ...s, events: log(s, { kind: 'refused', from, to, reason }) };
  return { ...addLink(s, from, to), events: log(s, { kind: 'linked', from, to }) };
}
export function disconnect(s: GameState, from: string, to: string): GameState {
  if (!s.links.some(l => l.from === from && l.to === to)) return s;
  return { ...s, links: s.links.filter(l => !(l.from === from && l.to === to)), events: log(s, { kind: 'unlinked', from, to }) };
}
/** The default wiring for a new building: what a player almost always wants. */
function autoLink(s: GameState, b: Building): GameState {
  // A building is wired to the ones in its own Region (and to the DNS, which belongs to none); only replication reaches another Region.
  const ofType = (type: string) => s.buildings.filter(x => x.type === type && x.id !== b.id && (defaultCatalog[x.type]?.global || regionOf(x) === regionOf(b)));
  const anyOfType = (type: string) => s.buildings.filter(x => x.type === type && x.id !== b.id);
  const dns = anyOfType('dns')[0];
  const outOf = (id: string) => s.links.some(l => l.from === id);
  const lb = ofType('loadBalancer')[0], apps = ofType('appServer'), cache = ofType('cache')[0], db = ofType('database')[0];
  const queue = ofType('messageQueue')[0], topic = ofType('topic')[0], workers = ofType('worker'), readReplicas = ofType('readReplica'), storage = ofType('objectStorage')[0], cdn = ofType('cdn')[0], gateway = ofType('apiGateway')[0];
  // An app server that already sends to a queue, a Worker or a Read Replica still needs its way to the data (the primary).
  const sendsOn = (st: GameState, id: string) => st.links.some(l => l.from === id && !['messageQueue', 'topic', 'worker', 'readReplica', 'objectStorage'].includes(typeOf(st, l.to) ?? ''));
  // A Worker that serves a Subscription finishes the posts itself (their work leaves the system), so it needs no way to the database.
  // Only the Feed Worker writes to the database: it writes each post into every follower's feed (ADR-0009).
  const writesToDatabase = (w: Building) => !w.params.subscription || w.params.subscription === s.feedSubscription;
  let next = s;
  // The API Gateway is the one door: when there is one, the users reach the load balancer or the app servers through it.
  if (b.type === 'dns') {
    // The DNS is the users' way in (behind the API Gateway when there is one), and sends them to the load balancer (or the app servers) of each Region.
    if (gateway) {
      // The DNS takes over from the load balancer or the app servers the gateway was sending to.
      next = { ...next, links: next.links.filter(l => !(l.from === gateway.id && typeOf(next, l.to) !== 'dns')) };
      next = addLink(next, gateway.id, b.id);
    } else next = addLink(next, CLIENT, b.id);
    for (const region of new Set(s.buildings.filter(x => !defaultCatalog[x.type]?.global).map(regionOf))) {
      const inRegion = (type: string) => s.buildings.filter(x => x.type === type && regionOf(x) === region);
      const entry = inRegion('loadBalancer')[0];
      if (entry) next = addLink(next, b.id, entry.id);
      else for (const a of inRegion('appServer')) next = addLink(next, b.id, a.id);
    }
  } else if (b.type === 'apiGateway') {
    next = addLink(next, CLIENT, b.id);
    // With a DNS the gateway stands in front of it; otherwise it passes the requests to the load balancer or the app servers.
    if (dns) next = addLink(next, b.id, dns.id);
    else if (lb) next = addLink(next, b.id, lb.id);
    else for (const a of apps) next = addLink(next, b.id, a.id);
  } else if (b.type === 'loadBalancer') {
    // The load balancer takes over from the app servers behind the DNS or the gateway.
    const door = dns ?? gateway;
    if (door) {
      next = { ...next, links: next.links.filter(l => !(l.from === door.id && typeOf(next, l.to) === 'appServer' && regionOf(next.buildings.find(x => x.id === l.to)!) === regionOf(b))) };
      next = addLink(next, door.id, b.id);
    } else if (regionOf(b) === MAIN) next = addLink(next, CLIENT, b.id);
    for (const a of apps) next = addLink(next, b.id, a.id);
  } else if (b.type === 'appServer') {
    if (lb) next = addLink(next, lb.id, b.id);
    else if (dns) next = addLink(next, dns.id, b.id);
    else if (gateway) next = addLink(next, gateway.id, b.id);
    else if (regionOf(b) === MAIN && !hasGeneralEntrance(next)) next = addLink(next, CLIENT, b.id);
    const data = cache ?? db;
    if (data) next = addLink(next, b.id, data.id);
    if (queue) next = addLink(next, b.id, queue.id);
    if (topic) next = addLink(next, b.id, topic.id);
    for (const r of readReplicas) next = addLink(next, b.id, r.id);
    if (storage) next = addLink(next, b.id, storage.id);
  } else if (b.type === 'cache') {
    // The cache goes in front of the database: app servers that went straight to it now go through the cache.
    if (db) next = { ...next, links: next.links.filter(l => !(l.to === db.id && typeOf(next, l.from) === 'appServer')) };
    for (const a of apps) if (!sendsOn(next, a.id)) next = addLink(next, a.id, b.id);
    if (db) next = addLink(next, b.id, db.id);
  } else if (b.type === 'database') {
    if (cache && !outOf(cache.id)) next = addLink(next, cache.id, b.id);
    else for (const a of apps) if (!sendsOn(next, a.id)) next = addLink(next, a.id, b.id);
    for (const w of workers) if (!outOf(w.id) && writesToDatabase(w)) next = addLink(next, w.id, b.id);
    for (const r of anyOfType('readReplica')) if (!outOf(r.id)) next = addLink(next, r.id, b.id);
  } else if (b.type === 'readReplica') {
    // Reads come from the app servers; the link to the database is the replication.
    for (const a of apps) next = addLink(next, a.id, b.id);
    // The copy comes from the primary database, wherever it stands (replication crosses Regions).
    const primary = anyOfType('database')[0];
    if (primary) next = addLink(next, b.id, primary.id);
  } else if (b.type === 'objectStorage') {
    // Files reach it through the app servers by default; connecting the users straight to it is the player's move.
    for (const a of apps) next = addLink(next, a.id, b.id);
    // A CDN already in place goes in front of it.
    if (cdn) next = addLink(next, cdn.id, b.id);
  } else if (b.type === 'cdn') {
    // The users download through the CDN, and what it does not answer goes to Object Storage.
    next = addLink(next, CLIENT, b.id);
    if (storage) next = addLink(next, b.id, storage.id);
  } else if (b.type === 'messageQueue') {
    for (const a of apps) next = addLink(next, a.id, b.id);
    for (const w of workers) next = addLink(next, b.id, w.id);
  } else if (b.type === 'topic') {
    for (const a of apps) next = addLink(next, a.id, b.id);
    for (const w of workers) if (w.params.subscription) next = addLink(next, b.id, w.id);
  } else if (b.type === 'worker') {
    if (queue) next = addLink(next, queue.id, b.id);
    if (topic && b.params.subscription) next = addLink(next, topic.id, b.id);
    if (db && writesToDatabase(b)) next = addLink(next, b.id, db.id);
  }
  return next;
}
/** Throws away the player's changes and connects everything the default way again. */
export function rewire(s: GameState): GameState {
  const empty = { ...s, links: [] as Link[], buildings: [] as Building[] };
  const wired = s.buildings.reduce((acc, b) => autoLink({ ...acc, buildings: [...acc.buildings, b] }, b), empty);
  return { ...s, links: wired.links };
}
export const setAutoLink = (s: GameState, on: boolean): GameState => ({ ...s, autoLink: on });

// ───────── Building ─────────
/** Why the player cannot build this type now, or null. */
/** The building of a type in a Region (the DNS, which belongs to none, is one for the whole design). */
const existingIn = (s: Pick<GameState, 'buildings'>, type: string, region: string, catalog: Catalog) =>
  s.buildings.find(b => b.type === type && (catalog[type]?.global || regionOf(b) === region));
/** The first Subscription of the level that no building serves yet, or null when every one has its Workers. */
const freeSubscription = (s: Pick<GameState, 'buildings'>, level: GameLevel) =>
  subscriptionsOf(level).find(sub => !s.buildings.some(b => b.params.subscription === sub)) ?? null;
/** In a level with Subscriptions, each building of a subscribing type serves one: building one makes a new building, not an instance. */
const onePerSubscription = (type: string, level: GameLevel, catalog: Catalog) => !!catalog[type]?.subscribes && subscriptionsOf(level).length > 0;
/**
 * Why the player cannot build this type now, or null. `target` is the building to add an instance to (from its inspector);
 * left out, the instance goes to the building of that type in the Region, or makes the first one.
 */
export function buildProblem(s: GameState, type: string, level: GameLevel, catalog: Catalog = defaultCatalog, region: string = MAIN, target?: string): string | null {
  if (s.phase === 'won' || s.phase === 'lost') return 'over';
  if (!level.allowedComponents.includes(type)) return 'notInLevel';
  const existing = target ? s.buildings.find(b => b.id === target && b.type === type) : onePerSubscription(type, level, catalog) ? undefined : existingIn(s, type, region, catalog);
  // Every Subscription already has its Worker: more capacity is an instance of one of them, added from its inspector.
  if (!existing && onePerSubscription(type, level, catalog) && !freeSubscription(s, level)) return 'allSubscribed';
  // A database can have several instances only as Shards, in a level that offers Shard Keys.
  if (existing && !catalog[type]!.scalesOut && !(catalog[type]!.shardable && level.play.shardKeys)) return 'built';
  const max = level.componentOptions[type]?.maxInstances ?? 8;
  if (existing && existing.instances.length >= max) return 'maxInstances';
  if (s.money < instancePrice(existing ?? { type, params: {} }, catalog)) return 'money';
  return null;
}
/**
 * Builds one more of a type: a new building, or one more instance of an app server that already exists. In a level with
 * Subscriptions a new Worker serves the first Subscription that has none; `target` adds an instance to a given building.
 */
export function build(s: GameState, type: string, level: GameLevel, catalog: Catalog = defaultCatalog, region: string = MAIN, target?: string): GameState {
  if (buildProblem(s, type, level, catalog, region, target)) return s;
  const time = buildTime(type, catalog);
  const instance: Instance = { buildLeftS: time, buildTotalS: time, down: false };
  const existing = target ? s.buildings.find(b => b.id === target) : onePerSubscription(type, level, catalog) ? undefined : existingIn(s, type, region, catalog);
  if (existing) {
    return { ...s, money: s.money - instancePrice(existing, catalog),
      buildings: s.buildings.map(b => (b === existing ? { ...b, instances: [...b.instances, instance] } : b)),
      events: log(s, { kind: 'building', type, id: existing.id }) };
  }
  const sub = onePerSubscription(type, level, catalog) ? freeSubscription(s, level) : null;
  const b: Building = { id: `${type}-${s.nextId}`, type, params: sub ? { subscription: sub } : {}, ...(region !== MAIN && !catalog[type]?.global ? { region } : {}), instances: [instance] };
  const next: GameState = { ...s, money: s.money - instancePrice(b, catalog), nextId: s.nextId + 1, buildings: [...s.buildings, b],
    events: log(s, { kind: 'building', type, id: b.id }) };
  return s.autoLink ? autoLink(next, b) : next;
}
/** Removes one instance (the last one removes the building and its connections), giving part of the price back. */
export function demolish(s: GameState, id: string, catalog: Catalog = defaultCatalog): GameState {
  const b = s.buildings.find(x => x.id === id); if (!b) return s;
  // The Backlog is never dropped: a queue that still holds Messages stays until the Workers have taken them.
  if (catalog[b.type]?.queue && (s.backlog[id] ?? 0) >= EMPTY_BACKLOG) return { ...s, events: log(s, { kind: 'refused', reason: 'queueHoldsMessages' }) };
  // Nor are the posts a Topic keeps for its Subscriptions.
  if (catalog[b.type]?.pubSub && Object.values(s.subBacklog).some(v => v >= EMPTY_BACKLOG)) return { ...s, events: log(s, { kind: 'refused', reason: 'topicHoldsMessages' }) };
  const back = Math.round(instancePrice(b, catalog) * REFUND);
  // The instance that goes is the least useful one: a fallen one, then one still being built, then the last.
  const order = [b.instances.findIndex(i => i.down), b.instances.findIndex(i => i.buildLeftS > 0), b.instances.length - 1];
  const gone = order.find(k => k >= 0)!;
  const left = b.instances.filter((_, k) => k !== gone);
  return {
    ...s, money: s.money + back,
    buildings: left.length ? s.buildings.map(x => (x === b ? { ...x, instances: left } : x)) : s.buildings.filter(x => x !== b),
    links: left.length ? s.links : s.links.filter(l => l.from !== id && l.to !== id),
    events: log(s, { kind: 'removed', type: b.type, id, amount: back }),
  };
}
/** What changing to another size costs: the new price for every instance, minus part of the old one. */
export const resizeCost = (b: Building, size: string, catalog: Catalog = defaultCatalog) =>
  (instancePrice({ ...b, params: { ...b.params, size } }, catalog) - Math.round(instancePrice(b, catalog) * REFUND)) * b.instances.length;
/** Changes the size (app servers) or tier (databases): pay, then every instance is rebuilt, fallen ones included. */
export function resize(s: GameState, id: string, size: string, catalog: Catalog = defaultCatalog): GameState {
  const b = s.buildings.find(x => x.id === id);
  if (!b || (b.params.size ?? catalog[b.type]!.defaultSize) === size || !catalog[b.type]!.sizes?.[size]) return s;
  const cost = resizeCost(b, size, catalog);
  if (s.money < cost) return s;
  const time = buildTime(b.type, catalog);
  return {
    ...s, money: s.money - cost,
    buildings: s.buildings.map(x => (x === b ? { ...x, params: { ...x.params, size }, instances: x.instances.map(() => ({ buildLeftS: time, buildTotalS: time, down: false })) } : x)),
    events: log(s, { kind: 'resized', type: b.type, id }),
  };
}
/**
 * Picks the Shard Key of a database. Only in the build phase: in real life re-sharding means moving data and downtime,
 * so once the wave has started the key is locked.
 */
export function setShardKey(s: GameState, id: string, key: string, level: GameLevel): GameState {
  if (!level.play.shardKeys?.[key] || !s.buildings.some(b => b.id === id)) return s;
  if (s.phase !== 'build') return { ...s, events: log(s, { kind: 'refused', reason: 'shardKeyLocked' }) };
  return { ...s, buildings: s.buildings.map(b => (b.id === id ? { ...b, params: { ...b.params, shardKey: key } } : b)) };
}
/**
 * Picks the Subscription a Worker serves (its consumer group). Only in the build phase: a group that changes its name in real life
 * starts again from a new place in the Topic, so once the wave has started it is locked (ADR-0009).
 */
export function setSubscription(s: GameState, id: string, subscription: string, level: GameLevel): GameState {
  if (!level.play.subscriptions?.[subscription] || !s.buildings.some(b => b.id === id && defaultCatalog[b.type]?.subscribes)) return s;
  if (s.phase !== 'build') return { ...s, events: log(s, { kind: 'refused', reason: 'subscriptionLocked' }) };
  return { ...s, buildings: s.buildings.map(b => (b.id === id ? { ...b, params: { ...b.params, subscription } } : b)) };
}
/** The most Partitions a Topic may have in a level. */
export const maxPartitions = (level: Pick<GameLevel, 'componentOptions'>) => level.componentOptions['topic']?.limits?.['partitions'] ?? 12;
/**
 * Sets how many Partitions a Topic has. Only in the build phase: in Kafka, adding Partitions moves keys to other Partitions,
 * so teams plan them before going live (ADR-0009). Each Partition costs a little every month.
 */
export function setPartitions(s: GameState, id: string, partitions: number, level: GameLevel): GameState {
  const b = s.buildings.find(x => x.id === id);
  if (!b || !defaultCatalog[b.type]?.partitions || partitions < 1 || partitions > maxPartitions(level)) return s;
  if (s.phase !== 'build') return { ...s, events: log(s, { kind: 'refused', reason: 'partitionsLocked' }) };
  return { ...s, buildings: s.buildings.map(x => (x.id === id ? { ...x, params: { ...x.params, partitions } } : x)) };
}
/** Picks the Partition Key of a Topic. Only in the build phase, like the Shard Key: changing it moves posts to other Partitions. */
export function setPartitionKey(s: GameState, id: string, key: string, level: GameLevel): GameState {
  if (!level.play.partitionKeys?.[key] || !s.buildings.some(b => b.id === id && defaultCatalog[b.type]?.partitions)) return s;
  if (s.phase !== 'build') return { ...s, events: log(s, { kind: 'refused', reason: 'partitionKeyLocked' }) };
  return { ...s, buildings: s.buildings.map(b => (b.id === id ? { ...b, params: { ...b.params, partitionKey: key } } : b)) };
}
/** Sets the Celebrity Limit of a Feed Worker, in followers, or none (undefined): free and immediate, a change of configuration. */
export function setCelebrityLimit(s: GameState, id: string, limit: number | undefined): GameState {
  const b = s.buildings.find(x => x.id === id), spec = b && defaultCatalog[b.type]?.celebrityLimit;
  if (!spec || (limit !== undefined && !spec.options.includes(limit))) return s;
  return { ...s, buildings: s.buildings.map(x => { if (x.id !== id) return x; const { celebrityLimit: _old, ...params } = x.params; return { ...x, params: limit === undefined ? params : { ...params, celebrityLimit: limit } }; }) };
}
/** Changes the Client Limit of an API Gateway, in requests per second for each client: free and immediate. */
export const setClientLimit = (s: GameState, id: string, limitRps: number): GameState =>
  ({ ...s, buildings: s.buildings.map(b => (b.id === id ? { ...b, params: { ...b.params, limitRps } } : b)) });
/** Changes a cache's TTL: free and immediate. */
export const setTtl = (s: GameState, id: string, ttlS: number): GameState =>
  ({ ...s, buildings: s.buildings.map(b => (b.id === id ? { ...b, params: { ...b.params, ttlS } } : b)) });

/** Calls the users now instead of waiting: the wave starts and the skipped seconds pay a bonus. */
export function callNow(s: GameState): GameState {
  if (s.phase !== 'build') return s;
  const bonus = Math.round((BUILD_PHASE_S - s.t) * EARLY_BONUS_PER_S);
  return { ...s, t: BUILD_PHASE_S, phase: 'wave', money: s.money + bonus, events: log({ ...s, t: BUILD_PHASE_S }, { kind: 'early', amount: bonus }) };
}

// ───────── Time ─────────
/** Moves the game forward by `dt` seconds (keep dt small, e.g. 0.1). */
export function step(s0: GameState, dt: number, level: GameLevel, catalog: Catalog = defaultCatalog): GameState {
  if (s0.phase === 'won' || s0.phase === 'lost') return s0;
  let s: GameState = { ...s0, t: s0.t + dt };
  const events: Omit<GameEvent, 't'>[] = [];
  // Construction.
  s.buildings = s.buildings.map(b => {
    if (!b.instances.some(i => i.buildLeftS > 0)) return b;
    return { ...b, instances: b.instances.map(i => {
      if (i.buildLeftS <= 0) return i;
      const left = i.buildLeftS - dt;
      if (left <= 0) events.push({ kind: 'ready', type: b.type, id: b.id });
      return { ...i, buildLeftS: Math.max(0, left) };
    }) };
  });
  // The wave starts after the build phase.
  if (s.phase === 'build' && s.t >= BUILD_PHASE_S) { s.phase = 'wave'; events.push({ kind: 'wave' }); }
  // The scripted incident.
  const incident = level.play.incident;
  if (s.phase === 'wave' && incident?.region && !s.incidentDone && s.t >= BUILD_PHASE_S + incident.atS) {
    // A whole Region falls: every instance of every building in it goes down for good. The DNS, if there is one and a Region to go to,
    // will switch the users after its TTL (ADR-0008).
    s.buildings = s.buildings.map(b => (regionOf(b) === incident.region && !catalog[b.type]?.global ? { ...b, instances: b.instances.map(i => ({ ...i, down: true })) } : b));
    const door = s.buildings.find(b => catalog[b.type]?.failover);
    const hasStandby = s.buildings.some(b => regionOf(b) !== incident.region && !catalog[b.type]?.global);
    const ttl = door ? Number(door.params.ttlS ?? catalog[door.type]!.failover!.defaultValue) : null;
    s.failover = { downAt: s.t, switchAt: door && hasStandby && ttl !== null ? s.t + ttl : null, switched: false };
    events.push({ kind: 'regionDown' });
    s.incidentDone = true;
  } else if (s.phase === 'wave' && incident?.componentType && !s.incidentDone && s.t >= BUILD_PHASE_S + incident.atS) {
    const target = s.buildings.find(b => b.type === incident.componentType && b.instances.some(i => i.buildLeftS <= 0 && !i.down));
    if (target) {
      const k = target.instances.findIndex(i => i.buildLeftS <= 0 && !i.down);
      s.buildings = s.buildings.map(b => (b === target ? { ...b, instances: b.instances.map((i, n) => (n === k ? { ...i, down: true } : i)) } : b));
      events.push({ kind: 'incident', type: target.type, id: target.id });
      // A consumer group that loses an instance stops for a moment while the others take over its Partitions (a rebalance).
      if (target.params.subscription) { s.rebalance = { ...s.rebalance, [target.id]: s.t + REBALANCE_S }; events.push({ kind: 'rebalance', id: target.id }); }
    }
    s.incidentDone = true;
  }
  // The DNS switches the users to the standby Region once its TTL has passed; the standby Read Replica becomes the primary database.
  if (s.failover.switchAt !== null && !s.failover.switched && s.t >= s.failover.switchAt) {
    s.failover = { ...s.failover, switched: true };
    s.buildings = s.buildings.map(b => (b.type === 'readReplica' && regionOf(b) === STANDBY ? { ...b, type: 'promotedReplica' } : b));
    events.push({ kind: 'failover' });
  }
  // The celebrity's moment: for a while, a share of the posts come from accounts with a huge number of followers.
  const celeb = level.play.feed?.celebrity;
  const celebNow = !!celeb && s.phase === 'wave' && s.t >= BUILD_PHASE_S + celeb.atS && s.t < BUILD_PHASE_S + celeb.atS + celeb.lengthS;
  if (celeb && s.phase === 'wave' && s0.t < BUILD_PHASE_S + celeb.atS && s.t >= BUILD_PHASE_S + celeb.atS) events.push({ kind: 'celebrity' });
  const feed = level.play.feed && { subscription: level.play.feed.subscription, followers: level.play.feed.followers, follows: level.play.feed.follows,
    ...(celeb ? { celebrity: { share: celebNow ? celeb.share : 0, followers: celeb.followers, followed: celeb.followed } } : {}) };
  // While a group rebalances, none of its instances reads.
  const rebalancing = (b: Building) => (s.rebalance[b.id] ?? -1) > s.t;
  const working = s.buildings.map(b => (rebalancing(b) ? { ...b, instances: b.instances.map(i => ({ ...i, down: true })) } : b));
  // Traffic, money and reputation.
  const rps = s.phase === 'wave' ? level.play.wave.rps : 0;
  const subs = subscriptionsOf(level);
  const flow = solve(working, s.links, rps, catalog, level.play.wave.mix, { backlog: s.backlog, dt, unapplied: s.unapplied, subBacklog: s.subBacklog, partBacklog: s.partBacklog }, level.play.shardKeys, level.play.clients, { active: s.failover.switched ? STANDBY : MAIN }, subs, level.play.partitionKeys, feed);
  s.unapplied = flow.unapplied;
  s.lag = flow.lag;
  s.flow = flow;
  s.backlog = flow.backlog;
  s.queueAge = Object.fromEntries(Object.entries(flow.backlog).map(([id, waiting]) => {
    const rate = flow.releaseCapacity[id] ?? 0;
    return [id, waiting < EMPTY_BACKLOG ? 0 : rate > 0 ? waiting / rate : (s0.queueAge[id] ?? 0) + dt];
  }));
  // The Consumer Lag of each Subscription: its Backlog over the rate its Workers take posts, or growing with the clock when none takes them.
  s.subBacklog = flow.subBacklog;
  s.partBacklog = flow.partBacklog;
  s.consumerLag = Object.fromEntries(subs.map(sub => {
    const waiting = flow.subBacklog[sub] ?? 0, rate = flow.subCapacity[sub] ?? 0;
    return [sub, waiting < EMPTY_BACKLOG ? 0 : rate > 0 ? waiting / rate : (s0.consumerLag[sub] ?? 0) + dt];
  }));
  const consumersBehind = subs.some(sub => (s.consumerLag[sub] ?? 0) > level.play.subscriptions![sub]!.maxLagS);
  const maxAge = level.requirements.maxQueueAgeS;
  const tooOld = maxAge !== undefined && Object.values(s.queueAge).some(age => age > maxAge);
  const maxLag = level.requirements.maxReplicationLagS;
  const lagTooHigh = maxLag !== undefined && Object.values(s.lag).some(l => l > maxLag);
  // A CDN that keeps copies longer than the level allows shows users old content: reputation falls, as for a slow base.
  const maxStale = level.requirements.maxStaleS;
  const tooStale = maxStale !== undefined && contentAge(s, catalog) > maxStale;
  s.visits += flow.answered * dt;
  s.money += (PASSIVE_INCOME + (flow.answered / 100) * PER_100_VISITS - upkeepPerS(s, catalog)) * dt;
  if (rps || s.phase === 'drain') {
    const change = flow.errors > level.requirements.maxErrorRate ? REPUTATION.failing : flow.p95 > level.requirements.p95Ms || tooOld || lagTooHigh || tooStale || consumersBehind ? REPUTATION.slow : REPUTATION.fine;
    s.reputation = Math.max(0, Math.min(100, s.reputation + change * dt));
  }
  if (Math.floor(s.t) !== Math.floor(s0.t)) s.history = [...s.history, { t: Math.floor(s.t), rps, p95: flow.p95, errors: flow.errors, age: Math.max(0, ...Object.values(s.queueAge)), backlog: totalBacklog(s), lag: Math.max(0, ...Object.values(s.lag)), ...(subs.length ? { consumerLag: { ...s.consumerLag } } : {}) }];
  // End.
  if ((s.phase === 'wave' || s.phase === 'drain') && s.reputation <= 0) { s.phase = 'lost'; events.push({ kind: 'lost', reason: 'reputation' }); }
  else if (s.money < 0) { s.phase = 'lost'; events.push({ kind: 'lost', reason: 'money' }); }
  // After the wave, Messages still waiting in a queue keep the game going until Workers have taken them all (the Drain Phase).
  else if (s.phase === 'wave' && s.t >= waveEnd(level)) {
    if (totalBacklog(s) < EMPTY_BACKLOG) { s.phase = 'won'; events.push({ kind: 'won' }); } else { s.phase = 'drain'; events.push({ kind: 'drain' }); }
  } else if (s.phase === 'drain' && totalBacklog(s) < EMPTY_BACKLOG) { s.phase = 'won'; events.push({ kind: 'won' }); }
  if (events.length) s.events = [...s.events, ...events.map(e => ({ t: s.t, ...e }))].slice(-40);
  return s;
}
/** Plays `seconds` in small steps (tests, and catching up after a slow frame). */
export function run(s: GameState, seconds: number, level: GameLevel, catalog: Catalog = defaultCatalog): GameState {
  let next = s;
  const n = Math.ceil(seconds / 0.1);
  for (let i = 0; i < n; i++) next = step(next, seconds / n, level, catalog);
  return next;
}
/** Plays on until the game is won or lost (the Drain Phase may run past the wave), for at most `limitS` seconds. */
export function runToEnd(s: GameState, level: GameLevel, limitS = 900, catalog: Catalog = defaultCatalog): GameState {
  let next = s;
  for (let spent = 0; spent < limitS && next.phase !== 'won' && next.phase !== 'lost'; spent++) next = run(next, 1, level, catalog);
  return next;
}
/** 1 star for lasting the wave, one more for each money threshold reached; 0 when lost. */
export const starsOf = (s: GameState, level: GameLevel) =>
  s.phase === 'won' ? 1 + level.play.starMoney.filter(m => s.money >= m).length : 0;
