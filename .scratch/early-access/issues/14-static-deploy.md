# 14: Static deployment

**What to build:** The game is built and published automatically to static hosting on our own domain on every push to the default branch.

**Blocked by:** 01

**Status:** ready-for-human

- [x] Pipeline builds, runs the tests and deploys only when they pass
- [ ] A human chooses the host (GitHub Pages, Netlify or Cloudflare Pages), connects the domain and adds any deploy secrets
- [ ] The deployed site loads level 1 and runs it

## Comments

**2026-11-05, prepared, not published.** Decisions so far: custom domain (name to be given), no analytics for now, feedback to this repo's GitHub issues (needs the repo to be public, or set `VITE_FEEDBACK_URL`). Host still undecided. Ready: `.github/workflows/deploy-pages.yml` (manual `workflow_dispatch` only; runs typecheck, unit and E2E tests, then builds and deploys to GitHub Pages) and `docs/deployment.md` with the remaining human steps for GitHub Pages, Cloudflare Pages or Netlify and the custom domain. Status stays `ready-for-human`.

**2026-11-05, update.** The owner will play-test the private build first (published as a private claude.ai page). The repository stays private, so before publishing: pick Cloudflare Pages or Netlify (or pay for GitHub Pages on a private repository), and set `VITE_FEEDBACK_URL` to a form or email (still to be chosen). No domain bought yet; use the host's free domain meanwhile.

**2026-11-05, decided.** Host: Cloudflare Pages (steps in `docs/deployment.md`). Feedback: by email; the address is still to be chosen and must be set as `VITE_FEEDBACK_URL` before publishing. Waiting on the owner's play-test.

**2026-11-05, postponed.** The owner wants a landing page before publishing: see `.scratch/landing-page/`.

**2026-11-07, host changed: Firebase Hosting.** Set up like System Defense ("Defend the Arki"): a Google Cloud project of its own without billing, deploy from GitHub Actions with Workload Identity Federation (no stored key). `ci.yml` has a `deploy` job: only on `main`, only after typecheck, unit and E2E tests pass, and it publishes the tested build. It stays off until `scripts/setup-gcp.sh` creates the repository variables. `deploy-pages.yml` is removed. Remaining human steps (create the project, add Firebase, run the script, set `VITE_FEEDBACK_URL`, domain later) are in `docs/deployment.md`. Status stays `ready-for-human`.
