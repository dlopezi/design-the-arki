import { useMemo, useState } from 'react';
import { archiveEntries } from '../archive/archive';
import { t } from '../i18n';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';
import { artStyle, Building, buildingName } from './componentArt';
import { levelsHref } from './routes';

type Props = {
  levels: LevelDefinition[];
  progress: Progress;
  /** Before level 1: a briefing with a button that starts it. Otherwise the archive, open from the menus. */
  briefing: boolean;
};

/**
 * The Building Archive: what each component (building) is for and when to build it.
 * Shown as a briefing before the first level, and always open from the title screen and the level map.
 */
export function Archive({ levels, progress, briefing }: Props) {
  const a = t.archive;
  const entries = useMemo(() => archiveEntries(levels, progress), [levels, progress]);
  // In the briefing every building is open to read: they are what the player is about to meet.
  const isOpen = (unlocked: boolean) => briefing || unlocked;
  const [selected, setSelected] = useState(entries[0]?.type ?? '');
  const entry = entries.find(e => e.type === selected) ?? entries[0];
  const firstLevel = levels[0];
  if (!entry) return null;
  const text = a.buildings[entry.type];
  const open = isOpen(entry.unlocked);

  return (
    <main className="archive">
      <nav className="page-bar">
        <a href="#">← {t.levelSelect.home}</a>
        {!briefing && <a href={levelsHref}>{t.levels} →</a>}
      </nav>
      <header className="page-head">
        <span className="console-label">{briefing ? a.briefingEyebrow : a.list}</span>
        <h1>{briefing ? a.briefingTitle : a.title}</h1>
        <p>{briefing ? a.briefingIntro : a.intro}</p>
        <p className="archive-pick">👉 {a.pick}</p>
      </header>

      <div className="archive-body">
        <ul className="archive-list panel" aria-label={a.list}>
          {entries.map(e => (
            <li key={e.type}>
              <button aria-current={e.type === entry.type} className={isOpen(e.unlocked) ? '' : 'locked'} onClick={() => setSelected(e.type)}>
                <Building type={e.type} size={44} down={!isOpen(e.unlocked)} />
                <span className="name">
                  {buildingName(e.type)}
                  <small>{t.componentTypes[e.type] ?? e.type}{isOpen(e.unlocked) ? '' : ` · ${a.locked}`}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <section className={`archive-detail panel ${open ? '' : 'is-locked'}`} style={artStyle(entry.type)} aria-labelledby="archive-name" aria-live="polite">
          <div className="archive-art"><Building type={entry.type} size={180} down={!open} /></div>
          <div>
            <h2 id="archive-name">{buildingName(entry.type)}</h2>
            <span className="kind">{a.component}: <strong>{t.componentTypes[entry.type] ?? entry.type}</strong></span>
          </div>
          {open ? (
            <dl>
              <div><dt>{a.role}</dt><dd>{text?.role}</dd></div>
              <div><dt>{a.when}</dt><dd>{text?.when}</dd></div>
            </dl>
          ) : <p className="muted">{a.lockedText(entry.level.number)}</p>}
          <div className="archive-facts">
            <span className="cost">{a.cost(entry.monthlyCost)}</span>
            <span>{a.unlockedIn} {a.unlocksAt(entry.level.number, entry.level.title)}</span>
          </div>
        </section>
      </div>

      {briefing && firstLevel && (
        <div className="archive-actions">
          <a className="primary-link" href={`#${firstLevel.id}/guided`}>{a.start} ▶</a>
        </div>
      )}
    </main>
  );
}
