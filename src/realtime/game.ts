import { catalog as defaultCatalog, DEFAULT_REQUEST_TYPE } from '../catalog/catalog';
import type { Catalog, Design } from '../engine/types';
import { CLIENT, instancePrice, solve, type Building, type Flow, type Instance, type Link, type ShardKeys } from './flow';

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
/** A Backlog under this (half a Message) counts as empty. */
export const EMPTY_BACKLOG = 0.5;

export type Play = {
  startMoney: number;
  /** `mix`: the share of each Request Type in the wave (adds up to 1); left out, all traffic is one type. */
  wave: { rps: number; lengthS: number; mix?: Record<string, number> };
  /** At `atS` seconds into the wave, one serving instance of the first `componentType` goes down. */
  incident?: { atS: number; componentType: string };
  /** Money left at the end for the 2nd, 3rd… star. */
  starMoney: number[];
  /** Levels that teach Sharding: the Shard Keys on offer and how traffic spreads over the values of each (ADR-0007). The first is the default. */
  shardKeys?: ShardKeys;
};
export type GameLevel = {
  allowedComponents: string[];
  componentOptions: Record<string, { sizes?: string[]; maxInstances?: number; limits?: Record<string, number> }>;
  requirements: { p95Ms: number; maxErrorRate: number; /** The longest the oldest Message may wait in a queue, in seconds. */ maxQueueAgeS?: number };
  play: Play;
};

/** What happened, for the message log; the UI turns each kind into text. */
export type GameEvent = { t: number; kind: 'building' | 'ready' | 'wave' | 'drain' | 'early' | 'incident' | 'removed' | 'resized' | 'linked' | 'unlinked' | 'refused' | 'won' | 'lost';
  type?: string; id?: string; from?: string; to?: string; amount?: number; reason?: string };
/** One second of the run, for the charts: `age` is the oldest Message in any queue (s), `backlog` the Messages waiting in all of them. */
export type Sample = { t: number; rps: number; p95: number; errors: number; age: number; backlog: number };
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
  history: Sample[];
  events: GameEvent[];
  nextId: number;
};

const buildTime = (type: string, catalog: Catalog) => catalog[type]?.buildS ?? 5;
const ready = (n: number): Instance[] => Array.from({ length: n }, () => ({ buildLeftS: 0, buildTotalS: 0, down: false }));
const log = (s: GameState, e: Omit<GameEvent, 't'>): GameEvent[] => [...s.events, { t: s.t, ...e }].slice(-40);
export const waveEnd = (level: GameLevel) => BUILD_PHASE_S + level.play.wave.lengthS;
/** Messages waiting in all queues. */
export const totalBacklog = (s: Pick<GameState, 'backlog'>) => Object.values(s.backlog).reduce((a, v) => a + v, 0);
export const upkeepPerS = (s: Pick<GameState, 'buildings'>, catalog: Catalog = defaultCatalog) =>
  s.buildings.reduce((sum, b) => sum + instancePrice(b, catalog) * b.instances.length, 0) / UPKEEP_DIVISOR;

/** A new game: the level's money, and the mode's starting design already built and connected. */
export function createGame(level: GameLevel, design: Design): GameState {
  const buildings: Building[] = design.components.map(c => ({
    id: c.id, type: c.type,
    params: { ...(c.params?.size ? { size: String(c.params.size) } : {}), ...(c.params?.ttlS !== undefined ? { ttlS: Number(c.params.ttlS) } : {}), ...(c.params?.shardKey ? { shardKey: String(c.params.shardKey) } : {}) },
    instances: ready(Math.max(1, Number(c.params?.instances ?? 1))),
  }));
  const s: GameState = { t: 0, phase: 'build', money: level.play.startMoney, reputation: 100, buildings, links: [], autoLink: true,
    waveTypes: Object.keys(level.play.wave.mix ?? { [DEFAULT_REQUEST_TYPE]: 1 }),
    visits: 0, incidentDone: false, flow: null, backlog: {}, queueAge: {}, history: [], events: [], nextId: design.components.length + 1 };
  // Keep the design's connections, in order, skipping any the rules refuse (a broken design may hold one).
  return design.connections.reduce((acc, [from, to]) => (linkProblem(acc, from, to) ? acc : { ...acc, links: [...acc.links, { from, to }] }), s);
}

