import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { catalog } from '../../catalog/catalog';
import { t } from '../../i18n';
import type { LevelDefinition, TutorialStep } from '../../levels/levels';
import { hintAllowed, startingDesign, type Mode } from '../../levels/modes';
import { CLIENT, capacityOf, hitRateOf, instancePrice, isServing, linkKey, type Building as Bld, type Link } from '../../realtime/flow';
import {
  BUILD_PHASE_S, EARLY_BONUS_PER_S, PASSIVE_INCOME, PER_100_VISITS, REFUND, UPKEEP_DIVISOR, build, buildProblem, callNow, connect, createGame,
  demolish, disconnect, resize, resizeCost, rewire, run, setAutoLink, setTtl, starsOf, toDesign, upkeepPerS, waveEnd, type GameEvent, type GameState,
} from '../../realtime/game';
import { track } from '../../analytics/analytics';
import { Building, buildingName, componentArt } from '../componentArt';

const componentColor = (type: string) => componentArt[type]?.color ?? '#5b6577';
import { FeedbackDialog } from '../feedbackDialog';
import { Stars } from '../stars';
import { levelsHref, modeHref } from '../routes';
import { Manual } from '../manual';
import type { Progress } from '../../progress/progress';
import { startFlowCanvas, type C4Layer, type Point } from './flowCanvas';
import { Announcer, C4Panel, MapTools, ReleaseButton, TimeControls } from './gameControls';

type Props = {
  level: LevelDefinition;
  /** The mission's number on the campaign map. */
  number: number;
  mode: Mode;
  /** Component types this level brings for the first time. */
  newTypes: string[];
  /** Where "Next level" goes, or null after the last one. */
  nextHref: string | null;
  /** For the Field Manual opened over the game. */
  levels: LevelDefinition[];
  progress: Progress;
  onPassed: (stars: number, design: ReturnType<typeof toDesign>) => void;
  tutorial: TutorialStep[] | null;
  onTutorialDone: () => void;
};
type Selection = { kind: 'building'; id: string } | { kind: 'link'; link: Link } | null;
type Drag = { kind: 'pan'; x: number; y: number; vx: number; vy: number; moved?: boolean } | { kind: 'node'; id: string; x: number; y: number; from: Point | null; moved: boolean } | null;

const WORLD = { w: 1700, h: 900 };
const ZONES = ['edge', 'application', 'data'] as const;
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const nameOf = (g: GameState, id?: string) => (!id ? '' : id === CLIENT ? t.rt.internet : buildingName(g.buildings.find(b => b.id === id)?.type ?? id));
const GLOBE = (
  <svg className="globe" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="27" fill="#0b1d20" stroke="#3ee0c8" strokeWidth="2.5" />
    <ellipse cx="32" cy="32" rx="12" ry="27" fill="none" stroke="#3ee0c8" strokeWidth="2" />
    <path d="M5 32h54M9 18h46M9 46h46M32 5v54" fill="none" stroke="#3ee0c8" strokeWidth="2" />
  </svg>
);

function eventText(g: GameState, e: GameEvent, rps: number): string {
  const ev = t.rt.events, name = e.type ? buildingName(e.type) : '';
  switch (e.kind) {
    case 'building': return ev.building(name);
    case 'ready': return ev.ready(name);
    case 'wave': return ev.wave(rps);
    case 'early': return ev.early(e.amount ?? 0);
    case 'incident': return ev.incident(name);
    case 'removed': return ev.removed(name, e.amount ?? 0);
    case 'resized': return ev.resized(name);
    case 'linked': return ev.linked(nameOf(g, e.from), nameOf(g, e.to));
    case 'unlinked': return ev.unlinked(nameOf(g, e.from), nameOf(g, e.to));
    case 'refused': return ev.refused(t.rt.refusal[e.reason ?? ''] ?? '');
    case 'won': return ev.won;
    case 'lost': return ev.lost[e.reason ?? 'reputation'] ?? '';
  }
}
const eventTone = (e: GameEvent) => (e.kind === 'incident' || e.kind === 'lost' ? 'bad' : e.kind === 'wave' || e.kind === 'refused' || e.kind === 'resized' ? 'warn' : e.kind === 'ready' || e.kind === 'linked' || e.kind === 'early' || e.kind === 'won' ? 'ok' : '');

