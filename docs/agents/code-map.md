# Code map: where things go

Navigation for the jobs that touch many files. Tests enforce part of each list; the rest is by hand.

## Add a building

1. `src/catalog/catalog.ts`: the entry. Behaviour comes from its fields (`accepts`, `prefers`, `effort`, ...); a new field is declared in `src/engine/types.ts`. A new Request Type is a named constant there.
2. `src/realtime/flow.ts` reads the fields; `src/realtime/game.ts` holds the rules: `linkProblem` (refusals), `autoLink` (default wiring), `buildProblem`.
3. `src/ui/componentArt.tsx`: a colour and a drawing (a test needs both).
4. `src/i18n/en.ts` and `es.ts`: `componentTypes`, `componentIntros`, `hints`, `archive.buildings.<type>` (the Manual card, a test needs it), `rt.refusal` for a new refusal, and `mixShort` for a new Request Type.
5. `src/ui/play/PlayScreen.tsx`: `ORDER` (card order) and, if it can cause a loss, a branch in the hint cascade.
6. Rule tests in `src/realtime/game.test.ts`.

## Add a level

1. `src/levels/NN-slug.json`, validated by `src/levels/levels.ts`; its chapter name in `chaptersEs` and its Spanish text in `levelTextEs` (`src/levels/text.es.ts`).
2. Tune it: `LEVEL=<id> npm run level-report` prints the numbers for `starMoney` and checks the starting designs lose.
3. Add the id to the ordered list in `src/levels/levels.test.ts`. `winnable.test.ts` plays the Reference Design from every mode by itself.
4. One browser test in `e2e/<chapter>.spec.ts` (helpers: `openLevel`, `maxStars` in `e2e/helpers.ts`).

## Check it in the browser

Run `npm run dev`. To open any level, set the progress in the page's console, with the level ids being the file names in `src/levels/`:

```js
localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, mode: 'guided',
  levels: Object.fromEntries(['01-hello-world' /* , ...every level before the one you open */].map(id => [id, { bestStars: 1 }])) }));
location.hash = '#<level-id>/guided'; location.reload();
```
