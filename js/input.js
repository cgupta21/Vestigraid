// ─── Input handling (keyboard & touch D-pad) ──────────────────────────────────

import { KEY, DIRS } from './player.js';

let q = { dir: null, strike: false };
let held = [];

export function getQueuedInput() {
  return q;
}

export function getHeldKeys() {
  return held;
}

export function clearInput() {
  held = [];
  q = { dir: null, strike: false };
}

export function consumeInput() {
  const dir = q.dir || held[held.length - 1] || null;
  const wantStrike = q.strike;
  q.dir = null;
  q.strike = false;
  return { dir, wantStrike };
}

export function queueDirection(dir) {
  q.dir = dir;
}

export function queueStrike() {
  q.strike = true;
}

export function initInput({
  onStartMove,
  onStrike,
  onCommit,
  onReset,
  onPause,
  isPaused,
  isWon,
  isStarted
}) {
  // Keyboard listener
  window.addEventListener('keydown', e => {
    if (e.target !== document.body && e.target !== document.documentElement) return;

    const k = KEY[e.key];
    if (k) {
      e.preventDefault();
      if (!held.includes(k)) held.push(k);
      q.dir = k;
      if (!isPaused()) onStartMove();
    } else if (e.key === ' ') {
      e.preventDefault();
      q.strike = true;
      if (!isPaused()) onStrike();
    } else if (e.key === 'r' || e.key === 'R') {
      onCommit(false);
    } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
      e.preventDefault();
      onReset();
    } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isStarted() && !isWon()) {
      e.preventDefault();
      onPause();
    }
  });

  window.addEventListener('keyup', e => {
    const k = KEY[e.key];
    if (k) held = held.filter(x => x !== k);
  });

  // Touch / Pointer Pad listener
  document.querySelectorAll('.pad button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      if (k === 'pause') {
        if (isStarted() && !isWon()) onPause();
        return;
      }
      if (k === 'reset') {
        onReset();
        return;
      }
      if (isPaused()) return;

      if (DIRS[k]) {
        q.dir = k;
        if (!held.includes(k)) held.push(k);
        onStartMove();
      } else if (k === 'strike') {
        q.strike = true;
        onStrike();
      } else if (k === 'loop') {
        onCommit(false);
      }
    });

    const release = () => {
      held = held.filter(x => x !== k);
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointerleave', release);
    b.addEventListener('pointercancel', release);
  });
}
