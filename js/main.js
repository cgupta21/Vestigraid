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
  TOTAL_CASES,
  getInitialProgress,
  loadProgress,
  saveProgress,
  recordCaseVictory,
  markCaseCompleted,
  isCaseUnlocked,
  isCaseCompleted,
  getTotalStars,
  getTotalScore,
  getUnlockedAchievements,
  resetProgress,
  hasViewedStory,
  markStoryViewed,
  getUnlockedChapters,
  unlockChapter
} from './progress.js';
import {
  CHAPTERS,
  STORY_SEQUENCES,
  getStorySequence,
  getChapter,
  getChapterSequences
} from './story.js';
import {
  initCinematics,
  playCinematic,
  isCinematicActive,
  skipCinematic
} from './cinematics.js';
import {
  CASE_TARGETS,
  calculateStarRating,
  calculateScore,
  calculateScoreBreakdown,
  getScoreBand
} from './scoring.js';
import {
  ACHIEVEMENTS,
  getAchievement,
  evaluateAchievements
} from './achievements.js';

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
let caseDeaths = 0;
let caseTotalTicks = 0;

function say(s) {
  const msgEl = $('msg');
  if (msgEl) msgEl.textContent = s;
}

export function showAchievementToast(achievement) {
  if (!achievement) return;
  const container = $('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon">${achievement.icon}</span>
    <div class="toast-content">
      <span class="toast-title">Accreditation Unlocked</span>
      <span class="toast-name">${achievement.name}</span>
      <span class="toast-desc">${achievement.desc}</span>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(110%)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 3800);
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
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
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
  progress = loadProgress();
  caseGrid.innerHTML = '';

  const completedCount = progress.completedCases ? progress.completedCases.length : 0;
  const unlockedCount = (progress.highestUnlocked !== undefined ? progress.highestUnlocked : 0) + 1;
  if (progressSummary) {
    progressSummary.textContent = `${unlockedCount} of ${LV.length} Cases Unlocked (${completedCount} Solved)`;
  }

  // Render Overall Progress Stats Bar
  const statsBar = $('progress-stats-bar');
  if (statsBar) {
    const totalStars = getTotalStars(progress);
    const totalScore = getTotalScore(progress);
    const unlockedAchs = getUnlockedAchievements(progress).length;
    statsBar.innerHTML = `
      <div class="stat-pill"><span class="stat-pill-label">Cases:</span><span class="stat-pill-val">${completedCount} / 12</span></div>
      <div class="stat-pill"><span class="stat-pill-label">Stars:</span><span class="stat-pill-val">${totalStars} / 36 ★</span></div>
      <div class="stat-pill"><span class="stat-pill-label">Score:</span><span class="stat-pill-val">${totalScore.toLocaleString()} / 12,000</span></div>
      <div class="stat-pill"><span class="stat-pill-label">Accreditations:</span><span class="stat-pill-val">${unlockedAchs} / 10 🏆</span></div>
    `;
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

    // Performance indicators (Stars, Score, Replay Tag, Achievement)
    let perfHtml = '';
    if (completed) {
      const bestStars = progress.stars?.[idx] || 1;
      const bestScore = progress.scores?.[idx] || 400;
      const starsDisplay = [1, 2, 3].map(s => s <= bestStars ? '★' : '<span class="empty">☆</span>').join('');
      const improveTag = bestStars < 3 ? '<span class="tag-improve">Replay for ★★★</span>' : '';

      let caseAch = '';
      if (idx === 0 && progress.achievements?.includes('first_echo')) caseAch = '<span class="card-ach-badge" title="First Echo">⚡</span>';
      if (idx === 8 && progress.achievements?.includes('laser_runner')) caseAch = '<span class="card-ach-badge" title="Laser Runner">🔴</span>';
      if (idx === 9 && progress.achievements?.includes('rift_walker')) caseAch = '<span class="card-ach-badge" title="Rift Walker">🌀</span>';
      if (idx === 10 && progress.achievements?.includes('shift_controller')) caseAch = '<span class="card-ach-badge" title="Shift Controller">⚙️</span>';
      if (idx === 11 && progress.achievements?.includes('paradox_solved')) caseAch = '<span class="card-ach-badge" title="Paradox Solved">♾️</span>';

      perfHtml = `
        <div class="card-perf-row">
          <div class="card-stars">${starsDisplay}${caseAch}</div>
          <div class="card-score">${bestScore} pts</div>
          ${improveTag}
        </div>
      `;
    } else if (unlocked) {
      perfHtml = `
        <div class="card-perf-row">
          <div class="card-stars"><span class="empty">☆☆☆</span></div>
          <div class="card-score">—</div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="case-card-top">
        <span class="case-card-num">CASE ${String(idx + 1).padStart(2, '0')}</span>
        ${badgeHtml}
      </div>
      <div class="case-card-title">${lvlDef.n}</div>
      <div class="case-card-info">${infoText}</div>
      ${perfHtml}
    `;

    if (unlocked) {
      card.addEventListener('click', () => {
        closeCaseModal();
        loadLevel(idx);
      });
    }

    caseGrid.appendChild(card);
  });

  // Render Achievements Drawer in Modal
  const achCountEl = $('achievements-count');
  const achGridEl = $('achievements-grid');
  if (achCountEl && achGridEl) {
    const unlockedIds = new Set(getUnlockedAchievements(progress));
    achCountEl.textContent = `${unlockedIds.size} / ${ACHIEVEMENTS.length} Unlocked`;
    achGridEl.innerHTML = '';

    ACHIEVEMENTS.forEach(ach => {
      const isAchUnlocked = unlockedIds.has(ach.id);
      const achCard = document.createElement('div');
      achCard.className = `ach-card ${isAchUnlocked ? 'unlocked' : 'locked'}`;
      achCard.innerHTML = `
        <span class="ach-icon">${ach.icon}</span>
        <div class="ach-info">
          <span class="ach-name">${ach.name} ${isAchUnlocked ? '✓' : '🔒'}</span>
          <span class="ach-desc">${ach.desc}</span>
        </div>
      `;
      achGridEl.appendChild(achCard);
    });
  }

  // Render Story Transmissions Drawer in Modal
  const storyCountEl = $('story-archive-count');
  const storyGridEl = $('story-archive-grid');
  if (storyCountEl && storyGridEl) {
    const unlockedChapters = getUnlockedChapters(progress);
    storyCountEl.textContent = `${unlockedChapters.length} / ${CHAPTERS.length} Chapters Unlocked`;
    storyGridEl.innerHTML = '';

    CHAPTERS.forEach(ch => {
      const isChapterUnlocked = unlockedChapters.includes(ch.number);
      if (!isChapterUnlocked) return;
      const seqs = getChapterSequences(ch.number);
      seqs.forEach(seq => {
        const viewed = hasViewedStory(seq.id, progress);
        const speaker = (seq.lines && seq.lines[0] && seq.lines[0].speaker) ? seq.lines[0].speaker : 'TRANSMISSION';

        const card = document.createElement('div');
        card.className = `story-entry-card ${viewed ? 'unlocked' : 'locked'}`;
        card.innerHTML = `
          <div class="story-entry-info">
            <span class="story-entry-tag">CHAPTER ${ch.number} · ${speaker.toUpperCase()}</span>
            <span class="story-entry-title">${seq.title}</span>
          </div>
          <button type="button" class="btn-story-replay" data-seq-id="${seq.id}">
            ${viewed ? '▶ REPLAY' : '▶ PLAY'}
          </button>
        `;

        const btn = card.querySelector('.btn-story-replay');
        if (btn) {
          btn.addEventListener('click', () => {
            closeCaseModal();
            playCinematic(seq.id);
          });
        }
        storyGridEl.appendChild(card);
      });
    });
  }
}

