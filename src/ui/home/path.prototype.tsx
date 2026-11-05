// PROTOTYPE variant A: a winding path of big round level buttons.
import { en as t } from '../../i18n/en';
import { StarRow, type HomeProps } from './home.prototype';

const STEP_Y = 172;
const OFFSETS = [0, 70, 105, 70, 0, -70, -105, -70]; // zigzag in px from the centre line

export function HomePath({ levels, totalStars, maxStars, chapter, current, onReset }: HomeProps) {
  const width = 360;
  const height = levels.length * STEP_Y + 60;
  const x = (i: number) => width / 2 + OFFSETS[i % OFFSETS.length]!;
  const y = (i: number) => 60 + i * STEP_Y;
  const segment = (i: number) => `C${x(i - 1)},${y(i - 1) + STEP_Y / 2} ${x(i)},${y(i) - STEP_Y / 2} ${x(i)},${y(i)}`;
  const trace = (count: number) => `M${x(0)},${y(0)} ` + Array.from({ length: Math.max(0, count - 1) }, (_, k) => segment(k + 1)).join(' ');
  const path = trace(levels.length);
  const doneUpTo = Math.max(0, levels.findIndex(l => l.status !== 'done'));
  const donePath = trace(doneUpTo + 1);

  return (
    <main className="g-home g-path">
      <header className="g-topbar">
        <span className="g-brand">archi-game</span>
        <span className="g-pill"><span className="g-star">★</span> {totalStars} / {maxStars}</span>
      </header>

      <section className="g-banner">
        <span className="g-banner-eyebrow">{chapter}</span>
        <strong>{current ? `Level ${current.number}: ${current.level.title}` : 'Chapter complete!'}</strong>
        <div className="g-progress"><span style={{ width: `${(totalStars / maxStars) * 100}%` }} /></div>
      </section>

      <div className="g-map" style={{ width, height }}>
        <svg width={width} height={height} className="g-road" aria-hidden="true">
          <path d={path} className="g-road-base" />
          {doneUpTo > 0 && <path d={donePath} className="g-road-done" />}
        </svg>
        {levels.map((row, i) => (
          <div key={row.level.id} className={`g-node ${row.status}`} style={{ left: x(i), top: y(i) }}>
            {row.status === 'current' && <a className="g-bubble" href={`#${row.level.id}`}>{t.levelSelect.play}!</a>}
            {row.status === 'locked'
              ? <span className="g-coin" aria-label={`${row.level.title}: ${t.levelSelect.locked}`}>🔒</span>
              : <a className="g-coin" href={`#${row.level.id}`} aria-label={`${t.levelSelect.play} ${row.level.title}`}>{row.status === 'done' ? '✓' : row.number}</a>}
            <span className="g-node-title">{row.level.title}</span>
            {row.status !== 'locked' && <StarRow earned={row.stars} max={row.maxStars} />}
          </div>
        ))}
      </div>

      <footer className="g-footer"><button className="g-link" onClick={onReset}>{t.levelSelect.resetProgress}</button></footer>
    </main>
  );
}
