// Balloon Blast Game Configuration

const GAME_DURATION_PER_LEVEL = 40000; // 40 seconds
const COMBO_THRESHOLD_MS = 700;
const MESSAGE_DISPLAY_TIME_MS = 2500;
const FREEZE_DURATION_MS = 3000;

let audioContext = null;
const soundLibrary = {};

// --- Balloon Types ---
const BALLOON_TYPES = [
  { color: "white", points: 10, speedMultiplier: 1.0, type: "normal" },
  { color: "blue", points: 15, speedMultiplier: 1.1, type: "normal" },
  { color: "green", points: 20, speedMultiplier: 1.2, type: "normal" },
  { color: "yellow", points: 5, speedMultiplier: 0.9, type: "normal" },
  { color: "red", points: -20, speedMultiplier: 1.0, type: "negative", text: "💀" },
  { color: "gold", points: 100, speedMultiplier: 1.5, type: "super", text: "💰" },
  { color: "purple", points: 25, speedMultiplier: 1.3, type: "normal" },
  { color: "orange", points: 12, speedMultiplier: 1.05, type: "normal" },
  { color: "black", points: -50, speedMultiplier: 1.2, type: "negative", text: "💣" },
  { color: "silver", points: 75, speedMultiplier: 1.4, type: "super", text: "💎" },
  { color: "pink", points: 8, speedMultiplier: 0.95, type: "normal" },
  { color: "cyan", points: 30, speedMultiplier: 1.25, type: "normal" },
  { color: "brown", points: -10, speedMultiplier: 0.8, type: "negative", text: "💩" },
  { color: "rainbow", points: 200, speedMultiplier: 1.8, type: "super", text: "🌟" },
  { color: "lightgray", points: 10, speedMultiplier: 1.0, type: "normal" },
  { color: "darkgreen", points: 22, speedMultiplier: 1.22, type: "normal" },
  { color: "maroon", points: -30, speedMultiplier: 1.1, type: "negative", text: "🩸" },
  { color: "bronze", points: 60, speedMultiplier: 1.35, type: "super", text: "🏆" },
  { color: "lavender", points: 18, speedMultiplier: 1.1, type: "normal" },
  { color: "teal", points: 28, speedMultiplier: 1.28, type: "normal" },
  { color: "crimson", points: -40, speedMultiplier: 1.15, type: "negative", text: "😈" },
  { color: "platinum", points: 120, speedMultiplier: 1.6, type: "super", text: "👑" },
  { color: "peach", points: 7, speedMultiplier: 0.92, type: "normal" },
  { color: "indigo", points: 35, speedMultiplier: 1.3, type: "normal" },
  { color: "slime", points: -25, speedMultiplier: 0.9, type: "negative", text: "🤢" },
  { color: "nuclear", points: 0, speedMultiplier: 0.8, type: "nuclear", effect: "nuclear", text: "☢️" },
  { color: "purple", points: 5, speedMultiplier: 1.0, type: "special", effect: "combo", text: "✨" }
];

// --- Level Configuration ---
function getLevelConfig(levelNumber) {
  const BASE_MIN_SPAWN_INTERVAL = 2200;
  const BASE_MAX_SPAWN_INTERVAL = 1800;
  const BASE_SPEED = 10;
  const BASE_SCORE_THRESHOLD = 100;
  const BASE_PATTERN_CHANCE = 0.05;
  const BASE_MAX_MISSED_BALLOONS = 8;

  let minSpawnCalc = Math.max(1000, BASE_MIN_SPAWN_INTERVAL - levelNumber * 50);
  let maxSpawnCalc = Math.max(minSpawnCalc + 250, BASE_MAX_SPAWN_INTERVAL - levelNumber * 25);
  let speed = Math.max(4, BASE_SPEED - levelNumber * 0.1);
  let scoreReq = Math.floor(BASE_SCORE_THRESHOLD * Math.pow(1.10, levelNumber));
  let pattern = Math.min(0.75, BASE_PATTERN_CHANCE + levelNumber * 0.02);
  let maxMissed = Math.max(4, BASE_MAX_MISSED_BALLOONS - Math.floor(levelNumber / 6));
  let burstChance = Math.min(0.6, 0.1 + levelNumber * 0.05);
  let minBurstSize = 2;
  let maxBurstSize = Math.min(8, 2 + Math.floor(levelNumber / 2));

  return {
    minSpawnInterval: minSpawnCalc,
    maxSpawnInterval: maxSpawnCalc,
    baseSpeed: speed,
    scoreThreshold: scoreReq,
    patternChance: pattern,
    maxMissedBalloons: maxMissed,
    burstChance,
    minBurstSize,
    maxBurstSize,
  };
}

