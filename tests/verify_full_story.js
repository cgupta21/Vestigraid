/**
 * Vestigraid Full Story Verification Script
 * Validates Chapters 1-4, Case 01-12 intros, chapter outros, and the Grand Epilogue in Chrome via CDP.
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

async function runFullStoryAudit() {
  const port = 9600 + Math.floor(Math.random() * 300);
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

    const originalSave = await evaluate('localStorage.getItem("vestigraid_progress_v1")');

    console.log('===============================================================');
    console.log(' FULL STORY AUDIT: THE ECHO PROTOCOL (CHAPTERS 1–4 & EPILOGUE)');
    console.log('===============================================================\n');

    // ─── 1. Registry & Metadata Verification ────────────────────────
    console.log('=== 1. Registry & Metadata ===');
    const totalChapters = await evaluate('CHAPTERS.length');
    assert(totalChapters === 4, 'Exactly 4 chapters defined');
    const totalSequences = await evaluate('Object.keys(STORY_SEQUENCES).length');
    assert(totalSequences === 21, 'Exactly 21 story sequences registered across all 4 chapters');

    // ─── 2. All 12 Case Introductions & Triggers ────────────────────
    console.log('\n=== 2. All 12 Case Introductions ===');
    await evaluate('localStorage.clear(); resetProgress();');

    // Expected mapping for each case:
    const expectedIntros = [
      { caseIdx: 0, title: 'Hold the Door', chapter: 1, speaker: 'SYSTEM' },
      { caseIdx: 1, title: 'Two Keys', chapter: 1, speaker: 'SYSTEM' },
      { caseIdx: 2, title: 'The Sentry', chapter: 1, speaker: 'WARDEN' },
      { caseIdx: 3, title: 'The Team', chapter: 2, speaker: 'SYSTEM' },
      { caseIdx: 4, title: 'The Relay', chapter: 2, speaker: 'SYSTEM' },
      { caseIdx: 5, title: 'Crossfire', chapter: 2, speaker: 'SYSTEM' },
      { caseIdx: 6, title: 'The Split', chapter: 3, speaker: 'SYSTEM' },
      { caseIdx: 7, title: 'The Last Loop', chapter: 3, speaker: 'SYSTEM' },
      { caseIdx: 8, title: 'The Laser Grid', chapter: 3, speaker: 'SYSTEM' },
      { caseIdx: 9, title: 'The Rift', chapter: 4, speaker: 'SYSTEM' },
      { caseIdx: 10, title: 'The Shift', chapter: 4, speaker: 'SYSTEM' },
      { caseIdx: 11, title: 'The Paradox', chapter: 4, speaker: 'SYSTEM' }
    ];

    for (const item of expectedIntros) {
      const caseId = 'case' + String(item.caseIdx + 1).padStart(2, '0') + '_intro';
      await evaluate(`playCinematic("${caseId}")`);
      assert(await evaluate('isCinematicActive()'), `Case ${String(item.caseIdx + 1).padStart(2, '0')} intro opens cinematic`);
      const title = await evaluate('document.getElementById("cinematic-title").textContent');
      assert(title === item.title, `Case ${String(item.caseIdx + 1).padStart(2, '0')} title is "${item.title}"`);
      const speaker = await evaluate('document.getElementById("cinematic-speaker").textContent');
      assert(speaker === item.speaker, `Case ${String(item.caseIdx + 1).padStart(2, '0')} speaker is "${item.speaker}"`);
      await evaluate('skipCinematic()');
      assert(await evaluate(`hasViewedStory("${caseId}")`), `${caseId} marked as viewed`);
    }

    // ─── 3. Four Chapter Introductions ──────────────────────────────
    console.log('\n=== 3. Four Chapter Introductions ===');
    const expectedChapterIntros = [
      { id: 'ch1_intro', title: 'Signal in the Dark', chapter: 1 },
      { id: 'ch2_intro', title: 'The Proving Grounds', chapter: 2 },
      { id: 'ch3_intro', title: 'Spatial Degradation', chapter: 3 },
      { id: 'ch4_intro', title: 'The Loop Collapse', chapter: 4 }
    ];

    for (const ch of expectedChapterIntros) {
      await evaluate(`playCinematic("${ch.id}")`);
      assert(await evaluate('isCinematicActive()'), `${ch.id} activates cinematic`);
      const title = await evaluate('document.getElementById("cinematic-title").textContent');
      assert(title === ch.title, `${ch.id} title is "${ch.title}"`);
      const badge = await evaluate('document.getElementById("cinematic-chapter").textContent');
      assert(badge.includes(`CHAPTER ${ch.chapter}`), `${ch.id} badge indicates Chapter ${ch.chapter}`);
      await evaluate('skipCinematic()');
      assert(await evaluate(`hasViewedStory("${ch.id}")`), `${ch.id} marked as viewed`);
    }

    // ─── 4. Four Chapter Outros & Case Victories ─────────────────────
    console.log('\n=== 4. Chapter Outros & Milestone Progression ===');

    // Case 03 victory -> ch1_outro
    await evaluate('loadLevel(2, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch1_outro"); saveProgress(progress);');
    await evaluate(`(() => {
      ghosts.push([{ x: 3, y: 2, f: [1, 0], s: 0 }]);
      pos = { x: 10, y: 2 };
      tick();
    })()`);
    assert(await evaluate('isCinematicActive()'), 'Case 03 victory triggers Chapter 1 Outro');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'Warden Alert Phase I', 'Chapter 1 outro title is "Warden Alert Phase I"');
    assert(await evaluate('getUnlockedChapters().includes(2)'), 'Chapter 2 unlocked in progress');
    await evaluate('skipCinematic()');
    await pressKey('Enter', 'Enter'); // dismiss ov

    // Case 06 victory -> ch2_outro
    await evaluate('loadLevel(5, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch2_outro"); saveProgress(progress);');
    await evaluate(`(() => {
      win();
    })()`);
    assert(await evaluate('isCinematicActive()'), 'Case 06 victory triggers Chapter 2 Outro');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'De-Synchronization', 'Chapter 2 outro title is "De-Synchronization"');
    assert(await evaluate('getUnlockedChapters().includes(3)'), 'Chapter 3 unlocked in progress');
    await evaluate('skipCinematic()');
    await pressKey('Enter', 'Enter'); // dismiss ov

    // Case 09 victory -> ch3_outro
    await evaluate('loadLevel(8, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch3_outro"); saveProgress(progress);');
    await evaluate(`(() => {
      win();
    })()`);
    assert(await evaluate('isCinematicActive()'), 'Case 09 victory triggers Chapter 3 Outro');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'The Core Collapsing', 'Chapter 3 outro title is "The Core Collapsing"');
    assert(await evaluate('getUnlockedChapters().includes(4)'), 'Chapter 4 unlocked in progress');
    await evaluate('skipCinematic()');
    await pressKey('Enter', 'Enter'); // dismiss ov

    // ─── 5. Case 12 Victory: Chapter 4 Outro + Grand Epilogue ────────
    console.log('\n=== 5. Grand Climax: Chapter 4 Outro and Epilogue ===');
    await evaluate('loadLevel(11, true, false)');
    await evaluate('progress = loadProgress(); progress.story.viewed = progress.story.viewed.filter(id => id !== "ch4_outro" && id !== "epilogue"); saveProgress(progress);');

    // Case 12 win
    await evaluate(`(() => {
      win();
    })()`);

    // Step A: Chapter 4 Outro plays first
    assert(await evaluate('isCinematicActive()'), 'Case 12 win triggers Chapter 4 Outro');
    const c4Title = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(c4Title === 'The Warden Falls', `Chapter 4 Outro is "The Warden Falls" (got "${c4Title}")`);
    const c4Lines = await evaluate('getStorySequence("ch4_outro").lines');
    const wardenStable = c4Lines.some(l => l.text.includes('independently stable') && l.text.includes('unnecessary'));
    assert(wardenStable, 'WARDEN recognizes Subject 00 as independently stable and declares containment unnecessary');
    assert(await evaluate('won'), 'Game state won is set to true');

    // Step B: Finishing Chapter 4 Outro immediately chains into Grand Epilogue
    await evaluate('skipCinematic()');
    assert(await evaluate('isCinematicActive()'), 'Grand Epilogue chains immediately after Chapter 4 Outro');
    const epiTitle = await evaluate('document.getElementById("cinematic-title").textContent');
    assert(epiTitle === 'The Echo Protocol', `Grand Epilogue title is "The Echo Protocol" (got "${epiTitle}")`);

    // Step C: Verify Subject 00 identity reveal in epilogue script
    const epiLines = await evaluate('getStorySequence("epilogue").lines');
    const hasSubject00 = epiLines.some(l => l.text.includes('Subject 00'));
    assert(hasSubject00, 'Epilogue text reveals Subject 00 as the original human operator');
    const hasDied = epiLines.some(l => l.text.includes('first experiment') || l.text.includes('initial experiment'));
    const hasPreservedPattern = epiLines.some(l => l.text.includes('preserved') && l.text.includes('behavioral pattern'));
    assert(hasDied && hasPreservedPattern, 'Epilogue reveals Subject 00 died during first experiment and Project ECHO preserved behavioral pattern');
    const hasFreeMoment = epiLines.some(l => l.text.includes('Subject 00: free') || l.text.includes('SUBJECT 00: FREE'));
    assert(hasFreeMoment, 'Epilogue retains Subject 00: free as an earlier narrative moment');
    const hasAmbiguousEnding = epiLines.some(l => l.text.includes('END OF EXPERIMENT — OR THE BEGINNING?'));
    assert(hasAmbiguousEnding, 'Epilogue concludes with original ending concept (END OF EXPERIMENT — OR THE BEGINNING?)');

    // Step D: Finishing Epilogue reveals Grand Final Overlay
    await evaluate('skipCinematic()');
    assert(!(await evaluate('isCinematicActive()')), 'Overlay closed after epilogue concludes');
    const grandOverlayVisible = await evaluate('document.getElementById("ov").style.display !== "none"');
    assert(grandOverlayVisible, 'Grand Final completion overlay displayed after epilogue');
    const grandHeading = await evaluate('document.querySelector("#ov h2").textContent');
    assert(grandHeading.includes('ALL CASES CLOSED'), 'Grand Final overlay displays ALL CASES CLOSED');

    // ─── 6. Replay Persistence & Sector Archive ─────────────────────
    console.log('\n=== 6. Replay Persistence & Sector Archive ===');

    // Dismiss overlay
    await evaluate('document.getElementById("ov").style.display = "none"');

    // Replay Case 12: should NOT re-trigger story scenes
    await evaluate('loadLevel(11, true)');
    assert(!(await evaluate('isCinematicActive()')), 'Replaying Case 12 does not trigger story scenes when already viewed');

    // Open Sector Archive modal: all 21 transmissions available
    await evaluate('openCaseModal()');
    const archiveTransmissionCount = await evaluate('document.querySelectorAll(".story-entry-card").length');
    assert(archiveTransmissionCount === 21, `All 21 transmissions rendered in Sector Archive (found ${archiveTransmissionCount})`);

    // Replay transmission from modal (e.g. Epilogue)
    await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('.btn-story-replay'));
      const epBtn = btns.find(b => b.getAttribute('data-seq-id') === 'epilogue');
      if (epBtn) epBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 60));
    assert(await evaluate('isCinematicActive()'), 'Clicking Epilogue replay in modal opens cinematic');
    assert((await evaluate('document.getElementById("cinematic-title").textContent')) === 'The Echo Protocol', 'Replayed sequence is "The Echo Protocol"');
    await evaluate('skipCinematic()');
    assert(!(await evaluate('isCinematicActive()')), 'Cinematic closed after replay');

    // Restore user's actual save
    if (originalSave) {
      await evaluate(`localStorage.setItem("vestigraid_progress_v1", '${originalSave}')`);
      console.log('Restored original user save.');
    } else {
      await evaluate('localStorage.removeItem("vestigraid_progress_v1")');
    }

    proc.kill();

    console.log('\n===============================================================');
    const passed = testResults.filter(t => t.pass).length;
    const failed = testResults.filter(t => !t.pass).length;
    console.log(`FULL STORY AUDIT: ${testResults.length} Tests | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Audit execution error:', err);
    proc.kill();
    process.exit(1);
  }
}

runFullStoryAudit();
