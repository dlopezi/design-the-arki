# Spec: archi-game early access

Status: ready-for-agent

## Problem Statement

Developers preparing for system-design interviews learn the concepts (load balancing, caching, queues, redundancy) from articles and videos, but rarely get to *feel* the trade-offs: what actually breaks when traffic spikes, why a cache beats a bigger database, what it costs to survive losing a server. Practising on a whiteboard gives no feedback; the only way to learn whether a design holds up is to be told by an interviewer.

## Solution

A free, single-player browser puzzle game. Each **Level** describes a system to build, its **Traffic Profile**, **Requirements** (SLA) and **Budget**. The player builds a **Design** on a diagram canvas by placing **Components**, connecting them and tuning a few parameters, then runs a deterministic **Simulation**. The game shows requests flowing through the diagram, highlights the **Bottleneck**, explains failures with a **Hint**, and awards **Stars** for cheaper designs that still meet the SLA. Before each level the player picks a **Mode** (Guided, Normal, Hard or God) that sets how much of the design is given and how much help they get. Levels are grouped into **Chapters**; early access ships the 8 levels of chapter 1 (Core), growing to 20+ in updates.

## User Stories

### Starting and progressing

1. As a player, I want to open the game in my browser without installing anything or creating an account, so that I can start practising immediately.
2. As a player, I want to see the list of chapters and levels with my stars on each, so that I know where I am and what to replay.
3. As a player, I want each level to unlock after I pass the previous one, so that new concepts arrive in a sensible order.
4. As a player, I want my progress (unlocked levels, best stars, last design per level) saved in my browser, so that I can close the tab and continue later.
5. As a player, I want to reset my progress, so that I can start over.
6. As a returning player, I want to reopen a level with my last design restored, so that I can keep improving it.

### Choosing a mode

7. As a beginner, I want a Guided mode where the design is almost complete and hints are shown from the start, so that I can focus on the one decision the level teaches.
8. As a player, I want a Normal mode that starts from a partial design (for example clients and database already placed), so that I build the interesting part myself.
9. As an experienced player, I want a Hard mode that hands me a broken design that fails the level, so that I practise diagnosing and fixing a system like a real incident.
10. As an expert, I want a God mode with an empty canvas and no hint sentence, so that I design everything from scratch like in an interview.
11. As a player, I want my stars to depend only on cost, whatever the mode, and a badge showing the hardest mode I passed each level in, so that harder modes are recognised without splitting my progress.
12. As a new player, I want level 1 to be a step-by-step guided tutorial on the real interface, and the other modes to unlock once I pass it, so that I learn the controls before choosing a challenge.

### Understanding a level

13. As a player, I want a short brief for each level describing the system and its traffic, so that I understand what I am building.
14. As a player, I want the requirements shown as objectives (p95 latency, error rate, budget) that tick or cross after a run, so that I know exactly what "passing" means.
15. As a player, I want to see the traffic profile (base load and spikes over time), so that I can size my design for the peak, not the average.
16. As a player, I want to see the cost thresholds for 2 and 3 stars on the cost meter, so that I know how cheap my design has to be.
17. As a player, I want to know when a level includes a scripted **Failure Event** (for example "api-1 goes down at 20 s"), so that I can design for it.
18. As a player, I want each new component type introduced with a one-line explanation the first time it appears, so that I learn what it is for.

### Building a design

19. As a player, I want to add components from a hotbar (click or drag onto the canvas), so that building feels quick.
20. As a player, I want keyboard shortcuts for the hotbar (1–n) and for running the simulation, so that I can iterate fast.
21. As a player, I want to connect components by dragging from one to another, so that I decide how requests flow.
22. As a player, I want the game to tell me when my design cannot serve traffic (for example no path from clients to the database), so that I do not waste a run.
23. As a player, I want to remove components and connections, so that I can fix mistakes.
24. As a player, I want only the components allowed by the level in my hotbar, so that each level focuses on its concept.
25. As a player, I want every **Instance** of a scaled component drawn as its own node (api-1, api-2, …), so that I see the real resources I am paying for.
26. As a player, I want the diagram grouped C4-style (players as a person outside the system boundary; edge, application and data containers inside), so that it reads like a real architecture diagram.
27. As a player, I want a live monthly cost that updates as I change the design, so that I feel the trade-off before running.