/**
 * Checks whether an unviewed story sequence should trigger for this case.
 * @param {number} caseIndex
 */
export function checkAndTriggerStoryForLevel(caseIndex) {
  progress = loadProgress();

  const caseIntroId = 'case' + String(caseIndex + 1).padStart(2, '0') + '_intro';

  /** @type {Record<number, string>} */
  const chapterIntroMap = {
    0: 'ch1_intro',
    3: 'ch2_intro',
    6: 'ch3_intro',
    9: 'ch4_intro'
  };

  const chIntroId = chapterIntroMap[caseIndex];

  if (chIntroId && !hasViewedStory(chIntroId, progress)) {
    playCinematic(chIntroId, () => {
      progress = loadProgress();
      if (!hasViewedStory(caseIntroId, progress)) {
        playCinematic(caseIntroId, () => {
          progress = loadProgress();
        });
      }
    });
  } else if (!hasViewedStory(caseIntroId, progress)) {
    playCinematic(caseIntroId, () => {
      progress = loadProgress();
    });
  }
}

export function loadLevel(i, force = false, triggerStory = true) {
  if (i < 0 || i >= LV.length) return false;
  if (!force && !isCaseUnlocked(i, progress)) {
    say('Case locked. Complete previous cases first.');
    return false;
  }

  lv = i;
  won = false;
  caseDeaths = 0;
  caseTotalTicks = 0;

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

  if (triggerStory) {
    checkAndTriggerStoryForLevel(i);
  }

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
  caseDeaths++;
  caseTotalTicks += getTick();
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
  caseTotalTicks += getTick();
  loops++;
  clearInput();
  startRound();
  started = false;
  say(auto ? 'Time ran out. Your run became a shadow.' : 'Shadow left behind. New loop.');
}

