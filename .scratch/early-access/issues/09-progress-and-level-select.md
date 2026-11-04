# 09: Progress and level select

**What to build:** The player sees chapter 1's levels with their stars, plays them in order (each unlocks the next), and finds their last design restored when reopening a level. Progress lives in the browser (ADR-0003) and can be reset.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Progress store saves unlocked levels, best stars and last design per level; works (without saving) when storage is unavailable
- [x] Level select shows chapter, levels, stars and locks
- [x] Passing a level unlocks the next
- [x] Reset progress asks for confirmation inside the page
- [x] End-to-end test: pass a level, reload, stars and unlock persist

## Comments

**2026-11-04, implemented.** Progress store (`localStorage` key `archi-game:progress`, version 1): best stars and last design per level; every read and write is guarded, and the level select warns when the browser refuses to save. Routing by hash: empty is the level select, `#<level id>` opens an unlocked level; a locked one returns to the select with a notice. Levels gained a `chapter` field ("Core"). Level cards show number, title, stars and Play or Locked; Reset progress asks for confirmation in a page dialog. The game has a "← Levels" link and the report a "Next level" link after a pass. Tested end to end (the agreed seam); other E2E specs open levels through an `openLevel` helper that seeds all levels as unlocked.
