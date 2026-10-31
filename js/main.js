// ─── Main game coordinator and loop ──────────────────────────────────────────

import {
  LV,
  parseLevelMap,
  canExitLevel,
  getLevelLasers,
  getLevelPortals,
  getLevelShifts,
  isLaserActive,
  isShiftSolid
} from './levels.js';
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
  getGhostPlates,
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
  isExitVisualLocked,
  updateUI
} from './renderer.js';
import {
  initInput,
  consumeInput,
  clearInput
} from './input.js';
import {
  STORAGE_KEY,
  loadProgress,
  saveProgress,
  markCaseCompleted,
  isCaseUnlocked,
  isCaseCompleted,
  resetProgress
} from './progress.js';

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
let progress = loadProgress();

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

// Case Selection Modal Management
const caseModal = $('case-modal');
const caseGrid = $('case-grid');
const progressSummary = $('progress-summary');
const resetConfirm = $('reset-confirm');

export function isModalOpen() {
  return Boolean(caseModal && caseModal.style.display !== 'none');
}

export function openCaseModal() {
  if (!caseModal) return;
  if (resetConfirm) resetConfirm.style.display = 'none';
  renderCaseGrid();
  caseModal.style.display = 'flex';
}

export function closeCaseModal() {
  if (!caseModal) return;
  caseModal.style.display = 'none';
  if (resetConfirm) resetConfirm.style.display = 'none';
}

export function toggleCaseModal() {
  if (isModalOpen()) {
    closeCaseModal();
  } else {
    openCaseModal();
  }
}

export function renderCaseGrid() {
  if (!caseGrid) return;
  caseGrid.innerHTML = '';

  const completedCount = progress.completedCases ? progress.completedCases.length : 0;
  const unlockedCount = (progress.highestUnlocked !== undefined ? progress.highestUnlocked : 0) + 1;
  if (progressSummary) {
    progressSummary.textContent = `${unlockedCount} of ${LV.length} Cases Unlocked (${completedCount} Solved)`;
  }

  LV.forEach((lvlDef, idx) => {
    const card = document.createElement('button');
    card.type = 'button';
    const unlocked = isCaseUnlocked(idx, progress);
    const completed = isCaseCompleted(idx, progress);
    const isCurrent = idx === lv;

    card.className = `case-card ${isCurrent ? 'current' : ''} ${unlocked ? 'unlocked' : 'locked'}`;
    if (!unlocked) {
      card.disabled = true;
    }

    let badgeHtml = '';
    if (completed) {
      badgeHtml = '<span class="case-badge badge-completed">COMPLETED ✓</span>';
    } else if (unlocked) {
      badgeHtml = '<span class="case-badge badge-unlocked">UNLOCKED</span>';
    } else {
      badgeHtml = '<span class="case-badge badge-locked">🔒 LOCKED</span>';
    }

    let infoText = '';
    if (unlocked) {
      infoText = `${lvlDef.timeLimit}s limit · ${lvlDef.hint}`;
    } else {
      infoText = `Classified — Complete Case ${String(idx).padStart(2, '0')} to unlock`;
    }

    card.innerHTML = `
      <div class="case-card-top">
        <span class="case-card-num">CASE ${String(idx + 1).padStart(2, '0')}</span>
        ${badgeHtml}
      </div>
      <div class="case-card-title">${lvlDef.n}</div>
      <div class="case-card-info">${infoText}</div>
    `;

    if (unlocked) {
      card.addEventListener('click', () => {
        closeCaseModal();
        loadLevel(idx);
      });
    }

    caseGrid.appendChild(card);
  });
}

export function loadLevel(i, force = false) {
  if (i < 0 || i >= LV.length) return false;
  if (!force && !isCaseUnlocked(i, progress)) {
    say('Case locked. Complete previous cases first.');
    return false;
  }

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

  $('lvn').textContent = 'CASE ' + String(i + 1).padStart(2, '0');
  $('lvt').textContent = parsed.levelDef.n;
  $('hint').textContent = parsed.levelDef.hint;

  clearInput();
  paused = false;

  startRound();
  started = false;
  say('Press a move key to start the loop.');
  return true;
}

export function startRound() {
  resetRoundTimer();
  initPlayer(start);
  startShadowRecording(getPlayerPos(), getPlayerFace());
  resetEnemiesAlive();
  clearInput();
  syncUI();
  renderCurrentFrame();
}

