// ─── Enemy behavior, paths, combat, and collision ──────────────────────────

let enemies = [];

export function initEnemies(levelDef, grid, rows, cols, hist) {
  enemies = [];

  if (levelDef.boss) {
    const sp = [[9, 1], [10, 3], [8, 5]];
    for (let k = 0; k < 3; k++) {
      const h = (hist[k] && hist[k].length > 1) ? hist[k] : [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      let cur = { x: sp[k][0], y: sp[k][1] };
      const path = [[cur.x, cur.y]];
      for (let j = 1; j < h.length; j++) {
        const nx = cur.x + (h[j].x - h[j - 1].x);
        const ny = cur.y + (h[j].y - h[j - 1].y);
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] !== '#' && grid[ny][nx] !== 'E') {
          cur = { x: nx, y: ny };
        }
        path.push([cur.x, cur.y]);
      }
      enemies.push({ hunt: true, path, tag: '0' + (k + 1), dead: false });
    }
  } else {
    (levelDef.enemies || []).forEach(e => {
      enemies.push({ path: e.path, speed: e.speed, dead: false });
    });
  }

  return enemies;
}

export function getEnemies() {
  return enemies;
}

export function resetEnemiesAlive() {
  enemies.forEach(e => {
    e.dead = false;
  });
}

export function getEnemyPos(e, tt) {
  if (e.hunt) {
    if (!e.path || !e.path.length) return { x: -1, y: -1 };
    return {
      x: e.path[tt % e.path.length][0],
      y: e.path[tt % e.path.length][1]
    };
  }
  const n = e.path.length;
  if (n <= 1) return { x: e.path[0][0], y: e.path[0][1] };
  const cyc = 2 * (n - 1);
  let i = Math.floor(tt / e.speed) % cyc;
  if (i >= n) i = cyc - i;
  return { x: e.path[i][0], y: e.path[i][1] };
}

export function killAt(x, y, tt, onKill) {
  let hitCount = 0;
  enemies.forEach(e => {
    if (e.dead) return;
    const p = getEnemyPos(e, tt);
    if (p.x === x && p.y === y) {
      e.dead = true;
      hitCount++;
      if (onKill) onKill(e);
    }
  });
  return hitCount;
}

export function checkEnemyCollision(playerPos, prevPlayerPos, tt) {
  for (const e of enemies) {
    if (e.dead) continue;
    const a = getEnemyPos(e, tt);
    const b = getEnemyPos(e, tt - 1);
    const sameCellNow = a.x === playerPos.x && a.y === playerPos.y;
    const swapCross = a.x === prevPlayerPos.x && a.y === prevPlayerPos.y &&
                      b.x === playerPos.x && b.y === playerPos.y;
    if (sameCellNow || swapCross) {
      return e;
    }
  }
  return null;
}

export function areAllEnemiesDead() {
  return !enemies.some(e => !e.dead);
}