### Configuring components (inspector)

28. As a player, I want to select a component and see its configuration in an inspector panel, so that I can tune it.
29. As a player, I want to change the number of instances and the instance size of an application container, with the per-instance vCPU, workers and cost shown, so that I can choose between scaling out and scaling up.
30. As a player, I want to choose a database tier and see its connections, capacity and cost, so that I can compare it with adding a cache.
31. As a player, I want to set a cache TTL and see the expected hit rate, so that I understand how TTL reduces database load.
32. As a player, I want an "Advanced" section (queue size per instance, service time, timeout, health check), so that I can explore deeper behaviour when I am ready.
33. As a player, I want the inspector to show the capacity and the cost breakdown of the selected component, so that I can reason about sizing.
34. As a player, I want to hide and show the inspector (button and key I), so that I can give the diagram more room.

### Running the simulation

35. As a player, I want to press Play and watch requests flow along the connections over a short animated playback, so that the simulation feels alive.
36. As a player, I want a clock with live requests/s, p95 and error rate during playback, so that I can see the moment things go wrong.
37. As a player, I want each instance to show its load (colour and percentage) during playback, so that I can spot saturation as it happens.
38. As a player, I want a failed instance to turn grey and stop receiving traffic, so that I see the effect of the failure event.
39. As a player, I want the same design to always give the same result, so that my changes are the only thing that changes the outcome.

### Results and learning

40. As a player, I want a report card after each run (pass/fail, stars, p95, errors, cost), so that I get a clear verdict.
41. As a player, I want the bottleneck highlighted on the diagram after a failed run, so that I know where to look.
42. As a player, I want a short hint naming the concept that would fix the failure (scale out, add a cache, add redundancy…), shown according to my mode, so that I learn instead of guessing.
43. As a player, I want "View details" on the report to open the inspector on the bottleneck, so that I can act on the hint.
44. As a player, I want a results drawer with charts of requests/s, p95 and errors over time with the SLA thresholds drawn, so that I see when and how the design failed.
45. As a player, I want load per resource (every instance, cache, database) in the results drawer, so that I can compare them.
46. As a player, I want per-instance stats in the inspector after a run (peak load, served, rejected, max queue, failure time), so that I can debug uneven load.
47. As a player, I want to hide and show the results drawer (button and key R), so that I can focus on building.
48. As a player who passed with fewer than 3 stars, I want to be told the cost I need to reach for the next star, so that I have a reason to replay.

### Early-access feedback and operations

49. As the maintainer, I want privacy-first analytics events for level started, run, level passed (with stars) and level abandoned, so that I can see where players drop off.
50. As a player, I want a visible feedback link, so that I can report confusing levels or bugs.
51. As the maintainer, I want all player-facing text in an English string catalogue, so that a Spanish translation can be added later without code changes.
52. As the maintainer, I want to add a new level by adding one JSON file with its starting designs and reference design, so that content grows without engine changes.

## Implementation Decisions

### Modules

- **Simulation engine** (pure TypeScript, no UI or browser dependencies; ADR-0001). One entry point: `simulate(level, design, seed) → result`. Deep module: it owns arrivals, queueing, routing, failure events, metrics, scoring, bottleneck detection and hints.
- **Component catalogue**: data describing every component type (parameters, sizes/tiers, workers, mean service time, cost, C4 kind and technology label, the chapter it is introduced in). Read by both the engine and the UI.
- **Level content**: one JSON file per level, validated by a schema (ADR-0002), each with a hand-written **Starting Design** per mode and a **Reference Design**.
- **Progress store**: small adapter over `localStorage` (ADR-0003) holding unlocked levels, best stars, hardest mode passed (the badge), last design per level and mode, and whether the tutorial is done. Must tolerate storage being unavailable.
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
  startingDesigns: { guided: Design; normal: Design; hard: Design };  // god = empty canvas
  referenceDesign: Design;
  tutorial?: TutorialStep[];   // level 1 only
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

