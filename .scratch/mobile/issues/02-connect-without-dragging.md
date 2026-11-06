# 02: Connect without dragging

**What to build:** The Inspector shows a "Sends requests to" row for the selected component, with one button per possible target and "None". Choosing a target connects the two components and replaces any previous connection from it; "None" removes the connection. Works at every screen size and with the keyboard.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Targets: the other components in the design, never the clients and never the component itself
- [ ] Same rule as `onConnect` in `src/ui/App.tsx`: one outgoing connection per component
- [ ] The current target is shown as selected (`aria-pressed` or a radio group)
- [ ] Strings in `src/i18n/en.ts`
- [ ] Unit test for the target list if it lives in a pure helper
- [ ] E2E (desktop): connect app server → database from the Inspector and pass level 1; "None" removes the connection
- [ ] `npm run check` and `npm run e2e` pass
