import { catalog } from '../catalog/catalog';
import type { Design } from '../engine/types';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';

export type District = { levelId: string; number: number; title: string; buildings: { type: string; count: number }[] };
export type Base = { districts: District[]; buildings: number };

/** Every instance is a building: a component that scales out has as many as its instance count. */
const buildingsOf = (design: Design) => design.components.map(c => ({
  type: c.type,
  count: catalog[c.type]?.scalesOut ? Math.max(1, Number(c.params?.instances ?? 1)) : 1,
}));

/** How many buildings a design adds to the Base: one per instance. */
export const buildingCount = (design: Design) => buildingsOf(design).reduce((sum, b) => sum + b.count, 0);

/**
 * The player's Base: one district per passed level, built from the design that passed it
 * (the level's reference design when no passing design was stored, e.g. progress from an older version).
 */
export function baseOf(levels: Pick<LevelDefinition, 'id' | 'title' | 'referenceDesign'>[], progress: Progress): Base {
  const districts = levels.flatMap((level, i): District[] => {
    const saved = progress.levels[level.id];
    if (!saved || saved.bestStars <= 0) return [];
    return [{ levelId: level.id, number: i + 1, title: level.title, buildings: buildingsOf(saved.passedDesign ?? level.referenceDesign) }];
  });
  return { districts, buildings: districts.reduce((sum, d) => sum + d.buildings.reduce((s, b) => s + b.count, 0), 0) };
}
