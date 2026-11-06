# 05: Tutorial on phone

**What to build:** A new player can finish the level 1 tutorial on a phone with taps. The tutorial card sits where it covers neither the top bar nor the sheet, and each step's text matches what the player can do on a phone.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Optional `textCompact` on tutorial steps (schema in `src/levels/levels.ts`); used in the compact layout, else `text`
- [ ] Level 1 step 2 gets a compact text that points to "Sends requests to" in the Inspector
- [ ] On the connect step, the "Sends requests to" control is the highlighted target in the compact layout
- [ ] Tutorial card does not overlap the top bar, the sheet or the component bar
- [ ] E2E at 390×844 with `tap()`: finish the tutorial and see every mode unlocked
- [ ] `npm run check` and `npm run e2e` pass
