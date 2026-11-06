# Landing page research

**Status:** resolved

Question: what do landing pages of similar products do, so the three landing-page prototypes can borrow from them? Collected 2026-11-05 from the live pages.

## Coding practice sites

- **[Codewars](https://www.codewars.com/)**: short aspirational two-line headline, one-sentence subhead, one "Get Started" button. Then alternating rows of heading + short paragraph + screenshot, one per core idea (practise, instant feedback, ranks, community). Social proof as three big numbers and two testimonials. Explains its own jargon ("kata") early.
- **[Exercism](https://exercism.org/)**: bold plain-language promise, primary "Sign up for free" plus a secondary "Explore" button. A grid of tracks with counts, sample exercise cards, tooling, then the CTA repeated at the bottom.
- **[Brilliant](https://brilliant.org/)**: benefit-led headline, splits the audience in the hero, feature cards that show the interactive canvas, a subject catalogue, trust badges and testimonials, closing CTA.

## Games

- **[Clash of Clans](https://supercell.com/en/games/clashofclans/)**: full-width key art and logo, a bold all-caps imperative headline, one short paragraph of gameplay, big store buttons. Videos and news cards do the showing; characters carry the tone (playful, energetic).
- **[Mini Metro](https://dinopoloclub.com/games/mini-metro/)**: short playful tagline, "Play now" and "Play trailer" in the hero, one "About the game" paragraph, screenshots and videos, FAQ, then where to buy.

## Direct competitors (system design as a game)

- **[systemInPain](https://www.producthunt.com/p/systeminpain/systeminpain)**: "Learn system design by watching it break in real time". The hook is the failure itself (latency spikes, nodes turn red). 15 levels, deterministic simulator, level 1 free with no sign-up.
- **[Server Survival](https://tmfnk.pages.dev/enjoy/games/server-survival)**: free browser 3D tower-defence about cloud infrastructure.
- Others found: [System Design Sandbox](https://system-design-sandbox.vercel.app), tiny-stacks, SDSim.

## Patterns worth borrowing

1. **One clear promise + one button** above the fold. Every page does this.
2. **Show the product moving.** Games lead with art or video; learning sites lead with the interactive canvas. Our animated simulation is the strongest visual we have.
3. **Name the pain.** Competitors sell "watch it break"; ours can sell "design it, then survive the spike".
4. **"Free, no sign-up"** next to the button removes the main doubt (systemInPain, Exercism).
5. **Explain the loop in 3–4 steps** with a picture each (Codewars rows, Mini Metro "about").
6. **Curriculum as a map** (Exercism tracks, our chapters) shows there is more to come.
7. **Repeat the CTA at the bottom**, plus a short FAQ (Mini Metro).
8. Skip for now: testimonials, user counts and press quotes. We have none before launch.

## Comments

**2026-11-05, resolved.** Three prototypes built from this (branch `prototype/landing-page`, commit 53af9e0). The owner chose variant A "Try it here", kept short (no sections from B or C). Plan: `spec.md` and `issues/01`–`03`.
