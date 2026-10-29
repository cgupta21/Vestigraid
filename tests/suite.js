/**
 * Vestigraid Comprehensive Verification & Regression Test Suite
 * Tests all 4 cases in Chrome via CDP.
 */

const { spawn } = require('child_process');
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
    // Case 01
    await evaluate('loadLevel(0)');
    await new Promise(r => setTimeout(r, 50));
    let c1 = await evaluate('({ w: cv.width, h: cv.height, cols, rows })');
    assert(c1.w === 640 && c1.h === 320, 'Case 01 canvas dimensions', `w=${c1.w}, h=${c1.h}`);

    // Case 02
    await evaluate('loadLevel(1)');
    await new Promise(r => setTimeout(r, 50));
    let c2 = await evaluate('({ w: cv.width, h: cv.height, cols, rows })');
    assert(c2.w === 768 && c2.h === 320, 'Case 02 canvas dimensions', `w=${c2.w}, h=${c2.h}`);

    // Case 03
    await evaluate('loadLevel(2)');
    await new Promise(r => setTimeout(r, 50));
    let c3 = await evaluate('({ w: cv.width, h: cv.height, cols, rows })');
    assert(c3.w === 768 && c3.h === 320, 'Case 03 canvas dimensions', `w=${c3.w}, h=${c3.h}`);

    // Case 04 (Crucial bug check: transitioned from Case 03 where width was already 768)
    await evaluate('loadLevel(3)');
    await new Promise(r => setTimeout(r, 50));
    let c4 = await evaluate('({ w: cv.width, h: cv.height, cols, rows })');
    assert(c4.w === 768 && c4.h === 448, 'Case 04 canvas height correctly set to 448 (7 rows)', `w=${c4.w}, h=${c4.h}`);

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
    let wonGame = await evaluate('won');
    let ovDisplay = await evaluate('document.getElementById("ov").style.display');
    let ovHtml = await evaluate('document.getElementById("ov").innerHTML');

    assert(wonGame === true, 'Case 04 won condition reached (won = true)');
    assert(ovDisplay === 'flex', 'Victory overlay displayed (display = flex)');
    assert(ovHtml.includes('CASE CLOSED'), 'Victory overlay displays "CASE CLOSED"');

    console.log('\n=== TEST 9: Timer Balance, Pausing, State Transitions & Auto-Commit ===');
    // 1. Verify per-case timer values and tick computations
    await evaluate('loadLevel(0)');
    let tInfo1 = await evaluate('({ timeLimit: LV[0].timeLimit, MAX })');
    assert(tInfo1.timeLimit === 30 && tInfo1.MAX === 214, 'Case 01 configured for 30s (214 ticks)', `timeLimit=${tInfo1.timeLimit}, MAX=${tInfo1.MAX}`);

    await evaluate('loadLevel(1)');
    let tInfo2 = await evaluate('({ timeLimit: LV[1].timeLimit, MAX })');
    assert(tInfo2.timeLimit === 40 && tInfo2.MAX === 286, 'Case 02 configured for 40s (286 ticks)', `timeLimit=${tInfo2.timeLimit}, MAX=${tInfo2.MAX}`);

    await evaluate('loadLevel(2)');
    let tInfo3 = await evaluate('({ timeLimit: LV[2].timeLimit, MAX })');
    assert(tInfo3.timeLimit === 50 && tInfo3.MAX === 357, 'Case 03 configured for 50s (357 ticks)', `timeLimit=${tInfo3.timeLimit}, MAX=${tInfo3.MAX}`);

    await evaluate('loadLevel(3)');
    let tInfo4 = await evaluate('({ timeLimit: LV[3].timeLimit, MAX })');
    assert(tInfo4.timeLimit === 70 && tInfo4.MAX === 500, 'Case 04 configured for 70s (500 ticks)', `timeLimit=${tInfo4.timeLimit}, MAX=${tInfo4.MAX}`);

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
