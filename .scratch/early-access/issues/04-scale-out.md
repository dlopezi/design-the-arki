# 04: Scale out: load balancer and instances

**What to build:** The player adds a load balancer and scales the app container: instance count and instance size (S/M/L = 1/2/4 vCPU, 2/4/8 workers, $20/$40/$80). The diagram groups components C4-style (clients as a person outside the system boundary; edge, application and data containers) and draws every Instance as its own node. The inspector shows the app container's deployment settings, an Advanced section (queue size, service time, timeout, health check) and its capacity and cost breakdown. Ships levels 2 (First spike) and 3 (Bigger or more?).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Engine tests: round-robin over alive instances; per-instance queues; queue size parameter respected
- [ ] Load balancer is a catalogue entry with a high, hidden capacity (around 10 000 req/s)
- [ ] C4 grouping with one node per instance (api-1, api-2, …), no ×N badges
- [ ] Inspector edits instances, instance size and queue size; cost and capacity update live
- [ ] Levels 2 and 3 with reference designs pass the level test
