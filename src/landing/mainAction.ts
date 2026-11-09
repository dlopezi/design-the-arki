import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';
import { levelsHref } from '../ui/routes';

/** Where the landing's main button goes: level 1's tutorial for a new player, the next open level for a returning one. */
export function mainAction(levels: Pick<LevelDefinition, 'id'>[], progress: Progress): { href: string; label: string; returning: boolean } {
  const passed = (id: string) => (progress.levels[id]?.bestStars ?? 0) > 0;
  const returning = levels.some(l => passed(l.id));
  if (!returning) return { href: `#${levels[0]?.id}/guided`, label: t.landing.playFirst, returning };
  const next = levels.findIndex(l => !passed(l.id));
  if (next < 0) return { href: levelsHref, label: t.landing.playAgain, returning };
  return { href: `#${levels[next]!.id}`, label: t.landing.continueAt(next + 1), returning };
}
