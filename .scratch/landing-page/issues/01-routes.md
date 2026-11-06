# 01: Level map moves to #levels

**What to build:** The site root is free for the landing page. The level map opens at `#levels`; "← Levels" in the game and the mode picker, and the locked-level redirect, go there. Until ticket 02 lands, the root still shows the level map, so nothing looks broken in between.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] `#levels` opens the level map; empty hash still shows it until 02
- [ ] Every "← Levels" link and the locked-level redirect point to `#levels`
- [ ] Existing E2E tests that expect the level map open `/#levels`
- [ ] `npm run check` and `npm run e2e` pass
