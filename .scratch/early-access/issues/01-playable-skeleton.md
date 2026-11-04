# 01: Playable skeleton: one level, one run

**What to build:** A player opens the game in the browser, sees level 1 (one app server and a database), presses Play and gets a pass/fail verdict with p95 and error rate. This is the tracer bullet through every layer: project setup, a technology-agnostic engine, the component catalogue, one level file with its schema, and a minimal game screen.

Build the engine around generic primitives from the start (ADR-0004): source, station (worker pool + bounded queue per instance), routing to the next hop, metrics. The catalogue describes "app server" and "database" as stations with their numbers; the engine must not mention them by name. Determinism (ADR-0001): seeded PRNG, ties broken by insertion order. See the spec's Level / Design / Result shapes (from the prototype).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Project builds and runs with one command; unit tests and a lint/type check run in CI on every push
- [ ] `simulate(level, design, seed)` is the only engine entry point and has no UI or browser dependencies
- [ ] The engine contains no component-specific names; app server and database are catalogue entries built from primitives
- [ ] Engine tests (written first): under-capacity design passes; over-capacity design rejects at the saturated station; same seed gives an identical result; a different seed gives a close one
- [ ] Level 1 is a JSON file validated by a schema; a generated test validates every level file and asserts its reference design passes
- [ ] The game screen loads level 1 with its reference design on a canvas, runs on Play and shows pass/fail, p95 and error rate
- [ ] All player-facing text comes from an English string catalogue
