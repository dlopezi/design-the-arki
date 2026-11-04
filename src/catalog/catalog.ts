import type { Catalog } from '../engine/types';

// Every component type is a combination of engine primitives plus its numbers (ADR-0004).
export const catalog: Catalog = {
  // Capacity (~10 000 req/s) is deliberately far above early-access traffic and not shown to players.
  loadBalancer: {
    primitive: 'station', workers: 10, meanServiceMs: 1, monthlyCost: 20, endsRequests: false, distributes: true,
    presentation: { zone: 'edge', technology: 'L7 · round-robin', hideCapacity: true },
  },
  appServer: {
    primitive: 'station', workers: 4, meanServiceMs: 20, monthlyCost: 40, endsRequests: false, scalesOut: true,
    sizes: {
      small: { workers: 2, monthlyCost: 20, vcpu: 1 },
      medium: { workers: 4, monthlyCost: 40, vcpu: 2 },
      large: { workers: 8, monthlyCost: 80, vcpu: 4 },
    },
    defaultSize: 'medium',
    presentation: { zone: 'application', technology: 'Node.js', instancePrefix: 'app' },
  },
  cache: {
    primitive: 'station', workers: 50, meanServiceMs: 2, monthlyCost: 30, endsRequests: false,
    shortcut: { param: 'ttlS', defaultValue: 10, halfAt: 30, max: 0.95 },
    presentation: { zone: 'data', technology: 'Redis' },
  },
  database: {
    primitive: 'station', workers: 8, meanServiceMs: 20, monthlyCost: 50, endsRequests: true,
    // Tiers: connections the database serves at once.
    sizes: { small: { workers: 8, monthlyCost: 50 }, medium: { workers: 16, monthlyCost: 150 }, large: { workers: 32, monthlyCost: 400 } },
    defaultSize: 'small',
    presentation: { zone: 'data', technology: 'PostgreSQL' },
  },
};
