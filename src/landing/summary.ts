import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';

export type PlayerSummary = {
  stars: number;
  maxStars: number;
  /** The chapter of the next level to play (the last chapter once everything is passed). */
  chapter: { number: number; name: string; passed: number; levels: number };
  /** The first level not passed yet, or null when every level is passed. */
  next: { number: number; title: string } | null;
};

type SummaryLevel = Pick<LevelDefinition, 'id' | 'chapter' | 'title' | 'starCostThresholds'>;

/** What the title screen's player bar and menu show: stars collected, chapter progress and the next level. */
export function playerSummary(levels: SummaryLevel[], progress: Progress): PlayerSummary {
  const starsOf = (id: string) => progress.levels[id]?.bestStars ?? 0;
  const nextIndex = levels.findIndex(l => starsOf(l.id) === 0);
  const next = nextIndex < 0 ? null : levels[nextIndex]!;
  const chapters = [...new Set(levels.map(l => l.chapter))];
  const chapterName = next?.chapter ?? chapters[chapters.length - 1] ?? '';
  const inChapter = levels.filter(l => l.chapter === chapterName);
  return {
    stars: levels.reduce((sum, l) => sum + starsOf(l.id), 0),
    maxStars: levels.reduce((sum, l) => sum + 1 + l.starCostThresholds.length, 0),
    chapter: { number: chapters.indexOf(chapterName) + 1, name: chapterName, passed: inChapter.filter(l => starsOf(l.id) > 0).length, levels: inChapter.length },
    next: next ? { number: nextIndex + 1, title: next.title } : null,
  };
}
