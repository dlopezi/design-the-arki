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

Real-time strategy play, chosen 2026-11-11 after a playable prototype (`prototypes/rts-loop.prototype.html`; ADR-0005):

- **Build phase** (30 s): the player builds components with money; each one takes seconds to build and connects itself the usual way (load balancer in front of the app servers, cache in front of the database). The player can change any connection by dragging from one building to another, or select a line and press Delete. "Bring them now!" starts the wave early and pays a bonus.
- **One wave per level**: users arrive from the Internet at a fixed rate for a set time; each level teaches one idea, so one wave is enough. The player keeps building during the wave.
- **Money** grows by itself (+$2/s) and with each answered visit ($1 per 100), and each building costs maintenance (its monthly cost ÷ 100 per second). **Reputation** falls while errors (−6/s) or latency (−4/s) break the level's requirements, and rises slowly otherwise; at 0 the base is lost.
- **Scoring**: lasting the wave passes the level; the money left decides the extra stars.
- **Feedback on failure**: the end dialog names the component that dropped the most requests with a short **Hint** (not in God mode); during play, a red badge marks each building that loses requests.
- **Progression**: linear **Chapters** by topic; each level unlocks the next and each chapter introduces new components.

## Game screen

Computer and tablet only (the phone layout was dropped on 2026-11-11). Chosen from the prototype:

- **Resource bar** on top: back to the levels, level name, money (with its rate per second), the phase timer, reputation, Feedback.
- **Map** in the middle: the Internet globe on the left and your base on the right, drawn in **C4 layers** (1 Context, 2 Containers, 3 Components; layer 3 by default). It starts as an empty construction zone; zones appear with their first building. Drag the ground to pan, use the wheel to zoom.
- **Connections** are thin curved lines from a building's right side to the next one's left side, bending around other buildings; their colour shows health (teal fine, yellow busy, red losing requests, grey not used) and the req/s appear on hover or selection. **Requests** travel along them and come back (round trip): green when answered, red with "503" from the building that failed.
- A selected building lights its own base in neon, in its type's colour. Buildings warn "no way in" or "no way out" when a connection is missing.
- **Console** at the bottom: live results (req/s, p95, errors, income and maintenance), the inspector (state, instances, where it sends requests, load, capacity, size or tier, cache TTL, add or remove instances), and the build card with "Bring them now!", pause and speed (1×, 2×, 4×).
- The **mission** panel shows the mode, the guided hint, the brief, the wave, the incident and the objectives.

## Home screen (level map)

A **campaign map**, chosen 2026-11-09 from three HTML mockups (campaign map, tech tree, mission board; `prototypes/level-map.prototype.html`), replacing the winding road of round buttons:

- Each chapter is a **sector** of terrain with its missions joined by a route; passed parts of the route are green. A mission that brings a new building shows that building as its marker; the ring colour shows the hardest mode passed (Guided blue, Normal gold, Hard orange, God purple) and the next mission glows with a "Play!" bubble.
- Clicking a mission opens its **briefing** on the right: state, brief, stars and badge, objectives, the new building, the buildings in the mission, and the four mode buttons that start it (only Guided before the tutorial is done). Locked missions show their briefing without the modes.
- The top bar has "← Home" (title screen), links to Your base and the Building Archive, and the stars collected. On a phone the map becomes a list, with the briefing below it.

## Title screen

The landing page at the site root (`#`) looks like a game's title screen (chosen 2026-11-07, replacing the scrolling landing page): a player bar (stars collected, current chapter with levels passed), a big glowing logo with the tagline and one-line pitch, a **main menu** in two columns (Play level 1 / Continue: level N, Level map, How to play, Building archive, Your base, Feedback; the Training demo was removed on 2026-11-09), over a moving backdrop (a small network with travelling requests and a grid floor; still when the player prefers reduced motion). The menu works like a game menu: ↑ / ↓ move the selection and Enter starts it ("Press Enter to start", shown only with a keyboard and mouse). "How to play" opens the three steps (Build, Run, Earn stars) in a dialog. On a computer everything fits without scrolling.

## Look and feel

Strategy-game (RTS) look, chosen 2026-11-09 and replacing the System Defense look chosen the same day: the player builds and runs a base. Original art and names, inspired by the genre, not by any one game.

- **Palette**: dark steel panels with a bevel and cut corners, a teal accent, green for selection and good, red / yellow for bad / warning, gold for money. Monospace, uppercase labels for titles and numbers; system sans-serif for body text. Tokens live in `:root` in `src/ui/styles.css`.
- **Components are buildings**: each type is a small isometric building in its colour, on a pad (`src/ui/componentArt.tsx`), always called by its real name (load balancer, app server, cache, database). A failed instance is grey with smoke. Every new component type needs a colour and a building.
- **The game screen** is described under *Game screen*: a resource bar, the map of the base in C4 layers on a grid floor (the system boundary is the base wall, zones are plots of land, load bars are segmented like health bars), and the console.

## Building Archive and briefing

- The **Building Archive** (`#archive`) explains each component as a building: what it does, when to build it, its cost and the level that first uses it. Buildings of levels the player cannot reach yet are locked.
- A new player's "Play level 1" opens the archive as a **briefing** (`#briefing`) with "Start level 1", so they know every building before the first level.
- The mission panel shows new buildings with their art and a link to the archive.

## Your base

The page explains itself with a "How it works" strip (pass a level → its design becomes a district → your base grows), and the report after a pass says how many buildings the design adds, with a link to the base. `#base` shows the infrastructure the player has built so far: one **district** per passed level on an isometric map, with one building per instance of the design that passed it (the level's reference design for progress saved before this feature). It opens from the title screen menu and the level map.

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
