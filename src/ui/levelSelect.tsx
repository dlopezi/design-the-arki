import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import { isUnlocked, playMode, type Progress } from '../progress/progress';
import { Stars } from './stars';
import { FeedbackButton } from './feedbackDialog';
import { manualHref, modeHref, optionsHref, playHref } from './routes';
import { Building, buildingName } from './componentArt';
import { newTypesIn } from '../archive/archive';
import { blip } from './sound';

type Props = { levels: LevelDefinition[]; progress: Progress; notice: string | null; storageWorks: boolean };

// The campaign map: each chapter is a sector of terrain, its missions are points joined by a route.
// Positions are in the map's own units (MAP.w × MAP.h); the markers are placed in percent, so the map scales.
const MAP = { w: 760, h: 500 };
const SPOTS = [[90, 290], [220, 190], [370, 240], [500, 130], [650, 200], [600, 350], [440, 410], [280, 430]] as const;
const spot = (i: number) => {
  const [x, y] = SPOTS[i % SPOTS.length]!;
  return { x, y: y + Math.floor(i / SPOTS.length) * 40 };
};
const GRID = Array.from({ length: 16 }, (_, i) => i);

// How many missions were open the last time the map was shown, to celebrate a new one once.
const SEEN_KEY = 'design-the-arki:seen-open';
const readSeen = () => { try { const n = Number(localStorage.getItem(SEEN_KEY)); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; } };
const writeSeen = (n: number) => { try { localStorage.setItem(SEEN_KEY, String(n)); } catch { /* only the animation repeats */ } };

type LevelState = 'done' | 'current' | 'open' | 'locked';

/** The selected mission: its briefing, objectives, star rule, buildings and one button that starts it. */
function Briefing({ level, number, state, newTypes, progress }: { level: LevelDefinition; number: number; state: LevelState; newTypes: string[]; progress: Progress }) {
  const l = t.levelSelect;
  const saved = progress.levels[level.id];
  const mode = playMode(progress);
  const [two, three] = level.play.starMoney;
  return (
    <aside className="campaign-briefing panel" aria-label={l.briefing} aria-live="polite">
      <span className="console-label">{l.missionState(number, l.states[state])}</span>
      <h2>{level.title}</h2>
      <p className="muted">{level.brief}</p>
      <span className="console-label">{t.objectives}</span>
      <ul className="campaign-objectives">
        <li><span aria-hidden="true">⏱</span> {t.objectiveP95(level.requirements.p95Ms)} <a className="campaign-why" href={`${manualHref('concepts')}`} title={l.p95Tip}>{l.whatIsP95}</a></li>
        <li><span aria-hidden="true">⚠</span> {t.objectiveErrors(level.requirements.maxErrorRate)}</li>
        {level.requirements.maxQueueAgeS !== undefined && <li><span aria-hidden="true">⏳</span> {t.objectiveQueueAge(level.requirements.maxQueueAgeS)}</li>}
        <li><span aria-hidden="true">👥</span> {t.rt.waveShort(level.play.wave.rps, level.play.wave.lengthS)}{level.play.wave.mix ? ` · ${t.rt.mixShort(level.play.wave.mix)}` : ''}</li>
      </ul>
      {state !== 'locked' && (
        <div className="campaign-stars">
          <span className="console-label">{l.starRule}</span>
          <ul aria-label={l.starRule}>
            <li className={(saved?.bestStars ?? 0) >= 1 ? 'got' : ''}><b>★</b> {l.starPass}</li>
            {two !== undefined && <li className={(saved?.bestStars ?? 0) >= 2 ? 'got' : ''}><b>★★</b> {l.starMoney(two)}</li>}
            {three !== undefined && <li className={(saved?.bestStars ?? 0) >= 3 ? 'got' : ''}><b>★★★</b> {l.starMoney(three)}</li>}
          </ul>
          {saved?.bestMode && <span className={`badge mode ${saved.bestMode}`} aria-label={t.modes.badge(t.modes[saved.bestMode].name)}>{t.modes[saved.bestMode].name}</span>}
        </div>
      )}
      {newTypes.map(type => (
        <div key={type} className="campaign-new">
          <Building type={type} size={40} down={state === 'locked'} />
          <span><strong>{l.newBuilding}</strong> {buildingName(type)}</span>
        </div>
      ))}
      <div className="campaign-buildings" aria-label={l.buildings} role="img">
        {level.allowedComponents.map(type => <span key={type} title={buildingName(type)}><Building type={type} size={34} down={state === 'locked'} /></span>)}
      </div>
      {state === 'locked'
        ? <p className="muted">🔒 {l.lockedHint}</p>
        : <div className="campaign-go">
            <a className="primary-link campaign-play" href={playHref(level.id, progress)} onClick={() => blip('play')}>▶ {l.playMission}</a>
            <span className="muted">{t.modes.current(mode ? t.modes[mode].name : t.modes.notChosen)} · <a href={modeHref()}>{t.modes.change}</a></span>
          </div>}
    </aside>
  );
}

