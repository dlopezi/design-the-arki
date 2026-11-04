# 10: Difficulty modes

**What to build:** Before each level the player picks Guided, Normal, Hard or God. Each level file has a hand-written Starting Design for Guided (almost complete), Normal (partial) and Hard (broken); God starts with clients only. Hints follow the mode (Guided: from the start; Normal and Hard: after failing; God: never, bottleneck still highlighted). Stars depend only on cost; a Badge shows the hardest mode passed.

**Blocked by:** 06, 09

**Status:** ready-for-agent

- [ ] Level schema includes starting designs for guided, normal and hard
- [ ] Level test asserts no starting design already passes
- [ ] Mode picker before each level; last design remembered per level and mode
- [ ] Hint visibility follows the mode table in the spec
- [ ] Badge shows the hardest mode passed on the level select
