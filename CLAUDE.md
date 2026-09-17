# FGCU Map

Interactive campus walking-route map. Plain HTML/CSS/JS — no framework, no build step, no dependencies. Keep it that way.

## Layout

- `FGCU_Map/` — data and logic: `campus.json` (the single source of truth), `build-data.js` (coordinate solver), `graph.js` (Dijkstra)
- `web/` — the page only: `index.html`, `styles.css`, `app.js`

## Rules

- **`FGCU_Map/legacy code/` is READ-ONLY. Never modify anything in it unless explicitly told to.** That means no edits, no refactors, no reformatting, no bug fixes, no deletions — not even the two known bugs, which are documented in the README on purpose. It is the original Data Structures & Algorithms class project (`main.cpp`, `Graph.h`, and the `fgcu.csv` it read), preserved as submitted. Read it for reference; `graph.js` is the live implementation.
- **Edit the `edges` in `campus.json` → run `node FGCU_Map/build-data.js`.** It re-solves every building's x/y from the edge directions and distances and rewrites the same file. Never hand-edit coordinates — they're derived, and adding a building shifts its neighbors too. CI re-runs it and fails if the committed coordinates are stale.
- **`campus.json` is committed, not ignored.** Pages serves it directly; ignoring it 404s the live site.
- **Pages publishes the repo root, not `web/`**, because `web/app.js` imports `../FGCU_Map/`. Root `index.html` redirects to `web/`.
- The `deploy` job is gated to `workflow_dispatch` until Pages is enabled in repo settings. Remove the `if:` line to go live.

## Local

```sh
npx http-server -c-1   # from repo root, then open /web/
```
