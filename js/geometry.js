(function () {
  "use strict";

  const EPS = 0.001;

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function area(a, b, c) {
    return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
  }

  function edgeKey(a, b) {
    return [a, b].sort((x, y) => x - y).join("-");
  }

  function triangleKey(ids) {
    return ids.slice().sort((a, b) => a - b).join("-");
  }

  function triangleType(a, b, c) {
    const sides = [distance(a, b), distance(b, c), distance(a, c)].sort((x, y) => x - y);
    const close = (x, y) => Math.abs(x - y) < 0.75;
    if (close(sides[0], sides[1]) && close(sides[1], sides[2])) return "equilatero";
    if (close(sides[0], sides[1]) || close(sides[1], sides[2]) || close(sides[0], sides[2])) return "isosceles";
    return "escaleno";
  }

  function perimeter(a, b, c) {
    return distance(a, b) + distance(b, c) + distance(a, c);
  }

  function detectTriangles(points, lines) {
    const edgeSet = new Set(lines.map((line) => edgeKey(line.a, line.b)));
    const triangles = [];
    for (let i = 0; i < points.length - 2; i += 1) {
      for (let j = i + 1; j < points.length - 1; j += 1) {
        for (let k = j + 1; k < points.length; k += 1) {
          const p1 = points[i];
          const p2 = points[j];
          const p3 = points[k];
          const triArea = area(p1, p2, p3);
          if (triArea <= EPS) continue;
          if (!edgeSet.has(edgeKey(p1.id, p2.id))) continue;
          if (!edgeSet.has(edgeKey(p2.id, p3.id))) continue;
          if (!edgeSet.has(edgeKey(p1.id, p3.id))) continue;
          triangles.push({
            key: triangleKey([p1.id, p2.id, p3.id]),
            ids: [p1.id, p2.id, p3.id],
            area: triArea,
            perimeter: perimeter(p1, p2, p3),
            type: triangleType(p1, p2, p3)
          });
        }
      }
    }
    return triangles;
  }

  function isSymmetricTriangle(triangle, points) {
    const byId = new Map(points.map((point) => [point.id, point]));
    const xs = triangle.ids.map((id) => byId.get(id).x);
    const ys = triangle.ids.map((id) => byId.get(id).y);
    const avgX = xs.reduce((sum, x) => sum + x, 0) / 3;
    const avgY = ys.reduce((sum, y) => sum + y, 0) / 3;
    return Math.abs(avgX - 50) < 8 || Math.abs(avgY - 50) < 8;
  }

  function objectiveMet(level, triangles) {
    const objective = level.objective || {};
    let candidates = triangles;
    if (objective.type) candidates = candidates.filter((triangle) => triangle.type === objective.type);
    if (objective.symmetric) candidates = candidates.filter((triangle) => isSymmetricTriangle(triangle, level.points));
    return candidates.length >= (objective.triangles || 1);
  }

  window.Geometry = {
    distance,
    area,
    edgeKey,
    triangleKey,
    triangleType,
    perimeter,
    detectTriangles,
    objectiveMet
  };
}());
