# 05: Tutorial on phone

**What to build:** A new player can finish the level 1 tutorial on a phone with taps. The tutorial card sits where it covers neither the top bar nor the sheet, and each step's text matches what the player can do on a phone.

**Blocked by:** 01, 02

**Status:** resolved

- [x] Optional `textCompact` on tutorial steps (schema in `src/levels/levels.ts`); used in the compact layout, else `text`
- [x] Level 1 step 2 gets a compact text that points to "Sends requests to" in the Inspector
- [x] On the connect step, the "Sends requests to" control is the highlighted target in the compact layout
- [x] Tutorial card does not overlap the top bar, the sheet or the component bar
- [x] E2E at 390×844 with `tap()`: finish the tutorial and see every mode unlocked
- [x] `npm run check` and `npm run e2e` pass

## Comments

**2026-11-05, implemented.** `textCompact` is an optional field of a tutorial step (`src/levels/levels.ts`, schema and type); level 1 step 2 has one that points to "Sends requests to". On a phone, `Game` shows `textCompact` when it exists, and the connect step outlines the "Sends requests to" choice of the step's source component (the database node keeps its outline too). Placement: a first try put the card over the top of the diagram, but it hid part of it. The card now sits in the page flow between the top bar and the diagram area, so the diagram shrinks and refits below it (the fit also reruns when the step changes). The clock and design problems stack at the top of the diagram area (`.overlay-stack`). E2E: `e2e/phone.spec.ts` finishes the tutorial with taps at 390×844 and checks the card covers neither bar, the diagram nor the sheet.
