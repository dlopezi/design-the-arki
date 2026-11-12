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

- **Resource bar** on top: back to the levels, level name, money (with its rate per second), the phase timer with pause and speed (1×, 2×, 4×), reputation, and **☰ Menu** (pauses the game: Resume, Mission, Manual, Send feedback, Restart level, Change mode, Level map; Esc opens it too). Chosen 2026-11-12 from map-control prototype C (branch `prototype/map-controls`).
- **Map** in the middle: the Internet globe on the left and your base on the right, drawn in **C4 layers** (1 Context, 2 Containers, 3 Components; layer 3 by default), switched in the **C4 view** panel at the bottom-left, with the layer names always shown. It starts as an empty construction zone; zones appear with their first building. Drag the ground to pan, use the wheel to zoom. Icon tools at the bottom-right: 🔗 auto-connect, ⟲ reconnect all, ? (controls help and the latest events), then +, − and ⌖ center. Big announcements show once and fade, like a fighting game: "Build!", a 3-2-1 count, "🚀 Live!" when the wave starts, and "⚡ A server is down!".
- **Connections** are thin curved lines from a building's right side to the next one's left side, bending around other buildings; their colour shows health (teal fine, yellow busy, red losing requests, grey not used) and the req/s appear on hover or selection. **Requests** travel along them and come back (round trip): green when answered, red with "503" from the building that failed.
- A selected building lights its own base in neon, in its type's colour. Buildings warn "no way in" or "no way out" when a connection is missing.
- **Console** at the bottom: live results (req/s, p95, errors, income and maintenance), the inspector (state, instances, where it sends requests, load, capacity, size or tier, cache TTL, add or remove instances), and the build card: the building cards and, at the bottom, "🚀 Release to production", which starts the wave early for a bonus.
- The **mission** (mode, guided hint, brief, wave, incident, objectives) opens as a briefing card at the start and from ☰ Menu → Mission; there is no mission panel on the map since 2026-11-12.

## Home screen (level map)

A **campaign map**, chosen 2026-11-09 from three HTML mockups (campaign map, tech tree, mission board; `prototypes/level-map.prototype.html`), replacing the winding road of round buttons:

- Each chapter is a **sector** of terrain with its missions joined by a route; passed parts of the route are green. A mission that brings a new building shows that building as its marker; the ring colour shows the hardest mode passed (Guided blue, Normal gold, Hard orange, God purple) and the next mission glows with a "Play!" bubble.
- Clicking a mission selects it and opens its **briefing** on the right: state, brief, objectives (with a link to what p95 means), how to earn stars, the badge, the new building, the buildings in the mission, and one **Play mission** button. Clicking the selected mission again, its "Play!" bubble or Enter also plays it; arrow keys move between missions. Locked missions show their briefing without the button. A mission opened since the last visit pops in with a "New mission open!" bubble and its route draws itself.
- **One mode for every mission** (changed 2026-11-11, replacing four mode buttons per mission): the player picks the difficulty once on the difficulty screen (`#mode`), the first time they play after the tutorial; it is changed from the top bar, Options or the game's mission panel. Before the tutorial is done every mission opens in Guided.
- The top bar has "← Home", the current mode, the Field Manual, the stars collected, Send feedback and ⚙ Options. "Your base" was removed on 2026-11-11. On a phone the map becomes a list, with the briefing below it.

## Title screen

The landing page at the site root (`#`) looks like a game's title screen (chosen 2026-11-07, replacing the scrolling landing page): a player bar (stars collected, current chapter with levels passed), a big glowing logo with the tagline (the one-line pitch was removed on 2026-11-11), a **main menu** in two columns (Play level 1 / Continue: level N, Level map, Manual, Options, Feedback; the Training demo was removed on 2026-11-09), over a moving backdrop (a small network with travelling requests and a grid floor; still when the player prefers reduced motion). The menu works like a game menu: ↑ / ↓ move the selection and Enter starts it ("Press Enter to start", shown only with a keyboard and mouse). On a computer everything fits without scrolling.

## Look and feel

Strategy-game (RTS) look, chosen 2026-11-09 and replacing the System Defense look chosen the same day: the player builds and runs a base. Original art and names, inspired by the genre, not by any one game.

- **Palette**: dark steel panels with a bevel and cut corners, a teal accent, green for selection and good, red / yellow for bad / warning, gold for money. Monospace, uppercase labels for titles and numbers; system sans-serif for body text. Tokens live in `:root` in `src/ui/styles.css`.
- **Components are buildings**: each type is a small isometric building in its colour, on a pad (`src/ui/componentArt.tsx`), always called by its real name (load balancer, app server, cache, database). A failed instance is grey with smoke. Every new component type needs a colour and a building.
- **The game screen** is described under *Game screen*: a resource bar, the map of the base in C4 layers on a grid floor (the system boundary is the base wall, zones are plots of land, load bars are segmented like health bars), and the console.

## Field Manual, briefing and options

Set up like the Guide and How to play screens of System Defense ("Defend the Arki"), 2026-11-11:

- The **Field Manual** (`#manual`, `#manual/<tab>`; the old `#archive` opens its Buildings tab) has three tabs. **How to play**: the goal, four steps (Build, Connect, Bring the users, Read the results) each with a small looping picture, the modes, the star rule and the keys. **Buildings**: each component as a building, with what it does, when to build it, its cost, the level that first uses it, and *In real life* (real tools, how the game is like it and not like it, a link to read more). Buildings of levels the player cannot reach yet are locked. **Concepts**: p95, throughput, error rate, bottleneck, scaling, redundancy, cache hit rate and TTL, cost, C4.
- It opens from the title screen, the campaign top bar, and over the game (📖 Manual), where it stops the clock.
- A new player's "Play level 1" opens the Buildings tab as a **briefing** (`#briefing`) with "Start level 1".
- **Mission briefing in the game**: every mission opens with a card (story, objectives, new buildings, star rule) and the build clock waits until **Start building**. 📋 Mission opens it again and stops the clock.
- **Options** (`#options`): language, sound on/off (short menu sounds made with Web Audio), difficulty, and Reset progress (moved here from the campaign top bar).

## Release

- **Early access** with the 8 levels of chapter 1 (Core), then grow to 20+ in updates; chapter 2 (Async) is the first update.
- **Modes**: the player picks Guided, Normal, Hard (fix a broken design) or God (empty canvas) once for every mission; stars depend only on cost, and a badge shows the hardest mode passed.
- Static hosting on Firebase Hosting (Google Cloud), set up like System Defense ("Defend the Arki"): CI deploys every push to `main` after the tests pass (`docs/deployment.md`). Own domain later.
- Privacy-first, cookieless analytics (Plausible or Umami: levels started/completed, drop-off) plus a feedback form link.

## Engineering

- TypeScript + React; the design editor uses React Flow (SVG).
- Simulation engine is pure TypeScript, deterministic, independent of the UI (ADR-0001).
- Levels are JSON data validated by a schema (ADR-0002).
- Progress is stored in `localStorage`; no backend (ADR-0003).
- Testing: TDD on the engine; every level has a test proving a **Reference Design** passes it; a few E2E tests for the UI.
