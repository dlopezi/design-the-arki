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
- **Visual style**: strategy-game look (see *Look and feel*): components drawn as buildings of a base, dark mode, requests animated along connections.

## Game screen

Chosen from the UI prototype (variant D in `prototypes/game-ui`, 2026-11-04): the mission-style HUD combined with the studio tool's detail panels.

- **Canvas first**: full-bleed diagram with floating HUD: objectives as checkboxes (top-left), cost meter with star thresholds (top-right), simulation clock with live rps / p95 / errors while it runs, and a bottom hotbar of components plus a big Play button.
- **Component icons** (chosen 2026-11-07 from a three-style prototype: colour cards, line icons and characters with faces; kept on branch `prototype/component-icons`, commit b33e47d): each component type has its own glyph and colour, so players tell components apart at a glance. The hotbar shows colour cards (glyph on the type's colour, name, cost on a band); on the diagram each component and instance has a badge in the same colour, grey when the instance is down. Every new component type needs a glyph and a colour (`src/ui/componentArt.tsx`).
- **C4-style grouping**: players appear as a C4 *person* outside the system boundary; inside it, components sit in container boundaries (edge, application, data) labelled with name, type and technology.
- **Real resources**: every **Instance** is drawn as its own node (`api-1`, `api-2`, …) with its own load, and a failed instance turns grey and stops receiving traffic. No "×N" badges.
- **Inspector** (right, collapsible with `I`): deployment settings (instances, instance size), an *Advanced* section (queue size, service time, timeout), capacity and cost breakdown, and per-instance stats after a run.
- **Results drawer** (bottom, collapsible with `R`): verdict, stars, hint, rps / p95 / error charts, and load per resource.
- **Report card** after each run, with "View details" opening the inspector on the bottleneck.
- **Phone and tablet** (planned 2026-11-05, `.scratch/mobile/spec.md`): below 700 px a compact layout with a top bar, the diagram, a bottom sheet with tabs (Mission / Inspector / Results) and the component bar with Play; connections can also be made from the inspector ("Sends requests to"). Between 700 and 1100 px one side panel with Mission / Inspector tabs on the left, the cost top right, and the results drawer (two rows on tall screens) at the bottom (chosen 2026-11-05 over narrower panels, which left the diagram about 250 px wide).



Target 20+ levels covering four component groups:

1. **Core**: client, load balancer, app server, database, cache.
2. **Async**: message queue, workers, pub/sub.
3. **Data scale**: read replicas, sharding, object storage.
4. **Edge/network**: CDN, API gateway, rate limiter, DNS / multi-region.

## Home screen

Chosen from a three-variant prototype (path, skyline, mobile hub; kept in commit b671a49): a winding road of big round level buttons, in the spirit of mobile learning and puzzle games but with its own look and no mascot. Passed levels show a tick and are coloured by the hardest mode passed (Guided blue, Normal gold, Hard orange, God purple), with a mode label and a legend; the next level glows with a "Play!" bubble; locked levels are grey with a lock. A top bar shows the stars collected and each chapter has a banner with the next level and a progress bar.

## Title screen

The landing page at the site root (`#`) looks like a game's title screen (chosen 2026-11-07, replacing the scrolling landing page): a player bar (stars collected, current chapter with levels passed), a big glowing logo with the tagline and one-line pitch, a **main menu** (Play level 1 / Continue: level N, Level map, How to play) and the playable demo as a **Training** panel, over a moving backdrop (a small network with travelling requests and a grid floor; still when the player prefers reduced motion). The menu works like a game menu: ↑ / ↓ move the selection and Enter starts it ("Press Enter to start", shown only with a keyboard and mouse). "How to play" opens the three steps (Build, Run, Earn stars) in a dialog. On a computer everything fits without scrolling; on a phone the menu is on the first screen and Training is below it.

## Look and feel

Strategy-game (RTS) look, chosen 2026-11-09 and replacing the System Defense look chosen the same day: the player builds and runs a base. Original art and names, inspired by the genre, not by any one game.

- **Palette**: dark steel panels with a bevel and cut corners, a teal accent, green for selection and good, red / yellow for bad / warning, gold for money. Monospace, uppercase labels for titles and numbers; system sans-serif for body text. Tokens live in `:root` in `src/ui/styles.css`.
- **Components are buildings**: each type is a small isometric building in its colour, on a pad (`src/ui/componentArt.tsx`): load balancer = relay tower, app server = factory, cache = generator, database = silos. A failed instance is grey with smoke. Every new component type needs a colour and a building.
- **Command console** (wide screens): a resource bar on top (back, level, monthly cost against the budget, Inspector / Results toggles, Feedback), the mission on the left, the results panel above the console, and at the bottom a console with the minimap (left), the selected building's portrait and settings (centre) and the build card with the buildings and the big Play button (right). Tablet and phone keep their layouts with the same look.
- **The diagram** sits on a grid floor: the system boundary is the base wall, zones are districts, load bars are segmented like health bars.

## Building Archive and briefing

- The **Building Archive** (`#archive`) explains each component as a building: what it does, when to build it, its cost and the level that first uses it. Buildings of levels the player cannot reach yet are locked.
- A new player's "Play level 1" opens the archive as a **briefing** (`#briefing`) with "Start level 1", so they know every building before the first level.
- The mission panel shows new buildings with their art and a link to the archive.

## Your base

`#base` shows the infrastructure the player has built so far: one **district** per passed level on an isometric map, with one building per instance of the design that passed it (the level's reference design for progress saved before this feature). It opens from the title screen menu and the level map.

## Release

- **Early access** with the 8 levels of chapter 1 (Core), then grow to 20+ in updates; chapter 2 (Async) is the first update.
- **Modes**: the player picks Guided, Normal, Hard (fix a broken design) or God (empty canvas) per level; stars depend only on cost, and a badge shows the hardest mode passed.
- Static hosting on Firebase Hosting (Google Cloud), set up like System Defense ("Defend the Arki"): CI deploys every push to `main` after the tests pass (`docs/deployment.md`). Own domain later.
- Privacy-first, cookieless analytics (Plausible or Umami: levels started/completed, drop-off) plus a feedback form link.

## Engineering

- TypeScript + React; the design editor uses React Flow (SVG).
- Simulation engine is pure TypeScript, deterministic, independent of the UI (ADR-0001).
- Levels are JSON data validated by a schema (ADR-0002).
- Progress is stored in `localStorage`; no backend (ADR-0003).
- Testing: TDD on the engine; every level has a test proving a **Reference Design** passes it; a few E2E tests for the UI.
