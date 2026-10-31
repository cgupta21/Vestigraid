// ─── Player Progression & LocalStorage Persistence ────────────────────────────

export const STORAGE_KEY = 'vestigraid_progress_v1';
export const TOTAL_CASES = 12;

export function getInitialProgress() {
  return {
    highestUnlocked: 0,   // 0-indexed: 0 = Case 01, 7 = Case 08
    completedCases: [],   // array of 0-indexed completed cases: [0, 1, ...]
    gameCompleted: false,
    lastPlayed: 0
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialProgress();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return getInitialProgress();
    }

    // Validate highestUnlocked
    let highestUnlocked = parseInt(parsed.highestUnlocked, 10);
    if (isNaN(highestUnlocked) || highestUnlocked < 0) {
      highestUnlocked = 0;
    } else if (highestUnlocked >= TOTAL_CASES) {
      highestUnlocked = TOTAL_CASES - 1;
    }

    // Validate completedCases
    let completedCases = [];
    if (Array.isArray(parsed.completedCases)) {
      completedCases = parsed.completedCases
        .map(x => parseInt(x, 10))
        .filter(x => !isNaN(x) && x >= 0 && x < TOTAL_CASES);
      // Remove duplicates
      completedCases = [...new Set(completedCases)].sort((a, b) => a - b);
    }

    // Ensure highestUnlocked is at least as high as any completed case + 1
    if (completedCases.length > 0) {
      const maxCompleted = Math.max(...completedCases);
      const minUnlocked = Math.min(maxCompleted + 1, TOTAL_CASES - 1);
      highestUnlocked = Math.max(highestUnlocked, minUnlocked);
    }

    const gameCompleted = Boolean(completedCases.includes(TOTAL_CASES - 1));

    let lastPlayed = parseInt(parsed.lastPlayed, 10);
    if (isNaN(lastPlayed) || lastPlayed < 0 || lastPlayed >= TOTAL_CASES) {
      lastPlayed = highestUnlocked;
    }

    return {
      highestUnlocked,
      completedCases,
      gameCompleted,
      lastPlayed
    };
  } catch (err) {
    console.warn('[Vestigraid] Could not load saved progress, defaulting to fresh state:', err);
    return getInitialProgress();
  }
}

export function saveProgress(data) {
  try {
    const raw = (data && typeof data === 'object') ? data : loadProgress();
    const sanitized = {
      highestUnlocked: Math.max(0, Math.min(TOTAL_CASES - 1, parseInt(raw.highestUnlocked, 10) || 0)),
      completedCases: Array.isArray(raw.completedCases) ? [...new Set(raw.completedCases)] : [],
      gameCompleted: Boolean(raw.gameCompleted),
      lastPlayed: Math.max(0, Math.min(TOTAL_CASES - 1, parseInt(raw.lastPlayed, 10) || 0)),
      updatedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch (err) {
    console.warn('[Vestigraid] Could not save progress to localStorage:', err);
    return loadProgress();
  }
}

export function markCaseCompleted(caseIndex) {
  const current = loadProgress();

  if (!current.completedCases.includes(caseIndex)) {
    current.completedCases.push(caseIndex);
    current.completedCases.sort((a, b) => a - b);
  }

  // Monotonic unlock: next case unlocks if not already unlocked
  if (caseIndex < TOTAL_CASES - 1) {
    current.highestUnlocked = Math.max(current.highestUnlocked, caseIndex + 1);
  }

  // Completing Case 12 marks game as fully completed
  if (caseIndex === TOTAL_CASES - 1) {
    current.gameCompleted = true;
  }

  current.lastPlayed = caseIndex;
  saveProgress(current);
  return current;
}

export function isCaseUnlocked(caseIndex, progressData) {
  const prog = progressData || loadProgress();
  return caseIndex >= 0 && caseIndex <= prog.highestUnlocked;
}

export function isCaseCompleted(caseIndex, progressData) {
  const prog = progressData || loadProgress();
  return prog.completedCases.includes(caseIndex);
}

export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[Vestigraid] Could not remove localStorage key:', err);
  }
  const fresh = getInitialProgress();
  saveProgress(fresh);
  return fresh;
}

