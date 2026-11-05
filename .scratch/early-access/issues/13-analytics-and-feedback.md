# 13: Analytics and feedback link

**What to build:** The maintainer sees where players drop off through cookieless analytics events (level started, run, level passed with stars and mode, level abandoned), and players have a visible feedback link.

**Blocked by:** 09

**Status:** resolved

- [x] Analytics wrapper sends the four events; does nothing when blocked or not configured
- [x] No cookies and no personal data in events
- [x] Feedback link visible from the game screen and level select

## Comments

**2026-11-04, implemented.** `track()` sends "Level started", "Run" (passed yes/no), "Level passed" (stars) and "Level abandoned" (left without passing), each with level id and mode only, to Plausible (`plausible(event, { props })`) or Umami (`umami.track`) when either script is present, and does nothing otherwise; errors are swallowed. The script is added only when `VITE_ANALYTICS_SRC` (+ `VITE_ANALYTICS_DOMAIN` or `VITE_ANALYTICS_WEBSITE_ID`) is set at build time; see `.env.example`. "Send feedback" links from the level select and the game to `VITE_FEEDBACK_URL`, defaulting to GitHub issues of dlopezi/archi-game. **Needs a human:** pick the provider and feedback destination (a private repo's issues are not reachable by players).

**2026-11-05, resolved.** Implemented in 9570f71 ("Ticket 13: cookieless analytics and feedback link").
