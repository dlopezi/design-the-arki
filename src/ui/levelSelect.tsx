import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import { MODES } from '../levels/modes';
import { isUnlocked, type Progress } from '../progress/progress';
import { Stars } from './reportCard';
import { FeedbackButton } from './feedbackDialog';

type Props = { levels: LevelDefinition[]; progress: Progress; notice: string | null; storageWorks: boolean; onReset: () => void };

// The map: levels sit on a winding road, one step down per level.
const MAP_WIDTH = 360;
const STEP_Y = 172;
const TOP = 70;
const OFFSETS = [0, 70, 105, 70, 0, -70, -105, -70];
const nodeX = (i: number) => MAP_WIDTH / 2 + OFFSETS[i % OFFSETS.length]!;
const nodeY = (i: number) => TOP + i * STEP_Y;
const road = (count: number) => `M${nodeX(0)},${nodeY(0)} ` + Array.from({ length: Math.max(0, count - 1) }, (_, k) => {
  const i = k + 1;
  return `C${nodeX(i - 1)},${nodeY(i - 1) + STEP_Y / 2} ${nodeX(i)},${nodeY(i) - STEP_Y / 2} ${nodeX(i)},${nodeY(i)}`;
}).join(' ');

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

/** The home screen: each chapter is a winding road of level buttons, coloured by the hardest mode passed. */
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

  return (
    <main className="home">
      <header className="home-topbar">
        <h1 className="home-brand">{t.levelSelect.title}</h1>
        <span className="home-pill" role="img" aria-label={t.levelSelect.totalStars(totalStars, maxStars)}><span className="home-star">★</span> {totalStars} / {maxStars}</span>
      </header>
      {notice && <p role="status" className="notice">{notice}</p>}
      {!storageWorks && <p className="notice">{t.levelSelect.noStorage}</p>}

      {chapters.map((chapter, c) => {
        const inChapter = levels.filter(l => l.chapter === chapter);
        const chapterStars = inChapter.reduce((s, l) => s + starsOf(l.id), 0);
        const chapterMax = inChapter.reduce((s, l) => s + maxStarsOf(l), 0);
        const current = inChapter.find(l => l.id === currentId);
        const passedCount = inChapter.findIndex(l => starsOf(l.id) === 0);
        const doneUpTo = passedCount < 0 ? inChapter.length - 1 : passedCount;
        const height = nodeY(inChapter.length - 1) + 110;
        return (
          <section key={chapter} className="home-chapter" aria-labelledby={`chapter-${c}`}>
            <div className="home-banner">
              <h2 id={`chapter-${c}`} className="home-eyebrow">{t.levelSelect.chapter(c + 1, chapter)}</h2>
              <strong>{current ? t.levelSelect.nextUp(ids.indexOf(current.id) + 1, current.title) : t.levelSelect.chapterComplete}</strong>
              <div className="home-progress" role="img" aria-label={t.levelSelect.chapterStars(chapterStars, chapterMax)}>
                <span style={{ width: `${(chapterStars / chapterMax) * 100}%` }} />
              </div>
            </div>

            <ul className="home-legend" aria-label={t.levelSelect.legend}>
              {MODES.map(mode => <li key={mode}><span className={`home-dot mode-${mode}`} aria-hidden="true" />{t.modes[mode].name}</li>)}
            </ul>

            <div className="home-map" style={{ width: MAP_WIDTH, height }}>
              <svg width={MAP_WIDTH} height={height} className="home-road" aria-hidden="true">
                <path d={road(inChapter.length)} className="road-base" />
                {doneUpTo > 0 && <path d={road(doneUpTo + 1)} className="road-done" />}
              </svg>
              <ol>
                {inChapter.map((level, i) => {
                  const number = ids.indexOf(level.id) + 1;
                  const unlocked = isUnlocked(ids, level.id, progress);
                  const stars = starsOf(level.id);
                  const bestMode = progress.levels[level.id]?.bestMode;
                  const state = !unlocked ? 'locked' : level.id === currentId ? 'current' : stars > 0 ? 'done' : 'open';
                  return (
                    <li key={level.id} className={`home-node ${state} ${bestMode ? `mode-${bestMode}` : ''}`} style={{ left: nodeX(i), top: nodeY(i) }}>
                      {state === 'current' && <span className="home-bubble" aria-hidden="true">{t.levelSelect.playBubble}</span>}
                      {unlocked
                        ? <a className="home-coin" href={`#${level.id}`} aria-label={`${t.levelSelect.play} ${level.title}`}>{stars > 0 ? '✓' : number}</a>
                        : <span className="home-coin" aria-hidden="true">🔒</span>}
                      <h3>{level.title}</h3>
                      {unlocked
                        ? <span className="home-meta">
                            <Stars earned={stars} max={maxStarsOf(level)} />
                            {bestMode && <span className={`badge mode ${bestMode}`} aria-label={t.modes.badge(t.modes[bestMode].name)}>{t.modes[bestMode].name}</span>}
                          </span>
                        : <span className="visually-hidden">{t.levelSelect.locked}</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        );
      })}

      <footer className="home-footer">
        <FeedbackButton className="secondary" info={() => ({ level: 'none' })} />
        <button className="link-button" onClick={() => setConfirming(true)}>{t.levelSelect.resetProgress}</button>
      </footer>
      {confirming && <ConfirmReset onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onReset(); }} />}
    </main>
  );
}
