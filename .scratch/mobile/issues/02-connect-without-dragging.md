# 02: Connect without dragging

**What to build:** The Inspector shows a "Sends requests to" row for the selected component, with one button per possible target and "None". Choosing a target connects the two components and replaces any previous connection from it; "None" removes the connection. Works at every screen size and with the keyboard.

**Blocked by:** none

**Status:** resolved

- [x] Targets: the other components in the design, never the clients and never the component itself
- [x] Same rule as `onConnect` in `src/ui/App.tsx`: one outgoing connection per component
- [x] The current target is shown as selected (`aria-pressed` or a radio group)
- [x] Strings in `src/i18n/en.ts`
- [x] Unit test for the target list if it lives in a pure helper
- [x] E2E (desktop): connect app server → database from the Inspector and pass level 1; "None" removes the connection
- [x] `npm run check` and `npm run e2e` pass

## Comments

**2026-11-05, implemented.** Pure helpers in `src/ui/connections.ts` (unit tests in `connections.test.ts`): `connectionTargets`, `targetOf`, `withConnection` (also used by the drag `onConnect` now, so both ways follow one rule) and `forwardsRequests`. The Inspector shows "Sends requests to" as a radio group (same look as the size picker), right under the title; a database ends requests, so it has no such row. The clients needed it too, or a phone player could not start a design in Normal or God mode: tapping Clients now selects it (blue outline) and shows a small `ClientsInspector` with only this row. When a type appears twice (level 1 Hard has two app servers), the choices are numbered ("App server 2"); the diagram itself does not show these numbers yet. E2E: `e2e/connect.spec.ts` (desktop) and a third test in `e2e/phone.spec.ts`.
