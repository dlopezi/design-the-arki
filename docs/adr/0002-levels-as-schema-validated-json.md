# Levels are schema-validated JSON data

Each level (traffic profile, SLA, budget, allowed components, scripted failure events) is a JSON file validated against a schema (e.g. Zod), not a TypeScript module with custom logic and not built in a visual level editor. This keeps 20+ levels uniform, cheap to add, and testable: every level ships with a reference design that a test runs through the engine to prove the level is solvable.
