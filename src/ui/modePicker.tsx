import { en as t } from '../i18n/en';
import type { LevelDefinition } from '../levels/levels';
import { MODES } from '../levels/modes';
import { levelsHref } from './routes';

/** Before a level: how much of the design is given and how much help is shown. */
export function ModePicker({ level, tutorialDone }: { level: LevelDefinition; tutorialDone: boolean }) {
  return (
    <main className="mode-picker">
      <a className="back" href={levelsHref}>← {t.levels}</a>
      <h1>{level.title}</h1>
      <p className="muted">{level.brief}</p>
      <h2>{t.modes.choose}</h2>
      <ul className="mode-cards" aria-label={t.modes.listLabel}>
        {MODES.map(mode => (
          <li key={mode}>
            {tutorialDone || mode === 'guided'
              ? <a href={`#${level.id}/${mode}`}><strong>{t.modes[mode].name}</strong><span>{t.modes[mode].description}</span></a>
              : <div className="locked-mode"><strong>{t.modes[mode].name}</strong><span>{t.tutorial.lockedMode}</span></div>}
          </li>
        ))}
      </ul>
    </main>
  );
}
