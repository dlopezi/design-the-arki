import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { lang, LANGS, setLang, t, percent } from '../i18n';
import { FeedbackDialog } from './feedbackDialog';
import { DEMO, runDemo, type DemoOutcome } from '../landing/demo';
import { mainAction } from '../landing/mainAction';
import { playerSummary } from '../landing/summary';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';
import { loadLevel } from './diagram';
import { Building } from './componentArt';
import { archiveHref, baseHref, levelsHref } from './routes';
import { baseOf } from '../base/base';

/** A building drawn inside the demo's SVG, its top-left corner at (x, y). */
const DemoBuilding = ({ type, x, y, size }: { type: string; x: number; y: number; size: number }) => (
  <g transform={`translate(${x}, ${y})`}><Building type={type} size={size} /></g>
);

/** A small C4-style picture of the demo design, with the game's buildings and requests travelling along the connections. */
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
      {lb && <g className="demo-node">
        <rect x="160" y={mid - 22} width="80" height="44" rx="3" />
        <DemoBuilding type="loadBalancer" x={178} y={mid - 22} size={44} />
        <text x="200" y={mid + 36} className="demo-sub">{t.landing.demo.loadBalancer.join(' ')}</text>
      </g>}
      {apps.map((a, i) => (
        <g key={i} className={`demo-node ${loadLevel(a.load)}`}>
          <rect x={appX} y={a.y - 22} width="100" height="44" rx="3" />
          <DemoBuilding type="appServer" x={appX + 1} y={a.y - 19} size={38} />
          <text x={appX + 68} y={a.y - 3}>app-{i + 1}</text>
          <text x={appX + 68} y={a.y + 13} className="demo-sub">{t.landing.demo.load(Math.round(a.load * 100))}</text>
        </g>
      ))}
      <g className="demo-node">
        <rect x={dbX} y={mid - 22} width="96" height="44" rx="3" />
        <DemoBuilding type="database" x={dbX + 1} y={mid - 19} size={38} />
        <text x={dbX + 64} y={mid - 3}>{t.landing.demo.database}</text>
        <text x={dbX + 64} y={mid + 12} className="demo-sub">{t.landing.demo.databaseTech}</text>
      </g>
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
    <section className="demo title-panel" aria-label={d.label}>
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

// The title screen's backdrop, as on System Defense: falling 0s and 1s over a sky that meets a moving data floor.
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const RAIN = Array.from({ length: 26 }, (_, i) => ({
  left: `${(rnd(i, 1) * 100).toFixed(1)}%`,
  duration: `${(9 + rnd(i, 2) * 9).toFixed(1)}s`,
  delay: `${(-rnd(i, 3) * 18).toFixed(1)}s`,
  digits: Array.from({ length: 5 }, (_, k) => (rnd(i, k + 4) > 0.5 ? '1' : '0')).join('\n'),
}));

function TitleBackground() {
  return (
    <div className="title-bg" aria-hidden="true">
      <div className="title-rain">
        {RAIN.map((d, i) => <span key={i} style={{ left: d.left, animationDuration: d.duration, animationDelay: d.delay }}>{d.digits}</span>)}
      </div>
      <div className="title-horizon" />
      <div className="title-floor" />
    </div>
  );
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  const l = t.landing;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="title-backdrop" onClick={onClose}>
      <div className="title-dialog title-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <h2 id={titleId}>{l.howToPlay}</h2>
        <div className="title-steps">
          {l.steps.map(s => <div key={s.title}><h3>{s.title}</h3><p>{s.text}</p></div>)}
        </div>
        <button ref={closeRef} className="title-close" onClick={onClose}>{l.close}</button>
      </div>
    </div>
  );
}

const REPO_URL = 'https://github.com/dlopezi/design-the-arki';

type MenuItem = { label: string; note: string } & ({ href: string } | { onClick: () => void });

