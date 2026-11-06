# 03: Live mini simulation in the hero

**What to build:** The landing's hero is a tiny playable simulation using the real engine. The visitor moves a traffic slider (50–700 req/s) and adds or removes app servers (1–4; a load balancer appears with more than one). The diagram colours each instance by its load and shows requests moving; a verdict says whether the system holds, with p95, errors and monthly cost, and a one-line tip ("Add an app server to share the load").

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Pure landing model (TDD): inputs → `Level` + `Design` from level 2's components → `simulate` → p95, errors, cost, per-instance load, pass/fail against level 2's requirements
- [ ] Known cases tested: 300 req/s with 1 instance fails; with 2 instances passes; cost includes the load balancer
- [ ] Fast enough to follow the slider without lag (short run if needed)
- [ ] SVG diagram in the game's C4 look; load colours use the game's thresholds; no moving dots with reduced motion
- [ ] Slider and buttons usable by keyboard; the verdict is announced (`aria-live`)
- [ ] E2E: raise traffic → overloaded; add an instance → holds
