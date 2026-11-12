# Design the Arki

A browser puzzle game where players design software architectures that must survive simulated traffic.

## Language

### Levels and progression

**Level**:
A single puzzle: a traffic profile, requirements, a budget, the allowed components and optional failure events. The campaign map presents it to players as a *mission*; in code and docs it stays a level.
_Avoid_: Stage, mission, puzzle

**Chapter**:
An ordered group of levels about one topic that introduces new component types. The campaign map draws it as a *sector* of terrain.
_Avoid_: World, section

**Mode**:
The difficulty the player picks once for every mission (Guided, Normal, Hard, God), on the difficulty screen; it sets the starting design and how much help is shown. Guided only until the tutorial is done.
_Avoid_: Difficulty level (clashes with Level), setting

**Starting Design**:
The design a level opens with in a given mode: almost complete (Guided), partial (Normal), broken (Hard) or empty (God).
_Avoid_: Template, scaffold

**Badge**:
The mark on a level showing the hardest mode the player has passed it in.
_Avoid_: Medal, trophy

**Requirements**:
The SLA a design must meet to pass a level: latency, availability and throughput targets.
_Avoid_: Goals, objectives

**Budget**:
The maximum monthly cost a design may have in a level.

**Stars**:
One for lasting the wave, plus one for each money threshold reached by the money left at the end.

**Reference Design**:
A known-good design stored with each level and used in tests to prove the level is solvable.
_Avoid_: Solution, answer key

### Designs

**Design**:
The player's architecture for a level: placed components plus their connections and parameters.
_Avoid_: Solution, diagram, blueprint

**Component**:
A placeable architecture building block (e.g. load balancer, cache, queue) with a few parameters and a cost.
_Avoid_: Node, block, service

**Instance**:
One running copy of a component inside a design (e.g. `api-1`); it has its own load and can fail on its own.
_Avoid_: Replica (reserved for database read replicas), node, server

**Connection**:
A directed link along which requests flow from one component to another.
_Avoid_: Edge, wire, link

**Building**:
A component as it stands on the map, always called by its real name (app server, database…). Each of its instances is drawn as its own small isometric building in the type's colour.
_Avoid_: Unit, structure, made-up names (factory, silos…)

**Manual**:
The help pages, in three tabs: How to play, Buildings (what each building does in the game and in real life, and which level brings it) and Concepts (p95, error rate, scaling…). Its Buildings tab is shown as a **Briefing** before level 1.
_Avoid_: Codex, encyclopedia, Field Manual and Building Archive (old names)

**Mission Briefing**:
The card that opens a mission over the game screen: story, objectives, new buildings and the star rule. The build clock waits until the player presses Start building.
_Avoid_: Intro, splash

**C4 Layer**:
How deep the design's diagram is drawn, after the C4 model: 1 Context (users and the system as one box), 2 Containers (zones and components, instances folded), 3 Components (every instance).
_Avoid_: Zoom level, view mode

### Simulation

**Primitive**:
A generic engine building block (source, station, routing, shortcut, failure, metrics) that component types are described with.
_Avoid_: Engine component (clashes with Component)

**Technology Pack**:
A set of component types and levels for one technology area (web core, async, CI) built from existing primitives.
_Avoid_: Module, plugin, DLC

**Wave**:
The one burst of users a level sends after the build phase, at a set number of requests per second for a set time (ADR-0005).
_Avoid_: Run, round, attack

**Build Phase**:
The first 30 seconds of a level, before the wave, when the player builds; "Bring them now!" ends it early for a bonus.
_Avoid_: Setup, preparation

**Money**:
What the player spends to build. It grows by itself and with every answered request, and buildings cost maintenance each second; the money left decides the extra stars.
_Avoid_: Minerals, gold, budget (the old monthly limit)

**Reputation**:
The base's health during the wave: it falls while requests fail or are too slow, and the level is lost at 0.
_Avoid_: Health, HP, lives

**Simulation**:
A deterministic, seeded run of a level's traffic through a design that produces metrics and a pass/fail result.
_Avoid_: Run, test

**Traffic Profile**:
The level-defined shape of incoming requests over time.

**Failure Event**:
A scripted incident during a simulation, such as a traffic spike or a node or zone outage.
_Avoid_: Chaos event, incident

**Bottleneck**:
The component that limits a design's performance, highlighted to the player after a simulation.

**Hint**:
A short message after a failed simulation that names the architecture concept likely to fix it.

### Feedback and releases

**Feedback**:
A free-text message a Player sends from inside the game, with technical context attached (version, language, level, mode, last result, browser, screen). It covers bugs, ideas and anything else.
_Avoid_: Bug report, comment, review

**Version**:
The number of a published build of the game (for example `1.0.0`), shown in the game and attached to every Feedback.
_Avoid_: Build number, release number

**Release**:
A Version made public to Players, marked with a git tag and release notes.
_Avoid_: Launch, drop
