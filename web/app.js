import { buildGraph, findRoute, minutesFor } from "../FGCU_Map/graph.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_SIZE = 22;
const BEARINGS = {
  North: 0, Northeast: 45, East: 90, Southeast: 135,
  South: 180, Southwest: 225, West: 270, Northwest: 315,
};

const el = {
  svg: document.getElementById("map"),
  viewport: document.getElementById("viewport"),
  paths: document.getElementById("layer-paths"),
  route: document.getElementById("layer-route"),
  nodes: document.getElementById("layer-nodes"),
  labels: document.getElementById("layer-labels"),
  hover: document.getElementById("layer-hover"),
  start: document.getElementById("start"),
  end: document.getElementById("end"),
  summary: document.getElementById("summary"),
  steps: document.getElementById("steps"),
  hint: document.getElementById("hint"),
};

const state = { start: null, end: null, mode: "shortest", route: null };
const nodeEls = new Map();
const labelEls = new Map();
let campus;
let graph;
let positions;

init();

async function init() {
  campus = await fetch("../FGCU_Map/campus.json").then((r) => r.json());
  graph = buildGraph(campus.edges);
  positions = new Map(campus.buildings.map((b) => [b.id, b]));

  el.svg.setAttribute("viewBox", `0 0 ${campus.view.width} ${campus.view.height}`);
  el.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  drawPathways();
  drawBuildings();
  drawLabels();
  fillSelects();
  bindControls();
  readHash();
  render();
}


function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const from = params.get("from");
  const to = params.get("to");

  state.start = positions.has(from) ? from : null;
  state.end = positions.has(to) ? to : null;
  state.mode = params.get("by") === "quickest" ? "quickest" : "shortest";
  document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
}

// replaceState does not fire hashchange, so this will not loop back into readHash.
function writeHash() {
  const params = new URLSearchParams();
  if (state.start) params.set("from", state.start);
  if (state.end) params.set("to", state.end);
  if (state.mode === "quickest") params.set("by", state.mode);
  history.replaceState(null, "", params.size > 0 ? `#${params}` : location.pathname);
}

/* ---------------- map drawing ---------------- */

function drawPathways() {
  const seen = new Set();
  for (const edge of campus.edges) {
    const key = [edge.from, edge.to].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const a = positions.get(edge.from);
    const b = positions.get(edge.to);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", edge.bridge ? "edge edge--bridge" : "edge");
    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);
    el.paths.append(line);

    // A bridge is the wide rail stroke above plus a dashed deck over it, so the
    // gaps between the planks read as a boardwalk from above.
    if (edge.bridge) {
      const deck = line.cloneNode();
      deck.setAttribute("class", "bridge-deck");
      el.paths.append(deck);
    }
  }
}

// A <symbol> serves the building its own id names, plus any listed in its
// data-for, so one drawing covers a dozen lookalike halls.
function iconIndex() {
  const index = new Map();
  for (const symbol of document.querySelectorAll("symbol[id^='icon-']")) {
    index.set(symbol.id.slice("icon-".length), symbol.id);
    for (const id of (symbol.dataset.for ?? "").split(/\s+/).filter(Boolean)) {
      index.set(id, symbol.id);
    }
  }
  return index;
}

function drawBuildings() {
  const icons = iconIndex();

  for (const building of campus.buildings) {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "node");
    group.dataset.id = building.id;

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", building.x);
    circle.setAttribute("cy", building.y);
    circle.setAttribute("r", 5.5);

    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = building.label;

    group.append(circle, title);

    // A building draws as an icon when a <symbol> claims it; no icon, no
    // config. The circle stays underneath as the hit target.
    const iconId = icons.get(building.id);
    if (iconId) {
      group.classList.add("has-icon");

      // The icon hangs off a <g> parked at the building, drawn around 0,0 in
      // that local space. Scaling it then grows it in place, with no reliance
      // on transform-box: fill-box, which does not resolve on <use>.
      const anchor = document.createElementNS(SVG_NS, "g");
      anchor.setAttribute("transform", `translate(${building.x} ${building.y})`);

      const use = document.createElementNS(SVG_NS, "use");
      use.setAttribute("href", `#${iconId}`);
      use.setAttribute("class", "icon");
      use.setAttribute("x", -ICON_SIZE / 2);
      use.setAttribute("y", -ICON_SIZE / 2);
      use.setAttribute("width", ICON_SIZE);
      use.setAttribute("height", ICON_SIZE);

      anchor.append(use);
      group.append(anchor);
    }
    group.addEventListener("pointerenter", () => setLabelActive(building.id, true));
    group.addEventListener("pointerleave", () => setLabelActive(building.id, false));
    group.addEventListener("pointerenter", () => hoverNode(building.id, true));
    group.addEventListener("pointerleave", () => hoverNode(building.id, false));
    el.nodes.append(group);
    nodeEls.set(building.id, group);
  }
}

