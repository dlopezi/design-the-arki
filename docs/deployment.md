# Deployment

The game is a static site: `npm run build` writes everything to `dist/`. There is no backend (ADR-0003).

Status: **not published yet.** The deploy is ready in CI; it starts after the one-time setup below.

Decisions so far:
- **Host: Firebase Hosting (Google Cloud)**, set up like System Defense ("Defend the Arki", `startupvsworld/system-defense`), in the Google Cloud project `design-the-arki` **without billing** (Spark plan): it cannot create charges. Chosen 2026-11-07, replacing Cloudflare Pages.
- **Repository:** public, `dlopezi/design-the-arki` (renamed from `archi-game` at launch). GitHub Actions deploys with Workload Identity Federation: no key is stored anywhere. A repository rename needs the Workload Identity rule and the service-account binding moved to the new name (run `scripts/setup-gcp.sh` again).
- **Domain:** `https://design.thearki.com` (Cloudflare DNS), also `https://design-the-arki.web.app`.
- **No analytics** for now.
- **Feedback: in-game form.** The message goes to the owner's email through Web3Forms (`src/feedback/feedback.ts`). Its access key is public on purpose: it ships in the game's JS and can only send emails to the owner. The CSP allows `https://api.web3forms.com` in `connect-src` for this reason only.

## How it publishes

Every push to `main` runs the CI (`.github/workflows/ci.yml`):

1. `check`: typecheck, unit tests, then the E2E tests, which build the site with the build settings below.
2. `deploy` (only on `main`, only when `check` passed): publishes **the same build that passed the tests** to Firebase Hosting, then checks that the site answers with its title and its security headers.

The `deploy` job stays off until the repository variable `GCP_PROJECT_ID` exists (the setup script creates it).

**Roll back:** Firebase console → Hosting → release history → *Rollback*. `git revert` and a push also work.

## One-time setup (the owner)

1. Create the Google Cloud project, without billing. The project id must be new across all of Google Cloud; it becomes the address `<project-id>.web.app`.
   `gcloud projects create design-the-arki --name="Design the Arki"`
   Do not reuse `defend-the-arki`: a deploy there would replace System Defense.
2. Firebase console → *Add project* → pick `design-the-arki` (no Google Analytics).
3. Run `PROJECT_ID=design-the-arki scripts/setup-gcp.sh`. It turns on the APIs, lets only the `main` branch of this repository deploy, and saves the repository variables `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA`. You need `gcloud auth login` and `gh auth login` first.
4. Push to `main` (or run the CI again on `main`). The site goes live at `https://<project-id>.web.app`.
5. Custom domain: Firebase console → Hosting → *Add custom domain* → `design.thearki.com`. Copy the DNS records that Firebase shows into Cloudflare as **"DNS only" (grey cloud)** (a CNAME `design` → `design-the-arki.web.app`, plus a TXT for the certificate). Then `gh variable set PRODUCTION_URL --body https://design.thearki.com`, so the CI checks the domain too.

## Security headers and cache

`firebase.json` sets them (the same as System Defense):
- A strict Content Security Policy: scripts, styles, images and requests come only from the site itself.
- Only paths without a file extension fall back to `index.html`; a missing file (for example an old `/assets/*.js`) gets a real 404, so no HTML is cached for a year under a script name.
- `/assets/**` is cached for a year (the file names change with every build); `index.html` is never cached, so players get a new version at once.

If you turn on analytics, add the provider's address to `script-src` and `connect-src` in `firebase.json`, or the browser blocks the script.

**Test `firebase.json` on your computer:** `npm run build`, then `npx firebase-tools emulators:start --only hosting --project demo-test`. On macOS port 5000 is used by AirPlay: change the port with `"emulators": { "hosting": { "port": 4173 } }` in a copy of `firebase.json`. On port 4173, `npm run e2e` runs the browser tests against it (Playwright reuses a server that is already running).

## Build-time settings

Every setting is optional; see `.env.example`. Set them as GitHub repository **variables** (Settings → Secrets and variables → Actions → Variables, or `gh variable set`). The CI passes them to the build.

| Variable | Use |
| --- | --- |
| `VITE_ANALYTICS_SRC` | Script URL of a cookieless analytics provider. Leave it empty to disable analytics (current choice). |
| `VITE_ANALYTICS_DOMAIN` | Plausible only: the site's domain. |
| `VITE_ANALYTICS_WEBSITE_ID` | Umami only: the website id. |

The deploy uses these repository variables too: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA` (from the setup script) and, once there is a domain, `PRODUCTION_URL`.

## Other hosts

`dist/` works on any static host (Cloudflare Pages, Netlify, GitHub Pages): build command `npm run build`, output directory `dist`, Node 22. Copy the headers from `firebase.json` into the host's own format.
