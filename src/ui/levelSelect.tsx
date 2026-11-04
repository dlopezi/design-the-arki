import { useEffect, useId, useRef, useState } from 'react';
import { en as t } from '../i18n/en';
import type { LevelDefinition } from '../levels/levels';
import { isUnlocked, type Progress } from '../progress/progress';
import { Stars } from './reportCard';

type Props = { levels: LevelDefinition[]; progress: Progress; notice: string | null; storageWorks: boolean; onReset: () => void };

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

/** Chapters and levels with the player's stars; locked levels cannot be opened yet. */
export function LevelSelect({ levels, progress, notice, storageWorks, onReset }: Props) {
  const [confirming, setConfirming] = useState(false);
  const ids = levels.map(l => l.id);
  const chapters = [...new Set(levels.map(l => l.chapter))];

  return (
    <main className="level-select">
      <header>
        <h1>{t.levelSelect.title}</h1>
        <p className="muted">{t.levelSelect.subtitle}</p>
        {notice && <p role="status" className="notice">{notice}</p>}
        {!storageWorks && <p className="notice">{t.levelSelect.noStorage}</p>}
      </header>
      {chapters.map((chapter, c) => (
        <section key={chapter} aria-labelledby={`chapter-${c}`}>
          <h2 id={`chapter-${c}`}>{t.levelSelect.chapter(c + 1, chapter)}</h2>
          <ol className="level-cards">
            {levels.filter(l => l.chapter === chapter).map(level => {
              const unlocked = isUnlocked(ids, level.id, progress);
              const stars = progress.levels[level.id]?.bestStars ?? 0;
              const bestMode = progress.levels[level.id]?.bestMode;
              return (
                <li key={level.id} className={unlocked ? '' : 'locked'}>
                  <span className="number">{ids.indexOf(level.id) + 1}</span>
                  <h3>{level.title}</h3>
                  <span className="card-meta">
                    <Stars earned={stars} max={1 + level.starCostThresholds.length} />
                    {bestMode && <span className={`badge mode ${bestMode}`} aria-label={t.modes.badge(t.modes[bestMode].name)}>{t.modes[bestMode].name}</span>}
                  </span>
                  {unlocked
                    ? <a className="play-link" href={`#${level.id}`}>{t.levelSelect.play}</a>
                    : <span className="muted">{t.levelSelect.locked}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <button className="danger reset" onClick={() => setConfirming(true)}>{t.levelSelect.resetProgress}</button>
      {confirming && <ConfirmReset onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onReset(); }} />}
    </main>
  );
}
