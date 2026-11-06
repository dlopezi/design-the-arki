# 02: Landing page at the root

**What to build:** A first-time visitor opening the site sees the landing: headline, one-line pitch, a placeholder where the simulation goes (the static diagram from 03 can stand in), the main button with "Free · no sign-up · runs in your browser", three steps (Build, Run, Earn stars), the button again, and "Best played on a computer". A returning player sees "Continue: level N". A link opens all levels.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Empty hash shows the landing; `#levels` the level map
- [ ] Main button: "Play level 1" → level 1 guided (tutorial); with progress "Continue: level N" → next open level; all passed → "Play again" → `#levels`
- [ ] "All levels" / "Your levels" link in the top bar
- [ ] Strings in `src/i18n/en.ts`; reads well at phone width with the computer note
- [ ] E2E: new visitor sees the pitch and reaches the tutorial; returning player sees Continue
