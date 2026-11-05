# Deployment

The game is a static site: `npm run build` writes everything to `dist/`. There is no backend (ADR-0003).

Status: **not published yet.** The decisions so far are a custom domain, no analytics for now, and feedback going to this repo's GitHub issues. The hosting provider is still open.

## What a person has to do

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
