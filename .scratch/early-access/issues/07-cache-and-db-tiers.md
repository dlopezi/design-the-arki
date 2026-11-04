# 07: Cache and database tiers

**What to build:** The player can put a cache in front of the database and tune its TTL (expected hit rate shown), and choose the database tier (8/16/32 connections, $50/$150/$400). Both have inspector panels. Ships levels 4 (Flash sale: cache beats a bigger database on cost) and 5 (Popular content: TTL decides whether the database survives).

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Cache is a catalogue entry built from the shortcut primitive (hit completes, miss continues); hit rate derived from TTL
- [x] Engine tests: higher TTL lowers database load; a cache design can pass where the same design without it fails
- [x] Inspector panels for cache (TTL, expected vs observed hit rate) and database (tier, connections, capacity, cost)
- [x] Levels 4 and 5 pass the level test; level 4's reference design earns 3★ with a cache

## Comments

**2026-11-04, implemented.** Engine (test-first): new generic `shortcut` primitive (hit rate = value / (value + halfAt), capped; a hit completes, a miss continues); `cache` is a catalogue entry built from it (param `ttlS`, default 10 s, half at 30 s, max 95%, $30, Redis). Database tiers reuse the generic `sizes` (small/medium/large = 8/16/32 connections, $50/$150/$400, default small). Result reports each shortcut component's observed `hitRate`. A cache with nothing behind it is a dead end. Levels: `componentOptions.limits` caps numeric params (checked by the level test). Level 4 Flash sale: cache 3★ $220, medium DB 2★ $290, neither fails. Level 5 Popular content: small DB only, TTL ≤ 60 s; TTL 10 s fails, ≥ 20 s passes (3★ $260). Stable over seeds 1–3. UI: cache and tier details on nodes; inspector Configuration section with Tier picker and TTL stepper (expected hit rate), observed hit rate under Last run.
