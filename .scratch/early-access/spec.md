# Spec: archi-game early access

Status: ready-for-agent

## Problem Statement

Developers preparing for system-design interviews learn the concepts (load balancing, caching, queues, redundancy) from articles and videos, but rarely get to *feel* the trade-offs: what actually breaks when traffic spikes, why a cache beats a bigger database, what it costs to survive losing a server. Practising on a whiteboard gives no feedback; the only way to learn whether a design holds up is to be told by an interviewer.

## Solution

A free, single-player browser puzzle game. Each **Level** describes a system to build, its **Traffic Profile**, **Requirements** (SLA) and **Budget**. The player builds a **Design** on a diagram canvas by placing **Components**, connecting them and tuning a few parameters, then runs a deterministic **Simulation**. The game shows requests flowing through the diagram, highlights the **Bottleneck**, explains failures with a **Hint**, and awards **Stars** for cheaper designs that still meet the SLA. Levels are grouped into **Chapters**; early access ships about 8 levels, growing to 20+ in updates.

## User Stories

### Starting and progressing

1. As a player, I want to open the game in my browser without installing anything or creating an account, so that I can start practising immediately.
2. As a player, I want to see the list of chapters and levels with my stars on each, so that I know where I am and what to replay.
3. As a player, I want each level to unlock after I pass the previous one, so that new concepts arrive in a sensible order.
4. As a player, I want my progress (unlocked levels, best stars, last design per level) saved in my browser, so that I can close the tab and continue later.
5. As a player, I want to reset my progress, so that I can start over.
6. As a returning player, I want to reopen a level with my last design restored, so that I can keep improving it.

### Understanding a level

7. As a player, I want a short brief for each level describing the system and its traffic, so that I understand what I am building.
8. As a player, I want the requirements shown as objectives (p95 latency, error rate, budget) that tick or cross after a run, so that I know exactly what "passing" means.
9. As a player, I want to see the traffic profile (base load and spikes over time), so that I can size my design for the peak, not the average.
10. As a player, I want to see the cost thresholds for 2 and 3 stars on the cost meter, so that I know how cheap my design has to be.
11. As a player, I want to know when a level includes a scripted **Failure Event** (for example "api-1 goes down at 20 s"), so that I can design for it.
12. As a player, I want each new component type introduced with a one-line explanation the first time it appears, so that I learn what it is for.

### Building a design

13. As a player, I want to add components from a hotbar (click or drag onto the canvas), so that building feels quick.
14. As a player, I want keyboard shortcuts for the hotbar (1–n) and for running the simulation, so that I can iterate fast.
15. As a player, I want to connect components by dragging from one to another, so that I decide how requests flow.
16. As a player, I want the game to tell me when my design cannot serve traffic (for example no path from clients to the database), so that I do not waste a run.
17. As a player, I want to remove components and connections, so that I can fix mistakes.
18. As a player, I want only the components allowed by the level in my hotbar, so that each level focuses on its concept.
19. As a player, I want every **Instance** of a scaled component drawn as its own node (api-1, api-2, …), so that I see the real resources I am paying for.
20. As a player, I want the diagram grouped C4-style (players as a person outside the system boundary; edge, application and data containers inside), so that it reads like a real architecture diagram.
21. As a player, I want a live monthly cost that updates as I change the design, so that I feel the trade-off before running.

### Configuring components (inspector)

22. As a player, I want to select a component and see its configuration in an inspector panel, so that I can tune it.
23. As a player, I want to change the number of instances and the instance size of an application container, with the per-instance vCPU, workers and cost shown, so that I can choose between scaling out and scaling up.
24. As a player, I want to choose a database tier and see its connections, capacity and cost, so that I can compare it with adding a cache.
25. As a player, I want to set a cache TTL and see the expected hit rate, so that I understand how TTL reduces database load.
26. As a player, I want an "Advanced" section (queue size per instance, service time, timeout, health check), so that I can explore deeper behaviour when I am ready.
27. As a player, I want the inspector to show the capacity and the cost breakdown of the selected component, so that I can reason about sizing.
28. As a player, I want to hide and show the inspector (button and key I), so that I can give the diagram more room.

### Running the simulation

29. As a player, I want to press Play and watch requests flow along the connections over a short animated playback, so that the simulation feels alive.
30. As a player, I want a clock with live requests/s, p95 and error rate during playback, so that I can see the moment things go wrong.
31. As a player, I want each instance to show its load (colour and percentage) during playback, so that I can spot saturation as it happens.
32. As a player, I want a failed instance to turn grey and stop receiving traffic, so that I see the effect of the failure event.
33. As a player, I want the same design to always give the same result, so that my changes are the only thing that changes the outcome.

