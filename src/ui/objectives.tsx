import type { Result } from '../engine/types';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';

type State = 'met' | 'failed' | 'pending';
const MARK: Record<State, string> = { met: '✓', failed: '✕', pending: '' };

/** Objectives panel: budget is judged live from the design's cost; latency and errors after a run. */
export function Objectives({ level, cost, result }: { level: LevelDefinition; cost: number; result: Result | null }) {
  const checkState = (requirement: 'p95' | 'errorRate'): State => {
    const check = result?.checks.find(c => c.requirement === requirement);
    return !check ? 'pending' : check.ok ? 'met' : 'failed';
  };
  const items: { key: string; label: string; state: State }[] = [
    { key: 'p95', label: t.objectiveP95(level.requirements.p95Ms), state: checkState('p95') },
    { key: 'errors', label: t.objectiveErrors(level.requirements.maxErrorRate), state: checkState('errorRate') },
    { key: 'cost', label: t.objectiveCost(level.budget), state: cost <= level.budget ? 'met' : 'failed' },
  ];
  return (
    <ul className="objectives" aria-label={t.objectives}>
      {items.map(item => (
        <li key={item.key} data-state={item.state}>
          <span className="box" aria-hidden="true">{MARK[item.state]}</span>
          {item.label}
          <span className="visually-hidden"> ({t.objectiveState[item.state]})</span>
        </li>
      ))}
    </ul>
  );
}
