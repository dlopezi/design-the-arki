# Product brief

Decisions settled in the initial design grilling session (2026-11-04).

## What it is

- **Concept**: level-based puzzles where the player designs a software architecture that must meet a level's requirements under simulated traffic.
- **Audience**: developers preparing for system-design interviews.
- **Goal**: a publishable product, not just a learning exercise.
- **Platform**: web browser, single player, no backend.
- **Language**: English at launch; all player-facing strings externalised for i18n (Spanish later).
- **Monetisation**: free at launch; decide later. Build no payment or account features yet.
- **License**: closed source for now.

## Gameplay

- **Core loop**: read the level's requirements, place and configure **Components**, connect them, run the **Simulation**, pass or fail.
- **Scoring**: pass = meet the SLA (latency, availability, throughput). Extra **Stars** for lower monthly cost.
- **Component configuration**: a few key parameters per component (instance count, size/tier, cache TTL, …), each with a visible cost.
- **Failure events**: scripted per level (traffic spikes, node or zone outages), introduced in advanced levels.
- **Feedback on failure**: metrics charts, the **Bottleneck** highlighted on the diagram, and a short **Hint** naming the concept.
- **Progression**: linear **Chapters** by topic; each level unlocks the next and each chapter introduces new components.
- **Visual style**: clean, modern architecture-diagram look, dark mode, requests animated along connections.

## Game screen

Chosen from the UI prototype (variant D in `prototypes/game-ui`, 2026-11-04): the mission-style HUD combined with the studio tool's detail panels.

- **Canvas first**: full-bleed diagram with floating HUD: objectives as checkboxes (top-left), cost meter with star thresholds (top-right), simulation clock with live rps / p95 / errors while it runs, and a bottom hotbar of components plus a big Play button.
- **C4-style grouping**: players appear as a C4 *person* outside the system boundary; inside it, components sit in container boundaries (edge, application, data) labelled with name, type and technology.
- **Real resources**: every **Instance** is drawn as its own node (`api-1`, `api-2`, …) with its own load, and a failed instance turns grey and stops receiving traffic. No "×N" badges.
- **Inspector** (right, collapsible with `I`): deployment settings (instances, instance size), an *Advanced* section (queue size, service time, timeout), capacity and cost breakdown, and per-instance stats after a run.
- **Results drawer** (bottom, collapsible with `R`): verdict, stars, hint, rps / p95 / error charts, and load per resource.
- **Report card** after each run, with "View details" opening the inspector on the bottleneck.
- **Phone and tablet** (planned 2026-11-05, `.scratch/mobile/spec.md`): below 700 px a compact layout with a top bar, the diagram, a bottom sheet with tabs (Mission / Inspector / Results) and the component bar with Play; connections can also be made from the inspector ("Sends requests to"). Between 700 and 1100 px the desktop layout with narrower panels.



Target 20+ levels covering four component groups:

1. **Core**: client, load balancer, app server, database, cache.
2. **Async**: message queue, workers, pub/sub.
3. **Data scale**: read replicas, sharding, object storage.
4. **Edge/network**: CDN, API gateway, rate limiter, DNS / multi-region.

## Home screen

Chosen from a three-variant prototype (path, skyline, mobile hub; kept in commit b671a49): a winding road of big round level buttons, in the spirit of mobile learning and puzzle games but with its own look and no mascot. Passed levels show a tick and are coloured by the hardest mode passed (Guided blue, Normal gold, Hard orange, God purple), with a mode label and a legend; the next level glows with a "Play!" bubble; locked levels are grey with a lock. A top bar shows the stars collected and each chapter has a banner with the next level and a progress bar.

## Release

- **Early access** with the 8 levels of chapter 1 (Core), then grow to 20+ in updates; chapter 2 (Async) is the first update.
- **Modes**: the player picks Guided, Normal, Hard (fix a broken design) or God (empty canvas) per level; stars depend only on cost, and a badge shows the hardest mode passed.
- Static hosting (GitHub Pages / Netlify / Cloudflare Pages) on our own domain.
- Privacy-first, cookieless analytics (Plausible or Umami: levels started/completed, drop-off) plus a feedback form link.

## Engineering

- TypeScript + React; the design editor uses React Flow (SVG).
- Simulation engine is pure TypeScript, deterministic, independent of the UI (ADR-0001).
- Levels are JSON data validated by a schema (ADR-0002).
- Progress is stored in `localStorage`; no backend (ADR-0003).
- Testing: TDD on the engine; every level has a test proving a **Reference Design** passes it; a few E2E tests for the UI.
