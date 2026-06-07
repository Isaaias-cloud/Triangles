(function () {
  "use strict";

  function grid(size) {
    const step = 80 / (size - 1);
    const points = [];
    let id = 1;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        points.push({ id, x: 10 + col * step, y: 10 + row * step });
        id += 1;
      }
    }
    return points;
  }

  const fourCorners = [
    { id: 1, x: 18, y: 18 },
    { id: 2, x: 82, y: 18 },
    { id: 3, x: 18, y: 82 },
    { id: 4, x: 82, y: 82 }
  ];

  const eightPoints = [
    { id: 1, x: 18, y: 18 }, { id: 2, x: 50, y: 18 }, { id: 3, x: 82, y: 18 },
    { id: 4, x: 18, y: 50 }, { id: 5, x: 82, y: 50 },
    { id: 6, x: 18, y: 82 }, { id: 7, x: 50, y: 82 }, { id: 8, x: 82, y: 82 }
  ];

  const authored = [
    { id: 1, name: "Tu primer triangulo", objective: { triangles: 1 }, maxLines: 3, points: fourCorners },
    { id: 2, name: "Dos caras", objective: { triangles: 2 }, maxLines: 5, points: fourCorners },
    { id: 3, name: "Punta gemela", objective: { triangles: 1, type: "isosceles" }, maxLines: 4, points: eightPoints },
    { id: 4, name: "Doble ataque", objective: { triangles: 2, type: "isosceles" }, maxLines: 6, points: eightPoints },
    { id: 5, name: "Tres trazos maestros", objective: { triangles: 3 }, maxLines: 7, points: eightPoints },
    { id: 6, name: "Diagonal limpia", objective: { triangles: 2 }, maxLines: 6, points: grid(3) },
    { id: 7, name: "Centro exacto", objective: { triangles: 2, type: "isosceles" }, maxLines: 6, points: grid(3) },
    { id: 8, name: "Marco interior", objective: { triangles: 3 }, maxLines: 7, points: grid(3) },
    { id: 9, name: "Aguja escalena", objective: { triangles: 1, type: "escaleno" }, maxLines: 4, points: grid(4) },
    { id: 10, name: "Simetria oculta", objective: { triangles: 3, symmetric: true }, maxLines: 7, points: grid(4) }
  ];

  const names = [
    "Compas frio", "Nudo brillante", "Plano secreto", "Ritmo diagonal", "Vertice azul",
    "Sombra exacta", "Pulso de lineas", "Equilibrio", "Corte cristalino", "Triada central",
    "Mapa minimo", "Eje invisible", "Forma latente", "Red paciente", "Cierre perfecto",
    "Cruce sereno", "Orbe angular", "Prisma rapido", "Orden fino", "Ultima prueba"
  ];

  for (let i = 11; i <= 30; i += 1) {
    const size = i < 17 ? 4 : i < 25 ? 5 : 6;
    authored.push({
      id: i,
      name: names[i - 11],
      objective: {
        triangles: Math.min(8, 2 + Math.floor(i / 5)),
        type: i % 4 === 0 ? "isosceles" : i % 7 === 0 ? "escaleno" : undefined,
        symmetric: i % 5 === 0
      },
      maxLines: Math.min(15, 5 + Math.floor(i / 3)),
      points: grid(size)
    });
  }

  function procedural(id) {
    const difficulty = id - 30;
    const size = Math.min(7, 4 + Math.floor(difficulty / 7));
    const points = grid(size).filter((point) => {
      const ring = point.x < 12 || point.x > 88 || point.y < 12 || point.y > 88;
      return ring || ((point.id + id) % Math.max(2, 5 - Math.floor(difficulty / 12)) !== 0);
    });
    return {
      id,
      name: "Infinito " + (id - 30),
      objective: {
        triangles: Math.min(12, 3 + Math.floor(difficulty / 3)),
        type: id % 6 === 0 ? "isosceles" : id % 8 === 0 ? "escaleno" : undefined,
        symmetric: id % 5 === 0
      },
      maxLines: Math.min(20, 7 + Math.floor(difficulty / 2)),
      points
    };
  }

  function getLevel(id) {
    return authored.find((level) => level.id === id) || procedural(id);
  }

  function describeObjective(objective) {
    const type = objective.type ? " " + objective.type : "";
    const symmetry = objective.symmetric ? " simetricos" : "";
    return "Forma " + objective.triangles + " triangulo" + (objective.triangles === 1 ? "" : "s") + type + symmetry + ".";
  }

  window.Levels = { authored, getLevel, describeObjective, totalAuthored: authored.length };
}());
