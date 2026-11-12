import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import type { C4Layer } from './flowCanvas';

const LAYER_ICON: Record<C4Layer, string> = { 1: '🌐', 2: '▣', 3: '⚙' };

/** Big text in the middle of the map that shows once and fades, like "Round 1… Fight!"; a 3-2-1 count before the wave. */
export function Announcer({ phase, buildLeft, incident, started }: { phase: string; buildLeft: number; incident: boolean; started: boolean }) {
  const [flash, setFlash] = useState<{ id: number; text: string; tone: string } | null>(null);
  const show = (text: string, tone: string, ms = 1800) => {
    const id = Date.now();
    setFlash({ id, text, tone });
    setTimeout(() => setFlash(f => (f?.id === id ? null : f)), ms);
  };
  const a = t.rt.announce;
  useEffect(() => { if (started) show(a.build, 'ok', 1400); }, [started]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'wave') show(a.live, 'warn'); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (incident) show(a.incident, 'bad'); }, [incident]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = phase === 'build' && started && buildLeft <= 3 && buildLeft > 0 ? buildLeft : null;
  if (count) return <div key={`c${count}`} className="play-announce count" aria-hidden="true">{count}</div>;
  if (!flash) return null;
  return <div key={flash.id} className={`play-announce ${flash.tone}`} role="status">{flash.text}</div>;
}

/** The C4 view as its own panel, with the layer names always shown. */
export function C4Panel({ layer, setLayer }: { layer: C4Layer; setLayer: (k: C4Layer) => void }) {
  return (
    <div className="play-panel play-c4" role="group" aria-label={t.c4.label}>
      <span className="label">{t.c4.label}</span>
      {([1, 2, 3] as const).map(k => (
        <button key={k} aria-pressed={layer === k} onClick={() => setLayer(k)}>
          <span className="dot" aria-hidden="true" /><span aria-hidden="true">{LAYER_ICON[k]}</span> {t.c4.layers[k]}
        </button>
      ))}
    </div>
  );
}

type Tools = {
  autoLink: boolean; toggleAutoLink: () => void; rewire: () => void;
  zoom: (factor: number) => void; centre: () => void;
  log: { time: string; text: string; tone: string }[];
};

/** Icon tools at the map's bottom-right: links (auto-connect, reconnect, help) and the view (zoom, center). */
export function MapTools({ autoLink, toggleAutoLink, rewire, zoom, centre, log }: Tools) {
  const [help, setHelp] = useState(false);
  const r = t.rt;
  const tool = (label: string, icon: string, onClick: () => void, pressed?: boolean) => (
    <button onClick={onClick} aria-label={label} aria-pressed={pressed} data-tip={label}>{icon}</button>
  );
  return <>
    <div className="play-panel play-tools play-links" role="group" aria-label={r.tools.links}>
      {tool(r.autoLink(autoLink), '🔗', toggleAutoLink, autoLink)}
      {tool(r.tools.rewire, '⟲', rewire)}
      {tool(r.tools.help, '?', () => setHelp(h => !h), help)}
    </div>
    <div className="play-panel play-tools play-zoom" role="group" aria-label={r.map}>
      {tool(r.zoomIn, '+', () => zoom(1.2))}
      {tool(r.zoomOut, '−', () => zoom(1 / 1.2))}
      {tool(r.center, '⌖', centre)}
    </div>
    {help && (
      <section className="play-panel play-helpbox" aria-label={r.tools.help}>
        <span className="label">{r.tools.controls}</span>
        <ul>{r.help.split(' · ').map(h => <li key={h}>{h}</li>)}</ul>
        <span className="label">{r.tools.events}</span>
        <ul className="play-events">
          {log.length ? log.map((l, k) => <li key={k} className={l.tone}><b>[{l.time}]</b> {l.text}</li>) : <li className="muted">{r.tools.none}</li>}
        </ul>
      </section>
    )}
  </>;
}

/** Pause and speed, next to the clock in the top bar. */
export function TimeControls({ paused, togglePause, speed, setSpeed, disabled }: { paused: boolean; togglePause: () => void; speed: number; setSpeed: (x: number) => void; disabled: boolean }) {
  const s = t.rt.time;
  return (
    <span className="play-time" role="group" aria-label={s.label}>
      <button aria-pressed={paused} disabled={disabled} onClick={togglePause} aria-label={paused ? s.resume : s.pause} title={paused ? s.resume : s.pause}>{paused ? '▶' : '⏸'}</button>
      {[1, 2, 4].map(x => <button key={x} aria-pressed={!paused && speed === x} onClick={() => setSpeed(x)}>{x}×</button>)}
    </span>
  );
}

/** Ends the build phase early, as a release to production; sits at the bottom of the Build panel. */
export function ReleaseButton({ bonus, onClick, highlight }: { bonus: number; onClick: () => void; highlight: boolean }) {
  return (
    <button className={`btn go play-release ${highlight ? 'tutorial-target' : ''}`} onClick={onClick}>
      <span className="main">{t.rt.release.title}</span>
      <small>{t.rt.release.note(bonus)}</small>
    </button>
  );
}
