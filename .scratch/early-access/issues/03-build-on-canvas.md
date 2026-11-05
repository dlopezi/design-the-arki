# 03: Build a design on the canvas

**What to build:** The player builds the design themselves: add components from the hotbar (click or drag, keys 1–n), connect them by dragging, delete components and connections. Only the level's allowed components appear. Before running, the game warns when the design cannot serve traffic (for example no path from clients to the database).

**Blocked by:** 01

**Status:** resolved

- [x] Hotbar lists only the level's allowed components, with keyboard shortcuts
- [x] Components can be added, connected, and removed; connections can be removed
- [x] Space (or the Play button) runs the simulation
- [x] A design with no complete path from clients is rejected with a clear message and no run
- [x] End-to-end test: build level 1's design from an empty canvas and pass it

## Comments

**2026-11-04, implemented.** `simulate` throws a `DesignError` with a typed problem (`noEntry`, `deadEnd`, `loop`); the catalogue says which components can end a request (`endsRequests`). Levels declare `allowedComponents`, and the level test checks the reference design only uses them. Levels now open with Clients only (starting designs per mode come in ticket 10). UI: hotbar (click, drag, keys 1–n), drag-to-connect (a new connection from a component replaces its old one; nothing connects into Clients), Delete/Backspace removes the selection, Space plays, problems shown in an alert with the component highlighted, view refits as components are added. E2E also covers the next-star message left over from ticket 02.

**2026-11-05, resolved.** Implemented in 202dd40 ("Ticket 03: build a design on the canvas").
