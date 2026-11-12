/**
 * PROTOTYPE — throwaway. Two ways to show the map controls and the C4 view on the game screen, plus a
 * fighting-game style announcement instead of the always-on banner.
 * Open the game with `?variant=A` or `?variant=B` before the hash (e.g. `/?variant=B#01-hello-world`).
 * The bar at the bottom (or ← / →) switches between Actual, A and B. Dev builds only.
 */
import { useEffect, useState } from 'react';
import { lang } from '../../i18n';
import type { C4Layer } from './flowCanvas';

export type ProtoVariant = 'A' | 'B' | 'C';
const VARIANTS = ['Actual', 'A', 'B', 'C'] as const;
const NAMES: Record<(typeof VARIANTS)[number], string> = { Actual: 'Actual', A: 'A · Iconos como un mapa', B: 'B · El zoom es la vista C4', C: 'C · Cada control en su sitio' };

export function protoVariant(): ProtoVariant | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('variant');
  return v === 'A' || v === 'B' || v === 'C' ? v : null;
}

const es = () => lang() === 'es';
const LAYERS: Record<C4Layer, { icon: string; es: string; en: string }> = {
  1: { icon: '🌐', es: 'Sistema', en: 'System' },
  2: { icon: '▣', es: 'Contenedores', en: 'Containers' },
  3: { icon: '⚙', es: 'Componentes', en: 'Components' },
};
const name = (k: C4Layer) => (es() ? LAYERS[k].es : LAYERS[k].en);

/** The floating bar that switches variant; it reloads the page with the new `?variant=`. */
export function PrototypeSwitcher() {
  if (!import.meta.env.DEV) return null;
  const current = (new URLSearchParams(location.search).get('variant') ?? 'Actual') as (typeof VARIANTS)[number];
  const i = Math.max(0, VARIANTS.indexOf(current));
  const go = (d: number) => {
    const next = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length]!;
    const url = new URL(location.href);
    if (next === 'Actual') url.searchParams.delete('variant'); else url.searchParams.set('variant', next);
    location.href = url.toString();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="proto-switch" role="group" aria-label="Prototype variant">
      <button onClick={() => go(-1)} aria-label="Previous variant">◀</button>
      <span>PROTOTIPO · {NAMES[current]}</span>
      <button onClick={() => go(1)} aria-label="Next variant">▶</button>
    </div>
  );
}

/** Big text in the middle of the map that shows once and fades, like "Round 1… Fight!". */
export function Announcer({ phase, buildLeft, incident, started }: { phase: string; buildLeft: number; incident: boolean; started: boolean }) {
  const [flash, setFlash] = useState<{ id: number; text: string; tone: string } | null>(null);
  const show = (text: string, tone: string, ms = 1800) => {
    const id = Date.now();
    setFlash({ id, text, tone });
    setTimeout(() => setFlash(f => (f?.id === id ? null : f)), ms);
  };
  useEffect(() => { if (started) show(es() ? '¡A construir!' : 'Build!', 'ok', 1400); }, [started]);
  useEffect(() => { if (phase === 'wave') show(es() ? '🚀 ¡En producción!' : '🚀 Live!', 'warn'); }, [phase]);
  useEffect(() => { if (incident) show(es() ? '⚡ ¡Se cae un servidor!' : '⚡ A server is down!', 'bad'); }, [incident]);
  const count = phase === 'build' && started && buildLeft <= 3 && buildLeft > 0 ? buildLeft : null;
  if (count) return <div key={`c${count}`} className="proto-announce count" aria-hidden="true">{count}</div>;
  if (!flash) return null;
  return <div key={flash.id} className={`proto-announce ${flash.tone}`} role="status">{flash.text}</div>;
}

type MapProps = { layer: C4Layer; setLayer: (k: C4Layer) => void; zoom: (factor: number) => void; centre: () => void };

/** A: map-app icons. Zoom column bottom-right, C4 as three icons bottom-left. */
export function VariantA({ layer, setLayer, zoom, centre }: MapProps) {
  return <>
    <div className="play-panel proto-a-zoom" role="group" aria-label="Mapa">
      <button onClick={() => zoom(1.2)} title={es() ? 'Acercar' : 'Zoom in'} aria-label={es() ? 'Acercar' : 'Zoom in'}>+</button>
      <button onClick={() => zoom(1 / 1.2)} title={es() ? 'Alejar' : 'Zoom out'} aria-label={es() ? 'Alejar' : 'Zoom out'}>−</button>
      <button onClick={centre} title={es() ? 'Centrar' : 'Center'} aria-label={es() ? 'Centrar' : 'Center'}>⌖</button>
    </div>
    <div className="play-panel proto-a-c4" role="group" aria-label="Vista C4">
      {([1, 2, 3] as const).map(k => (
        <button key={k} aria-pressed={layer === k} onClick={() => setLayer(k)} title={name(k)} aria-label={name(k)}>
          <span aria-hidden="true">{LAYERS[k].icon}</span><small>{name(k)}</small>
        </button>
      ))}
    </div>
  </>;
}

