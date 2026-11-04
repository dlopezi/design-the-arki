import { z } from 'zod';
import { catalog } from '../catalog/catalog';
import type { Design, Level } from '../engine/types';

const componentType = z.string().refine(t => t in catalog, t => ({ message: `Unknown component type: ${t}` }));

const designSchema = z.object({
  components: z.array(z.object({ id: z.string().min(1), type: componentType, params: z.record(z.unknown()).optional() })),
  connections: z.array(z.tuple([z.string(), z.string()])),
});

const levelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  brief: z.string().min(1),
  durationS: z.number().positive(),
  traffic: z.array(z.object({ fromS: z.number().min(0), toS: z.number().positive(), rps: z.number().positive() })).min(1),
  requirements: z.object({ p95Ms: z.number().positive(), maxErrorRate: z.number().min(0).max(1) }),
  budget: z.number().positive(),
  starCostThresholds: z.array(z.number().positive()).refine(t => t.every((x, i) => i === 0 || x < t[i - 1]!), 'starCostThresholds must be strictly decreasing'),
  allowedComponents: z.array(componentType).min(1),
  /** Per component type: which sizes and how many instances the player may choose. */
  componentOptions: z.record(z.object({ sizes: z.array(z.string()).min(1).optional(), maxInstances: z.number().int().min(1).optional() })).default({}),
  referenceDesign: designSchema,
});

export type ComponentOptions = { sizes?: string[]; maxInstances?: number };

export type LevelDefinition = Level & {
  id: string; title: string; brief: string; allowedComponents: string[];
  componentOptions: Record<string, ComponentOptions>; referenceDesign: Design;
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
