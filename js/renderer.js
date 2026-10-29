// ─── Canvas rendering, UI updates, and visual theme ──────────────────────────

export const C = {
  floor: '#d6c196',
  line: '#c2a977',
  ink: '#1f1610',
  wall2: '#3b2c21',
  org: '#e2531f',
  olv: '#66722b',
  blood: '#8e1b1b',
  mus: '#d9a21b',
  paper: '#e6d3a6'
};

let cv = null;
let cx = null;

export function initRenderer(canvasElement) {
  cv = canvasElement;
  cx = cv.getContext('2d');
}

export function getCanvas() {
  return cv;
}

export function getContext() {
  return cx;
}

export function resizeCanvas(cols, rows) {
  if (!cv) return { W: 0, H: 0, T: 64, dpr: 1 };
  const T = Math.max(24, Math.min(64, Math.floor(900 / cols)));
  const dpr = window.devicePixelRatio || 1;
  const W = cols * T;
  const H = rows * T;

  if (cv.width !== W * dpr || cv.height !== H * dpr) {
    cv.width = W * dpr;
    cv.height = H * dpr;
  }

  return { W, H, T, dpr };
}

export function renderGame({
  grid,
  rows,
  cols,
  start,
  pos,
  face,
  cd,
  flash,
  actPlates,
  ghosts,
  enemies,
  getEnemyPosFn,
  getGhostPosFn,
  t,
  isBoss,
  requiredDoor,
  started,
  paused,
  won
}) {
  if (!cv || !cx) return;

  const { W, H, T, dpr } = resizeCanvas(cols, rows);

  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = C.floor;
  cx.fillRect(0, 0, W, H);

  // Tiles
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = grid[y][x];
      const px = x * T;
      const py = y * T;

      cx.strokeStyle = C.line;
      cx.lineWidth = 1;
      cx.strokeRect(px + 0.5, py + 0.5, T, T);

      if (c === '#') {
        // Wall
        cx.fillStyle = C.ink;
        cx.fillRect(px, py, T, T);
        cx.strokeStyle = C.wall2;
        cx.lineWidth = 2;
        cx.save();
        cx.beginPath();
        cx.rect(px, py, T, T);
        cx.clip();
        cx.beginPath();
        for (let i = -T; i < T; i += 8) {
          cx.moveTo(px + i, py + T);
          cx.lineTo(px + i + T, py);
        }
        cx.stroke();
        cx.restore();

      } else if (c >= 'a' && c <= 'z') {
        // Pressure plate
        const on = actPlates.has(c);
        cx.strokeStyle = C.ink;
        cx.lineWidth = 3;
        cx.fillStyle = on ? C.mus : C.floor;
        cx.beginPath();
        cx.arc(px + T / 2, py + T / 2, T * 0.3, 0, Math.PI * 2);
        cx.fill();
        cx.stroke();
        cx.fillStyle = C.ink;
        cx.font = '700 ' + (T * 0.3) + 'px Courier Prime,monospace';
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText(c.toUpperCase(), px + T / 2, py + T / 2 + 1);

      } else if (c >= 'A' && c <= 'Z' && c !== 'E') {
        // Security door
        const open = actPlates.has(c.toLowerCase());
        if (open) {
          cx.strokeStyle = C.ink;
          cx.setLineDash([4, 4]);
          cx.lineWidth = 2;
          cx.strokeRect(px + 4, py + 4, T - 8, T - 8);
          cx.setLineDash([]);
        } else {
          cx.fillStyle = C.mus;
          cx.fillRect(px + 2, py + 2, T - 4, T - 4);
          cx.strokeStyle = C.ink;
          cx.lineWidth = 3;
          cx.save();
          cx.beginPath();
          cx.rect(px + 2, py + 2, T - 4, T - 4);
          cx.clip();
          cx.beginPath();
          for (let i = -T; i < T; i += 10) {
            cx.moveTo(px + i, py + T);
            cx.lineTo(px + i + T, py);
          }
          cx.stroke();
          cx.restore();
          cx.strokeRect(px + 2, py + 2, T - 4, T - 4);
          cx.fillStyle = C.ink;
          cx.fillRect(px + T / 2 - T * 0.17, py + T / 2 - T * 0.17, T * 0.34, T * 0.34);
          cx.fillStyle = C.mus;
          cx.font = '700 ' + (T * 0.32) + 'px Courier Prime,monospace';
          cx.textAlign = 'center';
          cx.textBaseline = 'middle';
          cx.fillText(c, px + T / 2, py + T / 2 + 1);
        }

      } else if (c === 'E') {
        // Exit
        const bossLocked = Boolean(isBoss && enemies.some(e => !e.dead));
        const doorLocked = Boolean(requiredDoor && !actPlates.has(requiredDoor.toLowerCase()));
        const locked = bossLocked || doorLocked;
        cx.strokeStyle = locked ? C.blood : C.olv;
        cx.lineWidth = 3;
        cx.strokeRect(px + 5, py + 5, T - 10, T - 10);
        cx.strokeRect(px + 11, py + 11, T - 22, T - 22);
        if (locked) {
          cx.beginPath();
          cx.moveTo(px + 5, py + 5);
          cx.lineTo(px + T - 5, py + T - 5);
          cx.moveTo(px + T - 5, py + 5);
          cx.lineTo(px + 5, py + T - 5);
          cx.stroke();
        }
        cx.fillStyle = locked ? C.blood : C.olv;
        cx.font = '700 ' + (T * 0.22) + 'px Courier Prime,monospace';
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText('EXIT', px + T / 2, py + T / 2);
      }
    }
  }

  // Start marker (dashed outline)
  if (start) {
    cx.strokeStyle = C.ink;
    cx.lineWidth = 2;
    cx.setLineDash([3, 3]);
    cx.strokeRect(start.x * T + 6, start.y * T + 6, T - 12, T - 12);
    cx.setLineDash([]);
  }

  // Enemies (red diamonds)
  enemies.forEach(e => {
    if (e.dead) return;
    const p = getEnemyPosFn(e, t);
    const ex = p.x * T + T / 2;
    const ey = p.y * T + T / 2;
    const r = T * 0.36;
    cx.fillStyle = C.blood;
    cx.strokeStyle = C.ink;
    cx.lineWidth = 3;
    cx.beginPath();
    cx.moveTo(ex, ey - r);
    cx.lineTo(ex + r, ey);
    cx.lineTo(ex, ey + r);
    cx.lineTo(ex - r, ey);
    cx.closePath();
    cx.fill();
    cx.stroke();

    if (e.tag) {
      cx.fillStyle = C.paper;
      cx.font = '700 ' + (T * 0.26) + 'px Courier Prime,monospace';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(e.tag, ex, ey + 1);
    }
  });

  // Ghosts (olive squares)
  ghosts.forEach((g, i) => {
    const r = getGhostPosFn(g, t);
    const gx = r.x * T;
    const gy = r.y * T;
    cx.fillStyle = C.olv;
    cx.fillRect(gx + 5, gy + 5, T - 10, T - 10);
    cx.strokeStyle = C.ink;
    cx.lineWidth = 3;
    cx.setLineDash([5, 3]);
    cx.strokeRect(gx + 5, gy + 5, T - 10, T - 10);
    cx.setLineDash([]);
    cx.fillStyle = C.paper;
    cx.font = '700 ' + (T * 0.3) + 'px Courier Prime,monospace';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(i + 1, gx + T / 2, gy + T / 2 + 1);

    // Ghost strike indicator
    if (r.s && t < g.length) {
      cx.fillStyle = C.ink;
      cx.fillRect(gx + T / 2 + r.f[0] * T * 0.45 - 4, gy + T / 2 + r.f[1] * T * 0.45 - 4, 8, 8);
    }
  });

  // Player (orange square)
  const px = pos.x * T;
  const py2 = pos.y * T;
  cx.fillStyle = flash > 0 ? C.blood : C.org;
  cx.fillRect(px + 5, py2 + 5, T - 10, T - 10);
  cx.strokeStyle = C.ink;
  cx.lineWidth = 3;
  cx.strokeRect(px + 5, py2 + 5, T - 10, T - 10);

  // Direction dot
  cx.fillStyle = C.ink;
  cx.fillRect(px + T / 2 + face[0] * T * 0.28 - 4, py2 + T / 2 + face[1] * T * 0.28 - 4, 8, 8);

  // Strike effect
  if (cd === 2 || cd === 3) {
    cx.fillStyle = C.ink;
    cx.fillRect(px + T / 2 + face[0] * T * 0.6 - 6, py2 + T / 2 + face[1] * T * 0.6 - 6, 12, 12);
  }

  // Visual overlay when not yet started or paused
  if ((!started || paused) && !won) {
    cx.fillStyle = 'rgba(31,22,16,0.45)';
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#e6d3a6';
    cx.font = 'bold ' + Math.max(14, T * 0.5) + 'px Courier Prime,monospace';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(paused ? '— PAUSED —' : '▶ PRESS A KEY TO START', W / 2, H / 2);
  }
}

export function updateUI({ loops, t, maxTicks, tickMs, ghosts, domElements }) {
  const { loopn, tb, sh, countdown } = domElements;

  if (loopn) loopn.textContent = loops;

  const pct = Math.min(100, (t / maxTicks) * 100);
  if (tb) {
    tb.style.width = pct + '%';
    const remSec = Math.max(0, Math.ceil((maxTicks - t) * tickMs / 1000));
    tb.title = remSec + 's remaining';
    tb.setAttribute('data-remaining', remSec);
    tb.setAttribute('data-max', maxTicks);
  }

  const remSec = Math.max(0, Math.ceil((maxTicks - t) * tickMs / 1000));
  if (countdown) countdown.textContent = remSec + 's';

  if (sh) {
    sh.innerHTML = ghosts.length
      ? ghosts.map((g, i) => '<b>#' + (i + 1) + '</b><em>' + g.length + 't</em>').join('')
      : '<em>none yet</em>';
  }
}

