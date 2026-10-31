// ─── Case Scoring & Three-Star Rating System ──────────────────────────────────

/**
 * Performance Targets per Case:
 * parLoops: Minimum required loops to solve the intended puzzle.
 * parTicks: Target tick threshold for maximum time efficiency.
 * max3StarTicks: Maximum total ticks allowable to still be eligible for 3 stars.
 */
export const CASE_TARGETS = [
  // Case 01: Hold the Door (6s limit = 43t) - Optimal solve ~17 ticks
  { parLoops: 2, parTicks: 25, max3StarTicks: 32 },

  // Case 02: Two Keys (7s limit = 50t) - Optimal solve ~16 ticks
  { parLoops: 3, parTicks: 28, max3StarTicks: 38 },

  // Case 03: The Sentry (8s limit = 57t) - Optimal solve ~22 ticks
  { parLoops: 2, parTicks: 30, max3StarTicks: 40 },

  // Case 04: The Team (10s limit = 71t) - Optimal solve ~15 ticks
  { parLoops: 2, parTicks: 28, max3StarTicks: 38 },

  // Case 05: The Relay (8s limit = 57t) - Optimal solve ~26 ticks (Consistent with 57t limit)
  { parLoops: 4, parTicks: 35, max3StarTicks: 45 },

  // Case 06: Crossfire (9s limit = 64t) - Optimal solve ~20 ticks
  { parLoops: 2, parTicks: 30, max3StarTicks: 42 },

  // Case 07: The Split (10s limit = 71t) - Optimal solve ~39 ticks (Consistent with 71t limit)
  { parLoops: 4, parTicks: 45, max3StarTicks: 55 },

  // Case 08: The Last Loop (13s limit = 93t) - Optimal solve ~24 ticks
  { parLoops: 3, parTicks: 38, max3StarTicks: 52 },

  // Case 09: The Laser Grid (10s limit = 71t) - Optimal solve ~18 ticks
  { parLoops: 3, parTicks: 32, max3StarTicks: 45 },

  // Case 10: The Rift (11s limit = 79t) - Optimal solve ~16 ticks
  { parLoops: 3, parTicks: 30, max3StarTicks: 44 },

  // Case 11: The Shift (12s limit = 86t) - Optimal solve ~22 ticks
  { parLoops: 3, parTicks: 34, max3StarTicks: 48 },

  // Case 12: The Paradox (14s limit = 100t) - Optimal solve ~23 ticks
  { parLoops: 4, parTicks: 42, max3StarTicks: 60 }
];

/**
 * Calculates star rating (0..3) for a completed case.
 *
 * 3 stars: Optimal loops, good time efficiency (<= max3StarTicks), and 0 deaths.
 * 2 stars: At most 1 extra loop or slightly slower time, and <= 2 deaths.
 * 1 star: Any legitimate completion.
 * 0 stars: Not completed.
 *
 * @param {number} caseIndex
 * @param {any} stats
 * @returns {number}
 */
export function calculateStarRating(caseIndex, stats) {
  if (!stats || stats.completed === false) return 0;
  const target = CASE_TARGETS[caseIndex] || { parLoops: 3, parTicks: 45, max3StarTicks: 60 };

  const loops = Math.max(1, parseInt(stats.loops, 10) || 1);
  const totalTicks = Math.max(1, parseInt(stats.totalTicks, 10) || target.parTicks);
  const deaths = Math.max(0, parseInt(stats.deaths, 10) || 0);

  // 3-Star condition: Flawless (0 deaths), minimum loops, and tight time efficiency
  if (loops <= target.parLoops && totalTicks <= target.max3StarTicks && deaths === 0) {
    return 3;
  }

  // 2-Star condition: Close to optimal (+1 loop or slightly higher time) with low deaths
  if (loops <= target.parLoops + 1 && totalTicks <= Math.round(target.max3StarTicks * 1.45) && deaths <= 2) {
    return 2;
  }

  // 1-Star: Case completed
  return 1;
}

/**
 * Calculates integer score (0..1,000) and detailed breakdown.
 *
 * Scoring formula:
 * - Base Completion: 400 pts (guaranteed upon victory).
 * - Loop Efficiency: Up to 350 pts. Full 350 at parLoops, -75 per extra loop (min 50).
 * - Time Efficiency: Up to 250 pts. Full 250 if totalTicks <= parTicks, scaled linearly (min 25).
 * - Death Penalty: -50 pts per death in the case session.
 *
 * Total score is clamped to [400, 1000] for any legitimate case completion.
 * Returns 0 if case is uncompleted.
 *
 * @param {number} caseIndex
 * @param {any} stats
 * @returns {{ base: number, loopEfficiency: number, timeEfficiency: number, deathPenalty: number, total: number, band: string }}
 */
export function calculateScoreBreakdown(caseIndex, stats) {
  if (!stats || stats.completed === false) {
    return {
      base: 0,
      loopEfficiency: 0,
      timeEfficiency: 0,
      deathPenalty: 0,
      total: 0,
      band: 'Not Completed'
    };
  }

  const target = CASE_TARGETS[caseIndex] || { parLoops: 3, parTicks: 45, max3StarTicks: 60 };
  const loops = Math.max(1, parseInt(stats.loops, 10) || 1);
  const totalTicks = Math.max(1, parseInt(stats.totalTicks, 10) || target.parTicks);
  const deaths = Math.max(0, parseInt(stats.deaths, 10) || 0);

  // 1. Base Score
  const base = 400;

  // 2. Loop Efficiency (up to 350 pts)
  let loopEfficiency = 350;
  if (loops > target.parLoops) {
    const extraLoops = loops - target.parLoops;
    loopEfficiency = Math.max(50, 350 - extraLoops * 75);
  }

  // 3. Time Efficiency (up to 250 pts)
  let timeEfficiency = 250;
  if (totalTicks > target.parTicks) {
    const excess = totalTicks - target.parTicks;
    const tolerance = target.parTicks * 1.5;
    const ratio = Math.max(0, 1 - (excess / tolerance));
    timeEfficiency = Math.max(25, Math.round(250 * ratio));
  }

  // 4. Death Penalty (-50 per death)
  const deathPenalty = deaths * 50;

  // 5. Total calculation clamped to [400, 1000]
  const rawTotal = base + loopEfficiency + timeEfficiency - deathPenalty;
  const total = Math.max(400, Math.min(1000, Math.round(rawTotal)));

  return {
    base,
    loopEfficiency,
    timeEfficiency,
    deathPenalty,
    total,
    band: getScoreBand(total)
  };
}

/**
 * @param {number} caseIndex
 * @param {any} stats
 * @returns {number}
 */
export function calculateScore(caseIndex, stats) {
  return calculateScoreBreakdown(caseIndex, stats).total;
}

/**
 * @param {number} score
 * @returns {string}
 */
export function getScoreBand(score) {
  if (score >= 900) return 'Excellent';
  if (score >= 700) return 'Good';
  if (score >= 400) return 'Completed';
  if (score > 0) return 'Completed (Inefficient)';
  return 'Not Completed';
}

