// ─── Achievement System ──────────────────────────────────────────────────────

import { CASE_TARGETS } from './scoring.js';

export const ACHIEVEMENTS = [
  {
    id: 'first_echo',
    name: 'First Echo',
    desc: 'Complete Case 01.',
    icon: '⚡'
  },
  {
    id: 'perfect_timing',
    name: 'Perfect Timing',
    desc: 'Earn three stars in any case.',
    icon: '⭐'
  },
  {
    id: 'shadow_master',
    name: 'Shadow Master',
    desc: 'Complete a case using its verified minimum shadow-loop requirement.',
    icon: '👥'
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    desc: 'Complete a case without dying.',
    icon: '🛡️'
  },
  {
    id: 'laser_runner',
    name: 'Laser Runner',
    desc: 'Complete Case 09 (The Laser Grid).',
    icon: '🔴'
  },
  {
    id: 'rift_walker',
    name: 'Rift Walker',
    desc: 'Complete Case 10 (The Rift).',
    icon: '🌀'
  },
  {
    id: 'shift_controller',
    name: 'Shift Controller',
    desc: 'Complete Case 11 (The Shift).',
    icon: '⚙️'
  },
  {
    id: 'paradox_solved',
    name: 'Paradox Solved',
    desc: 'Complete Case 12 (The Paradox).',
    icon: '♾️'
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    desc: 'Earn three stars in all 12 cases.',
    icon: '👑'
  },
  {
    id: 'master_of_vestigraid',
    name: 'Master of Vestigraid',
    desc: 'Complete all 12 cases and unlock all available achievements.',
    icon: '🏆'
  }
];

/**
 * @typedef {Object} Achievement
 * @property {string} id
 * @property {string} name
 * @property {string} desc
 * @property {string} icon
 */

/**
 * @typedef {Object} CaseRunStats
 * @property {number} [loops]
 * @property {number} [totalTicks]
 * @property {number} [deaths]
 * @property {boolean} [completed]
 * @property {number} [stars]
 * @property {number} [score]
 */

/**
 * @param {string} id
 * @returns {Achievement | null}
 */
export function getAchievement(id) {
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

/**
 * Evaluates which achievements unlock upon completing a case.
 *
 * @param {number} caseIndex - 0-based case index (0..11)
 * @param {CaseRunStats | any} stats - { loops, totalTicks, deaths, stars, score }
 * @param {any} progress - current player progress state
 * @returns {Achievement[]} - newly unlocked achievement definitions
 */
export function evaluateAchievements(caseIndex, stats, progress) {
  const currentUnlocked = new Set((progress && progress.achievements) || []);
  /** @type {Achievement[]} */
  const newlyUnlocked = [];

  const tryUnlock = (/** @type {string} */ id) => {
    if (!currentUnlocked.has(id)) {
      currentUnlocked.add(id);
      const def = getAchievement(id);
      if (def) newlyUnlocked.push(def);
    }
  };

  // 1. First Echo: Complete Case 01
  if (caseIndex === 0) {
    tryUnlock('first_echo');
  }

  // 2. Perfect Timing: Earn three stars in any case
  if (stats.stars === 3) {
    tryUnlock('perfect_timing');
  }

  // 3. Shadow Master: Complete a case using its verified minimum shadow-loop requirement
  const target = CASE_TARGETS[caseIndex];
  if (target && stats.loops <= target.parLoops) {
    tryUnlock('shadow_master');
  }

  // 4. Untouchable: Complete a case without dying
  if ((stats.deaths || 0) === 0) {
    tryUnlock('untouchable');
  }

  // Case-Specific Achievements
  if (caseIndex === 8) {
    tryUnlock('laser_runner');
  }
  if (caseIndex === 9) {
    tryUnlock('rift_walker');
  }
  if (caseIndex === 10) {
    tryUnlock('shift_controller');
  }
  if (caseIndex === 11) {
    tryUnlock('paradox_solved');
  }

  // 5. Perfectionist: Earn 3 stars in all 12 cases
  // Check whether all 12 cases now have 3 stars
  const currentStars = (progress && progress.stars) || {};
  const prevStar = (currentStars && currentStars[caseIndex] !== undefined) ? currentStars[caseIndex] : 0;
  const runStar = (stats && stats.stars !== undefined) ? stats.stars : 0;
  const starsMap = { ...currentStars, [caseIndex]: Math.max(prevStar, runStar) };
  let all12ThreeStars = true;
  for (let c = 0; c < 12; c++) {
    if ((starsMap[c] || 0) < 3) {
      all12ThreeStars = false;
      break;
    }
  }
  if (all12ThreeStars) {
    tryUnlock('perfectionist');
  }

  // 6. Master of Vestigraid: Complete all 12 cases and unlock all other achievements
  const solvedCases = (progress && Array.isArray(progress.completedCases)) ? progress.completedCases : [];
  const allCasesSolved = (
    solvedCases.includes(caseIndex) || solvedCases.length === 11
  ) && (
    new Set([...solvedCases, caseIndex]).size >= 12
  );

  // Check if first 9 achievements are unlocked
  const first9Ids = [
    'first_echo', 'perfect_timing', 'shadow_master', 'untouchable',
    'laser_runner', 'rift_walker', 'shift_controller', 'paradox_solved', 'perfectionist'
  ];
  const allFirst9Unlocked = first9Ids.every(id => currentUnlocked.has(id));

  if (allCasesSolved && allFirst9Unlocked) {
    tryUnlock('master_of_vestigraid');
  }

  return newlyUnlocked;
}

