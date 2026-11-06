# 04: Playback and results on phone

**What to build:** In the compact layout, pressing Play closes the sheet so the run can be watched, with the clock (time, req/s, p95, errors) over the diagram. The Results tab shows the verdict, hint and charts one under the other. The report card fits the screen, and "View details" opens the Inspector tab on the bottleneck.

**Blocked by:** 01

**Status:** resolved

- [x] Play closes the sheet; the clock is visible and does not cover the top bar
- [x] Results tab: verdict, stars, hint, charts stacked, load per resource; scrolls inside the sheet
- [x] Report card fits at 390×844 with every button reachable
- [x] "View details" opens the Inspector tab with the bottleneck selected
- [x] Design problems (`.problem` alert) visible above the component bar
- [x] E2E at 390×844: fail a level, read the hint in Results, open details on the bottleneck
- [x] `npm run check` and `npm run e2e` pass

## Comments

**2026-11-05, implemented.** In `Game` (`src/ui/App.tsx`), a run that starts closes the sheet in the compact layout (a design problem does not, so the mission stays readable). A new `finishRun` (used by the end of playback and by Skip) shows the report and, on a phone, opens the Results tab behind it; "View details" then switches to the Inspector tab on the bottleneck. While a run plays on a phone, "Skip to results" takes the hotbar's place in the bottom bar (the hotbar would cancel the run anyway). The clock and design problems were already inside the diagram area since ticket 01. The report card gets a little less padding and its backdrop scrolls if a card is ever taller than the screen. The Results tab already stacked the charts (ticket 01). E2E: four new tests in `e2e/phone.spec.ts`, using level 2 Hard with one instance as a failing design.
