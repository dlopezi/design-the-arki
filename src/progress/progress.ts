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
  /** The latest design that passed the level: what the player's Base shows for it. */
  passedDesign?: Design;
};
export type Progress = {
  version: 1;
  levels: Record<string, LevelProgress>;
  tutorialDone?: boolean;
  /** The difficulty the player chose once for every mission; unset until they choose. */
  mode?: Mode;
};

const KEY = 'design-the-arki:progress';
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

/** Records a pass: keeps the best stars, the hardest mode and the design that passed. */
export function withPass(progress: Progress, id: string, stars: number, mode: Mode, design?: Design): Progress {
  const current = progress.levels[id] ?? { bestStars: 0 };
  const bestStars = Math.max(current.bestStars, stars);
  const bestMode = !current.bestMode || modeRank(mode) > modeRank(current.bestMode) ? mode : current.bestMode;
  const passedDesign = design ?? current.passedDesign;
  if (bestStars === current.bestStars && bestMode === current.bestMode && passedDesign === current.passedDesign) return progress;
  return { ...progress, levels: { ...progress.levels, [id]: { ...current, bestStars, bestMode, ...(passedDesign && { passedDesign }) } } };
}

export function withDesign(progress: Progress, id: string, mode: Mode, design: Design): Progress {
  const current = progress.levels[id] ?? { bestStars: 0 };
  return { ...progress, levels: { ...progress.levels, [id]: { ...current, designs: { ...current.designs, [mode]: design } } } };
}

export function withMode(progress: Progress, mode: Mode): Progress {
  return progress.mode === mode ? progress : { ...progress, mode };
}

/** The mode a mission opens in: Guided until the tutorial is done, then the chosen one (null: ask first). */
export function playMode(progress: Progress): Mode | null {
  return progress.tutorialDone ? progress.mode ?? null : 'guided';
}

export function withTutorialDone(progress: Progress): Progress {
  return progress.tutorialDone ? progress : { ...progress, tutorialDone: true };
}
