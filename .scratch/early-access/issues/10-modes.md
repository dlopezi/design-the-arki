# 10: Difficulty modes

**What to build:** Before each level the player picks Guided, Normal, Hard or God. Each level file has a hand-written Starting Design for Guided (almost complete), Normal (partial) and Hard (broken); God starts with clients only. Hints follow the mode (Guided: from the start; Normal and Hard: after failing; God: never, bottleneck still highlighted). Stars depend only on cost; a Badge shows the hardest mode passed.

**Blocked by:** 06, 09

**Status:** ready-for-agent

- [x] Level schema includes starting designs for guided, normal and hard
- [x] Level test asserts no starting design already passes
- [x] Mode picker before each level; last design remembered per level and mode
- [x] Hint visibility follows the mode table in the spec
- [x] Badge shows the hardest mode passed on the level select

## Comments

**2026-11-04, implemented.** Levels gained `startingDesigns` (guided, normal, hard; god starts empty) and a `guidedHint`; the level test checks no starting design already passes (an unrunnable one counts as not passing). Routing: `#<level>` shows the mode picker, `#<level>/<mode>` the game. Progress keeps the last design per level and mode, best stars, and `bestMode` (the badge on the level select). Hints: guided shows its hint from the start and the hint sentence after failing, normal and hard only after failing, god never (the bottleneck stays highlighted). While writing the starting designs I closed a rules gap: clients could connect straight to the database (level 1 passed for $50 with 3★); the entry component must now accept clients (`acceptsClients`, new `notPublic` problem).
