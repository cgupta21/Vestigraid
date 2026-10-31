// ─── Player Progression, Scoring & LocalStorage Persistence ──────────────────

import { calculateStarRating, calculateScoreBreakdown } from './scoring.js';
import { evaluateAchievements } from './achievements.js';

export const STORAGE_KEY = 'vestigraid_progress_v1';
export const TOTAL_CASES = 12;

/**
 * @typedef {Object} CaseStat
 * @property {number} loops
 * @property {number} totalTicks
 * @property {number} deaths
 */

/**
 * @typedef {Object} PlayerProgress
 * @property {number} highestUnlocked
 * @property {number[]} completedCases
 * @property {boolean} gameCompleted
 * @property {number} lastPlayed
 * @property {Record<string|number, number>} scores
 * @property {Record<string|number, number>} stars
 * @property {Record<string|number, CaseStat>} caseStats
 * @property {string[]} achievements
 * @property {number} updatedAt
 */

/**
 * Safely resolves browser localStorage or returns null in restricted/node environments.
 * @returns {Storage | null}
 */
function getLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch (err) {
    // LocalStorage disabled or security restricted (e.g. sandboxed iframe)
  }
  return null;
}

/**
 * Generates default player progression state.
 * @returns {PlayerProgress}
 */
export function getInitialProgress() {
  return {
    highestUnlocked: 0,   // 0-indexed: 0 = Case 01, 11 = Case 12
    completedCases: /** @type {number[]} */ ([]),   // array of 0-indexed completed cases: [0, 1, ...]
    gameCompleted: false,
    lastPlayed: 0,
    scores: /** @type {Record<string|number, number>} */ ({}),           // { "0": 950, ... } best score per case (0..1000)
    stars: /** @type {Record<string|number, number>} */ ({}),            // { "0": 3, ... } best star rating per case (0..3)
    caseStats: /** @type {Record<string|number, CaseStat>} */ ({}),        // { "0": { loops: 2, totalTicks: 22, deaths: 0 } }
    achievements: /** @type {string[]} */ ([]),     // array of unlocked achievement IDs
    updatedAt: Date.now()
  };
}

/**
 * Loads and validates saved progress from localStorage with schema migration.
 * @returns {PlayerProgress}
 */
