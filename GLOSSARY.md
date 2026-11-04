# archi-game

A browser puzzle game where players design software architectures that must survive simulated traffic.

## Language

### Levels and progression

**Level**:
A single puzzle: a traffic profile, requirements, a budget, the allowed components and optional failure events.
_Avoid_: Stage, mission, puzzle

**Chapter**:
An ordered group of levels about one topic that introduces new component types.
_Avoid_: World, section

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

**Connection**:
A directed link along which requests flow from one component to another.
_Avoid_: Edge, wire, link

### Simulation

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
