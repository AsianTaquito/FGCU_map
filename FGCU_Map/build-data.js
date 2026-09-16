// Converts fgcu.csv into campus.json.
// Building coordinates are derived from the CSV 

const fs = require("fs");
const path = require("path");

const BEARINGS = {
  North: 0,
  Northeast: 45,
  East: 90,
  Southeast: 135,
  South: 180,
  Southwest: 225,
  West: 270,
  Northwest: 315,
};

const CSV_PATH = path.join(__dirname, "fgcu.csv");
const OUT_PATH = path.join(__dirname, "campus.json");

const VIEW_WIDTH = 1000;
const PADDING = 60;

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      const [from, pathway, to, direction, distance, speed] = line.split(",");
      if (!(direction in BEARINGS)) {
        throw new Error(`Line ${i + 1}: unknown direction "${direction}"`);
      }
      return {
        from,
        to,
        pathway,
        direction,
        distance: Number(distance),
        speed: Number(speed),
      };
    });
}

// Offset in feet from `from` to `to`, in screen orientation (x east, y south).
function offsetOf(edge) {
  const radians = (BEARINGS[edge.direction] * Math.PI) / 180;
  return {
    dx: edge.distance * Math.sin(radians),
    dy: -edge.distance * Math.cos(radians),
  };
}

function assertConnected(names, edges) {
  const neighbors = new Map(names.map((n) => [n, []]));
  for (const edge of edges) {
    neighbors.get(edge.from).push(edge.to);
    neighbors.get(edge.to).push(edge.from);
  }
  const seen = new Set([names[0]]);
  const stack = [names[0]];
  while (stack.length > 0) {
    for (const next of neighbors.get(stack.pop())) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  const missing = names.filter((n) => !seen.has(n));
  if (missing.length > 0) {
    throw new Error(`Graph is disconnected; unreachable: ${missing.join(", ")}`);
  }
}

function solveLayout(names, edges) {
  const positions = new Map(names.map((n) => [n, { x: 0, y: 0 }]));
  const neighbors = new Map(names.map((n) => [n, []]));
  for (const edge of edges) {
    const { dx, dy } = offsetOf(edge);
    neighbors.get(edge.from).push({ other: edge.to, dx, dy });
    neighbors.get(edge.to).push({ other: edge.from, dx: -dx, dy: -dy });
  }

  // Seed with a spanning-tree walk so relaxation starts near a valid shape.
  const root = [...names].sort(
    (a, b) => neighbors.get(b).length - neighbors.get(a).length
  )[0];
  const placed = new Set([root]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    const origin = positions.get(current);
    for (const link of neighbors.get(current)) {
      if (placed.has(link.other)) continue;
      placed.add(link.other);
      positions.set(link.other, { x: origin.x + link.dx, y: origin.y + link.dy });
      queue.push(link.other);
    }
  }

  // Jacobi relaxation: each node moves to the average position implied by its
  // neighbors. Converges to the least-squares fit of all edge constraints.
  for (let iteration = 0; iteration < 4000; iteration++) {
    const next = new Map();
    for (const name of names) {
      const links = neighbors.get(name);
      let sumX = 0;
      let sumY = 0;
      for (const link of links) {
        const from = positions.get(link.other);
        sumX += from.x - link.dx;
        sumY += from.y - link.dy;
      }
      next.set(name, { x: sumX / links.length, y: sumY / links.length });
    }
    for (const [name, point] of next) positions.set(name, point);
  }

  return positions;
}

function normalize(positions) {
  const points = [...positions.values()];
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  // Uniform scale keeps the map geographically honest instead of stretching it.
  const scale = (VIEW_WIDTH - PADDING * 2) / (maxX - minX);
  const height = (maxY - minY) * scale + PADDING * 2;

  const scaled = new Map();
  for (const [name, point] of positions) {
    scaled.set(name, {
      x: Number(((point.x - minX) * scale + PADDING).toFixed(1)),
      y: Number(((point.y - minY) * scale + PADDING).toFixed(1)),
    });
  }
  return { scaled, width: VIEW_WIDTH, height: Number(height.toFixed(1)) };
}

function reportFit(edges, positions, scale) {
  let worst = 0;
  for (const edge of edges) {
    const a = positions.get(edge.from);
    const b = positions.get(edge.to);
    const drawn = Math.hypot(b.x - a.x, b.y - a.y) / scale;
    worst = Math.max(worst, Math.abs(drawn - edge.distance));
  }
  return Math.round(worst);
}

const edges = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
const names = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort();

assertConnected(names, edges);

const solved = solveLayout(names, edges);
const { scaled, width, height } = normalize(solved);
const scale = (VIEW_WIDTH - PADDING * 2) /
  (Math.max(...[...solved.values()].map((p) => p.x)) -
    Math.min(...[...solved.values()].map((p) => p.x)));

const campus = {
  source: "FGCU_Map/fgcu.csv",
  view: { width, height },
  buildings: names.map((name) => ({
    id: name,
    label: name.replace(/_/g, " "),
    x: scaled.get(name).x,
    y: scaled.get(name).y,
  })),
  edges,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(campus, null, 2) + "\n");

console.log(`${names.length} buildings, ${edges.length} edges -> ${path.basename(OUT_PATH)}`);
console.log(`view ${width} x ${height}, worst edge error ${reportFit(edges, scaled, scale)} ft`);
