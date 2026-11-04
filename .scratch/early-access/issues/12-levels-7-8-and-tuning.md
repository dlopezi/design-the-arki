# 12: Levels 7–8 and content tuning

**What to build:** Ship level 7 (Tight budget) and level 8 (Black Friday: spike, failure and tight budget combined), and complete the starting designs for all modes on all 8 levels. Tune numbers so each level teaches its one idea and its star thresholds are reachable.

**Blocked by:** 07, 08, 10

**Status:** ready-for-agent

- [x] Levels 7 and 8 with reference designs pass the level test
- [x] All 8 levels have guided, normal and hard starting designs that fail
- [x] Each level's 3★ threshold is met by at least one known design (asserted in the level test)
- [x] Each component type is introduced with a one-line explanation the first time it appears

## Comments

**2026-11-04, implemented.** Level 7 Tight budget (flash-sale traffic, budget $230): the cache answers at $220 (3★); a medium database ($290) breaks the budget; 5 small instances fail. Level 8 Black Friday (250 → 500 req/s for 15 s, app instance 1 down at 35 s, budget $280, 3★ at $240): 7 small instances + cache pass for $240, 4 medium for $260 (2★); 3 medium or 2 large fail. Both have guided, normal and hard starting designs and a guided hint. The level test now requires every reference design to pass with all stars on seeds 1–3, and every starting design to fail. Each component type is introduced in the mission panel ("New: …") on the first level that offers it. Level 3 deliberately keeps two 3★ answers at $130 (one large instance, or three small behind a load balancer): both are good answers to "bigger or more?".
