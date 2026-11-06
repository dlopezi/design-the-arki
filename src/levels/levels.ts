import { z } from 'zod';
import { catalog } from '../catalog/catalog';
import type { Design, Level } from '../engine/types';

const componentType = z.string().refine(t => t in catalog, { error: issue => `Unknown component type: ${String(issue.input)}` });

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
  requirements: z.object({ p95Ms: z.number().positive(), maxErrorRate: z.number().min(0).max(1) }),
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

/** Every level shipped with the game, ordered by id. */
export function allLevels(): LevelDefinition[] {
  return Object.values(files).map(f => parseLevel(f.default)).sort((a, b) => a.id.localeCompare(b.id));
}
