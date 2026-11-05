# 02: Cost, stars and report card

**What to build:** The player sees the design's live monthly cost, the objectives panel (p95, errors, budget) and a cost meter with the star thresholds. After a run a report card shows pass/fail, stars, p95, errors and cost, and tells a player who passed with fewer than 3 stars how cheap the design must get for the next star.

**Blocked by:** 01

**Status:** resolved

- [x] Cost comes from the catalogue and updates as soon as the design changes
- [x] Engine tests: pass requires every requirement including cost ≤ budget; stars = 1 + one per cost threshold met
- [x] Objectives tick or cross after a run; the budget objective is live
- [x] Cost meter shows the 2★ and 3★ thresholds
- [x] Report card shows the verdict, stars and the cost needed for the next star

## Comments

**2026-11-04, implemented.** Engine result now has `cost` (from catalogue `monthlyCost`), a `budget` check, `stars` and `nextStarCost`, all test-first at `simulate`. Level schema requires `budget` and strictly decreasing `starCostThresholds`. UI: objectives HUD (budget judged live, latency/errors after a run), cost meter with star ticks, report card dialog. The next-star message renders from `nextStarCost` but has no E2E yet: level 1's only design earns 3★; cover it once ticket 03 makes the design editable.

**2026-11-05, resolved.** Implemented in 381ad83 ("Ticket 02: cost, stars and report card").
