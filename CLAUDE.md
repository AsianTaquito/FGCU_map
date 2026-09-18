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

## Icons

- **An icon is an inline `<symbol id="icon-<building id>">` in the `<defs>` of `web/index.html`.** That is the whole registration: `iconIndex()` in `app.js` scans for `symbol[id^='icon-']` and matches the suffix against `building.id` from `campus.json`. No map, no manifest, no file to also edit. A building with no matching symbol just draws as a plain disc.
- **One drawing can serve several buildings via `data-for`** (space-separated building ids), which is how `icon-dorm`, `icon-academic`, `icon-parking`, `icon-health` and `icon-field` cover the lookalike halls, garages and fields.
- **`web/index.html` is ~330 KB and that is expected** — it is the pasted SVG source of 20 icons. Don't extract them into separate files or "optimize" the page size: separate files mean extra requests and a build step, and there is no build step.
- Hover and selection grow the icon (`transform: scale(2.4)`) and the disc under it; the disc is the hit target, not the artwork.

## Map layers

- The SVG draws in fixed layer order: `layer-terrain`, `layer-paths`, `layer-route`, `layer-nodes`, `layer-labels`, `layer-hover`. Order in the document *is* the paint order — **SVG has no `z-index`.**
- **`layer-hover` is empty at rest.** `hoverNode()` moves the hovered building's group and its label into it so the enlarged icon paints over its neighbours, then moves them back on leave. It guards on `:hover` because re-parenting re-runs hit testing and would otherwise ping-pong the element between layers.
- `is-hovered` on a label is deliberately separate from `is-active`: `render()` owns `is-active` for start/end, so a hover leaving must not strip a selected label's emphasis.

## Panel

- The left panel collapses by toggling `.is-collapsed` on `.app`, which drops the grid to a single column. The floating `#panel-toggle` button flips its chevron with `rotate: 180deg` and keeps `aria-expanded`/`aria-label` in sync.

## Local

```sh
npx http-server -c-1   # from repo root, then open /web/
```