export function win() {
  const completedCase = lv;
  saveLevelHistory(completedCase, getRecording());

  const totalElapsedTicks = caseTotalTicks + getTick();
  caseTotalTicks = totalElapsedTicks;
  const result = recordCaseVictory(completedCase, {
    loops,
    totalTicks: totalElapsedTicks,
    deaths: caseDeaths
  });
  progress = result.currentProgress;

  if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
    for (const ach of result.newlyUnlocked) {
      showAchievementToast(ach);
    }
  }

  // Chapter Outro triggers upon solving the final case of each chapter
  // Chapter 1 Outro (Case 03 / index 2)
  if (completedCase === 2) {
    unlockChapter(2);
    progress = loadProgress();
    if (!hasViewedStory('ch1_outro', progress)) {
      playCinematic('ch1_outro', () => {
        progress = loadProgress();
        loadLevelNext();
        showCaseCompletionOverlay(completedCase, result, false);
      });
      return;
    }
  }

  // Chapter 2 Outro (Case 06 / index 5)
  if (completedCase === 5) {
    unlockChapter(3);
    progress = loadProgress();
    if (!hasViewedStory('ch2_outro', progress)) {
      playCinematic('ch2_outro', () => {
        progress = loadProgress();
        loadLevelNext();
        showCaseCompletionOverlay(completedCase, result, false);
      });
      return;
    }
  }

  // Chapter 3 Outro (Case 09 / index 8)
  if (completedCase === 8) {
    unlockChapter(4);
    progress = loadProgress();
    if (!hasViewedStory('ch3_outro', progress)) {
      playCinematic('ch3_outro', () => {
        progress = loadProgress();
        loadLevelNext();
        showCaseCompletionOverlay(completedCase, result, false);
      });
      return;
    }
  }

  // Chapter 4 Outro and Grand Epilogue (Case 12 / index 11)
  if (completedCase === LV.length - 1) {
    won = true;
    progress = loadProgress();
    if (!hasViewedStory('ch4_outro', progress)) {
      playCinematic('ch4_outro', () => {
        progress = loadProgress();
        if (!hasViewedStory('epilogue', progress)) {
          playCinematic('epilogue', () => {
            progress = loadProgress();
            showCaseCompletionOverlay(completedCase, result, true);
          });
        } else {
          showCaseCompletionOverlay(completedCase, result, true);
        }
      });
      return;
    } else if (!hasViewedStory('epilogue', progress)) {
      playCinematic('epilogue', () => {
        progress = loadProgress();
        showCaseCompletionOverlay(completedCase, result, true);
      });
      return;
    }

    showCaseCompletionOverlay(completedCase, result, true);
    return;
  }

  loadLevelNext();
  showCaseCompletionOverlay(completedCase, result, false);
}

export function loadLevelNext() {
  const nextLv = lv + 1;
  loadLevel(nextLv);
  say('Case ' + String(nextLv + 1).padStart(2, '0') + ' — ' + LV[nextLv].n);
}

