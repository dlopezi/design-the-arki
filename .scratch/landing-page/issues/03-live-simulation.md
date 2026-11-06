# 03: Live mini simulation in the hero

**What to build:** The landing's hero is a tiny playable simulation using the real engine. The visitor moves a traffic slider (50–700 req/s) and adds or removes app servers (1–4; a load balancer appears with more than one). The diagram colours each instance by its load and shows requests moving; a verdict says whether the system holds, with p95, errors and monthly cost, and a one-line tip ("Add an app server to share the load").

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Pure landing model (TDD): inputs → `Level` + `Design` from level 2's components → `simulate` → p95, errors, cost, per-instance load, pass/fail against level 2's requirements
- [x] Known cases tested: 300 req/s with 1 instance fails; with 2 instances passes; cost includes the load balancer
- [x] Fast enough to follow the slider without lag (short run if needed)
- [x] SVG diagram in the game's C4 look; load colours use the game's thresholds; no moving dots with reduced motion
- [x] Slider and buttons usable by keyboard; the verdict is announced (`aria-live`)
- [x] E2E: raise traffic → overloaded; add an instance → holds

## Comments

**2026-11-05, implemented.** Model in `src/landing/demo.ts` (TDD, `demo.test.ts`): builds the design (a load balancer appears above one instance) and a one-off level, runs `simulate` with seed 1 and returns pass/fail, p95, errors, cost, per-instance peak load and the bottleneck type. Two choices differ from the spec, both measured with the engine: the run is **10 s** (at most ~15 ms per change; 60 s took up to ~100 ms), and the database is **medium** (the small one serves ~400 req/s, so from 400 req/s no number of app servers could fix it; with medium every step up to 700 req/s passes with 4 instances, which a test checks). The SVG diagram colours instances with the game's load thresholds (`loadLevel`), the verdict is a `role="status"`, and the dots are hidden under reduced motion. E2E covers overload → add an instance → holds → 700 req/s overloads again.
