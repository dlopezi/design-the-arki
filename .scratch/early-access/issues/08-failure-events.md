# 08: Scripted failure events

**What to build:** A level can script an instance failure (for example api-1 goes down at 20 s). During playback the instance turns grey, stops receiving traffic, and its queued and in-flight requests are lost. A miss caused by the failure gets a redundancy hint. Ships level 6 (A server goes down).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Engine tests: lost requests counted; traffic shifts to alive instances; utilisation measured against alive capacity (prototype finding)
- [ ] Objectives panel shows the level's failure event before running
- [ ] Failed instance greys out at the right moment in playback and in the results
- [ ] Failure-caused miss shows the N+1 redundancy hint
- [ ] Level 6 passes the level test
