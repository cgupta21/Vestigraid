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
    enemies: [{ path: [[8, 1], [8, 2], [8, 3]], speed: 2 }]
  },
  {
    n: 'The Team',
    boss: true,
    timeLimit: 70,
    time: 70,
    hint: 'Your old runs are back, wearing red. All three must fall in the same run to open the exit. Use shadows to strike multiple enemies at once.',
    map: [
      '############',
      '#S.........#',
      '#..##..##..#',
      '#..........#',
      '#..##..##..#',
      '#.........E#',
      '############'
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

