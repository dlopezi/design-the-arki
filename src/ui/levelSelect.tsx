import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import { MODES } from '../levels/modes';
import { isUnlocked, type Progress } from '../progress/progress';
import { Stars } from './reportCard';
import { FeedbackButton } from './feedbackDialog';
import { archiveHref, baseHref } from './routes';
import { Building, buildingName } from './componentArt';
import { newTypesIn } from '../archive/archive';

type Props = { levels: LevelDefinition[]; progress: Progress; notice: string | null; storageWorks: boolean; onReset: () => void };

// The campaign map: each chapter is a sector of terrain, its missions are points joined by a route.
// Positions are in the map's own units (MAP.w × MAP.h); the markers are placed in percent, so the map scales.
const MAP = { w: 760, h: 520 };
const SPOTS = [[90, 300], [220, 200], [370, 250], [500, 140], [650, 210], [600, 360], [440, 420], [280, 440]] as const;
const spot = (i: number) => {
  const [x, y] = SPOTS[i % SPOTS.length]!;
  return { x, y: y + Math.floor(i / SPOTS.length) * 40 };
};
const GRID = Array.from({ length: 16 }, (_, i) => i);

function ConfirmReset({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="report" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <h2 id={titleId}>{t.levelSelect.resetTitle}</h2>
        <p className="muted">{t.levelSelect.resetBody}</p>
        <div className="actions">
          <button ref={cancelRef} className="secondary" onClick={onCancel}>{t.levelSelect.cancel}</button>
          <button className="danger" onClick={onConfirm}>{t.levelSelect.reset}</button>
        </div>
      </div>
    </div>
  );
}

type LevelState = 'done' | 'current' | 'open' | 'locked';

/** The selected mission: its briefing, objectives, buildings and the mode buttons that start it. */
function Briefing({ level, number, state, newTypes, progress }: { level: LevelDefinition; number: number; state: LevelState; newTypes: string[]; progress: Progress }) {
  const l = t.levelSelect;
  const saved = progress.levels[level.id];
  const tutorialDone = !!progress.tutorialDone;
  return (
    <aside className="campaign-briefing panel" aria-label={l.briefing} aria-live="polite">
      <span className="console-label">{l.missionState(number, l.states[state])}</span>
      <h2>{level.title}</h2>
      <p className="muted">{level.brief}</p>
      {state !== 'locked' && (
        <div className="campaign-score">
          <Stars earned={saved?.bestStars ?? 0} max={1 + level.starCostThresholds.length} />
          {saved?.bestMode && <span className={`badge mode ${saved.bestMode}`} aria-label={t.modes.badge(t.modes[saved.bestMode].name)}>{t.modes[saved.bestMode].name}</span>}
        </div>
      )}
      <span className="console-label">{t.objectives}</span>
      <ul className="campaign-objectives">
        <li>{t.objectiveP95(level.requirements.p95Ms)}</li>
        <li>{t.objectiveErrors(level.requirements.maxErrorRate)}</li>
        <li>{t.objectiveCost(level.budget)}</li>
      </ul>
      {newTypes.map(type => (
        <div key={type} className="campaign-new">
          <Building type={type} size={44} down={state === 'locked'} />
          <span><strong>{l.newBuilding}</strong> {buildingName(type)} ({t.componentTypes[type] ?? type})</span>
        </div>
      ))}
      <span className="console-label">{l.buildings}</span>
      <div className="campaign-buildings">
        {level.allowedComponents.map(type => <span key={type} title={buildingName(type)}><Building type={type} size={40} down={state === 'locked'} /></span>)}
      </div>
      {state === 'locked' ? <p className="muted">🔒 {l.lockedHint}</p> : <>
        <span className="console-label">{t.modes.choose}</span>
        <ul className="campaign-modes" aria-label={t.modes.listLabel}>
          {MODES.map(mode => (
            <li key={mode}>
              {tutorialDone || mode === 'guided'
                ? <a href={`#${level.id}/${mode}`} className={saved?.bestMode === mode ? 'best' : ''}><strong>{t.modes[mode].name}</strong><span>{t.modes[mode].description}</span></a>
                : <div className="locked-mode"><strong>{t.modes[mode].name}</strong><span>{t.tutorial.lockedMode}</span></div>}
            </li>
          ))}
        </ul>
      </>}
    </aside>
  );
}

