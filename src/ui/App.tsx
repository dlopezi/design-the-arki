import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../i18n';
import { allLevels } from '../levels/levels';
import { newTypesIn } from '../archive/archive';
import { LevelSelect } from './levelSelect';
import { isUnlocked, loadProgress, resetProgress, saveProgress, withPass, withTutorialDone, type Progress } from '../progress/progress';
import { isMode } from '../levels/modes';
import { ModePicker } from './modePicker';
import { ARCHIVE_HASH, BASE_HASH, BRIEFING_HASH, LEVELS_HASH, levelsHref } from './routes';
import { Archive } from './archive';
import { BasePage } from './basePage';
import { Landing } from './landing';
import { PlayScreen } from './play/PlayScreen';

/** `#` is the landing page, `#levels` the level select, `#archive` / `#briefing` the Building Archive, `#base` the player's Base, `#<level>` the mode picker, `#<level>/<mode>` the game. */
const routeFromHash = () => {
  const [levelId = '', mode = ''] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { levelId, mode: isMode(mode) ? mode : null };
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

  const update = useCallback((next: (p: Progress) => Progress) => {
    setProgress(current => {
      const updated = next(current);
      if (updated !== current) setStorageWorks(saveProgress(updated));
      return updated;
    });
  }, []);

  const level = levels.find(l => l.id === route.levelId);
  const locked = !!level && !isUnlocked(ids, level.id, progress);
  useEffect(() => {
    if (level && locked) {
      setNotice(t.levelSelect.lockedNotice(level.title));
      history.replaceState(null, '', `${location.pathname}${levelsHref}`);
      setRoute({ levelId: LEVELS_HASH, mode: null });
    } else if (level) {
      setNotice(null);
    }
  }, [level, locked]);

  if (!level && route.levelId === '') return <Landing levels={levels} progress={progress} />;
  if (route.levelId === ARCHIVE_HASH || route.levelId === BRIEFING_HASH) {
    return <Archive key={route.levelId} levels={levels} progress={progress} briefing={route.levelId === BRIEFING_HASH} />;
  }
  if (route.levelId === BASE_HASH) return <BasePage levels={levels} progress={progress} />;
  if (!level || locked) {
    return <LevelSelect levels={levels} progress={progress} notice={notice} storageWorks={storageWorks}
      onReset={() => { setProgress(resetProgress()); setNotice(null); }} />;
  }
  const tutorialDone = !!progress.tutorialDone;
  // Until the tutorial is done, only guided mode can be played.
  if (!route.mode || (!tutorialDone && route.mode !== 'guided')) return <ModePicker level={level} tutorialDone={tutorialDone} />;
  const mode = route.mode;
  const next = ids[ids.indexOf(level.id) + 1];
  return (
    <PlayScreen key={`${level.id}/${mode}`} level={level} newTypes={newTypesIn(levels, level.id)} mode={mode} nextLevelId={next ?? null}
      onPassed={(stars, design) => update(p => withPass(p, level.id, stars, mode, design))}
      tutorial={!tutorialDone && mode === 'guided' && level.tutorial ? level.tutorial : null}
      onTutorialDone={() => update(withTutorialDone)} />
  );
}
