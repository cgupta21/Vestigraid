// ─── Cinematic Engine: Dialogue Presentation & Controller ────────────────────

import { getStorySequence } from './story.js';
import { markStoryViewed } from './progress.js';

/**
 * @typedef {import('./story.js').StorySequence} StorySequence
 * @typedef {import('./story.js').StoryLine} StoryLine
 */

let active = false;
/** @type {StorySequence | null} */
let currentSequence = null;
let currentLineIndex = 0;
let isTyping = false;
/** @type {any} */
let typeTimer = null;
let targetText = '';
let displayedLength = 0;
/** @type {((viewed: boolean) => void) | null} */
let onCompleteCallback = null;

// DOM Element references (cached on initialization)
/** @type {HTMLElement | null} */
let overlayEl = null;
/** @type {HTMLElement | null} */
let titleEl = null;
/** @type {HTMLElement | null} */
let chapterBadgeEl = null;
/** @type {HTMLElement | null} */
let speakerBadgeEl = null;
/** @type {HTMLElement | null} */
let dialogueTextEl = null;
/** @type {HTMLElement | null} */
let advancePromptEl = null;
/** @type {HTMLElement | null} */
let skipBtnEl = null;

/**
 * Initializes cinematic overlay references and listeners.
 */
export function initCinematics() {
  overlayEl = document.getElementById('cinematic-overlay');
  titleEl = document.getElementById('cinematic-title');
  chapterBadgeEl = document.getElementById('cinematic-chapter');
  speakerBadgeEl = document.getElementById('cinematic-speaker');
  dialogueTextEl = document.getElementById('cinematic-text');
  advancePromptEl = document.getElementById('cinematic-prompt');
  skipBtnEl = document.getElementById('cinematic-skip');

  if (skipBtnEl) {
    skipBtnEl.onclick = (e) => {
      e.stopPropagation();
      skipCinematic();
    };
  }

  if (overlayEl) {
    overlayEl.onclick = (e) => {
      // Clicking anywhere on dialogue box or viewport advances dialogue
      if (e.target !== skipBtnEl) {
        advanceOrFinishLine();
      }
    };
  }
}

/**
 * Returns whether a cinematic sequence is currently active on screen.
 * @returns {boolean}
 */
export function isCinematicActive() {
  return active;
}

/**
 * Plays a story sequence by ID or direct sequence definition.
 * @param {string | StorySequence} sequenceOrId
 * @param {(viewed: boolean) => void} [onComplete]
 * @param {{ autoMarkViewed?: boolean }} [options]
 */
export function playCinematic(sequenceOrId, onComplete, options = {}) {
  const seq = typeof sequenceOrId === 'string' ? getStorySequence(sequenceOrId) : sequenceOrId;
  if (!seq || !seq.lines || seq.lines.length === 0) {
    if (onComplete) onComplete(false);
    return;
  }

  // Ensure DOM is ready
  if (!overlayEl) {
    initCinematics();
  }
  if (!overlayEl) {
    console.warn('[Vestigraid] Cinematic overlay element not found');
    if (onComplete) onComplete(false);
    return;
  }

  // If a cinematic is already playing, cleanly abort previous callback
  if (active) {
    if (typeTimer) clearTimeout(typeTimer);
    isTyping = false;
    if (onCompleteCallback) {
      const prevCb = onCompleteCallback;
      onCompleteCallback = null;
      try { prevCb(false); } catch (_) {}
    }
  }

  active = true;
  currentSequence = seq;
  currentLineIndex = 0;
  onCompleteCallback = onComplete || null;

  // Setup overlay header
  if (titleEl) titleEl.textContent = seq.title || 'TRANSMISSION';
  if (chapterBadgeEl) {
    chapterBadgeEl.textContent = seq.chapter ? `CHAPTER ${seq.chapter}` : 'TRANSMISSION';
  }

  overlayEl.style.display = 'flex';
  overlayEl.classList.remove('fade-out');
  overlayEl.classList.add('active');

  renderLine(0);
}

/**
 * Renders the line at the specified index with typewriter effect.
 * @param {number} index
 */
function renderLine(index) {
  if (!currentSequence || index >= currentSequence.lines.length) {
    finishCinematic();
    return;
  }

  currentLineIndex = index;
  const line = currentSequence.lines[index];

  // Update speaker badge & styling
  if (speakerBadgeEl) {
    speakerBadgeEl.textContent = line.speaker;
    speakerBadgeEl.className = 'cinematic-speaker ' + (line.type || 'system');
  }

  if (overlayEl) {
    overlayEl.setAttribute('data-speaker-type', line.type || 'system');
  }

  if (advancePromptEl) {
    advancePromptEl.style.opacity = '0';
  }

  // Typewriter animation setup
  targetText = line.text;
  displayedLength = 0;
  isTyping = true;
  if (typeTimer) clearTimeout(typeTimer);

  if (dialogueTextEl) {
    dialogueTextEl.textContent = '';
  }

  typeStep();
}

/**
 * Incremental typewriter character step.
 */
function typeStep() {
  if (!isTyping) return;

  displayedLength += 2; // ~2 chars per step for snappy, engaging pace
  if (displayedLength >= targetText.length) {
    displayedLength = targetText.length;
    isTyping = false;
  }

  if (dialogueTextEl) {
    dialogueTextEl.textContent = targetText.slice(0, displayedLength);
  }

  if (isTyping) {
    typeTimer = setTimeout(typeStep, 16);
  } else {
    // Finished typing line
    if (advancePromptEl) {
      advancePromptEl.style.opacity = '1';
      advancePromptEl.textContent = (currentSequence && currentLineIndex < currentSequence.lines.length - 1)
        ? 'SPACE / ENTER to continue ▾'
        : 'SPACE / ENTER to proceed ▾';
    }
  }
}

/**
 * Advances dialogue or immediately finishes typewriter effect if currently typing.
 */
export function advanceOrFinishLine() {
  if (!active || !currentSequence) return;

  if (isTyping) {
    // Instantly reveal current line
    isTyping = false;
    if (typeTimer) clearTimeout(typeTimer);
    if (dialogueTextEl) {
      dialogueTextEl.textContent = targetText;
    }
    if (advancePromptEl) {
      advancePromptEl.style.opacity = '1';
    }
  } else {
    // Advance to next line
    renderLine(currentLineIndex + 1);
  }
}

/**
 * Skips the remainder of the cinematic immediately.
 */
export function skipCinematic() {
  if (!active) return;
  finishCinematic();
}

/**
 * Completes and closes the cinematic.
 */
function finishCinematic() {
  if (typeTimer) clearTimeout(typeTimer);
  isTyping = false;

  const finishedSeq = currentSequence;
  currentSequence = null;
  active = false;

  if (overlayEl) {
    overlayEl.classList.remove('active');
    overlayEl.style.display = 'none';
  }

  // Persist viewed state to localStorage
  if (finishedSeq && finishedSeq.id) {
    markStoryViewed(finishedSeq.id);
  }

  if (onCompleteCallback) {
    const cb = onCompleteCallback;
    onCompleteCallback = null;
    try {
      cb(true);
    } catch (err) {
      console.error('[Vestigraid] Error in cinematic completion callback:', err);
    }
  }
}

/**
 * Keyboard handler for cinematic input interception.
 * Returns true if the key was consumed by the cinematic.
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
export function handleCinematicKey(e) {
  if (!active) return false;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    skipCinematic();
    return true;
  }

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    advanceOrFinishLine();
    return true;
  }

  // Suppress all gameplay inputs during cinematic
  e.preventDefault();
  e.stopPropagation();
  return true;
}
