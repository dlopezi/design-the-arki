# 01: Playable skeleton: one level, one run

**What to build:** A player opens the game in the browser, sees level 1 (one app server and a database), presses Play and gets a pass/fail verdict with p95 and error rate. This is the tracer bullet through every layer: project setup, a technology-agnostic engine, the component catalogue, one level file with its schema, and a minimal game screen.

Build the engine around generic primitives from the start (ADR-0004): source, station (worker pool + bounded queue per instance), routing to the next hop, metrics. The catalogue describes "app server" and "database" as stations with their numbers; the engine must not mention them by name. Determinism (ADR-0001): seeded PRNG, ties broken by insertion order. See the spec's Level / Design / Result shapes (from the prototype).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Project builds and runs with one command; unit tests and a lint/type check run in CI on every push
- [x] `simulate(level, design, seed)` is the only engine entry point and has no UI or browser dependencies
- [x] The engine contains no component-specific names; app server and database are catalogue entries built from primitives
- [x] Engine tests (written first): under-capacity design passes; over-capacity design rejects at the saturated station; same seed gives an identical result; a different seed gives a close one
- [x] Level 1 is a JSON file validated by a schema; a generated test validates every level file and asserts its reference design passes
- [x] The game screen loads level 1 with its reference design on a canvas, runs on Play and shows pass/fail, p95 and error rate
- [x] All player-facing text comes from an English string catalogue

## Comments

**2026-11-04, implemented.** Engine (`simulate`) built test-first with generic station primitives; app server and database are catalogue entries. Level 1 file + schema + generated level test; minimal game screen; Playwright E2E; GitHub Actions CI (typecheck, unit tests, E2E). Engine tests written after an implementation that already existed (rejection, latency, determinism) were mutation-checked: each fails when the behaviour it covers is broken.

**2026-11-05, resolved.** Implemented in 2cb769b ("Ticket 01: playable skeleton").
