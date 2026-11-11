import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { archiveEntries } from '../archive/archive';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import { MODES } from '../levels/modes';
import type { Progress } from '../progress/progress';
import { artStyle, Building, buildingName } from './componentArt';
import { catalog } from '../catalog/catalog';
import { levelsHref, MANUAL_TABS, manualHref, type ManualTab } from './routes';

type Props = {
  levels: LevelDefinition[];
  progress: Progress;
  tab?: ManualTab;
  /** Before level 1: a briefing with a button that starts it. */
  briefing?: boolean;
  /** Opened over the game: shown as a dialog with a Close button instead of a page. */
  onClose?: () => void;
};

/** A small looping picture for each step of "How to play". */
function Scene({ step }: { step: number }) {
  if (step === 0) return (
    <div className="scene scene-build" aria-hidden="true">
      <span className="scene-card"><Building type="appServer" size={30} /><b>$40</b></span>
      <span className="scene-arrow">→</span>
      <span className="scene-rise"><Building type="appServer" size={52} /><i className="scene-bar"><i /></i></span>
    </div>
  );
  if (step === 1) return (
    <div className="scene scene-connect" aria-hidden="true">
      <Building type="appServer" size={46} />
      <span className="scene-line"><i /></span>
      <Building type="database" size={46} />
    </div>
  );
  if (step === 2) return (
    <div className="scene scene-users" aria-hidden="true">
      <span className="scene-globe">🌐</span>
      <span className="scene-flow">{[0, 1, 2, 3].map(k => <i key={k} style={{ animationDelay: `${k * 0.35}s` }} />)}</span>
      <Building type="loadBalancer" size={50} />
    </div>
  );
  return (
    <div className="scene scene-results" aria-hidden="true">
      <svg viewBox="0 0 120 40"><line x1="0" x2="120" y1="12" y2="12" className="limit" /><polyline points="0,34 20,30 40,26 60,28 80,20 100,22 120,18" /></svg>
      <span className="scene-stars"><i>★</i><i>★</i><i>★</i></span>
    </div>
  );
}

