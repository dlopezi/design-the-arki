import { useEffect, useState } from 'react';

/** Below this width the game screen uses the compact (phone) layout. */
export const COMPACT_QUERY = '(max-width: 699px)';
/** Tablets and small windows: one side panel with tabs instead of a panel on each side. */
export const MEDIUM_QUERY = '(min-width: 700px) and (max-width: 1099px)';
/** Tall enough for the results drawer in two rows (portrait tablets). */
export const TALL_QUERY = '(min-height: 900px)';

/** Whether a CSS media query matches, kept up to date as the window changes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
