// The landing page's tiny simulation: level 2's idea (scale out behind a load balancer) run by the real engine,
// so the numbers on the landing never disagree with the game.
import { simulate } from '../engine/simulate';
import type { Design, Level } from '../engine/types';

export const DEMO = {
  minRps: 50, maxRps: 700, stepRps: 50, maxInstances: 4,
  /** Level 2's requirements. */
  requirements: { p95Ms: 200, maxErrorRate: 0.01 },
  /** Short run so the result follows the slider (about 15 ms at most). */
  durationS: 10,
  seed: 1,
  /** A medium database serves ~800 req/s, so every traffic level can be fixed with app servers alone. */
  databaseSize: 'medium',
} as const;

export type DemoInput = { rps: number; instances: number };
export type DemoOutcome = {
  passed: boolean; p95: number; errorRate: number; cost: number;
  /** Peak load of each app server instance, 0–1 (above 1 never happens: the engine reports busy share). */
  instanceLoads: number[];
  /** The component type holding requests back, when it mattered. */
  bottleneck: 'appServer' | 'database' | 'loadBalancer' | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function demoDesign(instances: number): Design {
  const lb = instances > 1;
  return {
    components: [
      ...(lb ? [{ id: 'lb', type: 'loadBalancer' }] : []),
      { id: 'api', type: 'appServer', params: { instances, size: 'medium' } },
      { id: 'db', type: 'database', params: { size: DEMO.databaseSize } },
    ],
    connections: [['client', lb ? 'lb' : 'api'], ...(lb ? [['lb', 'api'] as [string, string]] : []), ['api', 'db']],
  };
}

function demoLevel(rps: number): Level {
  return { durationS: DEMO.durationS, traffic: [{ fromS: 0, toS: DEMO.durationS, rps }], requirements: DEMO.requirements, budget: Infinity, starCostThresholds: [] };
}

export function runDemo(input: DemoInput): DemoOutcome {
  const rps = clamp(Math.round(input.rps / DEMO.stepRps) * DEMO.stepRps, DEMO.minRps, DEMO.maxRps);
  const instances = clamp(Math.round(input.instances), 1, DEMO.maxInstances);
  const design = demoDesign(instances);
  const result = simulate(demoLevel(rps), design, DEMO.seed);
  const api = result.components.find(c => c.id === 'api');
  const bottleneckType = design.components.find(c => c.id === result.bottleneck?.componentId)?.type;
  return {
    passed: result.passed, p95: result.p95, errorRate: result.errorRate, cost: result.cost,
    instanceLoads: api?.instances.map(i => i.peakUtilization) ?? [],
    bottleneck: result.passed ? null : (bottleneckType as DemoOutcome['bottleneck']) ?? null,
  };
}
