# 06: Tablet layout

**What to build:** Between 700 and 1100 px the desktop layout stays, but leaves more room for the diagram: narrower mission and inspector, a tutorial that does not cover the mission, and a results drawer in two rows.

**Blocked by:** none

**Status:** resolved

- [x] Media query for 700–1099 px: ~~narrower mission and inspector panels~~ one side panel with Mission / Inspector tabs (see comment)
- [x] Tutorial card placed so it does not cover the mission or the cost meter
- [x] Results drawer grid wraps to two rows; nothing cut off
- [x] `fitOptions` margins match the side panel
- [x] E2E at 768×1024: mission, tutorial, cost meter, inspector and controls do not overlap
- [x] `npm run check` and `npm run e2e` pass; desktop (≥ 1100 px) unchanged

## Comments

**2026-11-05, implemented.** Measured first: at 768×1024 the wide layout left the diagram at React Flow's minimum zoom (0.5) with the mission panel over it, and narrower panels (240 px each) would have left about 250 px. With the owner's OK (sketch in the session) the medium layout (`MEDIUM_QUERY`, 700–1099 px) became: one side panel on the left with the level title, Mission / Inspector tabs and the tab content; the cost and a Results toggle top right; the results drawer at the bottom, in two rows when the screen is at least 900 px tall (`TALL_QUERY`), else one row as on desktop; the controls centred in the free area; the tutorial, clock and design problems in a stack below the cost. Selecting a component opens the Inspector tab; I switches tabs, R toggles the results; during a run Skip replaces the hotbar, as on a phone. Fitting: React Flow's `fitView` centres on the whole screen and only shifts to respect the margins, so with these very uneven margins the diagram sat low. `viewportInArea` (`src/ui/fit.ts`, unit-tested) centres it in the free area instead; it is used only in the medium layout, so desktop keeps `fitView`. Result at 768×1024: zoom about 0.55 with nothing covered (it was 0.5, partly covered). E2E: `e2e/tablet.spec.ts` (portrait and landscape: no overlaps, components clear of every panel, tabs, I/R keys, two-row results, tutorial card).