// Labels sit below their building unless that spot is taken, then above/right/left.
function drawLabels() {
  const boxes = [];
  const fits = (box) =>
    !boxes.some((b) =>
      Math.abs(b.x - box.x) < (b.w + box.w) / 2 && Math.abs(b.y - box.y) < 11
    );

  for (const building of campus.buildings) {
    const width = building.label.length * 5.4;
    const right = width / 2 + 11;
    const spots = [
      { x: building.x, y: building.y + 17 },
      { x: building.x, y: building.y - 11 },
      { x: building.x + right, y: building.y + 4 },
      { x: building.x - right, y: building.y + 4 },
      { x: building.x + right, y: building.y - 9 },
      { x: building.x - right, y: building.y - 9 },
      { x: building.x + right, y: building.y + 16 },
      { x: building.x - right, y: building.y + 16 },
      { x: building.x, y: building.y + 27 },
      { x: building.x, y: building.y - 21 },
    ];
    const spot = spots.find((s) => fits({ ...s, w: width })) ?? spots[0];
    boxes.push({ ...spot, w: width });

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("class", "label");
    text.setAttribute("x", spot.x);
    text.setAttribute("y", spot.y);
    text.textContent = building.label;
    el.labels.append(text);
    labelEls.set(building.id, text);
  }
}

// Its own class, not is-active: render() owns that one for the start and end,
// and a hover leaving would otherwise strip a selected label's emphasis.
function setLabelActive(id, active) {
  labelEls.get(id)?.classList.toggle("is-hovered", active);
// SVG has no z-index, so the hovered building moves into the last layer to
// paint over every other icon and name, its label after it so the name stays
// readable on top of the enlarged icon.
//
// is-hovered is its own class, not is-active: render() owns that one for the
// start and end, and leaving would otherwise strip a selected label's emphasis.
function hoverNode(id, active) {
  const node = nodeEls.get(id);
  const label = labelEls.get(id);
  if (!node || !label) return;

  // Moving an element re-runs hit testing, which can fire a leave for the node
  // still under the pointer. Ignoring that keeps it from ping-ponging layers.
  if (!active && node.matches(":hover")) return;
  if (active === (node.parentNode === el.hover)) return;

  label.classList.toggle("is-hovered", active);
  if (active) el.hover.append(node, label);
  else {
    el.nodes.append(node);
    el.labels.append(label);
  }
}

/* ---------------- controls ---------------- */

function fillSelects() {
  const options = campus.buildings
    .map((b) => `<option value="${b.id}">${b.label}</option>`)
    .join("");
  for (const select of [el.start, el.end]) {
    select.innerHTML = `<option value="">Select a building…</option>${options}`;
  }
}

function bindControls() {
  el.start.addEventListener("change", () => {
    state.start = el.start.value || null;
    render();
  });
  el.end.addEventListener("change", () => {
    state.end = el.end.value || null;
    render();
  });

  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener("change", () => {
      state.mode = radio.value;
      render();
    });
  }

  document.getElementById("swap").addEventListener("click", () => {
    [state.start, state.end] = [state.end, state.start];
    render();
  });

  document.getElementById("clear").addEventListener("click", clear);

  const toggle = document.getElementById("panel-toggle");
  toggle.addEventListener("click", () => {
    const open = !document.querySelector(".app").classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(open));
    const text = open ? "Hide panel" : "Show panel";
    toggle.title = text;
    toggle.setAttribute("aria-label", text);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clear();
  });

  window.addEventListener("hashchange", () => {
    readHash();
    render();
  });

  setupPanZoom();
}

function pick(id) {
  if (!state.start || (state.start && state.end)) {
    state.start = id;
    state.end = null;
  } else if (id !== state.start) {
    state.end = id;
  }
  render();
}

function clear() {
  state.start = null;
  state.end = null;
  render();
}

/* ---------------- render ---------------- */

function render() {
  el.start.value = state.start ?? "";
  el.end.value = state.end ?? "";

  state.route =
    state.start && state.end
      ? findRoute(graph, state.start, state.end, state.mode)
      : null;

  const onRoute = new Set(state.route?.path ?? []);
  for (const [id, node] of nodeEls) {
    node.classList.toggle("is-start", id === state.start);
    node.classList.toggle("is-end", id === state.end);
    node.classList.toggle("on-route", onRoute.has(id));
    labelEls.get(id).classList.toggle(
      "is-active",
      id === state.start || id === state.end
    );
  }

  drawRoute();
  renderSummary();
  renderSteps();

  el.hint.textContent = !state.start
    ? "Tap a building to set your start"
    : !state.end
      ? "Now tap your destination"
      : "";

  writeHash();
}

function drawRoute() {
  el.route.replaceChildren();
  if (!state.route) return;

  const points = state.route.path.map((id) => {
    const p = positions.get(id);
    return `${p.x},${p.y}`;
  });

  const glow = document.createElementNS(SVG_NS, "polyline");
  glow.setAttribute("class", "route-glow");
  glow.setAttribute("points", points.join(" "));
  el.route.append(glow);

  state.route.steps.forEach((step, i) => {
    const a = positions.get(step.from);
    const b = positions.get(step.to);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "route-line");
    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);
    line.style.animationDelay = `${i * 45}ms`;
    el.route.append(line);
  });
}

