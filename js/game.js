(function () {
  "use strict";

  const storageKey = "triangulum.v2";
  const legacyStorageKey = "triangulum.v1";
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
    lastCoinReward: 0,
    lastEarnedStars: 0,
    rewardDoubled: false,
    starRecovered: false,
    adManager: null,
    data: loadData()
  };

  const el = {};

  function defaults() {
    return {
      unlocked: 1,
      completed: {},
      settings: { sound: true, motion: true, theme: "auto", visualTheme: "classic" },
      stats: { completed: 0, totalTime: 0, triangles: 0, bestStreak: 0, streak: 0, stars: 0, bestScore: 0 },
      economy: { coins: 120, hints: 1, unlockTokens: 0, premium: false, ownedThemes: ["classic", "dark"], activeTheme: "classic" },
      monetization: {
        bannersShown: 0,
        interstitialsShown: 0,
        rewardedWatched: 0,
        adsViewed: 0,
        rewardsGranted: 0,
        coinsEarned: 0,
        coinsSpent: 0,
        hintsEarned: 0,
        levelsCompletedSinceInterstitial: 0
      }
    };
  }

  function merge(base, incoming) {
    Object.keys(incoming || {}).forEach((key) => {
      if (incoming[key] && typeof incoming[key] === "object" && !Array.isArray(incoming[key])) {
        base[key] = merge(base[key] || {}, incoming[key]);
      } else {
        base[key] = incoming[key];
      }
    });
    return base;
  }

  function loadData() {
    const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "{}";
    try {
      return merge(defaults(), JSON.parse(saved));
    } catch (error) {
      return defaults();
    }
  }

  function saveData() {
    localStorage.setItem(storageKey, JSON.stringify(state.data));
  }

  function cacheElements() {
    [
      "backBtn", "themeBtn", "soundBtn", "coinCount", "playBtn", "overallProgressText", "overallProgressBar",
      "completedCount", "bestStars", "bestScore", "levelGrid", "levelLabel", "levelName",
      "objectiveText", "lineCount", "lineLeft", "triangleCount", "boardSvg", "timerText",
      "undoBtn", "restartBtn", "hintBtn", "rewardHintBtn", "triangleList", "victoryTitle", "victoryStars",
      "victoryTime", "victoryMoves", "victoryTriangles", "coinRewardText", "doubleRewardBtn",
      "recoverStarBtn", "retryBtn", "nextBtn", "confetti", "soundToggle", "motionToggle",
      "themeSelect", "resetProgressBtn", "statsGrid", "shopCoins", "shopHints", "premiumStatus", "shopGrid"
    ].forEach((id) => { el[id] = document.getElementById(id); });
  }

  function setupAds() {
    state.adManager = new AdManager({
      getData: () => state.data,
      saveData,
      onReward: handleReward,
      onEconomyChanged: renderEconomy
    });
    window.showBannerAd = (position) => state.adManager.showBannerAd(position);
    window.hideBannerAd = (position) => state.adManager.hideBannerAd(position);
    window.refreshBannerAd = (position) => state.adManager.refreshBannerAd(position);
    window.showRewardedAd = (rewardType) => state.adManager.showRewardedAd(rewardType);
    window.grantReward = (rewardType) => state.adManager.grantReward(rewardType);
    window.showInterstitialAd = () => state.adManager.showInterstitialAd();
    window.canShowInterstitial = () => state.adManager.canShowInterstitial();
  }

  function applySettings() {
    const settings = state.data.settings;
    const dark = settings.theme === "dark" || settings.visualTheme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.motion = settings.motion ? "on" : "off";
    document.documentElement.dataset.visualTheme = state.data.economy.activeTheme;
    el.soundBtn.textContent = settings.sound ? "S" : "X";
    el.soundToggle.checked = settings.sound;
    el.motionToggle.checked = settings.motion;
    el.themeSelect.value = settings.theme;
    renderEconomy();
  }

  function showScreen(id) {
    const previous = state.screen;
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
    state.screen = id;
    el.backBtn.classList.toggle("d-none", id === "menuScreen");
    if (id !== "gameScreen") stopTimer();
    renderContextualAds(id);
    if (id === "menuScreen") {
      renderMenu();
      if (previous !== "menuScreen" && previous !== "gameScreen" && state.adManager.canShowInterstitial()) {
        state.adManager.showInterstitialAd();
      }
    }
    if (id === "levelsScreen") renderLevels();
    if (id === "shopScreen") renderShop();
    if (id === "statsScreen") renderStats();
  }

  function renderContextualAds(id) {
    ["menu-bottom", "levels-inline", "victory-small", "settings-bottom"].forEach((position) => state.adManager.hideBannerAd(position));
    if (id === "menuScreen") state.adManager.showBannerAd("menu-bottom");
    if (id === "levelsScreen") state.adManager.showBannerAd("levels-inline");
    if (id === "victoryScreen") state.adManager.showBannerAd("victory-small");
    if (id === "settingsScreen") state.adManager.showBannerAd("settings-bottom");
  }

  function renderMenu() {
    const completed = Object.keys(state.data.completed).length;
    const pct = Math.round((completed / Levels.totalAuthored) * 100);
    el.overallProgressText.textContent = Math.min(100, pct) + "%";
    el.overallProgressBar.style.width = Math.min(100, pct) + "%";
    el.completedCount.textContent = completed;
    el.bestStars.textContent = state.data.stats.stars;
    el.bestScore.textContent = state.data.stats.bestScore;
    renderEconomy();
  }

  function renderEconomy() {
    if (!el.coinCount) return;
    el.coinCount.textContent = state.data.economy.coins;
    if (el.shopCoins) el.shopCoins.textContent = state.data.economy.coins;
    if (el.shopHints) el.shopHints.textContent = state.data.economy.hints;
    if (el.premiumStatus) el.premiumStatus.textContent = state.data.economy.premium ? "Si" : "No";
  }

  function renderLevels() {
    el.levelGrid.innerHTML = "";
    const count = Math.max(Levels.totalAuthored, state.data.unlocked + 4);
    for (let id = 1; id <= count; id += 1) {
      const level = Levels.getLevel(id);
      const record = state.data.completed[id];
      const locked = id > state.data.unlocked;
      const tile = document.createElement("article");
      tile.className = "level-tile";
      tile.innerHTML = "<strong>" + id + "</strong><span>" + level.name + "</span><div class='stars'>" + stars(record ? record.stars : 0) + "</div>";
      if (locked) {
        const actions = document.createElement("div");
        actions.className = "level-actions";
        actions.appendChild(actionButton("Monedas", () => unlockLevelWithCoins(id)));
        actions.appendChild(actionButton("Anuncio", () => state.adManager.showRewardedAd("unlock")));
        tile.appendChild(actions);
      } else {
        tile.addEventListener("click", () => startLevel(id));
      }
      el.levelGrid.appendChild(tile);
    }
  }

  function actionButton(text, handler) {
    const button = document.createElement("button");
    button.className = "btn btn-outline-primary";
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handler();
    });
    return button;
  }

  function unlockLevelWithCoins(id) {
    const cost = MonetizationConfig.economy.unlockCost;
    if (!state.adManager.spendCoins(cost)) return notice("No tienes monedas suficientes.");
    state.data.unlocked = Math.max(state.data.unlocked, id);
    saveData();
    renderLevels();
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
    state.rewardDoubled = false;
    state.starRecovered = false;
    state.startedAt = Date.now();
    el.levelLabel.textContent = "Nivel " + id;
    el.levelName.textContent = state.level.name;
    el.objectiveText.textContent = Levels.describeObjective(state.level.objective);
    showScreen("gameScreen");
    startTimer();
    renderBoard();
  }

  function renderBoard(hintLine) {
    el.boardSvg.innerHTML = "";
    state.triangles.forEach((triangle) => {
      const points = triangle.ids.map(getPoint);
      el.boardSvg.appendChild(svg("polygon", { points: points.map((p) => p.x + "," + p.y).join(" "), class: "triangle-fill" }));
    });
    state.lines.forEach((line) => {
      const a = getPoint(line.a);
      const b = getPoint(line.b);
      el.boardSvg.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge-line" }));
    });
    if (hintLine && hintLine.a && hintLine.b) {
      el.boardSvg.appendChild(svg("line", { x1: hintLine.a.x, y1: hintLine.a.y, x2: hintLine.b.x, y2: hintLine.b.y, class: "hint-line" }));
    }
    state.level.points.forEach((point) => {
      const hit = svg("circle", { cx: point.x, cy: point.y, r: 4.8, class: "point-hit" });
      hit.addEventListener("click", () => selectPoint(point.id));
      el.boardSvg.appendChild(hit);
      const circle = svg("circle", { cx: point.x, cy: point.y, r: 1.75, class: pointClass(point, hintLine) });
      circle.addEventListener("click", () => selectPoint(point.id));
      el.boardSvg.appendChild(circle);
      el.boardSvg.appendChild(svg("text", { x: point.x + 2.4, y: point.y - 2.4, class: "point-label" }, point.id));
    });
    updateCounters();
  }

  function pointClass(point, hintLine) {
    const classes = ["point"];
    if (state.selectedPoint === point.id) classes.push("selected");
    if (hintLine && (hintLine.a.id === point.id || hintLine.b.id === point.id)) classes.push("hinted");
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
    if (state.lines.some((line) => Geometry.edgeKey(line.a, line.b) === key)) return tapSound(130, 0.05);
    if (state.lines.length >= state.level.maxLines) return tapSound(110, 0.07);
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
    if (Geometry.objectiveMet(state.level, state.triangles)) setTimeout(completeLevel, 420);
  }

  function updateCounters() {
    el.lineCount.textContent = state.lines.length + "/" + state.level.maxLines;
    el.lineLeft.textContent = Math.max(0, state.level.maxLines - state.lines.length);
    el.triangleCount.textContent = state.triangles.length;
    el.triangleList.innerHTML = state.triangles.length ? "" : "<p>Aun no hay triangulos validos.</p>";
    state.triangles.forEach((triangle, index) => {
      const p = document.createElement("p");
      p.textContent = "#" + (index + 1) + " " + triangle.type + " - area " + triangle.area.toFixed(1) + " - perimetro " + triangle.perimeter.toFixed(1);
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
    if (state.data.economy.hints > 0) {
      state.data.economy.hints -= 1;
    } else if (!state.adManager.spendCoins(MonetizationConfig.economy.hintCost)) {
      return notice("Compra pistas en la tienda o mira un anuncio recompensado.");
    }
    saveData();
    revealHint();
  }

  function revealHint() {
    state.hints += 1;
    const candidate = findHintLine();
    renderBoard(candidate);
    renderEconomy();
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
    state.lastEarnedStars = earned;
    state.lastCoinReward = computeCoinReward(earned);
    state.data.economy.coins += state.lastCoinReward;
    state.data.monetization.coinsEarned += state.lastCoinReward;
    state.adManager.recordLevelCompleted();
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
    el.coinRewardText.textContent = "+" + state.lastCoinReward + " monedas";
    el.doubleRewardBtn.disabled = false;
    el.recoverStarBtn.disabled = earned >= 3;
    victorySound();
    confetti();
    showScreen("victoryScreen");
  }

  function computeCoinReward(earned) {
    return MonetizationConfig.economy.completionCoins + earned * 10 + (earned === 3 ? MonetizationConfig.economy.perfectBonus : 0);
  }

  function computeStars() {
    let score = 3;
    if (state.hints > 0 || state.restarts > 0) score -= 1;
    if (state.hints > 1 || state.moves > state.level.maxLines + 3) score -= 1;
    return Math.max(1, score);
  }

  function handleReward(rewardType) {
    if (rewardType === "hint" && state.screen === "gameScreen") revealHint();
    if (rewardType === "unlock") {
      state.data.unlocked += 1;
      saveData();
      if (state.screen === "levelsScreen") renderLevels();
    }
    if (rewardType === "doubleReward" && !state.rewardDoubled && state.lastCoinReward > 0) {
      state.rewardDoubled = true;
      state.data.economy.coins += state.lastCoinReward;
      state.data.monetization.coinsEarned += state.lastCoinReward;
      el.coinRewardText.textContent = "+" + (state.lastCoinReward * 2) + " monedas";
      el.doubleRewardBtn.disabled = true;
      saveData();
      renderEconomy();
    }
    if (rewardType === "recoverStar" && !state.starRecovered && state.lastEarnedStars < 3) {
      state.starRecovered = true;
      const record = state.data.completed[state.levelId];
      if (record && record.stars < 3) {
        state.data.stats.stars += 1;
        record.stars += 1;
        el.victoryStars.textContent = stars(record.stars);
      }
      el.recoverStarBtn.disabled = true;
      saveData();
      renderEconomy();
    }
  }

  function stars(count) {
    return "*".repeat(count) + "-".repeat(3 - count);
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
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audio = new AudioContext();
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

  function renderShop() {
    renderEconomy();
    const cost = MonetizationConfig.economy;
    const items = [
      ["Comprar pistas", "Recibe 3 pistas para usar sin anuncios.", cost.hintCost * 3, () => buyHints(3)],
      ["Comprar desbloqueo", "Abre el siguiente nivel bloqueado.", cost.unlockCost, buyUnlock],
      ["Tema Clasico", "Paleta original premium puzzle.", 0, () => buyTheme("classic")],
      ["Tema Oscuro", "Contraste suave para jugar de noche.", 0, () => buyTheme("dark")],
      ["Tema Neon", "Luces intensas y tablero nocturno.", cost.themeCost, () => buyTheme("neon")],
      ["Tema Futurista", "Interfaz limpia para pantallas grandes.", cost.themeCost, () => buyTheme("futuristic")],
      ["Paquete Premium", "Sin anuncios, mas pistas y temas exclusivos.", 0, buyPremium],
      ["Monedas por anuncio", "Mira un anuncio y recibe monedas.", 0, () => state.adManager.showRewardedAd("coins")]
    ];
    el.shopGrid.innerHTML = "";
    items.forEach(([title, text, price, action]) => {
      const card = document.createElement("article");
      card.className = "shop-card";
      card.innerHTML = "<h3>" + title + "</h3><p>" + text + "</p><strong>" + (price ? price + " monedas" : "Gratis / simulado") + "</strong>";
      card.appendChild(actionButton("Obtener", action));
      el.shopGrid.appendChild(card);
    });
  }

  function buyHints(amount) {
    const total = MonetizationConfig.economy.hintCost * amount;
    if (!state.adManager.spendCoins(total)) return notice("No tienes monedas suficientes.");
    state.data.economy.hints += amount;
    saveData();
    renderShop();
  }

  function buyUnlock() {
    if (!state.adManager.spendCoins(MonetizationConfig.economy.unlockCost)) return notice("No tienes monedas suficientes.");
    state.data.unlocked += 1;
    saveData();
    renderShop();
  }

  function buyTheme(theme) {
    const owned = state.data.economy.ownedThemes.includes(theme);
    if (!owned && !state.adManager.spendCoins(MonetizationConfig.economy.themeCost)) return notice("No tienes monedas suficientes.");
    if (!owned) state.data.economy.ownedThemes.push(theme);
    state.data.economy.activeTheme = theme;
    state.data.settings.visualTheme = theme;
    saveData();
    applySettings();
    renderShop();
  }

  function buyPremium() {
    state.data.economy.premium = true;
    state.data.economy.hints += MonetizationConfig.economy.premiumBonusHints;
    ["neon", "futuristic"].forEach((theme) => {
      if (!state.data.economy.ownedThemes.includes(theme)) state.data.economy.ownedThemes.push(theme);
    });
    saveData();
    applySettings();
    renderShop();
    renderContextualAds(state.screen);
  }

  function renderStats() {
    const stats = state.data.stats;
    const money = state.data.monetization;
    const items = [
      ["Niveles completados", Object.keys(state.data.completed).length],
      ["Tiempo total", formatTime(stats.totalTime)],
      ["Triangulos creados", stats.triangles],
      ["Mejor racha", stats.bestStreak],
      ["Estrellas", stats.stars],
      ["Mejor puntuacion", stats.bestScore],
      ["Banners mostrados", money.bannersShown],
      ["Interstitials", money.interstitialsShown],
      ["Rewarded vistos", money.rewardedWatched],
      ["Monedas ganadas", money.coinsEarned],
      ["Monedas gastadas", money.coinsSpent],
      ["Pistas obtenidas", money.hintsEarned]
    ];
    el.statsGrid.innerHTML = "";
    items.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.innerHTML = "<strong>" + value + "</strong><span>" + label + "</span>";
      el.statsGrid.appendChild(card);
    });
  }

  function notice(message) {
    window.alert(message);
  }

  function bindEvents() {
    el.playBtn.addEventListener("click", () => startLevel(state.data.unlocked));
    el.backBtn.addEventListener("click", () => showScreen("menuScreen"));
    el.undoBtn.addEventListener("click", undo);
    el.restartBtn.addEventListener("click", restart);
    el.hintBtn.addEventListener("click", hint);
    el.rewardHintBtn.addEventListener("click", () => state.adManager.showRewardedAd("hint"));
    el.retryBtn.addEventListener("click", () => startLevel(state.levelId));
    el.nextBtn.addEventListener("click", () => {
      if (state.adManager.canShowInterstitial()) {
        state.adManager.showInterstitialAd().then(() => startLevel(state.levelId + 1));
      } else {
        startLevel(state.levelId + 1);
      }
    });
    el.doubleRewardBtn.addEventListener("click", () => state.adManager.showRewardedAd("doubleReward"));
    el.recoverStarBtn.addEventListener("click", () => state.adManager.showRewardedAd("recoverStar"));
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
      localStorage.removeItem(legacyStorageKey);
      state.data = defaults();
      saveData();
      applySettings();
      showScreen("menuScreen");
    });
    document.querySelectorAll("[data-screen]").forEach((button) => {
      button.addEventListener("click", () => showScreen(button.dataset.screen));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    setupAds();
    bindEvents();
    applySettings();
    renderMenu();
    renderContextualAds("menuScreen");
  });
}());
