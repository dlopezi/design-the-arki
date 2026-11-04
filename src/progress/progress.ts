import type { Design } from '../engine/types';

// Player progress lives only in this browser (ADR-0003). Every read and write tolerates storage
// being unavailable (private windows, blocked site data): the game still works, it just forgets.

export type LevelProgress = { bestStars: number; lastDesign?: Design };
export type Progress = { version: 1; levels: Record<string, LevelProgress> };

const KEY = 'archi-game:progress';
const empty = (): Progress => ({ version: 1, levels: {} });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Progress;
    return parsed?.version === 1 && parsed.levels && typeof parsed.levels === 'object' ? parsed : empty();
  } catch {
    return empty();
  }
}

/** Returns false when the browser refused to store it. */
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function resetProgress(): Progress {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored, nothing to clear */ }
  return empty();
}

/** The first level is always open; every other one opens once the previous one has been passed. */
export function isUnlocked(levelIds: string[], id: string, progress: Progress): boolean {
  const index = levelIds.indexOf(id);
  if (index === 0) return true;
  if (index < 0) return false;
  return (progress.levels[levelIds[index - 1]!]?.bestStars ?? 0) > 0;
}

export function withStars(progress: Progress, id: string, stars: number): Progress {
  const current = progress.levels[id];
  if ((current?.bestStars ?? 0) >= stars) return progress;
  return { ...progress, levels: { ...progress.levels, [id]: { ...current, bestStars: stars } } };
}

export function withDesign(progress: Progress, id: string, design: Design): Progress {
  const current = progress.levels[id];
  return { ...progress, levels: { ...progress.levels, [id]: { bestStars: current?.bestStars ?? 0, ...current, lastDesign: design } } };
}
