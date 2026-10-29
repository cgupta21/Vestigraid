// ─── Timer & tick coordination ───────────────────────────────────────────────

export const TICK = 140; // ms per game tick
export const MAX_DT = TICK * 3; // cap dt to prevent multi-tick bursts after tab switch

let t = 0;
let maxTicks = 214; // Default to Case 01 (30s)
let acc = 0;
let last = 0;

export function getTick() {
  return t;
}

export function setTick(val) {
  t = val;
}

export function getMaxTicks() {
  return maxTicks;
}

export function setMaxTicks(val) {
  maxTicks = val;
}

export function initTimerForLevel(levelDef) {
  const seconds = levelDef.timeLimit || levelDef.time || 30;
  maxTicks = Math.round((seconds * 1000) / TICK);
  t = 0;
  acc = 0;
}

export function resetRoundTimer() {
  t = 0;
  acc = 0;
}

export function incrementTick() {
  t++;
  return t;
}

export function isTimeExpired() {
  return t >= maxTicks;
}

export function getRemainingSeconds() {
  return Math.max(0, Math.ceil((maxTicks - t) * TICK / 1000));
}

export function getTimerPercent() {
  return Math.min(100, (t / maxTicks) * 100);
}

export function resetAccumulator() {
  acc = 0;
}

export function updateTimeAccumulator(ts, isRunning, onTick) {
  if (!last) last = ts;
  const dt = Math.min(ts - last, MAX_DT);
  last = ts;

  if (isRunning) {
    acc += dt;
    while (acc >= TICK) {
      acc -= TICK;
      const shouldContinue = onTick();
      if (!shouldContinue) break;
    }
  } else {
    acc = 0;
  }
}

