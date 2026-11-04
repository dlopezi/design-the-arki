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

## Content scope

Target 20+ levels covering four component groups:

1. **Core**: client, load balancer, app server, database, cache.
2. **Async**: message queue, workers, pub/sub.
3. **Data scale**: read replicas, sharding, object storage.
4. **Edge/network**: CDN, API gateway, rate limiter, DNS / multi-region.

## Release

- **Early access** with ~8 levels, then grow to 20+ in updates.
- Static hosting (GitHub Pages / Netlify / Cloudflare Pages) on our own domain.
- Privacy-first, cookieless analytics (Plausible or Umami: levels started/completed, drop-off) plus a feedback form link.

## Engineering

- TypeScript + React; the design editor uses React Flow (SVG).
- Simulation engine is pure TypeScript, deterministic, independent of the UI (ADR-0001).
- Levels are JSON data validated by a schema (ADR-0002).
- Progress is stored in `localStorage`; no backend (ADR-0003).
- Testing: TDD on the engine; every level has a test proving a **Reference Design** passes it; a few E2E tests for the UI.
