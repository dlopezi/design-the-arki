import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../i18n';
import { allLevels } from '../levels/levels';
import { newTypesIn } from '../archive/archive';
import { LevelSelect } from './levelSelect';
import { isUnlocked, loadProgress, playMode, resetProgress, saveProgress, withMode, withPass, withTutorialDone, type Progress } from '../progress/progress';
import { isMode, type Mode } from '../levels/modes';
import { ModePicker } from './modePicker';
import { ARCHIVE_HASH, BRIEFING_HASH, LEVELS_HASH, levelsHref, MANUAL_HASH, MANUAL_TABS, MODE_HASH, OPTIONS_HASH, type ManualTab } from './routes';
import { Manual } from './manual';
import { Options } from './options';
import { Landing } from './landing';
import { PlayScreen } from './play/PlayScreen';

/**
 * `#` is the landing page, `#levels` the campaign map, `#manual[/<tab>]` the Field Manual (`#archive` its Buildings tab),
 * `#briefing` the buildings before level 1, `#options` the options, `#mode[/<level>]` the difficulty screen,
 * `#<level>` a mission in the player's mode (or the difficulty screen first), `#<level>/<mode>` a mission in that mode.
 */
const routeFromHash = () => {
  const [levelId = '', second = ''] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { levelId, second, mode: isMode(second) ? second : null };
};

export function App() {
  const levels = useMemo(() => allLevels(), []);
  const ids = useMemo(() => levels.map(l => l.id), [levels]);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [storageWorks, setStorageWorks] = useState(true);
  const [route, setRoute] = useState(routeFromHash);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.levelId, route.second]);

  const update = useCallback((next: (p: Progress) => Progress) => {
    setProgress(current => {
      const updated = next(current);
      if (updated !== current) setStorageWorks(saveProgress(updated));
      return updated;
    });
  }, []);
  const chooseMode = useCallback((mode: Mode) => update(p => withMode(p, mode)), [update]);
  const tutorialDone = !!progress.tutorialDone;

  const level = levels.find(l => l.id === route.levelId);
  const locked = !!level && !isUnlocked(ids, level.id, progress);
  useEffect(() => {
    if (level && locked) {
      setNotice(t.levelSelect.lockedNotice(level.title));
      history.replaceState(null, '', `${location.pathname}${levelsHref}`);
      setRoute({ levelId: LEVELS_HASH, second: '', mode: null });
    } else if (level) {
      setNotice(null);
    }
  }, [level, locked]);
  // A mission opened without a mode plays in the player's mode: write it in the address, so a reload keeps it.
  const chosen = playMode(progress);
  useEffect(() => {
    if (!level || locked || route.mode || !chosen) return;
    history.replaceState(null, '', `${location.pathname}#${level.id}/${chosen}`);
    // Keep the route in step: the mode must not change under a running mission (for example when the tutorial ends).
    setRoute(routeFromHash());
  }, [level, locked, route.mode, chosen]);

  if (!level && route.levelId === '') return <Landing levels={levels} progress={progress} />;
  if (route.levelId === MANUAL_HASH || route.levelId === ARCHIVE_HASH) {
    const tab = route.levelId === ARCHIVE_HASH ? 'buildings' : (MANUAL_TABS as string[]).includes(route.second) ? route.second as ManualTab : undefined;
    return <Manual levels={levels} progress={progress} tab={tab} />;
  }
  if (route.levelId === BRIEFING_HASH) return <Manual levels={levels} progress={progress} briefing />;
  if (route.levelId === OPTIONS_HASH) {
    return <Options mode={progress.mode ?? null} onReset={() => { setProgress(resetProgress()); setNotice(null); }} />;
  }
  if (route.levelId === MODE_HASH) {
    const target = levels.find(l => l.id === route.second && isUnlocked(ids, l.id, progress)) ?? null;
    return <ModePicker level={target} current={progress.mode ?? null} tutorialDone={tutorialDone} onChoose={chooseMode} />;
  }
  if (!level || locked) {
    return <LevelSelect levels={levels} progress={progress} notice={notice} storageWorks={storageWorks} />;
  }
  // Until the tutorial is done, only guided mode can be played.
  const mode = route.mode && (tutorialDone || route.mode === 'guided') ? route.mode : chosen;
  if (!mode) return <ModePicker level={level} current={null} tutorialDone={tutorialDone} onChoose={chooseMode} />;
  const next = ids[ids.indexOf(level.id) + 1];
  // After the tutorial, the next mission asks for a difficulty once; then it keeps the mode being played.
  const nextHref = next ? (progress.mode || !tutorialDone ? `#${next}/${mode}` : `#${next}`) : null;
  return (
    <PlayScreen key={`${level.id}/${mode}`} level={level} number={ids.indexOf(level.id) + 1} newTypes={newTypesIn(levels, level.id)} mode={mode} nextHref={nextHref}
      levels={levels} progress={progress}
      onPassed={(stars, design) => update(p => withPass(p, level.id, stars, mode, design))}
      tutorial={!tutorialDone && mode === 'guided' && level.tutorial ? level.tutorial : null}
      onTutorialDone={() => update(withTutorialDone)} />
  );
}
