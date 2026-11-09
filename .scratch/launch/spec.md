# Spec: Launch "Design the Arki" v1.0.0

Status: needs-triage (waiting for the owner's OK on the UI sketches)

Launch the game to friends and colleagues the same way as System Defense ("Defend the Arki",
`../startupvsworld`, released as v1.0.0 on 2026-11-09).

## Decisions (2026-11-09)

- **Name:** Design the Arki. Repo `dlopezi/archi-game` → `dlopezi/design-the-arki`.
- **Address:** `https://design.thearki.com` (Firebase Hosting, GCP project `design-the-arki`, no billing).
- **Languages:** English by default + Spanish, with an `EN | ES` switch, before the launch.
- **Feedback:** in-game form that emails the owner through Web3Forms (a new access key, made by the owner).
- **Repo:** public, MIT, GitHub Issues (Bug + Idea forms, triage labels), simple Git Flow (main / develop / feature/*), `main` protected.
- **Version:** v1.0.0 with a git tag and a GitHub Release; version visible in the game.

## What System Defense did, and the state here

| Item | System Defense | Here today | Ticket |
| --- | --- | --- | --- |
| Final name in title, tab, manifest, README, storage keys | done | "archi-game" | 01 |
| Home-screen install (manifest + icons) | done | favicon only | 02 |
| EN / ES switch | done | English only | 03 |
| In-game Feedback (Web3Forms) | done | link to GitHub issues | 04 |
| Footer: version → Release, GitHub ↗, © 2026 thearki | done | version only | 05 |
| Firebase: 404 for missing files | done | every path returns index.html | 06 |
| GCP project + Firebase + deploy vars | done | CI ready, project not created | 06 |
| Custom domain + PRODUCTION_URL | done | none | 06 |
| MIT, README, Issue forms, labels, Issues as tracker | done | none (tracker is `.scratch/`) | 07 |
| Git Flow, pre-push hook, rulesets | done | only `main` | 08 |
| Repo public + settings | done | private | 09 |
| v1.0.0 tag + Release | done | v0.1.0 | 09 |
| Launch message EN / ES | done | none | 10 |

## Owner-only steps (I cannot do them)

1. Create the Web3Forms access key at web3forms.com for `dlopez.iru@gmail.com` (ticket 04).
2. Create the Firebase project from the GCP project (Firebase console → Add project) (ticket 06).
3. Add the DNS records in Cloudflare, "DNS only" (grey cloud) (ticket 06).
4. Merge the PRs on GitHub and say yes before the repo goes public (tickets 08, 09).