/** B: one rail on the right. + and − walk through Components → Containers → System, then zoom. */
export function VariantB({ layer, step, centre }: { layer: C4Layer; step: (dir: 1 | -1) => void; centre: () => void }) {
  return (
    <div className="play-panel proto-b-rail" role="group" aria-label={es() ? 'Nivel de detalle' : 'Level of detail'}>
      <button onClick={() => step(1)} aria-label={es() ? 'Más detalle' : 'More detail'} title={es() ? 'Más detalle' : 'More detail'}>+</button>
      {([3, 2, 1] as const).map(k => (
        <span key={k} className="proto-b-stop" data-on={layer === k}>
          <span className="proto-b-name">{name(k)}</span><span className="proto-b-dot" aria-hidden="true" />
        </span>
      ))}
      <button onClick={() => step(-1)} aria-label={es() ? 'Menos detalle' : 'Less detail'} title={es() ? 'Menos detalle' : 'Less detail'}>−</button>
      <button className="proto-b-centre" onClick={centre} aria-label={es() ? 'Centrar' : 'Center'} title={es() ? 'Centrar' : 'Center'}>⌖</button>
    </div>
  );
}

/** Auto-connect and Reconnect, moved out of the map (A: Build panel, B: empty Inspector). */
export function LinkTools({ autoLink, toggle, rewire }: { autoLink: boolean; toggle: () => void; rewire: () => void }) {
  return (
    <div className="proto-links">
      <label><input type="checkbox" checked={autoLink} onChange={toggle} /> 🔗 {es() ? 'Auto-conectar' : 'Auto-connect'}</label>
      <button className="btn" onClick={rewire}>⟲ {es() ? 'Reconectar' : 'Reconnect'}</button>
    </div>
  );
}

/** C: the C4 view as its own panel with names, bottom-left. */
export function C4Panel({ layer, setLayer }: { layer: C4Layer; setLayer: (k: C4Layer) => void }) {
  return (
    <div className="play-panel proto-c-c4" role="group" aria-label="Vista C4">
      <span className="label">{es() ? 'Vista C4' : 'C4 view'}</span>
      {([1, 2, 3] as const).map(k => (
        <button key={k} aria-pressed={layer === k} onClick={() => setLayer(k)}>
          <span className="proto-b-dot" aria-hidden="true" /><span aria-hidden="true">{LAYERS[k].icon}</span> {name(k)}
        </button>
      ))}
    </div>
  );
}

/** C: one column of icon tools bottom-right: auto-connect, reconnect, zoom, center. */
export function MapTools({ autoLink, toggle, rewire, zoom, centre, help, log }: { autoLink: boolean; toggle: () => void; rewire: () => void; zoom: (f: number) => void; centre: () => void; help: string; log: { time: string; text: string; tone: string }[] }) {
  const [open, setOpen] = useState(false);
  const tip = (e: string, en: string) => (es() ? e : en);
  const b = (label: string, icon: string, onClick: () => void, pressed?: boolean) => (
    <button onClick={onClick} aria-label={label} aria-pressed={pressed} data-tip={label}>{icon}</button>
  );
  return <>
    <div className="play-panel proto-c-tools" role="group" aria-label={tip('Conexiones', 'Links')}>
      {b(tip(`Auto-conectar: ${autoLink ? 'sí' : 'no'}`, `Auto-connect: ${autoLink ? 'on' : 'off'}`), '🔗', toggle, autoLink)}
      {b(tip('Reconectar todo', 'Reconnect all'), '⟲', rewire)}
      {b(tip('Ayuda y eventos', 'Help and events'), '?', () => setOpen(o => !o), open)}
    </div>
    {open && (
      <div className="play-panel proto-c-help" role="dialog" aria-label={tip('Ayuda', 'Help')}>
        <span className="label">{tip('Controles', 'Controls')}</span>
        <ul>{help.split(' · ').map(h => <li key={h}>{h}</li>)}</ul>
        <span className="label">{tip('Últimos eventos', 'Latest events')}</span>
        <ul className="proto-c-events">{log.length ? log.map((l, k) => <li key={k} className={l.tone}><b>[{l.time}]</b> {l.text}</li>) : <li className="muted">—</li>}</ul>
      </div>
    )}
    <div className="play-panel proto-c-zoom" role="group" aria-label={tip('Mapa', 'Map')}>
      {b(tip('Acercar', 'Zoom in'), '+', () => zoom(1.2))}
      {b(tip('Alejar', 'Zoom out'), '−', () => zoom(1 / 1.2))}
      {b(tip('Centrar', 'Center'), '⌖', centre)}
    </div>
  </>;
}

/** C: pause and speed next to the clock in the top bar. */
export function TimeControls({ paused, togglePause, speed, setSpeed, disabled }: { paused: boolean; togglePause: () => void; speed: number; setSpeed: (x: number) => void; disabled: boolean }) {
  return (
    <span className="proto-c-time" role="group" aria-label={es() ? 'Velocidad' : 'Speed'}>
      <button aria-pressed={paused} disabled={disabled} onClick={togglePause} aria-label={paused ? (es() ? 'Seguir' : 'Resume') : (es() ? 'Pausa' : 'Pause')} title={es() ? 'Pausa (Espacio)' : 'Pause (Space)'}>{paused ? '▶' : '⏸'}</button>
      {[1, 2, 4].map(x => <button key={x} aria-pressed={!paused && speed === x} onClick={() => setSpeed(x)}>{x}×</button>)}
    </span>
  );
}

/** C: the early-wave button, as a release to production, at the bottom of the Build panel. */
export function ReleaseButton({ bonus, onClick, className }: { bonus: number; onClick: () => void; className: string }) {
  return (
    <button className={`btn go proto-c-call ${className}`} onClick={onClick}>
      <span className="proto-c-call-main">🚀 {es() ? 'Release a producción' : 'Release to production'}</span>
      <small>{es() ? `Los usuarios llegan ya · +$${bonus} por adelantarte` : `Users arrive now · +$${bonus} for going early`}</small>
    </button>
  );
}