### Results and learning

34. As a player, I want a report card after each run (pass/fail, stars, p95, errors, cost), so that I get a clear verdict.
35. As a player, I want the bottleneck highlighted on the diagram after a failed run, so that I know where to look.
36. As a player, I want a short hint naming the concept that would fix the failure (scale out, add a cache, add redundancy…), so that I learn instead of guessing.
37. As a player, I want "View details" on the report to open the inspector on the bottleneck, so that I can act on the hint.
38. As a player, I want a results drawer with charts of requests/s, p95 and errors over time with the SLA thresholds drawn, so that I see when and how the design failed.
39. As a player, I want load per resource (every instance, cache, database) in the results drawer, so that I can compare them.
40. As a player, I want per-instance stats in the inspector after a run (peak load, served, rejected, max queue, failure time), so that I can debug uneven load.
41. As a player, I want to hide and show the results drawer (button and key R), so that I can focus on building.
42. As a player who passed with fewer than 3 stars, I want to be told the cost I need to reach for the next star, so that I have a reason to replay.

### Early-access feedback and operations

43. As the maintainer, I want privacy-first analytics events for level started, run, level passed (with stars) and level abandoned, so that I can see where players drop off.
44. As a player, I want a visible feedback link, so that I can report confusing levels or bugs.
45. As the maintainer, I want all player-facing text in an English string catalogue, so that a Spanish translation can be added later without code changes.
46. As the maintainer, I want to add a new level by adding one JSON file plus its reference design, so that content grows without engine changes.

## Implementation Decisions

### Modules

- **Simulation engine** (pure TypeScript, no UI or browser dependencies; ADR-0001). One entry point: `simulate(level, design, seed) → result`. Deep module: it owns arrivals, queueing, routing, failure events, metrics, scoring, bottleneck detection and hints.
- **Component catalogue**: data describing every component type (parameters, sizes/tiers, workers, mean service time, cost, C4 kind and technology label, the chapter it is introduced in). Read by both the engine and the UI.
- **Level content**: one JSON file per level, validated by a schema (ADR-0002), each with a **Reference Design**.
- **Progress store**: small adapter over `localStorage` (ADR-0003) holding unlocked levels, best stars and last design per level. Must tolerate storage being unavailable.
- **Game UI** (React + React Flow): level select, game screen, report card. Builds the C4 diagram from the design and renders playback from the engine result; it never computes metrics itself.
- **Analytics**: thin wrapper around a cookieless provider (Plausible or Umami); no-op when blocked.

### Engine model (validated in `prototypes/simulation-engine.prototype.html` and `prototypes/game-ui`)

- Discrete-event simulation, seeded PRNG, Poisson arrivals per traffic segment, exponentially distributed service times. Ties in the event queue are broken by insertion order so results are deterministic.
- Each component instance is a pool of workers with a bounded FIFO queue. Arrivals beyond the queue are **rejected**; requests older than the timeout when they reach a worker are **timed out**; requests queued or in service on an instance that fails are **lost**.
- The load balancer distributes round-robin over **alive** instances; health checks are instantaneous in early access.
- Chapter 1 uses non-blocking calls: an application instance frees its worker before calling the database. Blocking calls (connection pools) are a later chapter's concept.
- The load balancer has a realistic but high capacity (around 10 000 req/s) and its capacity and load are not shown in chapters 1–2.
- Cache hit rate is derived from TTL; a hit completes the request, a miss continues to the next component.
- Metrics are aggregated into 5-second buckets for charts and playback: requests/s, p95, error rate, and utilisation per component and per instance.
- Utilisation must be computed against the capacity that is alive at the time (prototype finding: after a failure it was computed against the original capacity and under-reported saturation).
- **Bottleneck** = component with the highest pressure (total queue wait + overloaded requests × timeout), only when that pressure is significant. Hints are chosen by bottleneck type, or by failure-related errors when a failure event caused the miss.
- Pass = every requirement met (p95, error rate, cost ≤ budget). Stars = 1 for passing, +1 per cost threshold met.

Shapes from the prototype, trimmed:

