# Design the Arki

A browser puzzle game about software architecture, for developers preparing for system-design interviews.

Each level gives you requirements (throughput, p95 latency, availability) and a budget. You place and connect components (load balancers, app servers, caches, databases), run a simulation of real traffic, and pass if your design meets the SLA. A cheaper design earns more stars. When a design fails, the game highlights the bottleneck and gives a hint.

**Play:** https://design.thearki.com (desktop, tablet or phone; English and Spanish)

**Status:** early access. Chapter 1 (Core) has 8 levels: Hello world, First spike, Bigger or more?, Flash sale, Popular content, A server goes down, Tight budget and Black Friday. Each level can be played in Guided, Normal, Hard or God mode.

## Feedback

- **In the game:** Title screen → **Feedback**, or **Send feedback** in a level. No account needed.
- **On GitHub:** open an [Issue](../../issues/new/choose) (Bug or Idea).

Please include the version. It is at the bottom right of the title screen.

## Getting started

Requires Node 22.

```bash
npm install
npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the game locally |
| `npm run check` | Typecheck and unit tests (engine and levels) |
| `npm run e2e` | Browser tests with Playwright (builds and serves the game) |
| `npm run build` | Static build into `dist/` |

## Project layout

- `src/engine/`: deterministic simulation engine, pure TypeScript, no UI
- `src/levels/`: levels as schema-validated JSON, each tested against a reference design
- `src/catalog/`: components, technologies and costs
- `src/ui/`: React game screen (React Flow canvas, HUD, inspector, results)
- `src/progress/`: progress saved in `localStorage` (no backend)
- `e2e/`: Playwright tests
- `prototypes/`: throwaway prototypes, not part of the build

## Docs

- [Product brief](docs/product-brief.md): what the game is and the decisions behind it
- [Glossary](GLOSSARY.md): domain terms (Component, Instance, Bottleneck, …)
- [ADRs](docs/adr/): architecture decisions
- [Deployment](docs/deployment.md): hosting (Firebase Hosting on Google Cloud) and optional build settings in `.env.example`

## License

[MIT](LICENSE)