export function loadProgress() {
  try {
    const storage = getLocalStorage();
    const raw = storage ? storage.getItem(STORAGE_KEY) : null;
    if (!raw) return getInitialProgress();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getInitialProgress();
    }

    // Validate highestUnlocked
    let highestUnlocked = parseInt(String(parsed.highestUnlocked), 10);
    if (isNaN(highestUnlocked) || highestUnlocked < 0) {
      highestUnlocked = 0;
    } else if (highestUnlocked >= TOTAL_CASES) {
      highestUnlocked = TOTAL_CASES - 1;
    }

    // Validate completedCases
    /** @type {number[]} */
    let completedCases = [];
    if (Array.isArray(parsed.completedCases)) {
      completedCases = parsed.completedCases
        .map((/** @type {any} */ x) => parseInt(String(x), 10))
        .filter((/** @type {number} */ x) => !isNaN(x) && x >= 0 && x < TOTAL_CASES);
      completedCases = [...new Set(completedCases)].sort((a, b) => a - b);
    }

    // Ensure highestUnlocked is at least as high as any completed case + 1
    if (completedCases.length > 0) {
      const maxCompleted = Math.max(...completedCases);
      const minUnlocked = Math.min(maxCompleted + 1, TOTAL_CASES - 1);
      highestUnlocked = Math.max(highestUnlocked, minUnlocked);
    }

    const gameCompleted = Boolean(completedCases.includes(TOTAL_CASES - 1));

    let lastPlayed = parseInt(String(parsed.lastPlayed), 10);
    if (isNaN(lastPlayed) || lastPlayed < 0 || lastPlayed >= TOTAL_CASES) {
      lastPlayed = highestUnlocked;
    }

    // Scores & Stars migration & validation
    /** @type {Record<string|number, number>} */
    const scores = {};
    if (parsed.scores && typeof parsed.scores === 'object') {
      for (const [k, v] of Object.entries(parsed.scores)) {
        const cIdx = parseInt(k, 10);
        const scoreVal = parseInt(String(v), 10);
        if (!isNaN(cIdx) && cIdx >= 0 && cIdx < TOTAL_CASES && !isNaN(scoreVal)) {
          scores[cIdx] = Math.max(0, Math.min(1000, scoreVal));
        }
      }
    }

    /** @type {Record<string|number, number>} */
    const stars = {};
    if (parsed.stars && typeof parsed.stars === 'object') {
      for (const [k, v] of Object.entries(parsed.stars)) {
        const cIdx = parseInt(k, 10);
        const starVal = parseInt(String(v), 10);
        if (!isNaN(cIdx) && cIdx >= 0 && cIdx < TOTAL_CASES && !isNaN(starVal)) {
          stars[cIdx] = Math.max(0, Math.min(3, starVal));
        }
      }
    }

    // Backward-compatibility: Ensure completed cases from older saves have at least 1 star and base score
    for (const c of completedCases) {
      if (stars[c] === undefined) stars[c] = 1;
      if (scores[c] === undefined) scores[c] = 400;
    }

    // Case stats
    /** @type {Record<string|number, CaseStat>} */
    const caseStats = (parsed.caseStats && typeof parsed.caseStats === 'object') ? parsed.caseStats : {};

    // Achievements validation
    /** @type {string[]} */
    let achievements = [];
    if (Array.isArray(parsed.achievements)) {
      achievements = [...new Set(parsed.achievements.filter((/** @type {any} */ x) => typeof x === 'string'))];
    }

    return {
      highestUnlocked,
      completedCases,
      gameCompleted,
      lastPlayed,
      scores,
      stars,
      caseStats,
      achievements,
      updatedAt: parsed.updatedAt || Date.now()
    };
  } catch (err) {
    console.warn('[Vestigraid] Could not load saved progress, defaulting to fresh state:', err);
    return getInitialProgress();
  }
}

/**
 * Sanitizes and persists player progress to localStorage.
 * @param {any} [data]
 * @returns {PlayerProgress}
 */
