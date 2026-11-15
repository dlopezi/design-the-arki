# The discrete-event engine is removed

The game no longer keeps the discrete-event engine of ADR-0001 (`src/engine/simulate.ts`, its event queue and its seeded random numbers), or the level fields only that engine read (`durationS`, `traffic`, `budget`, `starCostThresholds`, `failureEvents`). ADR-0005 moved play to the flow model in `src/realtime/` and left the old engine in place "for now". Since then five chapters were built on the flow model and nothing in the game called the engine.

We removed it because keeping it had a cost and no use. Every new level had to fill five fields that nothing read. Two screens (the campaign map and the title screen) counted a level's stars from `starCostThresholds` while the game gave stars from `play.starMoney`; the two lists only agreed because every level author kept them the same length by hand. And a reader of the code met two engines and three level types and had to learn which one was real.

We did not keep it for a "replay in detail" view (the other option ADR-0005 named). Nobody asked for that view, and the engine did not know Request Types, queues, Shards, Regions or Topics (ADR-0006 to ADR-0009), so it could not replay any level after chapter 1 without being written again. If the view is wanted one day, the engine is in the git history.

## Consequences

- A level file holds only what the game reads: its texts, `requirements`, `allowedComponents`, `componentOptions`, the `play` block, and its designs. `LevelDefinition` is `GameLevel` (what the rules read) plus the texts and designs.
- The most stars a level gives is one rule, `maxStarsOf` in `src/realtime/game.ts`, used by the game screen, the campaign map and the title screen.
- The types of the catalog and of a design (`Catalog`, `ComponentSpec`, `Design`) live in `src/catalog/types.ts`. `src/engine/` is gone.
- `designCost` (what a design costs to build, used by the level tests) lives in `src/realtime/game.ts` and uses the same price rule as the game, `instancePrice`.
- ADR-0001 is replaced. What it asked for still holds in `src/realtime/`: the rules are pure functions, deterministic, and tested without the UI.