// --- Game State Variables ---
let score = 0;
let level = 0;
let balloonsMissed = 0;
let gameRunning = false;
let gamePaused = false;
let levelTimerId;
let balloonSpawnIntervalId;
let activeBalloons = [];
let lastPopTime = 0;
let currentCombo = 0;
let comboTimerId;
let scoreMultiplier = 1;
let currentLevelConfig;

// --- DOM Elements ---
const gameArea = document.getElementById("game-area");
const scoreDisplay = document.getElementById("score-display");
const levelDisplay = document.getElementById("level-display");
const gameMessages = document.getElementById("game-messages");
const rulesModal = document.getElementById("rules-modal");
const startGameBtn = document.getElementById("start-game-btn");
const gameOverModal = document.getElementById("game-over-modal");
const finalScoreDisplay = document.getElementById("final-score");
const finalLevelDisplay = document.getElementById("final-level");
const highScoreList = document.getElementById("high-score-list");
const playAgainBtn = document.getElementById("play-again-btn");
const missedDisplay = document.getElementById("missed-display");
const missedMaxDisplay = document.getElementById("missed-max-display");

// --- Main Game Logic ---
document.addEventListener("DOMContentLoaded", () => {
  function init() {
    score = 0;
    level = 1; // Level 1 on game start
    balloonsMissed = 0;
    updateMissedDisplay();
    gameRunning = false;
    gamePaused = false;
    scoreMultiplier = 1;
    currentCombo = 0;
    lastPopTime = 0;
    activeBalloons.forEach((b) => b.remove());
    activeBalloons = [];
    clearAllTimers();
    updateScoreDisplay(0, true); // Force reset display
    updateLevelDisplay();
    hideModal(gameOverModal);
    showModal(rulesModal);
    loadHighScores();
  }

  function startGame() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      loadSound("pop_sound", "assets/audio/pop.mp3");
      loadSound("game_over", "assets/audio/game_over.mp3");
      loadSound("boost", "assets/audio/boost.mp3");
      loadSound("error", "assets/audio/error.mp3");
      loadSound("error", "assets/audio/bomb.mp3");
    }
    hideModal(rulesModal);
    gameRunning = true;
    level = 1;
    startLevel();
  }

  function startLevel() {

    currentLevelConfig = getLevelConfig(level);
    balloonsMissed = 0;
    updateLevelDisplay();
    updateMissedDisplay();
    setBackgroundByLevel(level)
    showGameMessage("congrats", `Level ${level} - Go!`);

    clearInterval(balloonSpawnIntervalId);
    const spawnInterval = getRandomInt(currentLevelConfig.minSpawnInterval, currentLevelConfig.maxSpawnInterval);

    balloonSpawnIntervalId = setInterval(() => {
      if (gameRunning && !gamePaused) {
        if (Math.random() < currentLevelConfig.burstChance) {
          const burstCount = getRandomInt(currentLevelConfig.minBurstSize, currentLevelConfig.maxBurstSize);
          for (let i = 0; i < burstCount; i++) {
            setTimeout(() => {
              if (gameRunning && !gamePaused) createBalloon(currentLevelConfig);
            }, i * 150);
          }
        } else {
          // Custom spawn pattern for levels 1-7+
          const levelToSpawns = [3, 5, 6, 7, 8, 9, 10];
          const spawns = level <= levelToSpawns.length ? levelToSpawns[level - 1] : 10;
          for (let i = 0; i < spawns; i++) {
            createBalloon(currentLevelConfig);
          }
        }

      }
    }, spawnInterval);

    levelTimerId = setTimeout(() => {
      if (gameRunning) endLevel();
    }, GAME_DURATION_PER_LEVEL);
  }

  function endLevel() {
    clearAllTimers();
    if (score >= currentLevelConfig.scoreThreshold) {
      level++;
      showGameMessage("congrats", `Awesome! Level ${level} Unlocked!`);
      setTimeout(startLevel, 1000);
    } else {
      showGameMessage("warning", "Time's Up!");
      setTimeout(gameOver, MESSAGE_DISPLAY_TIME_MS);
    }
  }

  function gameOver() {
    gameRunning = false;
    clearAllTimers();
    activeBalloons.forEach((b) => b.remove());
    activeBalloons = [];
    finalScoreDisplay.textContent = score;
    finalLevelDisplay.textContent = level;
    playSound("game_over");
    updateHighScores(score);
    showModal(gameOverModal);
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clearAllTimers() {
    clearInterval(levelTimerId);
    clearInterval(balloonSpawnIntervalId);
    clearTimeout(comboTimerId);
  }

  function hideModal(el) { el.classList.add("hidden"); }
  function showModal(el) { el.classList.remove("hidden"); }
  function updateScoreDisplay(points = 0, force = false) {
    if (!force) score += points;
    scoreDisplay.textContent = score;
  }
  function updateLevelDisplay() { levelDisplay.textContent = level; }
  function showGameMessage(type, msg) {
    gameMessages.innerHTML = '';
    const el = document.createElement("div");
    el.classList.add("game-message", type);
    el.textContent = msg;
    gameMessages.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  // Accepts optional forcedType
  function createBalloon(levelConfig, forcedType) {
    let balloonType;
    if (forcedType) {
      balloonType = BALLOON_TYPES.find(b => b.type === forcedType);
    } else {
      // Weighted selection
      const currentBalloonCount = activeBalloons.length;
      const typeWeights = getBalloonTypeWeights(level, currentBalloonCount);
      const weightSum = Object.values(typeWeights).reduce((a, b) => a + b, 0);
      const rnd = Math.random() * weightSum;
      let cumulative = 0;
      let selectedType = 'normal';
      for (const [type, weight] of Object.entries(typeWeights)) {
        cumulative += weight;
        if (rnd < cumulative) {
          selectedType = type;
          break;
        }
      }
      const balloonsOfType = BALLOON_TYPES.filter(b => b.type === selectedType);
      balloonType = balloonsOfType[getRandomInt(0, balloonsOfType.length - 1)];
    }

    const balloonEl = document.createElement("div");
    balloonEl.classList.add("balloon", balloonType.color);
    if (balloonType.text) {
      const textSpan = document.createElement("span");
      textSpan.textContent = balloonType.text;
      balloonEl.appendChild(textSpan);
    }

    // Animation and position
    let animationDuration = levelConfig.baseSpeed / balloonType.speedMultiplier;
    let animationName = "rise";
    const patternTypes = ["zig-zag", "sway"];
    if (Math.random() < levelConfig.patternChance) {
      animationName = patternTypes[getRandomInt(0, patternTypes.length - 1)];
      animationDuration *= 1.5;
    }
    balloonEl.style.animation = `${animationName} ${animationDuration}s linear forwards`;

    let balloonWidthPx = (window.innerWidth <= 480) ? 50 : (window.innerWidth <= 768) ? 60 : 80;
    const gameAreaWidthPx = gameArea.clientWidth;
    const horizontalPaddingPx = 10;
    const minLeftPx = horizontalPaddingPx;
    const maxLeftPx = gameAreaWidthPx - balloonWidthPx - horizontalPaddingPx;
    const safeMaxLeftPx = Math.max(minLeftPx, maxLeftPx);
    const randomLeftPx = getNonOverlappingLeftPx(balloonWidthPx, 5, 10);
    balloonEl.style.left = `${randomLeftPx}px`;

    balloonEl.addEventListener("click", popBalloon);
    balloonEl.addEventListener("animationend", (event) => {
      if (
        (event.animationName.startsWith("rise") ||
          event.animationName === "zig-zag" ||
          event.animationName === "sway") &&
        !balloonEl.classList.contains("popped")
      ) {
        removeBalloon(balloonEl, true);
      }
    });

    gameArea.appendChild(balloonEl);
    activeBalloons.push(balloonEl);
    balloonEl.dataset.type = JSON.stringify(balloonType);
  }

  function popBalloon(event) {
    if (gamePaused || !gameRunning) return;
    const balloonEl = event.currentTarget;
    if (balloonEl.classList.contains("popped")) return;

    const balloonType = JSON.parse(balloonEl.dataset.type);
    balloonEl.removeEventListener("click", popBalloon);
    balloonEl.style.animation = "none";
    balloonEl.classList.add("popped");
    playSound("pop_sound");

    let pointsEarned = balloonType.points;
    if (scoreMultiplier > 1 && pointsEarned > 0) {
      pointsEarned *= scoreMultiplier;
      showGameMessage("congrats", `x${scoreMultiplier} COMBO! +${pointsEarned} points!`);
      playSound("boost");
    } else if (balloonType.type === "negative") {
      playSound("error");
      showGameMessage("warning", "Oh no! Disaster!");
    } else if (balloonType.type === "super") {
      playSound("boost");
      showGameMessage("congrats", "Super Pop!");
    }
    else if (balloonType.type === "nuclear") {
      playSound("bomb");
      showGameMessage("congrats", "Hastala Vista!");
    }

    // --- Nuclear Bomb effect ---
    if (balloonType.type === "nuclear" || balloonType.effect === "nuclear") {
      let totalPoints = 0;
      activeBalloons.forEach(otherBalloon => {
        if (
          !otherBalloon.classList.contains("popped") &&
          otherBalloon !== balloonEl
        ) {
          otherBalloon.classList.add("popped");
          otherBalloon.style.animation = "none";
          setTimeout(() => removeBalloon(otherBalloon, false), 50);
        }
      });
      showGameMessage("Hastala", `Vista! +${totalPoints} baby!`);
      playSound("boost");
      updateScoreDisplay(totalPoints);
    }

    updateScoreDisplay(pointsEarned);

    // Combo logic
    const currentTime = Date.now();
    if (currentTime - lastPopTime <= COMBO_THRESHOLD_MS) {
      currentCombo++;
      if (currentCombo >= 3 && currentCombo % 2 === 1) {
        showGameMessage("congrats", `Combo x${currentCombo}!`);
      }
    } else {
      currentCombo = 1;
    }
    lastPopTime = currentTime;

    clearTimeout(comboTimerId);
    comboTimerId = setTimeout(() => {
      currentCombo = 0;
      scoreMultiplier = 1;
    }, COMBO_THRESHOLD_MS);

    // Special effects (combo power up only)
    if (balloonType.effect === "combo") {
      scoreMultiplier = 2;
      showGameMessage("congrats", "Score Multiplier Activated!");
      clearTimeout(comboTimerId);
      comboTimerId = setTimeout(() => {
        scoreMultiplier = 1;
        currentCombo = 0;
        showGameMessage("warning", "Multiplier Expired!");
      }, COMBO_THRESHOLD_MS * 3);
    }

    checkLevelCompletion();

    balloonEl.addEventListener(
      "animationend",
      (event) => {
        if (event.animationName === "explode") {
          removeBalloon(balloonEl, false);
        }
      },
      { once: true }
    );
  }

  function removeBalloon(balloonEl, missed) {
    const index = activeBalloons.indexOf(balloonEl);
    if (index > -1) {
      if (missed) {
        const balloonType = JSON.parse(balloonEl.dataset.type);
        if (balloonType.type === "normal") {
          balloonsMissed++;
          updateMissedDisplay();
          checkGameOverCondition();
        }
      }
      activeBalloons.splice(index, 1);
      balloonEl.remove();
    }
  }

  function checkGameOverCondition() {
    if (balloonsMissed >= currentLevelConfig.maxMissedBalloons) {
      showGameMessage("warning", "Game Over!");
      gameOver();
    }
  }

  function checkLevelCompletion() {
    if (
      gameRunning &&
      score >= currentLevelConfig.scoreThreshold
    ) {
      endLevel();
    }
  }


  function setBackgroundByLevel(currentLevel) {
    gameArea.classList.remove("day-sky", "night-sky");

    // The cycle is 3 levels of day, then 3  levels of night. Total cycle length = 6
    const cyclePosition = (currentLevel - 1) % 6;

    if (cyclePosition < 3) {
      // First 3 positions in the cycle (0, 1, 2) are day
      gameArea.classList.add("day-sky");
    } else {
      gameArea.classList.add("night-sky");
    }
  }


  // --- Audio
  function loadSound(name, url) {
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        soundLibrary[name] = audioBuffer;
      })
      .catch((e) => console.error("Error loading sound:", e));
  }

  function playSound(name) {
    if (!audioContext || !soundLibrary[name]) return;
    const source = audioContext.createBufferSource();
    source.buffer = soundLibrary[name];
    source.connect(audioContext.destination);
    source.start(0);
  }

  // --- High Score Logic
  function loadHighScores() {
    const scores = JSON.parse(
      localStorage.getItem("balloonPopHighScores") || "[]"
    );
    scores.sort((a, b) => b.score - a.score);
    displayHighScores(scores);
    return scores;
  }

  function updateHighScores(newScore) {
    const scores = loadHighScores();
    const currentDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    scores.push({ score: newScore, level: level, date: currentDate });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(
      "balloonPopHighScores",
      JSON.stringify(scores.slice(0, 5))
    );
    displayHighScores(scores.slice(0, 5));
  }

  function displayHighScores(scores) {
    highScoreList.innerHTML = "";
    if (scores.length === 0) {
      highScoreList.innerHTML = "<li>No high scores yet!</li>";
      return;
    }
    scores.forEach((s, index) => {
      const li = document.createElement("li");
      li.textContent = `#${index + 1}: Score ${s.score} | Level ${s.level} (${s.date})`;
      highScoreList.appendChild(li);
    });
  }

  function getNonOverlappingLeftPx(balloonWidthPx, padding = 5, maxAttempts = 10) {
    const existingPositions = activeBalloons.map(b => parseInt(b.style.left, 10));
    const minLeftPx = 10;
    const maxLeftPx = gameArea.clientWidth - balloonWidthPx - 10;
    let attempts = 0;
    let found = false;
    let randomLeftPx = 0;

    while (!found && attempts < maxAttempts) {
      randomLeftPx = getRandomInt(minLeftPx, maxLeftPx);
      found = existingPositions.every(existingLeft =>
        Math.abs(existingLeft - randomLeftPx) > (balloonWidthPx + padding)
      );
      attempts++;
    }
    // If couldn't find a spot, just use a random spot
    return randomLeftPx;
  }



  function getBalloonTypeWeights(level, balloonCount = 0) {
    let base = {
      normal: 65 - Math.min(30, level * 2),
      negative: Math.min(20, level * 1.2),
      super: Math.min(12, level),
      special: level > 6 ? Math.min(8, (level - 6) * 1.2) : 0,
      nuclear: level > 10 ? 2 : 0
    };

    // If screen is overloaded, increase nuclear chance
    if (balloonCount >= 8) {
      base.nuclear += Math.min(8, (balloonCount - 7) * 3); // 3% more per extra balloon above 7, max 8%
      // Optionally, reduce normal a bit to keep sum ~100
      base.normal = Math.max(10, base.normal - 4);
    }
    return base;
  }



  function updateMissedDisplay() {
    missedDisplay.textContent = balloonsMissed;
    missedMaxDisplay.textContent = currentLevelConfig ? currentLevelConfig.maxMissedBalloons : 0;
  }

  // --- Accessibility (Keyboard Popping) ---
  function handleKeyboardPop(event) {
    if (!gameRunning || gamePaused || event.repeat) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (activeBalloons.length > 0) {
        const clickableBalloons = activeBalloons.filter(
          (b) => !b.classList.contains("popped")
        );
        if (clickableBalloons.length > 0) {
          const lowestBalloon = clickableBalloons.reduce((prev, curr) => {
            const prevRect = prev.getBoundingClientRect();
            const currRect = curr.getBoundingClientRect();
            return prevRect.bottom > currRect.bottom ? prev : curr;
          }, clickableBalloons[0]);
          if (lowestBalloon) {
            lowestBalloon.click();
          }
        }
      }
    }
  }

  startGameBtn.addEventListener("click", startGame);
  playAgainBtn.addEventListener("click", init);
  document.addEventListener("keydown", handleKeyboardPop);

  init();
});
