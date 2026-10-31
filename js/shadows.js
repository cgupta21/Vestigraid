// ─── Shadow recording, playback, and pressure plates ─────────────────────────

let ghosts = [];
let rec = [];
let hist = []; // per-level recordings for the boss level

export function initShadows() {
  ghosts = [];
  rec = [];
}

export function startShadowRecording(pos, face) {
  rec = [{ x: pos.x, y: pos.y, f: [face[0], face[1]], s: 0 }];
}

export function recordShadowFrame(pos, face, strike) {
  rec.push({ x: pos.x, y: pos.y, f: [face[0], face[1]], s: strike });
}

export function getRecording() {
  return rec;
}

export function getGhosts() {
  return ghosts;
}

export function getGhostPos(g, tt) {
  return g[Math.min(tt, g.length - 1)];
}

export const MAX_GHOSTS = 6;

export function commitShadowLoop(t) {
  if (t < 2) {
  }
  ghosts.push(rec.slice());
  if (ghosts.length > MAX_GHOSTS) ghosts.shift();
  return { success: true, count: ghosts.length };
}

export function getGhostPlates(grid, ghosts, tt) {
  const activeSet = new Set();
  if (!ghosts || !grid) return activeSet;
  ghosts.forEach(g => {
    const r = getGhostPos(g, tt);
    if (r && grid[r.y] && grid[r.y][r.x]) {
      const c = grid[r.y][r.x];
      if (c >= 'a' && c <= 'z') activeSet.add(c);
    }
  });
  return activeSet;
}

export function getActivePlates(grid, ghosts, playerPos, tt) {
  const activeSet = new Set();
  const checkTile = (x, y) => {
    if (grid[y] && grid[y][x]) {
      const c = grid[y][x];
      if (c >= 'a' && c <= 'z') activeSet.add(c);
    }
  };

  ghosts.forEach(g => {
    const r = getGhostPos(g, tt);
    checkTile(r.x, r.y);
  });
  checkTile(playerPos.x, playerPos.y);

  return activeSet;
}

export function executeGhostStrikes(ghosts, tt, onKillAt) {
  ghosts.forEach(g => {
    const r = getGhostPos(g, tt);
    if (r.s && tt < g.length) {
      onKillAt(r.x + r.f[0], r.y + r.f[1], tt);
    }
  });
}

export function saveLevelHistory(levelIndex, recordData) {
  hist[levelIndex] = recordData.slice();
}

export function getHistory() {
  return hist;
}

export function resetHistory() {
  hist = [];
}
