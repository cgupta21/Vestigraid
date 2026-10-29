// ─── Player state, movement, and boundary collision ──────────────────────────

export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};

export const KEY = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

let pos = { x: 1, y: 1 };
let face = [1, 0];
let cd = 0;

export function initPlayer(startPos) {
  pos = { x: startPos.x, y: startPos.y };
  face = [1, 0];
  cd = 0;
}

export function getPlayerPos() {
  return pos;
}

export function setPlayerPos(newPos) {
  pos = { x: newPos.x, y: newPos.y };
}

export function getPlayerFace() {
  return face;
}

export function setPlayerFace(newFace) {
  face = [newFace[0], newFace[1]];
}

export function getPlayerCd() {
  return cd;
}

export function setPlayerCd(val) {
  cd = val;
}

export function stepCooldown() {
  if (cd > 0) cd--;
  return cd;
}

export function attemptStrike() {
  if (cd === 0) {
    cd = 3;
    return {
      strikeExecuted: true,
      targetX: pos.x + face[0],
      targetY: pos.y + face[1]
    };
  }
  return {
    strikeExecuted: false,
    targetX: pos.x + face[0],
    targetY: pos.y + face[1]
  };
}

export function isSolid(x, y, grid, cols, rows, actPlates, ghosts, tt, getGhostPosFn) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return true;
  if (!grid[y] || grid[y][x] === undefined) return true;

  const c = grid[y][x];
  if (c === '#') return true;
  // Exit tile is always passable (win condition checked separately in tick)
  if (c === 'E') return false;
  // Uppercase letters (doors A-Z) block unless the matching plate is active
  if (c >= 'A' && c <= 'Z' && !actPlates.has(c.toLowerCase())) return true;
  // Ghosts physically block the player
  return ghosts.some(g => {
    const r = getGhostPosFn(g, tt);
    return r.x === x && r.y === y;
  });
}

export function movePlayer(dir, grid, cols, rows, actPlates, ghosts, tt, getGhostPosFn) {
  if (!dir || !DIRS[dir]) return { moved: false, pos };

  face = DIRS[dir];
  const nx = pos.x + face[0];
  const ny = pos.y + face[1];

  if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !isSolid(nx, ny, grid, cols, rows, actPlates, ghosts, tt, getGhostPosFn)) {
    pos = { x: nx, y: ny };
    pos.x = Math.max(0, Math.min(cols - 1, pos.x));
    pos.y = Math.max(0, Math.min(rows - 1, pos.y));
    return { moved: true, pos };
  }

  pos.x = Math.max(0, Math.min(cols - 1, pos.x));
  pos.y = Math.max(0, Math.min(rows - 1, pos.y));
  return { moved: false, pos };
}
