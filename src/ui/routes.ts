import { playMode, type Progress } from '../progress/progress';

/** The level map's address. The empty hash is kept free for the landing page. */
export const LEVELS_HASH = 'levels';
export const levelsHref = `#${LEVELS_HASH}`;
/** The Field Manual: how to play, the buildings and the concepts. `#manual/<tab>` opens a tab. */
export const MANUAL_HASH = 'manual';
export type ManualTab = 'howto' | 'buildings' | 'concepts';
export const MANUAL_TABS: ManualTab[] = ['howto', 'buildings', 'concepts'];
export const manualHref = (tab?: ManualTab) => `#${MANUAL_HASH}${tab ? `/${tab}` : ''}`;
/** Old address of the building list: opens the manual on its Buildings tab. */
export const ARCHIVE_HASH = 'archive';
/** The buildings as a briefing before level 1, with a button that starts it. */
export const BRIEFING_HASH = 'briefing';
export const briefingHref = `#${BRIEFING_HASH}`;
/** Options: language, sound, difficulty, reset. */
export const OPTIONS_HASH = 'options';
export const optionsHref = `#${OPTIONS_HASH}`;
/** The difficulty screen. `#mode/<level>` starts that level after the choice. */
export const MODE_HASH = 'mode';
export const modeHref = (levelId?: string) => `#${MODE_HASH}${levelId ? `/${levelId}` : ''}`;

/** Where "play" goes for a mission: straight into the game in the player's mode, or to the difficulty screen first. */
export function playHref(levelId: string, progress: Progress): string {
  const mode = playMode(progress);
  return mode ? `#${levelId}/${mode}` : `#${levelId}`;
}
