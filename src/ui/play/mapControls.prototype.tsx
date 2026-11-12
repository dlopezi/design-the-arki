/**
 * PROTOTYPE — throwaway. Two ways to show the map controls and the C4 view on the game screen, plus a
 * fighting-game style announcement instead of the always-on banner.
 * Open the game with `?variant=A` or `?variant=B` before the hash (e.g. `/?variant=B#01-hello-world`).
 * The bar at the bottom (or ← / →) switches between Actual, A and B. Dev builds only.
 */
import { useEffect, useState } from 'react';
import { lang } from '../../i18n';
import type { C4Layer } from './flowCanvas';

export type ProtoVariant = 'A' | 'B';
const VARIANTS = ['Actual', 'A', 'B'] as const;
const NAMES: Record<(typeof VARIANTS)[number], string> = { Actual: 'Actual', A: 'A · Iconos como un mapa', B: 'B · El zoom es la vista C4' };

export function protoVariant(): ProtoVariant | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('variant');
  return v === 'A' || v === 'B' ? v : null;
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
  useEffect(() => { if (phase === 'wave') show(es() ? '¡Llegan los usuarios!' : 'Here they come!', 'warn'); }, [phase]);
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
