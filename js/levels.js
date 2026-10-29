// ─── Level definitions & map parsing ─────────────────────────────────────────

export const LV = [
  {
    n: 'Hold the Door',
    timeLimit: 30,
    time: 30,
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
    timeLimit: 40,
    time: 40,
    requiredDoor: 'B',
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
    timeLimit: 50,
    time: 50,
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
    timeLimit: 70,
    time: 70,
    hint: 'Your old runs are back, wearing red. Both must fall in the same run to open the exit. Use shadows to strike multiple enemies at once.',
    map: [
      '############',
      '#S.........#',
      '#..##..##..#',
      '#..........#',
      '#..##..##..#',
      '#.........E#',
      '############'
    ]
  },
  {
    n: 'The Relay',
    timeLimit: 60,
    time: 60,
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
    timeLimit: 65,
    time: 65,
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
    timeLimit: 75,
    time: 75,
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
    timeLimit: 90,
    time: 90,
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
