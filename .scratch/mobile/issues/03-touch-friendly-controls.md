# 03: Touch-friendly controls

**What to build:** In the compact layout every control is easy to use with a finger, and no text asks for a mouse or keyboard.

**Blocked by:** 01

**Status:** resolved

- [x] Hotbar key numbers hidden under `@media (hover: none)`
- [x] Buttons at least 40 px in the compact layout (stepper, sheet tabs, size picker, Remove)
- [x] The hotbar scrolls sideways when the components do not fit; Play stays visible
- [x] Compact canvas hint without "drag" or "Delete"
- [x] Landing: `landing.computerNote` no longer says "Best played on a computer"
- [x] E2E at 390×844: add a component by tap, change its instances, remove it
- [x] `npm run check` and `npm run e2e` pass

## Comments

**2026-11-05, implemented.** Hotbar key numbers hide under `@media (hover: none)` (any touch screen, not only the compact layout). In the compact layout the stepper buttons and field, the radio choices (size, tier, "Sends requests to"), Remove and the feedback link are at least 40 px; the sheet tabs already were (ticket 01), and the hotbar already scrolled sideways. `MissionPanel` takes `compact` and shows `canvasHintCompact` (taps, "Sends requests to", no drag or Delete). The "no entry" design problem now names both ways to connect Clients, at every size. Landing: `computerNote` became `deviceNote`, "Plays on a computer, tablet or phone." E2E: two new tests in `e2e/phone.spec.ts` (sizes, tap to add, add an instance, remove; sideways scroll with four components on level 4).
