# Deployment

The game is a static site: `npm run build` writes everything to `dist/`. There is no backend (ADR-0003).

Status: **not published yet.** The owner is play-testing the private build first.

Decisions so far:
- **Repository stays private.** **Host: Cloudflare Pages** (free with private repositories).
- **Custom domain:** wanted, not bought yet. Until then the host's free domain works (for example `archi-game.pages.dev`).
- **No analytics** for now.
- **Feedback: by email.** Players cannot reach a private repository's issues, so before publishing set `VITE_FEEDBACK_URL` to `mailto:<address>?subject=archi-game%20feedback`. The address is not chosen yet; use a dedicated one, because every player will see it.

## Publishing on Cloudflare Pages (the chosen host)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → *Connect to Git* → pick `dlopezi/archi-game` and the branch to publish.
2. Build settings: framework preset *None*, build command `npm run build`, build output directory `dist`.
3. Environment variables (Production): `NODE_VERSION` = `22`, and `VITE_FEEDBACK_URL` = `mailto:<address>?subject=archi-game%20feedback`.
4. Save and deploy. The site goes live at `archi-game.pages.dev` (or a similar name Cloudflare assigns).
5. Later, with a domain: the project → Custom domains → Set up a domain, and follow the DNS step it shows.

Cloudflare builds on every push to that branch. Pages does not run the tests, so keep the branch's CI green before merging into it.

## Other hosts

1. **Pick the host.** All three work with a custom domain:
   - **GitHub Pages:** free for public repositories; a private repository needs a paid GitHub plan. The workflow `.github/workflows/deploy-pages.yml` is ready. It only runs when started by hand.
   - **Cloudflare Pages** or **Netlify:** free tiers that work with private repositories. Connect the repository in their dashboard, then set the build command to `npm run build` and the output directory to `dist`.
2. **Enable it.**
   - GitHub Pages: Settings → Pages → Source: *GitHub Actions*. Then go to Actions → *Deploy to GitHub Pages* → *Run workflow*.
   - Cloudflare or Netlify: their first build publishes the site.
3. **Point the domain.**
   - GitHub Pages: Settings → Pages → Custom domain. Add the DNS record GitHub shows (a `CNAME` to `<user>.github.io` for a subdomain, or GitHub's `A` records for an apex domain), then tick *Enforce HTTPS*.
   - Cloudflare or Netlify: add the domain in the project settings and create the DNS record they show.
4. **Check the feedback link.** "Send feedback" opens this repository's GitHub issues. Players can only use it if the repository is **public**. If it stays private, set `VITE_FEEDBACK_URL` to a form or a `mailto:` address.

To make publishing automatic on every push to the default branch, add `push: branches: [main]` to the workflow's `on:` block.

## Build-time settings

Every setting is optional; see `.env.example`. On GitHub, set them as repository **variables** (Settings → Secrets and variables → Actions → Variables). On Cloudflare or Netlify, set them as environment variables.

| Variable | Use |
| --- | --- |
| `VITE_FEEDBACK_URL` | Where "Send feedback" points. Defaults to this repository's GitHub issues. |
| `VITE_ANALYTICS_SRC` | Script URL of a cookieless analytics provider. Leave it empty to disable analytics (current choice). |
| `VITE_ANALYTICS_DOMAIN` | Plausible only: the site's domain. |
| `VITE_ANALYTICS_WEBSITE_ID` | Umami only: the website id. |

## Checks before publishing

`npm run check` and `npm run e2e` must pass. The deploy workflow runs both before it builds.
