import { useMemo } from 'react';
import { baseOf, type District } from '../base/base';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';
import { Building, buildingName } from './componentArt';
import { archiveHref, levelsHref } from './routes';

// Isometric layout: each district is a diamond plot; plots sit on a grid three wide, in level order.
const PLOT = { w: 150, h: 75 };
const STEP = { x: PLOT.w + 24, y: PLOT.h + 12 };
const COLUMNS = 3;
/** More buildings than this in one district are still counted, but not all drawn. */
const MAX_DRAWN = 16;

const plotCenter = (i: number) => {
  const col = i % COLUMNS, row = Math.floor(i / COLUMNS);
  return { x: (col - row) * STEP.x, y: (col + row) * STEP.y };
};
const diamond = (cx: number, cy: number, w: number, h: number) => `${cx - w},${cy} ${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h}`;

/** Places one building per instance on a small grid inside the plot, back to front. */
function DistrictBuildings({ district, cx, cy }: { district: District; cx: number; cy: number }) {
  const items = district.buildings.flatMap(b => Array.from({ length: b.count }, () => b.type)).slice(0, MAX_DRAWN);
  const n = Math.ceil(Math.sqrt(items.length));
  const cell = (PLOT.w * 0.82) / n;
  const size = cell * 2.2;
  const placed = items.map((type, k) => {
    const da = (k % n) - (n - 1) / 2, db = Math.floor(k / n) - (n - 1) / 2;
    return { type, x: cx + (da - db) * cell, y: cy + ((da + db) * cell) / 2 };
  }).sort((p, q) => p.y - q.y);
  return <>{placed.map((p, k) => (
    <g key={k} transform={`translate(${p.x - size / 2}, ${p.y - (size * 50) / 64})`}><Building type={p.type} size={size} /></g>
  ))}</>;
}

/** The player's Base: every passed level adds a district with the buildings of the design that passed it. */
export function BasePage({ levels, progress }: { levels: LevelDefinition[]; progress: Progress }) {
  const b = t.base;
  const base = useMemo(() => baseOf(levels, progress), [levels, progress]);
  const centers = base.districts.map((_, i) => plotCenter(i));
  const minX = Math.min(0, ...centers.map(c => c.x)) - PLOT.w - 20, maxX = Math.max(0, ...centers.map(c => c.x)) + PLOT.w + 20;
  const minY = Math.min(0, ...centers.map(c => c.y)) - PLOT.h - 90, maxY = Math.max(0, ...centers.map(c => c.y)) + PLOT.h + 40;
  const road = centers.map((c, i) => `${i ? 'L' : 'M'}${c.x},${c.y}`).join(' ');

  return (
    <main className="base-page">
      <nav className="page-bar">
        <a href="#">← {t.levelSelect.home}</a>
        <span className="page-links"><a href={levelsHref}>{t.levels}</a><a href={archiveHref}>{t.archive.title}</a></span>
      </nav>
      <header className="page-head">
        <span className="console-label">{t.levelSelect.title}</span>
        <h1>{b.title}</h1>
        <p>{b.intro}</p>
      </header>

      {base.districts.length === 0 ? (
        <div className="base-empty panel">
          <Building type="appServer" size={120} down />
          <p>{b.empty}</p>
          <a className="primary-link" href={levelsHref}>{t.levels} ▶</a>
        </div>
      ) : <>
        <div className="base-stats" role="status">
          <span>{b.districtCount(base.districts.length)}</span>
          <span>{b.buildingCount(base.buildings)}</span>
        </div>
        <div className="base-map panel">
          <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} width={maxX - minX} role="img" aria-label={b.map}>
            <polygon className="base-ground" points={diamond(centers.reduce((s, c) => s + c.x, 0) / centers.length, centers.reduce((s, c) => s + c.y, 0) / centers.length,
              (maxX - minX) / 2 - 8, (maxY - minY) / 2 - 30)} opacity={0.5} />
            {centers.length > 1 && <path className="base-road" d={road} />}
            {base.districts.map((d, i) => {
              const c = centers[i]!;
              return (
                <g key={d.levelId}>
                  <polygon className="base-district-floor" points={diamond(c.x, c.y, PLOT.w, PLOT.h)} />
                  <DistrictBuildings district={d} cx={c.x} cy={c.y} />
                  <text className="base-district-label" x={c.x} y={c.y + PLOT.h + 16} textAnchor="middle">{b.district(d.number, d.title)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <ul className="base-districts">
          {base.districts.map(d => (
            <li key={d.levelId} className="panel">
              <h3>{b.district(d.number, d.title)}</h3>
              <ul>
                {d.buildings.map((bd, k) => (
                  <li key={k}><Building type={bd.type} size={26} />{bd.count} × {buildingName(bd.type)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </>}
    </main>
  );
}
