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
The difficulty the player picks for a level (Guided, Normal, Hard, God); it sets the starting design and how much help is shown.
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
Extra score awarded for passing a level below given cost thresholds.

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
How a component type is drawn and named for players (e.g. the app server is a factory); every instance is one building.
_Avoid_: Unit, structure

**Building Archive**:
The page that explains what each building (component) does, when to build it and which level brings it; shown as a **Briefing** before level 1.
_Avoid_: Codex, encyclopedia, help

**Base**:
The player's growing infrastructure: one district per passed level, built from the design that passed it.
_Avoid_: City, world, colony

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
