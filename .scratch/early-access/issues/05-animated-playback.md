# 05: Animated simulation playback

**What to build:** After pressing Play the player watches a short playback of the 60-second run: a clock with live requests/s, p95 and error rate, requests travelling along connections, and each instance coloured by its load in 5-second buckets. All values come from the engine's result; the UI computes no metrics.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Engine result includes 5-second buckets for rps, p95, error rate, and utilisation per component and per instance
- [x] Playback lasts a few seconds and can't be started again until it ends
- [x] Clock and instance colours update per bucket; dots travel along active connections
- [x] Respects prefers-reduced-motion (no travelling dots, values still update)

## Comments

**2026-11-04, implemented.** Engine (test-first): `buckets` (5 s: rps, p95, error rate by request arrival time) and per-component and per-instance `bucketUtilization`, checked against arrivals × service time / workers. UI: Play replays the level in 6 s with a clock (t, req/s, p95, errors), load bars and colours on instances and single-instance components (load balancer hidden), dots along connections (none with prefers-reduced-motion), Play disabled meanwhile, "Skip to results", report at the end. Fixed on the way: a rAF timestamp can precede the start time, which produced bucket −1 and crashed the page. E2E tests skip the playback through a helper.
