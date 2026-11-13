# Coding standards

Read during review, not while implementing. Only judgement calls live here: mechanical rules are checks (`npm run check`, `src/glossary.test.ts`, CI).

## Accepted patterns

Do not flag these; extend them.

- **The hint cascade in `PlayScreen`**: a new lost-level hint is one more branch, placed by how specific its cause is.
- **`autoLink` in `game.ts`**: one branch per building type decides its default wiring.
- **`mixShort` and `shardKeyNames` in the i18n files**: one label map per language.
- **Registering a building** touches the catalog, `componentArt`, the i18n names and intros, the Manual card and the card order in `PlayScreen`. Tests enforce part of that list; the rest is by hand.

## Rules

- **Behaviour comes from catalog fields** (`accepts`, `prefers`, `effort`, `shardable`, ...), not from building names, in `flow.ts` (ADR-0004). `game.ts` wiring may name types.
- **Names for shared values**: a Request Type is a constant in `catalog.ts` (`READ_YOUR_WRITES`, `UPLOAD`); a threshold the engine and the UI both use is one exported constant (`FULL_LOAD`, `ROOMY_LOAD`).
- **Level numbers in text**: when a level is tuned, re-read the numbers in its `brief` and `guidedHint`, English and Spanish.
- **Tests play levels** through the game rules (ADR-0005). A direct test is for a pure helper only (`hotShardOf`). A test that only re-reads level data is not a test.
- **Tests derive totals** from the level files (`maxStars` in `e2e/helpers.ts`), never a typed number.
- **Spanish**: glossary terms stay in English (Worker, Backlog, Read Replica, Shard); Shard is feminine ("una Hot Shard").
