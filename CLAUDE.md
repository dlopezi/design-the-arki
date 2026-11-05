# archi-game

A browser puzzle game about software architecture for developers preparing for system-design interviews. See `docs/product-brief.md`.

## Commands

- `npm run dev`: start the game locally
- `npm run check`: typecheck + unit tests (engine and level files)
- `npm run e2e`: browser tests (builds and serves the game)
- `prototypes/` holds throwaway prototypes; they are not part of the build
- Deployment: see `docs/deployment.md` (not published yet; optional build settings in `.env.example`)

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