export function showCaseCompletionOverlay(caseIndex, result, isGrandFinal) {
  const ovEl = $('ov');
  if (!ovEl) return;
  ovEl.style.display = 'flex';

  const lvlDef = LV[caseIndex];
  const stars = result.stars || 0;
  const starsHtml = [1, 2, 3].map(i => `<span class="ov-star ${i <= stars ? 'earned' : ''}">★</span>`).join('');
  const timeSec = (result.runStats.totalTicks * (TICK / 1000)).toFixed(1);

  let achHtml = '';
  if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
    const achList = result.newlyUnlocked.map(a => `<span>${a.icon} <strong>${a.name}</strong></span>`).join(' · ');
    achHtml = `<div class="ov-achievements">🏆 Accreditation: ${achList}</div>`;
  }

  const bestPill = result.isNewBestScore ? '<div class="new-best-pill">★ NEW PERSONAL BEST</div>' : '';

  if (isGrandFinal) {
    ovEl.innerHTML = `
      <img src="brand/icon.svg" alt="Vestigraid" class="ov-icon">
      <h2>ALL CASES CLOSED</h2>
      <div class="ov-paradox-subtitle">THE ECHO REMAINS &bull; SUBJECT 00 STATUS ACTIVE<br><em>END OF EXPERIMENT — OR THE BEGINNING?</em></div>
      <p>You completed all 12 sectors and broke the loop forever.<br>Loops on final case: ${result.runStats.loops}</p>
      <div class="ov-stars">${starsHtml}</div>
      <div class="ov-score-row">
        <span class="ov-score-val">${result.score}</span>
        <span class="ov-score-max">/ 1,000</span>
        <span class="ov-score-band">${result.breakdown.band}</span>
      </div>
      ${bestPill}
      <div class="score-breakdown-grid">
        <div class="breakdown-row"><span class="breakdown-label">Base Clearance:</span><span class="breakdown-val">+${result.breakdown.base} pts</span></div>
        <div class="breakdown-row"><span class="breakdown-label">Loop Efficiency:</span><span class="breakdown-val">+${result.breakdown.loopEfficiency} pts (${result.runStats.loops} loops)</span></div>
        <div class="breakdown-row"><span class="breakdown-label">Time Efficiency:</span><span class="breakdown-val">+${result.breakdown.timeEfficiency} pts (${timeSec}s)</span></div>
        <div class="breakdown-row"><span class="breakdown-label">Casualty Penalty:</span><span class="breakdown-val">-${result.breakdown.deathPenalty} pts (${result.runStats.deaths} deaths)</span></div>
      </div>
      ${achHtml}
      <div class="ov-btns">
        <button class="btn" id="ag">Play again</button>
        <button class="btn" id="ov-archive">Case Archive</button>
        <button class="btn" id="re-last">Restart final case</button>
      </div>
    `;

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
  } else {
    ovEl.innerHTML = `
      <div class="ov-card">
        <span class="ov-tag">CASE ${String(caseIndex + 1).padStart(2, '0')} COMPLETED</span>
        <h2 class="ov-title">${lvlDef.n}</h2>
        <div class="ov-stars">${starsHtml}</div>
        <div class="ov-score-row">
          <span class="ov-score-val">${result.score}</span>
          <span class="ov-score-max">/ 1,000</span>
          <span class="ov-score-band">${result.breakdown.band}</span>
        </div>
        ${bestPill}
        <div class="score-breakdown-grid">
          <div class="breakdown-row"><span class="breakdown-label">Base Clearance:</span><span class="breakdown-val">+${result.breakdown.base} pts</span></div>
          <div class="breakdown-row"><span class="breakdown-label">Loop Efficiency:</span><span class="breakdown-val">+${result.breakdown.loopEfficiency} pts (${result.runStats.loops} loops)</span></div>
          <div class="breakdown-row"><span class="breakdown-label">Time Efficiency:</span><span class="breakdown-val">+${result.breakdown.timeEfficiency} pts (${timeSec}s)</span></div>
          <div class="breakdown-row"><span class="breakdown-label">Casualty Penalty:</span><span class="breakdown-val">-${result.breakdown.deathPenalty} pts (${result.runStats.deaths} deaths)</span></div>
        </div>
        ${achHtml}
        <div class="ov-prev-best">Previous Best: ${result.prevScore} pts (${result.prevStars}★)</div>
        <div class="ov-action-btns">
          <button class="btn btn-primary" id="btn-next-case">Next Case</button>
          <button class="btn" id="btn-retry-case">Retry Case</button>
          <button class="btn" id="btn-ov-archive">Case Archive</button>
        </div>
      </div>
    `;

    const btnNext = $('btn-next-case');
    if (btnNext) {
      btnNext.onclick = () => {
        ovEl.style.display = 'none';
        say('Case ' + String(lv + 1).padStart(2, '0') + ' — ' + LV[lv].n);
      };
    }
    const btnRetry = $('btn-retry-case');
    if (btnRetry) {
      btnRetry.onclick = () => {
        ovEl.style.display = 'none';
        loadLevel(caseIndex);
      };
    }
    const btnArchive = $('btn-ov-archive');
    if (btnArchive) {
      btnArchive.onclick = () => {
        ovEl.style.display = 'none';
        openCaseModal();
      };
    }
  }
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
  const isRunning = started && !won && !paused && !isCinematicActive();
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
  window.TICK = TICK;

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

  // Scoring & Achievements compatibility
  window.STORAGE_KEY = STORAGE_KEY;
  window.CASE_TARGETS = CASE_TARGETS;
  window.ACHIEVEMENTS = ACHIEVEMENTS;
  window.calculateStarRating = calculateStarRating;
  window.calculateScore = calculateScore;
  window.calculateScoreBreakdown = calculateScoreBreakdown;
  window.getScoreBand = getScoreBand;
  window.evaluateAchievements = evaluateAchievements;
  window.getAchievement = getAchievement;
  window.recordCaseVictory = (caseIdx, stats) => {
    const res = recordCaseVictory(caseIdx, stats);
    progress = res.currentProgress;
    return res;
  };
  window.getTotalStars = () => getTotalStars(progress);
  window.getTotalScore = () => getTotalScore(progress);
  window.getUnlockedAchievements = () => getUnlockedAchievements(progress);
  window.getCaseDeaths = () => caseDeaths;
  window.getCaseTotalTicks = () => (won ? caseTotalTicks : caseTotalTicks + getTick());
  window.showAchievementToast = showAchievementToast;
  window.showCaseCompletionOverlay = showCaseCompletionOverlay;

  // Cinematic & Story compatibility
  window.getTick = getTick;
  window.playCinematic = playCinematic;
  window.isCinematicActive = isCinematicActive;
  window.skipCinematic = skipCinematic;
  window.hasViewedStory = (id) => hasViewedStory(id, loadProgress());
  window.markStoryViewed = (id) => { const p = markStoryViewed(id); progress = p; return p; };
  window.getUnlockedChapters = () => getUnlockedChapters(loadProgress());
  window.unlockChapter = (ch) => { const p = unlockChapter(ch); progress = p; return p; };
  window.CHAPTERS = CHAPTERS;
  window.STORY_SEQUENCES = STORY_SEQUENCES;
  window.getStorySequence = getStorySequence;
  window.checkAndTriggerStoryForLevel = checkAndTriggerStoryForLevel;
}