export function tick() {
  if (won) return;
  incrementTick();
  const currentTick = getTick();
  const shifts = getLevelShifts(lv);

  const { dir, wantStrike } = consumeInput();
  const prevPos = { ...getPlayerPos() };

  // Move player
  const currentPlates = getActivePlates(grid, getGhosts(), getPlayerPos(), currentTick);
  if (dir) {
    movePlayer(dir, grid, cols, rows, currentPlates, getGhosts(), currentTick, getGhostPos, shifts);
  }

  // Portal transit (deterministic, loops prevented by checking change of tile)
  const portals = getLevelPortals(lv);
  if (portals && portals.length > 0) {
    const curP = getPlayerPos();
    for (const portal of portals) {
      if (curP.x === portal.a.x && curP.y === portal.a.y && (prevPos.x !== portal.a.x || prevPos.y !== portal.a.y)) {
        setPlayerPos({ x: portal.b.x, y: portal.b.y });
        say('Rift transit: warped to Portal Beta.');
        break;
      }
      if (curP.x === portal.b.x && curP.y === portal.b.y && (prevPos.x !== portal.b.x || prevPos.y !== portal.b.y)) {
        setPlayerPos({ x: portal.a.x, y: portal.a.y });
        say('Rift transit: warped to Portal Alpha.');
        break;
      }
    }
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

  // Laser collision kills player
  const lasers = getLevelLasers(lv);
  if (lasers && lasers.length > 0) {
    const curP = getPlayerPos();
    for (const laser of lasers) {
      if (isLaserActive(laser, currentTick, currentPlates)) {
        const hit = laser.cells && laser.cells.some(c => c[0] === curP.x && c[1] === curP.y);
        if (hit) {
          say('Caught. Laser grid vaporized loop — try again.');
          die();
          return;
        }
      }
    }
  }

  // Shifting bulkhead safety check: safely displace player if trapped inside newly closed bulkhead
  if (shifts && shifts.length > 0) {
    const curP = getPlayerPos();
    for (const shift of shifts) {
      if (isShiftSolid(shift, currentTick)) {
        const inside = shift.cells && shift.cells.some(c => c[0] === curP.x && c[1] === curP.y);
        if (inside) {
          const cardinalDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
          let displaced = false;
          for (const [dx, dy] of cardinalDirs) {
            const nx = curP.x + dx;
            const ny = curP.y + dy;
            if (!isSolid(nx, ny, grid, cols, rows, currentPlates, getGhosts(), currentTick, getGhostPos, shifts)) {
              setPlayerPos({ x: nx, y: ny });
              say('Bulkhead shifted — displaced to safety.');
              displaced = true;
              break;
            }
          }
          if (!displaced) {
            say('Caught. Crushed by shifting bulkhead.');
            die();
            return;
          }
        }
      }
    }
  }

  // Enemy contact kills player
  const collidedEnemy = checkEnemyCollision(getPlayerPos(), prevPos, currentTick);
  if (collidedEnemy) {
    die();
    return;
  }

  // Victory check
  const playerPos = getPlayerPos();
  if (grid[playerPos.y] && grid[playerPos.y][playerPos.x] === 'E') {
    const shadowPlates = getGhostPlates(grid, getGhosts(), currentTick);
    const exitStatus = canExitLevel(lv, currentPlates, getEnemies(), shadowPlates);
    if (!exitStatus.canExit) {
      say(exitStatus.message);
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
  progress = markCaseCompleted(lv);
  if (lv === LV.length - 1) {
    won = true;
    showOverlay('ALL CASES CLOSED', 'You completed all 12 sectors and broke the loop forever.<br>Loops on final case: ' + loops, true);
    return;
  }
  loadLevelNext();
}

export function loadLevelNext() {
  const nextLv = lv + 1;
  loadLevel(nextLv);
  say('Case ' + String(nextLv + 1).padStart(2, '0') + ' — ' + LV[nextLv].n);
}

export function showOverlay(header, body, canPlayAgain) {
  const ovEl = $('ov');
  ovEl.style.display = 'flex';
  ovEl.innerHTML = (canPlayAgain ? '<img src="brand/icon.svg" alt="Vestigraid" class="ov-icon">' : '') +
    '<h2>' + header + '</h2><p>' + body + '</p>' +
    (canPlayAgain ? '<div class="ov-btns"><button class="btn" id="ag">Play again</button><button class="btn" id="ov-archive">Case Archive</button><button class="btn" id="re-last">Restart final case</button></div>' : '');
  if (canPlayAgain) {
    $('ag').onclick = () => {
      ovEl.style.display = 'none';
      won = false;
      resetHistory();
      clearInput();
      paused = false;
      loadLevel(0);
    };
    if ($('ov-archive')) {
      $('ov-archive').onclick = () => {
        ovEl.style.display = 'none';
        won = false;
        openCaseModal();
      };
    }
    if ($('re-last')) {
      $('re-last').onclick = () => {
        ovEl.style.display = 'none';
        won = false;
        clearInput();
        paused = false;
        loadLevel(LV.length - 1);
      };
    }
  }
}

export function renderCurrentFrame() {
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
    lasers: getLevelLasers(lv),
    portals: getLevelPortals(lv),
    shifts: getLevelShifts(lv),
    t: getTick(),
    lv,
    isBoss: Boolean(LV[lv].boss),
    requiredDoor: LV[lv].requiredDoor,
    started,
    paused,
    won
  });
}

export function frame(ts) {
  const isRunning = started && !won && !paused;
  updateTimeAccumulator(ts, isRunning, () => {
    tick();
    return started; // break if die() or commit() stopped loop
  });

  renderCurrentFrame();

  if (flash > 0) flash--;

  requestAnimationFrame(frame);
}

// ─── Browser / Test Compatibility Layer ──────────────────────────────────────
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

  // Progress compatibility
  Object.defineProperty(window, 'progress', {
    get: () => progress,
    set: (v) => { progress = v; }
  });
  window.loadProgress = () => { progress = loadProgress(); return progress; };
  window.saveProgress = (p) => { progress = saveProgress(p); return progress; };
  window.resetProgress = () => { progress = resetProgress(); return progress; };
  window.markCaseCompleted = (c) => { progress = markCaseCompleted(c); return progress; };
  window.isCaseUnlocked = (i) => isCaseUnlocked(i, progress);
  window.isCaseCompleted = (i) => isCaseCompleted(i, progress);
  window.selectCase = (i) => loadLevel(i);
  window.openCaseModal = openCaseModal;
  window.closeCaseModal = closeCaseModal;
  window.toggleCaseModal = toggleCaseModal;
  window.renderCaseGrid = renderCaseGrid;
  window.canExitLevel = (levelIndex, actPlates, enemies, ghostPlates) => {
    return canExitLevel(
      levelIndex !== undefined ? levelIndex : lv,
      actPlates || getActivePlates(grid, getGhosts(), getPlayerPos(), getTick()),
      enemies || getEnemies(),
      ghostPlates !== undefined ? ghostPlates : getGhostPlates(grid, getGhosts(), getTick())
    );
  };
  window.getLevelLasers = getLevelLasers;
  window.getLevelPortals = getLevelPortals;
  window.getLevelShifts = getLevelShifts;
  window.isLaserActive = isLaserActive;
  window.isShiftSolid = isShiftSolid;
  window.getGhostPlates = (tt) => getGhostPlates(grid, getGhosts(), tt !== undefined ? tt : getTick());
  window.getGhosts = getGhosts;
  window.getPlayerPos = getPlayerPos;
  window.getActivePlates = (g, gh, p, tt) => getActivePlates(g || grid, gh || getGhosts(), p || getPlayerPos(), tt !== undefined ? tt : getTick());
  window.renderCurrentFrame = renderCurrentFrame;
  window.isExitVisualLocked = isExitVisualLocked;
}

