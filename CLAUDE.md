# Design the Arki (archi-game)

A browser puzzle game about software architecture for developers preparing for system-design interviews. See `docs/product-brief.md`.

## Commands

- `npm run dev`: start the game locally
- `npm run check`: typecheck + unit tests (engine and level files)
- `npm run e2e`: browser tests (builds and serves the game)
- `npm run verify`: `check` + `e2e`, what CI runs; run it before a Pull Request
- `LEVEL=<id> npm run level-report`: the numbers for tuning a level (stars, starting designs)
- `prototypes/` holds throwaway prototypes, not part of the build; view one with `npm run dev` at `/prototypes/<file>`
- Deployment: see `docs/deployment.md` (Firebase Hosting; optional build settings in `.env.example`)

## Git Flow (simple)

- `main` is production: every push to `main` deploys to design.thearki.com. Never push or merge to `main` directly.
- `develop` is integration. Start each change on `feature/<name>` from `develop`, in its own worktree (other sessions share the main checkout). Never run git commands that switch the branch of the main checkout without asking.
- A feature goes back by Pull Request: `gh pr create --base develop`. Merge it with `gh pr merge <N> --merge` once CI passes (GitHub auto-merge is off here). Its body says `Fixes #N` for each Issue it finishes; a workflow closes them on merge into `develop`.
- To publish, open a Pull Request from `develop` to `main` and merge it on GitHub, only when the user asks. Bump `version` in package.json, then tag `vX.Y.Z` and create a GitHub Release.
- A local `pre-push` hook blocks pushes to `main` (`scripts/pre-push`; install with `cp scripts/pre-push .git/hooks/pre-push`).

## Agent skills

The skills come from the `mattpocock-skills` plugin; the repo keeps no copy. If they are missing, install the plugin.

### Issue tracker

Issues and specs live in GitHub Issues (`gh` CLI). Player Feedback arrives by email and is copied into Issues. Older specs stay in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), as GitHub labels. See `docs/agents/triage-labels.md`.

### Code map

Adding a building or a level, and checking a level in the browser: `docs/agents/code-map.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Review

Reviewers read `CODING_STANDARDS.md`. Glossary words are checked by `src/glossary.test.ts`.
