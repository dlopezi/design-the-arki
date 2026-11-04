# 06: Results drawer, bottleneck and hints

**What to build:** After a failed run the bottleneck is highlighted on the diagram and a short hint names the concept that would fix it. A results drawer shows the verdict, stars, hint, rps / p95 / error charts with SLA thresholds, and load per resource (every instance, cache, database). The inspector shows per-instance stats after a run. Inspector and drawer can be hidden (buttons and keys I and R). "View details" on the report opens the inspector on the bottleneck.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] Engine tests: bottleneck = highest pressure (queue wait + overloaded requests × timeout) only when significant; hint chosen by bottleneck type
- [ ] Bottleneck highlighted on the diagram after a failed run
- [ ] Results drawer with three charts (thresholds drawn) and load per resource
- [ ] Per-instance table in the inspector: peak load, served, rejected, max queue
- [ ] I and R toggle the panels; View details opens both and selects the bottleneck