/** The design on the map, to save it or show it in the player's Base. */
export function toDesign(s: GameState): Design {
  return {
    components: s.buildings.map(b => ({ id: b.id, type: b.type, params: { ...b.params, ...(defaultCatalog[b.type]?.scalesOut || (defaultCatalog[b.type]?.shardable && b.instances.length > 1) ? { instances: b.instances.length } : {}) } })),
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
  // The users reach Object Storage straight, for uploads only: with no uploads in the wave there is nothing to send it.
  const direct = catalog[typeOf(s, to) ?? ''];
  if (from === CLIENT && direct?.acceptsClients && direct.accepts && !direct.accepts.some(type => s.waveTypes.includes(type))) return 'uploadsOnly';
  if (from !== CLIENT && !typeOf(s, from)) return 'missing';
  if (!typeOf(s, to)) return 'missing';
  const spec = catalog[typeOf(s, from) ?? ''];
  // A Read Replica ends requests, but it may be connected to the database it keeps a copy of (replication, no requests).
  if (spec && spec.endsRequests && !spec.shortcut && !(spec.follows && spec.follows === typeOf(s, to))) return 'endsRequests';
  if (s.links.some(l => l.from === from && l.to === to)) return 'exists';
  if (reaches(s.links, to, from)) return 'circle';
  return null;
}
/** Whether the users may connect to this building for only some Request Types (Object Storage, for uploads), not as the way in. */
const isDirectEntrance = (s: GameState, id: string) => {
  const spec = defaultCatalog[typeOf(s, id) ?? ''];
  return !!spec?.acceptsClients && !!spec.accepts;
};
const hasGeneralEntrance = (s: GameState) => s.links.some(l => l.from === CLIENT && !isDirectEntrance(s, l.to));
function addLink(s: GameState, from: string, to: string): GameState {
  if (linkProblem(s, from, to)) return s;
  // The users reach the system through one general entrance (a new one replaces the old), and may also have a direct one
  // to a building that takes only some Request Types (Object Storage, for uploads).
  const links = from === CLIENT ? s.links.filter(l => l.from !== CLIENT || isDirectEntrance(s, l.to) !== isDirectEntrance(s, to)) : s.links;
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
  const ofType = (type: string) => s.buildings.filter(x => x.type === type && x.id !== b.id);
  const outOf = (id: string) => s.links.some(l => l.from === id);
  const lb = ofType('loadBalancer')[0], apps = ofType('appServer'), cache = ofType('cache')[0], db = ofType('database')[0];
  const queue = ofType('messageQueue')[0], workers = ofType('worker'), readReplicas = ofType('readReplica'), storage = ofType('objectStorage')[0];
  // An app server that already sends to a queue, a Worker or a Read Replica still needs its way to the data (the primary).
  const sendsOn = (st: GameState, id: string) => st.links.some(l => l.from === id && !['messageQueue', 'worker', 'readReplica', 'objectStorage'].includes(typeOf(st, l.to) ?? ''));
  let next = s;
  if (b.type === 'loadBalancer') {
    next = addLink(next, CLIENT, b.id);
    for (const a of apps) next = addLink(next, b.id, a.id);
  } else if (b.type === 'appServer') {
    if (lb) next = addLink(next, lb.id, b.id);
    else if (!hasGeneralEntrance(next)) next = addLink(next, CLIENT, b.id);
    const data = cache ?? db;
    if (data) next = addLink(next, b.id, data.id);
    if (queue) next = addLink(next, b.id, queue.id);
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
    for (const w of workers) if (!outOf(w.id)) next = addLink(next, w.id, b.id);
    for (const r of readReplicas) if (!outOf(r.id)) next = addLink(next, r.id, b.id);
  } else if (b.type === 'readReplica') {
    // Reads come from the app servers; the link to the database is the replication.
    for (const a of apps) next = addLink(next, a.id, b.id);
    if (db) next = addLink(next, b.id, db.id);
  } else if (b.type === 'objectStorage') {
    // Files reach it through the app servers by default; connecting the users straight to it is the player's move.
    for (const a of apps) next = addLink(next, a.id, b.id);
  } else if (b.type === 'messageQueue') {
    for (const a of apps) next = addLink(next, a.id, b.id);
    for (const w of workers) next = addLink(next, b.id, w.id);
  } else if (b.type === 'worker') {
    if (queue) next = addLink(next, queue.id, b.id);
    if (db) next = addLink(next, b.id, db.id);
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
export function buildProblem(s: GameState, type: string, level: GameLevel, catalog: Catalog = defaultCatalog): string | null {
  if (s.phase === 'won' || s.phase === 'lost') return 'over';
  if (!level.allowedComponents.includes(type)) return 'notInLevel';
  const existing = s.buildings.find(b => b.type === type);
  // A database can have several instances only as Shards, in a level that offers Shard Keys.
  if (existing && !catalog[type]!.scalesOut && !(catalog[type]!.shardable && level.play.shardKeys)) return 'built';
  const max = level.componentOptions[type]?.maxInstances ?? 8;
  if (existing && existing.instances.length >= max) return 'maxInstances';
  if (s.money < instancePrice(existing ?? { type, params: {} }, catalog)) return 'money';
  return null;
}
/** Builds one more of a type: a new building, or one more instance of an app server that already exists. */
export function build(s: GameState, type: string, level: GameLevel, catalog: Catalog = defaultCatalog): GameState {
  if (buildProblem(s, type, level, catalog)) return s;
  const time = buildTime(type, catalog);
  const instance: Instance = { buildLeftS: time, buildTotalS: time, down: false };
  const existing = s.buildings.find(b => b.type === type);
  if (existing) {
    return { ...s, money: s.money - instancePrice(existing, catalog),
      buildings: s.buildings.map(b => (b === existing ? { ...b, instances: [...b.instances, instance] } : b)),
      events: log(s, { kind: 'building', type, id: existing.id }) };
  }
  const b: Building = { id: `${type}-${s.nextId}`, type, params: {}, instances: [instance] };
  const next: GameState = { ...s, money: s.money - instancePrice(b, catalog), nextId: s.nextId + 1, buildings: [...s.buildings, b],
    events: log(s, { kind: 'building', type, id: b.id }) };
  return s.autoLink ? autoLink(next, b) : next;
}
/** Removes one instance (the last one removes the building and its connections), giving part of the price back. */
export function demolish(s: GameState, id: string, catalog: Catalog = defaultCatalog): GameState {
  const b = s.buildings.find(x => x.id === id); if (!b) return s;
  // The Backlog is never dropped: a queue that still holds Messages stays until the Workers have taken them.
  if (catalog[b.type]?.queue && (s.backlog[id] ?? 0) >= EMPTY_BACKLOG) return { ...s, events: log(s, { kind: 'refused', reason: 'queueHoldsMessages' }) };
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
  if (s.phase === 'wave' && incident && !s.incidentDone && s.t >= BUILD_PHASE_S + incident.atS) {
    const target = s.buildings.find(b => b.type === incident.componentType && b.instances.some(i => i.buildLeftS <= 0 && !i.down));
    if (target) {
      const k = target.instances.findIndex(i => i.buildLeftS <= 0 && !i.down);
      s.buildings = s.buildings.map(b => (b === target ? { ...b, instances: b.instances.map((i, n) => (n === k ? { ...i, down: true } : i)) } : b));
      events.push({ kind: 'incident', type: target.type, id: target.id });
    }
    s.incidentDone = true;
  }
  // Traffic, money and reputation.
  const rps = s.phase === 'wave' ? level.play.wave.rps : 0;
  const flow = solve(s.buildings, s.links, rps, catalog, level.play.wave.mix, { backlog: s.backlog, dt }, level.play.shardKeys);
  s.flow = flow;
  s.backlog = flow.backlog;
  s.queueAge = Object.fromEntries(Object.entries(flow.backlog).map(([id, waiting]) => {
    const rate = flow.releaseCapacity[id] ?? 0;
    return [id, waiting < EMPTY_BACKLOG ? 0 : rate > 0 ? waiting / rate : (s0.queueAge[id] ?? 0) + dt];
  }));
  const maxAge = level.requirements.maxQueueAgeS;
  const tooOld = maxAge !== undefined && Object.values(s.queueAge).some(age => age > maxAge);
  s.visits += flow.answered * dt;
  s.money += (PASSIVE_INCOME + (flow.answered / 100) * PER_100_VISITS - upkeepPerS(s, catalog)) * dt;
  if (rps || s.phase === 'drain') {
    const change = flow.errors > level.requirements.maxErrorRate ? REPUTATION.failing : flow.p95 > level.requirements.p95Ms || tooOld ? REPUTATION.slow : REPUTATION.fine;
    s.reputation = Math.max(0, Math.min(100, s.reputation + change * dt));
  }
  if (Math.floor(s.t) !== Math.floor(s0.t)) s.history = [...s.history, { t: Math.floor(s.t), rps, p95: flow.p95, errors: flow.errors, age: Math.max(0, ...Object.values(s.queueAge)), backlog: totalBacklog(s) }];
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
