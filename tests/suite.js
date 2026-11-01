/**
 * Vestigraid Comprehensive Verification & Regression Test Suite
 * Tests all 4 cases in Chrome via CDP.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let testResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    testResults.push({ name: testName, pass: true, details });
  } else {
    console.error(`[FAIL] ${testName}: ${details}`);
    testResults.push({ name: testName, pass: false, details });
  }
}

async function runTests() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chromePath, [
    '--headless=new',
    '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`,
    'file:///C:/CG_PROJECT/Vestigraid/index.html'
  ]);

  try {
    let wsUrl = null;
    for (let retry = 0; retry < 20; retry++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const target = list.find(t => t.type === 'page');
        if (target) { wsUrl = target.webSocketDebuggerUrl; break; }
      } catch (e) { }
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const curId = id++;
        const handler = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.id === curId) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      return res.result ? res.result.value : res;
    }

    // Wait until page script has initialized
    for (let r = 0; r < 50; r++) {
      const type = await evaluate('typeof loadLevel');
      if (type === 'function') break;
      await new Promise(res => setTimeout(res, 100));
    }

    // Grant full unlock for regression tests 1-10
    await evaluate('progress.highestUnlocked = 11; progress.completedCases = [0,1,2,3,4,5,6,7,8,9,10,11]; progress.story = { viewed: Object.keys(STORY_SEQUENCES), unlockedChapters: [1,2,3,4] }; saveProgress(progress); if (typeof skipCinematic === "function" && isCinematicActive()) skipCinematic();');

    // Precise key tap that waits for exactly one tick to be consumed
    async function tap(key, code) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await new Promise(r => setTimeout(r, 20));
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      const curT = await evaluate('t');
      const startWait = Date.now();
      while (Date.now() - startWait < 500) {
        await new Promise(r => setTimeout(r, 15));
        const nextT = await evaluate('t');
        if (nextT > curT) break;
      }
    }

    async function sendKeyRaw(key, code) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await new Promise(r => setTimeout(r, 40));
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      await new Promise(r => setTimeout(r, 80));
    }

    console.log('=== TEST 1: Canvas Dimensions Across All Cases ===');
    const expectedDims = [
      { lv: 0, w: 640, h: 320, name: 'Case 01' },
      { lv: 1, w: 768, h: 320, name: 'Case 02' },
      { lv: 2, w: 768, h: 320, name: 'Case 03' },
      { lv: 3, w: 768, h: 448, name: 'Case 04' },
      { lv: 4, w: 768, h: 320, name: 'Case 05' },
      { lv: 5, w: 768, h: 384, name: 'Case 06' },
      { lv: 6, w: 768, h: 448, name: 'Case 07' },
      { lv: 7, w: 768, h: 448, name: 'Case 08' },
      { lv: 8, w: 768, h: 320, name: 'Case 09' },
      { lv: 9, w: 768, h: 320, name: 'Case 10' },
      { lv: 10, w: 768, h: 320, name: 'Case 11' },
      { lv: 11, w: 768, h: 448, name: 'Case 12' }
    ];
    for (const d of expectedDims) {
      await evaluate(`loadLevel(${d.lv})`);
      await new Promise(r => setTimeout(r, 50));
      let dims = await evaluate('({ w: cv.width, h: cv.height, cols, rows })');
      assert(dims.w === d.w && dims.h === d.h, `${d.name} canvas dimensions (${d.w}x${d.h})`, `w=${dims.w}, h=${dims.h}`);
    }

    console.log('\n=== TEST 2: Regression Test — Repeatedly Pressing Down at Lowest Playable Row in Case 04 ===');
    // In Case 04, start is (1,1). Moving down repeatedly reaches row 5 (lowest playable row: y=5, y=6 is wall).
    // Moving Down further must NOT exceed y=5, must NOT trigger "Caught", and must keep player within bounds.
    await evaluate('loadLevel(3)');
    await new Promise(r => setTimeout(r, 50));
    for (let i = 0; i < 15; i++) {
      await tap('ArrowDown', 'ArrowDown');
    }
    let pDown = await evaluate('pos');
    let msgDown = await evaluate('document.getElementById("msg").textContent');
    assert(pDown.x === 1 && pDown.y === 5, 'Player constrained to y=5 when pressing Down repeatedly', `pos=(${pDown.x}, ${pDown.y})`);
    assert(!msgDown.includes('Caught'), 'Pressing Down into bottom wall does NOT trigger "Caught"', `msg="${msgDown}"`);

    console.log('\n=== TEST 3: Holding / Pressing Up, Left, Right against Boundaries & Walls in Case 04 ===');
    // Press Left into left wall (x=0)
    for (let i = 0; i < 5; i++) await tap('ArrowLeft', 'ArrowLeft');
    let pLeft = await evaluate('pos');
    assert(pLeft.x === 1 && pLeft.y === 5, 'Player cannot cross left wall', `pos=(${pLeft.x}, ${pLeft.y})`);

    // Press Up all the way to top wall (y=0)
    for (let i = 0; i < 10; i++) await tap('ArrowUp', 'ArrowUp');
    let pUp = await evaluate('pos');
    assert(pUp.x === 1 && pUp.y === 1, 'Player cannot cross top wall', `pos=(${pUp.x}, ${pUp.y})`);

    // Press Up again into boundary
    await tap('ArrowUp', 'ArrowUp');
    let pUp2 = await evaluate('pos');
    assert(pUp2.x === 1 && pUp2.y === 1, 'Player stays at (1,1) when pressing Up into boundary', `pos=(${pUp2.x}, ${pUp2.y})`);

    console.log('\n=== TEST 4: Space Attacks Work in Facing Direction ===');
    await evaluate('loadLevel(3)');
    await new Promise(r => setTimeout(r, 50));
    // Face right
    await tap('ArrowRight', 'ArrowRight');
    let face = await evaluate('face');
    assert(face[0] === 1 && face[1] === 0, 'Player faces Right after ArrowRight', `face=[${face}]`);
    // Strike
    await tap(' ', 'Space');
    let cdVal = await evaluate('cd');
    assert(cdVal > 0, 'Strike triggered cooldown', `cd=${cdVal}`);

    console.log('\n=== TEST 5: Legitimate Enemy Collision Still Triggers Failure ("Caught") ===');
    // In Case 03: Sentry oscillates at x=8, y=1..3.
    // Loop 1: Open door A by leaving shadow at plate a (3,2)
    await evaluate('loadLevel(2)'); // Case 03
    await new Promise(r => setTimeout(r, 50));
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await sendKeyRaw('r', 'KeyR'); // Commit loop 1
    await new Promise(r => setTimeout(r, 100));
    // Loop 2: walk around shadow via row 1 into sentry at (8,1)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    // Sentry path is [[8,1],[8,2],[8,3]], speed 2. At t=0..1: [8,1]. At t=2..3: [8,2].
    // Walk down to row 2 at (4,2)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    // Wait until sentry is in row 2 (t % 4 is 2 or 3):
    let sentryCaught = false;
    for (let s = 0; s < 15; s++) {
      let m = await evaluate('document.getElementById("msg").textContent');
      if (m.includes('Caught')) { sentryCaught = true; break; }
      await tap('ArrowRight', 'ArrowRight');
    }
    let mFinal = await evaluate('document.getElementById("msg").textContent');
    assert(sentryCaught || mFinal.includes('Caught'), 'Enemy contact legitimately triggers "Caught"', 'Sentry caught player as expected');

    console.log('\n=== TEST 6: Pause / Resume, Reset, and Loop Transitions ===');
    await evaluate('loadLevel(0)');
    await new Promise(r => setTimeout(r, 50));
    await tap('ArrowRight', 'ArrowRight'); // start game
    let startedBefore = await evaluate('started');
    assert(startedBefore === true, 'Game started after move key');
    await sendKeyRaw('p', 'KeyP'); // pause
    let pausedState = await evaluate('paused');
    assert(pausedState === true, 'Game paused on P key');
    await sendKeyRaw('p', 'KeyP'); // resume
    let resumedState = await evaluate('paused');
    assert(resumedState === false, 'Game resumed on second P key');
    await sendKeyRaw('z', 'KeyZ'); // reset
    let resetPos = await evaluate('pos');
    assert(resetPos.x === 1 && resetPos.y === 1, 'Game resets to start position on Z key');

    console.log('\n=== TEST 7: Case 01, Case 02, Case 03 Gameplay Full Solve ===');
    // Case 01
    await evaluate('loadLevel(0)');
    await new Promise(r => setTimeout(r, 50));
    // Loop 1: to plate a (2,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowRight', 'ArrowRight'); // (2,3)
    await sendKeyRaw('r', 'KeyR');
    // Loop 2: wait 1 step, then walk to exit (8,2)
    await new Promise(r => setTimeout(r, 100));
    await tap(' ', 'Space'); // wait 1 tick so ghost steps ahead
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap('ArrowRight', 'ArrowRight'); // (8,2) -> E
    await new Promise(r => setTimeout(r, 200));
    let lvAfterC1 = await evaluate('lv');
    assert(lvAfterC1 === 1, 'Case 01 completed successfully, advanced to Case 02', `lv=${lvAfterC1}`);

    // Case 02: Verification of Plate/Door Validation and Full Puzzle Solve
    await new Promise(r => setTimeout(r, 100));
    // Test Premature Exit: in Loop 1, leave shadow on plate a (2,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // In Loop 2, pass Door A but do NOT hold plate b; walk straight to Exit (10,3)
    await tap(' ', 'Space'); // wait for ghost to clear doorway
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown');  // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2, Door A)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowUp', 'ArrowUp');      // (5,1)
    await tap('ArrowRight', 'ArrowRight'); // (6,1)
    await tap('ArrowRight', 'ArrowRight'); // (7,1) - step off plate b
    await tap('ArrowRight', 'ArrowRight'); // (8,1)
    await tap('ArrowRight', 'ArrowRight'); // (9,1)
    await tap('ArrowRight', 'ArrowRight'); // (10,1)
    await tap('ArrowDown', 'ArrowDown');  // (10,2)
    await tap('ArrowDown', 'ArrowDown');  // (10,3) -> Reached Exit E while Door B is locked!
    await new Promise(r => setTimeout(r, 100));

    let lvPrematureC2 = await evaluate('lv');
    let msgPrematureC2 = await evaluate('document.getElementById("msg").textContent');
    assert(lvPrematureC2 === 1, 'Case 02 does NOT advance when reaching exit while Door B is locked', `lv=${lvPrematureC2}`);
    assert(msgPrematureC2.includes('Door B is locked'), 'Case 02 displays locked door feedback on exit attempt', `msg="${msgPrematureC2}"`);

    // Reset Case 02 and perform the full intended solution
    await evaluate('loadLevel(1)');
    await new Promise(r => setTimeout(r, 100));
    // Loop 1: to plate a (2,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));
    // Loop 2: to plate b (6,1)
    await tap(' ', 'Space'); // wait
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown');  // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2, Door A)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowUp', 'ArrowUp');      // (5,1)
    await tap('ArrowRight', 'ArrowRight'); // (6,1, on plate b)
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));
    // Loop 3: both shadows hold doors — to exit (10,3) through Door B (7,3)
    await tap(' ', 'Space'); // wait
    await tap(' ', 'Space'); // wait
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown');  // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2, Door A)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowDown', 'ArrowDown');  // (6,3)
    await tap('ArrowRight', 'ArrowRight'); // (7,3, Door B)
    await tap('ArrowRight', 'ArrowRight'); // (8,3)
    await tap('ArrowRight', 'ArrowRight'); // (9,3)
    await tap('ArrowRight', 'ArrowRight'); // (10,3) -> E
    await new Promise(r => setTimeout(r, 200));
    let lvAfterC2 = await evaluate('lv');
    assert(lvAfterC2 === 2, 'Case 02 completed successfully after full puzzle solve, advanced to Case 03', `lv=${lvAfterC2}`);

    // Case 03
    await new Promise(r => setTimeout(r, 100));
    // Loop 1: to plate a (3,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await sendKeyRaw('r', 'KeyR');
    // Loop 2: walk around ghost through row 1, walk to exit (10,2) timed when sentry is clear
    await new Promise(r => setTimeout(r, 100));
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown');  // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2, Door A)
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap('ArrowRight', 'ArrowRight'); // (8,2) - clear of sentry
    await tap('ArrowRight', 'ArrowRight'); // (9,2)
    await tap('ArrowRight', 'ArrowRight'); // (10,2) -> E
    await new Promise(r => setTimeout(r, 200));
    let lvAfterC3 = await evaluate('lv');
    assert(lvAfterC3 === 3, 'Case 03 completed successfully, advanced to Case 04', `lv=${lvAfterC3}`);

    console.log('\n=== TEST 8: Case 04 Gameplay Audit, Combat, Shadow Replay & Exit Verification ===');
    await evaluate('hist = []; loadLevel(3)');
    await new Promise(r => setTimeout(r, 100));

    // 1. Verify Case 04 enemy configuration: exactly two hostile sentinels, enemy 03 removed
    let initialC4Enemies = await evaluate('enemies.map(e => ({ tag: e.tag, dead: e.dead }))');
    assert(initialC4Enemies.length === 2, 'Exactly two hostile sentinels spawn in Case 04', `count=${initialC4Enemies.length}`);
    assert(!initialC4Enemies.some(e => e.tag === '03'), 'Enemy 03 no longer appears in Case 04');
    assert(initialC4Enemies.some(e => e.tag === '01') && initialC4Enemies.some(e => e.tag === '02'), 'Case 04 contains enemies 01 and 02');

    // 2. Validate enemy spawn coordinates and map validity
    let spawnValid = await evaluate(`
      enemies.every(e => {
        let p = ePos(e, 0);
        return p.x >= 1 && p.x < cols - 1 && p.y >= 1 && p.y < rows - 1 && solid(p.x, p.y) === false;
      })
    `);
    assert(spawnValid === true, 'Enemy 01 and 02 spawn coordinates are inside playable grid and not on walls');

    // 3. Validate enemy visibility within canvas bounds
    let enemiesVisible = await evaluate(`
      enemies.every(e => {
        let p = ePos(e, 0);
        let ex = p.x * 64 + 32;
        let ey = p.y * 64 + 32;
        return ex > 0 && ex < cv.width && ey > 0 && ey < cv.height;
      })
    `);
    assert(enemiesVisible === true, 'Both enemies are positioned within visible canvas render boundaries');

    // 4. Test premature exit reaching before defeating all enemies in Case 04
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,4)
    await tap('ArrowDown', 'ArrowDown'); // (1,5)
    for (let i = 0; i < 9; i++) await tap('ArrowRight', 'ArrowRight'); // -> (10,5) E
    let lvPrematureC4 = await evaluate('lv');
    let msgPrematureC4 = await evaluate('document.getElementById("msg").textContent');
    assert(lvPrematureC4 === 3, 'Case 04 does not advance when reaching exit while enemies are alive');
    assert(msgPrematureC4.includes('Kill all enemies'), 'Case 04 prompts to kill all enemies at locked exit');

    // 5. Reset Case 04 for actual full combat & shadow replay solve
    await evaluate('hist = []; loadLevel(3)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk right along row 1 to (7,1), strike Enemy 01 at (8,1) at t=7
    for (let i = 0; i < 6; i++) await tap('ArrowRight', 'ArrowRight');
    await tap(' ', 'Space'); // strike facing right at (8,1) at t=7
    let e01Loop1Dead = await evaluate('enemies[0].dead');
    assert(e01Loop1Dead === true, 'Attack direction and hit detection eliminates Enemy 01 in Loop 1');

    // Commit Loop 1 to record shadow
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 150));

    // Loop 2: Shadow 1 replays walk & strike against Enemy 01.
    // Player takes middle corridor: Down to row 3, Right to (5,3), strike Enemy 02 at (6,3) at t=7.
    await tap('ArrowDown', 'ArrowDown'); // t=1 (1,2)
    await tap('ArrowDown', 'ArrowDown'); // t=2 (1,3)
    for (let i = 0; i < 4; i++) await tap('ArrowRight', 'ArrowRight'); // t=3:(2,3), t=4:(3,3), t=5:(4,3), t=6:(5,3)

    // Strike right towards (6,3) at t=7
    await tap(' ', 'Space'); // t=7

    // Verify shadow strike replay and player strike results
    let enemiesStatus = await evaluate('enemies.map(e => ({ tag: e.tag, dead: e.dead }))');
    console.log('Case 04 enemies status after synchronized strikes at t=7:', enemiesStatus);
    assert(enemiesStatus[0].dead === true, 'Shadow 1 replayed strike and eliminated Enemy 01');
    assert(enemiesStatus[1].dead === true, 'Player strike eliminated Enemy 02');
    assert(enemiesStatus.every(e => e.dead), 'Both Case 04 enemies defeated simultaneously in active run');

    // 6. Verify timer sufficiency
    let solveTick = await evaluate('t');
    let maxT = await evaluate('Math.round((LV[lv].timeLimit * 1000) / 140)');
    assert(solveTick < maxT * 0.25, 'Timer sufficiency confirmed (completed well within 10s limit)', `tick=${solveTick}/${maxT}`);

    // 7. Walk to Exit (10,5)
    await tap('ArrowDown', 'ArrowDown'); // t=8 (5,4)
    await tap('ArrowDown', 'ArrowDown'); // t=9 (5,5)
    for (let i = 0; i < 5; i++) await tap('ArrowRight', 'ArrowRight'); // (6,5), (7,5), (8,5), (9,5), (10,5) -> Exit!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC4 = await evaluate('lv');
    assert(lvAfterC4 === 4, 'Case 04 completed successfully after defeating both enemies, advanced to Case 05', `lv=${lvAfterC4}`);

    console.log('\n=== TEST 8B: Case 05 ("The Relay") Full Solve ===');
    await evaluate('hist = []; loadLevel(4)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to (2,3) [Plate a]
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowDown', 'ArrowDown'); // (2,3) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Wait 3, enter Door A (3,2) to (5,1) [Plate b]
    for (let i = 0; i < 3; i++) await tap(' ', 'Space');
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowUp', 'ArrowUp'); // (5,1) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Wait 9, enter Door A (3,2) to (5,3) [Plate c]
    for (let i = 0; i < 9; i++) await tap(' ', 'Space');
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (4,2)
    await tap('ArrowDown', 'ArrowDown'); // (4,3)
    await tap('ArrowRight', 'ArrowRight'); // (5,3) -> Plate c
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 4: Wait 15, traverse doors A, B, C to exit (10,1)
    for (let i = 0; i < 15; i++) await tap(' ', 'Space');
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2) Door B
    await tap('ArrowRight', 'ArrowRight'); // (8,2)
    await tap('ArrowRight', 'ArrowRight'); // (9,2) Door C
    await tap('ArrowRight', 'ArrowRight'); // (10,2)
    await tap('ArrowUp', 'ArrowUp'); // (10,1) -> Exit E!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC5 = await evaluate('lv');
    assert(lvAfterC5 === 5, 'Case 05 completed successfully, advanced to Case 06', `lv=${lvAfterC5}`);

    console.log('\n=== TEST 8C: Case 06 ("Crossfire") Full Solve ===');
    await evaluate('hist = []; loadLevel(5)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Strike Sentry 01 at (2,1), walk to Plate a at (3,3)
    await tap(' ', 'Space'); // Strike facing right -> kills Sentry 01 at (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowDown', 'ArrowDown'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await tap('ArrowDown', 'ArrowDown'); // (3,3) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Walk through Door A at (5,2), strike Sentry 02, reach Exit (10,1)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap(' ', 'Space'); // Strike facing right -> hits Sentry 02 when at (8,2)
    await tap('ArrowRight', 'ArrowRight'); // (8,2)
    await tap('ArrowRight', 'ArrowRight'); // (9,2)
    await tap('ArrowRight', 'ArrowRight'); // (10,2)
    await tap('ArrowUp', 'ArrowUp'); // (10,1) -> Exit E!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC6 = await evaluate('lv');
    assert(lvAfterC6 === 6, 'Case 06 completed successfully, advanced to Case 07', `lv=${lvAfterC6}`);

    console.log('\n=== TEST 8D: Case 07 ("The Split") Full Solve ===');
    await evaluate('hist = []; loadLevel(6)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to Plate a at (2,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowRight', 'ArrowRight'); // (2,3) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Wait 3, enter Upper Branch through Door A (4,2) to Plate b at (10,1)
    for (let i = 0; i < 3; i++) await tap(' ', 'Space');
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowUp', 'ArrowUp'); // (5,1)
    for (let i = 0; i < 5; i++) await tap('ArrowRight', 'ArrowRight'); // (10,1) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Wait 14, enter Lower Branch through Door B (4,4) to Plate c at (10,5)
    for (let i = 0; i < 14; i++) await tap(' ', 'Space');
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,4)
    await tap('ArrowRight', 'ArrowRight'); // (2,4)
    await tap('ArrowRight', 'ArrowRight'); // (3,4)
    await tap('ArrowRight', 'ArrowRight'); // (4,4) Door B
    await tap('ArrowRight', 'ArrowRight'); // (5,4)
    await tap('ArrowDown', 'ArrowDown'); // (5,5)
    for (let i = 0; i < 5; i++) await tap('ArrowRight', 'ArrowRight'); // (10,5) -> Plate c
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 4: Wait 27, traverse through Door A (4,2) & Door C (9,3) to Exit (10,3)
    for (let i = 0; i < 27; i++) await tap(' ', 'Space');
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await tap('ArrowRight', 'ArrowRight'); // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowUp', 'ArrowUp'); // (5,1)
    for (let i = 0; i < 4; i++) await tap('ArrowRight', 'ArrowRight'); // (9,1)
    await tap('ArrowDown', 'ArrowDown'); // (9,2)
    await tap('ArrowDown', 'ArrowDown'); // (9,3) Door C
    await tap('ArrowRight', 'ArrowRight'); // (10,3) -> Exit E!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC7 = await evaluate('lv');
    assert(lvAfterC7 === 7, 'Case 07 completed successfully, advanced to Case 08', `lv=${lvAfterC7}`);

    console.log('\n=== TEST 8E: Case 08 ("The Last Loop") Defeat Enemies & Final Victory ===');
    await evaluate('hist = []; loadLevel(7)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to Plate a at (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown'); // (3,2) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Wait 3, through Door A (5,2), strike Sentinel 01 at (6,2), walk to Plate b at (10,1)
    for (let i = 0; i < 3; i++) await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap(' ', 'Space'); // Strike facing right -> kills Sentinel 01 at (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowUp', 'ArrowUp'); // (6,1)
    for (let i = 0; i < 4; i++) await tap('ArrowRight', 'ArrowRight'); // (10,1) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Down to (4,5), wait 8 ticks for Door B to open at t=15, through Door B (5,5), strike Sentinel 02 at (8,5), reach Exit (10,5)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,4)
    await tap('ArrowDown', 'ArrowDown'); // (1,5)
    await tap('ArrowRight', 'ArrowRight'); // (2,5)
    await tap('ArrowRight', 'ArrowRight'); // (3,5)
    await tap('ArrowRight', 'ArrowRight'); // (4,5)
    for (let i = 0; i < 8; i++) await tap(' ', 'Space'); // Wait for Door B to open at t=15
    await tap('ArrowRight', 'ArrowRight'); // (5,5) Door B
    await tap('ArrowRight', 'ArrowRight'); // (6,5)
    await tap('ArrowRight', 'ArrowRight'); // (7,5)
    await tap(' ', 'Space'); // Strike facing right -> kills Sentinel 02 at (8,5)

    // Check enemies status
    let c8EnemiesStatus = await evaluate('enemies.map(e => ({ tag: e.tag, dead: e.dead }))');
    console.log('Case 08 enemies status after strikes:', c8EnemiesStatus);
    assert(c8EnemiesStatus.every(e => e.dead), 'Both Case 08 sentinels defeated');

    // Walk to Exit (10,5)
    await tap('ArrowRight', 'ArrowRight'); // (8,5)
    await tap('ArrowRight', 'ArrowRight'); // (9,5)
    await tap('ArrowRight', 'ArrowRight'); // (10,5) -> Exit E!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC8 = await evaluate('lv');
    assert(lvAfterC8 === 8, 'Case 08 completed successfully, advanced to Case 09', `lv=${lvAfterC8}`);

    console.log('\n=== TEST 8F: Case 09 ("The Laser Grid") Full Solve ===');
    await evaluate('hist = []; loadLevel(8)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to Plate a (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown'); // (3,2) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Wait 3 ticks, move through Door A (5,2) at t=8, L1 dormant at t=9..11, cross to Plate b (8,3)
    for (let i = 0; i < 3; i++) await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2) L1 off
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap('ArrowDown', 'ArrowDown'); // (7,3)
    await tap('ArrowRight', 'ArrowRight'); // (8,3) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Navigate down to row 3, east, into Door A (5,2), cross dormant L1 and L2, step through Door B to Exit (10,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowRight', 'ArrowRight'); // (2,3)
    await tap('ArrowRight', 'ArrowRight'); // (3,3)
    await tap('ArrowRight', 'ArrowRight'); // (4,3)
    await tap('ArrowUp', 'ArrowUp'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap(' ', 'Space'); // wait 1 tick
    await tap(' ', 'Space'); // wait 1 tick
    await tap('ArrowRight', 'ArrowRight'); // (6,2) L1 off
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap(' ', 'Space'); // wait 1 tick
    await tap('ArrowRight', 'ArrowRight'); // (8,2) L2 off
    await tap('ArrowRight', 'ArrowRight'); // (9,2) Door B
    await tap('ArrowRight', 'ArrowRight'); // (10,2) -> Exit!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC9 = await evaluate('lv');
    assert(lvAfterC9 === 9, 'Case 09 completed successfully, advanced to Case 10', `lv=${lvAfterC9}`);

    console.log('\n=== TEST 8G: Case 10 ("The Rift") Full Solve ===');
    await evaluate('hist = []; loadLevel(9)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to Plate a (2,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowRight', 'ArrowRight'); // (2,3) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Enter Portal Alpha (4,2), warps to Beta (6,3), Door A (6,2) is open, up to (6,1), right to Plate b (8,1)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown'); // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2) -> Portal Alpha warp to (6,3)
    await tap('ArrowUp', 'ArrowUp'); // (6,2) Door A
    await tap('ArrowUp', 'ArrowUp'); // (6,1)
    await tap('ArrowRight', 'ArrowRight'); // (7,1)
    await tap('ArrowRight', 'ArrowRight'); // (8,1) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Wait 4 ticks, enter Portal Alpha (4,2), warps to Beta (6,3), east through open Door B (8,3) to Exit (10,3)
    for (let i = 0; i < 4; i++) await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown'); // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2) -> Portal Alpha warp to (6,3)
    await tap('ArrowRight', 'ArrowRight'); // (7,3)
    await tap('ArrowRight', 'ArrowRight'); // (8,3) Door B
    await tap('ArrowRight', 'ArrowRight'); // (9,3)
    await tap('ArrowRight', 'ArrowRight'); // (10,3) -> Exit!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC10 = await evaluate('lv');
    assert(lvAfterC10 === 10, 'Case 10 completed successfully, advanced to Case 11', `lv=${lvAfterC10}`);

    console.log('\n=== TEST 8H: Case 11 ("The Shift") Full Solve ===');
    await evaluate('hist = []; loadLevel(10)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to Plate a (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown'); // (3,2) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Wait 2 ticks, (2,1)->(3,1)->(4,1)->(4,2)->(5,2) Door A, (6,2), cross S1 to (8,1) and Plate b (9,1)
    await tap(' ', 'Space');
    await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowUp', 'ArrowUp'); // (6,1)
    await tap('ArrowRight', 'ArrowRight'); // (7,1) S1 open
    await tap('ArrowRight', 'ArrowRight'); // (8,1)
    await tap('ArrowRight', 'ArrowRight'); // (9,1) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Wait 8 ticks for Shadow 2 to clear, through Door A, wait for Phase 1 when S2 opens, cross Door B to Exit (10,3)
    for (let i = 0; i < 8; i++) await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap(' ', 'Space'); // wait 1 tick -> t=15
    await tap('ArrowRight', 'ArrowRight'); // (7,2) at t=16 (S1 open)
    await tap('ArrowRight', 'ArrowRight'); // (7,2) wait
    await tap(' ', 'Space'); // wait
    await tap(' ', 'Space'); // wait
    await tap('ArrowRight', 'ArrowRight'); // (8,2) at t=20 (S2 opens)
    await tap('ArrowDown', 'ArrowDown'); // (8,3)
    await tap('ArrowRight', 'ArrowRight'); // (9,3)
    await tap('ArrowRight', 'ArrowRight'); // (10,3) -> Exit!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC11 = await evaluate('lv');
    assert(lvAfterC11 === 11, 'Case 11 completed successfully, advanced to Case 12', `lv=${lvAfterC11}`);

    console.log('\n=== TEST 8I: Case 12 ("The Paradox") Multi-Shadow Solve & Grand Final Victory ===');
    await evaluate('hist = []; loadLevel(11)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to Plate a (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown'); // (3,2) -> Plate a
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Wait 2, through Door A (5,2), step to (6,2), strike Sentinel 01 at (7,2), reach Plate b (8,1)
    await tap(' ', 'Space');
    await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap(' ', 'Space'); // Strike facing right -> eliminates Sentinel 01 at (7,2)
    await tap('ArrowUp', 'ArrowUp'); // (6,1)
    await tap('ArrowRight', 'ArrowRight'); // (7,1)
    await tap('ArrowRight', 'ArrowRight'); // (8,1) -> Plate b
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Advance through Door B (7,3), walk west along corridor 4 to Plate c (2,5)
    for (let i = 0; i < 5; i++) await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap('ArrowDown', 'ArrowDown'); // (7,3) Door B
    await tap('ArrowDown', 'ArrowDown'); // (7,4)
    await tap('ArrowLeft', 'ArrowLeft'); // (6,4)
    await tap('ArrowLeft', 'ArrowLeft'); // (5,4)
    await tap('ArrowLeft', 'ArrowLeft'); // (4,4)
    await tap('ArrowLeft', 'ArrowLeft'); // (3,4)
    await tap('ArrowLeft', 'ArrowLeft'); // (2,4)
    await tap('ArrowDown', 'ArrowDown'); // (2,5) -> Plate c
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 4: Advance through Door A (5,2), Door B (7,3), into (7,4), step down to (7,5), step right into Door C (8,5), strike Sentinel 02 at (9,5), step to Exit (10,5)!
    for (let i = 0; i < 9; i++) await tap(' ', 'Space');
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowRight', 'ArrowRight'); // (4,1)
    await tap('ArrowDown', 'ArrowDown'); // (4,2)
    await tap('ArrowRight', 'ArrowRight'); // (5,2) Door A
    await tap('ArrowRight', 'ArrowRight'); // (6,2)
    await tap('ArrowRight', 'ArrowRight'); // (7,2)
    await tap('ArrowDown', 'ArrowDown'); // (7,3) Door B
    await tap('ArrowDown', 'ArrowDown'); // (7,4)
    await tap('ArrowDown', 'ArrowDown'); // (7,5)
    await tap('ArrowRight', 'ArrowRight'); // (8,5) Door C (facing right)
    await tap(' ', 'Space'); // Strike facing right -> eliminates Sentinel 02 at (9,5)
    await tap('ArrowRight', 'ArrowRight'); // (9,5)
    await tap('ArrowRight', 'ArrowRight'); // (10,5) -> Exit E!

    await new Promise(r => setTimeout(r, 200));
    let wonGame12 = await evaluate('won');
    let ovDisplay12 = await evaluate('document.getElementById("ov").style.display');
    let ovHtml12 = await evaluate('document.getElementById("ov").innerHTML');

    assert(wonGame12 === true, 'Case 12 won condition reached (won = true)');
    assert(ovDisplay12 === 'flex', 'Victory overlay displayed (display = flex)');
    assert(ovHtml12.includes('ALL CASES CLOSED'), 'Victory overlay displays "ALL CASES CLOSED"');

    // Test restarting final case button
    await evaluate('document.getElementById("re-last").click()');
    await new Promise(r => setTimeout(r, 100));
    let lvAfterRestart = await evaluate('lv');
    let wonAfterRestart = await evaluate('won');
    assert(lvAfterRestart === 11 && wonAfterRestart === false, 'Restart final case button resets to Case 12');

    console.log('\n=== TEST 9: Timer Balance, Pausing, State Transitions & Auto-Commit ===');
    // 1. Verify per-case timer values and tick computations across all 12 cases
    const expectedTimers = [
      { lv: 0, s: 6, ticks: 43, name: 'Case 01' },
      { lv: 1, s: 7, ticks: 50, name: 'Case 02' },
      { lv: 2, s: 8, ticks: 57, name: 'Case 03' },
      { lv: 3, s: 10, ticks: 71, name: 'Case 04' },
      { lv: 4, s: 8, ticks: 57, name: 'Case 05' },
      { lv: 5, s: 9, ticks: 64, name: 'Case 06' },
      { lv: 6, s: 10, ticks: 71, name: 'Case 07' },
      { lv: 7, s: 13, ticks: 93, name: 'Case 08' },
      { lv: 8, s: 10, ticks: 71, name: 'Case 09' },
      { lv: 9, s: 11, ticks: 79, name: 'Case 10' },
      { lv: 10, s: 12, ticks: 86, name: 'Case 11' },
      { lv: 11, s: 14, ticks: 100, name: 'Case 12' }
    ];
    for (const exp of expectedTimers) {
      await evaluate(`loadLevel(${exp.lv})`);
      let tInfo = await evaluate('({ timeLimit: LV[lv].timeLimit, MAX })');
      assert(tInfo.timeLimit === exp.s && tInfo.MAX === exp.ticks, `${exp.name} configured for ${exp.s}s (${exp.ticks} ticks)`, `timeLimit=${tInfo.timeLimit}, MAX=${tInfo.MAX}`);
    }

    // 2. Timer bar display and progress matching
    await evaluate('loadLevel(0)');
    let tbStart = await evaluate('document.getElementById("tb").style.width');
    assert(tbStart === '0%', 'Timer bar starts at 0% width', `width=${tbStart}`);

    for (let s = 0; s < 5; s++) await tap('ArrowDown', 'ArrowDown');
    let tbProgress = await evaluate('({ width: document.getElementById("tb").style.width, t, MAX })');
    let expectedPct = (tbProgress.t / tbProgress.MAX * 100);
    let actualPct = parseFloat(tbProgress.width);
    assert(Math.abs(actualPct - expectedPct) < 0.1, 'Timer bar width matches actual tick progress', `actual=${actualPct}%, expected=${expectedPct}%`);

    // 3. Pause freezes timer ticks; unpause resumes
    await sendKeyRaw('p', 'KeyP'); // Pause
    let tAtPause = await evaluate('t');
    await new Promise(r => setTimeout(r, 450)); // Wait >3 ticks worth of real time
    let tAfterPauseWait = await evaluate('t');
    assert(tAtPause === tAfterPauseWait, 'Timer ticks do NOT advance while paused', `before=${tAtPause}, after=${tAfterPauseWait}`);

    await sendKeyRaw('p', 'KeyP'); // Resume
    await tap('ArrowDown', 'ArrowDown');
    let tAfterResume = await evaluate('t');
    assert(tAfterResume > tAtPause, 'Timer ticks resume advancing after unpause', `tAfterResume=${tAfterResume}`);

    // 4. Ending a loop with R resets t to 0
    await sendKeyRaw('r', 'KeyR');
    let tAfterCommit = await evaluate('t');
    let tbAfterCommit = await evaluate('document.getElementById("tb").style.width');
    assert(tAfterCommit === 0 && tbAfterCommit === '0%', 'Ending loop with R resets t to 0 and bar to 0%', `t=${tAfterCommit}, bar=${tbAfterCommit}`);

    // 5. Resetting with Z resets t to 0
    await tap('ArrowRight', 'ArrowRight'); // start round
    await sendKeyRaw('z', 'KeyZ');
    let tAfterResetZ = await evaluate('t');
    assert(tAfterResetZ === 0, 'Resetting level with Z resets t to 0', `t=${tAfterResetZ}`);

    // 6. Dying resets t to 0
    await evaluate('loadLevel(2)'); // Case 03 sentry
    await tap('ArrowDown', 'ArrowDown'); // starts game, t becomes 1
    await evaluate('pos = ePos(enemies[0], t + 1); tick();'); // trigger enemy collision
    let tAfterDeath = await evaluate('t');
    assert(tAfterDeath === 0, 'Dying resets timer t to 0 for the new loop', `t=${tAfterDeath}`);

    // 7. Auto-commit triggers when time runs out (t >= MAX)
    await evaluate('loadLevel(0)');
    await tap('ArrowDown', 'ArrowDown');
    await tap('ArrowDown', 'ArrowDown');
    let loopsBeforeExpire = await evaluate('loops');
    await evaluate('t = MAX - 1; tick();'); // Next tick exceeds MAX
    let expireInfo = await evaluate('({ t, loops, msg: document.getElementById("msg").textContent })');
    assert(expireInfo.t === 0 && expireInfo.loops === loopsBeforeExpire + 1, 'Auto-commit triggers at time limit expiration', `loops=${expireInfo.loops}, msg="${expireInfo.msg}"`);
    assert(expireInfo.msg.includes('Time ran out'), 'Auto-commit displays "Time ran out" message', `msg="${expireInfo.msg}"`);

    console.log('\n=== TEST 10: Brand Assets Integration & Responsiveness ===');
    // 1. Verify all 14 brand assets exist on disk with positive sizes
    const expectedAssets = [
      'brand/logo.svg',
      'brand/logo-on-dark.svg',
      'brand/logo.png',
      'brand/logo-on-dark.png',
      'brand/icon.svg',
      'brand/icon-maskable.svg',
      'brand/icon-192.png',
      'brand/icon-512.png',
      'brand/icon-maskable-512.png',
      'brand/favicon-32.png',
      'brand/apple-touch-icon.png',
      'favicon.ico',
      'site.webmanifest',
      'og-image.png'
    ];
    for (const asset of expectedAssets) {
      const fullPath = path.join(__dirname, '..', asset);
      const exists = fs.existsSync(fullPath);
      const size = exists ? fs.statSync(fullPath).size : 0;
      assert(exists && size > 0, `Asset ${asset} exists on disk (${size} bytes)`);
    }

    // 2. Verify logo element in DOM
    const logoInfo = await evaluate(`(() => {
      const img = document.querySelector('header h1 img.brand-logo');
      if (!img) return null;
      return {
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt'),
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: img.offsetWidth,
        height: img.offsetHeight
      };
    })()`);
    assert(logoInfo && logoInfo.src === 'brand/logo-on-dark.svg', 'Logo uses brand/logo-on-dark.svg in header');
    assert(logoInfo && logoInfo.complete && logoInfo.naturalWidth > 0, `Logo loaded successfully without error (${logoInfo?.naturalWidth}x${logoInfo?.naturalHeight})`);
    assert(logoInfo && logoInfo.alt === 'Vestigraid', 'Logo has accessible alt attribute ("Vestigraid")');

    // 3. Verify favicon, manifest and Open Graph metadata in head
    const headMeta = await evaluate(`(() => {
      return {
        svgIcon: document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href'),
        pngIcon: document.querySelector('link[rel="icon"][sizes="32x32"]')?.getAttribute('href'),
        appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
        shortcutIcon: document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href'),
        manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      };
    })()`);
    assert(headMeta.svgIcon === 'brand/icon.svg', 'SVG icon favicon referenced in head');
    assert(headMeta.pngIcon === 'brand/favicon-32.png', 'PNG 32x32 favicon referenced in head');
    assert(headMeta.appleIcon === 'brand/apple-touch-icon.png', 'Apple touch icon referenced in head');
    assert(headMeta.shortcutIcon === 'favicon.ico', 'Shortcut favicon.ico referenced in head');
    assert(headMeta.manifest === 'site.webmanifest', 'Web app manifest referenced in head');
    assert(headMeta.ogImage === 'og-image.png', 'Open Graph social image referenced in head');

    // 4. Verify desktop & mobile logo responsiveness and no overlap with stage/canvas/controls
    const desktopLayout = await evaluate(`(() => {
      const logo = document.querySelector('header h1 img.brand-logo');
      const stage = document.querySelector('.stage');
      const logoRect = logo.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        logoWidth: logoRect.width,
        logoHeight: logoRect.height,
        logoBottom: logoRect.bottom,
        stageTop: stageRect.top,
        overlap: !(logoRect.bottom <= stageRect.top)
      };
    })()`);
    assert(!desktopLayout.overlap, `[Desktop] Logo does not overlap stage or controls (bottom: ${Math.round(desktopLayout.logoBottom)}px <= stage top: ${Math.round(desktopLayout.stageTop)}px)`);
    assert(desktopLayout.logoWidth > 0 && desktopLayout.logoHeight > 0, `[Desktop] Logo is sharp and proportionate (${Math.round(desktopLayout.logoWidth)}x${Math.round(desktopLayout.logoHeight)}px)`);

    // Mobile layout test (375x667)
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 100));
    const mobileLayout = await evaluate(`(() => {
      const logo = document.querySelector('header h1 img.brand-logo');
      const stage = document.querySelector('.stage');
      const logoRect = logo.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        logoWidth: logoRect.width,
        logoHeight: logoRect.height,
        logoBottom: logoRect.bottom,
        stageTop: stageRect.top,
        overlap: !(logoRect.bottom <= stageRect.top)
      };
    })()`);
    assert(!mobileLayout.overlap, `[Mobile] Logo does not overlap stage or controls (bottom: ${Math.round(mobileLayout.logoBottom)}px <= stage top: ${Math.round(mobileLayout.stageTop)}px)`);
    assert(mobileLayout.logoWidth > 0 && mobileLayout.logoHeight > 0 && mobileLayout.logoWidth <= 375, `[Mobile] Logo scaled proportionately (${Math.round(mobileLayout.logoWidth)}x${Math.round(mobileLayout.logoHeight)}px)`);
    await send('Emulation.clearDeviceMetricsOverride');


    console.log('\n=== TEST 11: Progressive Case Unlocking & Persistent Player Progress ===');

    // 1. Initial State / New Player: Only Case 01 Unlocked
    await evaluate('localStorage.clear(); resetProgress();');
    const initProg = await evaluate('progress');
    assert(initProg.highestUnlocked === 0, 'New player starts with highestUnlocked = 0 (Case 01)');
    assert(Array.isArray(initProg.completedCases) && initProg.completedCases.length === 0, 'New player has empty completedCases list');
    assert(initProg.gameCompleted === false, 'New player has gameCompleted = false');
    assert(await evaluate('isCaseUnlocked(0)'), 'Case 01 is unlocked for new player');
    assert(!(await evaluate('isCaseUnlocked(1)')), 'Case 02 is locked for new player');
    assert(!(await evaluate('isCaseUnlocked(7)')), 'Case 08 is locked for new player');

    // Verify unforced loadLevel(1) is blocked for new player
    const loadLockedRes = await evaluate('loadLevel(1)');
    assert(loadLockedRes === false, 'loadLevel(1) rejected when Case 02 is locked');
    assert((await evaluate('lv')) === 0, 'Current level remains Case 01 after rejected loadLevel');

    // 2. Completing Case 01 Unlocks Case 02
    await evaluate('markCaseCompleted(0)');
    const progAfterC1 = await evaluate('progress');
    assert(progAfterC1.highestUnlocked === 1, 'Completing Case 01 sets highestUnlocked to 1');
    assert(progAfterC1.completedCases.includes(0), 'Case 01 recorded in completedCases');
    assert(await evaluate('isCaseUnlocked(1)'), 'Case 02 is now unlocked');
    const loadC2Res = await evaluate('loadLevel(1)');
    assert(loadC2Res === true, 'loadLevel(1) successfully loads Case 02 once unlocked');
    assert((await evaluate('lv')) === 1, 'Current level advanced to Case 02 (lv = 1)');

    // 3. Completing Case 05 Unlocks Case 06
    await evaluate('markCaseCompleted(1); markCaseCompleted(2); markCaseCompleted(3); markCaseCompleted(4);');
    const progAfterC5 = await evaluate('progress');
    assert(progAfterC5.highestUnlocked === 5, 'Completing through Case 05 sets highestUnlocked to 5 (Case 06)');
    assert(await evaluate('isCaseUnlocked(5)'), 'Case 06 is unlocked after completing Case 05');

    // 4. Cases Beyond Highest Unlocked Remain Disabled / Inaccessible
    assert(!(await evaluate('isCaseUnlocked(6)')), 'Case 07 remains locked');
    assert(!(await evaluate('isCaseUnlocked(7)')), 'Case 08 remains locked');
    const loadC7Res = await evaluate('loadLevel(6)');
    assert(loadC7Res === false, 'loadLevel(6) rejected while locked');

    // 5. Previously Unlocked Cases Remain Selectable
    assert(await evaluate('isCaseUnlocked(0)'), 'Previously unlocked Case 01 remains unlocked');
    assert(await evaluate('isCaseUnlocked(2)'), 'Previously unlocked Case 03 remains unlocked');
    const reloadC1Res = await evaluate('loadLevel(0)');
    assert(reloadC1Res === true && (await evaluate('lv')) === 0, 'Can navigate back to previously unlocked Case 01');

    // 6. Replaying Earlier Case Does Not Erase Progression (Monotonic Progression)
    await evaluate('markCaseCompleted(0)'); // replay Case 01
    await evaluate('loadLevel(2); markCaseCompleted(2);'); // replay Case 03
    const progAfterReplay = await evaluate('progress');
    assert(progAfterReplay.highestUnlocked === 5, 'Replaying Case 01 and Case 03 preserves highestUnlocked = 5');
    assert(progAfterReplay.completedCases.length === 5, 'completedCases does not duplicate entries or erase progress');

    // 7. LocalStorage Persistence & Reload
    const storedRaw = await evaluate('localStorage.getItem("vestigraid_progress_v1")');
    assert(typeof storedRaw === 'string' && storedRaw.length > 0, 'Progress successfully serialized into localStorage under key vestigraid_progress_v1');
    const storedObj = JSON.parse(storedRaw);
    assert(storedObj.highestUnlocked === 5 && storedObj.completedCases.includes(4), 'localStorage stores correct highestUnlocked and completedCases');

    // 8. Corrupted LocalStorage Safe Fallback
    await evaluate('localStorage.setItem("vestigraid_progress_v1", "{bad json!!}");');
    const fallbackProg = await evaluate('loadProgress()');
    assert(fallbackProg.highestUnlocked === 0, 'Corrupted JSON in localStorage falls back to highestUnlocked = 0 without crash');
    assert(fallbackProg.gameCompleted === false, 'Corrupted JSON falls back to gameCompleted = false');

    await evaluate('localStorage.setItem("vestigraid_progress_v1", JSON.stringify({ highestUnlocked: -10, completedCases: "invalid" }));');
    const clampedProg = await evaluate('loadProgress()');
    assert(clampedProg.highestUnlocked === 0 && Array.isArray(clampedProg.completedCases), 'Invalid schema/negative values normalized safely');

    // Restore valid state
    await evaluate(`saveProgress(${JSON.stringify(progAfterReplay)})`);
    await evaluate('if (isCinematicActive()) skipCinematic();');

    // 9. Case Selection UI Modal Rendering & Interaction
    await evaluate('openCaseModal()');
    const modalVisible = await evaluate('document.getElementById("case-modal").style.display !== "none"');
    assert(modalVisible, 'Case selection modal is visible when opened');

    const modalSummary = await evaluate('document.getElementById("progress-summary").textContent');
    assert(modalSummary.includes('6 of 12 Cases Unlocked'), `Modal displays accurate unlocked summary: "${modalSummary}"`);

    const cardStates = await evaluate(`(() => {
      const cards = document.querySelectorAll('.case-card');
      return Array.from(cards).map((c, i) => ({
        index: i,
        locked: c.classList.contains('locked'),
        unlocked: c.classList.contains('unlocked'),
        disabled: c.disabled,
        badgeText: c.querySelector('.case-badge')?.textContent
      }));
    })()`);
    assert(cardStates.length === 12, 'Modal renders all 12 case cards');
    assert(cardStates[0].unlocked && !cardStates[0].disabled && cardStates[0].badgeText.includes('COMPLETED'), 'Case 01 card is unlocked, enabled, and marked COMPLETED');
    assert(cardStates[5].unlocked && !cardStates[5].disabled && cardStates[5].badgeText.includes('UNLOCKED'), 'Case 06 card is unlocked and marked UNLOCKED');
    assert(cardStates[6].locked && cardStates[6].disabled && cardStates[6].badgeText.includes('LOCKED'), 'Case 07 card is locked, disabled, and has LOCKED badge');
    assert(cardStates[7].locked && cardStates[7].disabled && cardStates[7].badgeText.includes('LOCKED'), 'Case 08 card is locked, disabled, and has LOCKED badge');
    assert(cardStates[8].locked && cardStates[8].disabled && cardStates[8].badgeText.includes('LOCKED'), 'Case 09 card is locked, disabled, and has LOCKED badge');
    assert(cardStates[11].locked && cardStates[11].disabled && cardStates[11].badgeText.includes('LOCKED'), 'Case 12 card is locked, disabled, and has LOCKED badge');

    // Test Continue button loads highest unlocked case
    await evaluate('document.getElementById("btn-continue-case").click()');
    assert((await evaluate('lv')) === 5, 'Continue button in modal loads highest unlocked case (Case 06)');
    assert(!(await evaluate('document.getElementById("case-modal").style.display !== "none"')), 'Modal closes after clicking Continue');
    await evaluate('if (isCinematicActive()) skipCinematic();');

    // Test C key shortcut toggles modal
    await sendKeyRaw('c', 'KeyC');
    assert(await evaluate('document.getElementById("case-modal").style.display !== "none"'), 'Pressing C opens the case modal');
    await sendKeyRaw('Escape', 'Escape');
    assert(!(await evaluate('document.getElementById("case-modal").style.display !== "none"')), 'Pressing Escape closes the case modal');

    // 10. Reset Progress Confirmation Flow
    await evaluate('openCaseModal()');
    await evaluate('document.getElementById("btn-reset-prog").click()');
    const confirmBoxVisible = await evaluate('document.getElementById("reset-confirm").style.display !== "none"');
    assert(confirmBoxVisible, 'Reset confirmation box appears when clicking Reset Progress');

    await evaluate('document.getElementById("btn-cancel-reset").click()');
    assert(!(await evaluate('document.getElementById("reset-confirm").style.display !== "none"')), 'Cancel hides confirmation dialog');
    assert((await evaluate('progress.highestUnlocked')) === 5, 'Cancel preserves progress');

    await evaluate('document.getElementById("btn-reset-prog").click()');
    await evaluate('document.getElementById("btn-confirm-reset").click()');
    const postResetProg = await evaluate('progress');
    assert(postResetProg.highestUnlocked === 0, 'Confirming reset resets highestUnlocked to 0');
    assert(postResetProg.completedCases.length === 0, 'Confirming reset clears completedCases');
    assert((await evaluate('lv')) === 0, 'Confirming reset loads Case 01');

    // 11. Final Case 12 Completion & Victory Recording
    for (let c = 0; c < 12; c++) {
      await evaluate(`markCaseCompleted(${c})`);
    }
    const finalProg = await evaluate('progress');
    assert(finalProg.gameCompleted === true, 'Completing Case 12 records gameCompleted = true');
    assert(finalProg.highestUnlocked === 11, 'highestUnlocked reaches 11 on full game completion');
    assert(finalProg.completedCases.length === 12, 'All 12 cases recorded in completedCases');
    await evaluate('progress.story = { viewed: Object.keys(STORY_SEQUENCES), unlockedChapters: [1,2,3,4] }; saveProgress(progress); if (isCinematicActive()) skipCinematic();');

    console.log('\n=== TEST 11B: New Mechanics Unit & Integration Verification ===');
    // Laser Grid Verification
    await evaluate('loadLevel(8, true)');
    await new Promise(r => setTimeout(r, 40));
    const lasersDef = await evaluate('getLevelLasers(8)');
    assert(lasersDef.length === 2, 'Case 09 defines exactly 2 laser beam barriers');
    assert(await evaluate('isLaserActive(getLevelLasers(8)[0], 0, new Set())') === true, 'Laser 1 is ACTIVE on tick 0');
    assert(await evaluate('isLaserActive(getLevelLasers(8)[0], 4, new Set())') === false, 'Laser 1 is DORMANT on tick 4');
    assert(await evaluate('isLaserActive(getLevelLasers(8)[1], 0, new Set())') === false, 'Laser 2 is DORMANT on tick 0');
    assert(await evaluate('isLaserActive(getLevelLasers(8)[1], 4, new Set())') === true, 'Laser 2 is ACTIVE on tick 4');

    // Stepping into active laser triggers death
    await evaluate('pos = { x: 6, y: 2 }; tick();');
    const diedMsg = await evaluate('document.getElementById("msg").textContent');
    assert(diedMsg.includes('Laser grid vaporized loop') || diedMsg.includes('Caught'), 'Active laser contact legitimately vaporizes loop');

    // Portal Verification
    await evaluate('loadLevel(9, true)');
    await new Promise(r => setTimeout(r, 40));
    const portalsDef = await evaluate('getLevelPortals(9)');
    assert(portalsDef.length === 1, 'Case 10 defines 1 connected portal pair');
    // Step onto Portal Alpha (4,2) from (3,2)
    await evaluate('pos = { x: 3, y: 2 };');
    await tap('ArrowRight', 'ArrowRight');
    const posAfterWarp = await evaluate('pos');
    assert(posAfterWarp.x === 6 && posAfterWarp.y === 3, 'Entering Portal Alpha teleports player to Portal Beta (6,3)');
    // Staying on Portal Beta does not bounce in a loop
    await evaluate('tick();');
    const posStillBeta = await evaluate('pos');
    assert(posStillBeta.x === 6 && posStillBeta.y === 3, 'Staying on portal does not trigger infinite loop');

    // Shifting Bulkhead Verification
    await evaluate('loadLevel(10, true)');
    await new Promise(r => setTimeout(r, 40));
    const shiftsDef = await evaluate('getLevelShifts(10)');
    assert(shiftsDef.length === 2, 'Case 11 defines 2 alternating shifting bulkheads');
    assert(await evaluate('isShiftSolid(getLevelShifts(10)[0], 0)') === false, 'Bulkhead 1 is OPEN during Phase 0 (tick 0)');
    assert(await evaluate('isShiftSolid(getLevelShifts(10)[0], 5)') === true, 'Bulkhead 1 is SOLID during Phase 1 (tick 5)');
    assert(await evaluate('isShiftSolid(getLevelShifts(10)[1], 0)') === true, 'Bulkhead 2 is SOLID during Phase 0 (tick 0)');
    assert(await evaluate('isShiftSolid(getLevelShifts(10)[1], 5)') === false, 'Bulkhead 2 is OPEN during Phase 1 (tick 5)');

    // Multiple Recorded Shadows Verification
    await evaluate('loadLevel(11, true)');
    await new Promise(r => setTimeout(r, 40));
    // Commit 4 distinct recordings
    await evaluate(`(() => {
      ghosts.length = 0;
      ghosts.push([{ x: 3, y: 2, f: [1,0], s: 0 }]); // Shadow 1 on plate a
      ghosts.push([{ x: 8, y: 1, f: [1,0], s: 0 }]); // Shadow 2 on plate b
      ghosts.push([{ x: 2, y: 5, f: [1,0], s: 0 }]); // Shadow 3 on plate c
    })()`);
    const ghostCount = await evaluate('ghosts.length');
    assert(ghostCount === 3, 'Supports multiple simultaneous recorded shadows');
    const activePlatesMulti = await evaluate('Array.from(getGhostPlates(0))');
    assert(activePlatesMulti.includes('a') && activePlatesMulti.includes('b') && activePlatesMulti.includes('c'), 'All 3 shadows independently depress distinct plates');


    console.log('\n=== TEST 12: Exit Validation, Gate Synchronization & Anti-Bypass Across All 12 Cases ===');

    // 1. All 12 Cases: Verify Exit is initially LOCKED at start
    for (let c = 0; c < 12; c++) {
      await evaluate(`loadLevel(${c}, true)`);
      await new Promise(r => setTimeout(r, 40));
      const initExit = await evaluate(`canExitLevel(${c})`);
      assert(initExit.canExit === false, `Case ${String(c+1).padStart(2, '0')} exit is LOCKED at start`, `reason="${initExit.message}"`);
      assert(typeof initExit.message === 'string' && initExit.message.length > 0, `Case ${String(c+1).padStart(2, '0')} provides descriptive locked message`);
    }

    // 2. Anti-Bypass Verification Across All 12 Cases (Moving onto exit without puzzle solve rejects victory)
    const exitCoords = [
      { lv: 0, x: 8, y: 2, name: 'Case 01', expectedMsg: 'Door A is locked' },
      { lv: 1, x: 10, y: 3, name: 'Case 02', expectedMsg: 'Door A is locked' },
      { lv: 2, x: 10, y: 2, name: 'Case 03', expectedMsg: 'Door A is locked' },
      { lv: 3, x: 10, y: 5, name: 'Case 04', expectedMsg: 'Kill all enemies' },
      { lv: 4, x: 10, y: 1, name: 'Case 05', expectedMsg: 'Door A is locked' },
      { lv: 5, x: 10, y: 1, name: 'Case 06', expectedMsg: 'Door A is locked' },
      { lv: 6, x: 10, y: 3, name: 'Case 07', expectedMsg: 'Door C is locked' },
      { lv: 7, x: 10, y: 5, name: 'Case 08', expectedMsg: 'Kill all enemies' },
      { lv: 8, x: 10, y: 2, name: 'Case 09', expectedMsg: 'Door A is locked' },
      { lv: 9, x: 10, y: 3, name: 'Case 10', expectedMsg: 'Door A is locked' },
      { lv: 10, x: 10, y: 3, name: 'Case 11', expectedMsg: 'Door A is locked' },
      { lv: 11, x: 10, y: 5, name: 'Case 12', expectedMsg: 'Kill all enemies' }
    ];

    for (const ec of exitCoords) {
      await evaluate(`loadLevel(${ec.lv}, true)`);
      await new Promise(r => setTimeout(r, 40));
      // Force position directly onto Exit tile without solving puzzle
      await evaluate(`pos = { x: ${ec.x}, y: ${ec.y} }; tick();`);
      const currentLv = await evaluate('lv');
      const msg = await evaluate('document.getElementById("msg").textContent');
      assert(currentLv === ec.lv, `${ec.name} rejected premature exit (still on level ${ec.lv})`);
      assert(msg.includes(ec.expectedMsg), `${ec.name} displayed locked warning: "${msg}"`);
    }

    // 3. Partial Completion Checks: Completing only some requirements does NOT unlock exit
    // Case 02: Only Door A open, Door B closed
    const c2Partial = await evaluate('canExitLevel(1, new Set(["a"]), [], new Set(["a"]))');
    assert(c2Partial.canExit === false && c2Partial.message.includes('Door B is locked'), 'Case 02 rejects exit when only Door A is open');

    // Case 03: Sentry alive but Door A closed
    const c3Partial = await evaluate('canExitLevel(2, new Set(), [{tag: "01", dead: false}], new Set())');
    assert(c3Partial.canExit === false && c3Partial.message.includes('Door A is locked'), 'Case 03 rejects exit when Door A is closed, even with sentry alive');

    // Case 04: Sentinel 01 dead, Sentinel 02 alive
    const c4Partial1 = await evaluate('canExitLevel(3, new Set(), [{tag: "01", dead: true}, {tag: "02", dead: false}], new Set())');
    assert(c4Partial1.canExit === false && c4Partial1.message.includes('Kill all enemies'), 'Case 04 rejects exit when Sentinel 02 is alive');

    // Case 04: Sentinel 01 alive, Sentinel 02 dead
    const c4Partial2 = await evaluate('canExitLevel(3, new Set(), [{tag: "01", dead: false}, {tag: "02", dead: true}], new Set())');
    assert(c4Partial2.canExit === false && c4Partial2.message.includes('Kill all enemies'), 'Case 04 rejects exit when Sentinel 01 is alive');

    // Case 05: Doors A and B open, Door C closed
    const c5Partial = await evaluate('canExitLevel(4, new Set(["a", "b"]), [], new Set(["a", "b"]))');
    assert(c5Partial.canExit === false && c5Partial.message.includes('Door C is locked'), 'Case 05 rejects exit when Door C is closed');

    // Case 06: Sentries alive but Door A closed
    const c6Partial = await evaluate('canExitLevel(5, new Set(), [{tag: "01", dead: false}, {tag: "02", dead: false}], new Set())');
    assert(c6Partial.canExit === false && c6Partial.message.includes('Door A is locked'), 'Case 06 rejects exit when Door A is closed');

    // Case 07: Door A open, Gate C closed
    const c7Partial = await evaluate('canExitLevel(6, new Set(["a"]), [], new Set(["a"]))');
    assert(c7Partial.canExit === false && c7Partial.message.includes('Door C is locked'), 'Case 07 rejects exit when Gate C is closed');

    // Case 08: Door B open, Sentinel 01 dead, Sentinel 02 alive
    const c8Partial1 = await evaluate('canExitLevel(7, new Set(["b"]), [{tag: "01", dead: true}, {tag: "02", dead: false}], new Set(["b"]))');
    assert(c8Partial1.canExit === false && c8Partial1.message.includes('Kill all enemies'), 'Case 08 rejects exit when Sentinel 02 is alive');

    // Case 08: Door B open, Sentinel 01 alive, Sentinel 02 dead
    const c8Partial2 = await evaluate('canExitLevel(7, new Set(["b"]), [{tag: "01", dead: false}, {tag: "02", dead: true}], new Set(["b"]))');
    assert(c8Partial2.canExit === false && c8Partial2.message.includes('Kill all enemies'), 'Case 08 rejects exit when Sentinel 01 is alive');

    // Case 08: All sentinels dead, but Door B closed
    const c8PartialDoor = await evaluate('canExitLevel(7, new Set(), [{tag: "01", dead: true}, {tag: "02", dead: true}], new Set())');
    assert(c8PartialDoor.canExit === false && c8PartialDoor.message.includes('Door B is locked'), 'Case 08 rejects exit when Door B is closed');

    // Case 09: Door A open, Door B closed
    const c9Partial = await evaluate('canExitLevel(8, new Set(["a"]), [], new Set(["a"]))');
    assert(c9Partial.canExit === false && c9Partial.message.includes('Door B is locked'), 'Case 09 rejects exit when Door B is closed');

    // Case 10: Door A open, Door B closed
    const c10Partial = await evaluate('canExitLevel(9, new Set(["a"]), [], new Set(["a"]))');
    assert(c10Partial.canExit === false && c10Partial.message.includes('Door B is locked'), 'Case 10 rejects exit when Door B is closed');

    // Case 11: Door A open, Door B closed
    const c11Partial = await evaluate('canExitLevel(10, new Set(["a"]), [], new Set(["a"]))');
    assert(c11Partial.canExit === false && c11Partial.message.includes('Door B is locked'), 'Case 11 rejects exit when Door B is closed');

    // Case 12: Sentinels dead, but Door C closed
    const c12Partial1 = await evaluate('canExitLevel(11, new Set(["a", "b"]), [{tag: "01", dead: true}, {tag: "02", dead: true}], new Set(["a", "b"]))');
    assert(c12Partial1.canExit === false && c12Partial1.message.includes('Door C is locked'), 'Case 12 rejects exit when Door C is closed');

    // Case 12: All doors open, but Sentinel 02 alive
    const c12Partial2 = await evaluate('canExitLevel(11, new Set(["a", "b", "c"]), [{tag: "01", dead: true}, {tag: "02", dead: false}], new Set(["a", "b", "c"]))');
    assert(c12Partial2.canExit === false && c12Partial2.message.includes('Kill all enemies'), 'Case 12 rejects exit when Sentinel 02 is alive');

    // 4. Complete Requirement Satisfaction: Exit Unlocks (canExit === true) Across All 12 Cases
    const c1Full = await evaluate('canExitLevel(0, new Set(["a"]), [], new Set(["a"]))');
    assert(c1Full.canExit === true, 'Case 01 exit UNLOCKS when shadow holds plate a');

    const c2Full = await evaluate('canExitLevel(1, new Set(["a", "b"]), [], new Set(["a", "b"]))');
    assert(c2Full.canExit === true, 'Case 02 exit UNLOCKS when shadows hold plates a and b');

    const c3Full = await evaluate('canExitLevel(2, new Set(["a"]), [{tag: "01", dead: false}], new Set(["a"]))');
    assert(c3Full.canExit === true, 'Case 03 exit UNLOCKS with sentry ALIVE when shadow holds plate a');

    const c4Full = await evaluate('canExitLevel(3, new Set(), [{tag: "01", dead: true}, {tag: "02", dead: true}], new Set())');
    assert(c4Full.canExit === true, 'Case 04 exit UNLOCKS when both sentinels are eliminated');

    const c5Full = await evaluate('canExitLevel(4, new Set(["a", "b", "c"]), [], new Set(["a", "b", "c"]))');
    assert(c5Full.canExit === true, 'Case 05 exit UNLOCKS when shadows hold plates a, b, and c');

    const c6Full = await evaluate('canExitLevel(5, new Set(["a"]), [{tag: "01", dead: false}, {tag: "02", dead: false}], new Set(["a"]))');
    assert(c6Full.canExit === true, 'Case 06 exit UNLOCKS when shadow holds plate a');

    const c7Full = await evaluate('canExitLevel(6, new Set(["a", "c"]), [], new Set(["a", "c"]))');
    assert(c7Full.canExit === true, 'Case 07 exit UNLOCKS when branch and Gate C are held open');

    const c8Full = await evaluate('canExitLevel(7, new Set(["b"]), [{tag: "01", dead: true}, {tag: "02", dead: true}], new Set(["b"]))');
    assert(c8Full.canExit === true, 'Case 08 exit UNLOCKS when both sentinels are defeated and Door B is open');

    const c9Full = await evaluate('canExitLevel(8, new Set(["a", "b"]), [], new Set(["a", "b"]))');
    assert(c9Full.canExit === true, 'Case 09 exit UNLOCKS when shadows hold plates a and b');

    const c10Full = await evaluate('canExitLevel(9, new Set(["a", "b"]), [], new Set(["a", "b"]))');
    assert(c10Full.canExit === true, 'Case 10 exit UNLOCKS when shadows hold plates a and b');

    const c11Full = await evaluate('canExitLevel(10, new Set(["a", "b"]), [], new Set(["a", "b"]))');
    assert(c11Full.canExit === true, 'Case 11 exit UNLOCKS when shadows hold plates a and b');

    const c12Full = await evaluate('canExitLevel(11, new Set(["a", "b", "c"]), [{tag: "01", dead: true}, {tag: "02", dead: true}], new Set(["a", "b", "c"]))');
    assert(c12Full.canExit === true, 'Case 12 exit UNLOCKS when all sentinels are defeated and Doors A, B, and C are open');

    // 5. Visual State & Gameplay Exit Synchronization Across All 12 Cases
    for (let c = 0; c < 12; c++) {
      await evaluate(`loadLevel(${c}, true)`);
      await new Promise(r => setTimeout(r, 40));
      // At start, canExitLevel is false, so renderer renders locked state (red)
      const renderLockedState = await evaluate('renderCurrentFrame(); isExitVisualLocked()');
      assert(renderLockedState === true, `Case ${String(c+1).padStart(2, '0')} renderer visual locked state matches validation (locked = true)`);
    }

    // 5B. Comprehensive Live Visual Transition Tests
    // Case 09 Live Progression:
    await evaluate('loadLevel(8, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 09 visual exit is RED at start');
    await evaluate('ghosts.push([{x: 3, y: 2, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 09 visual exit remains RED when only Door A is open');
    await evaluate('ghosts.push([{x: 8, y: 3, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 09 visual exit turns GREEN immediately when both Doors A and B are open');

    // Case 10 Live Progression:
    await evaluate('loadLevel(9, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 10 visual exit is RED at start');
    await evaluate('ghosts.push([{x: 2, y: 3, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 10 visual exit remains RED when only Door A is open');
    await evaluate('ghosts.push([{x: 8, y: 1, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 10 visual exit turns GREEN immediately when both Doors A and B are open');

    // Case 11 Live Progression:
    await evaluate('loadLevel(10, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 11 visual exit is RED at start');
    await evaluate('ghosts.push([{x: 3, y: 2, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 11 visual exit remains RED when only Door A is open');
    await evaluate('ghosts.push([{x: 9, y: 1, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 11 visual exit turns GREEN immediately when both Doors A and B are open');

    // Case 12 Live Progression:
    await evaluate('loadLevel(11, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 12 visual exit is RED at start');
    await evaluate('ghosts.push([{x: 3, y: 2, f: [1,0], s: 0}], [{x: 8, y: 1, f: [1,0], s: 0}], [{x: 2, y: 5, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 12 visual exit remains RED when doors are held but enemies are alive');
    await evaluate('enemies[0].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 12 visual exit remains RED when only enemy 01 is dead');
    await evaluate('enemies[1].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 12 visual exit turns GREEN immediately when both enemies are dead and all doors open');

    // 6. Legitimate Exit Advances Level
    await evaluate('loadLevel(0, true)');
    await new Promise(r => setTimeout(r, 40));
    // Simulate legitimate Case 01 completion by placing a shadow on plate a
    await evaluate(`(() => {
      ghosts.push([{ x: 2, y: 3, f: [1, 0], s: 0 }]); // ghost on plate a
      pos = { x: 8, y: 2 }; // player on exit
      tick();
    })()`);
    const lvAfterLegitWin = await evaluate('lv');
    assert(lvAfterLegitWin === 1, 'Legitimate exit completion advances Case 01 to Case 02');

    // Simulate legitimate Case 08 completion advancing to Case 09
    await evaluate('loadLevel(7, true)');
    await new Promise(r => setTimeout(r, 40));
    await evaluate(`(() => {
      enemies.forEach(e => e.dead = true);
      ghosts.push([{ x: 10, y: 1, f: [1, 0], s: 0 }]); // ghost on plate b
      pos = { x: 10, y: 5 }; // player on exit
      tick();
    })()`);
    const lvAfterC8Legit = await evaluate('lv');
    assert(lvAfterC8Legit === 8, 'Legitimate Case 08 completion advances to Case 09');

    // Simulate legitimate Case 12 completion triggering game victory
    await evaluate('loadLevel(11, true)');
    await new Promise(r => setTimeout(r, 40));
    await evaluate(`(() => {
      enemies.forEach(e => e.dead = true);
      ghosts.push([{ x: 3, y: 2, f: [1, 0], s: 0 }]); // plate a
      ghosts.push([{ x: 8, y: 1, f: [1, 0], s: 0 }]); // plate b
      ghosts.push([{ x: 2, y: 5, f: [1, 0], s: 0 }]); // plate c
      pos = { x: 10, y: 5 }; // player on exit
      tick();
    })()`);
    const wonAfterC12Legit = await evaluate('won');
    assert(wonAfterC12Legit === true, 'Case 12 legitimately completed when all enemies killed and all doors open, triggering game victory');

    console.log('\n=== TEST 13: Scoring Formula, Three-Star Ratings & Calibration ===');
    // 1. Scoring Bounds & Breakdown
    const perfectBreakdown = await evaluate('calculateScoreBreakdown(0, { loops: 2, totalTicks: 22, deaths: 0, completed: true })');
    assert(perfectBreakdown.total === 1000, 'Perfect Case 01 run awards exactly 1,000 points', `total=${perfectBreakdown.total}`);
    assert(perfectBreakdown.base === 400, 'Base clearance awards 400 points');
    assert(perfectBreakdown.loopEfficiency === 350, 'Optimal loop efficiency awards 350 points');
    assert(perfectBreakdown.timeEfficiency === 250, 'Optimal time efficiency awards 250 points');
    assert(perfectBreakdown.deathPenalty === 0, 'Zero deaths incur zero penalty');
    assert(perfectBreakdown.band === 'Excellent', '1,000 score classified in Excellent band');

    // Inefficient run is clamped to at least 400 upon completion
    const inefficientBreakdown = await evaluate('calculateScoreBreakdown(0, { loops: 8, totalTicks: 100, deaths: 10, completed: true })');
    assert(inefficientBreakdown.total === 400, 'Completed run score is clamped to minimum 400 points');
    assert(inefficientBreakdown.total <= 1000, 'Score does not exceed 1000 points');

    // Uncompleted case returns 0
    const uncompletedScore = await evaluate('calculateScore(0, { completed: false })');
    assert(uncompletedScore === 0, 'Uncompleted case awards 0 score');

    // Repeatable scoring: identical runs produce identical score
    const runA = await evaluate('calculateScore(3, { loops: 2, totalTicks: 28, deaths: 0, completed: true })');
    const runB = await evaluate('calculateScore(3, { loops: 2, totalTicks: 28, deaths: 0, completed: true })');
    assert(runA === runB && runA > 900, 'Identical performance deterministically produces identical scores');

    // Best Score preservation
    await evaluate('resetProgress()');
    await evaluate('recordCaseVictory(0, { loops: 2, totalTicks: 22, deaths: 0 })');
    let pAfterGood = await evaluate('progress');
    assert(pAfterGood.scores[0] === 1000, 'First run records best score 1,000');

    // Worse replay does NOT downgrade best score
    await evaluate('recordCaseVictory(0, { loops: 4, totalTicks: 50, deaths: 2 })');
    let pAfterWorse = await evaluate('progress');
    assert(pAfterWorse.scores[0] === 1000, 'Worse replay preserves previous best score of 1,000');

    // Better replay replaces previous best score
    await evaluate('resetProgress()');
    await evaluate('recordCaseVictory(1, { loops: 4, totalTicks: 60, deaths: 1 })');
    const firstScoreC2 = (await evaluate('progress')).scores[1];
    await evaluate('recordCaseVictory(1, { loops: 3, totalTicks: 32, deaths: 0 })');
    const betterScoreC2 = (await evaluate('progress')).scores[1];
    assert(betterScoreC2 > firstScoreC2, 'Better replay replaces previous best score');

    // 2. Star Rating Criteria
    // Case 01 targets: parLoops=2, max3StarTicks=32
    assert(await evaluate('calculateStarRating(0, { loops: 2, totalTicks: 25, deaths: 0, completed: true })') === 3, 'Optimal run awards 3 stars');
    assert(await evaluate('calculateStarRating(0, { loops: 2, totalTicks: 25, deaths: 1, completed: true })') === 2, 'One death downgrades rating from 3 to 2 stars');
    assert(await evaluate('calculateStarRating(0, { loops: 3, totalTicks: 30, deaths: 0, completed: true })') === 2, 'One extra loop awards 2 stars');
    assert(await evaluate('calculateStarRating(0, { loops: 5, totalTicks: 70, deaths: 3, completed: true })') === 1, 'High loops and deaths still awards 1 star on completion');
    assert(await evaluate('calculateStarRating(0, { completed: false })') === 0, 'Uncompleted case awards 0 stars');

    // Stars upgrade and preservation
    await evaluate('resetProgress()');
    await evaluate('recordCaseVictory(2, { loops: 3, totalTicks: 50, deaths: 1 })'); // 2 stars
    assert((await evaluate('progress')).stars[2] === 2, 'First run records 2 stars');
    await evaluate('recordCaseVictory(2, { loops: 2, totalTicks: 28, deaths: 0 })'); // 3 stars
    assert((await evaluate('progress')).stars[2] === 3, 'Improved replay upgrades to 3 stars');
    await evaluate('recordCaseVictory(2, { loops: 4, totalTicks: 60, deaths: 2 })'); // 1 star
    assert((await evaluate('progress')).stars[2] === 3, 'Worse replay preserves 3 stars');

    // Par values configured across all 12 cases
    const targetsLen = await evaluate('CASE_TARGETS.length');
    assert(targetsLen === 12, 'Case performance targets configured for all 12 cases');

    // Case 05 and Case 07 calibration consistency checks
    const c5Target = await evaluate('CASE_TARGETS[4]');
    const c5LimitTicks = await evaluate('Math.round((LV[4].timeLimit * 1000) / TICK)');
    assert(c5Target.parTicks === 35 && c5Target.max3StarTicks === 45, 'Case 05 calibrated to parTicks=35, max3StarTicks=45');
    assert(c5Target.max3StarTicks < c5LimitTicks, `Case 05 3-star max ticks (${c5Target.max3StarTicks}) is strictly within time limit (${c5LimitTicks} ticks)`);

    const c7Target = await evaluate('CASE_TARGETS[6]');
    const c7LimitTicks = await evaluate('Math.round((LV[6].timeLimit * 1000) / TICK)');
    assert(c7Target.parTicks === 45 && c7Target.max3StarTicks === 55, 'Case 07 calibrated to parTicks=45, max3StarTicks=55');
    assert(c7Target.max3StarTicks < c7LimitTicks, `Case 07 3-star max ticks (${c7Target.max3StarTicks}) is strictly within time limit (${c7LimitTicks} ticks)`);

    // Universal invariant: for all 12 cases, max3StarTicks must be strictly less than the time limit
    const allWithinLimits = await evaluate(`
      CASE_TARGETS.every((ct, idx) => {
        const limTicks = Math.round((LV[idx].timeLimit * 1000) / TICK);
        return ct.max3StarTicks < limTicks && ct.parTicks <= ct.max3StarTicks;
      })
    `);
    assert(allWithinLimits === true, 'All 12 cases have 3-star targets strictly within their respective case time limits');

    // Audit 1 & 2: Death tracking integrity across loops, deaths, timer expirations & resets
    await evaluate('loadLevel(0, true)');
    assert(await evaluate('getCaseDeaths()') === 0, 'New case session starts with 0 deaths');
    await evaluate('die()');
    assert(await evaluate('getCaseDeaths()') === 1, 'die() increments caseDeaths to 1');
    // Commit loop with R
    await evaluate('pos = { x: 2, y: 1 }; commit(false);');
    assert(await evaluate('getCaseDeaths()') === 1, 'caseDeaths preserved across shadow commit');
    assert(await evaluate('loops') === 2, 'Loop count incremented to 2');
    // Auto-commit on timer expiration
    await evaluate('commit(true)');
    assert(await evaluate('getCaseDeaths()') === 1, 'caseDeaths preserved across timer expiration auto-commit');
    assert(await evaluate('loops') === 3, 'Loop count incremented to 3');
    // Pressing Z resets case completely (erasing shadows and restarting from loop 1)
    await evaluate('loadLevel(0, true)');
    assert(await evaluate('getCaseDeaths()') === 0, 'Full level reset (Z) resets session deaths to 0');
    assert(await evaluate('loops') === 1, 'Full level reset (Z) resets loops to 1');
    assert((await evaluate('ghosts.length')) === 0, 'Full level reset (Z) completely clears recorded shadows (no unfair advantage)');

    // Multi-loop total elapsed ticks tracking across loops, deaths, timer auto-commits & resets
    await evaluate('loadLevel(0, true)');
    assert(await evaluate('getCaseTotalTicks()') === 0, 'New case session starts with 0 total elapsed ticks');
    await evaluate(`
      tick(); tick(); tick(); tick(); tick();
      pos = { x: 2, y: 1 };
      commit(false);
    `);
    assert(await evaluate('getCaseTotalTicks()') === 5, 'Total elapsed ticks correctly records 5 ticks from Loop 1 commit');
    assert(await evaluate('loops') === 2, 'In Loop 2 after commit');

    await evaluate(`
      tick(); tick(); tick();
      die();
    `);
    assert(await evaluate('getCaseTotalTicks()') === 8, 'Total elapsed ticks accumulates ticks before death (5 + 3 = 8)');
    assert(await evaluate('getCaseDeaths()') === 1, 'caseDeaths incremented to 1');

    await evaluate(`
      tick(); tick(); tick(); tick();
      commit(true);
    `);
    assert(await evaluate('getCaseTotalTicks()') === 12, 'Total elapsed ticks accumulates ticks on timer auto-commit (8 + 4 = 12)');

    await evaluate(`
      tick(); tick(); tick();
      win();
    `);
    const lastVictoryStats = await evaluate('progress.caseStats[0]');
    assert(lastVictoryStats && lastVictoryStats.totalTicks === 15, 'win() computes and records actual total elapsed ticks across all loops and deaths (12 + 3 = 15)');

    await evaluate('loadLevel(0, true)');
    assert(await evaluate('getCaseTotalTicks()') === 0, 'Full level reset (Z) resets total elapsed ticks to 0');

    // Coherent Personal Best Records: stars, score, and caseStats strictly originate from the same single attempt
    await evaluate('resetProgress()');
    // Attempt 1: 3-Star clean solve (2 loops, 25 ticks, 0 deaths) -> awards 3 stars, 1000 score
    await evaluate('recordCaseVictory(0, { loops: 2, totalTicks: 25, deaths: 0 })');
    let pRecord1 = await evaluate('progress');
    assert(pRecord1.stars[0] === 3, 'Attempt 1 establishes 3 stars');
    assert(pRecord1.scores[0] === 1000, 'Attempt 1 establishes 1000 score');
    assert(pRecord1.caseStats[0].deaths === 0, 'Attempt 1 records 0 deaths');
    assert(pRecord1.caseStats[0].totalTicks === 25, 'Attempt 1 records 25 total ticks');

    // Attempt 2: Replay with 1 death (2 stars)
    // A 2-star replay must NOT overwrite or contaminate the 3-star personal best
    await evaluate('recordCaseVictory(0, { loops: 3, totalTicks: 30, deaths: 1 })');
    let pRecordAfterWorseReplay = await evaluate('progress');
    assert(pRecordAfterWorseReplay.stars[0] === 3, 'Worse star replay preserves 3-star record');
    assert(pRecordAfterWorseReplay.scores[0] === 1000, 'Worse star replay preserves 1000 score');
    assert(pRecordAfterWorseReplay.caseStats[0].deaths === 0, 'Worse star replay does not overwrite caseStats with 1 death');
    assert(pRecordAfterWorseReplay.caseStats[0].totalTicks === 25, 'Worse star replay caseStats remains strictly coherent with 3-star run');

    // Attempt 3: Faster 3-Star replay (2 loops, 20 ticks, 0 deaths) -> upgrades personal best cleanly
    await evaluate('recordCaseVictory(0, { loops: 2, totalTicks: 20, deaths: 0 })');
    let pRecordAfterBetterReplay = await evaluate('progress');
    assert(pRecordAfterBetterReplay.stars[0] === 3, 'Better 3-star replay keeps 3 stars');
    assert(pRecordAfterBetterReplay.scores[0] === 1000, 'Better 3-star replay maintains 1000 score');
    assert(pRecordAfterBetterReplay.caseStats[0].totalTicks === 20, 'Better 3-star replay updates totalTicks to 20');
    assert(pRecordAfterBetterReplay.caseStats[0].deaths === 0, 'Better 3-star replay maintains 0 deaths');

    console.log('\n=== TEST 14: Achievement System Verification & Unlocks ===');
    const allAchs = await evaluate('ACHIEVEMENTS');
    assert(allAchs.length === 10, 'Exactly 10 achievements registered in system');
    assert(allAchs.every(a => a.id && a.name && a.desc && a.icon), 'All achievements have valid id, name, description, and icon');

    // Fresh player has 0 achievements
    await evaluate('resetProgress()');
    assert((await evaluate('progress.achievements.length')) === 0, 'Fresh player has 0 achievements');

    // 1. "First Echo" unlocks on Case 01 completion
    await evaluate('recordCaseVictory(0, { loops: 2, totalTicks: 22, deaths: 0 })');
    let achsC1 = await evaluate('progress.achievements');
    assert(achsC1.includes('first_echo'), 'First Echo unlocks upon completing Case 01');

    // 2. "Perfect Timing" unlocks on 3 stars
    assert(achsC1.includes('perfect_timing'), 'Perfect Timing unlocks upon achieving 3 stars');

    // 3. "Shadow Master" unlocks with loops <= parLoops
    assert(achsC1.includes('shadow_master'), 'Shadow Master unlocks using verified minimum loops');

    // 4. "Untouchable" unlocks on flawless completion (0 deaths)
    assert(achsC1.includes('untouchable'), 'Untouchable unlocks on 0 deaths run');

    // Untouchable does NOT unlock when death occurs
    await evaluate('resetProgress()');
    await evaluate('recordCaseVictory(0, { loops: 2, totalTicks: 22, deaths: 1 })');
    let achsWithDeath = await evaluate('progress.achievements');
    assert(!achsWithDeath.includes('untouchable'), 'Untouchable does NOT unlock when player dies');

    // Case-specific achievements
    await evaluate('recordCaseVictory(8, { loops: 3, totalTicks: 25, deaths: 0 })');
    assert((await evaluate('progress.achievements')).includes('laser_runner'), 'Laser Runner unlocks on Case 09 completion');

    await evaluate('recordCaseVictory(9, { loops: 3, totalTicks: 25, deaths: 0 })');
    assert((await evaluate('progress.achievements')).includes('rift_walker'), 'Rift Walker unlocks on Case 10 completion');

    await evaluate('recordCaseVictory(10, { loops: 3, totalTicks: 25, deaths: 0 })');
    assert((await evaluate('progress.achievements')).includes('shift_controller'), 'Shift Controller unlocks on Case 11 completion');

    await evaluate('recordCaseVictory(11, { loops: 4, totalTicks: 25, deaths: 0 })');
    assert((await evaluate('progress.achievements')).includes('paradox_solved'), 'Paradox Solved unlocks on Case 12 completion');

    // Replay does not duplicate achievements
    const achsBeforeDup = (await evaluate('progress.achievements')).length;
    await evaluate('recordCaseVictory(8, { loops: 3, totalTicks: 25, deaths: 0 })');
    const achsAfterDup = (await evaluate('progress.achievements')).length;
    assert(achsBeforeDup === achsAfterDup, 'Replaying case does not duplicate achievements');

    // 5. "Perfectionist" unlocks when all 12 cases have 3 stars
    await evaluate('resetProgress()');
    for (let c = 0; c < 11; c++) {
      await evaluate(`recordCaseVictory(${c}, { loops: 2, totalTicks: 20, deaths: 0 })`);
    }
    assert(!(await evaluate('progress.achievements')).includes('perfectionist'), 'Perfectionist does not unlock with only 11 cases at 3 stars');
    await evaluate('recordCaseVictory(11, { loops: 4, totalTicks: 25, deaths: 0 })');
    assert((await evaluate('progress.achievements')).includes('perfectionist'), 'Perfectionist unlocks when all 12 cases reach 3 stars');

    // 6. "Master of Vestigraid" unlocks when all 12 cases and all achievements are earned
    assert((await evaluate('progress.achievements')).includes('master_of_vestigraid'), 'Master of Vestigraid unlocks when all cases and achievements are completed');

    console.log('\n=== TEST 15: Upgraded Completion Screen, Toast & Sector Archive UI ===');
    // Toast notification function works without errors
    await evaluate('showAchievementToast(ACHIEVEMENTS[0])');
    const toastCount = await evaluate('document.querySelectorAll(".achievement-toast").length');
    assert(toastCount > 0, 'Achievement toast rendered in DOM');

    // Completion overlay on normal case (Case 01)
    await evaluate('progress.story = { viewed: Object.keys(STORY_SEQUENCES), unlockedChapters: [1,2,3,4] }; saveProgress(progress); if (isCinematicActive()) skipCinematic();');
    await evaluate('loadLevel(0, true)');
    await new Promise(r => setTimeout(r, 40));
    await evaluate(`(() => {
      ghosts.push([{ x: 2, y: 3, f: [1, 0], s: 0 }]);
      pos = { x: 8, y: 2 };
      tick();
    })()`);
    const ovDisplayAfterWin = await evaluate('document.getElementById("ov").style.display');
    const ovHtmlAfterWin = await evaluate('document.getElementById("ov").innerHTML');
    assert(ovDisplayAfterWin === 'flex', 'Case completion overlay displayed after case victory');
    assert(ovHtmlAfterWin.includes('CASE 01 COMPLETED'), 'Completion overlay displays case number');
    assert(ovHtmlAfterWin.includes('ov-stars'), 'Completion overlay renders animated star rating');
    assert(ovHtmlAfterWin.includes('1,000'), 'Completion overlay renders score out of 1,000');
    assert(ovHtmlAfterWin.includes('score-breakdown-grid'), 'Completion overlay displays score breakdown');
    assert(ovHtmlAfterWin.includes('btn-next-case'), 'Completion overlay includes Next Case button');

    // Pressing a move key dismisses the completion overlay smoothly
    await tap('ArrowDown', 'ArrowDown');
    const ovDismissed = await evaluate('document.getElementById("ov").style.display === "none"');
    assert(ovDismissed, 'Tapping movement key automatically dismisses completion overlay for smooth gameplay');

    // Open Case Selection Archive Modal
    await evaluate('openCaseModal()');
    const statsBarHtml = await evaluate('document.getElementById("progress-stats-bar").innerHTML');
    assert(statsBarHtml.includes('Stars:'), 'Case Archive modal renders overall Stars stat pill');
    assert(statsBarHtml.includes('Score:'), 'Case Archive modal renders overall Score stat pill');
    assert(statsBarHtml.includes('Accreditations:'), 'Case Archive modal renders overall Accreditations stat pill');

    // Achievements drawer inside modal
    const achCardsCount = await evaluate('document.querySelectorAll(".ach-card").length');
    assert(achCardsCount === 10, 'Case Archive renders all 10 achievements in achievements drawer');
    await evaluate('closeCaseModal()');

    console.log('\n=== TEST 16: LocalStorage Schema Migration & Preservation ===');
    // Migration: Legacy save without scores/stars/achievements
    const legacySave = JSON.stringify({
      highestUnlocked: 4,
      completedCases: [0, 1, 2, 3],
      gameCompleted: false,
      lastPlayed: 3
    });
    await evaluate(`localStorage.setItem(STORAGE_KEY || 'vestigraid_progress_v1', '${legacySave}')`);
    await evaluate('progress = loadProgress()');
    const migratedProg = await evaluate('progress');
    assert(migratedProg.highestUnlocked === 4, 'Migrated progress preserves highestUnlocked = 4');
    assert(migratedProg.completedCases.length === 4, 'Migrated progress preserves completedCases');
    assert(migratedProg.stars[0] >= 1, 'Legacy completed case 0 safely assigned default star rating');
    assert(migratedProg.scores[0] >= 400, 'Legacy completed case 0 safely assigned default base score');
    assert(Array.isArray(migratedProg.achievements), 'Legacy progress safely initializes achievements array');
    assert(migratedProg.story && Array.isArray(migratedProg.story.viewed), 'Legacy progress safely initializes story viewed array');
    assert(migratedProg.story && Array.isArray(migratedProg.story.unlockedChapters) && migratedProg.story.unlockedChapters.includes(1), 'Legacy progress safely unlocks Chapter 1');

    // Dynamic total calculations
    assert(await evaluate('getTotalStars(progress)') >= 4, 'getTotalStars calculates sum of earned stars');
    assert(await evaluate('getTotalScore(progress)') >= 1600, 'getTotalScore calculates sum of case scores');

    // Clean reset restores fresh progress
    await evaluate('progress = resetProgress()');
    assert((await evaluate('getTotalStars(progress)')) === 0, 'Reset progress clears all stars to 0');
    assert((await evaluate('getTotalScore(progress)')) === 0, 'Reset progress clears total score to 0');
    assert((await evaluate('getUnlockedAchievements(progress).length')) === 0, 'Reset progress clears all achievements');

    console.log('\n=== TEST 17: Cinematic Story Engine & Chapter 1 Verification ===');
    // 1. Fresh state has empty story viewed and Chapter 1 unlocked
    await evaluate('progress = resetProgress()');
    assert(await evaluate('getUnlockedChapters().includes(1)'), 'Chapter 1 is unlocked by default');
    assert(await evaluate('!hasViewedStory("ch1_intro")'), 'Fresh progress has not viewed ch1_intro');
    assert(await evaluate('!hasViewedStory("case01_intro")'), 'Fresh progress has not viewed case01_intro');

    // 2. Loading Case 01 for a fresh player triggers ch1_intro cinematic
    await evaluate('loadLevel(0)');
    assert(await evaluate('isCinematicActive()'), 'Loading Case 01 triggers cinematic overlay for unviewed story');
    assert((await evaluate('t')) === 0, 'Cinematic consumes zero gameplay ticks (tick = 0)');
    assert((await evaluate('started')) === false, 'Game started remains false while cinematic is active');

    // 3. Gameplay input suppression while cinematic is active
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown' });
    await new Promise(r => setTimeout(r, 40));
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown' });
    await new Promise(r => setTimeout(r, 50));
    assert((await evaluate('started')) === false, 'Arrow key during cinematic does not start gameplay');
    assert((await evaluate('t')) === 0, 'Ticks remain 0 despite attempted movement during cinematic');

    // 4. Typewriter completion and line advance via Space/Enter
    const textBeforeSpace = await evaluate('document.getElementById("cinematic-text")?.textContent || ""');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space' });
    await new Promise(r => setTimeout(r, 20));
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
    await new Promise(r => setTimeout(r, 50));
    const textAfterSpace = await evaluate('document.getElementById("cinematic-text")?.textContent || ""');
    assert(textAfterSpace.length >= textBeforeSpace.length, 'Space key completes or advances typewriter text');

    // 5. Skipping sequence via Escape or skip button
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await new Promise(r => setTimeout(r, 20));
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
    await new Promise(r => setTimeout(r, 100));
    assert(await evaluate('hasViewedStory("ch1_intro")'), 'Skipping ch1_intro marks it as viewed');

    // 6. Direct invocation of case01_intro, case02_intro, case03_intro
    await evaluate('playCinematic("case01_intro")');
    assert(await evaluate('isCinematicActive()'), 'playCinematic("case01_intro") opens cinematic');
    await evaluate('skipCinematic()');
    assert(await evaluate('hasViewedStory("case01_intro")'), 'case01_intro marked as viewed after skip');
    assert(!(await evaluate('isCinematicActive()')), 'Overlay closed after skip');

    await evaluate('playCinematic("case02_intro")');
    assert(await evaluate('isCinematicActive()'), 'case02_intro opens cinematic');
    await evaluate('skipCinematic()');
    assert(await evaluate('hasViewedStory("case02_intro")'), 'case02_intro marked as viewed');

    await evaluate('playCinematic("case03_intro")');
    assert(await evaluate('isCinematicActive()'), 'case03_intro opens cinematic');
    await evaluate('skipCinematic()');
    assert(await evaluate('hasViewedStory("case03_intro")'), 'case03_intro marked as viewed');

    // 7. Solving Case 03 unlocks Chapter 2 and triggers ch1_outro
    await evaluate('loadLevel(2, true, false)');
    await evaluate('unlockChapter(2)');
    assert(await evaluate('getUnlockedChapters().includes(2)'), 'Chapter 2 unlocked in story progress');

    await evaluate('playCinematic("ch1_outro")');
    assert(await evaluate('isCinematicActive()'), 'ch1_outro plays properly');
    await evaluate('skipCinematic()');
    assert(await evaluate('hasViewedStory("ch1_outro")'), 'ch1_outro marked as viewed');

    // 8. Sector Archive modal story transmissions section
    await evaluate('openCaseModal()');
    const storySectionEl = await evaluate('Boolean(document.getElementById("story-archive-section"))');
    assert(storySectionEl, 'Sector Archive contains story-archive-section');
    const storyCardsCount = await evaluate('document.querySelectorAll(".story-entry-card").length');
    assert(storyCardsCount >= 5, 'Sector Archive renders all Chapter 1 transmission cards');
    const replayBtnText = await evaluate('document.querySelector(".btn-story-replay")?.textContent || ""');
    assert(replayBtnText.includes('REPLAY') || replayBtnText.includes('PLAY'), 'Transmission cards have interactive replay buttons');

    // 9. Replaying transmission from modal
    await evaluate('document.querySelector(".btn-story-replay")?.click()');
    await new Promise(r => setTimeout(r, 50));
    assert(await evaluate('isCinematicActive()'), 'Clicking transmission Replay button opens cinematic overlay');
    await evaluate('skipCinematic()');
    assert(!(await evaluate('isCinematicActive()')), 'Cinematic overlay cleanly closed');
    await evaluate('closeCaseModal()');

    console.log('\n=== TEST 18: Full Narrative Integration (Chapters 2–4 & Grand Epilogue) ===');
    // 1. Verify all 21 story sequences exist in registry
    const seqCount = await evaluate('Object.keys(STORY_SEQUENCES).length');
    assert(seqCount === 21, `All 21 story sequences registered (found ${seqCount})`);

    // 2. Chapter 2 transitions
    await evaluate('playCinematic("ch2_intro")');
    assert(await evaluate('isCinematicActive()'), 'ch2_intro plays properly');
    await evaluate('skipCinematic()');
    assert(await evaluate('hasViewedStory("ch2_intro")'), 'ch2_intro marked as viewed');

    for (const id of ['case04_intro', 'case05_intro', 'case06_intro', 'ch2_outro']) {
      await evaluate(`playCinematic("${id}")`);
      assert(await evaluate('isCinematicActive()'), `${id} plays properly`);
      await evaluate('skipCinematic()');
      assert(await evaluate(`hasViewedStory("${id}")`), `${id} marked as viewed`);
    }

    // 3. Chapter 3 transitions
    for (const id of ['ch3_intro', 'case07_intro', 'case08_intro', 'case09_intro', 'ch3_outro']) {
      await evaluate(`playCinematic("${id}")`);
      assert(await evaluate('isCinematicActive()'), `${id} plays properly`);
      await evaluate('skipCinematic()');
      assert(await evaluate(`hasViewedStory("${id}")`), `${id} marked as viewed`);
    }

    // 4. Chapter 4 transitions
    for (const id of ['ch4_intro', 'case10_intro', 'case11_intro', 'case12_intro']) {
      await evaluate(`playCinematic("${id}")`);
      assert(await evaluate('isCinematicActive()'), `${id} plays properly`);
      await evaluate('skipCinematic()');
      assert(await evaluate(`hasViewedStory("${id}")`), `${id} marked as viewed`);
    }

    // 5. Case 12 victory sequencing: triggers ch4_outro, then epilogue, then Grand Final overlay
    await evaluate('loadLevel(11, true, false)');
    await evaluate('progress.story.viewed = progress.story.viewed.filter(id => id !== "ch4_outro" && id !== "epilogue"); saveProgress(progress);');
    // Trigger win on Case 12
    await evaluate(`(() => {
      win();
    })()`);
    assert(await evaluate('isCinematicActive()'), 'Case 12 win triggers Chapter 4 Outro cinematic');
    const c4OutroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c4OutroTitle === 'The Warden Falls', `First scene is "The Warden Falls" (got "${c4OutroTitle}")`);

    // Complete ch4_outro -> epilogue should chain
    await evaluate('skipCinematic()');
    assert(await evaluate('isCinematicActive()'), 'Grand Epilogue chains immediately after ch4_outro');
    const epiTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(epiTitle === 'The Echo Protocol', `Second scene is Grand Epilogue "The Echo Protocol" (got "${epiTitle}")`);

    // Complete epilogue -> Grand Final overlay should appear
    await evaluate('skipCinematic()');
    assert(!(await evaluate('isCinematicActive()')), 'Overlay closed after epilogue concludes');
    const grandOverlayVisible = await evaluate('document.getElementById("ov")?.style.display !== "none"');
    assert(grandOverlayVisible, 'Grand Final completion overlay displayed after epilogue');
    const grandHeading = await evaluate('document.querySelector("#ov h2")?.textContent || ""');
    assert(grandHeading.includes('ALL CASES CLOSED'), 'Grand Final overlay displays ALL CASES CLOSED');

    // 6. Full Archive rendering: all 4 chapters unlocked
    await evaluate('document.getElementById("ov").style.display = "none"');
    await evaluate('progress.story.unlockedChapters = [1, 2, 3, 4]; saveProgress(progress);');
    await evaluate('openCaseModal()');
    const allTransmissionCards = await evaluate('document.querySelectorAll(".story-entry-card").length');
    assert(allTransmissionCards === 21, `Sector Archive displays all 21 transmission replay cards across all 4 chapters (found ${allTransmissionCards})`);
    await evaluate('closeCaseModal()');

    proc.kill();

    console.log('\n========================================');
    const allPassed = testResults.every(t => t.pass);
    const passedCount = testResults.filter(t => t.pass).length;
    console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${passedCount} | FAILED: ${testResults.length - passedCount}`);
    console.log('========================================');

    if (!allPassed) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    proc.kill();
    process.exit(1);
  }
}

runTests();