/** The level map as a strategy-game campaign: sectors (chapters) with missions on a route, and the selected mission's briefing. */
export function LevelSelect({ levels, progress, notice, storageWorks }: Props) {
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
  const mode = playMode(progress);
  const openCount = levels.filter(l => isUnlocked(ids, l.id, progress)).length;
  // A mission opened since the last visit gets a short "new" animation, once.
  const [fresh] = useState(() => { const seen = readSeen(); return seen !== null && openCount > seen ? openCount - 1 : -1; });
  useEffect(() => { writeSeen(openCount); }, [openCount]);
  const markers = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const level = levels[index];
    if (!level) return;
    setSelectedId(level.id);
    blip('select');
    markers.current[index]?.focus();
  };
  const play = (level: LevelDefinition) => { blip('play'); location.hash = playHref(level.id, progress).slice(1); };
  // Game-style map: arrow keys move between missions, Enter plays the selected one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      const free = !active || active === document.body || active.classList.contains('campaign-marker');
      if (!free || document.querySelector('[role="dialog"]')) return;
      const index = ids.indexOf(selectedId);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(Math.min(levels.length - 1, index + 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(Math.max(0, index - 1)); }
      else if (e.key === 'Enter' && (!active || active === document.body) && stateOf(selected) !== 'locked') { e.preventDefault(); play(selected); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="campaign">
      <header className="home-topbar">
        <a className="home-back" href="#">← {t.levelSelect.home}</a>
        <h1 className="home-brand">{t.levelSelect.campaign}</h1>
        <nav className="home-links" aria-label={t.levelSelect.more}>
          <a href={modeHref()} className="home-mode">{t.modes.pill(mode ? t.modes[mode].name : t.modes.notChosen)} ▾</a>
          <a href={manualHref()}>{t.manual.title}</a>
        </nav>
        <span className="home-pill" role="img" aria-label={t.levelSelect.totalStars(totalStars, maxStars)}><span className="home-star">★</span> {totalStars} / {maxStars}</span>
        <span className="campaign-tools">
          <FeedbackButton className="link-button" info={() => ({ level: 'none' })} />
          <a className="home-gear" href={optionsHref} aria-label={t.levelSelect.options} title={t.levelSelect.options}>⚙</a>
        </span>
      </header>
      {notice && <p role="status" className="notice">{notice}</p>}
      {!storageWorks && <p className="notice">{t.levelSelect.noStorage}</p>}

      <div className="campaign-grid">
        <div className="campaign-sectors">
          {chapters.map((chapter, c) => {
            const inChapter = levels.filter(l => l.chapter === chapter);
            const chapterStars = inChapter.reduce((s, l) => s + starsOf(l.id), 0);
            const chapterMax = inChapter.reduce((s, l) => s + maxStarsOf(l), 0);
            const points = inChapter.map((_, i) => spot(i));
            const height = Math.max(MAP.h, ...points.map(p => p.y + 80));
            const reached = inChapter.filter(l => stateOf(l) !== 'locked').length;
            return (
              <section key={chapter} className="campaign-sector panel" aria-labelledby={`chapter-${c}`}>
                <div className="campaign-head">
                  <h2 id={`chapter-${c}`} className="home-eyebrow">{t.levelSelect.chapter(c + 1, chapter)}</h2>
                  <div className="home-progress" role="img" aria-label={t.levelSelect.chapterStars(chapterStars, chapterMax)}>
                    <span style={{ width: `${(chapterStars / chapterMax) * 100}%` }} />
                  </div>
                  <span className="campaign-stars-count">★ {chapterStars}/{chapterMax}</span>
                </div>
                <div className="campaign-map" style={{ aspectRatio: `${MAP.w} / ${height}` }}>
                  <svg viewBox={`0 0 ${MAP.w} ${height}`} aria-hidden="true" className="campaign-terrain">
                    <rect width={MAP.w} height={height} className="terrain" />
                    {GRID.map(i => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={height} className="terrain-grid" />)}
                    {GRID.map(i => <line key={`h${i}`} x1={0} y1={i * 40} x2={MAP.w} y2={i * 40} className="terrain-grid" />)}
                    {points.slice(1).map((p, i) => {
                      const index = ids.indexOf(inChapter[i + 1]!.id);
                      return <line key={i} x1={points[i]!.x} y1={points[i]!.y} x2={p.x} y2={p.y} pathLength={1}
                        className={`route ${i + 1 < reached ? 'done' : ''} ${index === fresh ? 'fresh' : ''}`} />;
                    })}
                  </svg>
                  <ol>
                    {inChapter.map((level, i) => {
                      const index = ids.indexOf(level.id);
                      const number = index + 1;
                      const state = stateOf(level);
                      const bestMode = progress.levels[level.id]?.bestMode;
                      const teaches = newTypesIn(levels, level.id)[0];
                      const isSelected = level.id === selected.id;
                      const { x, y } = points[i]!;
                      return (
                        <li key={level.id} className={`campaign-node ${state} ${bestMode ? `mode-${bestMode}` : ''} ${isSelected ? 'selected' : ''} ${index === fresh ? 'fresh' : ''}`}
                          style={{ left: `${(x / MAP.w) * 100}%`, top: `${(y / height) * 100}%` }} title={state === 'locked' ? t.levelSelect.lockedTip(number - 1) : undefined}>
                          <button ref={el => { markers.current[index] = el; }} className="campaign-marker" aria-pressed={isSelected}
                            onMouseEnter={() => blip('hover')}
                            onClick={() => {
                              if (isSelected && state !== 'locked') return play(level);
                              select(index);
                              // On a phone the briefing is below the list: bring it into view.
                              if (matchMedia('(max-width: 640px)').matches) document.querySelector('.campaign-briefing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            aria-label={state === 'locked' ? t.levelSelect.lockedMission(level.title) : isSelected ? t.levelSelect.playLevel(level.title) : t.levelSelect.showMission(level.title)}>
                            {teaches ? <Building type={teaches} size={46} down={state === 'locked'} /> : <span className="campaign-number">{state === 'locked' ? '🔒' : number}</span>}
                          </button>
                          {index === fresh && <span className="home-bubble fresh-bubble" aria-hidden="true">{t.levelSelect.newlyOpen}</span>}
                          {index !== fresh && state === 'current' && (
                            <a className="home-bubble" href={playHref(level.id, progress)} onClick={() => blip('play')} tabIndex={-1} aria-hidden="true">{t.levelSelect.playBubble}</a>
                          )}
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
                <p className="campaign-help">{t.levelSelect.mapHelp}</p>
              </section>
            );
          })}
        </div>
        <Briefing level={selected} number={selectedIndex + 1} state={stateOf(selected)} newTypes={newTypesIn(levels, selected.id)} progress={progress} />
      </div>
    </main>
  );
}
