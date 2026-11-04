import type { Catalog } from '../engine/types';

// Every component type is a combination of engine primitives plus its numbers (ADR-0004).
export const catalog: Catalog = {
  appServer: { primitive: 'station', workers: 4, meanServiceMs: 20 },
  database: { primitive: 'station', workers: 8, meanServiceMs: 20 },
};
