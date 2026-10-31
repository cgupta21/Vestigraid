// ─── Level definitions & map parsing ─────────────────────────────────────────

export const LV = [
  {
    n: 'Hold the Door',
    timeLimit: 6,
    time: 6,
    requiredDoors: ['A'],
    hint: 'Walk to the plate (marked A), press R to leave your shadow there. Your shadow replays those moves and holds the door open while you walk through in the next loop.',
    map: [
      '##########',
      '#S..#....#',
      '#...A...E#',
      '#.a.#....#',
      '##########'
    ]
  },
  {
    n: 'Two Keys',
    timeLimit: 7,
    time: 7,
    requiredDoor: 'B',
    requiredDoors: ['A', 'B'],
    hint: 'Two plates (a, b), two doors (A, B). Loop 1: leave a shadow on plate a. Loop 2: use the open door A to reach plate b, then leave another shadow. Loop 3: both shadows hold the doors — walk to the exit.',
    map: [
      '############',
      '#S..#.b....#',
      '#.a.A..#...#',
      '####...B..E#',
      '############'
    ]
  },
  {
    n: 'The Sentry',
    timeLimit: 8,
    time: 8,
    requiredDoors: ['A'],
    hint: 'Loop 1: leave a shadow on plate a. Loop 2: the door stays open — walk through, time your approach to pass x=8 when the sentry is NOT in row 2, and reach the exit.',
    map: [
      '############',
      '#S...#.....#',
      '#..a.A....E#',
      '#....#.....#',
      '############'
    ],
    enemies: [{ path: [[8, 1], [8, 2], [8, 3]], speed: 2, tag: '01' }]
  },
  {
    n: 'The Team',
    boss: true,
    timeLimit: 10,
    time: 10,
    hint: 'Two rogue sentinels guard the sector corridors. Both must fall in the same run to open the exit. Use a shadow to eliminate one while you strike the other.',
    map: [
      '############',
      '#S.........#',
      '#..##..##..#',
      '#..........#',
      '#..##..##..#',
      '#.........E#',
      '############'
    ],
    enemies: [
      { path: [[7, 1], [8, 1], [9, 1]], speed: 2, tag: '01' },
      { path: [[5, 3], [6, 3], [7, 3]], speed: 2, tag: '02' }
    ]
  },
  {
    n: 'The Relay',
    timeLimit: 8,
    time: 8,
    requiredDoors: ['A', 'B', 'C'],
    hint: 'Three linked security chambers. Loop 1: hold plate a to open door A. Loop 2: hold plate b to open door B. Loop 3: hold plate c to open door C. Loop 4: traverse all three open doors to reach the exit.',
    map: [
      '############',
      '#S.#.b.##.E#',
      '#..A...B.C.#',
      '#.a#.c.##..#',
      '############'
    ]
  },
  {
    n: 'Crossfire',
    timeLimit: 9,
    time: 9,
    requiredDoors: ['A'],
    hint: 'Two intersecting sentries patrol the sector. Strike or dodge Sentry 01 to reach plate a, then time your advance past Sentry 02 to reach the exit.',
    map: [
      '############',
      '#S...#....E#',
      '#....A.....#',
      '#..a.#.....#',
      '#....#.....#',
      '############'
    ],
    enemies: [
      { path: [[2, 1], [2, 2], [2, 3], [2, 4]], speed: 2, tag: '01' },
      { path: [[8, 2], [8, 3], [8, 4]], speed: 2, tag: '02' }
    ]
  },
  {
    n: 'The Split',
    timeLimit: 10,
    time: 10,
    requiredDoors: ['C'],
    branchDoors: ['A', 'B'],
    hint: 'A branching sector. Loop 1: hold plate a to open upper branch A. Loop 2: enter branch A to hold plate b, opening lower branch B. Loop 3: enter branch B to hold plate c, opening gate C. Loop 4: take either branch to the exit.',
    map: [
      '############',
      '#S..#.....b#',
      '#...A...#..#',
      '#.a.####.CE#',
      '#...B...#..#',
      '#...#.....c#',
      '############'
    ]
  },
  {
    n: 'The Last Loop',
    boss: true,
    timeLimit: 13,
    time: 13,
    requiredDoors: ['B'],
    hint: 'The master sector. Use shadows to unlock doors A and B while coordinating attacks against two elite sentinels. Both sentinels must fall before the final exit unlocks.',
    map: [
      '############',
      '#S...#....b#',
      '#..a.A.#...#',
      '#....#.#...#',
      '#....#.#...#',
      '#....B....E#',
      '############'
    ],
    enemies: [
      { path: [[6, 2], [6, 3], [6, 4]], speed: 2, tag: '01' },
      { path: [[7, 5], [8, 5], [9, 5]], speed: 2, tag: '02' }
    ]
  },
  {
    n: 'The Laser Grid',
    timeLimit: 10,
    time: 10,
    requiredDoors: ['A', 'B'],
    hint: 'Pulsing laser barriers guard the security corridor. Loop 1: hold plate a to open Door A. Loop 2: time your run through Laser 1 when dormant to hold plate b, opening Door B. Loop 3: navigate past both laser grids to reach the exit.',
    map: [
      '############',
      '#S...#.....#',
      '#..a.A...BE#',
      '#....#..b..#',
      '############'
    ],
    lasers: [
      { id: 'L1', cells: [[6, 1], [6, 2], [6, 3]], period: 6, activeTicks: [0, 1, 2] },
      { id: 'L2', cells: [[8, 1], [8, 2]], period: 6, activeTicks: [3, 4, 5] }
    ]
  },
  {
    n: 'The Rift',
    timeLimit: 11,
    time: 11,
    requiredDoors: ['A', 'B'],
    hint: 'Teleportation portals bridge isolated containment vaults. Stepping into Portal Alpha (@) instantly transmits you to Portal Beta ($). Loop 1: hold plate a in the west vault to open Door A. Loop 2: warp across the rift to hold plate b. Loop 3: warp across and advance through Door B to the exit.',
    map: [
      '############',
      '#S..#...b..#',
      '#...@.A.#..#',
      '#.a.#.$.B.E#',
      '############'
    ],
    portals: [
      { a: { x: 4, y: 2 }, b: { x: 6, y: 3 }, tagA: 'α', tagB: 'β' }
    ]
  },
  {
    n: 'The Shift',
    timeLimit: 12,
    time: 12,
    requiredDoors: ['A', 'B'],
    hint: 'Shifting bulkheads cycle on an 8-tick rhythm. In Phase 0, Barrier 1 is open while Barrier 2 is solid; in Phase 1, the bulkheads invert. Loop 1: hold plate a. Loop 2: cross Barrier 1 in Phase 0 to hold plate b. Loop 3: navigate through the inverted bulkheads to the exit.',
    map: [
      '############',
      '#S...#...b.#',
      '#..a.A...B.#',
      '#....#....E#',
      '############'
    ],
    shifts: [
      { id: 'S1', cells: [[7, 1], [7, 2], [7, 3]], period: 8, activeTicks: [4, 5, 6, 7] },
      { id: 'S2', cells: [[8, 2], [8, 3]], period: 8, activeTicks: [0, 1, 2, 3] }
    ]
  },
  {
    n: 'The Paradox',
    boss: true,
    timeLimit: 14,
    time: 14,
    requiredDoors: ['A', 'B', 'C'],
    hint: 'The master paradox sector. Coordinate multiple independent shadow recordings across four security chambers. Eliminate both patrolling elite sentinels and keep plates a, b, and c held open to unlock the final exit.',
    map: [
      '############',
      '#S...#..b..#',
      '#..a.A.....#',
      '######.B####',
      '#..........#',
      '#.c..#..C.E#',
      '############'
    ],
    enemies: [
      { path: [[7, 2], [8, 2], [9, 2]], speed: 2, tag: '01' },
      { path: [[7, 5], [8, 5], [9, 5]], speed: 2, tag: '02' }
    ]
  }
];

