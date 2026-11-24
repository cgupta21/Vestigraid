// ─── Regression Test Suite: Case Completion Overlay & Transitions ─────────────

import { spawn } from 'child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9380 + Math.floor(Math.random() * 200);

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log(' REGRESSION TEST SUITE: CASE TRANSITIONS & OVERLAY DISMISSAL');
  console.log('===============================================================\n');

  const proc = spawn(chromePath, [
    '--headless=new',
    '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`,
    'file:///C:/CG_PROJECT/Vestigraid/index.html'
  ]);

  try {
    let wsUrl = null;
    for (let r = 0; r < 30; r++) {
      await new Promise(res => setTimeout(res, 200));
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const page = list.find(t => t.type === 'page');
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch (_) {}
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

    const ws = new WebSocket(wsUrl);
    await new Promise(res => ws.onopen = res);

    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const curId = id++;
        const handler = (m) => {
          const d = JSON.parse(m.data);
          if (d.id === curId) {
            ws.removeEventListener('message', handler);
            resolve(d.result);
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

    // Wait until loaded
    for (let i = 0; i < 50; i++) {
      if (await evaluate('typeof loadLevel') === 'function') break;
      await new Promise(r => setTimeout(r, 100));
    }
    while (await evaluate('isCinematicActive()')) {
      await evaluate('skipCinematic()');
      await new Promise(r => setTimeout(r, 50));
    }

    // Helper to dismiss all active story cinematics sequentially
    async function dismissActiveCinematics() {
      while (await evaluate('isCinematicActive()')) {
        await evaluate('skipCinematic()');
        await new Promise(r => setTimeout(r, 60));
      }
    }

    // Helper to simulate mouse click on Next Case button
    async function clickNextCaseButton() {
      return evaluate(`(() => {
        const btn = document.getElementById('btn-next-case');
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
    }

    console.log('=== 1. Mandatory Transition: Case 01 -> Case 02 ===');
    await dismissActiveCinematics();
    await evaluate('loadLevel(0, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 50));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 01 completion overlay is active');
    assert(await evaluate('document.getElementById("ov").style.display !== "none"'), 'Overlay element is displayed flex');
    assert(!(await evaluate('started')), 'Gameplay round is stopped (started = false)');

    // Click Next Case
    const clickedC1 = await clickNextCaseButton();
    assert(clickedC1, 'Next Case button was found and clicked on Case 01');
    await new Promise(r => setTimeout(r, 50));

    assert(!(await evaluate('isCaseCompletionActive()')), 'Case 01 completion overlay is deactivated');
    assert(await evaluate('document.getElementById("ov").style.display === "none"'), 'Overlay element is hidden');
    assert((await evaluate('lv')) === 1, 'Advanced to Case 02 without delay');
    const c1CinematicTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c1CinematicTitle !== 'Warden Alert Phase I' && c1CinematicTitle !== 'Signal in the Dark', 'No chapter cinematics triggered for ordinary transition');

    console.log('\n=== 2. Mandatory Transition: Case 02 -> Case 03 ===');
    await dismissActiveCinematics();
    await evaluate('loadLevel(1, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 50));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 02 completion overlay is active');
    const clickedC2 = await clickNextCaseButton();
    assert(clickedC2, 'Next Case button clicked on Case 02');
    await new Promise(r => setTimeout(r, 50));

    assert((await evaluate('lv')) === 2, 'Advanced to Case 03');
    const c2CinematicTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c2CinematicTitle !== 'Warden Alert Phase I' && c2CinematicTitle !== 'Signal in the Dark', 'No chapter cinematics triggered for ordinary transition');

    console.log('\n=== 3. Mandatory Transition: Case 03 -> Case 04 (Chapter 1 Milestone) ===');
    await dismissActiveCinematics();
    // Ensure ch1_outro is unviewed for authentic sequence
    await evaluate(`(() => {
      progress = loadProgress();
      progress.story.viewed = progress.story.viewed.filter(id => id !== 'ch1_outro' && id !== 'ch2_intro' && id !== 'case04_intro');
      saveProgress(progress);
    })()`);
    await evaluate('loadLevel(2, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 50));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 03 completion overlay appears immediately');
    assert(await evaluate('document.getElementById("ov").style.display !== "none"'), 'Completion card visible before outro');
    assert(!(await evaluate('isCinematicActive()')), 'Outro cinematic has NOT started yet while completion card is open');
    assert((await evaluate('lv')) === 2, 'Level is still Case 03 while completion card is viewed');
    assert(!(await evaluate('started')), 'Simulation is halted (started = false)');

    // Multiple rapid clicks on Next Case button must be safely handled
    const multiClickResults = await evaluate(`(() => {
      const btn = document.getElementById('btn-next-case');
      if (!btn) return { count: 0 };
      const r1 = isCaseCompletionActive();
      btn.click();
      const r2 = isCaseCompletionActive();
      btn.click();
      btn.click();
      return { r1, r2, btnExisted: true };
    })()`);
    assert(multiClickResults.btnExisted, 'Next Case button clicked');
    assert(multiClickResults.r1 === true && multiClickResults.r2 === false, 'Overlay dismissed on first click; duplicate clicks ignored');
    await new Promise(r => setTimeout(r, 100));

    // Chapter 1 Outro should now be playing
    assert(await evaluate('isCinematicActive()'), 'Chapter 1 Outro cinematic starts after clicking Next Case');
    const c1OutroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c1OutroTitle === 'Warden Alert Phase I', `Active cinematic is Chapter 1 outro: "${c1OutroTitle}"`);

    // Complete chapter outro -> triggers Chapter 2 intro -> Case 04 intro
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));

    // Chapter 2 intro plays
    assert(await evaluate('isCinematicActive()'), 'Chapter 2 Introduction starts after Chapter 1 outro');
    const c2IntroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c2IntroTitle === 'The Proving Grounds', `Active cinematic is Chapter 2 intro: "${c2IntroTitle}"`);

    await dismissActiveCinematics();
    assert((await evaluate('lv')) === 3, 'Level successfully loaded Case 04');
    assert(!(await evaluate('isCinematicActive()')), 'All transitions concluded, ready for Case 04 gameplay');

    console.log('\n=== 4. Mandatory Transition: Case 04 -> Case 05 ===');
    await dismissActiveCinematics();
    await evaluate('loadLevel(3, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 50));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 04 completion overlay is active');
    const clickedC4 = await clickNextCaseButton();
    assert(clickedC4, 'Next Case button clicked on Case 04');
    await new Promise(r => setTimeout(r, 50));

    assert((await evaluate('lv')) === 4, 'Advanced to Case 05');
    const c4CinematicTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c4CinematicTitle !== 'De-Synchronization' && c4CinematicTitle !== 'The Proving Grounds', 'No chapter cinematics triggered for ordinary transition');

    console.log('\n=== 5. Mandatory Transition: Case 06 -> Case 07 (Chapter 2 Milestone) ===');
    await dismissActiveCinematics();
    await evaluate(`(() => {
      progress = loadProgress();
      progress.story.viewed = progress.story.viewed.filter(id => id !== 'ch2_outro' && id !== 'ch3_intro' && id !== 'case07_intro');
      saveProgress(progress);
    })()`);
    await evaluate('loadLevel(5, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 50));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 06 completion overlay appears first');
    assert(!(await evaluate('isCinematicActive()')), 'Chapter 2 Outro not triggered until dismissal');

    // Click Next Case
    await clickNextCaseButton();
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Dismissing Case 06 card triggers Chapter 2 Outro');
    const c2OutroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c2OutroTitle === 'De-Synchronization', `Active cinematic is Chapter 2 outro: "${c2OutroTitle}"`);

    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));

    const c3IntroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c3IntroTitle === 'Spatial Degradation', `Next chapter introduction played: "${c3IntroTitle}"`);

    await dismissActiveCinematics();
    assert((await evaluate('lv')) === 6, 'Level advanced to Case 07');

    console.log('\n=== 6. Mandatory Transition: Case 09 -> Case 10 (Chapter 3 Milestone) ===');
    await dismissActiveCinematics();
    await evaluate(`(() => {
      progress = loadProgress();
      progress.story.viewed = progress.story.viewed.filter(id => id !== 'ch3_outro' && id !== 'ch4_intro' && id !== 'case10_intro');
      saveProgress(progress);
    })()`);
    await evaluate('loadLevel(8, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 50));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 09 completion overlay appears first');
    assert(!(await evaluate('isCinematicActive()')), 'Chapter 3 Outro not triggered until dismissal');

    // Click Next Case
    await clickNextCaseButton();
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Dismissing Case 09 card triggers Chapter 3 Outro');
    const c3OutroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c3OutroTitle === 'The Core Collapsing', `Active cinematic is Chapter 3 outro: "${c3OutroTitle}"`);

    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));

    const c4IntroTitle = await evaluate('document.getElementById("cinematic-title")?.textContent');
    assert(c4IntroTitle === 'The Loop Collapse', `Next chapter introduction played: "${c4IntroTitle}"`);

    await dismissActiveCinematics();
    assert((await evaluate('lv')) === 9, 'Level advanced to Case 10');

    console.log('\n=== 7. Mandatory Transition: Case 12 to the Surface Line ===');
    await dismissActiveCinematics();
    await evaluate(`(() => {
      progress = loadProgress();
      progress.story.viewed = progress.story.viewed.filter(id => id !== 'ch4_outro' && id !== 'epilogue');
      saveProgress(progress);
    })()`);
    await evaluate('loadLevel(11, true, false)');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('win()');
    await new Promise(r => setTimeout(r, 100));

    // Chapter 4 outro plays immediately after solving The Paradox
    assert(await evaluate('isCinematicActive()'), 'Case 12 victory triggers Chapter 4 Outro');
    assert((await evaluate('document.getElementById("cinematic-title")?.textContent')) === 'The Warden Falls', 'Outro is "The Warden Falls"');
    assert(await evaluate('!won && getUnlockedChapters().includes(5)'), 'Case 12 unlocks Chapter 5');

    // Skip ch4_outro
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));

    // Epilogue plays
    assert(await evaluate('isCinematicActive()'), 'Grand Epilogue chains after Chapter 4 Outro');
    assert((await evaluate('document.getElementById("cinematic-title")?.textContent')) === 'The Echo Protocol', 'Epilogue is "The Echo Protocol"');

    // Skip epilogue
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCaseCompletionActive()'), 'Case 12 has a Next Case button after the epilogue');
    await clickNextCaseButton();
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'An Open Channel', 'Next Case starts Chapter 5');
    await dismissActiveCinematics();
    assert(await evaluate('lv === 12'), 'Case 13 is playable');

    await evaluate('loadLevel(15, true, false); win()');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'First Weather', 'Daybreak plays the surface line ending');
    await evaluate('skipCinematic()');
    assert(await evaluate('!won && !progress.gameCompleted && isCaseUnlocked(16)'), 'Daybreak opens Storm Watch');
    await clickNextCaseButton();
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'Storm Watch', 'Chapter 6 starts after Daybreak');
    await dismissActiveCinematics();
    await evaluate('loadLevel(19, true, false); win()');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'Acknowledged', 'Case 20 plays the mast ending');
    await evaluate('skipCinematic()');
    assert(await evaluate('!won && !progress.gameCompleted && isCaseUnlocked(20)'), 'Last Broadcast opens The Breakwater');
    await clickNextCaseButton();
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'The Breakwater', 'Chapter 7 starts after Last Broadcast');
    await dismissActiveCinematics();
    await evaluate('loadLevel(23, true, false); win()');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'Open Water', 'Case 24 plays the pier ending');
    await evaluate('skipCinematic()');
    assert(await evaluate('won && progress.gameCompleted'), 'Case 24 sets campaign completion');

    // Grand final overlay appears
    assert(await evaluate('document.getElementById("ov").style.display !== "none"'), 'Grand Final victory overlay displayed');
    const ovHtml = await evaluate('document.getElementById("ov").innerHTML');
    assert(ovHtml.includes('ALL CASES CLOSED'), 'Grand Final overlay displays ALL CASES CLOSED');
    assert(!ovHtml.includes('btn-next-case'), 'Grand Final overlay does NOT contain a Next Case button');
    assert(ovHtml.includes('id="ag"'), 'Grand Final overlay contains Play Again button');
    assert(ovHtml.includes('id="ov-archive"'), 'Grand Final overlay contains Case Archive button');
    assert(ovHtml.includes('id="re-last"'), 'Grand Final overlay contains Restart Final Case button');
    assert(!(await evaluate('isCaseCompletionActive()')), 'caseCompletionActive is false on Grand Final overlay');

    // Attempting to dismiss grand final overlay via keyboard Enter / Space / Escape has no effect
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
    await new Promise(r => setTimeout(r, 50));
    assert(await evaluate('document.getElementById("ov").style.display !== "none"'), 'Grand Final overlay NOT dismissed by Enter key');

    console.log('\n===============================================================');
    console.log(`CASE TRANSITIONS SUITE COMPLETE: ${passed + failed} Tests | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('===============================================================');

    proc.kill();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    proc.kill();
    process.exit(1);
  }
}

runTests();
