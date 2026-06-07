(function () {
  "use strict";

  const storageKey = "triangulum.v1";
  const svgNS = "http://www.w3.org/2000/svg";
  const state = {
    screen: "menuScreen",
    levelId: 1,
    level: null,
    selectedPoint: null,
    lines: [],
    triangles: [],
    startedAt: 0,
    timerId: null,
    hints: 0,
    restarts: 0,
    moves: 0,
    completedShown: false,
    data: loadData()
  };

  const el = {};

  function loadData() {
    const base = {
      unlocked: 1,
      completed: {},
      settings: { sound: true, motion: true, theme: "auto" },
      stats: { completed: 0, totalTime: 0, triangles: 0, bestStreak: 0, streak: 0, stars: 0, bestScore: 0 }
    };
    try {
      return Object.assign(base, JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch (error) {
      return base;
    }
  }

  function saveData() {
    localStorage.setItem(storageKey, JSON.stringify(state.data));
  }

  function cacheElements() {
    [
      "backBtn", "themeBtn", "soundBtn", "playBtn", "overallProgressText", "overallProgressBar",
      "completedCount", "bestStars", "bestScore", "levelGrid", "levelLabel", "levelName",
      "objectiveText", "lineCount", "lineLeft", "triangleCount", "boardSvg", "timerText",
      "undoBtn", "restartBtn", "hintBtn", "triangleList", "victoryTitle", "victoryStars",
      "victoryTime", "victoryMoves", "victoryTriangles", "retryBtn", "nextBtn", "confetti",
      "soundToggle", "motionToggle", "themeSelect", "resetProgressBtn", "statsGrid"
    ].forEach((id) => { el[id] = document.getElementById(id); });
  }

  function applySettings() {
    const settings = state.data.settings;
    const dark = settings.theme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.motion = settings.motion ? "on" : "off";
    el.soundBtn.textContent = settings.sound ? "♪" : "×";
    el.soundToggle.checked = settings.sound;
    el.motionToggle.checked = settings.motion;
    el.themeSelect.value = settings.theme;
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
    state.screen = id;
    el.backBtn.classList.toggle("d-none", id === "menuScreen");
    if (id !== "gameScreen") stopTimer();
    if (id === "menuScreen") renderMenu();
    if (id === "levelsScreen") renderLevels();
    if (id === "statsScreen") renderStats();
  }

  function renderMenu() {
    const completed = Object.keys(state.data.completed).length;
    const pct = Math.round((completed / Levels.totalAuthored) * 100);
    el.overallProgressText.textContent = Math.min(100, pct) + "%";
    el.overallProgressBar.style.width = Math.min(100, pct) + "%";
    el.completedCount.textContent = completed;
    el.bestStars.textContent = state.data.stats.stars;
    el.bestScore.textContent = state.data.stats.bestScore;
  }

  function renderLevels() {
    el.levelGrid.innerHTML = "";
    const count = Math.max(Levels.totalAuthored, state.data.unlocked + 4);
    for (let id = 1; id <= count; id += 1) {
      const level = Levels.getLevel(id);
      const record = state.data.completed[id];
      const button = document.createElement("button");
      button.className = "level-tile";
      button.disabled = id > state.data.unlocked;
      button.innerHTML = "<strong>" + id + "</strong><span>" + level.name + "</span><div class='stars'>" + stars(record ? record.stars : 0) + "</div>";
      button.addEventListener("click", () => startLevel(id));
      el.levelGrid.appendChild(button);
    }
  }

  function startLevel(id) {
    state.levelId = id;
    state.level = Levels.getLevel(id);
    state.selectedPoint = null;
    state.lines = [];
    state.triangles = [];
    state.hints = 0;
    state.restarts = 0;
    state.moves = 0;
    state.completedShown = false;
    state.startedAt = Date.now();
    el.levelLabel.textContent = "Nivel " + id;
    el.levelName.textContent = state.level.name;
    el.objectiveText.textContent = Levels.describeObjective(state.level.objective);
    showScreen("gameScreen");
    startTimer();
    renderBoard();
  }

  function renderBoard(hint) {
    el.boardSvg.innerHTML = "";
    state.triangles.forEach((triangle) => {
      const points = triangle.ids.map(getPoint);
      const polygon = svg("polygon", { points: points.map((p) => p.x + "," + p.y).join(" "), class: "triangle-fill" });
      el.boardSvg.appendChild(polygon);
    });
    state.lines.forEach((line) => {
      const a = getPoint(line.a);
      const b = getPoint(line.b);
      el.boardSvg.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge-line" }));
    });
    if (hint && hint.a && hint.b) {
      el.boardSvg.appendChild(svg("line", { x1: hint.a.x, y1: hint.a.y, x2: hint.b.x, y2: hint.b.y, class: "hint-line" }));
    }
    state.level.points.forEach((point) => {
      const hit = svg("circle", { cx: point.x, cy: point.y, r: 4.8, class: "point-hit" });
      hit.addEventListener("click", () => selectPoint(point.id));
      el.boardSvg.appendChild(hit);
      const circle = svg("circle", { cx: point.x, cy: point.y, r: 1.75, class: pointClass(point, hint) });
      circle.addEventListener("click", () => selectPoint(point.id));
      el.boardSvg.appendChild(circle);
      el.boardSvg.appendChild(svg("text", { x: point.x + 2.4, y: point.y - 2.4, class: "point-label" }, point.id));
    });
    updateCounters();
  }

  function pointClass(point, hint) {
    const classes = ["point"];
    if (state.selectedPoint === point.id) classes.push("selected");
    if (hint && (hint.a.id === point.id || hint.b.id === point.id)) classes.push("hinted");
    return classes.join(" ");
  }

  function svg(name, attrs, text) {
    const node = document.createElementNS(svgNS, name);
    Object.keys(attrs).forEach((key) => node.setAttribute(key, attrs[key]));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function selectPoint(id) {
    if (!state.selectedPoint) {
      state.selectedPoint = id;
      renderBoard();
      tapSound(260, 0.04);
      return;
    }
    if (state.selectedPoint === id) {
      state.selectedPoint = null;
      renderBoard();
      return;
    }
    addLine(state.selectedPoint, id);
    state.selectedPoint = null;
    renderBoard();
  }

  function addLine(a, b) {
    const key = Geometry.edgeKey(a, b);
    if (state.lines.some((line) => Geometry.edgeKey(line.a, line.b) === key)) {
      tapSound(130, 0.05);
      return;
    }
    if (state.lines.length >= state.level.maxLines) {
      tapSound(110, 0.07);
      return;
    }
    state.lines.push({ a, b });
    state.moves += 1;
    const before = state.triangles.length;
    state.triangles = Geometry.detectTriangles(state.level.points, state.lines);
    if (state.triangles.length > before) {
      tapSound(560, 0.08);
      setTimeout(() => tapSound(720, 0.06), 70);
    } else {
      tapSound(330, 0.04);
    }
    if (Geometry.objectiveMet(state.level, state.triangles)) {
      setTimeout(completeLevel, 420);
    }
  }

  function updateCounters() {
    el.lineCount.textContent = state.lines.length + "/" + state.level.maxLines;
    el.lineLeft.textContent = Math.max(0, state.level.maxLines - state.lines.length);
    el.triangleCount.textContent = state.triangles.length;
    el.triangleList.innerHTML = state.triangles.length ? "" : "<p>Aun no hay triangulos validos.</p>";
    state.triangles.forEach((triangle, index) => {
      const p = document.createElement("p");
      p.textContent = "#" + (index + 1) + " " + triangle.type + " · area " + triangle.area.toFixed(1) + " · perimetro " + triangle.perimeter.toFixed(1);
      el.triangleList.appendChild(p);
    });
  }

  function undo() {
    if (!state.lines.length) return;
    state.lines.pop();
    state.moves += 1;
    state.selectedPoint = null;
    state.triangles = Geometry.detectTriangles(state.level.points, state.lines);
    renderBoard();
  }

  function restart() {
    state.lines = [];
    state.triangles = [];
    state.selectedPoint = null;
    state.restarts += 1;
    state.moves += 1;
    renderBoard();
  }

  function hint() {
    state.hints += 1;
    const candidate = findHintLine();
    renderBoard(candidate);
    tapSound(420, 0.04);
    setTimeout(() => renderBoard(), 1400);
  }

  function findHintLine() {
    const points = state.level.points;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const key = Geometry.edgeKey(points[i].id, points[j].id);
        if (!state.lines.some((line) => Geometry.edgeKey(line.a, line.b) === key)) {
          const testLines = state.lines.concat({ a: points[i].id, b: points[j].id });
          if (Geometry.detectTriangles(points, testLines).length > state.triangles.length) return { a: points[i], b: points[j] };
        }
      }
    }
    return { a: points[0], b: points[Math.min(points.length - 1, 1)] };
  }

  function completeLevel() {
    if (state.completedShown) return;
    state.completedShown = true;
    const seconds = elapsedSeconds();
    const earned = computeStars();
    const previous = state.data.completed[state.levelId];
    if (!previous || earned > previous.stars) {
      state.data.stats.stars += earned - (previous ? previous.stars : 0);
      state.data.completed[state.levelId] = { stars: earned, time: seconds, moves: state.moves };
    }
    if (!previous) {
      state.data.stats.completed += 1;
      state.data.stats.streak += 1;
      state.data.stats.bestStreak = Math.max(state.data.stats.bestStreak, state.data.stats.streak);
    }
    state.data.unlocked = Math.max(state.data.unlocked, state.levelId + 1);
    state.data.stats.totalTime += seconds;
    state.data.stats.triangles += state.triangles.length;
    state.data.stats.bestScore = Math.max(state.data.stats.bestScore, earned * 1000 - state.moves * 15 - state.hints * 90);
    saveData();
    el.victoryTitle.textContent = state.level.name;
    el.victoryStars.textContent = stars(earned);
    el.victoryTime.textContent = formatTime(seconds);
    el.victoryMoves.textContent = state.moves;
    el.victoryTriangles.textContent = state.triangles.length;
    victorySound();
    confetti();
    showScreen("victoryScreen");
  }

  function computeStars() {
    let score = 3;
    if (state.hints > 0 || state.restarts > 0) score -= 1;
    if (state.hints > 1 || state.moves > state.level.maxLines + 3) score -= 1;
    return Math.max(1, score);
  }

  function stars(count) {
    return "★".repeat(count) + "☆".repeat(3 - count);
  }

  function getPoint(id) {
    return state.level.points.find((point) => point.id === id);
  }

  function startTimer() {
    stopTimer();
    el.timerText.textContent = "00:00";
    state.timerId = setInterval(() => {
      el.timerText.textContent = formatTime(elapsedSeconds());
    }, 500);
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  function elapsedSeconds() {
    return Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  }

  function formatTime(total) {
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return minutes + ":" + seconds;
  }

  function tapSound(freq, length) {
    if (!state.data.settings.sound) return;
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
    osc.stop(audio.currentTime + length);
  }

  function victorySound() {
    [440, 554, 659, 880].forEach((freq, index) => setTimeout(() => tapSound(freq, 0.09), index * 85));
  }

  function confetti() {
    el.confetti.innerHTML = "";
    for (let i = 0; i < 70; i += 1) {
      const bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "vw";
      bit.style.animationDelay = Math.random() * 280 + "ms";
      bit.style.background = ["var(--primary)", "var(--primary-2)", "var(--accent)", "var(--danger)"][i % 4];
      el.confetti.appendChild(bit);
    }
    setTimeout(() => { el.confetti.innerHTML = ""; }, 1700);
  }

  function renderStats() {
    const stats = state.data.stats;
    const items = [
      ["Niveles completados", Object.keys(state.data.completed).length],
      ["Tiempo total", formatTime(stats.totalTime)],
      ["Triangulos creados", stats.triangles],
      ["Mejor racha", stats.bestStreak],
      ["Estrellas", stats.stars],
      ["Mejor puntuacion", stats.bestScore]
    ];
    el.statsGrid.innerHTML = "";
    items.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.innerHTML = "<strong>" + value + "</strong><span>" + label + "</span>";
      el.statsGrid.appendChild(card);
    });
  }

  function bindEvents() {
    el.playBtn.addEventListener("click", () => startLevel(state.data.unlocked));
    el.backBtn.addEventListener("click", () => showScreen("menuScreen"));
    el.undoBtn.addEventListener("click", undo);
    el.restartBtn.addEventListener("click", restart);
    el.hintBtn.addEventListener("click", hint);
    el.retryBtn.addEventListener("click", () => startLevel(state.levelId));
    el.nextBtn.addEventListener("click", () => startLevel(state.levelId + 1));
    el.themeBtn.addEventListener("click", () => {
      state.data.settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      saveData();
      applySettings();
    });
    el.soundBtn.addEventListener("click", () => {
      state.data.settings.sound = !state.data.settings.sound;
      saveData();
      applySettings();
    });
    el.soundToggle.addEventListener("change", () => {
      state.data.settings.sound = el.soundToggle.checked;
      saveData();
      applySettings();
    });
    el.motionToggle.addEventListener("change", () => {
      state.data.settings.motion = el.motionToggle.checked;
      saveData();
      applySettings();
    });
    el.themeSelect.addEventListener("change", () => {
      state.data.settings.theme = el.themeSelect.value;
      saveData();
      applySettings();
    });
    el.resetProgressBtn.addEventListener("click", () => {
      if (!confirm("Reiniciar todo el progreso?")) return;
      localStorage.removeItem(storageKey);
      state.data = loadData();
      applySettings();
      showScreen("menuScreen");
    });
    document.querySelectorAll("[data-screen]").forEach((button) => {
      button.addEventListener("click", () => showScreen(button.dataset.screen));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindEvents();
    applySettings();
    renderMenu();
  });
}());
