// PROTOTYPE: three home-screen (level select) directions, switchable with ?variant=A|B|C and a floating bar.
// Throwaway: the winner gets rewritten properly into levelSelect.tsx; this folder is then removed.
import { useEffect, useState } from 'react';
import { en as t } from '../../i18n/en';
import type { LevelDefinition } from '../../levels/levels';
import type { Mode } from '../../levels/modes';
import { isUnlocked, type Progress } from '../../progress/progress';
import { HomePath } from './path.prototype';
import { HomeSkyline } from './skyline.prototype';
import { HomeHub } from './hub.prototype';
import './home.prototype.css';

export type LevelStatus = 'done' | 'current' | 'locked' | 'open';
export type HomeLevel = { level: LevelDefinition; number: number; status: LevelStatus; stars: number; maxStars: number; bestMode?: Mode };
export type HomeProps = { levels: HomeLevel[]; totalStars: number; maxStars: number; chapter: string; current: HomeLevel | undefined; onReset: () => void };

/** Derives what every home variant needs from levels and progress. */
export function homeModel(levels: LevelDefinition[], progress: Progress) {
  const ids = levels.map(l => l.id);
  const rows: HomeLevel[] = levels.map((level, i) => {
    const stars = progress.levels[level.id]?.bestStars ?? 0;
    const unlocked = isUnlocked(ids, level.id, progress);
    return { level, number: i + 1, stars, maxStars: 1 + level.starCostThresholds.length, bestMode: progress.levels[level.id]?.bestMode,
      status: !unlocked ? 'locked' : stars > 0 ? 'done' : 'open' };
  });
  const current = rows.find(r => r.status === 'open') ?? [...rows].reverse().find(r => r.status === 'done');
  if (current && current.status === 'open') current.status = 'current';
  return {
    levels: rows, current,
    totalStars: rows.reduce((s, r) => s + r.stars, 0), maxStars: rows.reduce((s, r) => s + r.maxStars, 0),
    chapter: t.levelSelect.chapter(1, levels[0]?.chapter ?? ''),
  };
}

const VARIANTS = [
  { key: 'A', name: 'Camino', C: HomePath },
  { key: 'B', name: 'Skyline', C: HomeSkyline },
  { key: 'C', name: 'Inicio de juego', C: HomeHub },
];

export const prototypeVariant = () => new URLSearchParams(location.search).get('variant');

/** Renders the chosen variant plus the floating switcher (dev and prototype builds only). */
export function HomePrototype({ levels, progress, onReset }: { levels: LevelDefinition[]; progress: Progress; onReset: () => void }) {
  const [key, setKey] = useState(prototypeVariant() ?? 'A');
  const index = Math.max(0, VARIANTS.findIndex(v => v.key === key));
  const go = (d: number) => {
    const next = VARIANTS[(index + d + VARIANTS.length) % VARIANTS.length]!.key;
    const url = new URL(location.href);
    url.searchParams.set('variant', next);
    history.replaceState(null, '', url);
    setKey(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const Variant = VARIANTS[index]!.C;
  return (
    <>
      <Variant {...homeModel(levels, progress)} onReset={onReset} />
      <div className="proto-switcher" role="group" aria-label="Prototype variants">
        <button onClick={() => go(-1)} aria-label="Previous variant">‹</button>
        <span><b>{VARIANTS[index]!.key}</b> · {VARIANTS[index]!.name}</span>
        <button onClick={() => go(1)} aria-label="Next variant">›</button>
      </div>
    </>
  );
}

export function StarRow({ earned, max, size = 16 }: { earned: number; max: number; size?: number }) {
  return (
    <span className="g-stars" style={{ fontSize: size }} role="img" aria-label={t.starsLabel(earned, max)}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < earned ? 'on' : 'off'}>★</span>)}
    </span>
  );
}