function HowTo() {
  const m = t.manual;
  return (
    <div className="manual-howto">
      <p className="manual-goal"><b>{m.goal}</b> {m.goalText}</p>
      <ol className="manual-steps">
        {m.steps.map((s, i) => (
          <li key={s.title} className="panel">
            <span className="step-n">{i + 1}</span>
            <strong>{s.title}</strong>
            <Scene step={i} />
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="manual-row">
        <section className="panel manual-box">
          <span className="console-label">{m.modes}</span>
          <dl className="manual-modes">
            {MODES.map(mode => <div key={mode}><dt className={`badge mode ${mode}`}>{t.modes[mode].name}</dt><dd>{t.modes[mode].description}</dd></div>)}
          </dl>
        </section>
        <section className="panel manual-box">
          <span className="console-label">{m.stars}</span>
          <p>{m.starsText}</p>
          <span className="console-label">{m.keys}</span>
          <ul className="manual-keys">{m.keyList.map(([k, v]) => <li key={k}><kbd>{k}</kbd> {v}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}

function Buildings({ levels, progress, briefing }: { levels: LevelDefinition[]; progress: Progress; briefing: boolean }) {
  const a = t.archive, m = t.manual;
  const entries = useMemo(() => archiveEntries(levels, progress), [levels, progress]);
  // In the briefing every building is open to read: they are what the player is about to meet.
  const isOpen = (unlocked: boolean) => briefing || unlocked;
  const [selected, setSelected] = useState(entries[0]?.type ?? '');
  const entry = entries.find(e => e.type === selected) ?? entries[0];
  if (!entry) return null;
  const text = a.buildings[entry.type];
  const open = isOpen(entry.unlocked);
  return (
    <>
      <p className="archive-pick">👉 {a.pick}</p>
      <div className="archive-body">
        <ul className="archive-list panel" aria-label={a.list}>
          {entries.map(e => (
            <li key={e.type}>
              <button aria-current={e.type === entry.type} className={isOpen(e.unlocked) ? '' : 'locked'} onClick={() => setSelected(e.type)}>
                <Building type={e.type} size={44} down={!isOpen(e.unlocked)} />
                <span className="name">
                  {buildingName(e.type)}
                  <small>{catalog[e.type]?.presentation?.technology}{isOpen(e.unlocked) ? '' : ` · ${a.locked}`}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <section className={`archive-detail panel ${open ? '' : 'is-locked'}`} style={artStyle(entry.type)} aria-labelledby="archive-name" aria-live="polite">
          <div className="archive-art"><Building type={entry.type} size={180} down={!open} /></div>
          <div>
            <h2 id="archive-name">{buildingName(entry.type)}</h2>
            <span className="kind">{catalog[entry.type]?.presentation?.technology} · {t.zones[catalog[entry.type]?.presentation?.zone ?? 'application']}</span>
          </div>
          {open && text ? (
            <dl>
              <div><dt>{a.role}</dt><dd>{text.role}</dd></div>
              <div><dt>{a.when}</dt><dd>{text.when}</dd></div>
            </dl>
          ) : <p className="muted">{a.lockedText(entry.level.number)}</p>}
          <div className="archive-facts">
            <span className="cost">{a.cost(entry.monthlyCost)}</span>
            <span>{a.unlockedIn} {a.unlocksAt(entry.level.number, entry.level.title)}</span>
          </div>
          {open && text && (
            <div className="archive-real">
              <span className="console-label">{m.realLife}</span>
              <dl>
                <div><dt>{m.tools}</dt><dd>{text.tools.join(' · ')}</dd></div>
                <div><dt>{m.same}</dt><dd>{text.same}</dd></div>
                <div><dt>{m.diff}</dt><dd>{text.diff}</dd></div>
              </dl>
              <a href={text.read.url} target="_blank" rel="noopener noreferrer">{m.read}: {text.read.label} ↗</a>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Concepts() {
  const m = t.manual;
  return (
    <>
      <p className="muted">{m.conceptsIntro}</p>
      <ul className="manual-concepts">
        {m.concepts.map(c => (
          <li key={c.id} id={`concept-${c.id}`} className="panel">
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <p className="in-game"><b>{m.inGame}</b> {c.game}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The Field Manual: how to play, every building (what it is in the game and in real life) and the concepts.
 * A page from the title screen and the campaign, a dialog over the game, and the briefing before level 1.
 */
export function Manual({ levels, progress, tab: initialTab, briefing = false, onClose }: Props) {
  const m = t.manual, a = t.archive;
  const [tab, setTab] = useState<ManualTab>(initialTab ?? (briefing ? 'buildings' : 'howto'));
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTab(initialTab ?? (briefing ? 'buildings' : 'howto')); }, [initialTab, briefing]);
  useEffect(() => {
    if (!onClose) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const choose = (next: ManualTab) => {
    setTab(next);
    // On the page the address follows the tab, so a section can be linked and reloaded.
    if (!onClose && !briefing) history.replaceState(null, '', manualHref(next));
  };
  const firstLevel = levels[0];

  const body = (
    <>
      <header className="page-head">
        <span className="console-label">{briefing ? a.briefingEyebrow : m.title}</span>
        <h1 id={titleId}>{briefing ? a.briefingTitle : m.title}</h1>
        <p>{briefing ? a.briefingIntro : m.intro}</p>
      </header>
      <div className="manual-tabs" role="tablist" aria-label={m.tabsLabel}>
        {MANUAL_TABS.map(k => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => choose(k)}>{m.tabs[k]}</button>
        ))}
      </div>
      <div role="tabpanel" aria-label={m.tabs[tab]}>
        {tab === 'howto' ? <HowTo /> : tab === 'buildings' ? <Buildings levels={levels} progress={progress} briefing={briefing} /> : <Concepts />}
      </div>
    </>
  );

  if (onClose) {
    return (
      <div className="backdrop manual-backdrop" onClick={onClose}>
        <div className="manual manual-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
          <button ref={closeRef} className="btn manual-close" onClick={onClose}>✕ {m.close}</button>
          {body}
        </div>
      </div>
    );
  }
  return (
    <main className="manual">
      <nav className="page-bar">
        <a href="#">← {t.levelSelect.home}</a>
        {!briefing && <a href={levelsHref}>{t.levelSelect.campaign} →</a>}
      </nav>
      {body}
      {briefing && firstLevel && (
        <div className="archive-actions">
          <a className="primary-link" href={`#${firstLevel.id}/guided`}>{a.start} ▶</a>
        </div>
      )}
    </main>
  );
}
