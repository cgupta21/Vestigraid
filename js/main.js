// ─── Main game coordinator and loop ──────────────────────────────────────────

import { LV, parseLevelMap } from './levels.js';
import {
  TICK,
  getTick,
  setTick,
  getMaxTicks,
  initTimerForLevel,
  resetRoundTimer,
  incrementTick,
  isTimeExpired,
  updateTimeAccumulator
} from './timer.js';
import {
  initPlayer,
  getPlayerPos,
  setPlayerPos,
  getPlayerFace,
  getPlayerCd,
  stepCooldown,
  attemptStrike,
  movePlayer,
  isSolid,
  DIRS
} from './player.js';
import {
  initShadows,
  startShadowRecording,
  recordShadowFrame,
  getRecording,
  getGhosts,
  getGhostPos,
  commitShadowLoop,
  getActivePlates,
  executeGhostStrikes,
  saveLevelHistory,
  getHistory,
  resetHistory
} from './shadows.js';
import {
  initEnemies,
  getEnemies,
  resetEnemiesAlive,
  getEnemyPos,
  killAt,
  checkEnemyCollision,
  areAllEnemiesDead
} from './enemies.js';
import {
  initRenderer,
  resizeCanvas,
  renderGame,
  updateUI
} from './renderer.js';
import {
  initInput,
  consumeInput,
  clearInput
} from './input.js';

// DOM selectors
const $ = id => document.getElementById(id);
const cv = $('c');

// Game state
let lv = 0;
let grid = [];
let cols = 0;
let rows = 0;
let start = { x: 1, y: 1 };
let loops = 1;
let started = false;
let won = false;
let paused = false;
let flash = 0;

function say(s) {
  const msgEl = $('msg');
  if (msgEl) msgEl.textContent = s;
}

function syncUI() {
  updateUI({
    loops,
    t: getTick(),
    maxTicks: getMaxTicks(),
    tickMs: TICK,
    ghosts: getGhosts(),
    domElements: {
      loopn: $('loopn'),
      tb: $('tb'),
      sh: $('sh'),
      countdown: $('countdown') || $('timer') || $('time')
    }
  });
}

export function loadLevel(i) {
  lv = i;
  won = false;

  const parsed = parseLevelMap(i);
  grid = parsed.grid;
  rows = parsed.rows;
  cols = parsed.cols;
  start = parsed.start;

  initTimerForLevel(parsed.levelDef);
  resizeCanvas(cols, rows);

  initShadows();
  loops = 1;
  initEnemies(parsed.levelDef, grid, rows, cols, getHistory());

  $('lvn').textContent = 'CASE 0' + (i + 1);
  $('lvt').textContent = parsed.levelDef.n;
  $('hint').textContent = parsed.levelDef.hint;

  clearInput();
  paused = false;

  startRound();
  started = false;
  say('Press a move key to start the loop.');
}

export function startRound() {
  resetRoundTimer();
  initPlayer(start);
  startShadowRecording(getPlayerPos(), getPlayerFace());
  resetEnemiesAlive();
  clearInput();
  syncUI();
}

export function tick() {
  if (won) return;
  incrementTick();
  const currentTick = getTick();

  const { dir, wantStrike } = consumeInput();
  const prevPos = { ...getPlayerPos() };

  // Move player
  const currentPlates = getActivePlates(grid, getGhosts(), getPlayerPos(), currentTick);
  if (dir) {
    movePlayer(dir, grid, cols, rows, currentPlates, getGhosts(), currentTick, getGhostPos);
  }

  // Player strike
  let s = 0;
  stepCooldown();
  if (wantStrike) {
    const strikeResult = attemptStrike();
    if (strikeResult.strikeExecuted) {
      s = 1;
      killAt(strikeResult.targetX, strikeResult.targetY, currentTick, () => {
        say('Hit. One less.');
      });
    }
  }

  // Ghost strikes
  executeGhostStrikes(getGhosts(), currentTick, (tx, ty, tt) => {
    killAt(tx, ty, tt, () => {
      say('Hit. One less.');
    });
  });

  // Record frame
  recordShadowFrame(getPlayerPos(), getPlayerFace(), s);

  // Enemy contact kills player
  const collidedEnemy = checkEnemyCollision(getPlayerPos(), prevPos, currentTick);
  if (collidedEnemy) {
    die();
    return;
  }

  // Victory check
  const playerPos = getPlayerPos();
  if (grid[playerPos.y] && grid[playerPos.y][playerPos.x] === 'E') {
    if (LV[lv].boss && !areAllEnemiesDead()) {
      say('Kill all enemies to unlock the exit!');
    } else {
      win();
      return;
    }
  }

  // Time limit: auto-commit
  if (isTimeExpired()) {
    commit(true);
    return;
  }

  syncUI();
}

export function die() {
  say('Caught. That loop is erased — try again.');
  flash = 8;
  clearInput();
  startRound();
  started = false;
}

export function commit(auto) {
  const result = commitShadowLoop(getTick());
  if (!result.success) {
    say('Move first. An empty loop leaves no shadow.');
    return;
  }
  loops++;
  clearInput();
  startRound();
  started = false;
  say(auto ? 'Time ran out. Your run became a shadow.' : 'Shadow left behind. New loop.');
}

