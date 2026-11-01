/**
 * Vestigraid Phase 2 Browser Verification Audit Script
 * Runs targeted browser tests for The Echo Protocol - Chapter 1 & Cinematic Engine.
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

async function runBrowserAudit() {
  const port = 9500 + Math.floor(Math.random() * 400);
  const proc = spawn(chromePath, [
    '--headless=new',
    '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`,
    'file:///C:/CG_PROJECT/Vestigraid/index.html'
  ]);

  try {
    let wsUrl = null;
    for (let retry = 0; retry < 25; retry++) {
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

    async function pressKey(key, code) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await new Promise(r => setTimeout(r, 25));
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      await new Promise(r => setTimeout(r, 60));
    }

    // 0. Backup user's actual localStorage before touching anything
    const originalSave = await evaluate('localStorage.getItem("vestigraid_progress_v1")');

    console.log('===============================================================');
    console.log(' PHASE 2 BROWSER VERIFICATION AUDIT — THE ECHO PROTOCOL (CH 1)');
    console.log('===============================================================\n');

    // ─── SECTION 1: Complete Chapter 1 Flow ─────────────────────────
    console.log('=== SECTION 1: Chapter 1 Flow & Transitions ===');

    // 1.1 Start a fresh game
    await evaluate('localStorage.clear(); resetProgress(); loadLevel(0);');
    await new Promise(r => setTimeout(r, 100));

    // 1.2 Confirm Chapter 1 Intro appears
    assert(await evaluate('isCinematicActive()'), 'Fresh game start automatically activates cinematic overlay');
    const ch1Title = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(ch1Title === 'Signal in the Dark', `Chapter 1 intro title is "Signal in the Dark" (got "${ch1Title}")`);
    const ch1ChapterBadge = await evaluate('document.getElementById("cinematic-chapter").textContent');
    assert(ch1ChapterBadge.includes('CHAPTER 1'), `Cinematic header indicates CHAPTER 1 (got "${ch1ChapterBadge}")`);

    // Line 1 speaker: SYSTEM
    const speakerLine1 = await evaluate('document.getElementById("cinematic-speaker").textContent');
    assert(speakerLine1 === 'SYSTEM', `Initial speaker is SYSTEM (got "${speakerLine1}")`);

    // Advance through ch1_intro dialogue lines
    // Finish line 1 typing, advance to line 2 (SYSTEM)
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');
    // Finish line 2 typing, advance to line 3 (UNKNOWN VOICE)
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');
    const voiceLineSpeaker = await evaluate('document.getElementById("cinematic-speaker").textContent');
    assert(voiceLineSpeaker === 'UNKNOWN VOICE', `Speaker badge dynamically updates to UNKNOWN VOICE (got "${voiceLineSpeaker}")`);

    // Advance to line 4 (UNKNOWN VOICE)
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');
    // Advance to line 5 (WARDEN)
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');
    const wardenLineSpeaker = await evaluate('document.getElementById("cinematic-speaker").textContent');
    assert(wardenLineSpeaker === 'WARDEN', `Speaker badge dynamically updates to WARDEN (got "${wardenLineSpeaker}")`);

    // Advance to line 6 (UNKNOWN VOICE) and finish sequence
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');
    await pressKey(' ', 'Space');

    await new Promise(r => setTimeout(r, 100));

    // 1.3 Confirm Case 01 Intro immediately chains after Chapter 1 Intro
    assert(await evaluate('isCinematicActive()'), 'Case 01 intro chains automatically after Chapter 1 intro finishes');
    const c1Title = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c1Title === 'Hold the Door', `Case 01 intro title is "Hold the Door" (got "${c1Title}")`);

    // Finish Case 01 intro via Skip
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 80));
    assert(!(await evaluate('isCinematicActive()')), 'Cinematic overlay closes after completing Case 01 intro');
    assert((await evaluate('lv')) === 0, 'Current case remains Case 01 (lv = 0)');

    // 1.4 Complete Case 01 and verify Case 02 Intro appears
    await evaluate(`(() => {
      ghosts.push([{ x: 2, y: 3, f: [1, 0], s: 0 }]);
      pos = { x: 8, y: 2 };
      tick();
    })()`);
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Completing Case 01 automatically triggers Case 02 intro');
    const c2Title = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c2Title === 'Two Keys', `Case 02 intro title is "Two Keys" (got "${c2Title}")`);

    // Advance to line 2 to verify Dr. Mara Venn speaker badge
    await pressKey(' ', 'Space'); // finish line 1
    await pressKey(' ', 'Space'); // advance to line 2
    const c2Speaker = await evaluate('document.getElementById("cinematic-speaker").textContent');
    assert(c2Speaker === 'DR. MARA VENN', `Case 02 line 2 speaker is DR. MARA VENN (got "${c2Speaker}")`);

    // Dismiss Case 02 intro
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 80));
    assert(!(await evaluate('isCinematicActive()')), 'Case 02 intro dismisses cleanly');

    // Dismiss Case 01 completion overlay if visible
    await pressKey('Enter', 'Enter');
    await new Promise(r => setTimeout(r, 80));

    // 1.5 Complete Case 02 and verify Case 03 Intro appears
    // Solve Case 02: Plate a at (2,2), Plate b at (6,1), Exit at (10,3)
    await evaluate(`(() => {
      ghosts.push([{ x: 2, y: 2, f: [1, 0], s: 0 }]);
      ghosts.push([{ x: 6, y: 1, f: [1, 0], s: 0 }]);
      pos = { x: 10, y: 3 };
      tick();
    })()`);
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Completing Case 02 automatically triggers Case 03 intro');
    const c3Title = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c3Title === 'The Sentry', `Case 03 intro title is "The Sentry" (got "${c3Title}")`);
    const c3Speaker = await evaluate('document.getElementById("cinematic-speaker").textContent');
    assert(c3Speaker === 'WARDEN', `Case 03 initial speaker is WARDEN (got "${c3Speaker}")`);

    // Dismiss Case 03 intro
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 80));
    assert(!(await evaluate('isCinematicActive()')), 'Case 03 intro dismisses cleanly');

    // Dismiss Case 02 completion overlay
    await pressKey('Enter', 'Enter');
    await new Promise(r => setTimeout(r, 80));

    // 1.6 Complete Case 03 and verify Chapter 1 Outro appears
    // Solve Case 03: Plate a at (3,2), Exit at (10,2)
    await evaluate(`(() => {
      ghosts.push([{ x: 3, y: 2, f: [1, 0], s: 0 }]);
      pos = { x: 10, y: 2 };
      tick();
    })()`);
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('isCinematicActive()'), 'Completing Case 03 triggers Chapter 1 Outro cinematic');
    const outroTitle = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(outroTitle === 'Warden Alert Phase I', `Chapter 1 outro title is "Warden Alert Phase I" (got "${outroTitle}")`);

    // 1.7 Confirm NO Chapter 2 or Case 04 scene starts before Chapter 1 outro finishes
    assert((await evaluate('lv')) === 2, 'Level has not yet advanced to Case 04 while Chapter 1 outro is playing');
    assert(!(await evaluate('hasViewedStory("ch1_outro")')), 'ch1_outro is not yet marked viewed while active');

    // Finish outro
    await evaluate('skipCinematic()');
    await new Promise(r => setTimeout(r, 100));

    assert(await evaluate('hasViewedStory("ch1_outro")'), 'ch1_outro is marked viewed after completion');
    assert((await evaluate('lv')) === 3, 'Level advances to Case 04 (lv = 3) only after Chapter 1 outro finishes');
    // After Chapter 1 outro concludes and advances to Case 04, Chapter 2 intro or Case 04 intro plays
    if (await evaluate('isCinematicActive()')) {
      await evaluate('skipCinematic()');
    }
    if (await evaluate('isCinematicActive()')) {
      await evaluate('skipCinematic()');
    }
    assert(!(await evaluate('isCinematicActive()')), 'Cinematic overlay cleanly dismissed after Case 04 transition');


    // ─── SECTION 2: Cinematic Controls ──────────────────────────────
    console.log('\n=== SECTION 2: Cinematic Controls & Interactivity ===');

    // 2.1 Space and Enter advance dialogue & Typewriter reveal
    await evaluate('playCinematic("case01_intro")');
    await new Promise(r => setTimeout(r, 30));
    assert(await evaluate('isCinematicActive()'), 'playCinematic starts cinematic sequence');

    // Check typewriter is typing partial text
    const fullLineText = await evaluate('getStorySequence("case01_intro").lines[0].text');

    // Press Space during typing: should instantly reveal full line
    await pressKey(' ', 'Space');
    const textAfterSpace = await evaluate('document.getElementById("cinematic-text").textContent');
    assert(textAfterSpace === fullLineText, 'Pressing Space during typing instantly completes full line');

    // Press Space again: should advance to line 2
    await pressKey(' ', 'Space');
    await new Promise(r => setTimeout(r, 30));
    const line2Speaker = await evaluate('document.getElementById("cinematic-speaker").textContent');
    assert(line2Speaker === 'UNKNOWN VOICE', 'Pressing Space after line completes advances to next line');

    // 2.2 Escape and Skip button dismiss sequence
    await pressKey('Escape', 'Escape');
    await new Promise(r => setTimeout(r, 60));
    assert(!(await evaluate('isCinematicActive()')), 'Escape key dismisses active sequence');

    // Test clicking Skip button
    await evaluate('playCinematic("case02_intro")');
    assert(await evaluate('isCinematicActive()'), 'case02_intro started');
    await evaluate('document.getElementById("cinematic-skip").click()');
    await new Promise(r => setTimeout(r, 60));
    assert(!(await evaluate('isCinematicActive()')), 'Clicking SKIP button dismisses active sequence');

    // 2.3 Gameplay input suppression while cinematic is active
    await evaluate('loadLevel(0, true, false)');
    await evaluate('playCinematic("case01_intro")');
    const initialPos = await evaluate('pos');
    assert((await evaluate('t')) === 0, 'Tick starts at 0');
    assert((await evaluate('started')) === false, 'Game started is false before movement');

    // Send movement keys during cinematic
    await pressKey('ArrowRight', 'ArrowRight');
    await pressKey('ArrowDown', 'ArrowDown');
    await pressKey('w', 'KeyW');
    await pressKey('d', 'KeyD');

    const posAfterInputs = await evaluate('pos');
    assert(posAfterInputs.x === initialPos.x && posAfterInputs.y === initialPos.y, 'Player position unchanged by movement keys during cinematic');
    assert((await evaluate('started')) === false, 'Movement keys during cinematic do not start game loop');
    assert((await evaluate('t')) === 0, 'Ticks remain 0 during cinematic keypresses');

    // 2.4 Accidental round start prevention
    await pressKey(' ', 'Space'); // Space inside cinematic
    await pressKey('Enter', 'Enter'); // Enter inside cinematic
    assert((await evaluate('started')) === false, 'Space/Enter dialogue advance does not trigger accidental game round start');

    await evaluate('skipCinematic()');

    // 2.5 Cinematics replay via Sector Archive modal
    await evaluate('openCaseModal()');
    const modalOpen = await evaluate('document.getElementById("case-modal").style.display !== "none"');
    assert(modalOpen, 'Sector Archive modal opened');

    const replayButtons = await evaluate('document.querySelectorAll(".btn-story-replay").length');
    assert(replayButtons >= 5, `Sector Archive displays all Chapter 1 transmission replay buttons (count = ${replayButtons})`);

    // Click first replay button (Signal in the Dark)
    await evaluate('document.querySelector(".btn-story-replay").click()');
    await new Promise(r => setTimeout(r, 60));
    assert(await evaluate('isCinematicActive()'), 'Clicking transmission Replay button opens cinematic overlay');
    assert(!(await evaluate('document.getElementById("case-modal").style.display !== "none"')), 'Sector Archive modal closes when cinematic replay begins');
    const replayingTitle = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(replayingTitle === 'Signal in the Dark', `Replayed transmission is "Signal in the Dark" (got "${replayingTitle}")`);

    await evaluate('skipCinematic()');


    // ─── SECTION 3: Gameplay Preservation ───────────────────────────
    console.log('\n=== SECTION 3: Gameplay Preservation & Zero Regressions ===');

    // 3.1 Timer remains at 0 during cinematic and starts only on first movement
    await evaluate('loadLevel(0, true, false)');
    await evaluate('playCinematic("case01_intro")');
    assert((await evaluate('t')) === 0, 'Timer remains at 0 ticks while cinematic is open');
    await new Promise(r => setTimeout(r, 300));
    assert((await evaluate('t')) === 0, 'Timer does not accumulate time across real-time frames during cinematic');
    await evaluate('skipCinematic()');
    assert((await evaluate('t')) === 0, 'Timer still 0 immediately after cinematic dismisses');
    assert((await evaluate('started')) === false, 'Game not started until player moves');

    // First player movement starts round timer
    await pressKey('ArrowRight', 'ArrowRight');
    assert((await evaluate('started')) === true, 'Timer and loop start on first player movement');

    // 3.2 Pause, Reset, Movement, Shadows, Combat, Scoring, Achievements
    // Pause
    await pressKey('p', 'KeyP');
    assert(await evaluate('paused'), 'P key pauses game');
    await pressKey('p', 'KeyP');
    assert(!(await evaluate('paused')), 'P key resumes game');

    // Reset (Z)
    await pressKey('z', 'KeyZ');
    assert((await evaluate('t')) === 0, 'Z key resets round timer to 0');
    assert((await evaluate('started')) === false, 'Z key sets started back to false');

    // Combat strike facing direction in Case 04
    await evaluate('loadLevel(3, true, false)');
    await evaluate('pos = { x: 5, y: 2 };');
    await pressKey('ArrowRight', 'ArrowRight');
    await pressKey(' ', 'Space');
    assert((await evaluate('cd')) > 0, 'Space strike triggers weapon cooldown');

    // 3.3 No cinematic triggers unexpectedly on replaying already-viewed cases
    await evaluate('loadLevel(0, true)');
    assert(!(await evaluate('isCinematicActive()')), 'Replaying Case 01 does NOT trigger cinematic after being viewed');
    await evaluate('loadLevel(1, true)');
    assert(!(await evaluate('isCinematicActive()')), 'Replaying Case 02 does NOT trigger cinematic after being viewed');
    await evaluate('loadLevel(2, true)');
    assert(!(await evaluate('isCinematicActive()')), 'Replaying Case 03 does NOT trigger cinematic after being viewed');


    // ─── SECTION 4: Save Migration ──────────────────────────────────
    console.log('\n=== SECTION 4: Save Migration & Backward Compatibility ===');

    // 4.1 Inject pre-existing legacy save from an older version without story field
    const legacySaveFixture = {
      highestUnlocked: 5,
      completedCases: [0, 1, 2, 3, 4],
      gameCompleted: false,
      lastPlayed: 4,
      scores: { '0': 1000, '1': 850, '2': 900, '3': 780, '4': 920 },
      stars: { '0': 3, '1': 2, '2': 3, '3': 2, '4': 3 },
      caseStats: {
        '0': { loops: 2, totalTicks: 24, deaths: 0, completed: true },
        '1': { loops: 3, totalTicks: 38, deaths: 1, completed: true }
      },
      achievements: ['first_echo', 'perfect_timing', 'untouchable'],
      updatedAt: 1700000000000
    };

    await evaluate(`localStorage.setItem("vestigraid_progress_v1", '${JSON.stringify(legacySaveFixture)}')`);
    const migrated = await evaluate('loadProgress()');

    // Confirm existing progress preserved
    assert(migrated.highestUnlocked === 5, 'Migrated progress preserves highestUnlocked = 5');
    assert(migrated.completedCases.length === 5, 'Migrated progress preserves all 5 completed cases');
    assert(migrated.scores['0'] === 1000, 'Migrated progress preserves Case 01 score (1,000 pts)');
    assert(migrated.stars['0'] === 3, 'Migrated progress preserves Case 01 stars (3★)');
    assert(migrated.achievements.length === 3, 'Migrated progress preserves earned achievements');

    // Confirm missing story fields initialized safely
    assert(migrated.story !== undefined && typeof migrated.story === 'object', 'Story object safely initialized on legacy save');
    assert(Array.isArray(migrated.story.viewed) && migrated.story.viewed.length === 0, 'story.viewed initialized safely as empty array');
    assert(migrated.story.unlockedChapters.includes(1), 'story.unlockedChapters includes Chapter 1');
    assert(migrated.story.unlockedChapters.includes(2), 'story.unlockedChapters automatically includes Chapter 2 for highestUnlocked >= 3');

    // Confirm story viewing persists after reload
    await evaluate('markStoryViewed("ch1_intro")');
    await evaluate('markStoryViewed("case01_intro")');
    const reloadedProgress = await evaluate('loadProgress()');
    assert(reloadedProgress.story.viewed.includes('ch1_intro'), 'Viewing status persists into persistent storage');
    assert(reloadedProgress.story.viewed.includes('case01_intro'), 'Multiple viewed sequences persist properly');

    // 4.2 Restore user's original save
    if (originalSave) {
      await evaluate(`localStorage.setItem("vestigraid_progress_v1", '${originalSave}')`);
      console.log('Restored original user save successfully.');
    } else {
      await evaluate('localStorage.removeItem("vestigraid_progress_v1")');
    }

    proc.kill();

    console.log('\n===============================================================');
    const passed = testResults.filter(t => t.pass).length;
    const failed = testResults.filter(t => !t.pass).length;
    console.log(`BROWSER AUDIT COMPLETE: ${testResults.length} Tests | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Browser audit execution failed:', err);
    proc.kill();
    process.exit(1);
  }
}

runBrowserAudit();
