# 03: Build a design on the canvas

**What to build:** The player builds the design themselves: add components from the hotbar (click or drag, keys 1–n), connect them by dragging, delete components and connections. Only the level's allowed components appear. Before running, the game warns when the design cannot serve traffic (for example no path from clients to the database).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Hotbar lists only the level's allowed components, with keyboard shortcuts
- [ ] Components can be added, connected, and removed; connections can be removed
- [ ] Space (or the Play button) runs the simulation
- [ ] A design with no complete path from clients is rejected with a clear message and no run
- [ ] End-to-end test: build level 1's design from an empty canvas and pass it
