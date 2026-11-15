# Deterministic discrete-event simulation, separate from the UI

**Status:** replaced. The game moved to real-time play with a flow model (ADR-0005), and the engine described here was removed (ADR-0010). The rule that stays: the game rules are pure, deterministic and separate from the UI.

Traffic is simulated as a seeded discrete-event simulation in a pure TypeScript engine with no UI dependencies; the React layer only renders and animates its output. We chose this over an analytical queueing model (less visual, harder to show bottlenecks) and over real-time randomised animation (non-reproducible results), because pass/fail and star scoring must be reproducible for the player and testable per level.