function Spark({ values, max, color, limit }: { values: number[]; max: number; color: string; limit?: number }) {
  const n = 60, v = values.slice(-n), w = 200, h = 34;
  const y = (x: number) => h - Math.min(1, x / max) * (h - 2) - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {limit !== undefined && <line x1="0" x2={w} y1={y(limit)} y2={y(limit)} stroke="#f87171" strokeDasharray="3 3" opacity=".7" />}
      <polyline points={v.map((val, i) => `${(i / (n - 1)) * w},${y(val)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

/** The real-time game screen: a map of your base in C4 layers, the console below, and one wave of users (ADR-0005). */
/** What covers the map and stops the clock: the briefing before the build phase, the mission again, or the manual. */
type Overlay = 'start' | 'menu' | 'mission' | 'manual' | 'feedback' | null;

export function PlayScreen({ level, number, mode, newTypes, nextHref, levels, progress, onPassed, tutorial: tutorialAtStart, onTutorialDone }: Props) {
  const fresh = useCallback(() => createGame(level, startingDesign(level, mode)), [level, mode]);
  const [game, setGame] = useState<GameState>(fresh);
  const [paused, setPaused] = useState(false);
  // The clock waits until the player has read the mission and presses Start.
  const [overlay, setOverlay] = useState<Overlay>('start');
  const [speed, setSpeed] = useState(1);
  const [layer, setLayer] = useState<C4Layer>(3);
  const [selection, setSelection] = useState<Selection>(null);
  const [hoverLink, setHoverLink] = useState<Link | null>(null);
  const [notes, setNotes] = useState<{ t: number; text: string }[]>([]);
  const [dragLine, setDragLine] = useState<{ from: Point; to: Point } | null>(null);
  const [tutorial] = useState(tutorialAtStart);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialState, setTutorialState] = useState<'on' | 'done' | 'skipped'>('on');
  const field = useRef<HTMLElement>(null), world = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, z: 1 });
  const drag = useRef<Drag>(null);
  const canvasApi = useRef<ReturnType<typeof startFlowCanvas> | null>(null);
  const stopped = paused || overlay !== null;
  const live = useRef({ game, layer, selection, hoverLink, dragLine, paused: stopped, speed });
  live.current = { game, layer, selection, hoverLink, dragLine, paused: stopped, speed };
  const passed = useRef(false);
  const endId = useId();
  const briefId = useId();
  const startRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (overlay === 'start' || overlay === 'mission') startRef.current?.focus();
    if (overlay !== 'menu') return;
    menuRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOverlay(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);
  const closeManual = useCallback(() => setOverlay(null), []);
  const over = game.phase === 'won' || game.phase === 'lost';

  // ───────── Time: 10 updates a second, faster with the speed buttons ─────────
  useEffect(() => {
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(), real = Math.min(0.25, (now - last) / 1000); last = now;
      const { paused: p, speed: sp } = live.current;
      if (!p) setGame(g => (g.phase === 'won' || g.phase === 'lost' ? g : run(g, real * sp, level)));
    }, 100);
    return () => clearInterval(timer);
  }, [level]);

  // ───────── Analytics and progress ─────────
  useEffect(() => {
    track('Level started', { level: level.id, mode });
    return () => { if (!passed.current) track('Level abandoned', { level: level.id, mode }); };
  }, [level.id, mode]);
  useEffect(() => {
    if (!over) return;
    const stars = starsOf(game, level);
    track('Run', { level: level.id, mode, passed: game.phase === 'won' ? 'yes' : 'no' });
    if (game.phase === 'won') {
      onPassed(stars, toDesign(game));
      if (!passed.current) track('Level passed', { level: level.id, mode, stars });
      passed.current = true;
    }
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────── Map: centred at the start, then panned and zoomed by the player ─────────
  const applyView = () => { if (world.current) world.current.style.transform = `translate(${view.current.x}px, ${view.current.y}px) scale(${view.current.z})`; };
  // Centre on what is built (the Internet and the system), shrinking it to fit a narrow screen.
  const centre = useCallback(() => {
    const r = field.current?.getBoundingClientRect();
    const w = r?.width ?? 1200, h = r?.height ?? 560;
    const parts = [...(world.current?.querySelector('.play-scene')?.children ?? [])] as HTMLElement[];
    if (!parts.length) { view.current = { x: (w - WORLD.w) / 2, y: (h - WORLD.h) / 2, z: 1 }; applyView(); return; }
    const left = Math.min(...parts.map(p => p.offsetLeft)), right = Math.max(...parts.map(p => p.offsetLeft + p.offsetWidth));
    const top = Math.min(...parts.map(p => p.offsetTop)), bottom = Math.max(...parts.map(p => p.offsetTop + p.offsetHeight));
    const z = Math.max(0.5, Math.min(1, (w - 48) / (right - left), (h - 48) / (bottom - top)));
    view.current = { x: w / 2 - ((left + right) / 2) * z, y: h / 2 - ((top + bottom) / 2) * z, z };
    applyView();
  }, []);
  useEffect(() => { centre(); }, [centre]);
  const zoomAt = (factor: number, cx: number, cy: number) => {
    const r = field.current!.getBoundingClientRect(), v = view.current;
    const z = Math.max(0.5, Math.min(1.8, v.z * factor)), k = z / v.z, px = cx - r.left, py = cy - r.top;
    view.current = { x: px - (px - v.x) * k, y: py - (py - v.y) * k, z };
    applyView();
  };
  const zoomCentre = (factor: number) => { const r = field.current!.getBoundingClientRect(); zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2); };
  useEffect(() => {
    const el = field.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { if ((e.target as HTMLElement).closest('.play-panel')) return; e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ───────── Lines and requests ─────────
  useEffect(() => {
    if (!canvasRef.current || !field.current) return;
    const api = startFlowCanvas(canvasRef.current, field.current, () => {
      const c = live.current;
      return { game: c.game, layer: c.layer, selectedLink: c.selection?.kind === 'link' ? c.selection.link : null, hoverLink: c.hoverLink, dragLine: c.dragLine, paused: c.paused, speed: c.speed };
    });
    canvasApi.current = api;
    return () => api.stop();
  }, []);

  const note = (text: string) => setNotes(n => [...n, { t: live.current.game.t, text }].slice(-6));
  const doBuild = useCallback((type: string) => {
    // The state update stays pure (React may run it twice); what gets selected is worked out from the state on screen.
    const current = live.current.game;
    if (buildProblem(current, type, level)) return;
    setGame(g => build(g, type, level));
    setSelection({ kind: 'building', id: current.buildings.find(b => b.type === type)?.id ?? `${type}-${current.nextId}` });
    setLayer(l => (l === 1 ? 3 : l)); // layer 1 shows no buildings: show the new one
  }, [level]);
  const restart = () => { setGame(fresh()); setSelection(null); setNotes([]); setPaused(false); canvasApi.current?.clearRequests(); };

  // ───────── Keyboard ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') || document.querySelector('.play-screen [role="dialog"]')) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && level.allowedComponents[index]) { doBuild(level.allowedComponents[index]!); e.preventDefault(); }
      else if (e.code === 'Space' && !target.closest('button')) { setPaused(p => !p); e.preventDefault(); }
      // Esc first drops the selection, then opens the pause menu.
      else if (e.key === 'Escape') { if (live.current.selection) setSelection(null); else setOverlay('menu'); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && live.current.selection?.kind === 'link') {
        const { link } = live.current.selection;
        setGame(g => disconnect(g, link.from, link.to)); setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doBuild, level.allowedComponents]);

  // ───────── Pointer: select, connect by dragging, pan the map ─────────
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el.closest('.play-panel, button:not([data-node-id]), a, input')) return;
    const node = el.closest('[data-node-id]');
    if (node) {
      const id = node.getAttribute('data-node-id')!;
      drag.current = { kind: 'node', id, x: e.clientX, y: e.clientY, from: canvasApi.current?.anchorOf(id, layer) ?? null, moved: false };
      return;
    }
    const link = canvasApi.current?.linkAt(e.clientX, e.clientY);
    if (link) { setSelection({ kind: 'link', link }); return; }
    drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y };
    field.current?.classList.add('panning');
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) {
        const inField = (e.target as HTMLElement | null)?.closest?.('.play-field') && !(e.target as HTMLElement).closest('.play-panel');
        const link = inField ? canvasApi.current?.linkAt(e.clientX, e.clientY) ?? null : null;
        setHoverLink(prev => (prev?.from === link?.from && prev?.to === link?.to ? prev : link));
        return;
      }
      if (d.kind === 'pan') { d.moved ||= Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4; view.current = { ...view.current, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }; applyView(); return; }
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
        if (live.current.layer !== 3) { note(t.rt.layer3ToConnect); drag.current = null; return; }
        d.moved = true;
      }
      if (d.moved && d.from) setDragLine({ from: d.from, to: { x: e.clientX, y: e.clientY } });
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current; drag.current = null;
      field.current?.classList.remove('panning');
      setDragLine(null);
      // A click on empty ground (no drag) clears the selection, so Delete never removes a line chosen earlier.
      if (d?.kind === 'pan' && !d.moved) { setSelection(null); return; }
      if (!d || d.kind !== 'node') return;
      if (!d.moved) { if (d.id !== CLIENT) setSelection({ kind: 'building', id: d.id }); return; }
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node-id]')?.getAttribute('data-node-id');
      if (target) setGame(g => connect(g, d.id, target));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  // ───────── Tutorial (level 1): each step waits for the real action ─────────
  const step = tutorial && tutorialState === 'on' ? tutorial[tutorialStep] : undefined;
  const typeOfId = (id: string) => game.buildings.find(b => b.id === id)?.type;
  useEffect(() => {
    if (!tutorial || !step) return;
    const until = step.until;
    const done = 'select' in until ? selection?.kind === 'building' && typeOfId(selection.id) === until.select
      : 'connect' in until ? game.links.some(l => typeOfId(l.from) === until.connect[0] && typeOfId(l.to) === until.connect[1])
      : until.event === 'run' ? game.phase !== 'build'
      : game.phase === 'won';
    if (!done) return;
    if (tutorialStep + 1 < tutorial.length) setTutorialStep(tutorialStep + 1);
    else { setTutorialState('done'); onTutorialDone(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const tutorialType = step?.target && 'component' in step.target ? step.target.component : null;
  const tutorialOnCall = !!step?.target && 'control' in step.target;

  // ───────── Numbers for the screen ─────────
  const flow = game.flow;
  const rps = game.phase === 'wave' ? level.play.wave.rps : 0;
  const net = PASSIVE_INCOME + ((flow?.answered ?? 0) / 100) * PER_100_VISITS - upkeepPerS(game);
  const building = game.phase === 'build';
  const incidentHappened = game.incidentDone && !!level.play.incident;
  const keys = `1–${level.allowedComponents.length}`;
  const selectedBuilding = selection?.kind === 'building' ? game.buildings.find(b => b.id === selection.id) ?? null : null;
  const hint = useMemo(() => {
    if (game.phase !== 'lost' || !hintAllowed(mode, true)) return null;
    if (incidentHappened) return t.redundancyHint;
    const worst = Object.entries(flow?.drop ?? {}).filter(([id]) => id !== CLIENT).sort((a, b) => b[1] - a[1])[0]
      ?? Object.entries(flow?.load ?? {}).sort((a, b) => b[1] - a[1])[0];
    const type = worst ? typeOfId(worst[0]) : undefined;
    if (!type) return null;
    // A size the level does not let the player change must not be the advice.
    const fixed = (level.componentOptions[type]?.sizes?.length ?? 2) < 2;
    return (fixed && t.fixedHints[type]) || (t.hints[type] ?? t.genericHint(buildingName(type)));
  }, [game.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const log = [...game.events.slice(-6).map(e => ({ t: e.t, text: eventText(game, e, level.play.wave.rps), tone: eventTone(e) })),
    ...notes.map(n => ({ ...n, tone: 'warn' }))].sort((a, b) => b.t - a.t).slice(0, 6);

  // ───────── Map contents ─────────
  const loadClass = (load: number) => (load >= 0.9 ? 'high' : load >= 0.7 ? 'medium' : '');
  const noEntry = (b: Bld) => !game.links.some(l => l.to === b.id);
  const deadEnd = (b: Bld) => !catalog[b.type]!.endsRequests && !game.links.some(l => l.from === b.id);
  function piece(b: Bld, k: number, size: number) {
    const inst = b.instances[k]!, scaled = !!catalog[b.type]!.scalesOut;
    const active = isServing(inst);
    const servingIndex = b.instances.slice(0, k + 1).filter(isServing).length;
    const idle = active && game.phase === 'wave' && servingIndex > (flow?.usable[b.id] ?? 0);
    const load = active && !idle ? flow?.load[b.id] ?? 0 : 0;
    const warn = noEntry(b) ? t.rt.inspector.noEntry : deadEnd(b) ? t.rt.inspector.deadEnd : '';
    const label = scaled ? instanceNames.get(b.id)?.[k] ?? b.type : buildingName(b.type);
    const sub = inst.down ? t.rt.inspector.down : inst.buildLeftS > 0 ? t.rt.inspector.building(Math.ceil(inst.buildLeftS)) : idle ? t.rt.inspector.idle : warn ? `⚠ ${warn}` : '';
    const selected = selectedBuilding?.id === b.id;
    return (
      <button key={`${b.id}-${k}`} className={`play-unit ${inst.buildLeftS > 0 ? 'building' : ''} ${inst.down ? 'down' : ''} ${selected ? 'selected' : ''} ${warn ? 'warn' : ''} ${tutorialType === b.type ? 'tutorial-target' : ''}`}
        data-node-id={b.id} {...(scaled ? { 'data-instance': k } : {})} style={{ ['--c' as string]: componentColor(b.type) }} aria-label={`${label} ${sub}`.trim()}>
        <Building type={b.type} size={size} down={inst.down} />
        {inst.buildLeftS > 0 && <span className="play-progress"><span style={{ width: `${100 - (inst.buildLeftS / Math.max(1, inst.buildTotalS)) * 100}%` }} /></span>}
        <span className="name">{label}</span>
        {sub && <span className="sub">{sub}</span>}
        {active && !inst.down && <span className={`play-load ${loadClass(load)}`}><span style={{ width: `${Math.round(load * 100)}%` }} /></span>}
      </button>
    );
  }
  function zoneContent(zone: string) {
    const here = game.buildings.filter(b => catalog[b.type]!.presentation?.zone === zone)
      .sort((a, b) => ['loadBalancer', 'appServer', 'cache', 'database'].indexOf(a.type) - ['loadBalancer', 'appServer', 'cache', 'database'].indexOf(b.type));
    if (layer === 2) {
      return here.map(b => {
        const serving = b.instances.filter(isServing).length, load = flow?.load[b.id] ?? 0;
        return (
          <button key={b.id} className={`play-unit ${serving ? '' : 'building'} ${selectedBuilding?.id === b.id ? 'selected' : ''}`} data-node-id={b.id} style={{ ['--c' as string]: componentColor(b.type) }}>
            <Building type={b.type} size={64} />
            <span className="name">{buildingName(b.type)}{b.instances.length > 1 ? ` × ${b.instances.length}` : ''}</span>
            <span className="sub">{serving}/{b.instances.length} {t.rt.inspector.serving}</span>
            {serving > 0 && <span className={`play-load ${loadClass(load)}`}><span style={{ width: `${Math.round(load * 100)}%` }} /></span>}
          </button>
        );
      });
    }
    return here.map(b => (catalog[b.type]!.scalesOut
      ? <div key={b.id} className="play-container" data-container={b.id}>
          <span className="name">{buildingName(b.type)} · {t.instanceCount(b.instances.length)}</span>
          {b.instances.map((_, k) => piece(b, k, 52))}
        </div>
      : piece(b, 0, 64)));
  }
  // Instance names (app-1, app-2…) are numbered across every component with the same prefix, as players read them.
  const instanceNames = useMemo(() => {
    const counters = new Map<string, number>(), names = new Map<string, string[]>();
    for (const b of game.buildings) {
      if (!catalog[b.type]!.scalesOut) continue;
      const prefix = catalog[b.type]!.presentation?.instancePrefix ?? b.type;
      names.set(b.id, b.instances.map(() => { const n = (counters.get(prefix) ?? 0) + 1; counters.set(prefix, n); return `${prefix}-${n}`; }));
    }
    return names;
  }, [game.buildings]);
  const counts = useMemo(() => Object.keys(catalog).map(type => [type, game.buildings.filter(b => b.type === type).reduce((s, b) => s + b.instances.length, 0)] as const).filter(([, n]) => n), [game.buildings]);

  // ───────── Inspector ─────────
  function inspector() {
    if (selection?.kind === 'link') {
      const { link } = selection;
      return <>
        <div className="play-ins-head"><h3>{t.rt.inspector.link}</h3></div>
        <dl className="play-rows">
          <dt>{t.rt.inspector.from}</dt><dd>{nameOf(game, link.from)}</dd>
          <dt>{t.rt.inspector.to}</dt><dd>{nameOf(game, link.to)}</dd>
          <dt>{t.rt.inspector.traffic}</dt><dd>{t.rt.inspector.perSecond(Math.round(flow?.edge[linkKey(link)] ?? 0))}</dd>
        </dl>
        <div className="play-controls"><button className="btn" onClick={() => { setGame(g => disconnect(g, link.from, link.to)); setSelection(null); }}>{t.rt.inspector.removeLink}</button></div>
      </>;
    }
    const b = selectedBuilding;
    if (!b) return <p className="muted">{t.rt.inspector.empty}</p>;
    const spec = catalog[b.type]!, i = t.rt.inspector, price = instancePrice(b);
    const sizes = spec.sizes ? (level.componentOptions[b.type]?.sizes ?? Object.keys(spec.sizes)) : [];
    const size = b.params.size ?? spec.defaultSize;
    const serving = b.instances.filter(isServing).length;
    const outs = game.links.filter(l => l.from === b.id).map(l => nameOf(game, l.to)).join(', ') || '—';
    const ttlMax = level.componentOptions[b.type]?.limits?.ttlS ?? 600;
    const problem = buildProblem(game, b.type, level);
    return <>
      <div className="play-ins-head">
        <span className="play-portrait" style={{ ['--c' as string]: componentColor(b.type) }}><Building type={b.type} size={56} /></span>
        <div><h3>{buildingName(b.type)}</h3><span className="muted">{spec.presentation?.technology} · {i.zone(t.zones[spec.presentation?.zone ?? 'application'])}</span></div>
      </div>
      <dl className="play-rows">
        <dt>{i.state}</dt><dd>{b.instances.some(x => x.down) ? i.down : serving === b.instances.length ? i.serving : i.building(Math.ceil(Math.max(...b.instances.map(x => x.buildLeftS))))}</dd>
        {spec.scalesOut && <><dt>{i.instances}</dt><dd>{serving}/{b.instances.length}</dd></>}
        <dt>{i.sendsTo}</dt><dd>{spec.endsRequests && !spec.shortcut ? i.answers : outs}</dd>
        <dt>{i.receives}</dt><dd>{i.perSecond(Math.round(flow?.inflow[b.id] ?? 0))}</dd>
        {!spec.presentation?.hideCapacity && <><dt>{i.capacity}</dt><dd>{i.perSecond(Math.round(capacityOf(b) * Math.max(1, serving)))}</dd></>}
        {spec.shortcut && <><dt>{i.hitRate}</dt><dd>{Math.round(hitRateOf(b) * 100)}%</dd></>}
        <dt>{i.upkeep}</dt><dd>{i.money((price * b.instances.length) / UPKEEP_DIVISOR)}</dd>
        {spec.sizes && sizes.length === 1 && <><dt>{spec.scalesOut ? i.size : i.tier}</dt><dd>{(size && t.inspector.sizes[size]) ?? size} · {i.fixed}</dd></>}
      </dl>
      {sizes.length > 1 && (
        <fieldset className="play-sizes" aria-label={spec.scalesOut ? i.size : i.tier}>
          <legend className="muted">{spec.scalesOut ? i.size : i.tier}</legend>
          {sizes.map(s => {
            const cost = resizeCost(b, s);
            return <button key={s} className={`btn ${s === size ? 'on' : ''}`} disabled={s === size || game.money < cost || over} onClick={() => setGame(g => resize(g, b.id, s))}>
              {t.inspector.sizes[s] ?? s}{s !== size ? ` · ${i.resizeCost(cost)}` : ''}</button>;
          })}
        </fieldset>
      )}
      {spec.shortcut && (
        <div className="play-ttl"><span className="muted">{i.ttl}</span>
          <span className="stepper">
            <button aria-label={t.inspector.shorterTtl} disabled={(b.params.ttlS ?? spec.shortcut.defaultValue) <= 0} onClick={() => setGame(g => setTtl(g, b.id, Math.max(0, (b.params.ttlS ?? spec.shortcut!.defaultValue) - 10)))}>−</button>
            <b>{b.params.ttlS ?? spec.shortcut.defaultValue}</b>
            <button aria-label={t.inspector.longerTtl} disabled={(b.params.ttlS ?? spec.shortcut.defaultValue) >= ttlMax} onClick={() => setGame(g => setTtl(g, b.id, Math.min(ttlMax, (b.params.ttlS ?? spec.shortcut!.defaultValue) + 10)))}>+</button>
          </span>
        </div>
      )}
      <div className="play-controls">
        {spec.scalesOut && <button className="btn" disabled={!!problem} title={problem ? t.rt.build.reasons[problem] : ''} onClick={() => doBuild(b.type)}>{i.addInstance(price)}</button>}
        {spec.scalesOut && b.instances.length > 1
          ? <button className="btn" onClick={() => setGame(g => demolish(g, b.id))}>{i.removeInstance(Math.round(price * REFUND))}</button>
          : <button className="btn" onClick={() => { setGame(g => demolish(g, b.id)); setSelection(null); }}>{i.remove(Math.round(price * REFUND))}</button>}
      </div>
    </>;
  }

  const stars = starsOf(game, level);
  const maxStars = 1 + level.play.starMoney.length;
  return (
    <div className="play-screen">
      <header className="play-bar">
        <a className="back" href={levelsHref}>← {t.rt.back}</a>
        <h1>{level.title}</h1>
        <span className="play-res" role="status" aria-label={t.rt.money}>💰 <b className="play-money">${Math.floor(game.money)}</b><span className={net >= 0 ? 'up' : 'down'}>{t.rt.rate(net)}</span></span>
        <span className="play-res">⏱ <b className="play-phase">{building ? t.rt.phase.build(fmt(BUILD_PHASE_S - game.t)) : game.phase === 'wave' ? t.rt.phase.wave(fmt(waveEnd(level) - game.t)) : t.rt.phase.end}</b>
          <TimeControls paused={paused} togglePause={() => setPaused(p => !p)} speed={speed} setSpeed={x => { setSpeed(x); setPaused(false); }} disabled={overlay !== null} />
        </span>
        <span className="play-res" role="meter" aria-label={t.rt.reputation} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.reputation)}>
          ❤ <span className="play-rep"><span style={{ width: `${game.reputation}%`, background: game.reputation < 35 ? 'var(--bad)' : game.reputation < 70 ? 'var(--warn)' : 'var(--ok)' }} /></span>{Math.round(game.reputation)}%
        </span>
        <span className="play-bar-tools">
          <button className="btn" aria-haspopup="dialog" onClick={() => setOverlay('menu')}>{t.rt.menu.open}</button>
        </span>
      </header>

      <main className="play-field" ref={field} onPointerDown={onPointerDown}>
        <div className="play-world" ref={world} style={{ width: WORLD.w, height: WORLD.h }}>
          <div className="play-scene">
            <div className="play-internet" data-node-id={CLIENT}>
              <span className="label">{t.rt.internet}</span>
              <div className={`play-globe ${game.phase === 'wave' ? 'busy' : ''}`}>{GLOBE}</div>
              {game.phase === 'wave'
                ? <><b>{t.rt.inspector.perSecond(rps)}</b><span className="muted">{t.rt.visits(Math.round(game.visits).toLocaleString())}</span></>
                : <span className="muted">{building ? t.rt.waiting : t.rt.gone}</span>}
            </div>
            {!game.buildings.length
              ? <div className="play-site"><b>{t.rt.buildSite.title}</b><span>{t.rt.buildSite.line1}</span><span>{t.rt.buildSite.line2(keys)}</span></div>
              : layer === 1
                ? <div className="play-system" data-node="system">
                    <span className="label">{t.systemName} <small>[{t.softwareSystem}]</small></span>
                    <div className="play-ctx">{counts.map(([type, n]) => <span key={type}><Building type={type} size={48} />{n > 1 && <b>× {n}</b>}</span>)}</div>
                    <span className="muted">{t.rt.contextSummary(counts.reduce((s, [, n]) => s + n, 0), upkeepPerS(game).toFixed(1))}</span>
                  </div>
                : <div className="play-system">
                    <span className="label">{t.systemName} <small>[{t.softwareSystem}]</small></span>
                    <div className="play-zones">
                      {ZONES.filter(z => game.buildings.some(b => catalog[b.type]!.presentation?.zone === z)).map(z => (
                        <div key={z} className={`play-zone zone-${z}`}><span className="zname">{t.zones[z]} <small>[{t.container}]</small></span>{zoneContent(z)}</div>
                      ))}
                    </div>
                  </div>}
          </div>
        </div>
        <canvas className="play-fx" ref={canvasRef} aria-hidden="true" />

        <C4Panel layer={layer} setLayer={k => { setLayer(k); canvasApi.current?.clearRequests(); }} />
        <MapTools autoLink={game.autoLink} toggleAutoLink={() => setGame(g => setAutoLink(g, !g.autoLink))} rewire={() => setGame(g => rewire(g))}
          zoom={zoomCentre} centre={centre} log={[...log].reverse().map(l => ({ time: fmt(l.t), text: l.text, tone: l.tone }))} />
        {!over && <Announcer phase={game.phase} buildLeft={Math.ceil(BUILD_PHASE_S - game.t)} incident={incidentHappened} started={overlay !== 'start'} />}
        {tutorial && tutorialState !== 'skipped' && (step || tutorialState === 'done') && (
          <section className="play-panel play-tutorial" aria-label={t.tutorial.title} aria-live="polite">
            {step ? <>
              <span className="label">{t.tutorial.step(tutorialStep + 1, tutorial.length)}</span>
              <p>{step.text}</p>
              <button className="link-button" onClick={() => { setTutorialState('skipped'); onTutorialDone(); }}>{t.tutorial.skip}</button>
            </> : <p>{t.tutorial.done}</p>}
          </section>
        )}
        {/* The latest events, for screen readers; on screen they are under the map's ? tool. */}
        <div className="play-log visually-hidden" aria-live="polite">{log.map((l, k) => <div key={k} className={l.tone}>[{fmt(l.t)}] {l.text}</div>)}</div>
      </main>

      <footer className="play-console">
        <section className="play-frame" aria-label={t.rt.live}>
          <span className="label">{t.rt.live}</span>
          <div className="play-charts">
            <div className="play-chart">RPS<Spark values={game.history.map(h => h.rps)} max={Math.max(100, level.play.wave.rps * 1.2)} color="#3ee0c8" /><b>{rps}</b></div>
            <div className="play-chart">P95<Spark values={game.history.map(h => h.p95)} max={Math.max(400, level.requirements.p95Ms * 3)} color="#fbbf24" limit={level.requirements.p95Ms} /><b className={(flow?.p95 ?? 0) > level.requirements.p95Ms ? 'bad' : ''}>{flow?.p95 ?? 0} ms</b></div>
            <div className="play-chart">{t.rt.errors}<Spark values={game.history.map(h => h.errors)} max={0.5} color="#f87171" limit={level.requirements.maxErrorRate} /><b className={(flow?.errors ?? 0) > level.requirements.maxErrorRate ? 'bad' : ''}>{((flow?.errors ?? 0) * 100).toFixed(1)}%</b></div>
          </div>
          <dl className="play-econ">
            <dt>{t.rt.fixedIncome}</dt><dd>+${PASSIVE_INCOME.toFixed(1)}/s</dd>
            <dt>{t.rt.visitsIncome}</dt><dd>+${(((flow?.answered ?? 0) / 100) * PER_100_VISITS).toFixed(1)}/s</dd>
            <dt>{t.rt.upkeep}</dt><dd>−${upkeepPerS(game).toFixed(1)}/s</dd>
          </dl>
        </section>
        <section className="play-frame play-inspector" aria-label={t.inspector.title}>
          <span className="label">{t.inspector.title}</span>
          {inspector()}
        </section>
        <section className="play-frame play-build" aria-label={t.rt.build.title}>
          <span className="label">{t.rt.build.title}</span>
          <div className="play-cards" role="toolbar" aria-label={t.components}>
            {level.allowedComponents.map((type, k) => {
              const existing = game.buildings.find(b => b.type === type);
              const cost = instancePrice(existing ?? { type, params: {} });
              const problem = buildProblem(game, type, level);
              const s = catalog[type]!.buildS ?? 5;
              return (
                <button key={type} className={`play-card ${tutorialType === type && !existing ? 'tutorial-target' : ''}`} disabled={!!problem} title={problem ? t.rt.build.reasons[problem] : ''}
                  aria-label={t.rt.build.card(k + 1, buildingName(type), cost, s)} onClick={() => doBuild(type)}>
                  <kbd aria-hidden="true">{k + 1}</kbd><span className="time" aria-hidden="true">{t.rt.build.seconds(s)}</span>
                  <Building type={type} size={46} /><span className="n">{buildingName(type)}</span><span className="c">${cost}</span>
                </button>
              );
            })}
          </div>
          {building
            ? <ReleaseButton highlight={tutorialOnCall} bonus={Math.round((BUILD_PHASE_S - game.t) * EARLY_BONUS_PER_S)} onClick={() => setGame(g => callNow(g))} />
            : game.phase === 'wave' && <p className="play-live" role="note">{t.rt.release.live}</p>}
        </section>
      </footer>

      {(overlay === 'start' || overlay === 'mission') && !over && (
        <div className="backdrop play-briefing-backdrop">
          <div className="report play-briefing" role="dialog" aria-modal="true" aria-labelledby={briefId}>
            <span className="console-label">{t.rt.briefing.eyebrow(number, t.modes[mode].name)}</span>
            <h2 id={briefId}>{level.title}</h2>
            <p>{level.brief}</p>
            {mode === 'guided' && <p role="note" className="play-lesson">{level.guidedHint}</p>}
            <ul className="play-brief-goals" aria-label={t.objectives}>
              <li><span aria-hidden="true">⏱</span> {t.objectiveP95(level.requirements.p95Ms)}</li>
              <li><span aria-hidden="true">⚠</span> {t.objectiveErrors(level.requirements.maxErrorRate)}</li>
              <li><span aria-hidden="true">👥</span> {t.rt.waveShort(level.play.wave.rps, level.play.wave.lengthS)}</li>
              {level.play.incident && <li><span aria-hidden="true">⚡</span> {t.rt.incidentInfo(buildingName(level.play.incident.componentType), level.play.incident.atS)}</li>}
            </ul>
            {newTypes.length > 0 && (
              <div className="play-brief-new">
                {newTypes.map(type => <span key={type}><Building type={type} size={40} /><b>{t.newLabel}</b> {buildingName(type)}</span>)}
              </div>
            )}
            <p className="muted play-brief-stars">★ {t.levelSelect.starPass} · ★★ {t.levelSelect.starMoney(level.play.starMoney[0] ?? 0)} · ★★★ {t.levelSelect.starMoney(level.play.starMoney[1] ?? 0)}</p>
            <p className="note">⏱ {overlay === 'start' ? t.rt.briefing.clock(BUILD_PHASE_S) : t.rt.briefing.paused}</p>
            <div className="actions">
              <button ref={startRef} className="primary-link play-start" onClick={() => setOverlay(null)}>{overlay === 'start' ? t.rt.briefing.start : t.rt.briefing.resume}</button>
            </div>
          </div>
        </div>
      )}
      {overlay === 'menu' && (
        <div className="backdrop play-briefing-backdrop" onClick={() => setOverlay(null)}>
          <div className="report play-menu" role="dialog" aria-modal="true" aria-labelledby={menuId} onClick={e => e.stopPropagation()}>
            <span className="console-label">{t.rt.briefing.eyebrow(number, t.modes[mode].name)}</span>
            <h2 id={menuId}>{t.rt.menu.title}</h2>
            <p className="muted">{level.title}</p>
            <nav className="play-menu-list" aria-label={t.rt.menu.open}>
              <button ref={menuRef} className="primary-link play-start" onClick={() => setOverlay(null)}>{t.rt.briefing.resume}</button>
              {!over && <button className="secondary" onClick={() => setOverlay('mission')}>{t.rt.menu.mission}</button>}
              <button className="secondary" onClick={() => setOverlay('manual')}>{t.rt.menu.manual}</button>
              <button className="secondary" onClick={() => setOverlay('feedback')}>{t.rt.menu.feedback}</button>
              <button className="secondary" onClick={() => { restart(); setOverlay(null); }}>{t.rt.menu.restart}</button>
              <a className="secondary" href={modeHref(level.id)}>{t.rt.menu.mode}</a>
              <a className="secondary" href={levelsHref}>{t.rt.menu.levels}</a>
            </nav>
          </div>
        </div>
      )}
      {overlay === 'feedback' && <FeedbackDialog info={{ level: level.id, mode, result: over ? (game.phase === 'won' ? `passed ${stars}★` : 'failed') : undefined }} onClose={closeManual} />}
      {overlay === 'manual' && <Manual levels={levels} progress={progress} onClose={closeManual} />}
      {over && (
        <div className="backdrop">
          <div className="report" role="dialog" aria-modal="true" aria-labelledby={endId}>
            <Stars earned={stars} max={maxStars} />
            <h2 id={endId} className={game.phase === 'won' ? 'ok' : 'bad'}>{game.phase === 'won' ? t.rt.end.won : t.rt.end.lost}</h2>
            <p className="muted">{t.rt.end.summary(Math.floor(game.money), Math.round(game.visits).toLocaleString(), Math.round(game.reputation))}</p>
            <p className="muted">{t.rt.end.starsAt(level.play.starMoney[0] ?? 0, level.play.starMoney[1] ?? 0)}</p>
            {hint && <p className="note"><strong>{t.hintLabel}</strong> {hint}</p>}
            <div className="actions">
              <button className="secondary" onClick={restart}>{t.rt.end.again}</button>
              <a className="secondary" href={levelsHref}>{t.rt.end.map}</a>
              {game.phase === 'won' && nextHref && <a className="primary-link" href={nextHref}>{t.rt.end.next}</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

