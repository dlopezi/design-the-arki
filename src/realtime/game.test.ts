import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import { BUILD_PHASE_S, build, callNow, connect, createGame, demolish, disconnect, resize, run, starsOf, toDesign, type GameLevel, type GameState } from './game';

const level: GameLevel = {
  allowedComponents: ['loadBalancer', 'appServer', 'cache', 'database'],
  componentOptions: { appServer: { maxInstances: 4 } },
  requirements: { p95Ms: 200, maxErrorRate: 0.01 },
  play: { startMoney: 300, wave: { rps: 300, lengthS: 40 }, starMoney: [100, 200] },
};
const empty: Design = { components: [], connections: [] };
const ids = (s: GameState) => s.links.map(l => `${l.from}>${l.to}`);
const typeOf = (s: GameState, id: string) => s.buildings.find(b => b.id === id)?.type ?? id;
const named = (s: GameState) => s.links.map(l => `${typeOf(s, l.from)}>${typeOf(s, l.to)}`);
/** Plays `seconds` of the game. */
const wait = (s: GameState, seconds: number) => run(s, seconds, level);

describe('real-time play', () => {
  it('starts in the build phase with the level money; a starting design is already built and connected', () => {
    const s = createGame(level, { components: [{ id: 'api', type: 'appServer', params: { instances: 2 } }], connections: [['client', 'api']] });
    expect(s.phase).toBe('build');
    expect(s.money).toBe(300);
    expect(s.buildings[0]!.instances).toHaveLength(2);
    expect(s.buildings[0]!.instances.every(i => i.buildLeftS === 0)).toBe(true);
    expect(ids(s)).toEqual(['client>api']);
  });

  it('building costs its monthly price and takes time; another app server is one more instance', () => {
    let s = createGame(level, empty);
    s = build(s, 'appServer', level);
    expect(s.money).toBe(260);
    expect(s.buildings[0]!.instances[0]!.buildLeftS).toBe(5);
    s = build(s, 'appServer', level);
    expect(s.buildings).toHaveLength(1);
    expect(s.buildings[0]!.instances).toHaveLength(2);
    s = build(s, 'database', level);
    expect(build(s, 'database', level)).toBe(s); // one database is enough here: a second one is refused
  });

  it('connects new buildings automatically, the way a player almost always wants', () => {
    let s = createGame(level, empty);
    s = build(s, 'appServer', level);
    s = build(s, 'database', level);
    expect(named(s)).toEqual(['client>appServer', 'appServer>database']);
    s = build(s, 'loadBalancer', level);
    expect(named(s).sort()).toEqual(['appServer>database', 'client>loadBalancer', 'loadBalancer>appServer']);
    s = build(s, 'cache', level);
    expect(named(s).sort()).toEqual(['appServer>cache', 'cache>database', 'client>loadBalancer', 'loadBalancer>appServer']);
  });

  it('lets the player change connections, but refuses circles, links into the users and links out of a database', () => {
    let s = createGame(level, empty);
    for (const type of ['appServer', 'database', 'loadBalancer']) s = build(s, type, level);
    const [api, db, lb] = s.buildings.map(b => b.id) as [string, string, string];
    expect(connect(s, db, api).links).toBe(s.links);
    expect(connect(s, api, 'client').links).toBe(s.links);
    expect(connect(s, api, lb).links).toBe(s.links);
    s = disconnect(s, lb, api);
    expect(ids(s)).not.toContain(`${lb}>${api}`);
    s = connect(s, 'client', api);
    expect(ids(s).filter(l => l.startsWith('client>'))).toEqual([`client>${api}`]); // the users have one entrance
  });

  it('the users arrive after the build phase, or at once with a bonus', () => {
    let s = createGame(level, empty);
    s = wait(s, BUILD_PHASE_S - 1);
    expect(s.phase).toBe('build');
    s = wait(s, 2);
    expect(s.phase).toBe('wave');
    const early = callNow(createGame(level, empty));
    expect(early.phase).toBe('wave');
    expect(early.money).toBeGreaterThan(300);
  });

  it('money grows by itself and with each answered visit, and maintenance costs it', () => {
    let s = createGame(level, empty);
    for (const type of ['loadBalancer', 'appServer', 'appServer', 'database']) s = build(s, type, level);
    s = callNow(wait(s, 10));
    const before = s.money;
    s = wait(s, 10);
    // 10 s × ($2 + 300 visits/s × $1 per 100 − upkeep (20 + 40 + 40 + 50) / 100) = 10 × 3.5
    expect(s.money - before).toBeCloseTo(35, 0);
  });

  it('a scripted incident takes an instance down during the wave', () => {
    const withIncident: GameLevel = { ...level, play: { ...level.play, incident: { atS: 5, componentType: 'appServer' } } };
    let s = createGame(withIncident, { components: [{ id: 'api', type: 'appServer', params: { instances: 2 } }], connections: [] });
    s = run(callNow(s), 6, withIncident);
    expect(s.buildings[0]!.instances.filter(i => i.down)).toHaveLength(1);
  });

  it('winning means lasting the whole wave; the stars depend on the money left', () => {
    let s = createGame(level, empty);
    for (const type of ['loadBalancer', 'appServer', 'appServer', 'appServer', 'database']) s = build(s, type, level);
    s = wait(s, BUILD_PHASE_S + level.play.wave.lengthS + 1);
    expect(s.phase).toBe('won');
    expect(starsOf(s, level)).toBe(1 + level.play.starMoney.filter(m => s.money >= m).length);
  });

  it('the base is lost when the reputation reaches 0', () => {
    let s = createGame(level, empty);
    s = build(s, 'appServer', level);
    s = wait(s, BUILD_PHASE_S + level.play.wave.lengthS);
    expect(s.phase).toBe('lost');
    expect(s.reputation).toBe(0);
  });

  it('the design on the map can be saved and played again', () => {
    let s = createGame(level, empty);
    for (const type of ['loadBalancer', 'appServer', 'appServer', 'database']) s = build(s, type, level);
    const design = toDesign(s);
    expect(design.components.find(c => c.type === 'appServer')!.params).toMatchObject({ instances: 2 });
    expect(ids(createGame(level, design))).toEqual(ids(s));
  });

  it('removing an instance takes away a fallen one first; resizing rebuilds every instance, fallen ones included', () => {
    let s = createGame(level, { components: [{ id: 'api', type: 'appServer', params: { instances: 3 } }], connections: [] });
    s = { ...s, buildings: s.buildings.map(b => ({ ...b, instances: b.instances.map((i, k) => (k === 1 ? { ...i, down: true } : i)) })) };
    expect(demolish(s, 'api').buildings[0]!.instances.some(i => i.down)).toBe(false);
    const resized = resize(s, 'api', 'large');
    expect(resized.buildings[0]!.instances.every(i => !i.down && i.buildLeftS === 5)).toBe(true);
    expect(resized.money).toBe(300 - (80 - 20) * 3);
  });

  it('a wave with a mix of Request Types: a type with no path counts as errors and costs reputation', () => {
    const mixed: GameLevel = { ...level, play: { ...level.play, wave: { rps: 100, lengthS: 40, mix: { watch: 0.7, job: 0.3 } } } };
    const design = (connections: [string, string][]): Design => ({
      components: [{ id: 'api', type: 'appServer' }, { id: 'cache', type: 'cache' }, { id: 'db', type: 'database' }], connections });
    const play = (d: Design, l: GameLevel) => run(callNow(createGame(l, d)), 10, l);
    const plain: GameLevel = { ...level, play: { ...level.play, wave: { rps: 100, lengthS: 40 } } };
    // The cache takes watches only, so the jobs have nowhere to go (30% errors: over the 1% maximum).
    const cacheOnly = play(design([['client', 'api'], ['api', 'cache'], ['cache', 'db']]), mixed);
    expect(cacheOnly.flow!.errors).toBeCloseTo(0.3);
    expect(cacheOnly.reputation).toBeLessThan(100);
    // Connected to the database too, the jobs have a path and everything is answered.
    const both = play(design([['client', 'api'], ['api', 'cache'], ['cache', 'db'], ['api', 'db']]), mixed);
    expect(both.flow!.errors).toBe(0);
    expect(both.reputation).toBe(100);
    // The same base without a mix (chapter 1) answers everything, as before.
    expect(play(design([['client', 'api'], ['api', 'cache'], ['cache', 'db']]), plain).flow!.errors).toBe(0);
  });
});
