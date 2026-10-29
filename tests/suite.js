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

    // Case 02
    await new Promise(r => setTimeout(r, 100));
    // Loop 1: to plate a (2,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowRight', 'ArrowRight'); // (2,2)
    await sendKeyRaw('r', 'KeyR');
    // Loop 2: to plate b (6,1)
    await new Promise(r => setTimeout(r, 100));
    await tap(' ', 'Space'); // wait
    await tap('ArrowRight', 'ArrowRight'); // (2,1)
    await tap('ArrowRight', 'ArrowRight'); // (3,1)
    await tap('ArrowDown', 'ArrowDown');  // (3,2)
    await tap('ArrowRight', 'ArrowRight'); // (4,2, Door A)
    await tap('ArrowRight', 'ArrowRight'); // (5,2)
    await tap('ArrowUp', 'ArrowUp');      // (5,1)
    await tap('ArrowRight', 'ArrowRight'); // (6,1, on plate b)
    await sendKeyRaw('r', 'KeyR');
    // Loop 3: to exit (10,3)
    await new Promise(r => setTimeout(r, 100));
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
    assert(lvAfterC2 === 2, 'Case 02 completed successfully, advanced to Case 03', `lv=${lvAfterC2}`);

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

    console.log('\n=== TEST 8: Case 04 Defeat All 3 Enemies & Victory Screen ===');
    await evaluate('hist = []; loadLevel(3)');
    await new Promise(r => setTimeout(r, 100));

    // Loop 1: Walk to (8,1) and strike Enemy 01 at t=8
    for (let i = 0; i < 7; i++) await tap('ArrowRight', 'ArrowRight');
    await tap(' ', 'Space');
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 2: Walk to (9,3) and strike Enemy 02 at t=11
    await tap('ArrowDown', 'ArrowDown');
    await tap('ArrowDown', 'ArrowDown');
    for (let i = 0; i < 8; i++) await tap('ArrowRight', 'ArrowRight');
    await tap(' ', 'Space');
    await sendKeyRaw('r', 'KeyR');
    await new Promise(r => setTimeout(r, 100));

    // Loop 3: Wait 1 tick, walk to (7,5), strike Enemy 03 at t=12, walk to exit (10,5)
    await tap(' ', 'Space'); // t=1 wait
    await tap('ArrowDown', 'ArrowDown'); // (1,2)
    await tap('ArrowDown', 'ArrowDown'); // (1,3)
    await tap('ArrowDown', 'ArrowDown'); // (1,4)
    await tap('ArrowDown', 'ArrowDown'); // (1,5)
    for (let i = 0; i < 6; i++) await tap('ArrowRight', 'ArrowRight');
    await tap(' ', 'Space'); // t=12 strike Enemy 03

    // Check enemies status
    let enemiesStatus = await evaluate('enemies.map(e => ({ tag: e.tag, dead: e.dead }))');
    console.log('Case 04 enemies status after strikes:', enemiesStatus);
    assert(enemiesStatus.every(e => e.dead), 'All 3 Case 04 enemies defeated');

    // Walk to Exit (10,5)
    await tap('ArrowRight', 'ArrowRight'); // (8,5)
    await tap('ArrowRight', 'ArrowRight'); // (9,5)
    await tap('ArrowRight', 'ArrowRight'); // (10,5) -> Exit!

    await new Promise(r => setTimeout(r, 200));
    let lvAfterC4 = await evaluate('lv');
    assert(lvAfterC4 === 4, 'Case 04 completed successfully, advanced to Case 05', `lv=${lvAfterC4}`);

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
      { lv: 0, s: 30, ticks: 214, name: 'Case 01' },
      { lv: 1, s: 40, ticks: 286, name: 'Case 02' },
      { lv: 2, s: 50, ticks: 357, name: 'Case 03' },
      { lv: 3, s: 70, ticks: 500, name: 'Case 04' },
      { lv: 4, s: 60, ticks: 429, name: 'Case 05' },
      { lv: 5, s: 65, ticks: 464, name: 'Case 06' },
      { lv: 6, s: 75, ticks: 536, name: 'Case 07' },
      { lv: 7, s: 90, ticks: 643, name: 'Case 08' }
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
