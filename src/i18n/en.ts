// All player-facing text. A translation is another object with the same keys.
const stars = (n: number) => '★'.repeat(n);

export const en = {
  play: 'Play',
  objectives: 'Objectives',
  objectiveP95: (ms: number) => `p95 latency ≤ ${ms} ms`,
  objectiveErrors: (rate: number) => `Errors ≤ ${percent(rate)}`,
  objectiveCost: (budget: number) => `Cost ≤ $${budget}/month`,
  objectiveState: { met: 'met', failed: 'not met', pending: 'not run yet' },
  traffic: (rps: number, fromS: number, toS: number) => `${rps} req/s from ${fromS} s to ${toS} s`,
  monthlyCost: 'Monthly cost',
  costMeterText: (cost: number, budget: number, thresholds: number[]) =>
    `$${cost} of $${budget}` + (thresholds.length ? '; ' + thresholds.map((t, i) => `${stars(i + 2)} at $${t}`).join(', ') : ''),
  passed: 'Level passed',
  failed: 'Level failed',
  starsLabel: (n: number, max: number) => `${n} of ${max} stars`,
  statP95: 'p95',
  statErrors: 'Errors',
  statCost: 'Cost',
  nextStar: (cost: number, starCount: number) => `Get the cost down to $${cost}/month for ${stars(starCount)}.`,
  failedObjectives: 'Not met:',
  backToDesign: 'Back to design',
  components: 'Components',
  hotbarItem: (key: number, label: string, cost: number) => `${key} ${label} $${cost}`,
  canvasHint: 'Add components from the bar below, then drag from one handle to another to connect them. Delete removes the selection.',
  problems: {
    noEntry: 'Connect Clients to a component first: drag from the Clients handle to an app server.',
    deadEnd: (label: string) => `${label} has nowhere to send requests. Connect it to a component that can answer them.`,
    loop: (labels: string[]) => `Requests would go round in a loop between ${labels.join(' and ')}. Remove one of those connections.`,
  },
  clients: 'Clients',
  componentTypes: { appServer: 'App server', database: 'Database' } as Record<string, string>,
};
export type Strings = typeof en;

export function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
