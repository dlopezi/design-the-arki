// PROTOTYPE variant C: a mobile-game home: one big card for the next level, a level strip, and a badge shelf.
import { en as t } from '../../i18n/en';
import { StarRow, type HomeProps } from './home.prototype';

export function HomeHub({ levels, totalStars, maxStars, chapter, current, onReset }: HomeProps) {
  const passed = levels.filter(l => l.status === 'done').length;
  const badges = levels.filter(l => l.bestMode);
  return (
    <main className="g-home g-hub">
      <header className="g-topbar">
        <span className="g-brand">archi-game</span>
        <span className="g-pill"><span className="g-star">★</span> {totalStars} / {maxStars}</span>
        <span className="g-pill">🏆 {passed} / {levels.length}</span>
      </header>

      {current && (
        <section className="g-hero-card">
          <span className="g-banner-eyebrow">{chapter} · Level {current.number}</span>
          <h1>{current.level.title}</h1>
          <p>{current.level.brief}</p>
          <div className="g-hero-row">
            <StarRow earned={current.stars} max={current.maxStars} size={26} />
            <a className="g-big-play" href={`#${current.level.id}`}>▶ {t.levelSelect.play}</a>
          </div>
        </section>
      )}

      <section>
        <h2 className="g-section-title">{chapter}</h2>
        <ol className="g-strip">
          {levels.map(row => (
            <li key={row.level.id} className={`g-token ${row.status}`}>
              {row.status === 'locked'
                ? <span className="g-token-face" aria-label={`${row.level.title}: ${t.levelSelect.locked}`}>🔒</span>
                : <a className="g-token-face" href={`#${row.level.id}`} aria-label={`${t.levelSelect.play} ${row.level.title}`}>{row.number}</a>}
              <span className="g-token-title">{row.level.title}</span>
              {row.status !== 'locked' && <StarRow earned={row.stars} max={row.maxStars} size={12} />}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="g-section-title">Badges</h2>
        <div className="g-shelf">
          {badges.length === 0 && <p className="muted">Pass levels in harder modes to fill this shelf.</p>}
          {badges.map(row => (
            <span key={row.level.id} className={`g-medal ${row.bestMode}`} title={t.modes.badge(t.modes[row.bestMode!].name)}>
              <b>{row.number}</b><small>{t.modes[row.bestMode!].name}</small>
            </span>
          ))}
        </div>
      </section>

      <footer className="g-footer"><button className="g-link" onClick={onReset}>{t.levelSelect.resetProgress}</button></footer>
    </main>
  );
}
