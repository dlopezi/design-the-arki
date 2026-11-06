# Spec: landing page

Status: ready-for-agent

## Problem Statement

The game opens straight on the level map. A first-time visitor (for example someone who follows a shared link before the public launch) does not learn what archi-game is, who it is for, or why it is worth a try. There is nothing to show before publishing (ticket 14 waits on this).

## Solution

A short landing page at the site root, built from prototype variant **A "Try it here"** (chosen 2026-11-05 from three variants; all three kept on branch `prototype/landing-page`, commit 53af9e0; research in `research.md`). Its hero is a tiny **playable simulation** powered by the real engine: the visitor raises the traffic, watches one app server overload, adds an instance, and sees a load balancer appear and the system hold. Below it: three short steps and the main button again. The level map moves to its own address.

## User Stories

1. As a first-time visitor, I want one sentence that says what the game is and who it is for, so that I know within seconds if it is for me.
2. As a first-time visitor, I want to try the core idea on the page itself (more traffic breaks a server; another instance fixes it), so that I understand the game before I click anything.
3. As a first-time visitor, I want one clear button to start level 1, with "free, no sign-up, runs in your browser" next to it, so that I have no reason to hesitate.
4. As a returning player, I want the main button to continue at my next open level, so that the landing does not slow me down.
5. As a player, I want a link to all levels from the landing, and "← Levels" in the game to go to the level map, so that I can still pick any level.
6. As a phone visitor, I want the page to read well and to tell me the game is best played on a computer, so that I am not surprised.
7. As a visitor who prefers reduced motion, I want the simulation without moving dots, so that the page stays calm.
8. As a keyboard or screen-reader user, I want the slider, the instance buttons and the verdict to be usable and announced, so that the demo works for me too.

## Implementation Decisions

- **Routes** (hash routing, ADR-0003 keeps it static): empty hash = landing; `#levels` = level map; `#<level>` and `#<level>/<mode>` unchanged. Every "← Levels" link and the locked-level redirect go to `#levels`. A locked level opened by link returns to the level map with its notice, as today.
- **Main button**: no progress → "Play level 1" to `#<first level>/guided` (the tutorial). With progress → "Continue: level N" to `#<next open level>`; when every level is passed, "Play again" to `#levels`.
- **Live simulation**: a pure function builds a one-off `Level` and `Design` from the visitor's inputs (traffic 50–700 req/s in steps of 50; 1–4 medium app servers; a load balancer whenever there is more than one; one database), based on level 2's components, runs `simulate` with a fixed seed and returns p95, error rate, monthly cost, per-instance peak load and pass/fail against level 2's requirements (p95 ≤ 200 ms, errors ≤ 1%). The landing shows these numbers, so it can never disagree with the game. Short run (for example 10 s) if the full 60 s is too slow for a slider; must stay under one frame budget per change on a mid laptop.
- **Diagram**: a small static SVG in the game's C4 look (clients, optional load balancer, `app-1…app-N`, database), each app node coloured by its load (game thresholds), with requests as dots travelling along the connections. Not React Flow: nothing is draggable.
- **Copy**: all strings in `src/i18n/en.ts` (product brief: i18n-ready). Starting copy from the prototype: "Watch your system break. Then fix it." and the three steps Build / Run / Earn stars.
- **Look**: the game's dark tokens; the main button styled like Play and "Next level" (green). The page scrolls (the game screen does not).
- **Analytics**: none new now (the current choice is no analytics).

## Testing Decisions

- Unit tests (TDD) for the landing model: the input → `Level`/`Design` mapping, and known outcomes (300 req/s with 1 instance fails; with 2 instances passes; cost grows with instances and the load balancer).
- E2E (the agreed UI seam): a new visitor sees the landing, raises the traffic and sees the overload, adds an instance and sees "holds", clicks "Play level 1" and lands in the tutorial; a returning player sees "Continue"; "← Levels" opens the level map.
- Existing E2E tests that open `/` expecting the level map move to `/#levels`.

## Out of Scope

- Sections from variants B and C (chapters list, modes, FAQ, boss levels): the owner chose to keep A short.
- Screenshots, videos, testimonials, user counts.
- Spanish copy.
- Publishing (ticket 14 in `early-access`).

## Further Notes

- The prototype code (`src/ui/landing/*.prototype.tsx`) is not merged; this is a proper rewrite.
