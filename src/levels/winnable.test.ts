import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { build, BUILD_PHASE_S, createGame, demolish, resize, rewire, runToEnd, setTtl, starsOf, type GameState } from '../realtime/game';
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
  // Take away what the reference does not use, and duplicates of a type (the reference has one building per type).
  for (const b of [...s.buildings]) {
    const first = s.buildings.find(x => x.type === b.type);
    if (!want.some(c => c.type === b.type) || first !== b) {
      while (s.buildings.some(x => x.id === b.id)) s = demolish(s, b.id);
      log.push(`demolish ${b.id}`);
    }
  }
  for (const c of want) {
    if (!s.buildings.some(b => b.type === c.type)) { s = build(s, c.type, level); log.push(`build ${c.type}`); }
    const b = () => s.buildings.find(x => x.type === c.type);
    if (!b()) { log.push(`could not build ${c.type} with $${Math.floor(s.money)}`); continue; }
    const size = String(c.params?.size ?? catalog[c.type]!.defaultSize);
    if ((b()!.params.size ?? catalog[c.type]!.defaultSize) !== size) { s = resize(s, b()!.id, size); log.push(`resize ${c.type} to ${size}`); }
    const instances = Number(c.params?.instances ?? 1);
    while (b()!.instances.length < instances) {
      const before = b()!.instances.length;
      s = build(s, c.type, level);
      if (b()!.instances.length === before) { log.push(`could not add a ${c.type} instance with $${Math.floor(s.money)}`); break; }
    }
    if (c.params?.ttlS !== undefined) s = setTtl(s, b()!.id, Number(c.params.ttlS));
  }
  s = rewire(s);
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
