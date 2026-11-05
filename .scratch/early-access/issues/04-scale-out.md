# 04: Scale out: load balancer and instances

**What to build:** The player adds a load balancer and scales the app container: instance count and instance size (S/M/L = 1/2/4 vCPU, 2/4/8 workers, $20/$40/$80). The diagram groups components C4-style (clients as a person outside the system boundary; edge, application and data containers) and draws every Instance as its own node. The inspector shows the app container's deployment settings, an Advanced section (queue size, service time, timeout, health check) and its capacity and cost breakdown. Ships levels 2 (First spike) and 3 (Bigger or more?).

**Blocked by:** 03

**Status:** resolved

- [x] Engine tests: round-robin over alive instances; per-instance queues; queue size parameter respected
- [x] Load balancer is a catalogue entry with a high, hidden capacity (around 10 000 req/s)
- [x] C4 grouping with one node per instance (api-1, api-2, …), no ×N badges
- [x] Inspector edits instances, instance size and queue size; cost and capacity update live
- [x] Levels 2 and 3 with reference designs pass the level test

## Comments

**2026-11-04, implemented.** Engine (test-first): stations run N instances with round-robin, per-instance queues and a `queueSize` param; catalogue `sizes` (S/M/L = 2/4/8 workers, $20/$40/$80) override workers and cost; cost counts every instance; a component with several instances must be fed by a component that `distributes` (else `needsBalancer`). Load balancer is a catalogue entry (~10 000 req/s, capacity hidden). Levels gain `componentOptions` (allowed sizes, max instances), checked by the level test. Levels 2 (First spike: only medium instances, needs LB + 2) and 3 (Bigger or more?: one large instance or 3 small behind an LB both give 3★ at $130; revisit in ticket 12). UI: design is now the state and the diagram is laid out automatically as C4 boundaries (person, system, edge/application/data containers) with one node per instance; inspector for instances, size, queue size, service time, timeout, health check, capacity and cost; `#<level id>` picks a level until ticket 09.

**2026-11-05, resolved.** Implemented in 9151227 ("Ticket 04: scale out with a load balancer and instances").
