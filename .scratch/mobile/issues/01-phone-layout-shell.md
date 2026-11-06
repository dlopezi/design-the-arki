# 01: Phone layout shell

**What to build:** Below 700 px wide the game screen uses the compact layout: a thin top bar (← Levels, level title, monthly cost), the diagram, a bottom sheet with tabs Mission / Inspector / Results, and a bar with the components and Play. Tapping a component selects it and opens the Inspector tab. Desktop does not change.

**Blocked by:** none

**Status:** resolved

- [x] `useMediaQuery` hook (generalise `usePrefersReducedMotion` in `src/ui/App.tsx`); `compact = (max-width: 699px)`
- [x] Mission content moved into a `MissionPanel` component, used by both layouts
- [x] Bottom sheet: `tablist` with Mission / Inspector / Results; one tab open or the sheet closed; starts on Mission
- [x] Selecting a component opens the Inspector tab
- [x] `fitOptions` uses compact margins; the diagram stays clear of the bars and the sheet
- [x] Strings in `src/i18n/en.ts`
- [x] E2E at 390×844: top bar, diagram, sheet and component bar do not overlap; switching tabs works
- [x] `npm run check` and `npm run e2e` pass; desktop E2E unchanged

## Comments

**2026-11-05, implemented.** `useMediaQuery` and `COMPACT_QUERY` in `src/ui/useMediaQuery.ts`; the mission content is `src/ui/missionPanel.tsx`. `Game` in `src/ui/App.tsx` builds each part once (canvas, mission, inspector, results, controls, overlays, report) and places them in one of two layouts; the desktop layout is unchanged. The compact layout is a flex column (`.game.compact` in `styles.css`), so the diagram has its own area and `fitView` only needs a 16 px margin. Two things found while testing: React Flow's default minimum zoom (0.5) is too large for a phone, so the compact layout allows 0.25 (players can pinch to zoom in); and the hotbar already scrolls sideways (`overflow-x: auto`), which ticket 03 can keep. The I and R keys open the sheet's tabs on a phone. While a run plays, Play and "Skip to results" squeeze the hotbar; ticket 04 handles the playback layout. E2E: `e2e/phone.spec.ts` (390×844, touch).
