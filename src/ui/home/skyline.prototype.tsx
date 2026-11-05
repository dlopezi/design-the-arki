// PROTOTYPE variant B: your progress builds a night skyline; each level is a building that lights up.
import { en as t } from '../../i18n/en';
import { StarRow, type HomeProps } from './home.prototype';

const HEIGHTS = [120, 170, 140, 210, 160, 240, 190, 280];

export function HomeSkyline({ levels, totalStars, maxStars, chapter, current, onReset }: HomeProps) {
  return (
    <main className="g-home g-skyline">
      <header className="g-topbar">
        <span className="g-brand">archi-game</span>
        <span className="g-pill"><span className="g-star">★</span> {totalStars} / {maxStars}</span>
      </header>

      <section className="g-sky-hero">
        <span className="g-banner-eyebrow">{chapter}</span>
        <h1>Build your city, one system at a time</h1>
        {current && (
          <a className="g-cta" href={`#${current.level.id}`}>
            ▶ {t.levelSelect.play} level {current.number}: {current.level.title}
          </a>
        )}
      </section>

      <div className="g-city" role="list" aria-label="Levels">
        <div className="g-moon" aria-hidden="true" />
        {levels.map((row, i) => {
          const lit = row.status === 'done' ? row.stars / row.maxStars : row.status === 'current' ? 0.15 : 0;
          const windows = Array.from({ length: Math.floor(HEIGHTS[i % 8]! / 22) * 3 });
          const content = (
            <>
              <span className="g-building" style={{ height: HEIGHTS[i % 8] }}>
                <span className="g-windows">
                  {windows.map((_, w) => <span key={w} className={(w * 7919) % 100 < lit * 100 ? 'w on' : 'w'} />)}
                </span>
                {row.status === 'current' && <span className="g-crane" aria-hidden="true" />}
                {row.status === 'locked' && <span className="g-lock" aria-hidden="true">🔒</span>}
              </span>
              <span className="g-plate">
                <b>{row.number}</b> {row.level.title}
                {row.status !== 'locked' && <StarRow earned={row.stars} max={row.maxStars} size={13} />}
              </span>
            </>
          );
          return (
            <div key={row.level.id} role="listitem" className={`g-lot ${row.status}`}>
              {row.status === 'locked'
                ? <span aria-label={`${row.level.title}: ${t.levelSelect.locked}`}>{content}</span>
                : <a href={`#${row.level.id}`} aria-label={`${t.levelSelect.play} ${row.level.title}`}>{content}</a>}
            </div>
          );
        })}
      </div>

      <footer className="g-footer"><button className="g-link" onClick={onReset}>{t.levelSelect.resetProgress}</button></footer>
    </main>
  );
}
