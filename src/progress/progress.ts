import type { Design } from '../engine/types';
import { modeRank, type Mode } from '../levels/modes';

// Player progress lives only in this browser (ADR-0003). Every read and write tolerates storage
// being unavailable (private windows, blocked site data): the game still works, it just forgets.

export type LevelProgress = {
  bestStars: number;
  /** Hardest mode the level was passed in (the badge). */
  bestMode?: Mode;
  /** Last design per mode, so each mode resumes where the player left it. */
  designs?: Partial<Record<Mode, Design>>;
};
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

/** Records a pass: keeps the best stars and the hardest mode. */
export function withPass(progress: Progress, id: string, stars: number, mode: Mode): Progress {
  const current = progress.levels[id] ?? { bestStars: 0 };
  const bestStars = Math.max(current.bestStars, stars);
  const bestMode = !current.bestMode || modeRank(mode) > modeRank(current.bestMode) ? mode : current.bestMode;
  if (bestStars === current.bestStars && bestMode === current.bestMode) return progress;
  return { ...progress, levels: { ...progress.levels, [id]: { ...current, bestStars, bestMode } } };
}

export function withDesign(progress: Progress, id: string, mode: Mode, design: Design): Progress {
  const current = progress.levels[id] ?? { bestStars: 0 };
  return { ...progress, levels: { ...progress.levels, [id]: { ...current, designs: { ...current.designs, [mode]: design } } } };
}
