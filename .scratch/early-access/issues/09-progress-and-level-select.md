# 09: Progress and level select

**What to build:** The player sees chapter 1's levels with their stars, plays them in order (each unlocks the next), and finds their last design restored when reopening a level. Progress lives in the browser (ADR-0003) and can be reset.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Progress store saves unlocked levels, best stars and last design per level; works (without saving) when storage is unavailable
- [ ] Level select shows chapter, levels, stars and locks
- [ ] Passing a level unlocks the next
- [ ] Reset progress asks for confirmation inside the page
- [ ] End-to-end test: pass a level, reload, stars and unlock persist
