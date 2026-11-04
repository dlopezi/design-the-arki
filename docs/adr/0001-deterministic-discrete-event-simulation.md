# Deterministic discrete-event simulation, separate from the UI

Traffic is simulated as a seeded discrete-event simulation in a pure TypeScript engine with no UI dependencies; the React layer only renders and animates its output. We chose this over an analytical queueing model (less visual, harder to show bottlenecks) and over real-time randomised animation (non-reproducible results), because pass/fail and star scoring must be reproducible for the player and testable per level.