/** The first page a visitor sees, styled as a game's title screen: player bar, logo, main menu and a playable training demo. */
export function Landing({ levels, progress }: { levels: LevelDefinition[]; progress: Progress }) {
  const l = t.landing;
  const action = mainAction(levels, progress);
  const summary = useMemo(() => playerSummary(levels, progress), [levels, progress]);
  const [selected, setSelected] = useState(0);
  const [howTo, setHowTo] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const buildings = useMemo(() => baseOf(levels, progress).buildings, [levels, progress]);
  const closeHowTo = useCallback(() => { setHowTo(false); itemRefs.current[2]?.focus(); }, []);
  const closeFeedback = useCallback(() => { setFeedback(false); itemRefs.current[5]?.focus(); }, []);

  const menu: MenuItem[] = [
    { href: action.href, label: action.label, note: !summary.next ? l.allPassed : action.returning ? summary.next.title : l.firstNote(summary.next.title) },
    { href: levelsHref, label: l.levelMap, note: l.levelMapNote },
    { onClick: () => setHowTo(true), label: l.howToPlay, note: l.howToPlayNote },
    { href: archiveHref, label: t.archive.title, note: t.archive.menuNote },
    { href: baseHref, label: t.base.title, note: t.base.menuNote(buildings) },
    { onClick: () => setFeedback(true), label: t.feedbackForm.title, note: t.feedbackForm.menuNote },
  ];

  // Game-style menu: ↑ / ↓ move the selection, Enter starts the selected item when nothing else has focus.
  useEffect(() => {
    if (howTo || feedback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const items = itemRefs.current;
      const active = document.activeElement;
      const focused = items.findIndex(item => item === active);
      const free = !active || active === document.body;
      if (focused < 0 && !free) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const from = focused < 0 ? selected : focused;
        const next = (from + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        setSelected(next);
        items[next]?.focus();
      } else if (e.key === 'Enter' && free) {
        e.preventDefault();
        items[selected]?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [howTo, feedback, selected]);

  const { chapter } = summary;
  // "Design the Arki" → white "Design the ", glowing "Arki" (like "Defend the" + "Arki").
  const split = t.levelSelect.title.lastIndexOf(' ') + 1;
  const logoA = t.levelSelect.title.slice(0, split), logoB = t.levelSelect.title.slice(split);
  const passed = levels.filter(lv => (progress.levels[lv.id]?.bestStars ?? 0) > 0).length;
  const chapterName = t.levelSelect.chapter(chapter.number, chapter.name);
  return (
    <div className="title">
      <TitleBackground />
      <div className="title-screen">
        <header className="title-bar">
          <span className="title-pill" role="img" aria-label={t.levelSelect.totalStars(summary.stars, summary.maxStars)}>
            <span className="home-star">★</span> {summary.stars} / {summary.maxStars}
          </span>
          <span className="title-chapter" role="img" aria-label={l.chapterProgress(chapterName, chapter.passed, chapter.levels)}>
            <span className="title-chapter-name">{chapterName}</span>
            <span className="title-chapter-bar"><span style={{ width: `${(chapter.passed / Math.max(1, chapter.levels)) * 100}%` }} /></span>
            <b>{chapter.passed}/{chapter.levels}</b>
          </span>
        </header>

        <main className="title-main">
          <div className="title-head">
            <p className="eyebrow">{l.eyebrow}</p>
            <h1>
              <span className="title-logo"><span className="logo-a">{logoA.trimEnd()}</span>{' '}<span className="logo-b">{logoB}</span></span>
              <span className="title-tagline">{l.headline} <span>{l.headlineAccent}</span></span>
            </h1>
            <p className="title-pitch">{l.pitch}</p>
          </div>

          <div className="title-panels">
            <nav className="title-menu title-panel" aria-label={l.menu}>
              <span className="eyebrow" aria-hidden="true">{l.menu}</span>
              <ul>
                {menu.map((item, i) => {
                  const content = <>
                    <span className="menu-marker" aria-hidden="true">▶</span>
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-note">{item.note}</span>
                  </>;
                  const common = {
                    className: `menu-item${i === 0 ? ' primary' : ''}`,
                    'data-selected': i === selected,
                    onMouseEnter: () => setSelected(i),
                    onFocus: () => setSelected(i),
                  };
                  return (
                    <li key={item.label}>
                      {'href' in item
                        ? <a {...common} ref={el => { itemRefs.current[i] = el; }} href={item.href}>{content}</a>
                        : <button {...common} ref={el => { itemRefs.current[i] = el; }} onClick={item.onClick} aria-haspopup="dialog">{content}</button>}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <Demo />
          </div>

          <p className="title-hint" aria-hidden="true">{l.pressEnter}<small>{l.pressEnterNote}</small></p>
        </main>

        <footer className="title-foot">
          <span className="title-best">🏆 {l.levelsPassed(passed)}</span>
          <span className="title-foot-right">
            <span>{l.freeNote}</span>
            <span className="title-badge">{l.earlyAccess}</span>
            <span className="lang-switch" role="group" aria-label={t.footer.language}>
              {LANGS.map(code => (
                <button key={code} type="button" aria-pressed={lang() === code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>
              ))}
            </span>
            <span className="title-links">
              <a href={`${REPO_URL}/releases/tag/v${__APP_VERSION__}`} target="_blank" rel="noopener noreferrer" aria-label={t.footer.release(__APP_VERSION__)}>v{__APP_VERSION__}</a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{t.footer.github} ↗</a>
              <span>{t.footer.copyright}</span>
            </span>
          </span>
        </footer>
      </div>
      {howTo && <HowToPlay onClose={closeHowTo} />}
      {feedback && <FeedbackDialog info={{ level: 'none' }} onClose={closeFeedback} />}
    </div>
  );
}
