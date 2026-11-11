import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import { MODES, type Mode } from '../levels/modes';
import { levelsHref } from './routes';
import { blip } from './sound';

type Props = {
  /** The mission to start after the choice, or null when the player only changes the setting. */
  level: LevelDefinition | null;
  current: Mode | null;
  tutorialDone: boolean;
  onChoose: (mode: Mode) => void;
};

/** The difficulty screen, as in many games: chosen once for every mission, and changed here at any time. */
export function ModePicker({ level, current, tutorialDone, onChoose }: Props) {
  return (
    <main className="mode-picker">
      <a className="back" href={levelsHref}>← {t.levels}</a>
      {level && <span className="console-label">{t.modes.next(level.title)}</span>}
      <h1>{t.modes.title}</h1>
      <p className="muted">{t.modes.intro}</p>
      <ul className="mode-cards" aria-label={t.modes.listLabel}>
        {MODES.map((mode, i) => (
          <li key={mode}>
            {tutorialDone || mode === 'guided'
              ? <a href={level ? `#${level.id}/${mode}` : levelsHref} className={`mode-${mode} ${current === mode ? 'current' : ''}`}
                  onMouseEnter={() => blip('hover')} onClick={() => { blip('select'); onChoose(mode); }}>
                  <span className="mode-pips" aria-hidden="true">{MODES.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</span>
                  <strong>{t.modes[mode].name}</strong>
                  <span>{t.modes[mode].description}</span>
                  {current === mode && <em>{t.modes.selected}</em>}
                </a>
              : <div className={`locked-mode mode-${mode}`}><strong>{t.modes[mode].name}</strong><span>{t.tutorial.lockedMode}</span></div>}
          </li>
        ))}
      </ul>
      <p className="muted mode-later">{t.modes.later}</p>
    </main>
  );
}
