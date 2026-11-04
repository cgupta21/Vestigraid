/**
 * Dedicated Regression Test Suite for Vestigraid QA Bug Fixes:
 * - Bug 1: Empty shadow loop commit validation (js/shadows.js & js/main.js)
 * - Bug 2: Enemy collision check tick zero negative index TypeError (js/enemies.js)
 * - Bug 3: Chapter milestone completion card appears before chapter outro (js/main.js)
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
  console.log('===============================================================');
  console.log(' REGRESSION TEST SUITE: GAMEPLAY QA BUG FIXES');
  console.log('===============================================================');

  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--allow-file-access-from-files',
    '--disable-gpu',
    '--no-sandbox',
    'file:///C:/CG_PROJECT/Vestigraid/index.html'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
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

    for (let r = 0; r < 50; r++) {
      const type = await evaluate('typeof loadLevel');
      if (type === 'function') break;
      await new Promise(res => setTimeout(res, 100));
    }

    // Dismiss initial startup cinematics cleanly
    while (await evaluate('isCinematicActive()')) {
      await evaluate('skipCinematic();');
      await new Promise(res => setTimeout(res, 50));
    }
    await evaluate('progress.highestUnlocked = 11; progress.completedCases = [0,1,2,3,4,5,6,7,8,9,10,11]; progress.story = { viewed: Object.keys(STORY_SEQUENCES), unlockedChapters: [1,2,3,4] }; saveProgress(progress);');

    async function pressKey(key, code) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await new Promise(r => setTimeout(r, 25));
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      await new Promise(r => setTimeout(r, 60));
    }

    // ─── BUG 1 VERIFICATION ───────────────────────────────────────────
    console.log('\n=== BUG 1: Empty Shadow Loop Validation ===');
    await evaluate('loadLevel(0, true, false)');
    await new Promise(r => setTimeout(r, 100));

    // 1. Pressing R at tick 0 without moving
    assert((await evaluate('t')) === 0 && (await evaluate('ghosts.length')) === 0 && (await evaluate('loops')) === 1, 'Initial state: t=0, ghosts=0, loops=1');
    await evaluate('commit(false)');
    assert((await evaluate('ghosts.length')) === 0, 'Commit at tick 0 does NOT create a shadow ghost');
    assert((await evaluate('loops')) === 1, 'Commit at tick 0 does NOT increment loop counter');
    const msgAtT0 = await evaluate('document.getElementById("msg").textContent');
    assert(msgAtT0 === 'Move first. An empty loop leaves no shadow.', `Displays expected rejection message: "${msgAtT0}"`);

    // 2. Committing at tick 1 without movement (stationary wait)
    await evaluate('tick()'); // tick 1 without moving
    assert((await evaluate('t')) === 1, 'Advanced to tick 1');
    await evaluate('commit(false)');
    assert((await evaluate('ghosts.length')) === 0, 'Commit at tick 1 without moving does NOT create a shadow ghost');
    assert((await evaluate('loops')) === 1, 'Loop counter remains 1 when committing without movement');

    // 3. Committing after valid movement
    await evaluate('loadLevel(0, true, false)');
    await evaluate(`(() => {
      pos = { x: 2, y: 1 };
      tick();
      pos = { x: 3, y: 1 };
      tick();
    })()`);
    assert((await evaluate('t')) === 2, 'Player moved across 2 ticks');
    await evaluate('commit(false)');
    assert((await evaluate('ghosts.length')) === 1, 'Valid movement commits a shadow ghost (ghosts.length = 1)');
    assert((await evaluate('loops')) === 2, 'Loop counter incremented to 2 after valid commit');

    // 4. Auto-commit on timer expiration succeeds
    await evaluate('commit(true)');
    assert((await evaluate('loops')) === 3, 'Auto-commit on timer expiration increments loops to 3');


    // ─── BUG 2 VERIFICATION ───────────────────────────────────────────
    console.log('\n=== BUG 2: Enemy Collision at Tick Zero Negative Index TypeError ===');
    await evaluate('loadLevel(3, true, false)'); // Case 04 has sentinels

    // 1. getEnemyPos evaluated at negative and zero ticks
    const ePosNeg1 = await evaluate(`(() => {
      const e = enemies[0];
      return ePos(e, -1);
    })()`);
    assert(ePosNeg1 && typeof ePosNeg1.x === 'number' && typeof ePosNeg1.y === 'number', 'ePos(e, -1) safely handles negative tick without crashing');

    const ePos0 = await evaluate(`(() => {
      const e = enemies[0];
      return ePos(e, 0);
    })()`);
    assert(ePos0 && typeof ePos0.x === 'number' && typeof ePos0.y === 'number', 'ePos(e, 0) returns valid position at tick 0');

    // 2. checkEnemyCollision executed at tick 0 (tt = 0)
    const collisionAtTick0 = await evaluate(`(() => {
      try {
        const e0 = enemies[0];
        const p0 = ePos(e0, 0);
        // Test evaluate collision when moving directly onto enemy at tick 0
        const enemyHit = checkEnemyCollision({ x: p0.x, y: p0.y }, { x: p0.x - 1, y: p0.y }, 0);
        return { success: true, hitTag: enemyHit ? enemyHit.tag : null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })()`);
    assert(collisionAtTick0.success === true, 'checkEnemyCollision at tick 0 completes without TypeError', collisionAtTick0.error);
    assert(collisionAtTick0.hitTag !== null, `Legitimate contact at tick 0 detects enemy (tag=${collisionAtTick0.hitTag})`);

    // 3. checkEnemyCollision safe non-collision at tick 0
    const nonCollisionAtTick0 = await evaluate(`(() => {
      try {
        const hit = checkEnemyCollision({ x: 1, y: 1 }, { x: 1, y: 1 }, 0);
        return { success: true, hit: hit !== null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })()`);
    assert(nonCollisionAtTick0.success === true && nonCollisionAtTick0.hit === false, 'Safe non-collision at tick 0 completes without exception');


    // ─── BUG 3 VERIFICATION ───────────────────────────────────────────
    console.log('\n=== BUG 3: Milestone Case Completion Card Appears Before Chapter Outro ===');

    // 1. Case 03 (Chapter 1 Milestone)
    await evaluate('loadLevel(2, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch1_outro" && id !== "ch2_intro" && id !== "case04_intro"); saveProgress(progress);');
    // Trigger Case 03 win
    await evaluate(`(() => {
      ghosts.push([{ x: 3, y: 2, f: [1, 0], s: 0 }]);
      pos = { x: 10, y: 2 };
      tick();
    })()`);
    await new Promise(r => setTimeout(r, 100));

    // Verification: Completion overlay is visible FIRST, cinematic is NOT active yet
    const c3OvVisible = await evaluate('document.getElementById("ov").style.display !== "none"');
    const c3CinActive = await evaluate('isCinematicActive()');
    assert(c3OvVisible === true, 'Case 03 completion overlay appears immediately upon winning');
    assert(c3CinActive === false, 'Cinematic overlay is NOT active while Case 03 completion card is shown');
    const c3Score = await evaluate('document.querySelector(".ov-score-val")?.textContent');
    assert(c3Score && c3Score.length > 0, `Completion card displays score stats: "${c3Score}"`);

    // Dismiss overlay via Enter key
    await pressKey('Enter', 'Enter');
    await new Promise(r => setTimeout(r, 100));

    // Verification: Outro cinematic triggers upon dismissing the completion card
    assert(await evaluate('isCinematicActive()'), 'Dismissing Case 03 completion card triggers Chapter 1 Outro');
    const c1OutroTitle = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c1OutroTitle === 'Warden Alert Phase I', `Active cinematic is Chapter 1 outro: "${c1OutroTitle}"`);
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));
    assert(await evaluate('hasViewedStory("ch1_outro")'), 'ch1_outro marked as viewed after concluding');
    if (await evaluate('isCinematicActive()')) await evaluate('skipCinematic()');
    if (await evaluate('isCinematicActive()')) await evaluate('skipCinematic()');
    assert((await evaluate('lv')) === 3, 'Advances to Case 04 after chapter transition concludes');

    // 2. Case 06 (Chapter 2 Milestone)
    await evaluate('loadLevel(5, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch2_outro" && id !== "ch3_intro" && id !== "case07_intro"); saveProgress(progress);');
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('document.getElementById("ov").style.display !== "none"'), 'Case 06 completion overlay appears immediately upon winning');
    assert(!(await evaluate('isCinematicActive()')), 'Cinematic overlay is NOT active while Case 06 completion card is shown');
    await pressKey('Enter', 'Enter');
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Dismissing Case 06 completion card triggers Chapter 2 Outro');
    const c2OutroTitle = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c2OutroTitle === 'De-Synchronization', `Active cinematic is Chapter 2 outro: "${c2OutroTitle}"`);
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));
    assert(await evaluate('hasViewedStory("ch2_outro")'), 'ch2_outro marked as viewed after concluding');
    if (await evaluate('isCinematicActive()')) await evaluate('skipCinematic()');
    if (await evaluate('isCinematicActive()')) await evaluate('skipCinematic()');
    assert((await evaluate('lv')) === 6, 'Advances to Case 07 after chapter transition concludes');

    // 3. Case 09 (Chapter 3 Milestone)
    await evaluate('loadLevel(8, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch3_outro" && id !== "ch4_intro" && id !== "case10_intro"); saveProgress(progress);');
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('document.getElementById("ov").style.display !== "none"'), 'Case 09 completion overlay appears immediately upon winning');
    assert(!(await evaluate('isCinematicActive()')), 'Cinematic overlay is NOT active while Case 09 completion card is shown');
    await pressKey('Enter', 'Enter');
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Dismissing Case 09 completion card triggers Chapter 3 Outro');
    const c3OutroTitle = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c3OutroTitle === 'The Core Collapsing', `Active cinematic is Chapter 3 outro: "${c3OutroTitle}"`);
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));
    assert(await evaluate('hasViewedStory("ch3_outro")'), 'ch3_outro marked as viewed after concluding');
    if (await evaluate('isCinematicActive()')) await evaluate('skipCinematic()');
    if (await evaluate('isCinematicActive()')) await evaluate('skipCinematic()');
    assert((await evaluate('lv')) === 9, 'Advances to Case 10 after chapter transition concludes');

    console.log('\n===============================================================');
    const passed = testResults.filter(t => t.pass).length;
    const failed = testResults.filter(t => !t.pass).length;
    console.log(`ALL QA BUG FIX REGRESSION TESTS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('===============================================================');
    if (failed > 0) process.exit(1);
  } finally {
    proc.kill();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