export function saveProgress(data) {
  try {
    const raw = (data && typeof data === 'object') ? data : loadProgress();
    /** @type {PlayerProgress} */
    const sanitized = {
      highestUnlocked: Math.max(0, Math.min(TOTAL_CASES - 1, parseInt(String(raw.highestUnlocked), 10) || 0)),
      completedCases: Array.isArray(raw.completedCases)
        ? [...new Set(raw.completedCases.map((/** @type {any} */ x) => parseInt(String(x), 10)).filter((/** @type {number} */ x) => !isNaN(x) && x >= 0 && x < TOTAL_CASES))]
        : [],
      gameCompleted: Boolean(raw.gameCompleted),
      lastPlayed: Math.max(0, Math.min(TOTAL_CASES - 1, parseInt(String(raw.lastPlayed), 10) || 0)),
      scores: (raw.scores && typeof raw.scores === 'object') ? raw.scores : {},
      stars: (raw.stars && typeof raw.stars === 'object') ? raw.stars : {},
      caseStats: (raw.caseStats && typeof raw.caseStats === 'object') ? raw.caseStats : {},
      achievements: Array.isArray(raw.achievements)
        ? [...new Set(raw.achievements.filter((/** @type {any} */ x) => typeof x === 'string'))]
        : [],
      updatedAt: Date.now()
    };
    const storage = getLocalStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch (err) {
    console.warn('[Vestigraid] Could not save progress to localStorage:', err);
    return loadProgress();
  }
}

/**
 * @typedef {Object} VictoryReport
 * @property {number} caseIndex
 * @property {CaseStat & { completed: boolean }} runStats
 * @property {number} stars
 * @property {number} score
 * @property {any} breakdown
 * @property {number} prevScore
 * @property {number} prevStars
 * @property {boolean} isNewBestScore
 * @property {boolean} isNewBestStars
 * @property {any[]} newlyUnlocked
 * @property {PlayerProgress} currentProgress
 */

/**
 * Authoritative case victory recorder.
 * Updates completed cases, unlocks next case, calculates stars and score,
 * evaluates newly unlocked achievements, and preserves personal bests.
 * @param {number} caseIndex
 * @param {any} [runStats]
 * @returns {VictoryReport}
 */
export function recordCaseVictory(caseIndex, runStats) {
  const current = loadProgress();

  if (!current.completedCases.includes(caseIndex)) {
    current.completedCases.push(caseIndex);
    current.completedCases.sort((a, b) => a - b);
  }

  // Monotonic unlock
  if (caseIndex < TOTAL_CASES - 1) {
    current.highestUnlocked = Math.max(current.highestUnlocked, caseIndex + 1);
  }

  if (caseIndex === TOTAL_CASES - 1) {
    current.gameCompleted = true;
  }

  current.lastPlayed = caseIndex;

  // Calculate run rating & score safely without optional chaining dependencies
  const inputLoops = (runStats && runStats.loops !== undefined) ? Number(runStats.loops) : 1;
  const inputTicks = (runStats && runStats.totalTicks !== undefined) ? Number(runStats.totalTicks) : 20;
  const inputDeaths = (runStats && runStats.deaths !== undefined) ? Number(runStats.deaths) : 0;

  const safeStats = {
    loops: Math.max(1, !isNaN(inputLoops) ? Math.floor(inputLoops) : 1),
    totalTicks: Math.max(1, !isNaN(inputTicks) ? Math.floor(inputTicks) : 20),
    deaths: Math.max(0, !isNaN(inputDeaths) ? Math.floor(inputDeaths) : 0),
    completed: true
  };

  const runStars = calculateStarRating(caseIndex, safeStats);
  const scoreBreakdown = calculateScoreBreakdown(caseIndex, safeStats);
  const runScore = scoreBreakdown.total;

  // Check personal bests - maintain a single, coherent best-performance record
  if (!current.scores) current.scores = {};
  if (!current.stars) current.stars = {};
  if (!current.caseStats) current.caseStats = {};

  const prevScore = (current.scores[caseIndex] !== undefined) ? current.scores[caseIndex] : 0;
  const prevStars = (current.stars[caseIndex] !== undefined) ? current.stars[caseIndex] : 0;
  const prevCaseStats = current.caseStats[caseIndex] || null;
  const hasExistingRecord = Boolean(prevCaseStats && current.scores[caseIndex] !== undefined && current.stars[caseIndex] !== undefined);

  // Evaluate whether current run is a new personal best:
  // 1. If no complete record exists yet, current run establishes the coherent baseline.
  // 2. Stars represent the primary mastery tier (3 ★★★ > 2 ★★☆ > 1 ★☆☆). A higher star rating always wins.
  // 3. At identical star ratings, higher score represents superior efficiency.
  // 4. At identical stars and score, fewer total ticks (or deaths) acts as tiebreaker.
  // 5. A lower-star attempt NEVER degrades a higher-star personal best.
  let isNewBest = false;
  if (!hasExistingRecord) {
    isNewBest = true;
  } else if (runStars > prevStars) {
    isNewBest = true;
  } else if (runStars === prevStars && runScore > prevScore) {
    isNewBest = true;
  } else if (runStars === prevStars && runScore === prevScore && prevCaseStats) {
    const prevTicks = prevCaseStats.totalTicks !== undefined ? prevCaseStats.totalTicks : Infinity;
    const prevDeaths = prevCaseStats.deaths !== undefined ? prevCaseStats.deaths : Infinity;
    if (safeStats.totalTicks < prevTicks || (safeStats.totalTicks === prevTicks && safeStats.deaths < prevDeaths)) {
      isNewBest = true;
    }
  }

  // Atomic coherent update: stars, scores, and caseStats strictly originate from the SAME single best run
  if (isNewBest) {
    current.scores[caseIndex] = runScore;
    current.stars[caseIndex] = runStars;
    current.caseStats[caseIndex] = {
      loops: safeStats.loops,
      totalTicks: safeStats.totalTicks,
      deaths: safeStats.deaths
    };
  }

  const isNewBestScore = isNewBest && (runScore > prevScore || !hasExistingRecord);
  const isNewBestStars = isNewBest && (runStars > prevStars || !hasExistingRecord);

  // Evaluate achievements
  const evalStats = {
    ...safeStats,
    stars: runStars,
    score: runScore
  };
  const newlyUnlocked = evaluateAchievements(caseIndex, evalStats, current);
  if (Array.isArray(newlyUnlocked)) {
    for (const ach of newlyUnlocked) {
      if (ach && ach.id && !current.achievements.includes(ach.id)) {
        current.achievements.push(ach.id);
      }
    }
  }

  saveProgress(current);

  return {
    caseIndex,
    runStats: safeStats,
    stars: runStars,
    score: runScore,
    breakdown: scoreBreakdown,
    prevScore,
    prevStars,
    isNewBestScore,
    isNewBestStars,
    newlyUnlocked,
    currentProgress: current
  };
}

/**
 * Legacy / Test compatibility wrapper.
 * @param {number} caseIndex
 * @returns {PlayerProgress}
 */
export function markCaseCompleted(caseIndex) {
  return recordCaseVictory(caseIndex, { loops: 1, totalTicks: 20, deaths: 0 }).currentProgress;
}

/**
 * Checks if a case is unlocked for play.
 * @param {number} caseIndex
 * @param {PlayerProgress} [progressData]
 * @returns {boolean}
 */
export function isCaseUnlocked(caseIndex, progressData) {
  const prog = progressData || loadProgress();
  if (!prog) return caseIndex === 0;
  const highest = typeof prog.highestUnlocked === 'number' ? prog.highestUnlocked : 0;
  return caseIndex >= 0 && caseIndex <= highest;
}

/**
 * Checks if a case has been completed.
 * @param {number} caseIndex
 * @param {PlayerProgress} [progressData]
 * @returns {boolean}
 */
export function isCaseCompleted(caseIndex, progressData) {
  const prog = progressData || loadProgress();
  if (!prog || !Array.isArray(prog.completedCases)) return false;
  return prog.completedCases.includes(caseIndex);
}

/**
 * Sums stars earned across all cases.
 * @param {PlayerProgress} [progressData]
 * @returns {number}
 */
export function getTotalStars(progressData) {
  const prog = progressData || loadProgress();
  if (!prog || !prog.stars) return 0;
  return Object.values(prog.stars).reduce((sum, s) => sum + (parseInt(String(s), 10) || 0), 0);
}

/**
 * Sums highest scores earned across all cases.
 * @param {PlayerProgress} [progressData]
 * @returns {number}
 */
export function getTotalScore(progressData) {
  const prog = progressData || loadProgress();
  if (!prog || !prog.scores) return 0;
  return Object.values(prog.scores).reduce((sum, sc) => sum + (parseInt(String(sc), 10) || 0), 0);
}

/**
 * Retrieves list of unlocked achievement IDs.
 * @param {PlayerProgress} [progressData]
 * @returns {string[]}
 */
export function getUnlockedAchievements(progressData) {
  const prog = progressData || loadProgress();
  return (prog && Array.isArray(prog.achievements)) ? prog.achievements : [];
}

/**
 * Resets all saved progress and re-initializes fresh progress.
 * @returns {PlayerProgress}
 */
export function resetProgress() {
  try {
    const storage = getLocalStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[Vestigraid] Could not remove localStorage key:', err);
  }
  const fresh = getInitialProgress();
  saveProgress(fresh);
  return fresh;
}
