# 04: Playback and results on phone

**What to build:** In the compact layout, pressing Play closes the sheet so the run can be watched, with the clock (time, req/s, p95, errors) over the diagram. The Results tab shows the verdict, hint and charts one under the other. The report card fits the screen, and "View details" opens the Inspector tab on the bottleneck.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Play closes the sheet; the clock is visible and does not cover the top bar
- [ ] Results tab: verdict, stars, hint, charts stacked, load per resource; scrolls inside the sheet
- [ ] Report card fits at 390×844 with every button reachable
- [ ] "View details" opens the Inspector tab with the bottleneck selected
- [ ] Design problems (`.problem` alert) visible above the component bar
- [ ] E2E at 390×844: fail a level, read the hint in Results, open details on the bottleneck
- [ ] `npm run check` and `npm run e2e` pass
