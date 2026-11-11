import { useEffect, useId, useRef, useState } from 'react';
import { lang, LANGS, setLang, t } from '../i18n';
import type { Mode } from '../levels/modes';
import { levelsHref, modeHref } from './routes';
import { setSoundOn, soundOn } from './sound';

function ConfirmReset({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="report" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <h2 id={titleId}>{t.levelSelect.resetTitle}</h2>
        <p className="muted">{t.levelSelect.resetBody}</p>
        <div className="actions">
          <button ref={cancelRef} className="secondary" onClick={onCancel}>{t.levelSelect.cancel}</button>
          <button className="danger" onClick={onConfirm}>{t.levelSelect.reset}</button>
        </div>
      </div>
    </div>
  );
}

/** Options: language, sound, difficulty and the progress reset, kept away from everyday buttons. */
export function Options({ mode, onReset }: { mode: Mode | null; onReset: () => void }) {
  const o = t.options;
  const [sound, setSound] = useState(soundOn);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);
  const seg = (on: boolean, set: (on: boolean) => void, label: string) => (
    <div className="seg" role="group" aria-label={label}>
      <button type="button" aria-pressed={on} onClick={() => set(true)}>{o.on}</button>
      <button type="button" aria-pressed={!on} onClick={() => set(false)}>{o.off}</button>
    </div>
  );
  return (
    <main className="options-page">
      <nav className="page-bar">
        <a href="#">← {t.levelSelect.home}</a>
        <a href={levelsHref}>{t.levelSelect.campaign} →</a>
      </nav>
      <header className="page-head"><h1>{o.title}</h1></header>
      <div className="options panel">
        <div className="opt">
          <div><strong>{o.language}</strong><span>{o.languageNote}</span></div>
          <div className="seg" role="group" aria-label={t.footer.language}>
            {LANGS.map(code => <button key={code} type="button" aria-pressed={lang() === code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>)}
          </div>
        </div>
        <div className="opt">
          <div><strong>{o.sound}</strong><span>{o.soundNote}</span></div>
          {seg(sound, on => { setSoundOn(on); setSound(on); }, o.sound)}
        </div>
        <div className="opt">
          <div><strong>{o.difficulty}</strong><span>{o.difficultyNote(mode ? t.modes[mode].name : t.modes.notChosen)}</span></div>
          <a className="btn" href={modeHref()}>{o.change}</a>
        </div>
        <div className="opt">
          <div><strong>{o.progress}</strong><span>{o.progressNote}</span></div>
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>{t.levelSelect.resetProgress}</button>
        </div>
        {cleared && <p role="status" className="note ok">{o.cleared}</p>}
      </div>
      {confirming && <ConfirmReset onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); onReset(); setCleared(true); }} />}
    </main>
  );
}
