# Real-time play with a flow model

Levels are now played in real time, like a strategy game: a 30-second build phase, then one wave of users; money grows by itself and with every answered request, buildings cost maintenance and take seconds to build, and reputation falls while the base is slow or failing. The design changes while the wave runs, so the result of a level can no longer come from one simulation of a fixed design.

Each tenth of a second, `src/realtime/flow.ts` sends the wave's requests per second along the player's connections: every component serves up to `workers × 1000 / meanServiceMs` requests per second per instance (from the catalog, so the model stays technology-agnostic, ADR-0004), drops the rest, and adds latency that grows as it fills (`meanServiceMs / (1 − load) × 1.4`, along the slowest busy path). Behind a load balancer every serving instance works; reached directly, only the first one does. `src/realtime/game.ts` holds the rules (phases, money, reputation, building, connections) as pure functions, tested without the UI.

We chose this capacity model over re-running the discrete-event engine (ADR-0001) whenever the design changes, because the player tested and approved the feel of the flow model in `prototypes/rts-loop.prototype.html`, it gives the per-connection traffic the map needs to draw requests, and it stays deterministic: the same actions at the same times always give the same game.

## Consequences

- The discrete-event engine (`src/engine/simulate.ts`) and the level fields it reads (`traffic`, `durationS`, `budget`, `starCostThresholds`, `failureEvents`) are no longer used by the game. They stay for now; removing them, or bringing the engine back for a "replay in detail" view, is a later decision.
- Each level's `play` block sets the starting money, the wave, an optional incident and the money for each extra star. Level tests play every reference design in real time: it must last the wave with 2 stars, and earn all 3 when the users are called early; every starting design, left unchanged, must lose.
- Running out of money also loses the level (maintenance can no longer be paid), in the build phase too.
- Load is capped at 97% in the latency formula and the p95 at 2,000 ms, so a full component is very slow rather than infinitely slow.
- The latency is an estimate, not a measured percentile: the numbers teach the shape of queueing (a component near full gets slow) rather than exact values.
