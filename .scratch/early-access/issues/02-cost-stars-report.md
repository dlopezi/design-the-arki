# 02: Cost, stars and report card

**What to build:** The player sees the design's live monthly cost, the objectives panel (p95, errors, budget) and a cost meter with the star thresholds. After a run a report card shows pass/fail, stars, p95, errors and cost, and tells a player who passed with fewer than 3 stars how cheap the design must get for the next star.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Cost comes from the catalogue and updates as soon as the design changes
- [ ] Engine tests: pass requires every requirement including cost ≤ budget; stars = 1 + one per cost threshold met
- [ ] Objectives tick or cross after a run; the budget objective is live
- [ ] Cost meter shows the 2★ and 3★ thresholds
- [ ] Report card shows the verdict, stars and the cost needed for the next star