/** The level map as a strategy-game campaign: sectors (chapters) with missions on a route, and the selected mission's briefing. */
export function LevelSelect({ levels, progress, notice, storageWorks, onReset }: Props) {
  const [confirming, setConfirming] = useState(false);
  const ids = levels.map(l => l.id);
  const chapters = [...new Set(levels.map(l => l.chapter))];
  const starsOf = (id: string) => progress.levels[id]?.bestStars ?? 0;
  const maxStarsOf = (l: LevelDefinition) => 1 + l.starCostThresholds.length;
  const totalStars = levels.reduce((sum, l) => sum + starsOf(l.id), 0);
  const maxStars = levels.reduce((sum, l) => sum + maxStarsOf(l), 0);
  // The next level to play: the first unlocked one not passed yet.
  const currentId = levels.find(l => isUnlocked(ids, l.id, progress) && starsOf(l.id) === 0)?.id ?? null;
  const stateOf = (level: LevelDefinition): LevelState =>
    !isUnlocked(ids, level.id, progress) ? 'locked' : level.id === currentId ? 'current' : starsOf(level.id) > 0 ? 'done' : 'open';
  const [selectedId, setSelectedId] = useState(currentId ?? ids[ids.length - 1] ?? '');
  const selected = levels.find(l => l.id === selectedId) ?? levels[0]!;
  const selectedIndex = ids.indexOf(selected.id);

  return (
    <main className="campaign">
      <header className="home-topbar">
        <a className="home-back" href="#">← {t.levelSelect.home}</a>
        <h1 className="home-brand">{t.levelSelect.campaign}</h1>
        <nav className="home-links" aria-label={t.levelSelect.more}>
          <a href={baseHref}>{t.base.title}</a>
          <a href={archiveHref}>{t.archive.title}</a>
        </nav>
        <span className="home-pill" role="img" aria-label={t.levelSelect.totalStars(totalStars, maxStars)}><span className="home-star">★</span> {totalStars} / {maxStars}</span>
      </header>
      {notice && <p role="status" className="notice">{notice}</p>}
      {!storageWorks && <p className="notice">{t.levelSelect.noStorage}</p>}

      <div className="campaign-grid">
        <div className="campaign-sectors">
          {chapters.map((chapter, c) => {
            const inChapter = levels.filter(l => l.chapter === chapter);
            const chapterStars = inChapter.reduce((s, l) => s + starsOf(l.id), 0);
            const chapterMax = inChapter.reduce((s, l) => s + maxStarsOf(l), 0);
            const current = inChapter.find(l => l.id === currentId);
            const points = inChapter.map((_, i) => spot(i));
            const height = Math.max(MAP.h, ...points.map(p => p.y + 80));
            const reached = inChapter.filter(l => stateOf(l) !== 'locked').length;
            return (
              <section key={chapter} className="campaign-sector panel" aria-labelledby={`chapter-${c}`}>
                <div className="campaign-head">
                  <h2 id={`chapter-${c}`} className="home-eyebrow">{t.levelSelect.chapter(c + 1, chapter)}</h2>
                  <strong>{current ? t.levelSelect.nextUp(ids.indexOf(current.id) + 1, current.title) : t.levelSelect.chapterComplete}</strong>
                  <div className="home-progress" role="img" aria-label={t.levelSelect.chapterStars(chapterStars, chapterMax)}>
                    <span style={{ width: `${(chapterStars / chapterMax) * 100}%` }} />
                  </div>
                </div>
                <div className="campaign-map" style={{ aspectRatio: `${MAP.w} / ${height}` }}>
                  <svg viewBox={`0 0 ${MAP.w} ${height}`} aria-hidden="true" className="campaign-terrain">
                    <rect width={MAP.w} height={height} className="terrain" />
                    {GRID.map(i => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={height} className="terrain-grid" />)}
                    {GRID.map(i => <line key={`h${i}`} x1={0} y1={i * 40} x2={MAP.w} y2={i * 40} className="terrain-grid" />)}
                    {points.slice(1).map((p, i) => (
                      <line key={i} x1={points[i]!.x} y1={points[i]!.y} x2={p.x} y2={p.y} className={`route ${i + 1 < reached ? 'done' : ''}`} />
                    ))}
                  </svg>
                  <ol>
                    {inChapter.map((level, i) => {
                      const number = ids.indexOf(level.id) + 1;
                      const state = stateOf(level);
                      const bestMode = progress.levels[level.id]?.bestMode;
                      const teaches = newTypesIn(levels, level.id)[0];
                      const { x, y } = points[i]!;
                      return (
                        <li key={level.id} className={`campaign-node ${state} ${bestMode ? `mode-${bestMode}` : ''} ${level.id === selected.id ? 'selected' : ''}`}
                          style={{ left: `${(x / MAP.w) * 100}%`, top: `${(y / height) * 100}%` }}>
                          <button className="campaign-marker" aria-pressed={level.id === selected.id} onClick={() => setSelectedId(level.id)}
                            aria-label={state === 'locked' ? t.levelSelect.lockedMission(level.title) : `${t.levelSelect.play} ${level.title}`}>
                            {teaches ? <Building type={teaches} size={46} down={state === 'locked'} /> : <span className="campaign-number">{state === 'locked' ? '🔒' : number}</span>}
                          </button>
                          {state === 'current' && <span className="home-bubble" aria-hidden="true">{t.levelSelect.playBubble}</span>}
                          <h3>{number}. {level.title}</h3>
                          {state !== 'locked'
                            ? <span className="home-meta">
                                <Stars earned={starsOf(level.id)} max={maxStarsOf(level)} />
                                {bestMode && <span className={`badge mode ${bestMode}`} aria-label={t.modes.badge(t.modes[bestMode].name)}>{t.modes[bestMode].name}</span>}
                              </span>
                            : <span className="visually-hidden">{t.levelSelect.locked}</span>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <ul className="home-legend" aria-label={t.levelSelect.legend}>
                  {MODES.map(mode => <li key={mode}><span className={`home-dot mode-${mode}`} aria-hidden="true" />{t.modes[mode].name}</li>)}
                </ul>
              </section>
            );
          })}
          <p className="campaign-soon">{t.levelSelect.moreSectors}</p>
        </div>
        <Briefing level={selected} number={selectedIndex + 1} state={stateOf(selected)} newTypes={newTypesIn(levels, selected.id)} progress={progress} />
      </div>

      <footer className="home-footer">
        <FeedbackButton className="secondary" info={() => ({ level: 'none' })} />
        <button className="link-button" onClick={() => setConfirming(true)}>{t.levelSelect.resetProgress}</button>
      </footer>
      {confirming && <ConfirmReset onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onReset(); }} />}
    </main>
  );
}
