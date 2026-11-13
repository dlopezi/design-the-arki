import { z } from 'zod';
import { catalog, requestTypes } from '../catalog/catalog';
import type { Design, Level } from '../engine/types';
import type { Play } from '../realtime/game';
import { lang, type Lang } from '../i18n';
import { chaptersEs, levelTextEs } from './text.es';

const componentType = z.string().refine(t => t in catalog, { error: issue => `Unknown component type: ${String(issue.input)}` });

const unknownTypes = (mix: object) => Object.keys(mix).filter(t => !requestTypes.includes(t));
/** The share of each Request Type in a wave: every share above 0, and all of them adding up to 1. */
const waveMix = z.record(z.string(), z.number().positive().max(1))
  .refine(mix => Object.keys(mix).length > 0, 'The mix needs at least one Request Type')
  .refine(mix => unknownTypes(mix).length === 0, { error: issue => `Unknown Request Type: ${unknownTypes(issue.input as object).join(', ')}` })
  .refine(mix => Math.abs(Object.values(mix).reduce((a, v) => a + v, 0) - 1) < 1e-6, 'The shares of the mix must add up to 1');

const designSchema = z.object({
  components: z.array(z.object({ id: z.string().min(1), type: componentType, params: z.record(z.string(), z.unknown()).optional() })),
  connections: z.array(z.tuple([z.string(), z.string()])),
});

const levelSchema = z.object({
  id: z.string().min(1),
  chapter: z.string().min(1),
  title: z.string().min(1),
  brief: z.string().min(1),
  durationS: z.number().positive(),
  traffic: z.array(z.object({ fromS: z.number().min(0), toS: z.number().positive(), rps: z.number().positive() })).min(1),
  requirements: z.object({ p95Ms: z.number().positive(), maxErrorRate: z.number().min(0).max(1),
    /** Async levels: the longest the oldest Message may wait in a queue (seconds). */
    maxQueueAgeS: z.number().positive().optional() }),
  budget: z.number().positive(),
  starCostThresholds: z.array(z.number().positive()).refine(t => t.every((x, i) => i === 0 || x < t[i - 1]!), 'starCostThresholds must be strictly decreasing'),
  allowedComponents: z.array(componentType).min(1),
  failureEvents: z.array(z.object({ atS: z.number().min(0), componentType, instance: z.number().int().min(0) })).default([]),
  /** Per component type: which sizes and how many instances the player may choose. */
  componentOptions: z.record(z.string(), z.object({
    sizes: z.array(z.string()).min(1).optional(),
    maxInstances: z.number().int().min(1).optional(),
    /** Upper bounds for numeric params, e.g. { ttlS: 60 }. */
    limits: z.record(z.string(), z.number().positive()).optional(),
  })).default({}),
  /** Real-time play (ADR-0005): starting money, the one wave of users, an optional incident and the money for each extra star. */
  play: z.object({
    startMoney: z.number().positive(),
    wave: z.object({ rps: z.number().positive(), lengthS: z.number().positive(), mix: waveMix.optional() }),
    incident: z.object({ atS: z.number().min(0), componentType }).optional(),
    starMoney: z.array(z.number().min(0)).refine(t => t.every((x, i) => i === 0 || x > t[i - 1]!), 'starMoney must be strictly increasing'),
  }),
  /** Where each mode starts: guided is almost complete, normal is partial, hard is broken. God starts empty. */
  startingDesigns: z.object({ guided: designSchema, normal: designSchema, hard: designSchema }),
  /** Shown from the start in guided mode: the one idea this level teaches. */
  guidedHint: z.string().min(1),
  referenceDesign: designSchema,
  /** Step-by-step tutorial (level 1): each step points at something and waits for the real action. */
  tutorial: z.array(z.object({
    text: z.string().min(1),
    /** Text for the phone layout, when `text` names something a phone does not have (a drag, a key). */
    textCompact: z.string().min(1).optional(),
    target: z.union([z.object({ component: componentType }), z.object({ control: z.literal('play') })]).optional(),
    until: z.union([
      z.object({ select: componentType }),
      z.object({ connect: z.tuple([componentType, componentType]) }),
      z.object({ event: z.enum(['run', 'pass']) }),
    ]),
  })).optional(),
}).superRefine((level, ctx) => {
  // A level with a mix of Request Types, or with a queue, needs the buildings that finish the work (ADR-0006).
  const allowed = new Set(level.allowedComponents);
  const mix = level.play.wave.mix;
  if (mix && (mix.job ?? 0) > 0 && !(allowed.has('messageQueue') && allowed.has('worker'))) {
    ctx.addIssue({ code: 'custom', path: ['allowedComponents'], message: 'A level whose wave has jobs must allow a messageQueue and a worker' });
  }
  // A Read Replica is a copy of the primary database: without one there is nothing to copy (ADR-0007).
  if (allowed.has('readReplica') && !allowed.has('database')) {
    ctx.addIssue({ code: 'custom', path: ['allowedComponents'], message: 'A level that allows a readReplica must allow a database' });
  }
  // Without a maximum Queue Age a Backlog nobody empties would keep the Drain Phase going for ever.
  if (allowed.has('messageQueue') && level.requirements.maxQueueAgeS === undefined) {
    ctx.addIssue({ code: 'custom', path: ['requirements', 'maxQueueAgeS'], message: 'A level that allows a messageQueue must set a maximum Queue Age' });
  }
});

export type TutorialStep = {
  text: string;
  textCompact?: string;
  target?: { component: string } | { control: 'play' };
  until: { select: string } | { connect: [string, string] } | { event: 'run' | 'pass' };
};

export type ComponentOptions = { sizes?: string[]; maxInstances?: number; limits?: Record<string, number> };

export type LevelDefinition = Level & {
  id: string; chapter: string; title: string; brief: string; allowedComponents: string[];
  componentOptions: Record<string, ComponentOptions>; referenceDesign: Design;
  startingDesigns: { guided: Design; normal: Design; hard: Design }; guidedHint: string;
  tutorial?: TutorialStep[];
  play: Play;
};

/** Validates raw level data; throws with every problem listed (path and message). */
export function parseLevel(raw: unknown): LevelDefinition {
  const parsed = levelSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid level: ${problems}`);
  }
  return parsed.data as LevelDefinition;
}

const files = import.meta.glob<{ default: unknown }>('./*.json', { eager: true });

/** The level with its texts in `language`. Rules and designs never change with the language. */
export function translateLevel(level: LevelDefinition, language: Lang): LevelDefinition {
  if (language === 'en') return level;
  const text = levelTextEs[level.id];
  if (!text) return level;
  return {
    ...level,
    chapter: chaptersEs[level.chapter] ?? level.chapter,
    title: text.title,
    brief: text.brief,
    guidedHint: text.guidedHint,
    tutorial: level.tutorial?.map((step, i) => ({ ...step, ...text.tutorial?.[i] })),
  };
}

/** Every level shipped with the game, ordered by id, with texts in the current language. */
export function allLevels(language: Lang = lang()): LevelDefinition[] {
  return Object.values(files).map(f => translateLevel(parseLevel(f.default), language)).sort((a, b) => a.id.localeCompare(b.id));
}
