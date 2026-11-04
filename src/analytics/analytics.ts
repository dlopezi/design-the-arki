// Privacy-first analytics: a cookieless provider (Plausible or Umami) loaded only when configured.
// Events carry the level, mode, stars and pass/fail only; never anything about the player.
// Nothing here may break the game: when the script is missing or blocked, tracking does nothing.

export type AnalyticsEvent = 'Level started' | 'Run' | 'Level passed' | 'Level abandoned';
type Props = Record<string, string | number>;

type Providers = {
  plausible?: (event: string, options?: { props?: Props }) => void;
  umami?: { track: (event: string, data?: Props) => void };
};

export function track(event: AnalyticsEvent, props: Props): void {
  try {
    const w = window as unknown as Providers;
    if (typeof w.plausible === 'function') w.plausible(event, { props });
    else if (w.umami && typeof w.umami.track === 'function') w.umami.track(event, props);
  } catch {
    // Analytics must never break the game.
  }
}

/**
 * Adds the provider's script when the build sets it:
 * VITE_ANALYTICS_SRC (script URL) plus VITE_ANALYTICS_DOMAIN (Plausible) or VITE_ANALYTICS_WEBSITE_ID (Umami).
 */
export function loadAnalytics(): void {
  const src = import.meta.env.VITE_ANALYTICS_SRC as string | undefined;
  if (!src) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN as string | undefined;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;
  if (domain) script.dataset.domain = domain;
  if (websiteId) script.dataset.websiteId = websiteId;
  document.head.appendChild(script);
}

/** Where "Send feedback" points; set VITE_FEEDBACK_URL to use a form instead of GitHub issues. */
export const feedbackUrl = (import.meta.env.VITE_FEEDBACK_URL as string | undefined) ?? 'https://github.com/dlopezi/archi-game/issues/new';
