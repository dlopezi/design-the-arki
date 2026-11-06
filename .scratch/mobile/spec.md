# Spec: phone and tablet

Status: ready-for-agent

## Problem Statement

The game screen is built for a desktop. On a phone (375 px wide) the mission, inspector, tutorial and results panels cover each other and the diagram can hardly be seen. On a tablet (768 px) the game works, but the diagram is very small and the tutorial covers the mission. Connecting two components needs a drag from a 12 px handle, which is very hard with a finger. Some texts talk about dragging and the Delete key. The landing, the level map and the mode picker already read well on a phone.

The owner wants the game to be **playable on a phone** in the first published version, and the tablet to look better (decided 2026-11-05).

## Solution

At widths below 700 px the game screen uses a **compact layout**:

```
┌───────────────────────────┐
│ ← Levels   Hello world $90│ top bar: back, level title, cost
├───────────────────────────┤
│   DIAGRAM                 │ pan with one finger, pinch to zoom
│   (simulation clock on    │
│    top while it runs)     │
├───────────────────────────┤
│[Mission][Inspector][Results]│ bottom sheet with tabs
│ tab content               │ (opens / closes)
├───────────────────────────┤
│ [App $40][DB $50]  [Play] │ component bar + Play
└───────────────────────────┘
```

Connecting without a drag: the Inspector gets a **"Sends requests to"** row with one button per possible target and "None". It works at every screen size and with the keyboard.

Between 700 and 1100 px the desktop layout stays, with narrower panels so the diagram has more room.

## User Stories

1. As a phone player, I want to see the diagram, the components and the Play button without panels covering them, so that I can play a level.
2. As a phone player, I want the mission, the inspector and the results in tabs of one bottom sheet that I can open and close, so that I choose what to read and still see the diagram.
3. As a phone player, I want tapping a component to select it and open the Inspector tab, so that I can change its settings at once.
4. As any player, I want to connect a component by choosing its target in the Inspector, so that I do not need a precise drag (phone, touch screen or keyboard).
5. As a phone player, I want buttons big enough for a finger and no keyboard hints I cannot use, so that the controls feel made for touch.
6. As a phone player, I want the sheet to close when I press Play and the clock to show over the diagram, so that I can watch the run.
7. As a phone player, I want the results charts one under the other and the report card to fit the screen, so that I can read why I passed or failed; "View details" opens the Inspector tab on the bottleneck.
8. As a new phone player, I want to finish the level 1 tutorial with taps, with step texts that match what I can do on a phone.
9. As a tablet player, I want panels that leave room for the diagram and a tutorial that does not cover the mission.
10. As a phone visitor, I want the landing to stop telling me the game is best on a computer, now that it works on a phone.

## Implementation Decisions

- **One `Game` component, two layouts.** A `useMediaQuery` hook (generalise `usePrefersReducedMotion` in `src/ui/App.tsx`) gives `compact = (max-width: 699px)`. Desktop (≥ 1100 px) does not change.
- **Reuse existing parts**: `Objectives`, `CostMeter`, `Inspector`, `ResultsDrawer`, `Hotbar`, `ReportCard`. Move the mission content (today inline in `Game`) into a `MissionPanel` component used by both layouts.
- **Bottom sheet**: tabs Mission / Inspector / Results, one open at a time, or closed. Opens on Mission at the start of a level. Proper tab roles (`tablist`, `tab`, `tabpanel`).
- **Diagram fit**: `fitOptions` gets compact margins so `fitView` keeps the diagram clear of the top bar, the sheet and the component bar. React Flow already pans with one finger and zooms with a pinch; nodes stay not draggable.
- **"Sends requests to"** in `Inspector`: the possible targets are the other components (never the clients, never itself). Choosing one replaces the current connection, same rule as `onConnect` in `App.tsx`; "None" removes it. Shown for every component that can forward requests.
- **Touch**: hide hotbar key numbers under `@media (hover: none)`; buttons at least 40 px in the compact layout; the hotbar scrolls sideways if it does not fit. The canvas hint has a compact text without "drag" or "Delete" (removing stays in the Inspector).
- **Tutorial**: an optional `textCompact` on tutorial steps (schema in `src/levels/levels.ts`), used in the compact layout. Level 1 step 2 gets one ("Choose the database under 'Sends requests to' in the inspector.").
- **Strings** in `src/i18n/en.ts`. Change `landing.computerNote`.

## Testing Decisions

- Existing E2E tests must pass unchanged (desktop viewport).
- New E2E with Playwright in Chromium: phone viewport 390×844 with `hasTouch` and `isMobile`, using `tap()`. Tablet at 768×1024.
- Overlap checks compare bounding boxes of the panels and controls.
- Unit test for the target list of "Sends requests to" if it lives in a pure helper.

## Out of Scope

- Phones held sideways (landscape): no layout of its own in this version.
- Dragging nodes, new gestures, sound or vibration.
- Native app or installable PWA.

## Further Notes

- Answers the open question in `.scratch/early-access/spec.md` (phone width).
- Tickets: `issues/01`–`06`. Order: 01 → 02 → 03 → 04 → 05 → 06; 02 and 06 can be done at any time.
