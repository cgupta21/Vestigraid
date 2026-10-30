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
    await evaluate('progress.highestUnlocked = 7; progress.completedCases = [0,1,2,3,4,5,6,7];');

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
      { lv: 7, w: 768, h: 448, name: 'Case 08' }
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
    let wonGame8 = await evaluate('won');
    let ovDisplay8 = await evaluate('document.getElementById("ov").style.display');
    let ovHtml8 = await evaluate('document.getElementById("ov").innerHTML');

    assert(wonGame8 === true, 'Case 08 won condition reached (won = true)');
    assert(ovDisplay8 === 'flex', 'Victory overlay displayed (display = flex)');
    assert(ovHtml8.includes('ALL CASES CLOSED'), 'Victory overlay displays "ALL CASES CLOSED"');

    // Test restarting final case button
    await evaluate('document.getElementById("re-last").click()');
    await new Promise(r => setTimeout(r, 100));
    let lvAfterRestart = await evaluate('lv');
    let wonAfterRestart = await evaluate('won');
    assert(lvAfterRestart === 7 && wonAfterRestart === false, 'Restart final case button resets to Case 08');

    console.log('\n=== TEST 9: Timer Balance, Pausing, State Transitions & Auto-Commit ===');
    // 1. Verify per-case timer values and tick computations across all 8 cases
    const expectedTimers = [
      { lv: 0, s: 6, ticks: 43, name: 'Case 01' },
      { lv: 1, s: 7, ticks: 50, name: 'Case 02' },
      { lv: 2, s: 8, ticks: 57, name: 'Case 03' },
      { lv: 3, s: 10, ticks: 71, name: 'Case 04' },
      { lv: 4, s: 8, ticks: 57, name: 'Case 05' },
      { lv: 5, s: 9, ticks: 64, name: 'Case 06' },
      { lv: 6, s: 10, ticks: 71, name: 'Case 07' },
      { lv: 7, s: 13, ticks: 93, name: 'Case 08' }
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

    // 9. Case Selection UI Modal Rendering & Interaction
    await evaluate('openCaseModal()');
    const modalVisible = await evaluate('document.getElementById("case-modal").style.display !== "none"');
    assert(modalVisible, 'Case selection modal is visible when opened');

    const modalSummary = await evaluate('document.getElementById("progress-summary").textContent');
    assert(modalSummary.includes('6 of 8 Cases Unlocked'), `Modal displays accurate unlocked summary: "${modalSummary}"`);

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
    assert(cardStates.length === 8, 'Modal renders all 8 case cards');
    assert(cardStates[0].unlocked && !cardStates[0].disabled && cardStates[0].badgeText.includes('COMPLETED'), 'Case 01 card is unlocked, enabled, and marked COMPLETED');
    assert(cardStates[5].unlocked && !cardStates[5].disabled && cardStates[5].badgeText.includes('UNLOCKED'), 'Case 06 card is unlocked and marked UNLOCKED');
    assert(cardStates[6].locked && cardStates[6].disabled && cardStates[6].badgeText.includes('LOCKED'), 'Case 07 card is locked, disabled, and has LOCKED badge');
    assert(cardStates[7].locked && cardStates[7].disabled && cardStates[7].badgeText.includes('LOCKED'), 'Case 08 card is locked, disabled, and has LOCKED badge');

    // Test Continue button loads highest unlocked case
    await evaluate('document.getElementById("btn-continue-case").click()');
    assert((await evaluate('lv')) === 5, 'Continue button in modal loads highest unlocked case (Case 06)');
    assert(!(await evaluate('document.getElementById("case-modal").style.display !== "none"')), 'Modal closes after clicking Continue');

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

    // 11. Final Case 08 Completion & Victory Recording
    for (let c = 0; c < 8; c++) {
      await evaluate(`markCaseCompleted(${c})`);
    }
    const finalProg = await evaluate('progress');
    assert(finalProg.gameCompleted === true, 'Completing Case 08 records gameCompleted = true');
    assert(finalProg.highestUnlocked === 7, 'highestUnlocked reaches 7 on full game completion');
    assert(finalProg.completedCases.length === 8, 'All 8 cases recorded in completedCases');


    console.log('\n=== TEST 12: Exit Validation, Gate Synchronization & Anti-Bypass Across All 8 Cases ===');

    // 1. All 8 Cases: Verify Exit is initially LOCKED at start
    for (let c = 0; c < 8; c++) {
      await evaluate(`loadLevel(${c}, true)`);
      await new Promise(r => setTimeout(r, 40));
      const initExit = await evaluate(`canExitLevel(${c})`);
      assert(initExit.canExit === false, `Case 0${c+1} exit is LOCKED at start`, `reason="${initExit.message}"`);
      assert(typeof initExit.message === 'string' && initExit.message.length > 0, `Case 0${c+1} provides descriptive locked message`);
    }

    // 2. Anti-Bypass Verification Across All 8 Cases (Moving onto exit without puzzle solve rejects victory)
    const exitCoords = [
      { lv: 0, x: 8, y: 2, name: 'Case 01', expectedMsg: 'Door A is locked' },
      { lv: 1, x: 10, y: 3, name: 'Case 02', expectedMsg: 'Door A is locked' },
      { lv: 2, x: 10, y: 2, name: 'Case 03', expectedMsg: 'Door A is locked' },
      { lv: 3, x: 10, y: 5, name: 'Case 04', expectedMsg: 'Kill all enemies' },
      { lv: 4, x: 10, y: 1, name: 'Case 05', expectedMsg: 'Door A is locked' },
      { lv: 5, x: 10, y: 1, name: 'Case 06', expectedMsg: 'Door A is locked' },
      { lv: 6, x: 10, y: 3, name: 'Case 07', expectedMsg: 'Door C is locked' },
      { lv: 7, x: 10, y: 5, name: 'Case 08', expectedMsg: 'Kill all enemies' }
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

    // 4. Complete Requirement Satisfaction: Exit Unlocks (canExit === true) Across All 8 Cases
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

    // 5. Visual State & Gameplay Exit Synchronization Across All 8 Cases
    for (let c = 0; c < 8; c++) {
      await evaluate(`loadLevel(${c}, true)`);
      await new Promise(r => setTimeout(r, 40));
      // At start, canExitLevel is false, so renderer renders locked state (red)
      const renderLockedState = await evaluate('renderCurrentFrame(); isExitVisualLocked()');
      assert(renderLockedState === true, `Case 0${c+1} renderer visual locked state matches validation (locked = true)`);
    }

    // 5B. Comprehensive Live Visual Transition Tests for Every Case
    // Case 04 Live Progression:
    await evaluate('loadLevel(3, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 04 visual exit is RED when both enemies are alive');
    // Defeat only enemy 01
    await evaluate('enemies[0].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 04 visual exit remains RED when only enemy 01 is defeated');
    // Defeat only enemy 02
    await evaluate('enemies[0].dead = false; enemies[1].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 04 visual exit remains RED when only enemy 02 is defeated');
    // Defeat BOTH enemies
    await evaluate('enemies[0].dead = true; enemies[1].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 04 visual exit turns GREEN immediately after both enemies are defeated');

    // Case 02 Live Progression:
    await evaluate('loadLevel(1, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 02 visual exit is RED at start');
    // Only Door A open
    await evaluate('ghosts.push([{x: 2, y: 2, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 02 visual exit remains RED when only Door A is open');
    // Both Doors A and B open
    await evaluate('ghosts.push([{x: 6, y: 1, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 02 visual exit turns GREEN immediately when both Doors A and B are open');

    // Case 03 Live Progression (Avoidance):
    await evaluate('loadLevel(2, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 03 visual exit is RED when Door A is closed');
    // Shadow holds Door A, sentry alive
    await evaluate('ghosts.push([{x: 3, y: 2, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 03 visual exit turns GREEN with Door A held, even with sentry alive');

    // Case 05 Live Progression:
    await evaluate('loadLevel(4, true)');
    await new Promise(r => setTimeout(r, 40));
    // 2 of 3 doors open (A and B)
    await evaluate('ghosts.push([{x: 2, y: 3, f: [1,0], s: 0}], [{x: 5, y: 1, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 05 visual exit remains RED when only two doors are open');
    // All 3 doors open
    await evaluate('ghosts.push([{x: 5, y: 3, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 05 visual exit turns GREEN immediately when all three doors are open');

    // Case 06 Live Progression (Avoidance):
    await evaluate('loadLevel(5, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 06 visual exit is RED when Door A is closed');
    // Shadow holds Door A, sentries alive
    await evaluate('ghosts.push([{x: 3, y: 3, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 06 visual exit turns GREEN with Door A held, even with sentries alive');

    // Case 07 Live Progression:
    await evaluate('loadLevel(6, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 07 visual exit is RED at start');
    // Only branch A open, Gate C closed
    await evaluate('ghosts.push([{x: 2, y: 3, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 07 visual exit remains RED when Gate C is closed');
    // Gate C open as well
    await evaluate('ghosts.push([{x: 10, y: 5, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 07 visual exit turns GREEN immediately when branch and Gate C are held open');

    // Case 08 Live Progression:
    await evaluate('loadLevel(7, true)');
    await new Promise(r => setTimeout(r, 40));
    assert(await evaluate('renderCurrentFrame(); isExitVisualLocked()') === true, 'Case 08 visual exit is RED when enemies alive and Door B closed');
    // One enemy defeated
    await evaluate('enemies[0].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 08 visual exit remains RED when only one enemy is defeated');
    // Both enemies defeated but Door B closed
    await evaluate('enemies[1].dead = true; renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === true, 'Case 08 visual exit remains RED when enemies are defeated but Door B is closed');
    // Both enemies defeated AND Door B open
    await evaluate('ghosts.push([{x: 10, y: 1, f: [1,0], s: 0}]); renderCurrentFrame();');
    assert(await evaluate('isExitVisualLocked()') === false, 'Case 08 visual exit turns GREEN immediately when both enemies are dead and Door B is open');

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

    // Simulate legitimate Case 03 completion with sentry actively alive
    await evaluate('loadLevel(2, true)');
    await new Promise(r => setTimeout(r, 40));
    const c3SentryAlive = await evaluate('enemies[0] && enemies[0].dead === false');
    assert(c3SentryAlive === true, 'Case 03 sentry 01 is verified alive before exiting');
    await evaluate(`(() => {
      ghosts.push([{ x: 3, y: 2, f: [1, 0], s: 0 }]); // ghost on plate a
      pos = { x: 10, y: 2 }; // player on exit
      tick();
    })()`);
    const lvAfterC3Legit = await evaluate('lv');
    assert(lvAfterC3Legit === 3, 'Case 03 legitimately completed with sentry alive and advanced to Case 04');

    // Simulate legitimate Case 04 completion after defeating all enemies
    await evaluate('loadLevel(3, true)');
    await new Promise(r => setTimeout(r, 40));
    await evaluate(`(() => {
      enemies.forEach(e => e.dead = true);
      pos = { x: 10, y: 5 }; // player on exit
      tick();
    })()`);
    const lvAfterC4Legit = await evaluate('lv');
    assert(lvAfterC4Legit === 4, 'Case 04 legitimately completed when all enemies killed, advancing to Case 05');

    // Simulate legitimate Case 08 completion after defeating all enemies and holding Door B
    await evaluate('loadLevel(7, true)');
    await new Promise(r => setTimeout(r, 40));
    await evaluate(`(() => {
      enemies.forEach(e => e.dead = true);
      ghosts.push([{ x: 10, y: 1, f: [1, 0], s: 0 }]); // ghost on plate b
      pos = { x: 10, y: 5 }; // player on exit
      tick();
    })()`);
    const wonAfterC8Legit = await evaluate('won');
    assert(wonAfterC8Legit === true, 'Case 08 legitimately completed when all enemies killed and Door B open, triggering game victory');

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
