# 08: Scripted failure events

**What to build:** A level can script an instance failure (for example api-1 goes down at 20 s). During playback the instance turns grey, stops receiving traffic, and its queued and in-flight requests are lost. A miss caused by the failure gets a redundancy hint. Ships level 6 (A server goes down).

**Blocked by:** 05

**Status:** resolved

- [x] Engine tests: lost requests counted; traffic shifts to alive instances; utilisation measured against alive capacity (prototype finding)
- [x] Objectives panel shows the level's failure event before running
- [x] Failed instance greys out at the right moment in playback and in the results
- [x] Failure-caused miss shows the N+1 redundancy hint
- [x] Level 6 passes the level test

## Comments

**2026-11-04, implemented.** Engine (test-first): levels script `failureEvents` as `{ atS, componentType, instance }` (the first component of that type, since levels cannot know player-generated ids). A failed instance loses its queued and in-flight requests (`errors.lost`), round-robin skips it, and with nothing alive requests are `unavailable`; all four error kinds count toward the error rate. Utilisation is measured against alive capacity (mutation-checked). Instances report `killedAtS`. Level 6 A server goes down (300 req/s, app instance 1 down at 20 s): 2 instances fail, 3 pass 3★ $190, 4 pass 2★ $230 over seeds 1–3. UI: incidents listed in the mission panel, instance turns grey with a Down badge at the right moment of playback, Down in the results load list and "down at 20 s" in the inspector table, N+1 redundancy hint when a failure caused the miss.

**2026-11-05, resolved.** Implemented in 634052d ("Ticket 08: scripted failures in the game").