export function initGame() {
  initRenderer(cv);
  initCinematics();
  progress = loadProgress();

  initInput({
    onStartMove: () => {
      const ovEl = $('ov');
      if (ovEl && ovEl.style.display !== 'none' && !won) {
        ovEl.style.display = 'none';
      }
      if (!paused && !isModalOpen() && !isCinematicActive()) started = true;
    },
    onStrike: () => {
      const ovEl = $('ov');
      if (ovEl && ovEl.style.display !== 'none' && !won) {
        ovEl.style.display = 'none';
      }
      if (!paused && !isModalOpen() && !isCinematicActive()) started = true;
    },
    onCommit: () => { if (!isModalOpen() && !isCinematicActive()) commit(false); },
    onReset: () => { if (!isModalOpen() && !isCinematicActive()) loadLevel(lv); },
    onPause: () => {
      if (isModalOpen() || isCinematicActive()) return;
      paused = !paused;
      say(paused ? 'Paused. Press P to resume.' : '');
    },
    onCaseSelect: (open) => {
      if (isCinematicActive()) return;
      if (open === false) closeCaseModal();
      else toggleCaseModal();
    },
    isPaused: () => paused,
    isWon: () => won,
    isStarted: () => started,
    isModalOpen: () => isModalOpen()
  });

  window.addEventListener('keydown', (e) => {
    const ovEl = $('ov');
    if (ovEl && ovEl.style.display !== 'none' && !won) {
      if (isCinematicActive()) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        ovEl.style.display = 'none';
        say('Case ' + String(lv + 1).padStart(2, '0') + ' — ' + LV[lv].n);
      }
    }
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
