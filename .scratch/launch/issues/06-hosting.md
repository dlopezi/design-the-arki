# 06 Hosting: Firebase project, 404s, domain

Status: needs-info (owner steps)

- firebase.json: only paths without an extension fall back to index.html (System Defense commit 7ed67b5).
- `gcloud projects create design-the-arki` (no billing), owner adds Firebase, then `scripts/setup-gcp.sh` for the new repo name.
- Custom domain `design.thearki.com`: CNAME `design` → `design-the-arki.web.app`, DNS only. Then `PRODUCTION_URL`.
- Update docs/deployment.md.
