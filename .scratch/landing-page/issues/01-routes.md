# 01: Level map moves to #levels

**What to build:** The site root is free for the landing page. The level map opens at `#levels`; "← Levels" in the game and the mode picker, and the locked-level redirect, go there. Until ticket 02 lands, the root still shows the level map, so nothing looks broken in between.

**Blocked by:** none

**Status:** resolved

- [x] `#levels` opens the level map; empty hash still shows it until 02
- [x] Every "← Levels" link and the locked-level redirect point to `#levels`
- [x] Existing E2E tests that expect the level map open `/#levels`
- [x] `npm run check` and `npm run e2e` pass

## Comments

**2026-11-05, implemented.** `src/ui/routes.ts` holds the level map address (`#levels`). "← Levels" in the game and the mode picker link there; a locked level opened by link is replaced with `#levels` and its notice. The empty hash still shows the level map until ticket 02. E2E tests open `/#levels`, and a new one checks the mode picker links back to it. Checks: typecheck, 97 unit and 41 E2E tests pass.

**2026-11-05, resolved.** Implemented in 8fb3cf0.
