# 06: Tablet layout

**What to build:** Between 700 and 1100 px the desktop layout stays, but leaves more room for the diagram: narrower mission and inspector, a tutorial that does not cover the mission, and a results drawer in two rows.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Media query for 700–1099 px: narrower mission and inspector panels
- [ ] Tutorial card placed so it does not cover the mission or the cost meter
- [ ] Results drawer grid wraps to two rows; nothing cut off
- [ ] `fitOptions` margins match the narrower panels
- [ ] E2E at 768×1024: mission, tutorial, cost meter, inspector and controls do not overlap
- [ ] `npm run check` and `npm run e2e` pass; desktop (≥ 1100 px) unchanged
