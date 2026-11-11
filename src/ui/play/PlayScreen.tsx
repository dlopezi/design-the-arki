import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { catalog } from '../../catalog/catalog';
import { t } from '../../i18n';
import type { LevelDefinition, TutorialStep } from '../../levels/levels';
import { hintAllowed, startingDesign, type Mode } from '../../levels/modes';
import { CLIENT, capacityOf, hitRateOf, instancePrice, isServing, linkKey, type Building as Bld, type Link } from '../../realtime/flow';
import {
  BUILD_PHASE_S, EARLY_BONUS_PER_S, PASSIVE_INCOME, PER_100_VISITS, REFUND, UPKEEP_DIVISOR, build, buildProblem, callNow, connect, createGame,
  demolish, disconnect, resize, rewire, run, setAutoLink, setTtl, starsOf, toDesign, upkeepPerS, waveEnd, type GameEvent, type GameState,
} from '../../realtime/game';
import { track } from '../../analytics/analytics';
import { buildingCount } from '../../base/base';
import { Building, buildingName, componentArt } from '../componentArt';

const componentColor = (type: string) => componentArt[type]?.color ?? '#5b6577';
import { FeedbackButton } from '../feedbackDialog';
import { Stars } from '../stars';
import { baseHref, levelsHref } from '../routes';
import { startFlowCanvas, type C4Layer, type Point } from './flowCanvas';

