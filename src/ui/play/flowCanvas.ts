import { catalog } from '../../catalog/catalog';
import { CLIENT, isServing, linkKey, type Link } from '../../realtime/flow';
import type { GameState } from '../../realtime/game';

/**
 * Draws the connections and the requests over the map, on a canvas laid over the field. Lines are thin curves that
 * leave a building from its right side and reach the next one on its left side, bending around any building in the way;
 * their colour says how they are doing. Requests travel along them and come back: green when answered, red with 503
 * from the building that failed. Everything is found by `data-node-id` in the DOM, so the drawing follows the map.
 */
export type C4Layer = 1 | 2 | 3;
export type Point = { x: number; y: number };
export type CanvasInput = {
  game: GameState; layer: C4Layer; selectedLink: Link | null; hoverLink: Link | null;
  dragLine: { from: Point; to: Point } | null; paused: boolean; speed: number;
};
type Curve = [Point, Point, Point, Point];
type Segment = { link: Link; from: Element; to: Element; health: 'ok' | 'warn' | 'bad' | 'off' | 'idle'; curve: Curve };
type Stop = { id: string; k: number };
type Particle = { stops: Stop[]; seg: number; f: number; kind: 'req' | 'reply' | 'error'; failAt: number | null; life: number; done: boolean };

const COLOR = { ok: '#3ee0c8', warn: '#fbbf24', bad: '#f87171', off: '#fbbf24', idle: '#5b6577' };
const sameLink = (a: Link | null, b: Link) => !!a && a.from === b.from && a.to === b.to;
const bez = (c: Curve, t: number): Point => {
  const u = 1 - t;
  return { x: u * u * u * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t * t * t * c[3].x,
           y: u * u * u * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t * t * t * c[3].y };
};
const sample = (c: Curve, n = 24) => Array.from({ length: n + 1 }, (_, i) => bez(c, i / n));
const lengthOf = (c: Curve) => { const p = sample(c, 16); let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y); return l; };
const reversed = (c: Curve): Curve => [c[3], c[2], c[1], c[0]];
const picture = (el: Element) => (el.querySelector('svg') ?? el).getBoundingClientRect();

