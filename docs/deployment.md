# Deployment

The game is a static site: `npm run build` writes everything to `dist/`. There is no backend (ADR-0003).

Status: **not published yet.** The deploy is ready in CI; it starts after the one-time setup below.

Decisions so far:
- **Host: Firebase Hosting (Google Cloud)**, set up like System Defense ("Defend the Arki", `startupvsworld/system-defense`), in a Google Cloud project of its own **without billing** (Spark plan): it cannot create charges. Chosen 2026-11-07, replacing Cloudflare Pages.
- **Repository stays private.** GitHub Actions deploys with Workload Identity Federation: no key is stored anywhere.
- **Custom domain:** not chosen yet. Until then the site lives at `https://<project-id>.web.app`. A subdomain of `thearki.com` (System Defense uses `defend.thearki.com`) works the same way.
- **No analytics** for now.
- **Feedback: by email.** Players cannot reach a private repository's issues, so before publishing set `VITE_FEEDBACK_URL` to `mailto:<address>?subject=archi-game%20feedback`. The address is not chosen yet; use a dedicated one, because every player will see it.

## How it publishes

Every push to `main` runs the CI (`.github/workflows/ci.yml`):

1. `check`: typecheck, unit tests, then the E2E tests, which build the site with the build settings below.
2. `deploy` (only on `main`, only when `check` passed): publishes **the same build that passed the tests** to Firebase Hosting, then checks that the site answers with its title and its security headers.

The `deploy` job stays off until the repository variable `GCP_PROJECT_ID` exists (the setup script creates it).

**Roll back:** Firebase console → Hosting → release history → *Rollback*. `git revert` and a push also work.

## One-time setup (the owner)

1. Create the Google Cloud project, without billing. The project id must be new across all of Google Cloud; it becomes the address `<project-id>.web.app`.
   `gcloud projects create <project-id> --name="archi-game"`
   Do not reuse `defend-the-arki`: a deploy there would replace System Defense.
2. Firebase console → *Add project* → pick `<project-id>` (no Google Analytics).
3. Run `PROJECT_ID=<project-id> scripts/setup-gcp.sh`. It turns on the APIs, lets only the `main` branch of this repository deploy, and saves the repository variables `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA`. You need `gcloud auth login` and `gh auth login` first.
4. Set the feedback address: `gh variable set VITE_FEEDBACK_URL --body "mailto:<address>?subject=archi-game%20feedback"`.
5. Push to `main` (or run the CI again on `main`). The site goes live at `https://<project-id>.web.app`.
6. Later, with a domain: Firebase console → Hosting → *Add custom domain*. Copy the DNS records that Firebase shows into Cloudflare as **"DNS only" (grey cloud)**. Then `gh variable set PRODUCTION_URL --body https://<domain>`, so the CI checks the domain too.

## Security headers and cache

`firebase.json` sets them (the same as System Defense):
- A strict Content Security Policy: scripts, styles, images and requests come only from the site itself.
- `/assets/**` is cached for a year (the file names change with every build); `index.html` is never cached, so players get a new version at once.

If you turn on analytics, add the provider's address to `script-src` and `connect-src` in `firebase.json`, or the browser blocks the script.

**Test `firebase.json` on your computer:** `npm run build`, then `npx firebase-tools emulators:start --only hosting --project demo-test`. On macOS port 5000 is used by AirPlay: change the port with `"emulators": { "hosting": { "port": 4173 } }` in a copy of `firebase.json`. On port 4173, `npm run e2e` runs the browser tests against it (Playwright reuses a server that is already running).

## Build-time settings

Every setting is optional; see `.env.example`. Set them as GitHub repository **variables** (Settings → Secrets and variables → Actions → Variables, or `gh variable set`). The CI passes them to the build.

| Variable | Use |
| --- | --- |
| `VITE_FEEDBACK_URL` | Where "Send feedback" points. Defaults to this repository's GitHub issues. |
| `VITE_ANALYTICS_SRC` | Script URL of a cookieless analytics provider. Leave it empty to disable analytics (current choice). |
| `VITE_ANALYTICS_DOMAIN` | Plausible only: the site's domain. |
| `VITE_ANALYTICS_WEBSITE_ID` | Umami only: the website id. |

The deploy uses these repository variables too: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA` (from the setup script) and, once there is a domain, `PRODUCTION_URL`.

## Other hosts

`dist/` works on any static host (Cloudflare Pages, Netlify, GitHub Pages): build command `npm run build`, output directory `dist`, Node 22. Copy the headers from `firebase.json` into the host's own format.
