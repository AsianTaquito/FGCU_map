# FGCU Map 🗺️

An interactive walking-route map for the Florida Gulf Coast University (FGCU) campus. Pick any two buildings and it finds the **shortest** or **quickest** route using Dijkstra's algorithm, then draws it on a map with step-by-step directions.

---

## 📜 Origin

This started as the original C++ program I wrote for my **Data Structures & Algorithms** class — a terminal app that read campus data from a CSV and ran Dijkstra's algorithm to find a path between two buildings. That code is still in this repo, unchanged, in [`FGCU_Map/legacy code/`](FGCU_Map/legacy%20code/).

I've decided to build on top of it, starting with this web app. The routing logic has been ported to JavaScript so it can run in the browser, and the campus data now lives in JSON instead of being parsed from CSV at runtime.

> **Note:** the port fixes two bugs found in the original C++ while converting it:
> 1. The priority queue was declared `pair<string, double>`, so `greater<>` ordered entries by **building name** rather than by weight — breaking Dijkstra's core invariant and returning suboptimal routes.
> 2. `addEdge` aggregate-initialized the `edge` struct with `pathway` and `direction` swapped.

---

## 🚀 Features
- Click any two buildings on the map, or pick them from the dropdowns
- Toggle between **shortest** (fewest feet) and **quickest** (least walking time, accounting for each pathway's speed)
- Turn-by-turn directions with compass headings, distances, and per-leg times
- Hover a step to highlight that leg on the map
- Pan and zoom
- Shareable route links — `#from=Alico_Arena&to=Seidler_Hall&by=quickest`

---

## 🗂️ Layout

```
FGCU_Map/        campus data + routing logic (shared core)
  campus.json      the map database: 42 buildings, 160 edges — single source of truth
  build-data.js    re-solves building coordinates from the edges in campus.json
  graph.js         Dijkstra implementation (JS port of the original C++)
  legacy code/     the original class project, archived
    main.cpp
    Graph.h
    fgcu.csv       the CSV the C++ version read at runtime
web/             the web app
  index.html
  styles.css
  app.js           map rendering + interaction
```

### Where the map coordinates come from

The source data never contained building positions — only a compass `direction` and a `distance` for each pathway. `FGCU_Map/build-data.js` treats those as constraints and solves for a set of coordinates that best satisfies all 160 of them at once (least-squares relaxation). The result stays geographically honest: the median edge is within **16 ft** of its stated distance, and every edge still points within its labeled compass octant.

Coordinates are derived, so don't hand-edit them — adding one building shifts its neighbors too. Add or change entries in the `edges` array, then re-solve:

```sh
node FGCU_Map/build-data.js
```

---

## 🧑‍💻 Running it locally

The page loads its data with `fetch`, so it needs a real server — opening `index.html` from the filesystem won't work. From the repo root:

```sh
npx http-server -c-1
```

Then open `http://localhost:8080/web/`.

---

## 🧰 Tech Stack
- **Web app:** plain HTML, CSS, and JavaScript — no framework, no build step, no dependencies
- **Algorithms:** Dijkstra's shortest path; least-squares layout solving for map coordinates
- **Hosting:** GitHub Pages, deployed by GitHub Actions on every push to `main`
- **Original:** C++ (`FGCU_Map/`)

---

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/10260/badge)](https://www.bestpractices.dev/projects/10260) 
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/AsianTaquito/FGCU_map/badge)](https://scorecard.dev/viewer/?uri=github.com/AsianTaquito/FGCU_map)