export function startFlowCanvas(canvas: HTMLCanvasElement, field: HTMLElement, read: () => CanvasInput) {
  const ctx = canvas.getContext('2d')!;
  const particles: Particle[] = [];
  let spawnDebt = 0, frame = 0, last = performance.now(), segments: Segment[] = [];

  /** The elements that stand for a node: one per instance for a scaled component in layer 3, else one. */
  function elementsOf(id: string, layer: C4Layer): Element[] {
    if (id === CLIENT) return [...field.querySelectorAll('[data-node-id="client"]')];
    if (layer === 1) return [...field.querySelectorAll('[data-node="system"]')];
    return [...field.querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`)];
  }
  const instanceOf = (el: Element) => Number(el.getAttribute('data-instance') ?? 0);
  /** Instances that receive traffic: the first `usable` serving ones. */
  function activeInstances(game: GameState, id: string): Set<number> {
    const b = game.buildings.find(x => x.id === id); if (!b) return new Set();
    const usable = game.flow?.usable[id] ?? b.instances.filter(isServing).length;
    const serving = b.instances.map((i, k) => (isServing(i) ? k : -1)).filter(k => k >= 0);
    return new Set(serving.slice(0, Math.max(usable, game.phase === 'build' ? serving.length : 0)));
  }
  function anchor(el: Element, side: 'out' | 'in'): Point {
    const r = el.getAttribute('data-node-id') === CLIENT ? (el.querySelector('.globe') ?? el).getBoundingClientRect() : picture(el);
    return { x: side === 'out' ? r.right - 4 : r.left + 4, y: r.top + r.height * (el.getAttribute('data-node-id') === CLIENT ? 0.5 : 0.62) };
  }
  /** A curve from one element to another, bent up or down until it clears every other building. */
  function curveBetween(from: Element, to: Element, obstacles: { el: Element; r: DOMRect }[]): Curve {
    const a = anchor(from, 'out'), b = anchor(to, 'in');
    const blocks = obstacles.filter(o => o.el !== from && o.el !== to && !o.el.contains(from) && !o.el.contains(to)).map(o => o.r);
    const reach = Math.max(50, Math.abs(b.x - a.x) * 0.5);
    const back = b.x < a.x + 20 ? -120 : 0;
    const make = (bend: number): Curve => [a, { x: a.x + reach, y: a.y + bend }, { x: b.x - reach, y: b.y + bend }, b];
    const hits = (c: Curve) => sample(c).some(p => blocks.some(r => p.x > r.left - 6 && p.x < r.right + 6 && p.y > r.top - 6 && p.y < r.bottom + 6));
    for (const bend of [0, -40, 40, -80, 80, -120, 120, -170, 170, -230, 230]) { const c = make(bend + back); if (!hits(c)) return c; }
    return make(back);
  }
  function buildSegments(input: CanvasInput): Segment[] {
    const { game, layer } = input;
    const obstacles = [...field.querySelectorAll('[data-node-id]:not([data-node-id="client"])')].map(el => ({ el, r: picture(el) }));
    const out: Segment[] = [];
    const seen = new Set<string>();
    for (const link of game.links) {
      const froms = elementsOf(link.from, layer), tos = elementsOf(link.to, layer);
      const active = activeInstances(game, link.to);
      const target = game.buildings.find(b => b.id === link.to);
      const servingTarget = !!target?.instances.some(isServing);
      for (const from of froms) for (const to of tos) {
        if (from === to) continue;
        const key = `${layer}|${froms.indexOf(from)}|${link.from}>${link.to}|${tos.indexOf(to)}`;
        if (layer === 1 && seen.has(`${link.from === CLIENT}`)) continue;
        seen.add(layer === 1 ? `${link.from === CLIENT}` : key);
        const idle = layer === 3 && to.hasAttribute('data-instance') && !active.has(instanceOf(to));
        const drop = game.flow?.drop[link.to] ?? 0, load = game.flow?.load[link.to] ?? 0;
        const health = !servingTarget ? 'off' : idle ? 'idle' : drop > 1 ? 'bad' : load >= 0.7 ? 'warn' : 'ok';
        out.push({ link, from, to, health, curve: curveBetween(from, to, obstacles) });
      }
    }
    return out;
  }
  /** One request's way through the components, chosen by the traffic on each connection. */
  function route(game: GameState): Particle | null {
    const flow = game.flow; if (!flow) return null;
    const stops: Stop[] = [{ id: CLIENT, k: 0 }];
    let id = CLIENT, failAt: number | null = null;
    for (let hop = 0; hop < 12; hop++) {
      const b = game.buildings.find(x => x.id === id);
      if (b) {
        const inflow = flow.inflow[id] || 1;
        if (Math.random() < (flow.drop[id] ?? 0) / inflow) { failAt = stops.length - 1; break; }
        const spec = catalog[b.type]!;
        if (spec.endsRequests && !spec.shortcut) break;
        if (spec.shortcut) {
          // A cache hit is answered here: the share of what it kept that it did not send on.
          const sent = game.links.filter(l => l.from === id).reduce((s, l) => s + (flow.edge[linkKey(l)] ?? 0), 0);
          const kept = inflow - (flow.drop[id] ?? 0);
          if (Math.random() < 1 - sent / (kept || 1)) break;
        }
      }
      const out = game.links.filter(l => l.from === id).map(l => [l.to, flow.edge[linkKey(l)] ?? 0] as const).filter(([, v]) => v > 0);
      const total = out.reduce((s, [, v]) => s + v, 0);
      if (!total) { failAt = stops.length - 1; break; }
      let r = Math.random() * total;
      const next = out.find(([, v]) => (r -= v) <= 0)?.[0] ?? out[0]![0];
      const active = [...activeInstances(game, next)];
      stops.push({ id: next, k: active.length ? active[Math.floor(Math.random() * active.length)]! : 0 });
      id = next;
    }
    return { stops, seg: 0, f: 0, kind: 'req', failAt, life: 1, done: false };
  }
  function stopElement(stop: Stop, layer: C4Layer): Element | null {
    const els = elementsOf(stop.id, layer);
    return els.find(el => !el.hasAttribute('data-instance') || instanceOf(el) === stop.k) ?? els[0] ?? null;
  }
  function hopCurve(a: Stop, b: Stop, layer: C4Layer, forward: boolean): Curve | null {
    const ea = stopElement(a, layer), eb = stopElement(b, layer);
    if (!ea || !eb || ea === eb) return null;
    const match = segments.find(s => (forward ? s.from === ea && s.to === eb : s.from === eb && s.to === ea));
    const c = match?.curve ?? [anchor(forward ? ea : eb, 'out'), anchor(forward ? ea : eb, 'out'), anchor(forward ? eb : ea, 'in'), anchor(forward ? eb : ea, 'in')] as Curve;
    return forward ? c : reversed(c);
  }
  const strokeCurve = (c: Curve) => { ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y); ctx.stroke(); };
  function drawLines(input: CanvasInput) {
    const { game } = input;
    ctx.lineCap = 'round';
    for (const s of segments) {
      const selected = sameLink(input.selectedLink, s.link), hovered = sameLink(input.hoverLink, s.link);
      const color = selected ? '#ffffff' : COLOR[s.health];
      ctx.strokeStyle = color;
      ctx.setLineDash(s.health === 'off' ? [4, 6] : []);
      ctx.globalAlpha = selected || hovered ? 0.95 : s.health === 'idle' ? 0.3 : 0.5;
      ctx.lineWidth = selected || hovered ? 2.5 : 1.5;
      strokeCurve(s.curve);
      ctx.setLineDash([]);
      // Arrow head in the middle, so the direction is clear.
      const m = bez(s.curve, 0.5), m2 = bez(s.curve, 0.53), ang = Math.atan2(m2.y - m.y, m2.x - m.x);
      ctx.globalAlpha = selected || hovered ? 1 : 0.7; ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(m.x + 5 * Math.cos(ang), m.y + 5 * Math.sin(ang));
      ctx.lineTo(m.x + 5 * Math.cos(ang + 2.5), m.y + 5 * Math.sin(ang + 2.5)); ctx.lineTo(m.x + 5 * Math.cos(ang - 2.5), m.y + 5 * Math.sin(ang - 2.5)); ctx.fill();
      if ((selected || hovered) && game.flow) {
        const text = `${Math.round(game.flow.edge[linkKey(s.link)] ?? 0)}/s`;
        ctx.font = '800 11px ui-monospace, monospace';
        const w = ctx.measureText(text).width;
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(6,11,12,.9)'; ctx.fillRect(m.x - w / 2 - 4, m.y - 22, w + 8, 15);
        ctx.fillStyle = '#dce8e5'; ctx.fillText(text, m.x - w / 2, m.y - 11);
      }
      ctx.globalAlpha = 1;
    }
    // A small red badge on each building that loses requests.
    if (game.flow?.rps) {
      for (const [id, v] of Object.entries(game.flow.drop)) {
        if (v <= 1 || id === CLIENT) continue;
        const el = field.querySelector(`[data-container="${CSS.escape(id)}"]`) ?? elementsOf(id, input.layer)[0];
        if (!el) continue;
        const r = el.getBoundingClientRect(), x = r.right - 6, y = r.top + 6;
        ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#160406'; ctx.font = '900 9px ui-monospace, monospace'; ctx.fillText('!', x - 2.5, y + 3.5);
      }
    }
    if (input.dragLine) {
      const { from: a, to: b } = input.dragLine, reach = Math.max(40, Math.abs(b.x - a.x) * 0.5);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      strokeCurve([a, { x: a.x + reach, y: a.y }, { x: b.x - reach, y: b.y }, b]); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  function drawRequests(input: CanvasInput, dt: number) {
    const running = !input.paused && input.game.phase === 'wave';
    if (running && input.game.flow?.rps) {
      spawnDebt += (input.game.flow.rps / 30) * dt * input.speed;
      while (spawnDebt >= 1 && particles.length < 240) { spawnDebt--; const p = route(input.game); if (p) particles.push(p); }
    }
    for (const p of particles) {
      if (running && !p.done) {
        for (let k = 0; k < Math.min(input.speed, 4); k++) {
          if (p.failAt === p.seg && p.kind === 'req') { p.done = true; break; }
          const a = p.stops[p.seg], b = p.stops[p.seg + 1];
          if (!a || !b) { p.done = true; break; }
          const c = hopCurve(a, b, input.layer, p.kind === 'req');
          p.f = !c ? 1 : p.f + (300 * dt) / Math.max(1, lengthOf(c));
          if (p.f >= 1) { p.seg++; p.f = 0; }
        }
        if (p.done && p.kind === 'req') {
          // The answer travels back: green from where it was answered, red from where it failed.
          const back = p.stops.slice(0, p.seg + 1).reverse();
          if (back.length > 1) particles.push({ stops: back, seg: 0, f: 0, kind: p.failAt === null ? 'reply' : 'error', failAt: null, life: 1, done: false });
        }
      }
      if (p.done) p.life -= dt * 4;
      const a = p.stops[p.seg], b = p.stops[p.seg + 1];
      if (!a) continue;
      const c = b ? hopCurve(a, b, input.layer, p.kind === 'req') : null;
      const el = stopElement(a, input.layer);
      const pos = c ? bez(c, Math.min(1, p.f)) : el ? anchor(el, 'in') : null;
      if (!pos) { p.life = 0; continue; }
      const color = p.kind === 'reply' ? '#4ade80' : p.kind === 'error' ? '#f87171' : '#d9fffa';
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.fillRect(pos.x - 3, pos.y - 3 + (p.kind === 'req' ? -5 : 5), 6, 6); ctx.shadowBlur = 0;
      if (p.kind === 'error' && p.seg === 0 && p.f < 0.3) { ctx.font = '800 10px ui-monospace, monospace'; ctx.fillText('503', pos.x + 5, pos.y + 2); }
      ctx.globalAlpha = 1;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i]!.life <= 0) particles.splice(i, 1);
  }
  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const input = read();
    const r = field.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, -r.left * dpr, -r.top * dpr);
    ctx.clearRect(r.left, r.top, r.width, r.height);
    ctx.save(); ctx.beginPath(); ctx.rect(r.left, r.top, r.width, r.height); ctx.clip();
    segments = buildSegments(input);
    drawLines(input);
    drawRequests(input, dt);
    ctx.restore();
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return {
    stop: () => cancelAnimationFrame(frame),
    clearRequests: () => { particles.length = 0; },
    /** The connection under a screen point, if one is near enough to click. */
    linkAt(x: number, y: number): Link | null {
      let best: Link | null = null, bestD = 9;
      for (const s of segments) for (const p of sample(s.curve, 40)) { const d = Math.hypot(x - p.x, y - p.y); if (d < bestD) { bestD = d; best = s.link; } }
      return best;
    },
    /** Where a new line starts from a node. */
    anchorOf(id: string, layer: C4Layer): Point | null { const el = elementsOf(id, layer)[0]; return el ? anchor(el, 'out') : null; },
  };
}
