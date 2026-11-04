# 07: Cache and database tiers

**What to build:** The player can put a cache in front of the database and tune its TTL (expected hit rate shown), and choose the database tier (8/16/32 connections, $50/$150/$400). Both have inspector panels. Ships levels 4 (Flash sale: cache beats a bigger database on cost) and 5 (Popular content: TTL decides whether the database survives).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Cache is a catalogue entry built from the shortcut primitive (hit completes, miss continues); hit rate derived from TTL
- [ ] Engine tests: higher TTL lowers database load; a cache design can pass where the same design without it fails
- [ ] Inspector panels for cache (TTL, expected vs observed hit rate) and database (tier, connections, capacity, cost)
- [ ] Levels 4 and 5 pass the level test; level 4's reference design earns 3★ with a cache
