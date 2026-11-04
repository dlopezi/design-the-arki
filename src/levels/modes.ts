import type { Design } from '../engine/types';
import type { LevelDefinition } from './levels';

/** Difficulty modes, easiest first. Stars depend only on cost; the badge records the hardest mode passed. */
export const MODES = ['guided', 'normal', 'hard', 'god'] as const;
export type Mode = (typeof MODES)[number];

export const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value);
export const modeRank = (mode: Mode) => MODES.indexOf(mode);

/** The design a level opens with in a mode; God mode starts with only the clients. */
export function startingDesign(level: LevelDefinition, mode: Mode): Design {
  return mode === 'god' ? { components: [], connections: [] } : level.startingDesigns[mode];
}

/** Whether the hint sentence may be shown: guided always, normal and hard after a failed run, god never. */
export function hintAllowed(mode: Mode, failed: boolean): boolean {
  return mode === 'guided' || ((mode === 'normal' || mode === 'hard') && failed);
}