function renderSummary() {
  if (!state.route) {
    const sameSpot = state.start && state.start === state.end;
    el.summary.className = sameSpot ? "summary summary--error" : "summary";
    el.summary.textContent = sameSpot ? "You're already there." : "";
    return;
  }

  const { totalDistance, totalTime, steps } = state.route;
  el.summary.className = "summary";
  el.summary.innerHTML = `
    <div class="stat"><b>${totalDistance.toLocaleString()} ft</b><span>Distance</span></div>
    <div class="stat"><b>${totalTime.toFixed(1)} min</b><span>Walk time</span></div>
    <div class="stat"><b>${steps.length}</b><span>Legs</span></div>`;
}

function renderSteps() {
  el.steps.replaceChildren();
  if (!state.route) return;

  el.steps.append(
    stepRow({
      role: "start",
      pin: flagIcon(),
      where: label(state.start),
      meta: "Starting point",
    })
  );

  state.route.steps.forEach((step, i) => {
    const row = stepRow({
      role: i === state.route.steps.length - 1 ? "end" : "via",
      pin: arrowIcon(step.direction),
      where: label(step.to),
      meta: `${step.direction} · ${step.distance} ft · ${minutesFor(step).toFixed(1)} min`,
    });
    row.addEventListener("pointerenter", () => highlightSegment(i, true));
    row.addEventListener("pointerleave", () => highlightSegment(i, false));
    el.steps.append(row);
  });
}

function stepRow({ role, pin, where, meta }) {
  const li = document.createElement("li");
  li.dataset.role = role;
  li.innerHTML = `<span class="pin">${pin}</span><span><span class="where">${where}</span><br><span class="meta">${meta}</span></span>`;
  return li;
}

function highlightSegment(index, on) {
  el.route
    .querySelectorAll(".route-line")[index]
    ?.classList.toggle("is-highlighted", on);
}

function label(id) {
  return positions.get(id)?.label ?? id;
}

function arrowIcon(direction) {
  return `<svg viewBox="0 0 24 24" style="rotate:${BEARINGS[direction]}deg"><path d="M12 19V5M12 5l-5 5M12 5l5 5"/></svg>`;
}

function flagIcon() {
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#fff" stroke="none"/></svg>`;
}

/* ---------------- pan + zoom ---------------- */

function setupPanZoom() {
  const view = { scale: 1, x: 0, y: 0 };
  let dragging = null;

  const apply = () =>
    el.viewport.setAttribute(
      "transform",
      `translate(${view.x} ${view.y}) scale(${view.scale})`
    );

  const toSvg = (event) => {
    const point = el.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(el.svg.getScreenCTM().inverse());
  };

  const zoomAt = (factor, origin) => {
    const next = Math.min(6, Math.max(0.6, view.scale * factor));
    const applied = next / view.scale;
    view.x = origin.x - (origin.x - view.x) * applied;
    view.y = origin.y - (origin.y - view.y) * applied;
    view.scale = next;
    apply();
  };

  el.svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, toSvg(event));
  }, { passive: false });

  // px/py are read off the point one at a time on purpose: the DOMPoint that
  // matrixTransform returns keeps x and y on its prototype, so spreading it
  // copies nothing and every later delta comes out NaN.
  el.svg.addEventListener("pointerdown", (event) => {
    const point = toSvg(event);
    dragging = {
      px: point.x,
      py: point.y,
      x0: view.x,
      y0: view.y,
      cx: event.clientX,
      cy: event.clientY,
      moved: 0,
      node: event.target.closest?.(".node") ?? null,
    };
    el.svg.setPointerCapture(event.pointerId);
    el.svg.classList.add("is-panning");
  });

  // On window, not the svg: a captured pointer still bubbles here, and a move
  // that slips outside the map keeps panning instead of stalling.
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    dragging.moved = Math.max(
      dragging.moved,
      Math.hypot(event.clientX - dragging.cx, event.clientY - dragging.cy)
    );
    const now = toSvg(event);
    view.x = dragging.x0 + (now.x - dragging.px);
    view.y = dragging.y0 + (now.y - dragging.py);
    apply();
  });

  // Buildings cannot use a click listener: capturing the pointer retargets the
  // click to the <svg>. A press that never turned into a pan is the tap.
  window.addEventListener("pointerup", () => {
    if (dragging?.node && dragging.moved < 4) pick(dragging.node.dataset.id);
  });

  for (const type of ["pointerup", "pointercancel"]) {
    window.addEventListener(type, () => {
      dragging = null;
      el.svg.classList.remove("is-panning");
    });
  }

  for (const button of document.querySelectorAll("[data-zoom]")) {
    button.addEventListener("click", () => {
      const center = { x: campus.view.width / 2, y: campus.view.height / 2 };
      if (button.dataset.zoom === "reset") {
        Object.assign(view, { scale: 1, x: 0, y: 0 });
        apply();
      } else {
        zoomAt(button.dataset.zoom === "in" ? 1.3 : 1 / 1.3, center);
      }
    });
  }
}