type Props = {
  level: LevelDefinition;
  mode: Mode;
  /** Component types this level brings for the first time. */
  newTypes: string[];
  nextLevelId: string | null;
  onPassed: (stars: number, design: ReturnType<typeof toDesign>) => void;
  tutorial: TutorialStep[] | null;
  onTutorialDone: () => void;
};
type Selection = { kind: 'building'; id: string } | { kind: 'link'; link: Link } | null;
type Drag = { kind: 'pan'; x: number; y: number; vx: number; vy: number } | { kind: 'node'; id: string; x: number; y: number; from: Point | null; moved: boolean } | null;

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
export function PlayScreen({ level, mode, newTypes, nextLevelId, onPassed, tutorial: tutorialAtStart, onTutorialDone }: Props) {
  const fresh = useCallback(() => createGame(level, startingDesign(level, mode)), [level, mode]);
  const [game, setGame] = useState<GameState>(fresh);
  const [paused, setPaused] = useState(false);
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
  const live = useRef({ game, layer, selection, hoverLink, dragLine, paused, speed });
  live.current = { game, layer, selection, hoverLink, dragLine, paused, speed };
  const passed = useRef(false);
  const endId = useId();
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
  const centre = useCallback(() => {
    const r = field.current?.getBoundingClientRect();
    view.current = { x: ((r?.width ?? 1200) - WORLD.w) / 2 + 140, y: ((r?.height ?? 560) - WORLD.h) / 2, z: 1 };
    applyView();
  }, []);
  useEffect(() => { centre(); }, [centre]);
  const zoomAt = (factor: number, cx: number, cy: number) => {
    const r = field.current!.getBoundingClientRect(), v = view.current;
    const z = Math.max(0.5, Math.min(1.8, v.z * factor)), k = z / v.z, px = cx - r.left, py = cy - r.top;
    view.current = { x: px - (px - v.x) * k, y: py - (py - v.y) * k, z };
    applyView();
  };
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
    setGame(g => {
      const next = build(g, type, level);
      if (next !== g) {
        const id = next.buildings.find(b => b.type === type)?.id;
        if (id) setSelection({ kind: 'building', id });
      }
      return next;
    });
    setLayer(l => (l === 1 ? 3 : l)); // layer 1 shows no buildings: show the new one
  }, [level]);
  const restart = () => { setGame(fresh()); setSelection(null); setNotes([]); setPaused(false); canvasApi.current?.clearRequests(); };

  // ───────── Keyboard ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && level.allowedComponents[index]) { doBuild(level.allowedComponents[index]!); e.preventDefault(); }
      else if (e.code === 'Space' && !target.closest('button')) { setPaused(p => !p); e.preventDefault(); }
      else if (e.key === 'Escape') setSelection(null);
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
      if (d.kind === 'pan') { view.current = { ...view.current, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }; applyView(); return; }
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
    return type ? t.hints[type] ?? t.genericHint(buildingName(type)) : null;
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
      </dl>
      {sizes.length > 1 && (
        <fieldset className="play-sizes" aria-label={spec.scalesOut ? i.size : i.tier}>
          <legend className="muted">{spec.scalesOut ? i.size : i.tier}</legend>
          {sizes.map(s => {
            const cost = instancePrice({ type: b.type, params: { ...b.params, size: s } }) * b.instances.length - Math.round(price * REFUND) * b.instances.length;
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
        <span className="play-res">⏱ <b className="play-phase">{building ? t.rt.phase.build(fmt(BUILD_PHASE_S - game.t)) : game.phase === 'wave' ? t.rt.phase.wave(fmt(waveEnd(level) - game.t)) : t.rt.phase.end}</b></span>
        <span className="play-res" role="meter" aria-label={t.rt.reputation} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.reputation)}>
          ❤ <span className="play-rep"><span style={{ width: `${game.reputation}%`, background: game.reputation < 35 ? 'var(--bad)' : game.reputation < 70 ? 'var(--warn)' : 'var(--ok)' }} /></span>{Math.round(game.reputation)}%
        </span>
        <FeedbackButton info={() => ({ level: level.id, mode, result: over ? (game.phase === 'won' ? `passed ${stars}★` : 'failed') : undefined })} />
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

        <section className="play-panel play-mission" aria-label={t.rt.mission}>
          <span className="label">{t.rt.mission}</span>
          <p className="mode-line">{t.modes.current(t.modes[mode].name)} · <a href={`#${level.id}`}>{t.modes.change}</a></p>
          {mode === 'guided' && <p role="note" className="play-lesson">{level.guidedHint}</p>}
          <p className="muted">{level.brief}</p>
          <p className="muted">{t.rt.waveInfo(level.play.wave.rps, level.play.wave.lengthS)}</p>
          {level.play.incident && <p className="play-incident">⚡ {t.rt.incidentInfo(buildingName(level.play.incident.componentType), level.play.incident.atS)}</p>}
          <ul className="objectives" aria-label={t.objectives}>
            {[[t.objectiveP95(level.requirements.p95Ms), flow && rps ? flow.p95 <= level.requirements.p95Ms : null], [t.objectiveErrors(level.requirements.maxErrorRate), flow && rps ? flow.errors <= level.requirements.maxErrorRate : null]].map(([label, ok]) => (
              <li key={String(label)} data-state={ok === null ? 'pending' : ok ? 'met' : 'failed'}><span className="box" aria-hidden="true">{ok === null ? '' : ok ? '✓' : '✕'}</span>{label}</li>
            ))}
          </ul>
          {newTypes.length > 0 && <p className="play-new">{t.newLabel} {newTypes.map(buildingName).join(', ')}</p>}
        </section>
        <div className="play-panel play-c4" role="group" aria-label={t.c4.label}>
          <span className="label">{t.c4.label}</span>
          {([1, 2, 3] as const).map(k => <button key={k} aria-pressed={layer === k} onClick={() => { setLayer(k); canvasApi.current?.clearRequests(); }}>{k} {t.c4.layers[k]}</button>)}
        </div>
        <div className="play-panel play-mapctl" role="group" aria-label={t.rt.map}>
          <span className="label">{t.rt.map}</span>
          <button aria-label={t.rt.zoomOut} onClick={() => { const r = field.current!.getBoundingClientRect(); zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); }}>−</button>
          <button aria-label={t.rt.zoomIn} onClick={() => { const r = field.current!.getBoundingClientRect(); zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); }}>+</button>
          <button onClick={centre}>{t.rt.center}</button>
          <button aria-pressed={game.autoLink} onClick={() => setGame(g => setAutoLink(g, !g.autoLink))}>{t.rt.autoLink(game.autoLink)}</button>
          <button onClick={() => setGame(g => rewire(g))}>⟲ {t.rt.rewire}</button>
        </div>
        {!over && <div className={`play-banner ${incidentHappened && game.phase === 'wave' ? 'bad' : game.phase === 'wave' ? 'warn' : ''}`} role="status">
          {building ? `⏱ ${t.rt.banner.build(Math.ceil(BUILD_PHASE_S - game.t))}` : incidentHappened ? t.rt.banner.incident : t.rt.banner.wave(level.play.wave.rps)}
        </div>}
        {tutorial && tutorialState !== 'skipped' && (step || tutorialState === 'done') && (
          <section className="play-panel play-tutorial" aria-label={t.tutorial.title} aria-live="polite">
            {step ? <>
              <span className="label">{t.tutorial.step(tutorialStep + 1, tutorial.length)}</span>
              <p>{step.text}</p>
              <button className="link-button" onClick={() => { setTutorialState('skipped'); onTutorialDone(); }}>{t.tutorial.skip}</button>
            </> : <p>{t.tutorial.done}</p>}
          </section>
        )}
        <div className="play-help">{t.rt.help}</div>
        <div className="play-log" aria-live="polite">{log.map((l, k) => <div key={k} className={l.tone}>[{fmt(l.t)}] {l.text}</div>)}</div>
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
          <div className="play-controls">
            {building && <button className={`btn go ${tutorialOnCall ? 'tutorial-target' : ''}`} onClick={() => setGame(g => callNow(g))}>{t.rt.build.call(Math.round((BUILD_PHASE_S - game.t) * EARLY_BONUS_PER_S))}</button>}
            <button className={`btn ${paused ? 'on' : ''}`} onClick={() => setPaused(p => !p)}>{paused ? t.rt.build.resume : t.rt.build.pause}</button>
            {[1, 2, 4].map(x => <button key={x} className={`btn ${speed === x ? 'on' : ''}`} aria-pressed={speed === x} onClick={() => setSpeed(x)}>{x}×</button>)}
            <button className="btn" aria-label={t.rt.build.restart} title={t.rt.build.restart} onClick={restart}>↺</button>
          </div>
        </section>
      </footer>

      {over && (
        <div className="backdrop">
          <div className="report" role="dialog" aria-modal="true" aria-labelledby={endId}>
            <Stars earned={stars} max={maxStars} />
            <h2 id={endId} className={game.phase === 'won' ? 'ok' : 'bad'}>{game.phase === 'won' ? t.rt.end.won : t.rt.end.lost}</h2>
            <p className="muted">{t.rt.end.summary(Math.floor(game.money), Math.round(game.visits).toLocaleString(), Math.round(game.reputation))}</p>
            <p className="muted">{t.rt.end.starsAt(level.play.starMoney[0] ?? 0, level.play.starMoney[1] ?? 0)}</p>
            {hint && <p className="note"><strong>{t.hintLabel}</strong> {hint}</p>}
            {game.phase === 'won' && <p className="note base-note">🏗 {t.base.reportLine(buildingCount(toDesign(game)))} · <a href={baseHref}>{t.base.view} →</a></p>}
            <div className="actions">
              <button className="secondary" onClick={restart}>{t.rt.end.again}</button>
              <a className="secondary" href={levelsHref}>{t.rt.end.map}</a>
              {game.phase === 'won' && nextLevelId && <a className="primary-link" href={`#${nextLevelId}/${mode}`}>{t.rt.end.next}</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

