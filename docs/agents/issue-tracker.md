# Issue tracker: GitHub Issues

Issues and specs for this repo live in GitHub Issues on `dlopezi/design-the-arki`. Use the `gh` CLI.

## Where reports come from

- **Players** send Feedback from the game. It arrives by email to the owner. The owner copies what is useful into a GitHub Issue.
- **People with a GitHub account** open an Issue with the Bug or Idea form (`.github/ISSUE_TEMPLATE/`).
- New Issues get the `needs-triage` label. See `triage-labels.md`.

## Conventions

- One Issue per bug, idea or ticket. A bigger feature has one spec Issue, and its tickets are sub-issues of it.
- Labels: `bug` or `idea` for the kind, plus one triage role from `triage-labels.md`.
- Always write the game Version (for example `v1.0.0`) in a bug Issue.
- Conversation goes in Issue comments.
- A Pull Request that fixes an Issue says `Fixes #N` in its body, one line per Issue. GitHub itself closes Issues only on merges into `main`, so the `Close fixed issues` workflow closes them when the Pull Request is merged into `develop`. Without that line the Issue stays open.

## When a skill says "publish to the issue tracker"

`gh issue create --title "..." --body-file <file> --label needs-triage` (add `bug` or `idea`).

## When a skill says "fetch the relevant ticket"

`gh issue view <N> --comments`. The user will normally pass the number.

## Wayfinding operations

Used by `/wayfinder`. The **map** is one Issue with one **child** sub-issue per ticket.

- **Map**: an Issue with the `map` label. Its body holds Notes / Decisions-so-far / Fog.
- **Child ticket**: a sub-issue of the map, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: a `Blocked by: #N, #N` line near the top. A ticket is unblocked when every Issue it lists is closed.
- **Frontier**: open, unblocked sub-issues of the map with no assignee; lowest number wins.
- **Claim**: assign yourself (`gh issue edit <N> --add-assignee @me`) before any work.
- **Resolve**: comment the answer under an `## Answer` heading, close the Issue, then add a context pointer (gist + link) to the map's Decisions-so-far.

## Older work

Specs and tickets written before the launch stay in `.scratch/<feature>/` as history. New work goes to GitHub Issues.
