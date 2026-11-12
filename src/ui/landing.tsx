import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lang, LANGS, setLang, t } from '../i18n';
import { FeedbackDialog } from './feedbackDialog';
import { mainAction } from '../landing/mainAction';
import { playerSummary } from '../landing/summary';
import type { LevelDefinition } from '../levels/levels';
import type { Progress } from '../progress/progress';
import { levelsHref, manualHref, optionsHref } from './routes';
import { blip } from './sound';

// The title screen's backdrop, as on System Defense: falling 0s and 1s over a sky that meets a moving data floor.
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const RAIN = Array.from({ length: 26 }, (_, i) => ({
  left: `${(rnd(i, 1) * 100).toFixed(1)}%`,
  duration: `${(9 + rnd(i, 2) * 9).toFixed(1)}s`,
  delay: `${(-rnd(i, 3) * 18).toFixed(1)}s`,
  digits: Array.from({ length: 5 }, (_, k) => (rnd(i, k + 4) > 0.5 ? '1' : '0')).join('\n'),
}));

function TitleBackground() {
  return (
    <div className="title-bg" aria-hidden="true">
      <div className="title-rain">
        {RAIN.map((d, i) => <span key={i} style={{ left: d.left, animationDuration: d.duration, animationDelay: d.delay }}>{d.digits}</span>)}
      </div>
      <div className="title-horizon" />
      <div className="title-floor" />
    </div>
  );
}

const REPO_URL = 'https://github.com/dlopezi/design-the-arki';

type MenuItem = { label: string; note: string } & ({ href: string } | { onClick: () => void });

/** The first page a visitor sees, styled as a game's title screen: player bar, logo and main menu. */
export function Landing({ levels, progress }: { levels: LevelDefinition[]; progress: Progress }) {
  const l = t.landing;
  const action = mainAction(levels, progress);
  const summary = useMemo(() => playerSummary(levels, progress), [levels, progress]);
  const [selected, setSelected] = useState(0);
  const [feedback, setFeedback] = useState(false);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const closeFeedback = useCallback(() => { setFeedback(false); itemRefs.current[4]?.focus(); }, []);

  const menu: MenuItem[] = [
    { href: action.href, label: action.label, note: !summary.next ? l.allPassed : action.returning ? summary.next.title : l.firstNote(summary.next.title) },
    { href: levelsHref, label: l.levelMap, note: l.levelMapNote },
    { href: manualHref(), label: t.manual.title, note: t.manual.menuNote },
    { href: optionsHref, label: t.options.title, note: t.options.menuNote },
    { onClick: () => setFeedback(true), label: t.feedbackForm.title, note: t.feedbackForm.menuNote },
  ];

  // Game-style menu: ↑ / ↓ move the selection, Enter starts the selected item when nothing else has focus.
  useEffect(() => {
    if (feedback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const items = itemRefs.current;
      const active = document.activeElement;
      const focused = items.findIndex(item => item === active);
      const free = !active || active === document.body;
      if (focused < 0 && !free) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const from = focused < 0 ? selected : focused;
        const next = (from + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        setSelected(next);
        blip('hover');
        items[next]?.focus();
      } else if (e.key === 'Enter' && free) {
        e.preventDefault();
        items[selected]?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedback, selected]);

  const { chapter } = summary;
  // "Design the Arki" → white "Design the ", glowing "Arki" (like "Defend the" + "Arki").
  const split = t.levelSelect.title.lastIndexOf(' ') + 1;
  const logoA = t.levelSelect.title.slice(0, split), logoB = t.levelSelect.title.slice(split);
  const passed = levels.filter(lv => (progress.levels[lv.id]?.bestStars ?? 0) > 0).length;
  const chapterName = t.levelSelect.chapter(chapter.number, chapter.name);
  return (
    <div className="title">
      <TitleBackground />
      <div className="title-screen">
        <header className="title-bar">
          <span className="title-pill" role="img" aria-label={t.levelSelect.totalStars(summary.stars, summary.maxStars)}>
            <span className="home-star">★</span> {summary.stars} / {summary.maxStars}
          </span>
          <span className="title-chapter" role="img" aria-label={l.chapterProgress(chapterName, chapter.passed, chapter.levels)}>
            <span className="title-chapter-name">{chapterName}</span>
            <span className="title-chapter-bar"><span style={{ width: `${(chapter.passed / Math.max(1, chapter.levels)) * 100}%` }} /></span>
            <b>{chapter.passed}/{chapter.levels}</b>
          </span>
        </header>

        <main className="title-main">
          <div className="title-head">
            <p className="eyebrow">{l.eyebrow}</p>
            <h1>
              <span className="title-logo"><span className="logo-a">{logoA.trimEnd()}</span>{' '}<span className="logo-b">{logoB}</span></span>
              <span className="title-tagline">{l.headline} <span>{l.headlineAccent}</span></span>
            </h1>
          </div>

          <div className="title-panels">
            <nav className="title-menu title-panel" aria-label={l.menu}>
              <span className="eyebrow" aria-hidden="true">{l.menu}</span>
              <ul>
                {menu.map((item, i) => {
                  const content = <>
                    <span className="menu-marker" aria-hidden="true">▶</span>
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-note">{item.note}</span>
                  </>;
                  const common = {
                    className: `menu-item${i === 0 ? ' primary' : ''}`,
                    'data-selected': i === selected,
                    onMouseEnter: () => { if (i !== selected) blip('hover'); setSelected(i); },
                    onFocus: () => setSelected(i),
                  };
                  return (
                    <li key={item.label}>
                      {'href' in item
                        ? <a {...common} ref={el => { itemRefs.current[i] = el; }} href={item.href}>{content}</a>
                        : <button {...common} ref={el => { itemRefs.current[i] = el; }} onClick={item.onClick} aria-haspopup="dialog">{content}</button>}
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <p className="title-hint" aria-hidden="true">{l.pressEnter}<small>{l.pressEnterNote}</small></p>
        </main>

        <footer className="title-foot">
          <span className="title-best">🏆 {l.levelsPassed(passed)}</span>
          <span className="title-foot-right">
            <span className="lang-switch" role="group" aria-label={t.footer.language}>
              {LANGS.map(code => (
                <button key={code} type="button" aria-pressed={lang() === code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>
              ))}
            </span>
            <span className="title-links">
              <a href={`${REPO_URL}/releases/tag/v${__APP_VERSION__}`} target="_blank" rel="noopener noreferrer" aria-label={t.footer.release(__APP_VERSION__)}>v{__APP_VERSION__}</a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{t.footer.github} ↗</a>
              <span>{t.footer.copyright}</span>
            </span>
          </span>
        </footer>
      </div>
      {feedback && <FeedbackDialog info={{ level: 'none' }} onClose={closeFeedback} />}
    </div>
  );
}
