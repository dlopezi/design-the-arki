# 11: Level 1 guided tutorial

**What to build:** The first time, level 1 is a step-by-step tutorial on the real interface in Guided mode: add a server, connect it, press Play, read the report. Passing it unlocks the other modes on every level.

**Blocked by:** 03, 10

**Status:** ready-for-agent

- [x] Tutorial steps highlight the relevant control and advance on the real action
- [x] Other modes are locked until the tutorial is passed
- [x] Tutorial completion is stored in progress
- [x] End-to-end test: complete the tutorial and see the modes unlock

## Comments

**2026-11-04, implemented.** Level 1 carries `tutorial` steps in its JSON (text, optional target component or the Play control, and the action that completes it: select a component type, connect two types, a run starts, the level is passed). Until `tutorialDone` is set in progress, the mode picker only offers Guided and other modes cannot be opened by link. In guided level 1 a Tutorial panel shows "Step n of 4", outlines the target, advances on the real action and ends with a completion message; Skip tutorial also unlocks every mode. Level 1 now limits the app server to one medium instance and the database to small, so the tutorial inspector stays simple. E2E specs that are not about the tutorial seed `tutorialDone`.
