import { catalog } from '../catalog/catalog';
import type { LevelDefinition } from '../levels/levels';
import { isUnlocked, type Progress } from '../progress/progress';

export type ArchiveEntry = {
  type: string;
  /** The level that brings this component for the first time. */
  level: { id: string; number: number; title: string };
  /** The player can reach that level. */
  unlocked: boolean;
  monthlyCost: number;
};

/** The Building Archive: every component the levels use, in the order they introduce it. */
export function archiveEntries(levels: Pick<LevelDefinition, 'id' | 'title' | 'allowedComponents'>[], progress: Progress): ArchiveEntry[] {
  const ids = levels.map(l => l.id);
  const entries: ArchiveEntry[] = [];
  levels.forEach((level, i) => {
    for (const type of level.allowedComponents) {
      if (entries.some(e => e.type === type)) continue;
      entries.push({
        type,
        level: { id: level.id, number: i + 1, title: level.title },
        unlocked: isUnlocked(ids, level.id, progress),
        monthlyCost: catalog[type]!.monthlyCost,
      });
    }
  });
  return entries;
}
