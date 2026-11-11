import type { CSSProperties, ReactNode } from 'react';
import { t } from '../i18n';

/**
 * How each component type looks: a small isometric building in the type's colour, standing on a pad,
 * so the design reads like a base in a strategy game and players tell components apart at a glance.
 * Every catalog type needs a colour and a building (componentArt.test.ts).
 */
export const componentArt: Record<string, { color: string }> = {
  loadBalancer: { color: '#4f8ef7' },
  appServer: { color: '#34b97a' },
  cache: { color: '#f59e0b' },
  database: { color: '#9b6bff' },
};

/** The name players see for a component type: its real name (load balancer, app server…), never a made-up one. */
export const buildingName = (type: string) => t.componentTypes[type] ?? type;

/** Grey for a failed instance, and for a type without art. */
const GREY = '#5b6577';
const WINDOW = '#fde68a';

/** Mixes a #rrggbb colour toward white (f > 0) or black (f < 0). */
export function shade(hex: string, f: number): string {
  const target = f > 0 ? 255 : 0;
  const k = Math.abs(f);
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (target - v) * k));
  return `#${channels.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

type Palette = { base: string; light: string; dark: string; top: string; glow: string; window: string };
const paletteOf = (color: string, down: boolean): Palette => ({
  base: color, light: shade(color, 0.25), dark: shade(color, -0.45), top: shade(color, 0.45),
  glow: down ? shade(color, -0.2) : shade(color, 0.6), window: down ? '#3a3f4a' : WINDOW,
});

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** An isometric box standing on the ground point (cx, cy): w is half its width, h its height. */
function IsoBox({ cx, cy, w, h, p }: { cx: number; cy: number; w: number; h: number; p: Palette }) {
  const d = w / 2;
  return (
    <g strokeWidth={0.6} stroke={p.dark} strokeLinejoin="round">
      <polygon points={pts([[cx - w, cy], [cx, cy + d], [cx, cy + d - h], [cx - w, cy - h]])} fill={p.dark} />
      <polygon points={pts([[cx, cy + d], [cx + w, cy], [cx + w, cy - h], [cx, cy + d - h]])} fill={p.base} />
      <polygon points={pts([[cx - w, cy - h], [cx, cy - d - h], [cx + w, cy - h], [cx, cy + d - h]])} fill={p.top} />
    </g>
  );
}

/** A quad on the right (u from the front corner) or left (u from the left corner) face of an IsoBox; v is height. */
const faceQuad = (side: 'left' | 'right', cx: number, cy: number, w: number, u1: number, u2: number, v1: number, v2: number) => {
  const at = (u: number, v: number): [number, number] => side === 'right'
    ? [cx + u * w, cy + w / 2 - (u * w) / 2 - v]
    : [cx - w + u * w, cy + (u * w) / 2 - v];
  return pts([at(u1, v1), at(u2, v1), at(u2, v2), at(u1, v2)]);
};

/** A vertical cylinder whose bottom centre is (cx, cy). */
function Cylinder({ cx, cy, r, h, p }: { cx: number; cy: number; r: number; h: number; p: Palette }) {
  const ry = r / 2, top = cy - h;
  return (
    <g stroke={p.dark} strokeWidth={0.6}>
      <path d={`M${cx - r},${top} L${cx - r},${cy} A${r} ${ry} 0 0 0 ${cx + r},${cy} L${cx + r},${top} Z`} fill={p.base} />
      <path d={`M${cx - r},${top} L${cx - r},${cy} A${r} ${ry} 0 0 0 ${cx},${cy + ry} L${cx},${top + ry} A${r} ${ry} 0 0 1 ${cx - r},${top} Z`} fill={p.dark} stroke="none" />
      {[0.33, 0.66].map(f => <path key={f} d={`M${cx - r},${top + h * f} A${r} ${ry} 0 0 0 ${cx + r},${top + h * f}`} fill="none" stroke={p.top} strokeOpacity={0.5} />)}
      <ellipse cx={cx} cy={top} rx={r} ry={ry} fill={p.top} />
    </g>
  );
}

/** The ground pad every building stands on. */
const Pad = ({ p }: { p: Palette }) => (
  <polygon points={pts([[4, 50], [32, 36], [60, 50], [32, 64]])} fill="#111a1e" stroke={p.base} strokeOpacity={0.55} strokeWidth={1} />
);

export const buildings: Record<string, (p: Palette) => ReactNode> = {
  // Relay tower: spreads the signal (requests) to the buildings behind it.
  loadBalancer: p => <>
    <IsoBox cx={32} cy={48} w={14} h={6} p={p} />
    <IsoBox cx={32} cy={41} w={2.5} h={26} p={p} />
    <path d="M32 20 L18 27 M32 20 L46 27 M32 26 L22 31 M32 26 L42 31" stroke={p.light} strokeWidth={1.4} strokeLinecap="round" />
    <ellipse cx={18} cy={27} rx={3.4} ry={2} fill={p.top} stroke={p.dark} strokeWidth={0.5} />
    <ellipse cx={46} cy={27} rx={3.4} ry={2} fill={p.top} stroke={p.dark} strokeWidth={0.5} />
    <circle cx={32} cy={12} r={6} fill={p.glow} opacity={0.3} />
    <circle cx={32} cy={12} r={2.6} fill={p.glow} />
    <path d="M40 8 a10 10 0 0 1 4 8 M24 8 a10 10 0 0 0 -4 8" fill="none" stroke={p.glow} strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
  </>,
  // Factory: does the work (runs the application code).
  appServer: p => <>
    <IsoBox cx={29} cy={47} w={17} h={15} p={p} />
    <polygon points={faceQuad('left', 29, 47, 17, 0.55, 0.85, 0, 8)} fill="#0b1114" />
    {[0.12, 0.42, 0.72].map(u => <polygon key={u} points={faceQuad('right', 29, 47, 17, u, u + 0.2, 7, 11)} fill={p.window} />)}
    <IsoBox cx={23} cy={31} w={3.5} h={10} p={p} />
    <IsoBox cx={33} cy={29} w={3} h={7} p={p} />
    <IsoBox cx={47} cy={50} w={7} h={8} p={p} />
    <polygon points={faceQuad('right', 47, 50, 7, 0.25, 0.75, 3, 5.5)} fill={p.window} />
  </>,
  // Generator: a floating energy crystal that answers fast from what it already holds.
  cache: p => <>
    <IsoBox cx={32} cy={50} w={16} h={7} p={p} />
    <ellipse cx={32} cy={43} rx={9} ry={4.5} fill={p.glow} opacity={0.55} />
    <ellipse cx={32} cy={23} rx={15} ry={4.5} fill="none" stroke={p.light} strokeWidth={1} opacity={0.7} />
    <polygon points={pts([[32, 6], [41, 22], [32, 38], [23, 22]])} fill={p.light} stroke={p.dark} strokeWidth={0.6} />
    <polygon points={pts([[32, 6], [41, 22], [32, 38]])} fill={p.base} />
    <polygon points={pts([[32, 11], [36, 22], [32, 30], [28, 22]])} fill={p.glow} opacity={0.85} />
  </>,
  // Silos: store what every request needs.
  database: p => <>
    <Cylinder cx={41} cy={45} r={8} h={20} p={p} />
    <Cylinder cx={26} cy={52} r={11} h={27} p={p} />
    <path d="M34 34 L37 32" stroke={p.light} strokeWidth={2} />
    <circle cx={26} cy={25} r={2} fill={p.glow} />
  </>,
};

/** A building for a component type; grey with smoke when the instance is down. */
export function Building({ type, size, down = false }: { type: string; size: number; down?: boolean }) {
  const p = paletteOf(down ? GREY : componentArt[type]?.color ?? GREY, down);
  const draw = buildings[type];
  return (
    <svg className="building" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <Pad p={p} />
      {draw ? draw(p) : <IsoBox cx={32} cy={48} w={14} h={14} p={p} />}
      {down && <g className="smoke" fill="#9aa3b2" opacity={0.6}><circle cx={36} cy={14} r={5} /><circle cx={42} cy={8} r={4} /><circle cx={30} cy={9} r={3} /></g>}
    </svg>
  );
}

/** Sets `--art` to the type's colour; the hotbar card and the badge read it. */
export const artStyle = (type: string, down = false) => ({ '--art': down ? GREY : componentArt[type]?.color ?? GREY }) as CSSProperties;

/** The building at the left of a component (or, small, an instance) on the diagram. */
export function ComponentBadge({ type, small = false, down = false }: { type: string; small?: boolean; down?: boolean }) {
  return (
    <span className={`art-badge${small ? ' small' : ''}`} style={artStyle(type, down)}>
      <Building type={type} size={small ? 34 : 54} down={down} />
    </span>
  );
}
