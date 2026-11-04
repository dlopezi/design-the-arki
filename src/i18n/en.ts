// All player-facing text. A translation is another object with the same keys.
export const en = {
  play: 'Play',
  running: 'Running…',
  requirements: 'Requirements',
  p95Requirement: (ms: number) => `p95 latency ≤ ${ms} ms`,
  errorRequirement: (rate: number) => `errors ≤ ${(rate * 100).toFixed(1)}%`,
  traffic: (rps: number, fromS: number, toS: number) => `${rps} req/s from ${fromS} s to ${toS} s`,
  passed: 'Level passed',
  failed: 'Level failed',
  resultLine: (p95: number, errorRate: number) => `p95 ${Math.round(p95)} ms · errors ${(errorRate * 100).toFixed(1)}%`,
  pressPlay: 'Press Play to send traffic through your design.',
  clients: 'Clients',
  componentTypes: { appServer: 'App server', database: 'Database' } as Record<string, string>,
};
export type Strings = typeof en;
