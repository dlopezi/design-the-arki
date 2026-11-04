import { useEffect, useId, useRef } from 'react';
import type { Result } from '../engine/types';
import { en as t, percent } from '../i18n/en';

export function Stars({ earned, max }: { earned: number; max: number }) {
  return (
    <span className="stars" role="img" aria-label={t.starsLabel(earned, max)}>
      {'★'.repeat(earned)}<span className="off">{'★'.repeat(max - earned)}</span>
    </span>
  );
}

const REQUIREMENT_LABEL = { p95: t.statP95, errorRate: t.statErrors, budget: t.statCost } as const;

/** Verdict after a run: stars, the three key numbers, and what to aim for next. */
export function ReportCard({ result, maxStars, onClose }: { result: Result; maxStars: number; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const check = (r: keyof typeof REQUIREMENT_LABEL) => result.checks.find(c => c.requirement === r)!;
  const failed = result.checks.filter(c => !c.ok);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="report" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <Stars earned={result.stars} max={maxStars} />
        <h2 id={titleId} className={result.passed ? 'ok' : 'bad'}>{result.passed ? t.passed : t.failed}</h2>
        <dl className="stats">
          <div className={check('p95').ok ? 'ok' : 'bad'}><dt>{t.statP95}</dt><dd>{Math.round(result.p95)} ms</dd></div>
          <div className={check('errorRate').ok ? 'ok' : 'bad'}><dt>{t.statErrors}</dt><dd>{percent(result.errorRate)}</dd></div>
          <div className={check('budget').ok ? 'ok' : 'bad'}><dt>{t.statCost}</dt><dd>${result.cost}</dd></div>
        </dl>
        {!result.passed && <p className="note">{t.failedObjectives} {failed.map(c => REQUIREMENT_LABEL[c.requirement]).join(', ')}</p>}
        {result.nextStarCost !== null && <p className="note">{t.nextStar(result.nextStarCost, result.stars + 1)}</p>}
        <button ref={closeRef} className="secondary" onClick={onClose}>{t.backToDesign}</button>
      </div>
    </div>
  );
}