export function initGame() {
  initRenderer(cv);
  progress = loadProgress();

  initInput({
    onStartMove: () => { if (!paused && !isModalOpen()) started = true; },
    onStrike: () => { if (!paused && !isModalOpen()) started = true; },
    onCommit: () => { if (!isModalOpen()) commit(false); },
    onReset: () => { if (!isModalOpen()) loadLevel(lv); },
    onPause: () => {
      if (isModalOpen()) return;
      paused = !paused;
      say(paused ? 'Paused. Press P to resume.' : '');
    },
    onCaseSelect: (open) => {
      if (open === false) closeCaseModal();
      else toggleCaseModal();
    },
    isPaused: () => paused,
    isWon: () => won,
    isStarted: () => started,
    isModalOpen: () => isModalOpen()
  });

  // Modal event listeners
  const btnCases = $('btn-cases');
  if (btnCases) btnCases.addEventListener('click', openCaseModal);
  const modalClose = $('modal-close');
  if (modalClose) modalClose.addEventListener('click', closeCaseModal);
  const btnBack = $('btn-back-game');
  if (btnBack) btnBack.addEventListener('click', closeCaseModal);
  const btnContinue = $('btn-continue-case');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      const target = progress.highestUnlocked !== undefined ? progress.highestUnlocked : 0;
      closeCaseModal();
      loadLevel(target);
    });
  }
  const btnResetProg = $('btn-reset-prog');
  if (btnResetProg) {
    btnResetProg.addEventListener('click', () => {
      if (resetConfirm) resetConfirm.style.display = 'block';
    });
  }
  const btnCancelReset = $('btn-cancel-reset');
  if (btnCancelReset) {
    btnCancelReset.addEventListener('click', () => {
      if (resetConfirm) resetConfirm.style.display = 'none';
    });
  }
  const btnConfirmReset = $('btn-confirm-reset');
  if (btnConfirmReset) {
    btnConfirmReset.addEventListener('click', () => {
      progress = resetProgress();
      if (resetConfirm) resetConfirm.style.display = 'none';
      renderCaseGrid();
      closeCaseModal();
      loadLevel(0);
      say('Progress reset. Starting from Case 01.');
    });
  }
  if (caseModal) {
    caseModal.addEventListener('click', (e) => {
      if (e.target === caseModal) closeCaseModal();
    });
  }

  exposeTestCompatibility();

  const startLv = (progress && progress.highestUnlocked > 0 && progress.highestUnlocked < LV.length)
    ? progress.highestUnlocked
    : 0;
  loadLevel(startLv, true);
  requestAnimationFrame(frame);
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