export function win() {
  saveLevelHistory(lv, getRecording());
  if (lv === LV.length - 1) {
    won = true;
    showOverlay('CASE CLOSED', 'You beat the team made of your own past.<br>Loops on the last case: ' + loops, true);
    return;
  }
  loadLevelNext();
}

export function loadLevelNext() {
  const nextLv = lv + 1;
  loadLevel(nextLv);
  say('Case ' + (nextLv + 1) + ' — ' + LV[nextLv].n);
}

export function showOverlay(header, body, canPlayAgain) {
  const ovEl = $('ov');
  ovEl.style.display = 'flex';
  ovEl.innerHTML = '<h2>' + header + '</h2><p>' + body + '</p>' +
    (canPlayAgain ? '<button class="btn" id="ag">Play again</button>' : '');
  if (canPlayAgain) {
    $('ag').onclick = () => {
      ovEl.style.display = 'none';
      won = false;
      resetHistory();
      clearInput();
      paused = false;
      loadLevel(0);
    };
  }
}

export function frame(ts) {
  const isRunning = started && !won && !paused;
  updateTimeAccumulator(ts, isRunning, () => {
    tick();
    return started; // break if die() or commit() stopped loop
  });

  const actPlates = getActivePlates(grid, getGhosts(), getPlayerPos(), getTick());
  renderGame({
    grid,
    rows,
    cols,
    start,
    pos: getPlayerPos(),
    face: getPlayerFace(),
    cd: getPlayerCd(),
    flash,
    actPlates,
    ghosts: getGhosts(),
    enemies: getEnemies(),
    getEnemyPosFn: getEnemyPos,
    getGhostPosFn: getGhostPos,
    t: getTick(),
    isBoss: Boolean(LV[lv].boss),
    started,
    paused,
    won
  });

  if (flash > 0) flash--;

  requestAnimationFrame(frame);
}

// ─── Browser / Test Compatibility Layer ──────────────────────────────────────
// Exposes standard globals and helpers so existing browser tests and scripts work
function exposeTestCompatibility() {
  window.loadLevel = loadLevel;
  window.tick = tick;
  window.commit = commit;
  window.die = die;
  window.win = win;
  window.startRound = startRound;
  window.ePos = getEnemyPos;
  window.gPos = getGhostPos;
  window.solid = (x, y, act, tt) => isSolid(x, y, grid, cols, rows, act || new Set(), getGhosts(), tt || getTick(), getGhostPos);
  window.LV = LV;
  window.cv = cv;
  window.$ = $;
  window.DIRS = DIRS;

  Object.defineProperty(window, 'pos', {
    get: () => getPlayerPos(),
    set: (v) => setPlayerPos(v)
  });
  Object.defineProperty(window, 'face', {
    get: () => getPlayerFace(),
    set: (v) => { window._face = v; }
  });
  Object.defineProperty(window, 'cd', {
    get: () => getPlayerCd(),
    set: (v) => {}
  });
  Object.defineProperty(window, 't', {
    get: () => getTick(),
    set: (v) => setTick(v)
  });
  Object.defineProperty(window, 'MAX', {
    get: () => getMaxTicks(),
    set: (v) => {}
  });
  Object.defineProperty(window, 'lv', {
    get: () => lv,
    set: (v) => { lv = v; }
  });
  Object.defineProperty(window, 'grid', {
    get: () => grid,
    set: (v) => { grid = v; }
  });
  Object.defineProperty(window, 'cols', {
    get: () => cols,
    set: (v) => { cols = v; }
  });
  Object.defineProperty(window, 'rows', {
    get: () => rows,
    set: (v) => { rows = v; }
  });
  Object.defineProperty(window, 'enemies', {
    get: () => getEnemies(),
    set: (v) => {}
  });
  Object.defineProperty(window, 'ghosts', {
    get: () => getGhosts(),
    set: (v) => {}
  });
  Object.defineProperty(window, 'rec', {
    get: () => getRecording(),
    set: (v) => {}
  });
  Object.defineProperty(window, 'hist', {
    get: () => getHistory(),
    set: (v) => { if (Array.isArray(v) && v.length === 0) resetHistory(); }
  });
  Object.defineProperty(window, 'started', {
    get: () => started,
    set: (v) => { started = v; }
  });
  Object.defineProperty(window, 'won', {
    get: () => won,
    set: (v) => { won = v; }
  });
  Object.defineProperty(window, 'paused', {
    get: () => paused,
    set: (v) => { paused = v; }
  });
  Object.defineProperty(window, 'loops', {
    get: () => loops,
    set: (v) => { loops = v; }
  });
}

export function initGame() {
  initRenderer(cv);
  initInput({
    onStartMove: () => { if (!paused) started = true; },
    onStrike: () => { if (!paused) started = true; },
    onCommit: () => commit(false),
    onReset: () => loadLevel(lv),
    onPause: () => {
      paused = !paused;
      say(paused ? 'Paused. Press P to resume.' : '');
    },
    isPaused: () => paused,
    isWon: () => won,
    isStarted: () => started
  });

  exposeTestCompatibility();
  loadLevel(0);
  requestAnimationFrame(frame);
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