Capacity and cost numbers are the prototype's calibration and may be tuned per level.

### Modes

| Mode | Starting design | Hint sentence | Bottleneck highlight |
| --- | --- | --- | --- |
| Guided | Almost complete: only the level's key piece is missing | Shown from the start and after failing | Yes |
| Normal | Partial (for example clients and database placed) | After failing | Yes |
| Hard | A broken design that fails the level | After failing | Yes |
| God | Empty canvas (clients only) | Never | Yes |

- Stars depend only on cost. Each level shows a **Badge** for the hardest mode passed.
- Level 1 is a step-by-step tutorial played in Guided mode the first time; passing it unlocks the other modes on every level.

### Early-access levels (chapter 1, Core)

All use only the prototyped components (clients, load balancer, app server, cache, database). Numbers are to be tuned while writing each level.

1. **Hello world** (tutorial): one server and a database, 50 req/s.
2. **First spike**: 300 req/s outgrows one server, so the player adds a load balancer and scales out.
3. **Bigger or more?**: cost thresholds that make the player compare scaling up (instance size) with scaling out (instances).
4. **Flash sale**: the prototype's level, where a cache beats a bigger database on cost.
5. **Popular content**: a long spike where the cache TTL decides whether the database survives.
6. **A server goes down**: a scripted instance failure that needs N+1 redundancy.
7. **Tight budget**: the flash sale with a budget that forces the cheapest design that still passes.
8. **Black Friday**: spike, failure and tight budget combined, as the chapter's final exam.

### Game screen (variant D of the UI prototype)

Canvas-first layout with floating HUD: objectives (top-left), cost meter with star thresholds (top-right), simulation clock during playback, hotbar plus Play button (bottom). Collapsible inspector (right, key I) and results drawer (bottom, key R). Report card after each run. C4-style grouping with one node per instance. The prototype's "Incident" toggle is a testing aid only: in the game, failure events come from the level.

## Testing Decisions

- Good tests exercise external behaviour only: given a level, a design and a seed, assert on the result. No tests reach into the event queue, PRNG or internal data structures.
- **Engine** (main seam, built test-first): capacity (a design under capacity passes and one over capacity is rejected at the right component), queueing (latency grows with load), failure events (lost requests, traffic shifts to alive instances, utilisation against alive capacity), cache (TTL lowers database load), bottleneck and hint selection, scoring and stars, and determinism (same seed gives an identical result, a different seed gives a close one).
- **Levels**: one generated test per level file that validates it against the schema, asserts its reference design passes through the same engine entry point, and asserts that none of its starting designs (guided, normal, hard) already passes. Optionally assert the reference design's stars, to catch cost drift.
- **UI**: a few end-to-end browser tests: complete the level 1 tutorial, open a level in a chosen mode, load the reference design, run, see the pass report, and confirm stars and badge persist after reload.
- Prior art: none in the repo yet. The prototypes' calibration scenarios (1 server fails; 3 servers bottleneck on the database; a cache passes with 3 stars; a server failure needs a 4th instance) are good first engine test cases.

## Out of Scope

- Accounts, cloud saves, payments or any backend (ADR-0003).
- Chapter 2 (async: message queues and workers). It moves to the first update after launch and will get its own logic prototype then.
- Chapters 3 (data scale: read replicas, sharding, object storage) and 4 (edge/network: CDN, API gateway, rate limiter, multi-region), and their components.
- Blocking calls and connection pools.
- A visual level editor.
- Multiplayer, leaderboards and sharing designs by link.
- Spanish translation (only the externalised string catalogue is in scope).
- Player-chosen failure injection (failure events come only from levels).

## Further Notes

- The prototypes live in `prototypes/` on this branch: `simulation-engine.prototype.html` (engine logic, free play and guided walkthroughs) and `prototypes/game-ui` (variants A–D; D is the chosen direction). Lift the engine logic, not the page shells.
- Open question for later: how the game should behave at phone width. The prototypes are desktop-first.