```ts
type Level = {
  id: string; chapter: string; title: string; brief: string;
  durationS: number;
  traffic: { fromS: number; toS: number; rps: number }[];
  requirements: { p95Ms: number; maxErrorRate: number };
  budget: number; starCostThresholds: number[];   // e.g. [300, 230]
  allowedComponents: ComponentType[];
  failureEvents: { atS: number; componentId: string; instance: number }[];
  referenceDesign: Design;
};

type Design = {
  components: { id: string; type: ComponentType; params: Record<string, unknown> }[];
  connections: [from: string, to: string][];    // 'client' is the implicit entry point
};

type Result = {
  passed: boolean; stars: number; cost: number;
  p50: number; p95: number; p99: number; errorRate: number;
  errors: { rejected: number; timedOut: number; lost: number; unavailable: number };
  checks: { name: string; target: string; actual: string; ok: boolean }[];
  buckets: { fromS: number; rps: number; p95: number; errorRate: number }[];
  components: { id: string; type: ComponentType; utilization: number; peakUtilization: number;
    bucketUtilization: number[]; avgWaitMs: number; maxQueue: number; rejected: number; timedOut: number;
    hitRate: number | null;
    instances: { index: number; served: number; rejected: number; maxQueue: number;
      killedAtS: number | null; peakUtilization: number; bucketUtilization: number[] }[] }[];
  bottleneck: string | null; hint: string | null;
};
```

### Component catalogue for early access

| Component | Player parameters | Notes |
| --- | --- | --- |
| Clients (C4 person) | none | Source of the traffic profile |
| Load balancer | none | Round-robin over alive instances |
| App server | instances, instance size (S/M/L = 1/2/4 vCPU, 2/4/8 workers, $20/$40/$80 per instance); advanced: queue size | Mean service time 20 ms |
| Cache | TTL | Hit rate grows with TTL; $30 |
| Database | tier (small/medium/large = 8/16/32 connections, $50/$150/$400) | Mean query time 20 ms |
| Message queue + workers | queue on/off, worker instances | Chapter 2; not yet prototyped |

Capacity and cost numbers are the prototype's calibration and may be tuned per level.

### Early-access levels (proposal, to be tuned)

Chapter 1, Core: (1) single server and database, low traffic; (2) traffic outgrows one server, so add a load balancer and scale out; (3) the flash sale used in the prototypes, where cache beats a bigger database on cost; (4) the same with a scripted server failure (N+1 redundancy); (5) cache TTL trade-off under a long spike.
Chapter 2, Async: (6) a slow write path that should go through a queue; (7) sizing workers to drain a queue backlog; (8) a spike absorbed by the queue within the SLA.

### Game screen (variant D of the UI prototype)

Canvas-first layout with floating HUD: objectives (top-left), cost meter with star thresholds (top-right), simulation clock during playback, hotbar plus Play button (bottom). Collapsible inspector (right, key I) and results drawer (bottom, key R). Report card after each run. C4-style grouping with one node per instance. The prototype's "Incident" toggle is a testing aid only: in the game, failure events come from the level.

## Testing Decisions

- Good tests exercise external behaviour only: given a level, a design and a seed, assert on the result. No tests reach into the event queue, PRNG or internal data structures.
- **Engine** (main seam, built test-first): capacity (a design under capacity passes and one over capacity is rejected at the right component), queueing (latency grows with load), failure events (lost requests, traffic shifts to alive instances, utilisation against alive capacity), cache (TTL lowers database load), bottleneck and hint selection, scoring and stars, and determinism (same seed gives an identical result, a different seed gives a close one).
- **Levels**: one generated test per level file that validates it against the schema and asserts its reference design passes through the same engine entry point. Optionally assert the reference design's stars, to catch cost drift.
- **UI**: a few end-to-end browser tests: open a level, build or load the reference design, run, see the pass report, and confirm the stars persist after reload.
- Prior art: none in the repo yet. The prototypes' calibration scenarios (1 server fails; 3 servers bottleneck on the database; a cache passes with 3 stars; a server failure needs a 4th instance) are good first engine test cases.

## Out of Scope

- Accounts, cloud saves, payments or any backend (ADR-0003).
- Chapters 3 (data scale: read replicas, sharding, object storage) and 4 (edge/network: CDN, API gateway, rate limiter, multi-region), and their components.
- Blocking calls and connection pools.
- A visual level editor.
- Multiplayer, leaderboards and sharing designs by link.
- Spanish translation (only the externalised string catalogue is in scope).
- Player-chosen failure injection (failure events come only from levels).

## Further Notes

- The prototypes live in `prototypes/` on this branch: `simulation-engine.prototype.html` (engine logic, free play and guided walkthroughs) and `prototypes/game-ui` (variants A–D; D is the chosen direction). Lift the engine logic, not the page shells.
- Open question for later: how the game should behave at phone width. The prototypes are desktop-first.
- Async (chapter 2) engine behaviour was not prototyped. It may deserve a quick logic prototype before its levels are written.
