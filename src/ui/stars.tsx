import { t } from '../i18n';

/** Stars earned out of the maximum, read out as a sentence. */
export function Stars({ earned, max }: { earned: number; max: number }) {
  return (
    <span className="stars" role="img" aria-label={t.starsLabel(earned, max)}>
      {'★'.repeat(earned)}<span className="off">{'★'.repeat(max - earned)}</span>
    </span>
  );
}
