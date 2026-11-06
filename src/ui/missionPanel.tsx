import type { Result } from '../engine/types';
import { en as t } from '../i18n/en';
import type { LevelDefinition } from '../levels/levels';
import type { Mode } from '../levels/modes';
import { Objectives } from './objectives';

type Props = {
  level: LevelDefinition;
  mode: Mode;
  /** Component types this level offers for the first time. */
  newTypes: string[];
  cost: number;
  /** The last finished run, or null while running or before the first run. */
  result: Result | null;
};

/** The level's mission: mode, brief, objectives, traffic, new components, incidents and how to use the canvas. */
export function MissionPanel({ level, mode, newTypes, cost, result }: Props) {
  return (
    <>
      <p className="mode-line">{t.modes.current(t.modes[mode].name)} · <a href={`#${level.id}`}>{t.modes.change}</a></p>
      <p>{level.brief}</p>
      {mode === 'guided' && <p role="note" className="guided-hint">{level.guidedHint}</p>}
      <Objectives level={level} cost={cost} result={result} />
      <ul className="traffic">{level.traffic.map(s => <li key={s.fromS}>{t.traffic(s.rps, s.fromS, s.toS)}</li>)}</ul>
      {newTypes.length > 0 && (
        <ul className="new-components" aria-label={t.newComponents}>
          {newTypes.map(type => <li key={type}><strong>New: {t.componentTypes[type] ?? type}</strong> {t.componentIntros[type]}</li>)}
        </ul>
      )}
      {(level.failureEvents?.length ?? 0) > 0 && (
        <ul className="incidents" aria-label={t.incidents}>
          {level.failureEvents!.map(f => <li key={`${f.atS}-${f.componentType}-${f.instance}`}>⚡ {t.incident(t.componentTypes[f.componentType] ?? f.componentType, f.instance + 1, f.atS)}</li>)}
        </ul>
      )}
      <p className="hint">{t.canvasHint}</p>
    </>
  );
}
