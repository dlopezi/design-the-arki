import { useMemo, useState } from 'react';
import { en as t, percent } from '../i18n/en';
import { DEMO, runDemo, type DemoOutcome } from '../landing/demo';
import { mainAction } from '../landing/mainAction';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';
import { loadLevel } from './diagram';
import { levelsHref } from './routes';

/** A small C4-style picture of the demo design, with requests travelling along the connections. */
function DemoDiagram({ instances, rps, outcome }: { instances: number; rps: number; outcome: DemoOutcome }) {
  const lb = instances > 1;
  const gap = 58, height = Math.max(120, instances * gap + 40), mid = height / 2;
  const appX = lb ? 330 : 250, dbX = 500;
  const apps = Array.from({ length: instances }, (_, i) => ({ y: mid - ((instances - 1) * gap) / 2 + i * gap, load: outcome.instanceLoads[i] ?? 0 }));
  const edges = [
    ...(lb ? [`M 96 ${mid} L 160 ${mid}`] : []),
    ...apps.map(a => lb ? `M 240 ${mid} C 280 ${mid}, 280 ${a.y}, ${appX} ${a.y}` : `M 96 ${mid} C 160 ${mid}, 180 ${a.y}, ${appX} ${a.y}`),
    ...apps.map(a => `M ${appX + 100} ${a.y} C ${appX + 130} ${a.y}, ${dbX - 30} ${mid}, ${dbX} ${mid}`),
  ];
  const worst = loadLevel(Math.max(0, ...outcome.instanceLoads));
  const dots = Math.max(1, Math.min(4, Math.round(rps / 100)));
  const travelS = 1.6 - Math.min(0.8, rps / 1000);
  return (
    <svg className="demo-diagram" viewBox={`0 0 620 ${height}`} role="img" aria-label={t.landing.demo.diagramLabel(instances)}>
      {edges.map((d, i) => <path key={i} d={d} className="demo-edge" />)}
      <g className="demo-dots">
        {edges.map((d, i) => Array.from({ length: dots }, (_, k) => (
          <circle key={`${i}-${k}`} r="3.5" className={`demo-dot ${worst}`}>
            <animateMotion dur={`${travelS}s`} begin={`${(k / dots) * travelS}s`} repeatCount="indefinite" path={d} />
          </circle>
        )))}
      </g>
      <g className="demo-person"><circle cx="58" cy={mid - 18} r="13" /><rect x="22" y={mid - 2} width="74" height="34" rx="12" /><text x="59" y={mid + 20}>{t.landing.demo.clients}</text></g>
      {lb && <g className="demo-node"><rect x="160" y={mid - 22} width="80" height="44" rx="8" /><text x="200" y={mid - 3}>{t.landing.demo.loadBalancer[0]}</text><text x="200" y={mid + 12}>{t.landing.demo.loadBalancer[1]}</text></g>}
      {apps.map((a, i) => (
        <g key={i} className={`demo-node ${loadLevel(a.load)}`}>
          <rect x={appX} y={a.y - 22} width="100" height="44" rx="8" />
          <text x={appX + 50} y={a.y - 3}>app-{i + 1}</text>
          <text x={appX + 50} y={a.y + 13} className="demo-sub">{t.landing.demo.load(Math.round(a.load * 100))}</text>
        </g>
      ))}
      <g className="demo-node"><rect x={dbX} y={mid - 22} width="96" height="44" rx="8" /><text x={dbX + 48} y={mid - 3}>{t.landing.demo.database}</text><text x={dbX + 48} y={mid + 12} className="demo-sub">{t.landing.demo.databaseTech}</text></g>
    </svg>
  );
}

function Demo() {
  const d = t.landing.demo;
  const [rps, setRps] = useState(300);
  const [instances, setInstances] = useState(1);
  const outcome = useMemo(() => runDemo({ rps, instances }), [rps, instances]);
  const verdict = outcome.passed ? d.holds : d.overloaded[outcome.bottleneck ?? 'other'];
  const tip = outcome.passed ? (instances > 1 ? d.tipScaled : d.tipStart)
    : outcome.bottleneck === 'appServer' && instances < DEMO.maxInstances ? d.tipAdd : d.tipOther;
  const slow = outcome.p95 > DEMO.requirements.p95Ms, failing = outcome.errorRate > DEMO.requirements.maxErrorRate;
  return (
    <section className="demo" aria-label={d.label}>
      <div className="demo-head">
        <span className="eyebrow">{d.title}</span>
        <span className={`demo-verdict ${outcome.passed ? 'ok' : 'bad'}`} role="status">{verdict}</span>
      </div>
      <DemoDiagram instances={instances} rps={rps} outcome={outcome} />
      <div className="demo-controls">
        <label>{d.traffic} <b>{d.rps(rps)}</b>
          <input type="range" min={DEMO.minRps} max={DEMO.maxRps} step={DEMO.stepRps} value={rps} onChange={e => setRps(Number(e.target.value))} />
        </label>
        <div className="stepper" role="group" aria-label={d.appServers}>
          <span>{d.appServers}</span>
          <button onClick={() => setInstances(i => Math.max(1, i - 1))} disabled={instances <= 1} aria-label={d.removeInstance}>−</button>
          <b className="demo-count">{instances}</b>
          <button onClick={() => setInstances(i => Math.min(DEMO.maxInstances, i + 1))} disabled={instances >= DEMO.maxInstances} aria-label={d.addInstance}>+</button>
        </div>
      </div>
      <dl className="demo-stats">
        <div><dt>{d.p95}</dt><dd className={slow ? 'bad' : ''}>{outcome.p95 >= 1000 ? d.overSecond : `${Math.round(outcome.p95)} ms`}</dd></div>
        <div><dt>{d.errors}</dt><dd className={failing ? 'bad' : ''}>{percent(outcome.errorRate)}</dd></div>
        <div><dt>{d.cost}</dt><dd>${outcome.cost}</dd></div>
      </dl>
      <p className="demo-tip">{tip}</p>
    </section>
  );
}

/** The first page a visitor sees: what the game is, a tiny playable demo, and one button to start. */
export function Landing({ levels, progress }: { levels: LevelDefinition[]; progress: Progress }) {
  const action = mainAction(levels, progress);
  const l = t.landing;
  return (
    <div className="landing">
      <header className="landing-bar">
        <span className="landing-logo">{t.levelSelect.title}</span>
        <a className="landing-levels" href={levelsHref}>{action.returning ? l.yourLevels : l.allLevels}</a>
      </header>
      <main className="landing-hero">
        <h1>{l.headline}<br /><span>{l.headlineAccent}</span></h1>
        <p className="landing-pitch">{l.pitch}</p>
        <Demo />
        <div className="landing-cta">
          <a className="landing-play" href={action.href}>▶ {action.label}</a>
          <span className="muted">{l.freeNote}</span>
        </div>
      </main>
      <section className="landing-steps" aria-label={l.stepsLabel}>
        {l.steps.map(s => <div key={s.title}><h2>{s.title}</h2><p>{s.text}</p></div>)}
      </section>
      <footer className="landing-foot">
        <a className="landing-play" href={action.href}>▶ {action.label}</a>
        <span className="muted">{l.computerNote}</span>
      </footer>
    </div>
  );
}