export function parseLevelMap(levelIndex) {
  const levelDef = LV[levelIndex];
  const grid = levelDef.map.map(row => row.split(''));
  const rows = grid.length;
  const cols = grid[0].length;

  let start = { x: 1, y: 1 };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 'S') {
        start = { x, y };
        grid[y][x] = '.';
      }
    }
  }

  return { levelDef, grid, rows, cols, start };
}

/**
 * Authoritative exit-validation function for Vestigraid.
 * Evaluates whether all puzzle requirements for a case are satisfied.
 *
 * @param {number} levelIndex - 0-based case index (0..7)
 * @param {Set<string>} actPlates - Set of currently active lowercase plate identifiers (e.g. Set {'a', 'b'})
 * @param {Array<{tag: string, dead: boolean}>} enemies - Array of enemy state objects
 * @param {Set<string>} [ghostPlates] - Set of plates currently depressed specifically by shadows
 * @returns {{ canExit: boolean, message: string, lockedItem?: string }}
 */
export function canExitLevel(levelIndex, actPlates, enemies, ghostPlates) {
  const plates = actPlates || new Set();
  const shadows = ghostPlates !== undefined ? ghostPlates : plates;
  const enemyList = enemies || [];

  switch (levelIndex) {
    case 0: { // Case 01 — Hold the Door
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      return { canExit: true, message: '' };
    }

    case 1: { // Case 02 — Two Keys
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      return { canExit: true, message: '' };
    }

    case 2: { // Case 03 — The Sentry (Enemy avoidance: sentry does not need to be killed)
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      return { canExit: true, message: '' };
    }

    case 3: { // Case 04 — The Team (Mandatory combat: both sentinels must fall)
      const aliveEnemies = enemyList.filter(e => !e.dead);
      if (aliveEnemies.length > 0) {
        return {
          canExit: false,
          message: 'Kill all enemies to unlock the exit!',
          lockedItem: 'enemies'
        };
      }
      return { canExit: true, message: '' };
    }

    case 4: { // Case 05 — The Relay
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      if (!plates.has('c') || !shadows.has('c')) {
        return {
          canExit: false,
          message: 'Door C is locked — open it to unlock the exit!',
          lockedItem: 'C'
        };
      }
      return { canExit: true, message: '' };
    }

    case 5: { // Case 06 — Crossfire (Enemy avoidance permitted: sentries may be dodged or struck)
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      return { canExit: true, message: '' };
    }

    case 6: { // Case 07 — The Split
      if (!plates.has('c') || !shadows.has('c')) {
        return {
          canExit: false,
          message: 'Door C is locked — open it to unlock the exit!',
          lockedItem: 'C'
        };
      }
      const branchA = plates.has('a') && shadows.has('a');
      const branchB = plates.has('b') && shadows.has('b');
      if (!branchA && !branchB) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      return { canExit: true, message: '' };
    }

    case 7: { // Case 08 — The Last Loop (Mandatory combat & door: both sentinels dead AND Door B open)
      const aliveEnemies = enemyList.filter(e => !e.dead);
      if (aliveEnemies.length > 0) {
        return {
          canExit: false,
          message: 'Kill all enemies to unlock the exit!',
          lockedItem: 'enemies'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      return { canExit: true, message: '' };
    }

    case 8: { // Case 09 — The Laser Grid
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      return { canExit: true, message: '' };
    }

    case 9: { // Case 10 — The Rift
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      return { canExit: true, message: '' };
    }

    case 10: { // Case 11 — The Shift
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      return { canExit: true, message: '' };
    }

    case 11: { // Case 12 — The Paradox (Final Boss)
      const aliveEnemies = enemyList.filter(e => !e.dead);
      if (aliveEnemies.length > 0) {
        return {
          canExit: false,
          message: 'Kill all enemies to unlock the exit!',
          lockedItem: 'enemies'
        };
      }
      if (!plates.has('a') || !shadows.has('a')) {
        return {
          canExit: false,
          message: 'Door A is locked — open it to unlock the exit!',
          lockedItem: 'A'
        };
      }
      if (!plates.has('b') || !shadows.has('b')) {
        return {
          canExit: false,
          message: 'Door B is locked — open it to unlock the exit!',
          lockedItem: 'B'
        };
      }
      if (!plates.has('c') || !shadows.has('c')) {
        return {
          canExit: false,
          message: 'Door C is locked — open it to unlock the exit!',
          lockedItem: 'C'
        };
      }
      return { canExit: true, message: '' };
    }

    default:
      return { canExit: true, message: '' };
  }
}

export function getLevelLasers(levelIndex) {
  if (levelIndex < 0 || levelIndex >= LV.length) return [];
  return LV[levelIndex].lasers || [];
}

export function getLevelPortals(levelIndex) {
  if (levelIndex < 0 || levelIndex >= LV.length) return [];
  return LV[levelIndex].portals || [];
}

export function getLevelShifts(levelIndex) {
  if (levelIndex < 0 || levelIndex >= LV.length) return [];
  return LV[levelIndex].shifts || [];
}

export function isLaserActive(laser, t, actPlates) {
  if (!laser) return false;
  if (laser.disablePlate && actPlates && actPlates.has(laser.disablePlate)) {
    return false;
  }
  if (!laser.period || !laser.activeTicks) return true;
  const phase = t % laser.period;
  return laser.activeTicks.includes(phase);
}

export function isShiftSolid(shift, t) {
  if (!shift || !shift.period || !shift.activeTicks) return false;
  const phase = t % shift.period;
  return shift.activeTicks.includes(phase);
}
