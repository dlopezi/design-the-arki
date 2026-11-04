# 06: Results drawer, bottleneck and hints

**What to build:** After a failed run the bottleneck is highlighted on the diagram and a short hint names the concept that would fix it. A results drawer shows the verdict, stars, hint, rps / p95 / error charts with SLA thresholds, and load per resource (every instance, cache, database). The inspector shows per-instance stats after a run. Inspector and drawer can be hidden (buttons and keys I and R). "View details" on the report opens the inspector on the bottleneck.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [x] Engine tests: bottleneck = highest pressure (queue wait + overloaded requests × timeout) only when significant; hint chosen by bottleneck type
- [x] Bottleneck highlighted on the diagram after a failed run
- [x] Results drawer with three charts (thresholds drawn) and load per resource
- [x] Per-instance table in the inspector: peak load, served, rejected, max queue
- [x] I and R toggle the panels; View details opens both and selects the bottleneck

## Comments

**2026-11-04, implemented.** Engine (test-first): `bottleneck` = component with the highest pressure (queue wait + a full timeout per rejected or timed-out request) when it adds at least 2 ms per request on average, else null; per-component `peakUtilization`, `avgWaitMs`, `maxQueue` and per-instance `served`, `rejected`, `maxQueue`, `peakUtilization`. The engine returns the bottleneck component only; the UI picks the hint text by component type (`hints` in the string catalogue), which keeps the engine free of player-facing text. UI: bottleneck badge and red outline after a failed run, hint in the report and the results drawer, charts for req/s, p95 and error rate with the level's limits (they grow during playback), peak load per resource (load balancer hidden), last-run table per instance in the inspector, I/R and buttons to toggle panels, "View details" reopens both on the bottleneck.
