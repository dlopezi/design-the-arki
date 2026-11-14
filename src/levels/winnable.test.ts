import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { build, BUILD_PHASE_S, connect, createGame, demolish, resize, rewire, runToEnd, setClientLimit, setCelebrityLimit, setPartitionKey, setPartitions, setShardKey, setSubscription, setTtl, starsOf, type GameState } from '../realtime/game';
import { MAIN, regionOf } from '../realtime/flow';
import { allLevels, type LevelDefinition } from './levels';
import { MODES, startingDesign, type Mode } from './modes';

/**
 * A scripted player: from the mode's starting design, in the build phase, with the level's money and real build
 * times, turn the map into the level's reference design (take away what is not in it, build, add instances, resize,
 * set the TTL, connect the default way), then wait until the game ends (the Drain Phase may run past the wave).
 */
function playToReference(level: LevelDefinition, mode: Mode): { state: GameState; log: string[] } {
  let s = createGame(level, startingDesign(level, mode));
  const log: string[] = [];
  const want = level.referenceDesign.components;
  // Take away what the reference does not use, and duplicates of a type (the reference has one building per type, or per
  // Subscription for Workers in a pub/sub level).
  const regionOfRef = (c: { params?: Record<string, unknown> }) => String(c.params?.region ?? MAIN);
  const subOfRef = (c: { params?: Record<string, unknown> }) => (c.params?.subscription === undefined ? undefined : String(c.params.subscription));
  const sameSpot = (x: { type: string; region?: string; params?: { subscription?: string } }, type: string, region: string, sub?: string) =>
    x.type === type && (catalog[type]!.global || regionOf(x) === region) && x.params?.subscription === sub;
  for (const b of [...s.buildings]) {
    const first = s.buildings.find(x => sameSpot(x, b.type, regionOf(b), b.params.subscription));
    if (!want.some(c => sameSpot({ type: c.type, region: regionOfRef(c), params: { subscription: subOfRef(c) } }, b.type, regionOf(b), b.params.subscription)) || first !== b) {
      while (s.buildings.some(x => x.id === b.id)) s = demolish(s, b.id);
      log.push(`demolish ${b.id}`);
    }
  }
  for (const c of want) {
    const region = regionOfRef(c), sub = subOfRef(c);
    if (!s.buildings.some(b => sameSpot(b, c.type, region, sub))) {
      const before = new Set(s.buildings.map(b => b.id));
      s = build(s, c.type, level, undefined, region); log.push(`build ${c.type}`);
      // A new Worker serves the first free Subscription: the player then picks the one it should serve.
      const made = s.buildings.find(b => !before.has(b.id));
      if (made && sub !== undefined) s = setSubscription(s, made.id, sub, level);
    }
    const b = () => s.buildings.find(x => sameSpot(x, c.type, region, sub));
    if (!b()) { log.push(`could not build ${c.type} with $${Math.floor(s.money)}`); continue; }
    const size = String(c.params?.size ?? catalog[c.type]!.defaultSize);
    if ((b()!.params.size ?? catalog[c.type]!.defaultSize) !== size) { s = resize(s, b()!.id, size); log.push(`resize ${c.type} to ${size}`); }
    const instances = Number(c.params?.instances ?? 1);
    while (b()!.instances.length < instances) {
      const before = b()!.instances.length;
      s = build(s, c.type, level, undefined, region, b()!.id);
      if (b()!.instances.length === before) { log.push(`could not add a ${c.type} instance with $${Math.floor(s.money)}`); break; }
    }
    if (c.params?.ttlS !== undefined) s = setTtl(s, b()!.id, Number(c.params.ttlS));
    if (c.params?.limitRps !== undefined) s = setClientLimit(s, b()!.id, Number(c.params.limitRps));
    if (c.params?.shardKey !== undefined) s = setShardKey(s, b()!.id, String(c.params.shardKey), level);
    if (c.params?.partitions !== undefined) s = setPartitions(s, b()!.id, Number(c.params.partitions), level);
    if (c.params?.partitionKey !== undefined) s = setPartitionKey(s, b()!.id, String(c.params.partitionKey), level);
    if (c.params?.celebrityLimit !== undefined) s = setCelebrityLimit(s, b()!.id, Number(c.params.celebrityLimit));
  }
  s = rewire(s);
  // A player also draws the connections the default wiring does not make (the users straight to Object Storage).
  const idOf = (refId: string) => {
    if (refId === 'client') return 'client';
    const ref = want.find(c => c.id === refId)!;
    return s.buildings.find(b => sameSpot(b, ref.type, regionOfRef(ref), subOfRef(ref)))!.id;
  };
  for (const [from, to] of level.referenceDesign.connections) if (!s.links.some(l => l.from === idOf(from) && l.to === idOf(to))) s = connect(s, idOf(from), idOf(to));
  log.push(`money left after building: $${Math.floor(s.money)}`);
  return { state: runToEnd(s, level), log };
}

describe('every level can be won from every mode', () => {
  for (const level of allLevels()) {
    for (const mode of MODES) {
      it(`${level.id} · ${mode}: building the reference design from the starting design wins`, () => {
        const { state, log } = playToReference(level, mode);
        expect(state.phase, log.join('\n')).toBe('won');
        expect(starsOf(state, level)).toBeGreaterThanOrEqual(1);
      });
    }
  }

  it('the build phase is long enough for the slowest building', () => {
    expect(Math.max(...Object.values(catalog).map(c => c.buildS ?? 5))).toBeLessThan(BUILD_PHASE_S);
  });
});
