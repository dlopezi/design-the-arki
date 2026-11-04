# 05: Animated simulation playback

**What to build:** After pressing Play the player watches a short playback of the 60-second run: a clock with live requests/s, p95 and error rate, requests travelling along connections, and each instance coloured by its load in 5-second buckets. All values come from the engine's result; the UI computes no metrics.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Engine result includes 5-second buckets for rps, p95, error rate, and utilisation per component and per instance
- [ ] Playback lasts a few seconds and can't be started again until it ends
- [ ] Clock and instance colours update per bucket; dots travel along active connections
- [ ] Respects prefers-reduced-motion (no travelling dots, values still update)
