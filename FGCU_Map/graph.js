// JavaScript port of Graph.h / main.cpp, shared by the web app.
//
// Weighting is unchanged from the original: "shortest" accumulates feet,
// "quickest" accumulates (distance / speed) / 60 minutes, so one queue serves
// both modes. Two bugs from the C++ are fixed here:
//
//   1. main.cpp queues pair<string, double>, so greater<> ordered by building
//      name instead of weight and returned suboptimal routes.
//   2. addEdge aggregate-initialized `edge` with pathway and direction swapped.

export function buildGraph(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge);
  }
  return adjacency;
}

export function minutesFor(edge) {
  return edge.distance / edge.speed / 60;
}

export function findRoute(adjacency, start, end, mode) {
  if (start === end) return null;

  const shortest = mode === "shortest";
  const weights = new Map();
  const previous = new Map();
  const previousEdge = new Map();
  const visited = new Set();

  for (const name of adjacency.keys()) weights.set(name, Infinity);
  weights.set(start, 0);

  const queue = [{ name: start, weight: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.weight - b.weight);
    const { name: current } = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of adjacency.get(current) ?? []) {
      const step = shortest ? edge.distance : minutesFor(edge);
      const candidate = weights.get(current) + step;
      if (candidate < (weights.get(edge.to) ?? Infinity)) {
        weights.set(edge.to, candidate);
        previous.set(edge.to, current);
        previousEdge.set(edge.to, edge);
        queue.push({ name: edge.to, weight: candidate });
      }
    }
  }

  if (!previous.has(end)) return null;

  const path = [];
  const steps = [];
  let totalDistance = 0;
  let totalTime = 0;

  for (let at = end; at !== undefined; at = previous.get(at)) {
    path.unshift(at);
    const edge = previousEdge.get(at);
    if (edge) {
      steps.unshift(edge);
      totalDistance += edge.distance;
      totalTime += minutesFor(edge);
    }
  }

  return { path, steps, totalDistance, totalTime };
}
