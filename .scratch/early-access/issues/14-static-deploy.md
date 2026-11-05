# 14: Static deployment

**What to build:** The game is built and published automatically to static hosting on our own domain on every push to the default branch.

**Blocked by:** 01

**Status:** ready-for-human

- [ ] Pipeline builds, runs the tests and deploys only when they pass
- [ ] A human chooses the host (GitHub Pages, Netlify or Cloudflare Pages), connects the domain and adds any deploy secrets
- [ ] The deployed site loads level 1 and runs it

## Comments

**2026-11-05, prepared, not published.** Decisions so far: custom domain (name to be given), no analytics for now, feedback to this repo's GitHub issues (needs the repo to be public, or set `VITE_FEEDBACK_URL`). Host still undecided. Ready: `.github/workflows/deploy-pages.yml` (manual `workflow_dispatch` only; runs typecheck, unit and E2E tests, then builds and deploys to GitHub Pages) and `docs/deployment.md` with the remaining human steps for GitHub Pages, Cloudflare Pages or Netlify and the custom domain. Status stays `ready-for-human`.

**2026-11-05, update.** The owner will play-test the private build first (published as a private claude.ai page). The repository stays private, so before publishing: pick Cloudflare Pages or Netlify (or pay for GitHub Pages on a private repository), and set `VITE_FEEDBACK_URL` to a form or email (still to be chosen). No domain bought yet; use the host's free domain meanwhile.
